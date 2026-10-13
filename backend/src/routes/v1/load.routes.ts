import { Router } from 'express';
import { createLoad, updateLoad, cancelLoad, getActiveLoads, getLoadHistory, getLoadById, getLoads, getPendingNegotiations } from '../../controllers/load.controller';
import { authenticate } from '../../middlewares/auth.middleware';
import { authorize } from '../../middlewares/role.middleware';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

router.get('/', getLoads);
router.get('/active', getActiveLoads);
router.get('/history', getLoadHistory);
router.get('/negotiations/pending', authorize(Role.CUSTOMER), getPendingNegotiations);
router.get('/:id', getLoadById);

router.post('/', authorize(Role.CUSTOMER, Role.ADMIN), createLoad);
router.put('/:id', authorize(Role.CUSTOMER, Role.ADMIN), updateLoad);
router.post('/:id/cancel', authorize(Role.CUSTOMER, Role.ADMIN), cancelLoad);

export default router;

