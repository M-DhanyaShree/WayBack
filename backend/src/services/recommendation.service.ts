import { prisma } from '../server';
import {
  predictAcceptanceProbability,
  predictDeliveryProbability,
  RecommendationFeatures,
} from './mlModel.service';
import { logger } from '../utils/logger';
import { MatchQuality } from '@prisma/client';

const VEHICLE_TYPE_ENC: Record<string, number> = {
  TRUCK: 0,
  MINI_TRUCK: 1,
  PICKUP: 2,
  TEMPO: 3,
  VAN: 4,
  OTHER: 5,
};

const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const generateRecommendationsForTrip = async (tripId: string): Promise<void> => {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { 
      vehicle: true,
      driver: { include: { driverPreference: true } }
    },
  });

  if (!trip) throw new Error('Trip not found');

  const pref = trip.driver.driverPreference;
  const flexLevel = trip.flexibilityOverride || pref?.flexibilityLevel || 'BALANCED';
  
  let radiusMeters = 30000;
  if (flexLevel === 'STRICT') radiusMeters = 10000;
  if (flexLevel === 'FLEXIBLE') radiusMeters = 70000;

  const capacityWeight = trip.availableWeight || trip.vehicle.capacityWeight;
  const capacityVolume = trip.availableVolume || trip.vehicle.capacityVolume;

  const returnLat = trip.returnToLat || trip.sourceLat;
  const returnLng = trip.returnToLng || trip.sourceLng;
  const returnDirectDist = getDistance(trip.destLat, trip.destLng, returnLat, returnLng) || 1;

  // 1. Spatial Candidate Retrieval, Volume & Time Window Compatibility
  let pendingLoads: any[] = [];
  try {
    // Attempt PostGIS spatial corridor query if spatial extensions exist
    pendingLoads = await prisma.$queryRaw`
      SELECT l.id, l."customerId", l."pickupName", l."pickupLat", l."pickupLng", l."dropName", l."dropLat", l."dropLng", l.weight, l."volumeCbf", l."goodsCategory", l.budget, l.status, l."latestPickupAt"
      FROM "Load" l
      CROSS JOIN "Trip" t
      WHERE t.id = ${tripId}
        AND l.status IN ('PENDING', 'SCHEDULED')
        AND l.weight <= ${capacityWeight}
        AND (l."volumeCbf" IS NULL OR l."volumeCbf" = 0 OR l."volumeCbf" <= ${capacityVolume})
        AND (
          l."latestPickupAt" IS NULL 
          OR t."expectedArrivalAt" IS NULL 
          OR l."latestPickupAt" >= t."expectedArrivalAt"
        )
    `;
  } catch (sqlErr) {
    // Bulletproof fallback to standard Prisma query if raw PostGIS has table locks or missing extension
    pendingLoads = await prisma.load.findMany({
      where: {
        status: { in: ['PENDING', 'SCHEDULED'] },
        weight: { lte: capacityWeight }
      }
    });
  }

  for (const load of pendingLoads) {
    // 5. Driver Preference Filtering
    if (pref?.rejectedCategories && pref.rejectedCategories.includes(load.goodsCategory)) continue;

    // Volume capacity check
    if (load.volumeCbf && load.volumeCbf > capacityVolume) continue;

    // Fetch customer profile for reliability score
    const custUser = await prisma.user.findUnique({
      where: { id: load.customerId },
      include: { profile: true }
    });
    const custReliability = custUser?.profile?.trustScore ?? custUser?.profile?.reliabilityScore ?? 5.0;

    // 2. Comprehensive Return Corridor Analysis (Coimbatore -> Chennai -> Salem -> Coimbatore)
    const distToPickup = getDistance(trip.destLat, trip.destLng, load.pickupLat, load.pickupLng);
    const distPickupToDrop = getDistance(load.pickupLat, load.pickupLng, load.dropLat, load.dropLng);
    const distDropToDest = getDistance(load.dropLat, load.dropLng, returnLat, returnLng);

    // Directionality: The load should travel along the return corridor towards the return hub
    const distPickupToReturn = getDistance(load.pickupLat, load.pickupLng, returnLat, returnLng);
    const movesTowardsReturnHub = distDropToDest <= (distPickupToReturn + 35) || distDropToDest <= 60;

    // Check if pickup is within reasonable range of driver turnaround location (e.g. 75-100km of Chennai)
    const maxPickupRadiusKm = flexLevel === 'STRICT' ? 40 : flexLevel === 'FLEXIBLE' ? 120 : 80;
    const isPickupInCorridor = distToPickup <= maxPickupRadiusKm || distPickupToReturn <= (returnDirectDist + 40);

    if (!isPickupInCorridor) continue;
    if (!movesTowardsReturnHub) continue;

    const totalDeviatedDist = distToPickup + distPickupToDrop + distDropToDest;
    const distanceDeviation = Math.max(0, totalDeviatedDist - returnDirectDist);

    // Detour tolerance threshold
    const maxAllowedDetourKm = flexLevel === 'STRICT' ? 40 : flexLevel === 'FLEXIBLE' ? 140 : 85;
    if (distanceDeviation > maxAllowedDetourKm) continue;

    const overlapRatio = Math.max(0, 1 - distanceDeviation / returnDirectDist);
    const routeOverlap = Math.min(1, overlapRatio);
    
    // 4. Vehicle Compatibility
    const capacityUtilization = load.weight / trip.vehicle.capacityWeight;
    const timeCompatibility = 1.0;

    // 6. ML Ranking & Feature Extraction
    const features: RecommendationFeatures = {
      routeOverlap,
      distanceDeviation,
      capacityUtilization,
      timeCompatibility,
      vehicleTypeEnc: VEHICLE_TYPE_ENC[trip.vehicle.type] ?? 5,
      tripSourceLat: trip.sourceLat,
      tripSourceLng: trip.sourceLng,
      tripDestLat: trip.destLat,
      tripDestLng: trip.destLng,
      loadPickupLat: load.pickupLat,
      loadPickupLng: load.pickupLng,
      loadDropLat: load.dropLat,
      loadDropLng: load.dropLng,
      custReliability,
    };

    let acceptanceProb = await predictAcceptanceProbability(features);
    let deliveryProb = await predictDeliveryProbability(features);

    const featureVector = [
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
    ];

    // Corridor Completion & Deadhead Minimization:
    // A load dropping directly at the return hub (distDropToDest near 0) has 100% completion.
    // An intermediate drop (e.g. Salem, 150km before Coimbatore) leaves 150km of empty deadhead driving.
    const deadheadRemainingKm = distDropToDest;
    const completionRatio = Math.max(0, Math.min(1, 1 - (deadheadRemainingKm / returnDirectDist)));
    const pickupConvenience = Math.max(0, 1 - (distToPickup / 80));

    // Logistics Physical Fit Score (0-100):
    // 40% corridor alignment, 40% end-to-end completion (zero empty miles home), 20% pickup convenience
    const logisticsFitScore = (routeOverlap * 40) + (completionRatio * 40) + (pickupConvenience * 20);

    let score: number;
    let reasonObj = {};
    if (acceptanceProb >= 0 && deliveryProb >= 0) {
      // Hybrid Multi-Objective Scoring: 70% Physical Logistics Fit + 30% ML Probability
      const mlProbScore = acceptanceProb * 60 + deliveryProb * 40;
      score = (logisticsFitScore * 0.70) + (mlProbScore * 0.30);
      reasonObj = {
        type: 'HYBRID_LOGISTICS_ML',
        isMLFallback: false,
        logisticsFitScore,
        completionRatio,
        deadheadRemainingKm,
        mlProbScore,
        rawAcceptanceProb: acceptanceProb,
        rawDeliveryProb: deliveryProb,
        custReliability,
        featureVector,
      };
    } else if (acceptanceProb >= 0) {
      score = (logisticsFitScore * 0.75) + (acceptanceProb * 25);
      reasonObj = {
        type: 'PARTIAL_ML',
        isMLFallback: false,
        logisticsFitScore,
        completionRatio,
        rawAcceptanceProb: acceptanceProb,
        custReliability,
        featureVector,
      };
    } else {
      score = logisticsFitScore;
      reasonObj = {
        type: 'HEURISTIC',
        isMLFallback: true,
        routeOverlap,
        completionRatio,
        capacityUtilization,
        custReliability,
        featureVector,
      };
    }

    // Apply Customer Reliability Score Weighting (trust multiplier)
    const trustFactor = Math.max(0.2, Math.min(1.2, custReliability / 5.0));
    score = score * trustFactor;

    // Category Preference Booster
    if (pref?.preferredCategories && pref.preferredCategories.includes(load.goodsCategory)) {
      score = score * 1.15;
    }

    // Budget & Earnings Incentive Booster (fair driver compensation for full return trips)
    if (load.budget && load.budget > 6000) {
      const earningsBooster = Math.min(1.12, 1 + ((load.budget - 6000) / 30000));
      score = score * earningsBooster;
    }

    // Penalize extreme distance deviation (>100 km)
    if (distanceDeviation > 100) {
      const penalty = Math.max(0.1, 1 - (distanceDeviation - 100) / 300);
      score = score * penalty;
    }

    score = Math.max(0, Math.min(100, score));
    if (score < 15) continue;

    // 7. Excellent / Good / Fair classification
    let matchQuality: any = 'FAIR';
    if (score >= 80) matchQuality = 'EXCELLENT';
    else if (score >= 50) matchQuality = 'GOOD';

    await prisma.recommendation.upsert({
      where: { tripId_loadId: { tripId: trip.id, loadId: load.id } },
      update: {
        routeOverlap,
        distanceDeviation,
        capacityUtilization,
        timeCompatibility,
        score,
        custReliability,
        matchQuality,
        recommendationReason: reasonObj,
      },
      create: {
        tripId: trip.id,
        loadId: load.id,
        routeOverlap,
        distanceDeviation,
        capacityUtilization,
        timeCompatibility,
        vehicleType: trip.vehicle.type,
        loadType: load.goodsCategory,
        tripSourceLat: trip.sourceLat,
        tripSourceLng: trip.sourceLng,
        tripDestLat: trip.destLat,
        tripDestLng: trip.destLng,
        loadPickupLat: load.pickupLat,
        loadPickupLng: load.pickupLng,
        loadDropLat: load.dropLat,
        loadDropLng: load.dropLng,
        score,
        custReliability,
        matchQuality,
        recommendationReason: reasonObj,
      },
    });
  }
};
