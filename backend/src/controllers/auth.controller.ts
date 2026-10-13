import { Request, Response, NextFunction } from 'express';
import { prisma } from '../server';
import { AppError } from '../utils/AppError';
import { hashPassword, verifyPassword } from '../utils/password';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { sendResponse } from '../utils/response';
import { Role } from '@prisma/client';

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, name, role } = req.body;

    if (!email || !password || !name || !role) {
      return next(new AppError('Please provide all required fields', 400));
    }

    if (!Object.values(Role).includes(role)) {
      return next(new AppError('Invalid role', 400));
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return next(new AppError('Email already in use', 400));
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role,
        profile: {
          create: {
            phone: req.body.phone || null,
            verificationStatus: 'VERIFIED',
            trustScore: 5.0,
          },
        },
        ...(role === Role.DRIVER ? {
          driverPreference: {
            create: {
              flexibilityLevel: 'BALANCED',
              preferredCategories: [],
              rejectedCategories: [],
            },
          },
        } : {}),
      },
      include: { profile: true },
    });

    const payload = { userId: user.id, role: user.role };
    const accessToken = generateAccessToken(payload);

    sendResponse(res, 201, 'User registered successfully', {
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      accessToken,
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(new AppError('Please provide email and password', 400));
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.password))) {
      return next(new AppError('Invalid credentials', 401));
    }

    const payload = { userId: user.id, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    await prisma.token.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    sendResponse(res, 200, 'Login successful', {
      accessToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (error) {
    next(error);
  }
};

export const refresh = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return next(new AppError('Not authorized', 401));
    }

    const tokenDoc = await prisma.token.findUnique({ where: { token: refreshToken } });
    if (!tokenDoc) {
      return next(new AppError('Not authorized', 401));
    }

    const decoded = verifyRefreshToken(refreshToken);

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) {
      return next(new AppError('Not authorized', 401));
    }

    const payload = { userId: user.id, role: user.role };
    const accessToken = generateAccessToken(payload);

    sendResponse(res, 200, 'Token refreshed', { accessToken });
  } catch (error) {
    next(new AppError('Not authorized', 401));
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (refreshToken) {
      await prisma.token.deleteMany({ where: { token: refreshToken } });
    }

    res.clearCookie('refreshToken');
    sendResponse(res, 200, 'Logged out successfully');
  } catch (error) {
    next(error);
  }
};
