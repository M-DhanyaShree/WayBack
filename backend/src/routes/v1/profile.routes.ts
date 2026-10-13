import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { getProfile, updateProfile, submitVerification, updateDriverPreference } from '../../controllers/profile.controller';

const router = Router();

router.use(authenticate);

router.get('/', getProfile);
router.put('/', updateProfile);
router.put('/preferences', updateDriverPreference);
router.post('/verification', submitVerification);

export default router;
