import os
import sys
import numpy as np
import pandas as pd

from xgboost import XGBClassifier
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType
from onnxmltools import convert_xgboost
from onnxmltools.convert.common.data_types import FloatTensorType as XGBFloatTensorType

from dataset import extract_recommendation_dataset, FEATURE_COLUMNS

MODELS_DIR = os.path.join(os.path.dirname(__file__), '..', 'models')
os.makedirs(MODELS_DIR, exist_ok=True)


def train_acceptance_model(df: pd.DataFrame):
    X = df[FEATURE_COLUMNS].astype(np.float32)
    y = df['accepted'].astype(int)

    model = XGBClassifier(
        n_estimators=100,
        max_depth=5,
        learning_rate=0.1,
        use_label_encoder=False,
        eval_metric='logloss',
        random_state=42,
    )
    model.fit(X, y)

    initial_type = [('float_input', XGBFloatTensorType([None, len(FEATURE_COLUMNS)]))]
    onnx_model = convert_xgboost(model, initial_types=initial_type)

    onnx_path = os.path.join(MODELS_DIR, 'acceptance_model.onnx')
    with open(onnx_path, 'wb') as f:
        f.write(onnx_model.SerializeToString())
    print(f'[TRAIN] Acceptance model saved to {onnx_path}')
    return model


def train_delivery_model(df: pd.DataFrame):
    df_success = df[df['accepted'] == 1]
    if len(df_success) < 10:
        print('[TRAIN] Not enough accepted recommendation data to train delivery model. Skipping.')
        return None

    X = df_success[FEATURE_COLUMNS].astype(np.float32)
    y = df_success['delivery_success'].astype(int)

    model = XGBClassifier(
        n_estimators=100,
        max_depth=5,
        learning_rate=0.1,
        use_label_encoder=False,
        eval_metric='logloss',
        random_state=42,
    )
    model.fit(X, y)

    initial_type = [('float_input', XGBFloatTensorType([None, len(FEATURE_COLUMNS)]))]
    onnx_model = convert_xgboost(model, initial_types=initial_type)

    onnx_path = os.path.join(MODELS_DIR, 'delivery_model.onnx')
    with open(onnx_path, 'wb') as f:
        f.write(onnx_model.SerializeToString())
    print(f'[TRAIN] Delivery model saved to {onnx_path}')
    return model


def main():
    print('[TRAIN] Extracting dataset from PostgreSQL...')
    df = extract_recommendation_dataset()
    print(f'[TRAIN] Dataset size: {len(df)} rows')

    if len(df) < 5:
        print('[TRAIN] Insufficient training data. Need at least 5 labelled recommendations.')
        sys.exit(0)

    print('[TRAIN] Training acceptance probability model...')
    train_acceptance_model(df)

    print('[TRAIN] Training delivery success model...')
    train_delivery_model(df)

    print('[TRAIN] Training complete.')


if __name__ == '__main__':
    main()
