import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { 
  getMessages, 
  sendMessage, 
  getConversations,
  getMessagesByPartner,
  getNotifications, 
  markNotificationAsRead, 
  createTicket, 
  getTickets 
} from '../../controllers/collaboration.controller';

const router = Router();

router.use(authenticate);

router.get('/conversations', getConversations);
router.get('/messages/partner/:partnerId', getMessagesByPartner);
router.get('/messages/trip/:tripId', getMessages);
router.post('/messages', sendMessage);
router.get('/notifications', getNotifications);
router.put('/notifications/all/read', markNotificationAsRead);
router.put('/notifications/:id/read', markNotificationAsRead);
router.get('/tickets', getTickets);
router.post('/tickets', createTicket);

export default router;
