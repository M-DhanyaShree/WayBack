import { Request, Response } from 'express';
import { sendResponse } from '../utils/response';

export const healthCheck = (req: Request, res: Response) => {
  sendResponse(res, 200, 'System is healthy', {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
};
