import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { getContextData, getAdminDashboardStats } from '../../controllers/dashboard.controller';

const router = Router();

router.use(authenticate);

router.get('/context', getContextData);
router.get('/admin-stats', getAdminDashboardStats);

export default router;
