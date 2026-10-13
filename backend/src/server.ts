import { createServer } from 'http';
import { Server } from 'socket.io';
import app from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import { PrismaClient } from '@prisma/client';
import trackingSocketHandler from './sockets/tracking';
import { loadModels } from './services/mlModel.service';

import { startReservationExpiryCron } from './services/reservationExpiryWorker';

export const prisma = new PrismaClient();
const server = createServer(app);

export const io = new Server(server, {
  cors: {
    origin: env.CLIENT_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id}`);
  trackingSocketHandler(io, socket);
  socket.on('disconnect', () => {
    logger.info(`Socket disconnected: ${socket.id}`);
  });
});

async function startServer() {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully');

    await loadModels();
    startReservationExpiryCron();

    server.listen(env.PORT, () => {
      logger.info(`Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}
