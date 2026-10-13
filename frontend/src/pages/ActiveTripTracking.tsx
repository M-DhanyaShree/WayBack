import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { socket } from '../lib/socket';
import { fetchApi } from '../lib/api';
import Map from '../components/Map';

export default function ActiveTripTracking() {
  const [trip, setTrip] = useState<any>(null);
  const [assignedLoads, setAssignedLoads] = useState<any[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [lastCoords, setLastCoords] = useState<{ lat: number; lng: number; time: string } | null>(null);
  const [simInterval, setSimInterval] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    socket.connect();
    
    return () => {
      stopTracking();
      socket.disconnect();
    };
  }, []);

  const loadData = async () => {
    try {
      const tripRes = await fetchApi('/trips/active');
      if (tripRes.data?.trip) {
        const tripData = tripRes.data.trip;
        setTrip(tripData);
        const loads = tripData.recommendations
          ?.filter((r: any) => r.status === 'ACCEPTED' || r.status === 'COMPLETED')
          ?.map((r: any) => r.load)
          ?.filter(Boolean) || [];
        setAssignedLoads(loads);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const broadcastLocation = (lat: number, lng: number, currentTrip = trip) => {
    if (!currentTrip) return;
    const loadIds = currentTrip.recommendations
      ?.filter((r: any) => r.status === 'ACCEPTED' || r.status === 'COMPLETED')
      ?.map((r: any) => r.loadId) || [];

    socket.emit('driver_location_update', {
      tripId: currentTrip.id,
      loadIds,
      lat,
      lng,
    });
    setLastCoords({ lat, lng, time: new Date().toLocaleTimeString() });
  };

  const startTracking = () => {
    if (!trip) return;
    setIsTracking(true);

    if (navigator.geolocation) {
      // Immediate current position emit
      navigator.geolocation.getCurrentPosition(
        (position) => {
          broadcastLocation(position.coords.latitude, position.coords.longitude, trip);
        },
        (error) => {
          console.warn("Geolocation getCurrentPosition warning, using trip origin:", error);
          // Fallback to trip source if browser GPS unavailable
          broadcastLocation(trip.sourceLat, trip.sourceLng, trip);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );

      const id = navigator.geolocation.watchPosition(
        (position) => {
          broadcastLocation(position.coords.latitude, position.coords.longitude, trip);
        },
        (error) => console.warn("Geolocation watch error:", error),
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 5000 }
      );
      setWatchId(id);
    } else {
      // Direct fallback
      broadcastLocation(trip.sourceLat, trip.sourceLng, trip);
    }

    // Periodic heartbeat every 4 seconds to ensure customer tracking always receives fresh stream
    const interval = setInterval(() => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => broadcastLocation(pos.coords.latitude, pos.coords.longitude, trip),
          () => {}
        );
      }
    }, 4000);
    setSimInterval(interval);
  };

  const stopTracking = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    if (simInterval) {
      clearInterval(simInterval);
      setSimInterval(null);
    }
    setIsTracking(false);
  };

  const shortName = (name?: string) => {
    if (!name) return '';
    const parts = name.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length <= 2) return parts.join(', ');
    return parts.slice(0, 2).join(', ');
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-65px)] items-center justify-center">
        <div className="glass-card p-8 text-muted-foreground">Loading active trip tracking...</div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="page-wrapper max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="glass-card p-10 space-y-4">
          <div className="text-4xl">🚛</div>
          <h2 className="text-2xl font-bold text-foreground">No Ongoing Trip Found</h2>
          <p className="text-muted-foreground text-sm">
            You must have an active ongoing trip to share your live GPS location with customers.
          </p>
          <div>
            <Link to="/trips" className="inline-block px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold shadow hover:bg-primary/90 transition">
              View Trips
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const currentDriverPos: [number, number] | null = lastCoords 
    ? [lastCoords.lat, lastCoords.lng] 
    : [trip.sourceLat, trip.sourceLng];

  return (
    <div className="page-wrapper max-w-5xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground drop-shadow tracking-tight">Driver Live Location Sharing</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Broadcast your real-time GPS position to shippers and consignees
          </p>
        </div>
        <Link to="/trips" className="px-4 py-2 border rounded-xl font-semibold text-sm hover:bg-white/50 transition">
          Back to Trips
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Status Box */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-card p-6 border border-white/50 text-center shadow-lg">
            {isTracking ? (
              <div className="space-y-4">
                <div className="inline-flex p-4 bg-emerald-100 text-emerald-800 rounded-full animate-pulse">
                  <span className="text-3xl">📡</span>
                </div>
                <h3 className="font-bold text-lg text-emerald-800">Broadcasting Live GPS</h3>
                <p className="text-xs text-muted-foreground">
                  Customers tracking assigned loads can view your position in real time.
                </p>
                {lastCoords && (
                  <div className="text-xs bg-white/70 border border-slate-200 py-2 px-3 rounded-lg font-mono text-slate-800">
                    📍 {lastCoords.lat.toFixed(4)}, {lastCoords.lng.toFixed(4)}
                    <span className="block text-[11px] text-muted-foreground mt-0.5">Updated at {lastCoords.time}</span>
                  </div>
                )}
                <div>
                  <button
                    onClick={stopTracking}
                    className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-sm shadow transition"
                  >
                    ⏹ Stop Sharing Location
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="inline-flex p-4 bg-primary/10 text-primary rounded-full">
                  <span className="text-3xl">📍</span>
                </div>
                <h3 className="font-bold text-lg text-foreground">Location Sharing Inactive</h3>
                <p className="text-xs text-muted-foreground">
                  Click below to enable live GPS streaming for this ongoing journey.
                </p>
                <button
                  onClick={startTracking}
                  className="w-full py-3 px-4 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold text-sm shadow-md transition"
                >
                  ▶ Start Sharing Location
                </button>
              </div>
            )}
          </div>

          <div className="glass-card p-5 border border-white/50 shadow-sm space-y-3">
            <h4 className="font-bold text-sm uppercase tracking-wider text-primary">Active Trip Info</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-xs">Origin</span>
                <span className="font-semibold text-foreground truncate max-w-[200px]" title={trip.sourceName}>
                  {shortName(trip.sourceName)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-xs">Destination</span>
                <span className="font-semibold text-foreground truncate max-w-[200px]" title={trip.destName}>
                  {shortName(trip.destName)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-xs">Assigned Loads</span>
                <span className="font-bold text-primary text-xs">{assignedLoads.length} load(s)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Map Preview */}
        <div className="lg:col-span-7 glass-card p-3 border border-white/50 shadow-lg rounded-2xl min-h-[460px] flex flex-col">
          <div className="flex-1 rounded-xl overflow-hidden relative min-h-[420px]">
            <Map
              source={[trip.sourceLat, trip.sourceLng]}
              destination={[trip.destLat, trip.destLng]}
              routeGeometry={trip.routeGeometry}
              driverPosition={isTracking ? currentDriverPos : null}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
