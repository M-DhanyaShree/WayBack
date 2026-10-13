import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { getVehicles, getVehicleById, createVehicle, updateVehicle } from '../../controllers/vehicle.controller';

const router = Router();

router.use(authenticate);

router.get('/', getVehicles);
router.get('/:id', getVehicleById);
router.post('/', createVehicle);
router.put('/:id', updateVehicle);

export default router;
