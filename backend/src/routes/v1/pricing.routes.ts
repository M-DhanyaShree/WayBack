import { Router } from 'express';
import { estimatePricing } from '../../controllers/pricing.controller';

const router = Router();

router.post('/estimate', estimatePricing);
router.get('/estimate', estimatePricing);

export default router;
