import { Response, NextFunction } from 'express';
import { prisma } from '../server';
import { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../utils/AppError';
import { sendResponse } from '../utils/response';
import { getRouteGeometry } from '../utils/ors';
import { TripStatus, Role, LoadStatus, RecommendationStatus } from '@prisma/client';
import { uploadToCloudinary } from '../utils/cloudinary';
import { env } from '../config/env';
import fs from 'fs';
import path from 'path';

export const startTrip = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const driverId = req.user!.id;
    const { 
      vehicleId, sourceName, sourceLat, sourceLng, destName, destLat, destLng, returnToName, returnToLat, returnToLng,
      expectedArrivalAt, expectedReturnAt, returnIntent, returnWindowStart, returnWindowEnd, flexibilityOverride, availableWeight, availableVolume
    } = req.body;

    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) return next(new AppError('Vehicle not found', 404));

    const activeTrip = await prisma.trip.findFirst({
      where: { driverId, status: { in: [TripStatus.ONGOING, TripStatus.PLANNED] } },
    });

    if (activeTrip) {
      return next(new AppError('You already have an active or planned trip', 400));
    }

    const routeData = await getRouteGeometry([sourceLng, sourceLat], [destLng, destLat]);

    // Haversine fallback if ORS API key is missing or service unavailable
    const getHaversineDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371;
      const dLat = (lat2 - lat1) * (Math.PI / 180);
      const dLon = (lon2 - lon1) * (Math.PI / 180);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return Math.round(R * c * 1.25 * 10) / 10; // 1.25 highway curvature factor
    };

    const calculatedDistKm = routeData?.distanceKm || getHaversineDistanceKm(sourceLat, sourceLng, destLat, destLng);
    const calculatedDurationMins = routeData?.durationMins || Math.round((calculatedDistKm / 45) * 60);

    const trip = await prisma.trip.create({
      data: {
        driverId,
        vehicleId,
        sourceName,
        sourceLat,
        sourceLng,
        destName,
        destLat,
        destLng,
        returnToName,
        returnToLat,
        returnToLng,
        expectedArrivalAt: expectedArrivalAt ? new Date(expectedArrivalAt) : null,
        expectedReturnAt: expectedReturnAt ? new Date(expectedReturnAt) : null,
        returnIntent,
        returnWindowStart: returnWindowStart ? new Date(returnWindowStart) : null,
        returnWindowEnd: returnWindowEnd ? new Date(returnWindowEnd) : null,
        flexibilityOverride,
        availableWeight,
        availableVolume,
        status: TripStatus.ONGOING,
        startedAt: new Date(),
        routeGeometry: routeData?.geometry || null,
        distanceKm: calculatedDistKm,
        durationMins: calculatedDurationMins,
      },
    });

    // 2. Dual-Write PostGIS Geometry
    if (trip) {
      const geojsonString = routeData?.geometry ? JSON.stringify(routeData.geometry) : null;
      
      try {
        await prisma.$executeRaw`
          UPDATE "Trip" 
          SET "sourceLocation" = ST_SetSRID(ST_MakePoint(${sourceLng}, ${sourceLat}), 4326),
              "destLocation" = ST_SetSRID(ST_MakePoint(${destLng}, ${destLat}), 4326),
              "returnLocation" = ST_SetSRID(ST_MakePoint(${returnToLng || sourceLng}, ${returnToLat || sourceLat}), 4326)
          WHERE id = ${trip.id}
        `;

        if (geojsonString) {
          await prisma.$executeRaw`
            UPDATE "Trip"
            SET "routeLine" = ST_GeomFromGeoJSON(${geojsonString}),
                "returnCorridor" = ST_MakeLine(ST_SetSRID(ST_MakePoint(${destLng}, ${destLat}), 4326), ST_SetSRID(ST_MakePoint(${returnToLng || sourceLng}, ${returnToLat || sourceLat}), 4326))
            WHERE id = ${trip.id}
          `;
        } else {
          await prisma.$executeRaw`
            UPDATE "Trip"
            SET "routeLine" = ST_MakeLine(ST_SetSRID(ST_MakePoint(${sourceLng}, ${sourceLat}), 4326), ST_SetSRID(ST_MakePoint(${destLng}, ${destLat}), 4326)),
                "returnCorridor" = ST_MakeLine(ST_SetSRID(ST_MakePoint(${destLng}, ${destLat}), 4326), ST_SetSRID(ST_MakePoint(${returnToLng || sourceLng}, ${returnToLat || sourceLat}), 4326))
            WHERE id = ${trip.id}
          `;
        }
      } catch (sqlErr) {
        // Safe dual-write if PostGIS not yet enabled
      }
    }

    sendResponse(res, 201, 'Trip started successfully', { trip });
  } catch (error) {
    next(error);
  }
};

export const endTrip = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const trip = await prisma.trip.findUnique({ where: { id } });
    if (!trip) return next(new AppError('Trip not found', 404));
    
    if (trip.driverId !== req.user!.id && req.user!.role !== Role.ADMIN) {
      return next(new AppError('Not authorized', 403));
    }

    if (trip.status !== TripStatus.ONGOING && trip.status !== TripStatus.PLANNED) {
      return next(new AppError('Only ongoing or planned trips can be ended', 400));
    }

    const endedTrip = await prisma.trip.update({
      where: { id },
      data: {
        status: TripStatus.COMPLETED,
        endedAt: new Date(),
      },
    });

    // Update accepted loads on this trip to DELIVERED and notify customer to settle remaining balance
    const acceptedRecs = await prisma.recommendation.findMany({
      where: { tripId: id, status: 'ACCEPTED' },
      include: {
        load: {
          include: {
            payments: {
              where: { status: 'SUCCESS' },
              select: { amountMinorUnits: true }
            }
          }
        }
      }
    });

    for (const rec of acceptedRecs) {
      const totalPaid = rec.load.payments?.reduce((sum: number, p: any) => sum + p.amountMinorUnits, 0) || 0;
      const balanceDue = Math.max(0, (rec.load.budget || 0) - totalPaid);

      await prisma.load.update({
        where: { id: rec.loadId },
        data: { status: 'DELIVERED' }
      });

      // Notify customer to settle remaining balance
      await prisma.notification.create({
        data: {
          userId: rec.load.customerId,
          title: '💳 Trip Completed — Settle Remaining Balance',
          message: balanceDue > 0
            ? `Your shipment "${rec.load.goodsCategory}" is marked delivered. Please settle the remaining balance of ₹${balanceDue.toLocaleString('en-IN')}.`
            : `Your shipment "${rec.load.goodsCategory}" is marked delivered and fully paid. Thank you!`,
          type: 'INFO',
          link: '/payments',
        }
      });
    }

    sendResponse(res, 200, 'Trip ended successfully', { trip: endedTrip });
  } catch (error) {
    next(error);
  }
};

export const completeTrip = async (req: AuthRequest, res: Response, next: NextFunction) => {
  return endTrip(req, res, next);
};

// Driver marks arrival at destination — notifies all customers with loads on this trip
export const arriveAtDestination = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        recommendations: {
          where: { status: 'ACCEPTED' },
          include: { load: { select: { id: true, customerId: true, goodsCategory: true } } }
        },
        driver: { select: { name: true } }
      }
    });
    if (!trip) return next(new AppError('Trip not found', 404));
    if (trip.driverId !== req.user!.id) return next(new AppError('Unauthorized', 403));

    // Update trip to record driver arrival at destination
    await prisma.trip.update({
      where: { id },
      data: { driverDeliveryConfirmed: true }
    });

    const driverName = trip.driver?.name ?? 'Your driver';
    // Notify all customers whose loads are on this trip
    for (const rec of trip.recommendations) {
      await prisma.notification.create({
        data: {
          userId: rec.load.customerId,
          title: '📍 Driver Arrived at Destination',
          message: `${driverName} has arrived at the destination with your load "${rec.load.goodsCategory}". Please confirm delivery.`,
          type: 'INFO',
          link: `/loads/${rec.load.id}`,
        }
      });
    }

    sendResponse(res, 200, 'Arrival notified to customers');
  } catch (error) {
    next(error);
  }
};

// Driver starts carrying the return load — verifies 1st OTP (Pickup OTP) and marks load as IN_TRANSIT
export const startReturnLoad = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params; // trip id
    const { recommendationId, pickupOtp } = req.body;

    if (!pickupOtp || !pickupOtp.toString().trim()) {
      return next(new AppError('1st OTP (Pickup Verification OTP) is required. Ask customer/shipper for the 6-digit handover code.', 400));
    }

    const trip = await prisma.trip.findUnique({ where: { id } });
    if (!trip) return next(new AppError('Trip not found', 404));
    if (trip.driverId !== req.user!.id) return next(new AppError('Unauthorized', 403));

    const rec = await prisma.recommendation.findFirst({
      where: { id: recommendationId, tripId: id, status: 'ACCEPTED' },
      include: { load: { include: { customer: { select: { id: true, name: true } } } } }
    });
    if (!rec) return next(new AppError('Accepted recommendation not found', 404));

    // Verify 1st OTP matches
    const expectedOtp = rec.pickupOtp || rec.load.pickupOtp;
    if (expectedOtp && pickupOtp.toString().trim() !== expectedOtp.toString().trim()) {
      return next(new AppError('Invalid Pickup OTP. The entered code does not match the customer handover code.', 400));
    }

    // Mark load as IN_TRANSIT and mark OTP as verified
    await prisma.$transaction([
      prisma.load.update({
        where: { id: rec.loadId },
        data: { 
          status: LoadStatus.IN_TRANSIT,
          pickupOtpVerified: true,
        }
      }),
      prisma.recommendation.update({
        where: { id: rec.id },
        data: { pickupOtpVerified: true }
      }),
      prisma.trip.update({
        where: { id },
        data: { pickupOtpVerified: true }
      })
    ]);

    // Notify customer
    await prisma.notification.create({
      data: {
        userId: rec.load.customerId,
        title: '🚛 Return Load Picked Up & En Route',
        message: `Pickup OTP verified! Your load "${rec.load.goodsCategory}" is now in transit. Driver has started the return journey.`,
        type: 'INFO',
        link: `/loads/${rec.loadId}`,
      }
    });

    sendResponse(res, 200, 'Pickup OTP verified successfully. Return journey started.', { loadId: rec.loadId });
  } catch (error) {
    next(error);
  }
};

export const cancelTrip = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const trip = await prisma.trip.findUnique({ where: { id } });
    if (!trip) return next(new AppError('Trip not found', 404));
    
    if (trip.driverId !== req.user!.id && req.user!.role !== Role.ADMIN) {
      return next(new AppError('Not authorized', 403));
    }

    const cancelledTrip = await prisma.trip.update({
      where: { id },
      data: {
        status: TripStatus.CANCELLED,
        endedAt: new Date(),
      },
    });

    // Release assigned loads back to PENDING
    const assignedRecs = await prisma.recommendation.findMany({
      where: { tripId: id, status: { in: ['ACCEPTED', 'RESERVED'] } },
      select: { loadId: true }
    });
    if (assignedRecs.length > 0) {
      await prisma.load.updateMany({
        where: { id: { in: assignedRecs.map(r => r.loadId) } },
        data: { status: 'PENDING' }
      });
    }

    sendResponse(res, 200, 'Trip cancelled successfully', { trip: cancelledTrip });
  } catch (error) {
    next(error);
  }
};

export const getActiveTrip = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const trip = await prisma.trip.findFirst({
      where: { driverId: req.user!.id, status: TripStatus.ONGOING },
      include: {
        vehicle: true,
        recommendations: {
          where: { status: { in: ['ACCEPTED', 'NEGOTIATING'] } },
          include: {
            load: {
              include: {
                customer: {
                  select: { id: true, name: true, email: true, profile: true }
                }
              }
            }
          }
        }
      },
    });

    if (trip) {
      // Auto-heal OTPs if any accepted recommendation was created before OTP schema was added
      for (const rec of trip.recommendations) {
        if (rec.status === 'ACCEPTED' && (!rec.pickupOtp || !rec.deliveryOtp)) {
          const pOtp = rec.pickupOtp || Math.floor(100000 + Math.random() * 900000).toString();
          const dOtp = rec.deliveryOtp || Math.floor(100000 + Math.random() * 900000).toString();
          await prisma.recommendation.update({
            where: { id: rec.id },
            data: { pickupOtp: pOtp, deliveryOtp: dOtp },
          });
          await prisma.load.update({
            where: { id: rec.loadId },
            data: { pickupOtp: pOtp, deliveryOtp: dOtp },
          });
          rec.pickupOtp = pOtp;
          rec.deliveryOtp = dOtp;
        }
      }
    }

    sendResponse(res, 200, 'Active trip fetched', { trip });
  } catch (error) {
    next(error);
  }
};

export const getTripById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        driver: { select: { id: true, name: true, email: true, profile: { select: { phone: true } } } },
        vehicle: true,
        recommendations: {
          where: { status: { in: ['ACCEPTED', 'COMPLETED', 'NEGOTIATING'] } },
          include: {
            load: {
              include: {
                customer: { select: { id: true, name: true, email: true, profile: { select: { phone: true } } } },
                payments: { where: { status: 'SUCCESS' } }
              }
            }
          }
        }
      }
    });
    if (!trip) return next(new AppError('Trip not found', 404));
    sendResponse(res, 200, 'Trip details fetched', { trip });
  } catch (error) {
    next(error);
  }
};

export const getTripHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const trips = await prisma.trip.findMany({
      where: { driverId: req.user!.id },
      include: {
        driver: { select: { id: true, name: true, email: true, profile: { select: { phone: true } } } },
        vehicle: true,
        recommendations: {
          where: { status: { in: ['ACCEPTED', 'COMPLETED'] } },
          include: {
            load: {
              include: {
                customer: { select: { id: true, name: true, email: true, profile: { select: { phone: true } } } },
                payments: { where: { status: 'SUCCESS' } }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    sendResponse(res, 200, 'Trip history fetched', { trips });
  } catch (error) {
    next(error);
  }
};

export const confirmDeliveryByDriver = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { deliveryOtp, signature, customerESignatureUrl, deliveryProofPhotoUrl } = req.body;

    const trip = await prisma.trip.findUnique({ where: { id } });
    if (!trip) return next(new AppError('Trip not found', 404));

    if (trip.driverId !== req.user!.id && req.user!.role !== Role.ADMIN) {
      return next(new AppError('Not authorized', 403));
    }

    // Find accepted recommendation
    const rec = await prisma.recommendation.findFirst({
      where: { tripId: id, status: RecommendationStatus.ACCEPTED },
      include: { load: true }
    });

    if (rec) {
      const expectedOtp = rec.deliveryOtp || rec.load.deliveryOtp;
      const submittedOtp = deliveryOtp?.toString().trim();
      if (!submittedOtp) {
        return next(new AppError('2nd OTP (Consignee Delivery OTP) is required. Obtain this from the load receiver upon delivery.', 400));
      }
      if (expectedOtp && submittedOtp !== expectedOtp.toString().trim()) {
        return next(new AppError('Invalid Delivery OTP. The entered code does not match the consignee delivery OTP.', 400));
      }

      const sig = signature || customerESignatureUrl;
      if (!sig) {
        return next(new AppError('Consignee signature is required to confirm delivery.', 400));
      }

      const photo = deliveryProofPhotoUrl || trip.deliveryProofPhotoUrl;
      if (!photo) {
        return next(new AppError('Photo proof of delivery is required before completing delivery.', 400));
      }

      await prisma.$transaction([
        prisma.trip.update({
          where: { id },
          data: {
            driverDeliveryConfirmed: true,
            customerDeliveryConfirmed: true,
            deliveryOtpVerified: true,
            customerESignatureUrl: sig,
            deliveryProofPhotoUrl: photo,
          }
        }),
        prisma.recommendation.update({
          where: { id: rec.id },
          data: { deliveryOtpVerified: true }
        }),
        prisma.load.update({
          where: { id: rec.loadId },
          data: {
            status: LoadStatus.DELIVERED,
            deliveryOtpVerified: true
          }
        })
      ]);

      await prisma.notification.create({
        data: {
          userId: rec.load.customerId,
          title: '🎉 Delivery Verified & Completed',
          message: `Delivery OTP, photo proof, and receiver signature verified for "${rec.load.goodsCategory}". Shipment marked DELIVERED!`,
          type: 'INFO',
          link: `/loads/${rec.loadId}`,
        }
      });
    }

    sendResponse(res, 200, 'Delivery confirmed successfully with OTP, photo proof, and signature.');
  } catch (error) {
    next(error);
  }
};

export const confirmDeliveryByCustomer = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { customerESignatureUrl } = req.body;

    const recommendation = await prisma.recommendation.findFirst({
      where: {
        tripId: id,
        status: 'ACCEPTED',
        load: { customerId: req.user!.id }
      },
      include: { load: true }
    });

    if (!recommendation && req.user!.role !== Role.ADMIN) {
      return next(new AppError('Not authorized to confirm delivery for this trip', 403));
    }

    const updatedTrip = await prisma.trip.update({
      where: { id },
      data: {
        customerDeliveryConfirmed: true,
        customerESignatureUrl: customerESignatureUrl || undefined,
      },
    });

    if (recommendation) {
      await prisma.load.update({
        where: { id: recommendation.loadId },
        data: { status: 'DELIVERED' }
      });
    }

    sendResponse(res, 200, 'Delivery confirmed by customer', { trip: updatedTrip });
  } catch (error) {
    next(error);
  }
};

export const uploadPodPhoto = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!req.file) {
      return next(new AppError('No image file provided for proof of delivery', 400));
    }

    const trip = await prisma.trip.findUnique({ where: { id } });
    if (!trip) return next(new AppError('Trip not found', 404));

    if (trip.driverId !== req.user!.id && req.user!.role !== Role.ADMIN) {
      return next(new AppError('Not authorized. Only the assigned driver can upload delivery proof.', 403));
    }

    // Find accepted recommendation to verify 2nd OTP & consignee signature
    const rec = await prisma.recommendation.findFirst({
      where: { tripId: id, status: RecommendationStatus.ACCEPTED },
      include: { load: true }
    });

    if (rec) {
      const expectedOtp = rec.deliveryOtp || rec.load.deliveryOtp;
      const submittedOtp = req.body.deliveryOtp?.toString().trim();
      if (!submittedOtp) {
        return next(new AppError('2nd OTP (Consignee Delivery Handover OTP) is required. Obtain this 6-digit code from the receiver.', 400));
      }
      if (expectedOtp && submittedOtp !== expectedOtp.toString().trim()) {
        return next(new AppError('Invalid Delivery OTP. The code entered does not match the consignee delivery OTP.', 400));
      }

      const sig = req.body.signature || req.body.customerESignatureUrl;
      if (!sig) {
        return next(new AppError('Consignee signature is required to confirm delivery.', 400));
      }
    }

    // Upload directly to Cloudinary or fall back to static local storage
    let photoUrl = '';
    const hasValidCloudinarySecret = env.CLOUDINARY_API_SECRET && !env.CLOUDINARY_API_SECRET.includes('*');

    if (hasValidCloudinarySecret) {
      try {
        photoUrl = await uploadToCloudinary(req.file.buffer, 'wayback_pod');
      } catch (uploadErr) {
        console.warn('Cloudinary upload error, using local storage fallback:', uploadErr);
      }
    }

    if (!photoUrl) {
      try {
        const uploadDir = path.join(__dirname, '../../public/uploads/pod');
        await fs.promises.mkdir(uploadDir, { recursive: true });
        const ext = req.file.mimetype === 'image/png' ? 'png' : 'jpg';
        const filename = `pod-${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
        const filepath = path.join(uploadDir, filename);
        await fs.promises.writeFile(filepath, req.file.buffer);
        photoUrl = `http://localhost:5000/uploads/pod/${filename}`;
      } catch (fileErr) {
        console.warn('Local file write error, using data URL fallback:', fileErr);
        photoUrl = `data:${req.file.mimetype || 'image/jpeg'};base64,${req.file.buffer.toString('base64')}`;
      }
    }

    const signature = req.body.signature || req.body.customerESignatureUrl || trip.customerESignatureUrl;

    const updatedTrip = await prisma.trip.update({
      where: { id },
      data: {
        driverDeliveryConfirmed: true,
        customerDeliveryConfirmed: true,
        deliveryOtpVerified: true,
        deliveryProofPhotoUrl: photoUrl,
        customerESignatureUrl: signature,
      },
    });

    if (rec) {
      await prisma.$transaction([
        prisma.recommendation.update({
          where: { id: rec.id },
          data: { deliveryOtpVerified: true }
        }),
        prisma.load.update({
          where: { id: rec.loadId },
          data: { 
            status: LoadStatus.DELIVERED,
            deliveryOtpVerified: true,
          }
        })
      ]);

      const loadPayments = await prisma.payment.findMany({
        where: { loadId: rec.loadId, status: 'SUCCESS' },
        select: { amountMinorUnits: true },
      });
      const totalPaid = loadPayments.reduce((sum: number, p: any) => sum + p.amountMinorUnits, 0);
      const balanceDue = Math.max(0, (rec.load.budget || 0) - totalPaid);

      await prisma.notification.create({
        data: {
          userId: rec.load.customerId,
          title: balanceDue > 0 ? '💳 Shipment Delivered — Settle Remaining Balance' : '🎉 Delivery Verified & Completed',
          message: balanceDue > 0
            ? `Delivery OTP verified for "${rec.load.goodsCategory}". Your shipment has been delivered! Please settle the remaining balance of ₹${balanceDue.toLocaleString('en-IN')}.`
            : `Delivery OTP matched! Driver has uploaded photo proof and consignee signature for "${rec.load.goodsCategory}". Consignment marked DELIVERED and fully settled!`,
          type: 'INFO',
          link: balanceDue > 0 ? '/payments' : `/loads/${rec.loadId}`,
        },
      });
    }

    sendResponse(res, 200, 'Proof of delivery, receiver OTP, and signature verified successfully!', {
      trip: updatedTrip,
      url: photoUrl,
    });
  } catch (error) {
    next(error);
  }
};


