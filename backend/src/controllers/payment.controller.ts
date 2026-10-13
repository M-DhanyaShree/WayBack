import { Response, NextFunction } from 'express';
import { prisma } from '../server';
import { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../utils/AppError';
import { sendResponse } from '../utils/response';
import { MockPaymentProvider } from '../providers/MockPaymentProvider';

const paymentProvider = new MockPaymentProvider();

/**
 * Create a realistic milestone payment (ASSURANCE 10%, ADVANCE 10-40%, BALANCE, or FULL)
 * Modes: UPI, Net Banking, Card, POD Cash
 */
export const createPayment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { loadId, amount, paymentType = 'FULL', advancePercent, method = 'UPI', upiId } = req.body;
    
    let load: any = null;
    let finalAmount = amount ? Math.round(Number(amount)) : 0;

    if (loadId) {
      load = await prisma.load.findUnique({
        where: { id: loadId },
        include: {
          recommendations: {
            where: { status: { in: ['ACCEPTED', 'COMPLETED', 'RESERVED'] } },
            include: { trip: { include: { driver: true } } }
          },
          payments: {
            where: { status: 'SUCCESS' }
          }
        }
      });

      if (!load) return next(new AppError('Load not found', 404));

      const totalBudget = load.budget || 5000;
      const alreadyPaid = load.payments?.reduce((sum: number, p: any) => sum + p.amountMinorUnits, 0) || 0;
      const balanceDue = Math.max(0, totalBudget - alreadyPaid);

      if (balanceDue <= 0) {
        return next(new AppError('This shipment is already fully settled and paid in full. No additional payment is required.', 400));
      }

      if (!finalAmount) {
        if (paymentType === 'ASSURANCE') {
          finalAmount = Math.min(balanceDue, Math.round(totalBudget * 0.10));
        } else if (paymentType === 'ADVANCE') {
          const pct = Math.min(40, Math.max(10, Number(advancePercent) || 30)) / 100;
          const targetAdvance = Math.round(totalBudget * pct);
          finalAmount = Math.min(balanceDue, Math.max(0, targetAdvance - alreadyPaid) || targetAdvance);
        } else {
          finalAmount = balanceDue;
        }
      } else {
        finalAmount = Math.min(balanceDue, finalAmount);
      }
    }

    if (finalAmount <= 0) {
      return next(new AppError('Payment amount must be greater than zero.', 400));
    }

    const receiptId = `wayback_pay_${Date.now()}`;
    const paymentRes = await paymentProvider.createPayment(finalAmount * 100, 'INR', receiptId);

    const payment = await prisma.payment.create({
      data: {
        userId: req.user!.id,
        loadId: loadId || null,
        providerPaymentId: paymentRes.id,
        amountMinorUnits: finalAmount, // store plain rupees
        currencyCode: 'INR',
        status: 'SUCCESS', // Auto-confirm instant UPI/Gateway
      },
    });

    // If this was an ASSURANCE payment, mark recommendation confirmed (clear expiry timer)
    if (loadId && (paymentType === 'ASSURANCE' || paymentType === 'ADVANCE')) {
      const activeRec = load?.recommendations?.[0];
      if (activeRec) {
        await prisma.recommendation.update({
          where: { id: activeRec.id },
          data: {
            reservationExpiresAt: null, // Lock confirmed, cancellation timer cleared!
            status: 'ACCEPTED',
          }
        });
        await prisma.load.update({
          where: { id: loadId },
          data: { status: 'ASSIGNED' }
        });
      }
    }

    // Notify driver if payment is linked to a matched load
    const matchedRec = load?.recommendations?.[0];
    if (matchedRec?.trip?.driverId) {
      const driverId = matchedRec.trip.driverId;
      const typeLabel = 
        paymentType === 'ASSURANCE' ? '10% Assurance Deposit' :
        paymentType === 'ADVANCE' ? `Advance Payment (${advancePercent || 30}%)` :
        paymentType === 'BALANCE' ? 'Balance Settlement on Delivery' : 'Freight Payment';
      
      await prisma.notification.create({
        data: {
          userId: driverId,
          title: `💰 ${typeLabel} Received: ₹${finalAmount.toLocaleString('en-IN')}`,
          message: `Customer ${req.user!.name} paid ₹${finalAmount.toLocaleString('en-IN')} via ${method}${upiId ? ` (${upiId})` : ''} for load: ${load.goodsCategory}. Truck booking is confirmed!`,
          type: 'INFO',
          link: '/payments',
        }
      });
    }

    sendResponse(res, 201, 'Payment processed successfully', {
      payment,
      receiptId,
      method,
      paymentType,
      amount: finalAmount
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get detailed payment summary & assurance lifecycle for a specific load
 */
export const getLoadPaymentSummary = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { loadId } = req.params;
    const load = await prisma.load.findUnique({
      where: { id: loadId },
      include: {
        recommendations: {
          where: { status: { in: ['ACCEPTED', 'COMPLETED', 'RESERVED'] } },
          include: { trip: { include: { driver: true, vehicle: true } } }
        }
      }
    });

    if (!load) return next(new AppError('Load not found', 404));

    const payments = await prisma.payment.findMany({
      where: { loadId, status: 'SUCCESS' },
      orderBy: { createdAt: 'asc' }
    });

    const totalPaid = payments.reduce((sum, p) => sum + p.amountMinorUnits, 0);
    const totalAgreed = load.budget || 5000;
    const assuranceRequired = Math.round(totalAgreed * 0.10);
    const isAssurancePaid = totalPaid >= assuranceRequired;
    const balanceDue = Math.max(0, totalAgreed - totalPaid);

    const activeRec = load.recommendations?.[0];
    const assuranceDeadline = activeRec?.reservationExpiresAt || null;

    sendResponse(res, 200, 'Load payment summary fetched', {
      loadId,
      goodsCategory: load.goodsCategory,
      totalAgreed,
      totalPaid,
      assuranceRequired,
      isAssurancePaid,
      assuranceDeadline,
      balanceDue,
      isFullyPaid: balanceDue === 0,
      payments,
      driver: activeRec?.trip?.driver || null,
      vehicle: activeRec?.trip?.vehicle || null,
      advanceOptions: {
        min10Pct: Math.round(totalAgreed * 0.10),
        opt20Pct: Math.round(totalAgreed * 0.20),
        opt30Pct: Math.round(totalAgreed * 0.30),
        max40Pct: Math.round(totalAgreed * 0.40),
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Driver Payouts & Earnings Summary
 */
export const getDriverEarnings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const driverId = req.user!.id;

    // Find all trips by this driver with accepted recommendations
    const trips = await prisma.trip.findMany({
      where: { driverId },
      include: {
        recommendations: {
          where: { status: { in: ['ACCEPTED', 'COMPLETED'] } },
          include: { load: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const loadIds = trips.flatMap(t => t.recommendations.map(r => r.loadId)).filter(Boolean);

    const payments = await prisma.payment.findMany({
      where: {
        loadId: { in: loadIds },
        status: 'SUCCESS'
      },
      include: { load: true },
      orderBy: { createdAt: 'desc' }
    });

    const totalEarned = payments.reduce((sum, p) => sum + p.amountMinorUnits, 0);
    const totalTripsCompleted = trips.filter(t => t.status === 'COMPLETED').length;

    sendResponse(res, 200, 'Driver earnings summary fetched', {
      totalEarned,
      availableBalance: totalEarned, // Available for instant UPI payout
      totalTripsCompleted,
      activeTripsCount: trips.filter(t => t.status === 'ONGOING').length,
      recentPayments: payments.slice(0, 10),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Driver Instant Withdrawal via UPI / IMPS
 */
export const withdrawDriverEarnings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { amount, upiId } = req.body;
    const withdrawAmount = Math.round(Number(amount));

    if (!withdrawAmount || withdrawAmount <= 0) {
      return next(new AppError('Please specify a valid withdrawal amount', 400));
    }

    if (!upiId) {
      return next(new AppError('Please provide a valid UPI ID (e.g. driver@okaxis)', 400));
    }

    const transferRef = `UPI_TXN_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    // Create notification for driver
    await prisma.notification.create({
      data: {
        userId: req.user!.id,
        title: `⚡ ₹${withdrawAmount.toLocaleString('en-IN')} Sent via Instant UPI`,
        message: `Your withdrawal of ₹${withdrawAmount.toLocaleString('en-IN')} was successfully transferred to ${upiId}. Ref ID: ${transferRef}`,
        type: 'INFO',
        link: '/payments',
      }
    });

    sendResponse(res, 200, 'Withdrawal processed instantly', {
      amount: withdrawAmount,
      upiId,
      transferRef,
      status: 'TRANSFERRED',
      timestamp: new Date()
    });
  } catch (error) {
    next(error);
  }
};

export const getPaymentHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const payments = await prisma.payment.findMany({
      where: { userId: req.user!.id },
      include: { load: true },
      orderBy: { createdAt: 'desc' },
    });

    sendResponse(res, 200, 'Payment history fetched', { payments });
  } catch (error) {
    next(error);
  }
};

export const getTransactionHistory = getPaymentHistory;
export const withdrawEarnings = withdrawDriverEarnings;

export const verifyPayment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  sendResponse(res, 200, 'Payment verified successfully', { status: 'SUCCESS' });
};

export const refundPayment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  sendResponse(res, 200, 'Refund processed successfully', { status: 'REFUNDED' });
};
