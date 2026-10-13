import { Response, NextFunction } from 'express';
import { prisma } from '../server';
import { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../utils/AppError';
import { sendResponse } from '../utils/response';
import { VehicleType, Role } from '@prisma/client';

export const createVehicle = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const ownerId = req.user!.id;
    const { registrationNo, type, make, model, year, capacityWeight, capacityVolume, dimensions } = req.body;

    const existing = await prisma.vehicle.findUnique({ where: { registrationNo } });
    if (existing) {
      return next(new AppError('Vehicle with this registration number already exists', 400));
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        ownerId,
        registrationNo,
        type,
        make,
        model,
        year: parseInt(year, 10),
        capacityWeight: parseFloat(capacityWeight),
        capacityVolume: parseFloat(capacityVolume),
        dimensions,
      },
    });

    sendResponse(res, 201, 'Vehicle added successfully', { vehicle });
  } catch (error) {
    next(error);
  }
};

export const updateVehicle = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { type, make, model, year, capacityWeight, capacityVolume, dimensions, isActive } = req.body;

    const vehicle = await prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle) return next(new AppError('Vehicle not found', 404));

    if (vehicle.ownerId !== req.user!.id && req.user!.role !== Role.ADMIN) {
      return next(new AppError('Not authorized', 403));
    }

    const updated = await prisma.vehicle.update({
      where: { id },
      data: {
        ...(type && { type }),
        ...(make && { make }),
        ...(model && { model }),
        ...(year && { year: parseInt(year, 10) }),
        ...(capacityWeight && { capacityWeight: parseFloat(capacityWeight) }),
        ...(capacityVolume && { capacityVolume: parseFloat(capacityVolume) }),
        ...(dimensions !== undefined && { dimensions }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    sendResponse(res, 200, 'Vehicle updated successfully', { vehicle: updated });
  } catch (error) {
    next(error);
  }
};

export const getVehicles = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { type, make, minWeight, maxWeight, search } = req.query;
    
    let whereClause: any = {};

    if (req.user!.role !== Role.ADMIN) {
      whereClause.ownerId = req.user!.id;
    }

    if (type) whereClause.type = type;
    if (make) whereClause.make = { contains: make as string, mode: 'insensitive' };
    
    if (minWeight || maxWeight) {
      whereClause.capacityWeight = {};
      if (minWeight) whereClause.capacityWeight.gte = parseFloat(minWeight as string);
      if (maxWeight) whereClause.capacityWeight.lte = parseFloat(maxWeight as string);
    }

    if (search) {
      whereClause.OR = [
        { registrationNo: { contains: search as string, mode: 'insensitive' } },
        { make: { contains: search as string, mode: 'insensitive' } },
        { model: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const vehicles = await prisma.vehicle.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });

    sendResponse(res, 200, 'Vehicles fetched successfully', { vehicles });
  } catch (error) {
    next(error);
  }
};

export const getVehicleById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: req.params.id },
      include: { owner: { select: { name: true, email: true } } },
    });

    if (!vehicle) return next(new AppError('Vehicle not found', 404));

    if (vehicle.ownerId !== req.user!.id && req.user!.role !== Role.ADMIN) {
      return next(new AppError('Not authorized', 403));
    }

    sendResponse(res, 200, 'Vehicle fetched successfully', { vehicle });
  } catch (error) {
    next(error);
  }
};

export const deleteVehicle = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: req.params.id } });
    
    if (!vehicle) return next(new AppError('Vehicle not found', 404));
    
    if (vehicle.ownerId !== req.user!.id && req.user!.role !== Role.ADMIN) {
      return next(new AppError('Not authorized', 403));
    }

    await prisma.vehicle.delete({ where: { id: req.params.id } });

    sendResponse(res, 200, 'Vehicle deleted successfully');
  } catch (error) {
    next(error);
  }
};
