import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { getAdminAnalytics, getCustomerAnalytics, getDriverAnalytics } from '../../controllers/analytics.controller';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

router.get('/admin', authorize(Role.ADMIN), getAdminAnalytics);
router.get('/customer', authorize(Role.CUSTOMER), getCustomerAnalytics);
router.get('/driver', authorize(Role.DRIVER), getDriverAnalytics);

export default router;
