import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let error = err;

  if (!(error instanceof AppError)) {
    const statusCode = 500;
    const message = error.message || 'Internal Server Error';
    error = new AppError(message, statusCode, false);
  }

  const appError = error as AppError;

  if (env.NODE_ENV !== 'test') {
    logger.error(`${appError.statusCode} - ${appError.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
  }

  res.status(appError.statusCode).json({
    success: false,
    message: appError.message,
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
