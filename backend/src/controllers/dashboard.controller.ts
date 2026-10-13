import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { sendResponse } from '../utils/response';
import { prisma } from '../server';
import { LoadStatus, TripStatus, Role } from '@prisma/client';

export const getContextData = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const hasCoords = !isNaN(lat) && !isNaN(lng);

    if (user.role === Role.DRIVER) {
      // Driver context: Nearby available active loads
      let loads: any[] = [];
      if (hasCoords) {
        loads = await prisma.$queryRaw`
          SELECT l.id, l."pickupName", l."pickupLat", l."pickupLng", l."dropName", l."dropLat", l."dropLng",
                 l.weight, l.budget, l."goodsCategory", l.status, l."createdAt",
                 u.name as "customerName"
          FROM "Load" l
          LEFT JOIN "User" u ON l."customerId" = u.id
          WHERE l.status IN ('PENDING', 'SCHEDULED')
          ORDER BY 
            CASE WHEN l."pickupLocation" IS NOT NULL THEN
              ST_Distance(l."pickupLocation", ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326))
            ELSE 9999999 END ASC,
            l."createdAt" DESC
          LIMIT 20;
        `;
        loads = loads.map((l: any) => ({
          ...l,
          customer: { name: l.customerName || 'Customer' }
        }));
      } else {
        loads = await prisma.load.findMany({
          where: { status: { in: [LoadStatus.PENDING, LoadStatus.SCHEDULED] } },
          include: { customer: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        });
      }
      return sendResponse(res, 200, 'Context fetched', { items: loads });
    } else if (user.role === Role.CUSTOMER) {
      // Customer context: Customer's own active loads + active trips
      const customerLoads = await prisma.load.findMany({
        where: {
          customerId: user.id,
          status: { in: [LoadStatus.PENDING, LoadStatus.SCHEDULED, LoadStatus.ASSIGNED, LoadStatus.IN_TRANSIT] }
        },
        include: { customer: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      const formattedLoads = customerLoads.map(l => ({
        ...l,
        itemType: 'LOAD',
      }));

      const activeTrips = await prisma.trip.findMany({
        where: { status: { in: [TripStatus.PLANNED, TripStatus.ONGOING] } },
        include: {
          driver: { select: { name: true } },
          vehicle: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      const formattedTrips = activeTrips.map(t => ({
        id: t.id,
        itemType: 'TRIP',
        destName: t.destName,
        destLat: t.destLat,
        destLng: t.destLng,
        vehicle: t.vehicle,
        driver: t.driver,
        status: t.status,
      }));

      return sendResponse(res, 200, 'Context fetched', { items: [...formattedLoads, ...formattedTrips] });
    } else {
      // Admin / default context
      const loads = await prisma.load.findMany({
        where: { status: { in: [LoadStatus.PENDING, LoadStatus.SCHEDULED] } },
        include: { customer: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      return sendResponse(res, 200, 'Context fetched', { items: loads });
    }
  } catch (error) {
    next(error);
  }
};

export const getAdminDashboardStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const totalUsers = await prisma.user.count();
    const totalTrips = await prisma.trip.count();
    const pendingVerifications = await prisma.profile.count({ where: { verificationStatus: 'PENDING' } });
    const openTickets = await prisma.load.count({ where: { status: LoadStatus.PENDING } });

    sendResponse(res, 200, 'Admin stats fetched', {
      totalUsers,
      totalTrips,
      pendingVerifications,
      openTickets
    });
  } catch (error) {
    next(error);
  }
};

