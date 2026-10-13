import os
import sys
import numpy as np
import pandas as pd
import onnx
import onnxruntime as ort

from xgboost import XGBClassifier
from onnxmltools import convert_xgboost
from onnxmltools.convert.common.data_types import FloatTensorType as XGBFloatTensorType
from sklearn.model_selection import train_test_split
from sklearn.metrics import confusion_matrix, precision_score, recall_score, roc_auc_score

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

def generate_logistics_dataset(n_samples=1200):
    np.random.seed(42)
    route_overlap = np.random.uniform(0.0, 1.0, n_samples).astype(np.float32)
    distance_deviation = np.random.uniform(0.0, 200.0, n_samples).astype(np.float32)
    capacity_utilization = np.random.uniform(0.1, 1.0, n_samples).astype(np.float32)
    time_compatibility = np.random.uniform(0.1, 1.0, n_samples).astype(np.float32)
    vehicle_type_enc = np.random.randint(0, 6, n_samples).astype(np.float32)
    
    trip_source_lat = np.random.uniform(11.0, 13.1, n_samples).astype(np.float32)
    trip_source_lng = np.random.uniform(76.9, 80.2, n_samples).astype(np.float32)
    trip_dest_lat = np.random.uniform(11.0, 13.1, n_samples).astype(np.float32)
    trip_dest_lng = np.random.uniform(76.9, 80.2, n_samples).astype(np.float32)
    
    load_pickup_lat = np.random.uniform(11.0, 13.1, n_samples).astype(np.float32)
    load_pickup_lng = np.random.uniform(76.9, 80.2, n_samples).astype(np.float32)
    load_drop_lat = np.random.uniform(11.0, 13.1, n_samples).astype(np.float32)
    load_drop_lng = np.random.uniform(76.9, 80.2, n_samples).astype(np.float32)
    cust_reliability = np.random.uniform(1.0, 5.0, n_samples).astype(np.float32)

    # Realistic logistics probability formula
    logit_acc = (
        3.5 * route_overlap 
        - 0.02 * distance_deviation 
        + 1.8 * capacity_utilization 
        + 0.5 * (cust_reliability / 5.0)
        - 1.5
    )
    prob_acc = 1.0 / (1.0 + np.exp(-logit_acc))
    accepted = (np.random.uniform(0, 1, n_samples) < prob_acc).astype(int)

    logit_del = (
        2.5 * route_overlap 
        + 2.0 * time_compatibility 
        + 1.2 * (cust_reliability / 5.0)
        - 1.8
    )
    prob_del = 1.0 / (1.0 + np.exp(-logit_del))
    delivery_success = (np.random.uniform(0, 1, n_samples) < prob_del).astype(int)

    df = pd.DataFrame({
        'route_overlap': route_overlap,
        'distance_deviation': distance_deviation,
        'capacity_utilization': capacity_utilization,
        'time_compatibility': time_compatibility,
        'vehicle_type_enc': vehicle_type_enc,
        'trip_source_lat': trip_source_lat,
        'trip_source_lng': trip_source_lng,
        'trip_dest_lat': trip_dest_lat,
        'trip_dest_lng': trip_dest_lng,
        'load_pickup_lat': load_pickup_lat,
        'load_pickup_lng': load_pickup_lng,
        'load_drop_lat': load_drop_lat,
        'load_drop_lng': load_drop_lng,
        'cust_reliability': cust_reliability,
        'accepted': accepted,
        'delivery_success': delivery_success,
    })
    return df

def train_eval_and_export():
    print('====================================================')
    print('WAYBACK ML MODEL TRAINING & EVALUATION AUDIT')
    print('====================================================\n')

    df = generate_logistics_dataset(1200)
    print(f'Training Dataset Size: {len(df)} rows')
    print(f'Feature Columns ({len(FEATURE_COLUMNS)}): {FEATURE_COLUMNS}\n')

    X = df[FEATURE_COLUMNS].astype(np.float32)
    y_acc = df['accepted']
    y_del = df['delivery_success']

    X_train_a, X_test_a, y_train_a, y_test_a = train_test_split(X, y_acc, test_size=0.25, random_state=42)
    X_train_d, X_test_d, y_train_d, y_test_d = train_test_split(X, y_del, test_size=0.25, random_state=42)

    # 1. Acceptance Model
    acc_model = XGBClassifier(n_estimators=80, max_depth=4, learning_rate=0.08, random_state=42, eval_metric='logloss')
    acc_model.fit(X_train_a.values, y_train_a.values)
    y_pred_a = acc_model.predict(X_test_a.values)
    y_prob_a = acc_model.predict_proba(X_test_a.values)[:, 1]

    cm_a = confusion_matrix(y_test_a, y_pred_a)
    prec_a = precision_score(y_test_a, y_pred_a)
    rec_a = recall_score(y_test_a, y_pred_a)
    roc_a = roc_auc_score(y_test_a, y_prob_a)

    print('--- 1. ACCEPTANCE MODEL TRAINING EVALUATION METRICS ---')
    print(f'Confusion Matrix:\n{cm_a}')
    print(f'Precision: {prec_a:.4f}')
    print(f'Recall:    {rec_a:.4f}')
    print(f'ROC-AUC:   {roc_a:.4f}\n')

    # Convert Acceptance Model to ONNX
    initial_type = [('float_input', XGBFloatTensorType([None, len(FEATURE_COLUMNS)]))]
    onnx_acc = convert_xgboost(acc_model, initial_types=initial_type, target_opset=13)
    onnx_acc.ir_version = 8
    acc_path = os.path.join(MODELS_DIR, 'acceptance_model.onnx')
    with open(acc_path, 'wb') as f:
        f.write(onnx_acc.SerializeToString())
    print(f'[SUCCESS] Acceptance ONNX Model exported: {acc_path} ({os.path.getsize(acc_path)} bytes)\n')

    # 2. Delivery Model
    del_model = XGBClassifier(n_estimators=80, max_depth=4, learning_rate=0.08, random_state=42, eval_metric='logloss')
    del_model.fit(X_train_d.values, y_train_d.values)
    y_pred_d = del_model.predict(X_test_d.values)
    y_prob_d = del_model.predict_proba(X_test_d.values)[:, 1]

    cm_d = confusion_matrix(y_test_d, y_pred_d)
    prec_d = precision_score(y_test_d, y_pred_d)
    rec_d = recall_score(y_test_d, y_pred_d)
    roc_d = roc_auc_score(y_test_d, y_prob_d)

    print('--- 2. DELIVERY SUCCESS MODEL TRAINING EVALUATION METRICS ---')
    print(f'Confusion Matrix:\n{cm_d}')
    print(f'Precision: {prec_d:.4f}')
    print(f'Recall:    {rec_d:.4f}')
    print(f'ROC-AUC:   {roc_d:.4f}\n')

    onnx_del = convert_xgboost(del_model, initial_types=initial_type, target_opset=13)
    onnx_del.ir_version = 8
    del_path = os.path.join(MODELS_DIR, 'delivery_model.onnx')
    with open(del_path, 'wb') as f:
        f.write(onnx_del.SerializeToString())
    print(f'[SUCCESS] Delivery ONNX Model exported: {del_path} ({os.path.getsize(del_path)} bytes)\n')

    # 3. ONNX GRAPH STRUCTURAL INSPECTION
    print('====================================================')
    print('ONNX GRAPH STRUCTURE & METADATA INSPECTION')
    print('====================================================\n')

    model_proto = onnx.load(acc_path)
    graph = model_proto.graph

    print(f'Model File: {os.path.basename(acc_path)}')
    print(f'IR Version: {model_proto.ir_version}')
    print(f'Opset Version: {model_proto.opset_import[0].version}')
    print(f'Producer Name: {model_proto.producer_name}')
    print(f'Graph Name: {graph.name}')
    print(f'Input Tensors ({len(graph.input)}): {[inp.name for inp in graph.input]}')
    print(f'Output Tensors ({len(graph.output)}): {[out.name for out in graph.output]}')
    print(f'Total Graph Nodes: {len(graph.node)}')
    print(f'Node Operators: {list(set([n.op_type for n in graph.node]))}\n')

    # 4. INFERENCE ACROSS 5 DRASTICALLY DIFFERENT FEATURE VECTORS
    print('====================================================')
    print('ONNX INFERENCE ACROSS 5 DRASTICALLY DIFFERENT FEATURE VECTORS')
    print('====================================================\n')

    vectors = [
        # Vector 1: Perfect Overlap, Low Deviation, High Capacity, High Trust
        [1.0, 2.0, 0.90, 0.95, 0.0, 11.0168, 76.9558, 13.0827, 80.2707, 12.9249, 80.1000, 11.1932, 77.2680, 4.9],
        # Vector 2: Medium Overlap, Moderate Deviation
        [0.55, 35.0, 0.50, 0.75, 1.0, 11.0168, 76.9558, 13.0827, 80.2707, 11.6643, 78.1460, 11.3410, 77.7172, 3.5],
        # Vector 3: Zero Overlap, Extreme Deviation (180 km)
        [0.0, 180.0, 0.15, 0.30, 2.0, 11.0168, 76.9558, 13.0827, 80.2707, 9.9252, 78.1198, 8.1833, 77.4119, 2.0],
        # Vector 4: High Deviation (120 km), Low Overlap
        [0.10, 120.0, 0.95, 0.40, 3.0, 11.0168, 76.9558, 13.0827, 80.2707, 10.7905, 78.7047, 10.3673, 77.9803, 3.0],
        # Vector 5: High Capacity (0.98), Zero Deviation, Perfect Overlap, Max Trust
        [0.98, 0.0, 0.98, 1.0, 0.0, 11.0168, 76.9558, 13.0827, 80.2707, 12.9249, 80.1000, 11.0168, 76.9558, 5.0]
    ]

    descriptions = [
        "Vector 1: Perfect Overlap (1.0), Low Dev (2km), High Cap (0.90), High Trust (4.9)",
        "Vector 2: Medium Overlap (0.55), Mod Dev (35km), Med Cap (0.50), Avg Trust (3.5)",
        "Vector 3: Zero Overlap (0.0), Extreme Dev (180km), Low Cap (0.15), Low Trust (2.0)",
        "Vector 4: High Dev (120km), Low Overlap (0.10), High Cap (0.95), Avg Trust (3.0)",
        "Vector 5: Perfect Overlap (0.98), Zero Dev (0km), Max Cap (0.98), Max Trust (5.0)"
    ]

    session_a = ort.InferenceSession(acc_path)
    session_d = ort.InferenceSession(del_path)

    for idx, (v, desc) in enumerate(zip(vectors, descriptions), 1):
        tensor = np.array([v], dtype=np.float32)
        feeds = {'float_input': tensor}

        res_a = session_a.run(None, feeds)
        res_d = session_d.run(None, feeds)

        # ZipMap / Probabilities output in ONNX XGBoost runtime
        prob_a = res_a[1][0][1] if len(res_a) > 1 and isinstance(res_a[1], list) else (res_a[0][0][1] if res_a[0].ndim > 1 else res_a[0][0])
        prob_d = res_d[1][0][1] if len(res_d) > 1 and isinstance(res_d[1], list) else (res_d[0][0][1] if res_d[0].ndim > 1 else res_d[0][0])

        print(f'Test Case {idx}: {desc}')
        print(f'  Feature Vector:       {v}')
        print(f'  Acceptance Prob:      {prob_a:.6f}')
        print(f'  Delivery Success Prob:{prob_d:.6f}')
        print(f'  Combined ML Score:    {(prob_a * 60 + prob_d * 40):.2f} / 100\n')

if __name__ == '__main__':
    train_eval_and_export()
