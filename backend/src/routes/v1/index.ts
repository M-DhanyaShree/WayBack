import { Router } from 'express';
import authRoutes from './auth.routes';
import profileRoutes from './profile.routes';
import vehicleRoutes from './vehicle.routes';
import loadRoutes from './load.routes';
import tripRoutes from './trip.routes';
import paymentRoutes from './payment.routes';
import analyticsRoutes from './analytics.routes';
import dashboardRoutes from './dashboard.routes';
import collaborationRoutes from './collaboration.routes';
import recommendationRoutes from './recommendation.routes';
import pricingRoutes from './pricing.routes';
import healthRoutes from './health.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/profile', profileRoutes);
router.use('/vehicles', vehicleRoutes);
router.use('/loads', loadRoutes);
router.use('/trips', tripRoutes);
router.use('/payments', paymentRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/collaboration', collaborationRoutes);
router.use('/recommendations', recommendationRoutes);
router.use('/pricing', pricingRoutes);

export default router;

