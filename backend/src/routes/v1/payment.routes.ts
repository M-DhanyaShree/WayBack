import { Router } from 'express';
import {
   createPayment,
   verifyPayment,
   refundPayment,
   getTransactionHistory,
   getLoadPaymentSummary,
   getDriverEarnings,
   withdrawEarnings
 } from '../../controllers/payment.controller';
import { authenticate } from '../../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/', createPayment);
router.post('/verify', verifyPayment);
router.post('/refund', refundPayment);
router.get('/history', getTransactionHistory);
router.get('/load/:loadId/summary', getLoadPaymentSummary);
router.get('/driver/earnings', getDriverEarnings);
router.post('/driver/withdraw', withdrawEarnings);

export default router;
