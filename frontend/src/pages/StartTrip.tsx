import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchApi } from '../lib/api';
import Map, { reverseGeocode } from '../components/Map';
import LocationInput from '../components/LocationInput';

export default function StartTrip() {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [vehicleId, setVehicleId] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [destName, setDestName] = useState('');
  const [returnToName, setReturnToName] = useState('');
  const [source, setSource] = useState<[number, number] | undefined>();
  const [destination, setDestination] = useState<[number, number] | undefined>();
  const [returnTo, setReturnTo] = useState<[number, number] | undefined>();
  const [selecting, setSelecting] = useState<'source' | 'destination' | 'returnTo' | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);

  // New Intent & Timing States
  const [expectedArrivalAt, setExpectedArrivalAt] = useState('');
  const [returnIntent, setReturnIntent] = useState('NOT_SURE');
  const [expectedReturnAt, setExpectedReturnAt] = useState('');
  const [flexibilityOverride, setFlexibilityOverride] = useState('');
  const [availableWeight, setAvailableWeight] = useState('');
  const [availableVolume, setAvailableVolume] = useState('');

  useEffect(() => {
    fetchApi('/vehicles').then(res => {
      setVehicles(res.data.vehicles);
      if (res.data.vehicles.length > 0) setVehicleId(res.data.vehicles[0].id);
    });
  }, []);

  // Reverse geocode and auto-set source to current location
  const getCurrentLocation = () => {
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setSource([lat, lng]);
        const name = await reverseGeocode(lat, lng);
        setSourceName(name);
        setGeoLoading(false);
      },
      (err) => {
        console.error('Location permission denied', err);
        setGeoLoading(false);
      }
    );
  };

  // When map is clicked, auto-set the active field with reverse geocoded name
  const handleMapClick = async (lat: number, lng: number, name: string) => {
    if (selecting === 'source') {
      setSource([lat, lng]);
      setSourceName(name);
      setSelecting(null);
    } else if (selecting === 'destination') {
      setDestination([lat, lng]);
      setDestName(name);
      setSelecting(null);
    } else if (selecting === 'returnTo') {
      setReturnTo([lat, lng]);
      setReturnToName(name);
      setSelecting(null);
    }
  };

  const handleStart = async () => {
    if (!vehicleId || !source || !destination || !sourceName || !destName) {
      setError('Please fill all fields and select locations on map');
      return;
    }
    setLoading(true);
    try {
      await fetchApi('/trips/start', {
        method: 'POST',
        body: JSON.stringify({
          vehicleId,
          sourceName,
          sourceLat: source[0],
          sourceLng: source[1],
          destName,
          destLat: destination[0],
          destLng: destination[1],
          returnToName: returnIntent === 'YES' ? returnToName || undefined : undefined,
          returnToLat: returnIntent === 'YES' && returnTo ? returnTo[0] : undefined,
          returnToLng: returnIntent === 'YES' && returnTo ? returnTo[1] : undefined,
          expectedArrivalAt: expectedArrivalAt || undefined,
          expectedReturnAt: expectedReturnAt || undefined,
          returnIntent,
          returnWindowStart: expectedReturnAt ? new Date(new Date(expectedReturnAt).getTime() - 12 * 60 * 60 * 1000).toISOString() : undefined,
          returnWindowEnd: expectedReturnAt ? new Date(new Date(expectedReturnAt).getTime() + 12 * 60 * 60 * 1000).toISOString() : undefined,
          flexibilityOverride: flexibilityOverride || undefined,
          availableWeight: availableWeight ? parseFloat(availableWeight) : undefined,
          availableVolume: availableVolume ? parseFloat(availableVolume) : undefined,
        }),
      });
      navigate('/trips');
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const selectingHint = selecting === 'source'
    ? '📍 Click the map to set your Source'
    : selecting === 'destination'
      ? '📍 Click the map to set your Destination'
      : selecting === 'returnTo'
        ? '📍 Click the map to set your Return Location'
        : null;

  return (
    <div className="flex h-[calc(100vh-65px)]">
      {/* LEFT PANEL */}
      <div className="w-[360px] flex-shrink-0 glass-card m-3 rounded-2xl flex flex-col gap-4 overflow-y-auto p-6">
        <h1 className="text-2xl font-bold">Start New Trip</h1>

        {error && <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg border border-destructive/20">{error}</div>}

        <div>
          <label className="block text-sm font-medium mb-1">Select Vehicle</label>
          <select value={vehicleId} onChange={e => setVehicleId(e.target.value)} className="glass-input w-full p-2.5 rounded-lg text-sm">
            {vehicles.map(v => (
              <option key={v.id} value={v.id}>{v.make} {v.model} ({v.registrationNo})</option>
            ))}
          </select>
        </div>

        {/* Source */}
        <div className="space-y-2">
          <LocationInput
            label="Source"
            value={sourceName}
            onChangeName={setSourceName}
            onSelect={(lat, lng, name) => { setSource([lat, lng]); setSourceName(name); }}
          />
          <div className="flex gap-2">
            <button
              className="flex-1 py-1.5 text-xs bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 font-medium text-blue-700 transition"
              onClick={getCurrentLocation}
              disabled={geoLoading}
            >
              {geoLoading ? '⏳ Getting location...' : '📍 Use My Location'}
            </button>
            <button
              className={`flex-1 py-1.5 text-xs rounded-lg border font-medium transition ${selecting === 'source' ? 'bg-primary text-white border-primary' : 'bg-white/60 hover:bg-white/80 border-border'}`}
              onClick={() => setSelecting(selecting === 'source' ? null : 'source')}
            >
              {source ? '✅ Set on map' : '🗺 Pick on Map'}
            </button>
          </div>
          {source && <div className="text-xs text-muted-foreground bg-white/40 rounded px-2 py-1 truncate">📌 {sourceName}</div>}
        </div>

        {/* Destination */}
        <div className="space-y-2">
          <LocationInput
            label="Destination"
            value={destName}
            onChangeName={setDestName}
            onSelect={(lat, lng, name) => { setDestination([lat, lng]); setDestName(name); }}
          />
          <button
            className={`w-full py-1.5 text-xs rounded-lg border font-medium transition ${selecting === 'destination' ? 'bg-primary text-white border-primary' : 'bg-white/60 hover:bg-white/80 border-border'}`}
            onClick={() => setSelecting(selecting === 'destination' ? null : 'destination')}
          >
            {destination ? '✅ Set on map' : '🗺 Pick on Map'}
          </button>
          {destination && <div className="text-xs text-muted-foreground bg-white/40 rounded px-2 py-1 truncate">📌 {destName}</div>}
        </div>

        {/* Return To */}
        <div className="space-y-2 p-3 bg-white/40 rounded-xl border">
          <label className="block text-sm font-medium">Do you need a return load?</label>
          <div className="flex gap-2 mb-2">
            {['YES', 'NO', 'NOT_SURE'].map((intent) => (
              <button
                key={intent}
                onClick={() => setReturnIntent(intent)}
                className={`flex-1 py-1.5 text-xs rounded-lg border font-medium transition ${
                  returnIntent === intent ? 'bg-primary text-white border-primary' : 'bg-white/60 hover:bg-white/80 border-border'
                }`}
              >
                {intent.replace('_', ' ')}
              </button>
            ))}
          </div>

          {returnIntent === 'YES' && (
            <div className="space-y-3 mt-3 animate-in fade-in slide-in-from-top-2">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Expected Return Date & Time</label>
                <input type="datetime-local" value={expectedReturnAt} onChange={(e) => setExpectedReturnAt(e.target.value)} className="glass-input w-full p-2 rounded-lg text-sm" />
              </div>
              <LocationInput
                label="Return Destination"
                value={returnToName}
                onChangeName={setReturnToName}
                onSelect={(lat, lng, name) => { setReturnTo([lat, lng]); setReturnToName(name); }}
              />
              <button
                className={`w-full py-1.5 text-xs rounded-lg border font-medium transition ${selecting === 'returnTo' ? 'bg-primary text-white border-primary' : 'bg-white/60 hover:bg-white/80 border-border'}`}
                onClick={() => setSelecting(selecting === 'returnTo' ? null : 'returnTo')}
              >
                {returnTo ? '✅ Set on map' : '🗺 Pick on Map'}
              </button>
              {returnTo && <div className="text-xs text-muted-foreground bg-white/40 rounded px-2 py-1 truncate">📌 {returnToName}</div>}
            </div>
          )}
        </div>

        {/* Advanced / Overrides */}
        <div className="space-y-3 p-3 bg-white/40 rounded-xl border">
          <h3 className="text-sm font-medium">Trip Settings</h3>
          
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Expected Arrival Time</label>
            <input type="datetime-local" value={expectedArrivalAt} onChange={(e) => setExpectedArrivalAt(e.target.value)} className="glass-input w-full p-2 rounded-lg text-sm" />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Flexibility Level Override (Optional)</label>
            <select value={flexibilityOverride} onChange={e => setFlexibilityOverride(e.target.value)} className="glass-input w-full p-2 rounded-lg text-sm">
              <option value="">Use Profile Default</option>
              <option value="STRICT">Strict (Small Detours)</option>
              <option value="BALANCED">Balanced</option>
              <option value="FLEXIBLE">Flexible (Large Detours)</option>
            </select>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
               <label className="block text-xs font-medium text-muted-foreground mb-1">Available Weight (kg)</label>
               <input type="number" step="1" value={availableWeight} onChange={e => setAvailableWeight(e.target.value)} placeholder="Full Capacity" className="glass-input w-full p-2 rounded-lg text-sm" />
            </div>
            <div className="flex-1">
               <label className="block text-xs font-medium text-muted-foreground mb-1">Available Volume (cbf)</label>
               <input type="number" step="1" value={availableVolume} onChange={e => setAvailableVolume(e.target.value)} placeholder="Full Capacity" className="glass-input w-full p-2 rounded-lg text-sm" />
            </div>
          </div>
        </div>

        <button
          onClick={handleStart}
          disabled={loading}
          className="w-full p-3 bg-primary text-primary-foreground rounded-xl mt-2 hover:bg-primary/90 disabled:opacity-50 font-semibold shadow transition"
        >
          {loading ? 'Starting Trip...' : '🚛 Start Trip'}
        </button>
      </div>

      {/* RIGHT: Map */}
      <div className="flex-1 relative m-3 ml-0 rounded-2xl overflow-hidden shadow-lg">
        {selectingHint && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-primary text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium animate-pulse">
            {selectingHint}
          </div>
        )}
        <Map
          source={source}
          sourceLabel={sourceName}
          destination={destination}
          destinationLabel={destName}
          interactive={true}
          onLocationSelect={handleMapClick}
        />
      </div>
    </div>
  );
}
