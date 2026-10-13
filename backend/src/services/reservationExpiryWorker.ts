import { prisma } from '../server';
import { logger } from '../utils/logger';
import { LoadStatus, RecommendationStatus } from '@prisma/client';
import { generateRecommendationsForTrip } from './recommendation.service';

export const processReservationExpiries = async (): Promise<{ expiredReservations: number; expiredLoads: number }> => {
  try {
    const now = new Date();

    // 1. Process expired recommendations where reservationExpiresAt < NOW() and 10% assurance was NOT paid
    const expiredRecs = await prisma.recommendation.findMany({
      where: {
        status: { in: [RecommendationStatus.RESERVED, RecommendationStatus.ACCEPTED] },
        reservationExpiresAt: { lte: now }
      },
      include: {
        load: {
          include: {
            payments: {
              where: { status: 'SUCCESS' }
            }
          }
        },
        trip: {
          include: { driver: true }
        }
      }
    });

    let expiredReservations = 0;
    for (const rec of expiredRecs) {
      const loadBudget = rec.load.budget || 5000;
      const assuranceRequired = Math.round(loadBudget * 0.10);
      const totalPaid = rec.load.payments.reduce((sum, p) => sum + p.amountMinorUnits, 0);

      // If customer failed to pay 10% assurance deposit before deadline
      if (totalPaid < assuranceRequired) {
        // Cancel recommendation
        await prisma.recommendation.update({
          where: { id: rec.id },
          data: { status: RecommendationStatus.EXPIRED }
        });

        // Release load back to PENDING
        await prisma.load.update({
          where: { id: rec.loadId },
          data: { status: LoadStatus.PENDING }
        });

        // Notify customer that their reservation expired due to unpaid assurance deposit
        await prisma.notification.create({
          data: {
            userId: rec.load.customerId,
            title: '⚠️ Load Reservation Cancelled',
            message: `Your booking for "${rec.load.goodsCategory}" was cancelled because the 10% Assurance Deposit was not paid before the deadline.`,
            type: 'WARNING',
            link: '/loads',
          }
        });

        // Notify driver and automatically trigger new recommendations for the driver's trip
        if (rec.trip?.driverId) {
          await prisma.notification.create({
            data: {
              userId: rec.trip.driverId,
              title: '🔄 Finding Next Best Return Load',
              message: `The previous customer did not complete the 10% assurance payment in time. The system is automatically matching you with the next best available return load.`,
              type: 'INFO',
              link: `/trips/${rec.tripId}/recommendations`,
            }
          });

          // Auto re-match!
          generateRecommendationsForTrip(rec.tripId).catch(err => {
            logger.error(`Error auto-rematching for trip ${rec.tripId}: ${err.message}`);
          });
        }

        expiredReservations++;
      }
    }

    if (expiredReservations > 0) {
      logger.info(`ReservationExpiryWorker: Auto-cancelled ${expiredReservations} unpaid reservations and triggered auto-rematches`);
    }

    // 2. Process expired loads where latestPickupAt < NOW() and status is still PENDING or SCHEDULED
    const expiredLoadsResult = await prisma.load.updateMany({
      where: {
        status: { in: [LoadStatus.PENDING, LoadStatus.SCHEDULED] },
        latestPickupAt: { lte: now }
      },
      data: { status: LoadStatus.EXPIRED }
    });

    const expiredLoads = expiredLoadsResult.count;
    if (expiredLoads > 0) {
      logger.info(`ReservationExpiryWorker: Marked ${expiredLoads} loads as EXPIRED`);
    }

    return { expiredReservations, expiredLoads };
  } catch (error: any) {
    logger.error(`ReservationExpiryWorker error: ${error.message}`);
    return { expiredReservations: 0, expiredLoads: 0 };
  }
};

export const startReservationExpiryCron = (intervalMs = 30000): NodeJS.Timeout => {
  logger.info(`ReservationExpiryWorker background job started (interval: ${intervalMs}ms)`);
  processReservationExpiries();
  return setInterval(processReservationExpiries, intervalMs);
};
