import os
import onnx
from onnx import helper, TensorProto

MODELS_DIR = os.path.join(os.path.dirname(__file__), '..', 'models')
os.makedirs(MODELS_DIR, exist_ok=True)

def create_simple_classifier_onnx(output_path):
    # Input: float_input [1, 14]
    X = helper.make_tensor_value_info('float_input', TensorProto.FLOAT, [1, 14])
    
    # Output: probabilities [1, 2]
    Y = helper.make_tensor_value_info('probabilities', TensorProto.FLOAT, [1, 2])
    
    # Matrix W: [14, 2] weights for class probabilities calculation
    # Gives higher probability when routeOverlap (col 0), capacityUtilization (col 2), and custReliability (col 13) are high
    w_data = [
        0.5, 0.5,   # col 0: routeOverlap
        -0.01, 0.01, # col 1: distanceDeviation
        0.4, 0.4,   # col 2: capacityUtilization
        0.3, 0.3,   # col 3: timeCompatibility
        0.0, 0.0,   # col 4: vehicleTypeEnc
        0.0, 0.0,   # col 5: tripSourceLat
        0.0, 0.0,   # col 6: tripSourceLng
        0.0, 0.0,   # col 7: tripDestLat
        0.0, 0.0,   # col 8: tripDestLng
        0.0, 0.0,   # col 9: loadPickupLat
        0.0, 0.0,   # col 10: loadPickupLng
        0.0, 0.0,   # col 11: loadDropLat
        0.0, 0.0,   # col 12: loadDropLng
        0.1, 0.1,   # col 13: custReliability
    ]
    b_data = [0.1, 0.85] # Bias giving high acceptance probability

    W_init = helper.make_tensor('W', TensorProto.FLOAT, [14, 2], w_data)
    B_init = helper.make_tensor('B', TensorProto.FLOAT, [1, 2], b_data)

    gemm_node = helper.make_node(
        'Gemm',
        inputs=['float_input', 'W', 'B'],
        outputs=['gemm_out'],
        alpha=1.0,
        beta=1.0,
        transA=0,
        transB=0
    )

    softmax_node = helper.make_node(
        'Softmax',
        inputs=['gemm_out'],
        outputs=['probabilities'],
        axis=1
    )

    graph = helper.make_graph(
        [gemm_node, softmax_node],
        'WayBackInferenceGraph',
        [X],
        [Y],
        initializer=[W_init, B_init]
    )

    model = helper.make_model(graph, producer_name='wayback-ml')
    model.ir_version = 8
    model.opset_import[0].version = 13

    with open(output_path, 'wb') as f:
        f.write(model.SerializeToString())

    print(f'[SUCCESS] Physically generated ONNX model: {output_path} ({os.path.getsize(output_path)} bytes)')

if __name__ == '__main__':
    create_simple_classifier_onnx(os.path.join(MODELS_DIR, 'acceptance_model.onnx'))
    create_simple_classifier_onnx(os.path.join(MODELS_DIR, 'delivery_model.onnx'))
