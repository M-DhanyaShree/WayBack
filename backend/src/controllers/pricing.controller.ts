import { Request, Response, NextFunction } from 'express';
import { calculateDynamicPricing } from '../services/pricing.service';
import { sendResponse } from '../utils/response';
import { getRouteGeometry } from '../utils/ors';

const getDistanceHaversine = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
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

export const estimatePricing = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let { distanceKm, originLat, originLng, destLat, destLng, weightKg, vehicleType, isReturnTrip } = req.body;

    if (!distanceKm && originLat && originLng && destLat && destLng) {
      try {
        const route = await getRouteGeometry([Number(originLng), Number(originLat)], [Number(destLng), Number(destLat)]);
        if (route?.distanceKm) {
          distanceKm = route.distanceKm;
        } else {
          distanceKm = getDistanceHaversine(Number(originLat), Number(originLng), Number(destLat), Number(destLng)) * 1.25;
        }
      } catch {
        distanceKm = getDistanceHaversine(Number(originLat), Number(originLng), Number(destLat), Number(destLng)) * 1.25;
      }
    }

    const breakdown = calculateDynamicPricing({
      distanceKm: Number(distanceKm) || 50,
      weightKg: weightKg ? Number(weightKg) : 500,
      vehicleType: vehicleType || 'PICKUP',
      isReturnTrip: isReturnTrip !== false,
    });

    sendResponse(res, 200, 'Dynamic pricing estimated successfully', {
      breakdown,
    });
  } catch (error) {
    next(error);
  }
};
