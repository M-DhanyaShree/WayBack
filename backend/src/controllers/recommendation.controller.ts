import { Response, NextFunction } from 'express';
import { prisma } from '../server';
import { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../utils/AppError';
import { sendResponse } from '../utils/response';
import { generateRecommendationsForTrip } from '../services/recommendation.service';
import { RecommendationStatus, LoadStatus } from '@prisma/client';

export const generate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { tripId } = req.body;
    await generateRecommendationsForTrip(tripId);
    sendResponse(res, 200, 'Recommendations generated successfully');
  } catch (error) {
    next(error);
  }
};

export const getTripRecommendations = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { tripId } = req.params;
    
    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip || trip.driverId !== req.user!.id) {
      return next(new AppError('Unauthorized or trip not found', 403));
    }

    // Auto-generate fresh spatial & ML recommendations for the trip
    await generateRecommendationsForTrip(tripId);

    const rawRecs = await prisma.recommendation.findMany({
      where: { tripId, status: { in: [RecommendationStatus.PENDING, RecommendationStatus.RESERVED] } },
      include: { load: true },
      orderBy: { score: 'desc' },
    });

    const recommendations = rawRecs.map((rec) => {
      const reasonObj: any = rec.recommendationReason || {};
      return {
        ...rec,
        isMLFallback: reasonObj.isMLFallback ?? (reasonObj.type === 'HEURISTIC'),
        rawAcceptanceProb: reasonObj.rawAcceptanceProb ?? null,
        rawDeliveryProb: reasonObj.rawDeliveryProb ?? null,
        featureVector: reasonObj.featureVector ?? null,
      };
    });

    sendResponse(res, 200, 'Recommendations fetched', { recommendations });
  } catch (error) {
    next(error);
  }
};

export const respondToRecommendation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'accept', 'reserve', or 'reject'

    const recommendation = await prisma.recommendation.findUnique({
      where: { id },
      include: { trip: { include: { vehicle: true, driver: true } }, load: true },
    });

    if (!recommendation) return next(new AppError('Recommendation not found', 404));
    if (recommendation.trip.driverId !== req.user!.id) return next(new AppError('Unauthorized', 403));

    if (action === 'accept') {
      const negotiation = req.body.negotiation;
      
      if (negotiation && (negotiation.minPrice || negotiation.concession || negotiation.terms)) {
        await prisma.recommendation.update({
          where: { id },
          data: { 
            status: RecommendationStatus.NEGOTIATING,
            proposedPrice: negotiation.minPrice ? parseInt(negotiation.minPrice) : null,
            concession: negotiation.concession ? parseInt(negotiation.concession) : null,
            terms: negotiation.terms || null
          },
        });

        // Notify the customer that the driver has proposed negotiation terms
        const driverName = recommendation.trip.driver?.name ?? 'A driver';
        const priceText = negotiation.minPrice ? ` at ₹${negotiation.minPrice}` : '';
        await prisma.notification.create({
          data: {
            userId: recommendation.load.customerId,
            title: '🤝 Negotiation Proposal Received',
            message: `${driverName} has proposed terms for your load "${recommendation.load.goodsCategory}"${priceText}. Review and respond in My Loads.`,
            type: 'INFO',
            link: `/loads`,
          },
        });

        sendResponse(res, 200, 'Negotiation proposed');
      } else {
        const curWeight = recommendation.trip.availableWeight ?? recommendation.trip.vehicle.capacityWeight;
        const curVolume = recommendation.trip.availableVolume ?? recommendation.trip.vehicle.capacityVolume;

        const newAvailableWeight = Math.max(0, curWeight - recommendation.load.weight);
        const newAvailableVolume = Math.max(0, curVolume - (recommendation.load.volumeCbf || 0));

        const pickupOtp = Math.floor(100000 + Math.random() * 900000).toString();
        const deliveryOtp = Math.floor(100000 + Math.random() * 900000).toString();

        await prisma.$transaction([
          prisma.recommendation.update({
            where: { id },
            data: { 
              status: RecommendationStatus.ACCEPTED, 
              acceptedAt: new Date(),
              pickupOtp,
              deliveryOtp,
            },
          }),
          prisma.load.update({
            where: { id: recommendation.loadId },
            data: { 
              status: LoadStatus.ASSIGNED,
              pickupOtp,
              deliveryOtp,
            },
          }),
          prisma.trip.update({
            where: { id: recommendation.tripId },
            data: {
              availableWeight: newAvailableWeight,
              availableVolume: newAvailableVolume,
              pickupOtp,
              deliveryOtp,
            }
          }),
          // Cancel any other recommendations for this load to stop suggesting other drivers
          prisma.recommendation.updateMany({
            where: {
              loadId: recommendation.loadId,
              id: { not: id },
              status: { in: [RecommendationStatus.PENDING, RecommendationStatus.NEGOTIATING] }
            },
            data: {
              status: RecommendationStatus.CANCELLED
            }
          })
        ]);

        // Notify the customer that the load was accepted
        const driverName = recommendation.trip.driver?.name ?? 'A driver';
        await prisma.notification.create({
          data: {
            userId: recommendation.load.customerId,
            title: '✅ Load Accepted!',
            message: `${driverName} has accepted your load "${recommendation.load.goodsCategory}". It is now assigned.`,
            type: 'INFO',
            link: `/loads/${recommendation.loadId}`,
          },
        });

        sendResponse(res, 200, 'Recommendation accepted');
      }
    } else if (action === 'reserve') {
      const expiresAt = new Date(Date.now() + 48 * 3600 * 1000);
      await prisma.$transaction([
        prisma.recommendation.update({
          where: { id },
          data: { status: RecommendationStatus.RESERVED, reservationExpiresAt: expiresAt },
        }),
        prisma.load.update({
          where: { id: recommendation.loadId },
          data: { status: LoadStatus.RESERVED },
        })
      ]);
      sendResponse(res, 200, 'Load reserved successfully', { reservationExpiresAt: expiresAt });
    } else if (action === 'reject') {
      await prisma.recommendation.update({
        where: { id },
        data: { status: RecommendationStatus.REJECTED, rejectedAt: new Date() },
      });
      sendResponse(res, 200, 'Recommendation rejected');
    } else {
      return next(new AppError('Invalid action', 400));
    }
  } catch (error) {
    next(error);
  }
};


export const respondToNegotiation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'approve' or 'reject'

    const recommendation = await prisma.recommendation.findUnique({
      where: { id },
      include: { load: { include: { customer: true } }, trip: { include: { vehicle: true, driver: true } } },
    });

    if (!recommendation) return next(new AppError('Recommendation not found', 404));
    if (recommendation.load.customerId !== req.user!.id) {
      return next(new AppError('Unauthorized: You can only manage proposals for orders that you created.', 403));
    }
    if (action === 'reject' && (recommendation.status === RecommendationStatus.ACCEPTED || recommendation.terms === 'CUSTOMER_PRE_APPROVED')) {
      return next(new AppError('Cannot reject an order that has already been accepted or pre-approved.', 400));
    }
    if (recommendation.status !== RecommendationStatus.NEGOTIATING) {
      return next(new AppError('Recommendation is not in negotiating state', 400));
    }

    const customerName = recommendation.load.customer?.name ?? 'Customer';

    if (action === 'approve') {
      const curWeight = recommendation.trip.availableWeight ?? recommendation.trip.vehicle.capacityWeight;
      const curVolume = recommendation.trip.availableVolume ?? recommendation.trip.vehicle.capacityVolume;

      const newAvailableWeight = Math.max(0, curWeight - recommendation.load.weight);
      const newAvailableVolume = Math.max(0, curVolume - (recommendation.load.volumeCbf || 0));

      const pickupOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const deliveryOtp = Math.floor(100000 + Math.random() * 900000).toString();

      await prisma.$transaction([
        prisma.recommendation.update({
          where: { id },
          data: { 
            status: RecommendationStatus.ACCEPTED, 
            acceptedAt: new Date(),
            pickupOtp,
            deliveryOtp,
          },
        }),
        prisma.load.update({
          where: { id: recommendation.loadId },
          data: { 
            status: LoadStatus.ASSIGNED,
            budget: recommendation.proposedPrice || recommendation.load.budget,
            pickupOtp,
            deliveryOtp,
          },
        }),
        prisma.trip.update({
          where: { id: recommendation.tripId },
          data: {
            availableWeight: newAvailableWeight,
            availableVolume: newAvailableVolume,
            pickupOtp,
            deliveryOtp,
          }
        }),
        // Cancel other recommendations for this load
        prisma.recommendation.updateMany({
          where: {
            loadId: recommendation.loadId,
            id: { not: id },
            status: { in: [RecommendationStatus.PENDING, RecommendationStatus.NEGOTIATING] }
          },
          data: {
            status: RecommendationStatus.CANCELLED
          }
        })
      ]);

      // Notify the driver that negotiation was approved
      await prisma.notification.create({
        data: {
          userId: recommendation.trip.driverId,
          title: '✅ Negotiation Approved!',
          message: `${customerName} has approved your terms for "${recommendation.load.goodsCategory}". Load is now assigned!`,
          type: 'INFO',
          link: `/trips`,
        },
      });

      sendResponse(res, 200, 'Negotiation approved and load assigned');
    } else if (action === 'reject') {
      await prisma.recommendation.update({
        where: { id },
        data: { status: RecommendationStatus.REJECTED, rejectedAt: new Date() },
      });

      // Notify the driver that negotiation was rejected
      await prisma.notification.create({
        data: {
          userId: recommendation.trip.driverId,
          title: '❌ Negotiation Rejected',
          message: `${customerName} has rejected your terms for "${recommendation.load.goodsCategory}".`,
          type: 'INFO',
          link: `/trips`,
        },
      });

      sendResponse(res, 200, 'Negotiation rejected');
    } else {
      return next(new AppError('Invalid action', 400));
    }
  } catch (error) {
    next(error);
  }
};

export const getAnalytics = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const totalCount = await prisma.recommendation.count();
    const acceptedCount = await prisma.recommendation.count({ where: { status: RecommendationStatus.ACCEPTED } });
    const rejectedCount = await prisma.recommendation.count({ where: { status: RecommendationStatus.REJECTED } });

    sendResponse(res, 200, 'Analytics fetched', {
      total: totalCount,
      accepted: acceptedCount,
      rejected: rejectedCount,
      acceptanceRate: totalCount > 0 ? (acceptedCount / totalCount) * 100 : 0
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Customer Counter-Offer (Auto-Bargain)
 * - Customer proposes their desired price
 * - System checks against driver's concession threshold (proposedPrice - concession)
 * - If counter >= floor → system auto-accepts on driver's behalf
 * - If counter < floor → system rejects and notifies driver for manual decision
 */
export const customerCounterOffer = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { counterPrice } = req.body;

    if (!counterPrice || isNaN(parseInt(counterPrice))) {
      return next(new AppError('counterPrice is required', 400));
    }

    const rec = await prisma.recommendation.findUnique({
      where: { id },
      include: {
        load: { include: { customer: true } },
        trip: { include: { vehicle: true, driver: { select: { id: true, name: true } } } }
      }
    });

    if (!rec) return next(new AppError('Recommendation not found', 404));
    if (rec.load.customerId !== req.user!.id) return next(new AppError('Unauthorized', 403));
    if (rec.status !== RecommendationStatus.NEGOTIATING) {
      return next(new AppError('This recommendation is not in negotiation', 400));
    }
    if (!rec.proposedPrice) {
      return next(new AppError('Driver has not proposed a price yet', 400));
    }

    const customerOffer = parseInt(counterPrice);
    const driverAsk = rec.proposedPrice;
    // Floor = driver's ask minus their max concession (what driver is willing to go down to)
    const floor = rec.concession ? driverAsk - rec.concession : driverAsk;

    const customerName = rec.load.customer?.name ?? 'Customer';

    if (customerOffer >= floor) {
      // Auto-accept: customer's offer is within acceptable range
      const curWeight = rec.trip.availableWeight ?? rec.trip.vehicle.capacityWeight;
      const curVolume = rec.trip.availableVolume ?? rec.trip.vehicle.capacityVolume;

      await prisma.$transaction([
        prisma.recommendation.update({
          where: { id },
          data: { status: RecommendationStatus.ACCEPTED, acceptedAt: new Date(), proposedPrice: customerOffer }
        }),
        prisma.load.update({
          where: { id: rec.loadId },
          data: { status: LoadStatus.ASSIGNED, budget: customerOffer }
        }),
        prisma.trip.update({
          where: { id: rec.tripId },
          data: {
            availableWeight: Math.max(0, curWeight - rec.load.weight),
            availableVolume: Math.max(0, curVolume - (rec.load.volumeCbf || 0))
          }
        }),
        // Cancel other recommendations for this load
        prisma.recommendation.updateMany({
          where: {
            loadId: rec.loadId,
            id: { not: id },
            status: { in: [RecommendationStatus.PENDING, RecommendationStatus.NEGOTIATING] }
          },
          data: {
            status: RecommendationStatus.CANCELLED
          }
        })
      ]);

      // Notify driver of auto-accept
      await prisma.notification.create({
        data: {
          userId: rec.trip.driverId,
          title: '✅ Counter-Offer Auto-Accepted!',
          message: `${customerName} counter-offered ₹${customerOffer} for "${rec.load.goodsCategory}". System accepted on your behalf (within concession range). Load assigned!`,
          type: 'INFO',
          link: `/trips`,
        }
      });

      sendResponse(res, 200, 'Counter-offer accepted by system', {
        autoAccepted: true,
        agreedPrice: customerOffer,
        floor,
        driverAsk
      });
    } else {
      // Below floor — system rejects automatically, notifies driver to decide manually
      await prisma.recommendation.update({
        where: { id },
        data: { status: RecommendationStatus.REJECTED, rejectedAt: new Date() }
      });

      await prisma.notification.create({
        data: {
          userId: rec.trip.driverId,
          title: '❌ Counter-Offer Below Floor Price',
          message: `${customerName} offered ₹${customerOffer} for "${rec.load.goodsCategory}" but your floor is ₹${floor}. Offer rejected. You may re-negotiate.`,
          type: 'INFO',
          link: `/trips`,
        }
      });

      sendResponse(res, 200, 'Counter-offer rejected (below floor)', {
        autoAccepted: false,
        customerOffer,
        floor,
        driverAsk
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Customer pre-approves driver match before driver can confirm
 */
export const customerApproveRecommendation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const customerId = req.user!.id;

    const rec = await prisma.recommendation.findUnique({
      where: { id },
      include: {
        load: true,
        trip: { include: { driver: { select: { id: true, name: true } } } },
      },
    });

    if (!rec) return next(new AppError('Recommendation not found', 404));
    if (rec.load.customerId !== customerId) {
      return next(new AppError('Unauthorized: You can only approve proposals for orders that you created.', 403));
    }

    const updated = await prisma.recommendation.update({
      where: { id },
      data: {
        terms: 'CUSTOMER_PRE_APPROVED',
      },
    });

    const customerName = req.user!.name || 'Customer';
    await prisma.notification.create({
      data: {
        userId: rec.trip.driverId,
        title: '🎉 Load Pre-Approved by Customer!',
        message: `${customerName} reviewed and approved your truck for "${rec.load.goodsCategory}". Click to view and accept the return load!`,
        type: 'ACTION',
        link: '/trips',
      },
    });

    sendResponse(res, 200, 'Driver match approved by customer', { recommendation: updated });
  } catch (error) {
    next(error);
  }
};

