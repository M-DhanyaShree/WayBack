import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { sendResponse } from '../utils/response';
import { AppError } from '../utils/AppError';
import { prisma } from '../server';

export const getMessages = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { tripId } = req.params;
    const userId = req.user!.id;

    const messages = await prisma.message.findMany({
      where: {
        tripId,
        OR: [
          { senderId: userId },
          { receiverId: userId },
        ],
      },
      include: {
        sender: { select: { id: true, name: true, role: true } },
        receiver: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    sendResponse(res, 200, 'Messages fetched', { messages });
  } catch (error) {
    next(error);
  }
};

export const getConversations = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const messages = await prisma.message.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      include: {
        sender: { select: { id: true, name: true, role: true } },
        receiver: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const conversationsMap = new Map<string, any>();
    for (const msg of messages) {
      const isSender = msg.senderId === userId;
      const partner = isSender ? msg.receiver : msg.sender;
      if (!partner) continue;

      if (!conversationsMap.has(partner.id)) {
        conversationsMap.set(partner.id, {
          partnerId: partner.id,
          partnerName: partner.name,
          partnerRole: partner.role,
          tripId: msg.tripId,
          lastMessage: msg.content,
          lastMessageAt: msg.createdAt,
          unreadCount: (!isSender && !msg.isRead) ? 1 : 0,
        });
      } else if (!isSender && !msg.isRead) {
        conversationsMap.get(partner.id).unreadCount += 1;
      }
    }

    const conversations = Array.from(conversationsMap.values());
    sendResponse(res, 200, 'Conversations fetched', { conversations });
  } catch (error) {
    next(error);
  }
};

export const getMessagesByPartner = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { partnerId } = req.params;

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: partnerId },
          { senderId: partnerId, receiverId: userId },
        ],
      },
      include: {
        sender: { select: { id: true, name: true, role: true } },
        receiver: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Mark unread messages sent by partner to current user as read
    await prisma.message.updateMany({
      where: {
        senderId: partnerId,
        receiverId: userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    sendResponse(res, 200, 'Messages fetched', { messages });
  } catch (error) {
    next(error);
  }
};

export const sendMessage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const senderId = req.user!.id;
    const { receiverId, tripId, content } = req.body;

    if (!receiverId || !content) {
      return next(new AppError('receiverId and content are required', 400));
    }

    const message = await prisma.message.create({
      data: {
        senderId,
        receiverId,
        tripId: tripId || null,
        content,
      },
      include: {
        sender: { select: { id: true, name: true, role: true } },
        receiver: { select: { id: true, name: true, role: true } },
      },
    });

    // Create a real-time Notification for the receiver with CHAT type and partner link
    await prisma.notification.create({
      data: {
        userId: receiverId,
        title: `Message from ${req.user!.name}`,
        message: content.length > 80 ? content.slice(0, 80) + '...' : content,
        type: 'CHAT',
        link: `/chat/${senderId}`,
      },
    });

    sendResponse(res, 201, 'Message sent', { message });
  } catch (error) {
    next(error);
  }
};

export const getNotifications = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const unreadCount = await prisma.notification.count({
      where: { userId, isRead: false },
    });

    sendResponse(res, 200, 'Notifications fetched', { notifications, unreadCount });
  } catch (error) {
    next(error);
  }
};

export const markNotificationAsRead = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    if (!id || id === 'all') {
      await prisma.notification.updateMany({
        where: { userId },
        data: { isRead: true },
      });
      return sendResponse(res, 200, 'All notifications marked as read');
    }

    const notification = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    sendResponse(res, 200, 'Notification marked as read', { notification });
  } catch (error) {
    next(error);
  }
};


export const getTickets = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tickets = await prisma.supportTicket.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
    });
    sendResponse(res, 200, 'Tickets fetched', { tickets });
  } catch (error) {
    next(error);
  }
};

export const createTicket = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { subject, description } = req.body;
    const ticket = await prisma.supportTicket.create({
      data: {
        userId: req.user!.id,
        subject,
        description,
      },
    });
    sendResponse(res, 201, 'Ticket created', { ticket });
  } catch (error) {
    next(error);
  }
};
