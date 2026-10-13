import { Response, NextFunction } from 'express';
import { prisma } from '../server';
import { AuthRequest } from '../middlewares/auth.middleware';
import { sendResponse } from '../utils/response';
import { TripStatus, LoadStatus, RecommendationStatus, Role } from '@prisma/client';

export const getDriverAnalytics = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const driverId = req.user!.id;
    
    const trips = await prisma.trip.findMany({ where: { driverId } });
    const recommendations = await prisma.recommendation.findMany({ where: { trip: { driverId } } });
    const loads = await prisma.load.findMany({ where: { recommendations: { some: { trip: { driverId }, status: 'ACCEPTED' } } } });
    const payments = await prisma.payment.findMany({ where: { load: { recommendations: { some: { trip: { driverId }, status: 'ACCEPTED' } } }, status: 'SUCCESS' } });

    const tripsCompleted = trips.filter(t => t.status === 'COMPLETED').length;
    
    const totalRecs = recommendations.length;
    const acceptedRecs = recommendations.filter(r => r.status === 'ACCEPTED').length;
    const recommendationAcceptanceRate = totalRecs > 0 ? (acceptedRecs / totalRecs) * 100 : 0;

    const totalLoads = loads.length;
    const deliveredLoads = loads.filter(l => l.status === 'DELIVERED').length;
    const deliveryCompletionRate = totalLoads > 0 ? (deliveredLoads / totalLoads) * 100 : 0;

    const earnings = payments.reduce((sum, p) => sum + p.amountMinorUnits, 0);

    // Simple utilization metric based on trips vs total days active
    const firstTrip = trips.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
    const daysActive = firstTrip ? Math.max(1, (new Date().getTime() - firstTrip.createdAt.getTime()) / (1000 * 3600 * 24)) : 1;
    const utilization = trips.length / daysActive; 

    sendResponse(res, 200, 'Driver analytics fetched', {
      tripsCompleted,
      recommendationAcceptanceRate,
      deliveryCompletionRate,
      earnings: earnings / 100, // convert back to major unit
      utilization
    });
  } catch (error) {
    next(error);
  }
};

export const getCustomerAnalytics = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const customerId = req.user!.id;

    const loads = await prisma.load.findMany({ where: { customerId } });
    const payments = await prisma.payment.findMany({ where: { userId: customerId, status: 'SUCCESS' } });

    const loadsCreated = loads.length;
    const successfulDeliveries = loads.filter(l => l.status === 'DELIVERED').length;
    const spending = payments.reduce((sum, p) => sum + p.amountMinorUnits, 0);

    sendResponse(res, 200, 'Customer analytics fetched', {
      loadsCreated,
      successfulDeliveries,
      spending: spending / 100
    });
  } catch (error) {
    next(error);
  }
};

export const getOwnerAnalytics = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ownerId = req.user!.id;

    const vehicles = await prisma.vehicle.findMany({ 
      where: { ownerId },
      include: {
        trips: {
          include: {
            recommendations: true
          }
        }
      }
    });

    let totalTrips = 0;
    let totalRecs = 0;
    let acceptedRecs = 0;

    vehicles.forEach(v => {
      totalTrips += v.trips.length;
      v.trips.forEach(t => {
        totalRecs += t.recommendations.length;
        acceptedRecs += t.recommendations.filter(r => r.status === 'ACCEPTED').length;
      });
    });

    const fleetSize = vehicles.length;
    // Fleet utilization could be avg trips per vehicle
    const fleetUtilization = fleetSize > 0 ? totalTrips / fleetSize : 0;
    
    // Detailed per vehicle
    const vehicleUtilization = vehicles.map(v => ({
      vehicleId: v.id,
      registrationNo: v.registrationNo,
      trips: v.trips.length
    }));

    const recommendationEffectiveness = totalRecs > 0 ? (acceptedRecs / totalRecs) * 100 : 0;

    sendResponse(res, 200, 'Owner analytics fetched', {
      vehicleUtilization,
      fleetUtilization,
      recommendationEffectiveness
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminAnalytics = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const totalUsers = await prisma.user.count();
    const totalVehicles = await prisma.vehicle.count();
    const totalTrips = await prisma.trip.count();
    const totalLoads = await prisma.load.count();
    const totalPayments = await prisma.payment.aggregate({
      _sum: { amountMinorUnits: true },
      where: { status: 'SUCCESS' }
    });

    const recommendations = await prisma.recommendation.findMany();
    const totalRecs = recommendations.length;
    const acceptedRecs = recommendations.filter(r => r.status === 'ACCEPTED').length;
    const rejectedRecs = recommendations.filter(r => r.status === 'REJECTED').length;

    sendResponse(res, 200, 'Admin analytics fetched', {
      platformMetrics: {
        totalUsers,
        totalVehicles,
        totalTrips,
        totalLoads,
        totalVolumeProcessed: (totalPayments._sum.amountMinorUnits || 0) / 100
      },
      recommendationPerformance: {
        totalGenerated: totalRecs,
        accepted: acceptedRecs,
        rejected: rejectedRecs,
        acceptanceRate: totalRecs > 0 ? (acceptedRecs / totalRecs) * 100 : 0
      }
    });
  } catch (error) {
    next(error);
  }
};
