import { Response, NextFunction } from 'express';
import { prisma } from '../server';
import { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../utils/AppError';
import { sendResponse } from '../utils/response';
import { LoadStatus, Role, Prisma, RecommendationStatus } from '@prisma/client';
import { generateRecommendationsForTrip } from '../services/recommendation.service';

export const createLoad = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const customerId = req.user!.id;
    const { 
      pickupName, pickupLat, pickupLng, dropName, dropLat, dropLng, pickupTime, dropTime, weight, dimensions, goodsCategory, budget,
      schedulingType, pickupWindowStart, pickupWindowEnd, earliestPickupAt, latestPickupAt
    } = req.body;

    const load = await prisma.load.create({
      data: {
        customerId, pickupName, pickupLat, pickupLng, dropName, dropLat, dropLng,
        pickupTime: pickupTime ? new Date(pickupTime) : undefined,
        dropTime: dropTime ? new Date(dropTime) : undefined,
        weight: parseFloat(weight),
        dimensions, goodsCategory,
        budget: parseInt(budget, 10),
        schedulingType,
        pickupWindowStart: pickupWindowStart ? new Date(pickupWindowStart) : undefined,
        pickupWindowEnd: pickupWindowEnd ? new Date(pickupWindowEnd) : undefined,
        earliestPickupAt: earliestPickupAt ? new Date(earliestPickupAt) : undefined,
        latestPickupAt: latestPickupAt ? new Date(latestPickupAt) : undefined,
      }
    });

    if (load) {
      await prisma.$executeRaw`
        UPDATE "Load" 
        SET "pickupLocation" = ST_SetSRID(ST_MakePoint(${pickupLng}, ${pickupLat}), 4326),
            "dropLocation" = ST_SetSRID(ST_MakePoint(${dropLng}, ${dropLat}), 4326)
        WHERE id = ${load.id}
      `;

      // Trigger recommendation matching for all active trips asynchronously
      prisma.trip.findMany({
        where: { status: { in: ['ONGOING', 'PLANNED'] } },
        select: { id: true }
      }).then(activeTrips => {
        for (const t of activeTrips) {
          generateRecommendationsForTrip(t.id).catch(err => console.error(err));
        }
      }).catch(err => console.error(err));
    }

    sendResponse(res, 201, 'Load created successfully', { load });
  } catch (error) {
    next(error);
  }
};

export const updateLoad = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const load = await prisma.load.findUnique({ where: { id } });
    if (!load) return next(new AppError('Load not found', 404));
    if (load.customerId !== req.user!.id && req.user!.role !== Role.ADMIN) {
      return next(new AppError('Not authorized', 403));
    }
    
    if (load.status !== LoadStatus.PENDING && load.status !== LoadStatus.SCHEDULED) {
      return next(new AppError('Cannot update load that is already assigned or in transit', 400));
    }

    if (updateData.pickupTime) updateData.pickupTime = new Date(updateData.pickupTime);
    if (updateData.dropTime) updateData.dropTime = new Date(updateData.dropTime);

    const updated = await prisma.load.update({
      where: { id },
      data: updateData,
    });
    
    sendResponse(res, 200, 'Load updated successfully', { load: updated });
  } catch (error) {
    next(error);
  }
};

export const getLoads = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const where: any = {};
    if (req.user!.role === Role.CUSTOMER) {
      where.customerId = req.user!.id;
    }
    const loads = await prisma.load.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        recommendations: true
      }
    });
    sendResponse(res, 200, 'Loads fetched successfully', { loads });
  } catch (error) {
    next(error);
  }
};

export const getLoadById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const load = await prisma.load.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true, email: true, profile: { select: { phone: true } } } },
        recommendations: {
          where: { status: { in: ['ACCEPTED', 'COMPLETED', 'PENDING'] } },
          include: {
            trip: {
              include: {
                driver: { select: { id: true, name: true, email: true, profile: { select: { phone: true } } } },
                vehicle: true,
              }
            }
          }
        },
        payments: {
          orderBy: { createdAt: 'asc' }
        }
      },
    });

    if (!load) return next(new AppError('Load not found', 404));
    if (req.user!.role === Role.CUSTOMER && load.customerId !== req.user!.id) {
      return next(new AppError('Not authorized', 403));
    }

    // Auto-heal OTPs if assigned/in-transit and OTPs were not generated yet
    if (load && (load.status === LoadStatus.ASSIGNED || load.status === LoadStatus.IN_TRANSIT || load.status === LoadStatus.DELIVERED)) {
      if (!load.pickupOtp || !load.deliveryOtp) {
        const pOtp = load.pickupOtp || Math.floor(100000 + Math.random() * 900000).toString();
        const dOtp = load.deliveryOtp || Math.floor(100000 + Math.random() * 900000).toString();
        await prisma.load.update({
          where: { id: load.id },
          data: { pickupOtp: pOtp, deliveryOtp: dOtp },
        });
        await prisma.recommendation.updateMany({
          where: { loadId: load.id, status: 'ACCEPTED' },
          data: { pickupOtp: pOtp, deliveryOtp: dOtp },
        });
        load.pickupOtp = pOtp;
        load.deliveryOtp = dOtp;
      }
    }

    sendResponse(res, 200, 'Load fetched successfully', { load });
  } catch (error) {
    next(error);
  }
};

export const getActiveLoads = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const loads = await prisma.load.findMany({
      where: {
        status: { in: [LoadStatus.PENDING, LoadStatus.SCHEDULED] },
      },
      include: { customer: { select: { name: true } } }
    });
    sendResponse(res, 200, 'Active loads fetched successfully', { loads });
  } catch (error) {
    next(error);
  }
};

export const cancelLoad = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const load = await prisma.load.findUnique({ where: { id } });
    if (!load) return next(new AppError('Load not found', 404));
    if (load.customerId !== req.user!.id && req.user!.role !== Role.ADMIN) {
      return next(new AppError('Not authorized', 403));
    }
    const updated = await prisma.load.update({
      where: { id },
      data: { status: LoadStatus.CANCELLED }
    });
    sendResponse(res, 200, 'Load cancelled successfully', { load: updated });
  } catch (error) {
    next(error);
  }
};

export const getPendingNegotiations = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const customerId = req.user!.id;
    const negotiations = await prisma.recommendation.findMany({
      where: {
        status: { in: [RecommendationStatus.PENDING, RecommendationStatus.NEGOTIATING] },
        load: {
          customerId,
          status: { in: [LoadStatus.PENDING, LoadStatus.SCHEDULED] }, // exclude confirmed / assigned / in transit / delivered / completed
        },
      },
      include: {
        load: { select: { id: true, goodsCategory: true, pickupName: true, dropName: true, budget: true, weight: true, status: true, customerId: true } },
        trip: {
          include: {
            driver: {
              select: {
                id: true,
                name: true,
                profile: { select: { trustScore: true, avatarUrl: true, experience: true } }
              }
            },
            vehicle: { select: { registrationNo: true, type: true } }
          }
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
    sendResponse(res, 200, 'Pending negotiations & matches fetched', { negotiations });
  } catch (error) {
    next(error);
  }
};

export const getLoadHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const where: any = { status: { in: [LoadStatus.DELIVERED, LoadStatus.CANCELLED] } };
    if (req.user!.role === Role.CUSTOMER) {
      where.customerId = req.user!.id;
    }
    const loads = await prisma.load.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    sendResponse(res, 200, 'Load history fetched successfully', { loads });
  } catch (error) {
    next(error);
  }
};
