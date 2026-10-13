import * as ort from 'onnxruntime-node';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger';

const MODELS_DIR = path.join(__dirname, '../../ml/models');

let acceptanceSession: ort.InferenceSession | null = null;
let deliverySession: ort.InferenceSession | null = null;

export const loadModels = async (): Promise<void> => {
  const acceptancePath = path.join(MODELS_DIR, 'acceptance_model.onnx');
  const deliveryPath = path.join(MODELS_DIR, 'delivery_model.onnx');

  if (fs.existsSync(acceptancePath)) {
    acceptanceSession = await ort.InferenceSession.create(acceptancePath);
    logger.info('ML: Acceptance model loaded');
  } else {
    logger.warn('ML: acceptance_model.onnx not found — run ml/training/train.py first');
  }

  if (fs.existsSync(deliveryPath)) {
    deliverySession = await ort.InferenceSession.create(deliveryPath);
    logger.info('ML: Delivery model loaded');
  } else {
    logger.warn('ML: delivery_model.onnx not found — run ml/training/train.py first');
  }
};

export interface RecommendationFeatures {
  routeOverlap: number;
  distanceDeviation: number;
  capacityUtilization: number;
  timeCompatibility: number;
  vehicleTypeEnc: number; // 0-5 (TRUCK=0, MINI_TRUCK=1, PICKUP=2, TEMPO=3, VAN=4, OTHER=5)
  tripSourceLat: number;
  tripSourceLng: number;
  tripDestLat: number;
  tripDestLng: number;
  loadPickupLat: number;
  loadPickupLng: number;
  loadDropLat: number;
  loadDropLng: number;
  custReliability?: number;
}

const buildTensor = (features: RecommendationFeatures): ort.Tensor => {
  const data = new Float32Array([
    features.routeOverlap,
    features.distanceDeviation,
    features.capacityUtilization,
    features.timeCompatibility,
    features.vehicleTypeEnc,
    features.tripSourceLat,
    features.tripSourceLng,
    features.tripDestLat,
    features.tripDestLng,
    features.loadPickupLat,
    features.loadPickupLng,
    features.loadDropLat,
    features.loadDropLng,
    features.custReliability ?? 5.0,
  ]);
  return new ort.Tensor('float32', data, [1, 14]);
};

const runSession = async (session: ort.InferenceSession, features: RecommendationFeatures): Promise<number> => {
  const tensor = buildTensor(features);
  const feeds = { float_input: tensor };
  const results = await session.run(feeds);
  // XGBoost ONNX outputs probabilities under 'probabilities'
  const probabilities = results['probabilities'];
  if (probabilities && probabilities.data) {
    // data is [prob_class_0, prob_class_1] per sample
    return (probabilities.data as Float32Array)[1];
  }
  return 0.5;
};

export const predictAcceptanceProbability = async (features: RecommendationFeatures): Promise<number> => {
  if (!acceptanceSession) return -1; // Signal: model not loaded
  return runSession(acceptanceSession, features);
};

export const predictDeliveryProbability = async (features: RecommendationFeatures): Promise<number> => {
  if (!deliverySession) return -1;
  return runSession(deliverySession, features);
};
