import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { sendResponse } from '../utils/response';
import { prisma } from '../server';

export const getProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const profile = await prisma.profile.findUnique({ where: { userId: req.user!.id } });
    const user = await prisma.user.findUnique({ 
      where: { id: req.user!.id },
      include: { driverPreference: true }
    });
    sendResponse(res, 200, 'Profile fetched', { profile, driverPreference: user?.driverPreference });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      phone, address, city, state, zipCode, avatarUrl, bio, licenseNo, experience, companyName, gstNo,
      idProofUrl, addressProofUrl, licenseUrl, verificationStatus, trustScore
    } = req.body;

    const data: Record<string, any> = {
      phone, address, city, state, zipCode, avatarUrl, bio, licenseNo, experience, companyName, gstNo,
      idProofUrl, addressProofUrl, licenseUrl, verificationStatus, trustScore
    };
    Object.keys(data).forEach(key => data[key] === undefined && delete data[key]);

    const profile = await prisma.profile.upsert({
      where: { userId: req.user!.id },
      update: data,
      create: { ...data, userId: req.user!.id }
    });
    sendResponse(res, 200, 'Profile updated', { profile });
  } catch (error) {
    next(error);
  }
};

export const submitVerification = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    sendResponse(res, 200, 'Verification submitted', {});
  } catch (error) {
    next(error);
  }
};

export const updateDriverPreference = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      status, flexibilityLevel, preferredCategories, rejectedCategories, preferredRegions, avoidRegions,
      minExpectedEarnings, preferredDistanceMin, preferredDistanceMax, preferredUtilization
    } = req.body;

    const data: Record<string, any> = {
      status, flexibilityLevel, preferredCategories, rejectedCategories, preferredRegions, avoidRegions,
      minExpectedEarnings, preferredDistanceMin, preferredDistanceMax, preferredUtilization
    };
    Object.keys(data).forEach(key => data[key] === undefined && delete data[key]);

    const pref = await prisma.driverPreference.upsert({
      where: { driverId: req.user!.id },
      update: data,
      create: { ...data, driverId: req.user!.id }
    });
    sendResponse(res, 200, 'Preferences updated', { driverPreference: pref });
  } catch (error) {
    next(error);
  }
};
