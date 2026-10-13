import { Router } from 'express';
import { 
  generate, 
  getTripRecommendations, 
  respondToRecommendation, 
  getAnalytics, 
  respondToNegotiation, 
  customerCounterOffer,
  customerApproveRecommendation 
} from '../../controllers/recommendation.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/role.middleware';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

router.post('/generate', authorize(Role.DRIVER, Role.ADMIN), generate);
router.get('/trip/:tripId', authorize(Role.DRIVER, Role.ADMIN), getTripRecommendations);
router.post('/:id/respond', authorize(Role.DRIVER), respondToRecommendation);
router.post('/:id/negotiate/respond', authorize(Role.CUSTOMER), respondToNegotiation);
router.post('/:id/counter-offer', authorize(Role.CUSTOMER), customerCounterOffer);
router.post('/:id/customer-approve', authorize(Role.CUSTOMER), customerApproveRecommendation);
router.get('/analytics', authorize(Role.ADMIN), getAnalytics);

export default router;
