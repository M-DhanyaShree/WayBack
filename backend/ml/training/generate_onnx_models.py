import os
import sys
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType

MODELS_DIR = os.path.join(os.path.dirname(__file__), '..', 'models')
os.makedirs(MODELS_DIR, exist_ok=True)

FEATURE_COLUMNS = [
    'route_overlap',
    'distance_deviation',
    'capacity_utilization',
    'time_compatibility',
    'vehicle_type_enc',
    'trip_source_lat',
    'trip_source_lng',
    'trip_dest_lat',
    'trip_dest_lng',
    'load_pickup_lat',
    'load_pickup_lng',
    'load_drop_lat',
    'load_drop_lng',
    'cust_reliability',
]

def generate_synthetic_data(n_samples=200):
    np.random.seed(42)
    data = {
        'route_overlap': np.random.uniform(0.5, 1.0, n_samples).astype(np.float32),
        'distance_deviation': np.random.uniform(0, 50, n_samples).astype(np.float32),
        'capacity_utilization': np.random.uniform(0.2, 1.0, n_samples).astype(np.float32),
        'time_compatibility': np.random.uniform(0.7, 1.0, n_samples).astype(np.float32),
        'vehicle_type_enc': np.random.randint(0, 5, n_samples).astype(np.float32),
        'trip_source_lat': np.random.uniform(11.0, 13.0, n_samples).astype(np.float32),
        'trip_source_lng': np.random.uniform(76.0, 80.0, n_samples).astype(np.float32),
        'trip_dest_lat': np.random.uniform(11.0, 13.0, n_samples).astype(np.float32),
        'trip_dest_lng': np.random.uniform(76.0, 80.0, n_samples).astype(np.float32),
        'load_pickup_lat': np.random.uniform(11.0, 13.0, n_samples).astype(np.float32),
        'load_pickup_lng': np.random.uniform(76.0, 80.0, n_samples).astype(np.float32),
        'load_drop_lat': np.random.uniform(11.0, 13.0, n_samples).astype(np.float32),
        'load_drop_lng': np.random.uniform(76.0, 80.0, n_samples).astype(np.float32),
        'cust_reliability': np.random.uniform(3.0, 5.0, n_samples).astype(np.float32),
    }
    df = pd.DataFrame(data)
    df['accepted'] = (df['route_overlap'] * 0.4 + df['capacity_utilization'] * 0.3 + (df['cust_reliability']/5.0) * 0.3 > 0.6).astype(int)
    df['delivery_success'] = (df['route_overlap'] * 0.5 + df['time_compatibility'] * 0.5 > 0.65).astype(int)
    return df

def build_and_save_models():
    print('[ML TRAIN] Generating ML feature training set...')
    df = generate_synthetic_data(200)

    X = df[FEATURE_COLUMNS].values.astype(np.float32)
    y_acc = df['accepted'].values
    y_del = df['delivery_success'].values

    print('[ML TRAIN] Fitting RandomForest Acceptance Model...')
    model_acc = RandomForestClassifier(n_estimators=30, max_depth=5, random_state=42)
    model_acc.fit(X, y_acc)

    initial_type = [('float_input', FloatTensorType([None, len(FEATURE_COLUMNS)]))]
    onnx_acc = convert_sklearn(model_acc, initial_types=initial_type)
    acc_path = os.path.join(MODELS_DIR, 'acceptance_model.onnx')
    with open(acc_path, 'wb') as f:
        f.write(onnx_acc.SerializeToString())
    print(f'✅ Successfully written acceptance ONNX model to: {acc_path} ({os.path.getsize(acc_path)} bytes)')

    print('[ML TRAIN] Fitting RandomForest Delivery Model...')
    model_del = RandomForestClassifier(n_estimators=30, max_depth=5, random_state=42)
    model_del.fit(X, y_del)

    onnx_del = convert_sklearn(model_del, initial_types=initial_type)
    del_path = os.path.join(MODELS_DIR, 'delivery_model.onnx')
    with open(del_path, 'wb') as f:
        f.write(onnx_del.SerializeToString())
    print(f'✅ Successfully written delivery ONNX model to: {del_path} ({os.path.getsize(del_path)} bytes)')

if __name__ == '__main__':
    build_and_save_models()
