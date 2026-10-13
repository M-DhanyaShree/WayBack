import { Server, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// In-memory cache of latest driver locations per trip and per load
const latestTripLocations: Record<string, { lat: number; lng: number; timestamp: Date }> = {};
const latestLoadLocations: Record<string, { lat: number; lng: number; timestamp: Date }> = {};

export default function trackingSocketHandler(io: Server, socket: Socket) {
  socket.on('join_tracking', async (data: { tripId?: string; loadId?: string }) => {
    if (data.tripId) {
      socket.join(`trip_${data.tripId}`);
      if (latestTripLocations[data.tripId]) {
        socket.emit('location_updated', latestTripLocations[data.tripId]);
      }
    }
    if (data.loadId) {
      socket.join(`load_${data.loadId}`);
      if (latestLoadLocations[data.loadId]) {
        socket.emit('location_updated', latestLoadLocations[data.loadId]);
      } else {
        try {
          const load = await prisma.load.findUnique({
            where: { id: data.loadId },
            include: {
              recommendations: {
                where: { status: { in: ['ACCEPTED', 'COMPLETED'] } },
                include: { trip: true }
              }
            }
          });
          if (load) {
            const matchedTrip = load.recommendations?.[0]?.trip;
            if (matchedTrip && latestTripLocations[matchedTrip.id]) {
              const loc = latestTripLocations[matchedTrip.id];
              latestLoadLocations[data.loadId] = loc;
              socket.emit('location_updated', loc);
            } else if (load.pickupLat && load.pickupLng) {
              const initialLoc = { lat: load.pickupLat, lng: load.pickupLng, timestamp: new Date() };
              latestLoadLocations[data.loadId] = initialLoc;
              socket.emit('location_updated', initialLoc);
            }
          }
        } catch (err) {
          console.error('Error fetching fallback location for load:', err);
        }
      }
    }
  });

  socket.on('leave_tracking', (data: { tripId?: string; loadId?: string }) => {
    if (data.tripId) socket.leave(`trip_${data.tripId}`);
    if (data.loadId) socket.leave(`load_${data.loadId}`);
  });

  socket.on('driver_location_update', async (data: { tripId: string; loadIds?: string[]; lat: number; lng: number }) => {
    const update = { lat: data.lat, lng: data.lng, timestamp: new Date() };
    
    // Save and broadcast latest trip location
    if (data.tripId) {
      latestTripLocations[data.tripId] = update;
      io.to(`trip_${data.tripId}`).emit('location_updated', update);
    }
    
    const targets = new Set<string>(data.loadIds || []);

    // Also look up any accepted/completed loads for this trip from DB
    if (data.tripId) {
      try {
        const trip = await prisma.trip.findUnique({
          where: { id: data.tripId },
          include: {
            recommendations: {
              where: {
                status: { in: ['ACCEPTED', 'COMPLETED'] }
              },
              select: { loadId: true }
            }
          }
        });
        trip?.recommendations?.forEach(r => targets.add(r.loadId));
      } catch (err) {
        console.error('Error finding loads for trip location update:', err);
      }
    }

    // Broadcast to all associated load tracking rooms and cache
    targets.forEach(loadId => {
      latestLoadLocations[loadId] = update;
      io.to(`load_${loadId}`).emit('location_updated', update);
    });
  });

  socket.on('trip_status_update', (data: { tripId: string; status: string }) => {
    io.to(`trip_${data.tripId}`).emit('status_updated', { status: data.status, timestamp: new Date() });
  });

  socket.on('load_status_update', (data: { loadId: string; status: string }) => {
    io.to(`load_${data.loadId}`).emit('status_updated', { status: data.status, timestamp: new Date() });
  });
}
