import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { startTrip, getActiveTrip, getTripById, getTripHistory, endTrip, completeTrip, cancelTrip, confirmDeliveryByDriver, arriveAtDestination, startReturnLoad, uploadPodPhoto } from '../../controllers/trip.controller';
import { getTripRecommendations, respondToRecommendation } from '../../controllers/recommendation.controller';
import { upload } from '../../middlewares/upload.middleware';

const router = Router();

router.use(authenticate);

router.get('/active', getActiveTrip);
router.get('/history', getTripHistory);
router.get('/:id', getTripById);
router.post('/start', startTrip);
router.post('/:id/end', endTrip);
router.put('/:id/status', endTrip);
router.post('/:id/complete', completeTrip);
router.post('/:id/cancel', cancelTrip);
router.post('/:id/arrive', arriveAtDestination);
router.post('/:id/start-return-load', startReturnLoad);
router.post('/:id/confirm-driver', confirmDeliveryByDriver);
router.post('/:id/pod-upload', upload.single('image'), uploadPodPhoto);
router.post('/:id/verify', confirmDeliveryByDriver);

router.get('/:id/recommendations', getTripRecommendations);
router.post('/recommendation/:id/action', respondToRecommendation);

export default router;
