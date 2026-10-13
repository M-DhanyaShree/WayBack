import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// @ts-ignore
import icon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

// Distinct Custom Labeled Pins
export const createLabeledPin = (color: string, label: string, emoji: string) => {
  return L.divIcon({
    className: 'custom-map-pin',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%, -100%);">
        <div style="background:${color};color:white;font-weight:bold;font-size:11px;padding:3px 8px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.35);white-space:nowrap;border:1.5px solid white;display:flex;align-items:center;gap:4px;">
          <span>${emoji}</span><span>${label}</span>
        </div>
        <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ${color};"></div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
};

const createTruckPin = (label: string = 'Live Driver') => {
  return L.divIcon({
    className: 'custom-truck-pin',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%, -50%);">
        <div style="background:#1d4ed8;color:white;font-size:10px;font-weight:bold;padding:2px 7px;border-radius:10px;box-shadow:0 2px 6px rgba(0,0,0,0.3);margin-bottom:3px;white-space:nowrap;border:1px solid white;">
          ${label}
        </div>
        <div style="background:#2563eb;width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;border:3px solid white;box-shadow:0 2px 14px rgba(37,99,235,0.65);">
          🚛
        </div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
};

interface MapProps {
  source?: [number, number];
  destination?: [number, number];
  sourceLabel?: string;
  destinationLabel?: string;
  driverLabel?: string;
  routeGeometry?: any;
  interactive?: boolean;
  driverPosition?: [number, number] | null;
  onLocationSelect?: (lat: number, lng: number, name: string) => void;
}

// Reverse geocode using Nominatim
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
    );
    const data = await res.json();
    return data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

const MapEvents = ({ onLocationSelect }: { onLocationSelect?: (lat: number, lng: number, name: string) => void }) => {
  const map = useMap();
  useEffect(() => {
    if (!onLocationSelect) return;
    const onClick = async (e: L.LeafletMouseEvent) => {
      const name = await reverseGeocode(e.latlng.lat, e.latlng.lng);
      onLocationSelect(e.latlng.lat, e.latlng.lng, name);
    };
    map.on('click', onClick);
    return () => { map.off('click', onClick); };
  }, [map, onLocationSelect]);
  return null;
};

const FitBounds = ({ source, destination }: { source?: [number, number], destination?: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    if (source && destination) {
      const bounds = L.latLngBounds([source, destination]);
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (source) {
      map.setView(source, 13);
    }
  }, [map, source, destination]);
  return null;
};

// Smoothly pans map when driver position updates
const PanToDriver = ({ pos }: { pos: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.panTo(pos, { animate: true, duration: 1.2 });
  }, [pos[0], pos[1]]);
  return null;
};

// Ensures Leaflet recalculates viewport width correctly on layout
const ResizeMap = () => {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    const t1 = setTimeout(() => map.invalidateSize(), 150);
    const t2 = setTimeout(() => map.invalidateSize(), 500);

    const container = map.getContainer();
    const ro = new ResizeObserver(() => {
      map.invalidateSize();
    });
    if (container) ro.observe(container);

    const handleResize = () => map.invalidateSize();
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', handleResize);
      ro.disconnect();
    };
  }, [map]);
  return null;
};

export default function Map({ source, destination, sourceLabel, destinationLabel, driverLabel, routeGeometry, interactive = false, driverPosition, onLocationSelect }: MapProps) {
  const center: [number, number] = source || [20.5937, 78.9629];

  let positions: [number, number][] = [];
  if (routeGeometry?.coordinates) {
    positions = routeGeometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
  }

  return (
    <MapContainer center={center} zoom={5} style={{ height: '100%', width: '100%', backgroundColor: '#f1f5f9' }} dragging={true} zoomControl={true} scrollWheelZoom={interactive}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
      />

      {source && (
        <Marker position={source} icon={createLabeledPin('#16a34a', sourceLabel || 'Pickup', '🟢')}>
          <Popup>🟢 {sourceLabel || 'Pickup Location'}</Popup>
        </Marker>
      )}
      {destination && (
        <Marker position={destination} icon={createLabeledPin('#dc2626', destinationLabel || 'Delivery', '🔴')}>
          <Popup>🔴 {destinationLabel || 'Delivery Destination'}</Popup>
        </Marker>
      )}

      {/* Live driver location marker — renders with dynamic badge */}
      {driverPosition && (
        <>
          <Marker position={driverPosition} icon={createTruckPin(driverLabel || 'Driver Live')}>
            <Popup>🚛 Driver Live Position</Popup>
          </Marker>
          <PanToDriver pos={driverPosition} />
        </>
      )}

      {positions.length > 0 ? (
        <Polyline positions={positions} color="#2563eb" weight={5} opacity={0.85} />
      ) : (
        source && destination && (
          <Polyline positions={[source, destination]} color="#3b82f6" weight={4} dashArray="8, 8" opacity={0.7} />
        )
      )}

      <FitBounds source={source} destination={destination} />
      <ResizeMap />
      {interactive && <MapEvents onLocationSelect={onLocationSelect} />}
    </MapContainer>
  );
}

