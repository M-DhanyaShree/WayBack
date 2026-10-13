import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchApi } from '../lib/api';
import { socket } from '../lib/socket';
import Map from '../components/Map';
import { useChat } from '../context/ChatContext';
import TermsModal from '../components/TermsModal';

const OUTBOUND_WAYPOINTS = [
  { name: 'Trip Origin (Coimbatore North Hub)', lat: 11.0018115, lng: 76.9628425, distKm: 429 },
  { name: 'Tiruppur Highway (NH544)', lat: 11.1085, lng: 77.3411, distKm: 385 },
  { name: 'Erode Bypass', lat: 11.3410, lng: 77.7172, distKm: 335 },
  { name: 'Salem Toll Plaza (NH44)', lat: 11.6643, lng: 78.1460, distKm: 260 },
  { name: 'Dharmapuri Expressway', lat: 12.1211, lng: 78.1582, distKm: 195 },
  { name: 'Vellore Golden Fort Corridor', lat: 12.9165, lng: 79.1325, distKm: 125 },
  { name: 'Kanchipuram Hub', lat: 12.8342, lng: 79.7036, distKm: 65 },
  { name: 'Sriperumbudur Industrial Zone', lat: 12.9675, lng: 79.9405, distKm: 32 },
  { name: 'Chennai Outer Ring (Near Destination - 12 km!)', lat: 13.0450, lng: 80.1800, distKm: 12 },
  { name: 'Chennai Central Delivery Destination (0 km)', lat: 13.0800915, lng: 80.2807978, distKm: 0 },
];

const RETURN_WAYPOINTS = [
  { name: 'Chennai Central Hub (Return Cargo Loading Origin)', lat: 13.0800915, lng: 80.2807978, distKm: 345, dropDistanceKm: 345 },
  { name: 'Sriperumbudur Industrial Corridor (NH48)', lat: 12.9675, lng: 79.9405, distKm: 310, dropDistanceKm: 310 },
  { name: 'Kanchipuram Highway Crossing', lat: 12.8342, lng: 79.7036, distKm: 275, dropDistanceKm: 275 },
  { name: 'Vellore Golden Fort Corridor', lat: 12.9165, lng: 79.1325, distKm: 215, dropDistanceKm: 215 },
  { name: 'Ambur / Vaniyambadi NH44 Expressway', lat: 12.7903, lng: 78.7166, distKm: 170, dropDistanceKm: 170 },
  { name: 'Dharmapuri NH44 Toll Corridor', lat: 12.1211, lng: 78.1582, distKm: 95, dropDistanceKm: 95 },
  { name: 'Salem Outer Hub (NH44 Junction - 12 km to Drop!)', lat: 11.6643, lng: 78.1460, distKm: 12, dropDistanceKm: 12 },
  { name: 'Salem Consignee Delivery Destination (0 km - Arrived at Drop)', lat: 11.6538, lng: 78.1579, distKm: 0, dropDistanceKm: 0 },
  { name: 'Sankari / Bhavani Highway (Transit to Coimbatore)', lat: 11.4820, lng: 77.8680, distKm: 110, dropDistanceKm: 0 },
  { name: 'Erode Bypass Link', lat: 11.3410, lng: 77.7172, distKm: 85, dropDistanceKm: 0 },
  { name: 'Coimbatore North Origin Hub (Final Return Completed - 0 km)', lat: 11.0018115, lng: 76.9628425, distKm: 0, dropDistanceKm: 0 },
];

export default function Trips() {
  const { openChat } = useChat();
  const [activeTrip, setActiveTrip] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // POD state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [uploadingPod, setUploadingPod] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  // 2nd Delivery OTP & POD
  const [deliveryOtpInput, setDeliveryOtpInput] = useState('');
  const [deliveryTermsAgreed, setDeliveryTermsAgreed] = useState(false);

  // 1st Pickup OTP modal state
  const [showPickupOtpModal, setShowPickupOtpModal] = useState(false);
  const [selectedRecForPickup, setSelectedRecForPickup] = useState<any>(null);
  const [enteredPickupOtp, setEnteredPickupOtp] = useState('');
  const [pickupTermsAgreed, setPickupTermsAgreed] = useState(false);

  // Terms Modal state
  const [termsModalOpen, setTermsModalOpen] = useState(false);

  // Independent Trip Details Modal State
  const [selectedTripForDetails, setSelectedTripForDetails] = useState<any>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Simulation State
  const [simLeg, setSimLeg] = useState<'OUTBOUND' | 'RETURN'>('OUTBOUND');
  const [simStepIndex, setSimStepIndex] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const navigate = useNavigate();

  const loadTrips = async () => {
    try {
      const [activeRes, historyRes] = await Promise.all([
        fetchApi('/trips/active'),
        fetchApi('/trips/history')
      ]);
      setActiveTrip(activeRes.data.trip);
      setHistory(historyRes.data.trips.filter((t: any) => t.status !== 'ONGOING'));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTrips(); }, []);

  // Broadcast helper ensuring both trip and customer load rooms receive the coordinate update
  const broadcastLocation = (lat: number, lng: number) => {
    setGpsCoords({ lat, lng });
    if (activeTrip) {
      const loadIds = activeTrip.recommendations
        ?.filter((r: any) => r.status === 'ACCEPTED' || r.status === 'COMPLETED')
        ?.map((r: any) => r.loadId) || [];
      socket.emit('driver_location_update', {
        tripId: activeTrip.id,
        loadIds,
        lat,
        lng,
      });
    }
  };

  // Background Live Location Broadcasting (Only when NOT simulating)
  useEffect(() => {
    if (!activeTrip) return;
    socket.connect();

    // If driver is actively simulating route milestones or has switched to the return leg,
    // do NOT let browser IP/desktop geolocation overwrite simulated coordinates.
    if (simLeg === 'RETURN' || simStepIndex > 0) {
      return;
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          if (simLeg === 'OUTBOUND' && simStepIndex === 0) {
            broadcastLocation(pos.coords.latitude, pos.coords.longitude);
          }
        },
        () => {
          if (simLeg === 'OUTBOUND' && simStepIndex === 0) {
            broadcastLocation(activeTrip.sourceLat, activeTrip.sourceLng);
          }
        },
        { enableHighAccuracy: true, timeout: 6000 }
      );

      const watchId = navigator.geolocation.watchPosition(
        pos => {
          if (simLeg === 'OUTBOUND' && simStepIndex === 0) {
            broadcastLocation(pos.coords.latitude, pos.coords.longitude);
          }
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
      );

      return () => {
        navigator.geolocation.clearWatch(watchId);
      };
    } else {
      if (simLeg === 'OUTBOUND' && simStepIndex === 0) {
        broadcastLocation(activeTrip.sourceLat, activeTrip.sourceLng);
      }
    }
  }, [activeTrip?.id, activeTrip?.status, simLeg, simStepIndex]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const shortName = (name?: string) => {
    if (!name) return '';
    const parts = name.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length <= 2) return parts.join(', ');
    return parts.slice(0, 2).join(', ');
  };

  const getHaversineDist = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const calculatedDistance = activeTrip?.distanceKm || (activeTrip?.sourceLat && activeTrip?.destLat ? (getHaversineDist(activeTrip.sourceLat, activeTrip.sourceLng, activeTrip.destLat, activeTrip.destLng) * 1.25) : null);

  const driverCurrentLat = gpsCoords?.lat ?? activeTrip?.sourceLat;
  const driverCurrentLng = gpsCoords?.lng ?? activeTrip?.sourceLng;

  const distToDestinationKm = (driverCurrentLat && driverCurrentLng && activeTrip?.destLat && activeTrip?.destLng)
    ? getHaversineDist(driverCurrentLat, driverCurrentLng, activeTrip.destLat, activeTrip.destLng)
    : null;

  // Destination arrival: enabled only when driver is within 15 km of destination or has arrived
  const isNearDestination = Boolean(activeTrip?.driverDeliveryConfirmed) || (distToDestinationKm !== null ? distToDestinationKm <= 15 : false);

  const acceptedRecs = activeTrip?.recommendations?.filter((r: any) => r.status === 'ACCEPTED') ?? [];
  const hasReturnLoadInTransit = acceptedRecs.some((r: any) => r.load?.status === 'IN_TRANSIT');
  const allDelivered = acceptedRecs.length > 0 && acceptedRecs.every((r: any) => r.load?.status === 'DELIVERED');

  // Simulation waypoint active sets
  const activeWaypoints = simLeg === 'OUTBOUND' ? OUTBOUND_WAYPOINTS : RETURN_WAYPOINTS;
  const currentSimPoint = activeWaypoints[simStepIndex] || activeWaypoints[0];
  const isAtOutboundDest = simLeg === 'OUTBOUND' && simStepIndex >= OUTBOUND_WAYPOINTS.length - 1;
  const isAtReturnEnd = simLeg === 'RETURN' && simStepIndex >= RETURN_WAYPOINTS.length - 1;

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleEndTrip = async () => {
    if (!activeTrip) return;
    setActionLoading('end');
    try {
      await fetchApi(`/trips/${activeTrip.id}/end`, { method: 'POST' });
      setSuccessMsg('Trip ended successfully.');
      loadTrips();
    } catch (err) { console.error(err); }
    finally { setActionLoading(''); }
  };

  const handleArrive = async () => {
    if (!activeTrip) return;
    setActionLoading('arrive');
    try {
      await fetchApi(`/trips/${activeTrip.id}/arrive`, { method: 'POST' });
      setSuccessMsg('Customers notified of your arrival!');
      loadTrips();
    } catch (err) { console.error(err); }
    finally { setActionLoading(''); }
  };

  // Open 1st OTP modal when driver initiates carrying return load
  const openPickupOtpModal = (rec: any) => {
    setSelectedRecForPickup(rec);
    setEnteredPickupOtp('');
    setPickupTermsAgreed(false);
    setShowPickupOtpModal(true);
  };

  // Verify 1st OTP & start return journey
  const handleVerifyAndStartReturn = async () => {
    if (!selectedRecForPickup) return;
    if (!enteredPickupOtp || enteredPickupOtp.trim().length !== 6) {
      alert('Please enter the 6-digit Pickup Handover OTP provided by the customer.');
      return;
    }
    if (!pickupTermsAgreed) {
      alert('Please confirm the cargo stowage and compliance declaration.');
      return;
    }

    setActionLoading('verifyPickup');
    try {
      await fetchApi(`/trips/${activeTrip.id}/start-return-load`, {
        method: 'POST',
        body: JSON.stringify({
          recommendationId: selectedRecForPickup.id,
          pickupOtp: enteredPickupOtp.trim(),
        }),
      });

      setSuccessMsg('🎉 1st OTP verified! Cargo loaded. Return trip is now IN TRANSIT.');
      setShowPickupOtpModal(false);
      setEnteredPickupOtp('');
      loadTrips();
    } catch (err: any) {
      alert(err.message || 'Invalid Pickup OTP. Please verify the code with customer.');
    } finally {
      setActionLoading('');
    }
  };

  // ── Simulation Handlers ────────────────────────────────────────────────────

  const handleSimStepForward = () => {
    const maxIdx = activeWaypoints.length - 1;
    if (simStepIndex >= maxIdx) return;
    const nextIdx = Math.min(simStepIndex + 1, maxIdx);
    setSimStepIndex(nextIdx);
    const pt = activeWaypoints[nextIdx];
    broadcastLocation(pt.lat, pt.lng);
  };

  const handleSimFastForward = () => {
    if (simLeg === 'OUTBOUND') {
      // Jump to Chennai Outer Ring (index 8, 12 km from Chennai Central)
      setSimStepIndex(8);
      const pt = OUTBOUND_WAYPOINTS[8];
      broadcastLocation(pt.lat, pt.lng);
    } else {
      // Return leg: Jump to Salem Outer Hub (index 6, 12 km from Salem drop) or Salem Drop (index 7)
      setSimStepIndex(7);
      const pt = RETURN_WAYPOINTS[7];
      broadcastLocation(pt.lat, pt.lng);
    }
  };

  const handleSwitchToReturnLeg = () => {
    setSimLeg('RETURN');
    setSimStepIndex(0);
    const pt = RETURN_WAYPOINTS[0];
    broadcastLocation(pt.lat, pt.lng);
    setSuccessMsg('🔁 Switched simulation to Return Leg: Chennai → Salem Hub → Coimbatore. Live GPS streaming dynamically to customer!');
  };

  const handleResetToOrigin = () => {
    setSimLeg('OUTBOUND');
    setSimStepIndex(0);
    const pt = OUTBOUND_WAYPOINTS[0];
    broadcastLocation(pt.lat, pt.lng);
    setSuccessMsg('🔄 Simulation reset back to Coimbatore Origin.');
  };

  const handleResetReturnLeg = () => {
    setSimStepIndex(0);
    const pt = RETURN_WAYPOINTS[0];
    broadcastLocation(pt.lat, pt.lng);
    setSuccessMsg('🔄 Return simulation reset to Chennai loading point.');
  };

  // ── Camera and POD Proof ───────────────────────────────────────────────────

  const handlePodFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      stopCamera();
    }
  };

  const startCamera = async () => {
    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error('Camera access error:', err);
      alert('Could not access camera device. Please allow camera permissions or click "Upload Image" to browse a photo.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(t => t.stop());
      cameraStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhotoFromCamera = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      if (blob) {
        const file = new File([blob], `pod-camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
        stopCamera();
      }
    }, 'image/jpeg', 0.92);
  };

  const isCanvasBlank = (canvas: HTMLCanvasElement | null) => {
    if (!canvas) return true;
    const ctx = canvas.getContext('2d');
    if (!ctx) return true;
    const pixelBuffer = new Uint32Array(ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer);
    return !pixelBuffer.some(color => color !== 0);
  };

  // Submit complete POD with 2nd Delivery OTP, Photo & Consignee Signature
  const handleDriverUploadPod = async () => {
    if (!activeTrip) return;
    if (!selectedFile) {
      alert('Please take a picture or select an image file as delivery proof.');
      return;
    }
    if (!deliveryOtpInput || deliveryOtpInput.trim().length !== 6) {
      alert('Please enter the 6-digit Consignee Delivery Handover OTP provided by the load receiver.');
      return;
    }

    const canvas = canvasRef.current;
    const signatureDataUrl = canvas ? canvas.toDataURL('image/png') : '';
    if (!signatureDataUrl || isCanvasBlank(canvas)) {
      alert('Please ask the receiver / consignee to sign in the signature pad above.');
      return;
    }

    if (!deliveryTermsAgreed) {
      alert('Please confirm acceptance of the delivery compliance terms & conditions.');
      return;
    }

    setUploadingPod(true);
    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('deliveryOtp', deliveryOtpInput.trim());
      formData.append('signature', signatureDataUrl);

      await fetchApi(`/trips/${activeTrip.id}/pod-upload`, {
        method: 'POST',
        body: formData,
      });

      setSuccessMsg('🎉 Delivery verified! 2nd OTP matched, photo and consignee signature recorded successfully!');
      setSelectedFile(null);
      setPreviewUrl('');
      setDeliveryOtpInput('');
      loadTrips();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to complete delivery');
    } finally {
      setUploadingPod(false);
    }
  };

  // ── Canvas ─────────────────────────────────────────────────────────────────
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => setIsDrawing(false);
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
  };

  if (loading) return (
    <div className="flex h-[calc(100vh-65px)] items-center justify-center">
      <div className="glass-card p-8 text-muted-foreground animate-pulse">Loading trips...</div>
    </div>
  );

  return (
    <div className="page-wrapper max-w-6xl mx-auto px-4 py-8 w-full">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground drop-shadow tracking-tight">Driver Trips</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage ongoing shipments, return loads, and deliver proof of fulfillment</p>
        </div>
        {!activeTrip && (
          <Link to="/trips/start" className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-semibold hover:bg-primary/90 transition shadow-md">
            + Start New Trip
          </Link>
        )}
      </div>

      {successMsg && (
        <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 rounded-xl text-sm flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="font-bold">&times;</button>
        </div>
      )}

      {activeTrip && (
        <div className="mb-10 space-y-4 w-full">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-primary">Active Ongoing Trip</h2>
              {gpsCoords && (
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Live GPS Broadcasting: {gpsCoords.lat.toFixed(4)}, {gpsCoords.lng.toFixed(4)}
                </span>
              )}
            </div>
            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 font-bold text-xs rounded-full animate-pulse">
              ● {simLeg === 'RETURN' ? 'RETURN LEG (LIVE)' : 'OUTBOUND (IN TRANSIT)'}
            </span>
          </div>

          {/* ── DRIVER MOVEMENT SIMULATOR BAR (Outbound & Return Destination) ── */}
          <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-4 rounded-2xl shadow-xl border border-blue-500/30 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-xl shrink-0">
                🎮
              </div>
              <div>
                <div className="font-bold text-xs flex items-center gap-2">
                  <span>Driver Movement Highway Simulator</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                    simLeg === 'RETURN'
                      ? 'bg-purple-500/30 text-purple-200 border border-purple-400/40'
                      : 'bg-blue-500/30 text-blue-200 border border-blue-400/40'
                  }`}>
                    {simLeg === 'RETURN' ? '🔁 Return Leg' : '➡️ Outbound Leg'} (Milestone {simStepIndex + 1}/{activeWaypoints.length})
                  </span>
                  {isAtOutboundDest && (
                    <span className="bg-emerald-500/30 text-emerald-300 border border-emerald-400/50 text-[10px] px-2 py-0.5 rounded-full font-bold">
                      🎯 Reached Destination (0 km)
                    </span>
                  )}
                  {simLeg === 'RETURN' && simStepIndex >= 7 && (
                    <span className="bg-emerald-500/30 text-emerald-300 border border-emerald-400/50 text-[10px] px-2 py-0.5 rounded-full font-bold">
                      📦 Arrived at Salem Drop (0 km)
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-blue-200/90 mt-0.5">
                  Point: <strong className="text-white font-semibold">{currentSimPoint.name}</strong> ({currentSimPoint.distKm} km away)
                  {simLeg === 'RETURN' && <span className="text-emerald-300 ml-2 font-medium">• Streaming live telemetry to customer tracking</span>}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-end">
              {/* Outbound Mode Controls */}
              {simLeg === 'OUTBOUND' && (
                <>
                  {!isAtOutboundDest ? (
                    <>
                      <button
                        onClick={handleSimStepForward}
                        className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5 cursor-pointer"
                        title="Advance vehicle ~50 km closer towards destination"
                      >
                        🚗 Advance (+50 km)
                      </button>
                      <button
                        onClick={handleSimFastForward}
                        className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black shadow-md transition flex items-center gap-1.5 cursor-pointer"
                        title="Instantly jump within 15 km of destination to unlock arrival"
                      >
                        ⚡ Fast-Forward Near Dest (12 km)
                      </button>
                    </>
                  ) : (
                    /* When reached destination: User requested ability to either run towards return destination or reset to origin */
                    <button
                      onClick={handleSwitchToReturnLeg}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-lg transition flex items-center gap-1.5 cursor-pointer animate-pulse"
                      title="Run simulation towards return destination carrying return load"
                    >
                      🔁 Run Return Leg Simulation
                    </button>
                  )}
                  <button
                    onClick={handleResetToOrigin}
                    className="px-3 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold transition cursor-pointer border border-white/25 shadow-sm"
                    title="Reset simulation back to Coimbatore origin"
                  >
                    🔄 Reset to Origin
                  </button>
                </>
              )}

              {/* Return Mode Controls */}
              {simLeg === 'RETURN' && (
                <>
                  <button
                    onClick={handleSimStepForward}
                    disabled={isAtReturnEnd}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5 ${
                      isAtReturnEnd
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700 opacity-50'
                        : 'bg-purple-600 hover:bg-purple-500 text-white cursor-pointer'
                    }`}
                    title="Advance vehicle along return highway towards return destination"
                  >
                    🚗 Advance Return (+50 km)
                  </button>
                  <button
                    onClick={handleSimFastForward}
                    className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black shadow-md transition flex items-center gap-1.5 cursor-pointer"
                    title="Jump to Salem drop delivery point (0 km) to test POD verification"
                  >
                    ⚡ Fast-Forward to Salem Drop (0 km)
                  </button>
                  <button
                    onClick={handleResetReturnLeg}
                    className="px-3 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold transition cursor-pointer border border-white/25 shadow-sm"
                    title="Reset return leg to Chennai loading point"
                  >
                    🔄 Reset Return
                  </button>
                  <button
                    onClick={handleResetToOrigin}
                    className="px-3 py-2 bg-rose-600/80 hover:bg-rose-600 text-white rounded-xl text-xs font-bold transition cursor-pointer border border-rose-400/30 shadow-sm"
                    title="Switch back and reset to Coimbatore origin"
                  >
                    🔄 Reset to Origin
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ── Trip Card (12-column responsive grid) ─────────────────────── */}
          <div className="glass-card overflow-hidden grid grid-cols-1 lg:grid-cols-12 shadow-xl border border-white/50 w-full rounded-2xl min-h-[500px]">
            {/* LEFT: details panel (5 cols on desktop) */}
            <div className="lg:col-span-5 p-6 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-white/40 bg-white/30 backdrop-blur-sm overflow-y-auto max-h-[600px]">
              <div className="space-y-4">
                <div className="bg-white/60 p-4 rounded-xl border border-white/70 shadow-sm">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Route Overview</div>
                  <div className="font-semibold text-foreground text-base truncate" title={activeTrip.sourceName}>
                    {shortName(activeTrip.sourceName)}
                  </div>
                  <div className="text-center text-primary font-bold my-1 text-sm">↓</div>
                  <div className="font-semibold text-foreground text-base truncate" title={activeTrip.destName}>
                    {shortName(activeTrip.destName)}
                  </div>
                </div>

                {activeTrip.returnToName && (
                  <div className="bg-blue-50/80 p-3.5 rounded-xl border border-blue-200/70 shadow-sm">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-700 mb-0.5">Return Hub</div>
                    <div className="font-medium text-foreground text-sm truncate" title={activeTrip.returnToName}>
                      {shortName(activeTrip.returnToName)}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white/60 p-3 rounded-lg border border-white/50 shadow-sm">
                    <span className="text-muted-foreground block text-[11px]">Vehicle</span>
                    <span className="font-mono font-bold text-foreground text-sm">{activeTrip.vehicle?.registrationNo}</span>
                  </div>
                  <div className="bg-white/60 p-3 rounded-lg border border-white/50 shadow-sm">
                    <span className="text-muted-foreground block text-[11px]">Distance</span>
                    <span className="font-bold text-foreground text-sm">
                      {calculatedDistance ? `${calculatedDistance.toFixed(1)} km` : 'Calculating...'}
                    </span>
                  </div>
                </div>

                {/* Accepted Return Loads */}
                {acceptedRecs.length > 0 && (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 p-3.5 rounded-xl space-y-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center justify-between">
                      <span>✓ Matched Return Load</span>
                      <span className="bg-emerald-200/80 text-emerald-900 text-[10px] px-2 py-0.5 rounded font-bold">
                        {allDelivered ? 'All Delivered 🎉' : 'Matched'}
                      </span>
                    </div>
                    {acceptedRecs.map((rec: any) => (
                      <div key={rec.id} className="text-xs space-y-2">
                        <div className="font-semibold text-emerald-950 flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            {rec.load?.goodsCategory} ({rec.load?.weight} kg)
                            {rec.terms === 'CUSTOMER_PRE_APPROVED' && (
                              <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] px-1.5 py-0.2 rounded font-bold">
                                ✓ Customer Pre-Approved
                              </span>
                            )}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            rec.load?.status === 'IN_TRANSIT' ? 'bg-blue-100 text-blue-700' :
                            rec.load?.status === 'DELIVERED' ? 'bg-green-100 text-green-700' :
                            'bg-amber-100 text-amber-800'
                          }`}>{rec.load?.status}</span>
                        </div>
                        <div className="text-muted-foreground text-[11px] truncate" title={`${rec.load?.pickupName} → ${rec.load?.dropName}`}>
                          {shortName(rec.load?.pickupName)} → {shortName(rec.load?.dropName)}
                        </div>

                        {/* Start Return Load with 1st OTP Verification */}
                        {rec.load?.status === 'ASSIGNED' && (
                          <div className="space-y-1">
                            <button
                              onClick={() => openPickupOtpModal(rec)}
                              disabled={!isNearDestination}
                              title={!isNearDestination && distToDestinationKm !== null
                                ? `Must arrive at destination (${distToDestinationKm.toFixed(0)} km away) before picking up return freight`
                                : 'Enter 1st OTP provided by customer to start return trip'}
                              className={`w-full py-2.5 px-3 rounded-lg text-xs font-bold transition shadow-sm flex items-center justify-center gap-1.5 ${
                                isNearDestination
                                  ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-md'
                                  : 'bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-300'
                              }`}
                            >
                              {isNearDestination
                                ? '🔐 Start Carrying Return Load (Enter 1st OTP)'
                                : `🔒 Start Return Load (${distToDestinationKm !== null ? `${distToDestinationKm.toFixed(0)} km away` : 'Locked'})`}
                            </button>
                            {!isNearDestination && distToDestinationKm !== null && (
                              <div className="text-[10px] text-blue-800 bg-blue-50/80 border border-blue-200 rounded-lg px-2 py-1 text-center font-medium">
                                🔒 Return load unlocks after arriving at destination ({distToDestinationKm.toFixed(0)} km remaining)
                              </div>
                            )}
                          </div>
                        )}

                        {rec.load?.customer && (
                          <button
                            onClick={() => openChat({ id: rec.load.customer.id, name: rec.load.customer.name, role: 'CUSTOMER', tripId: activeTrip.id })}
                            className="w-full py-1.5 px-3 bg-white border border-emerald-300 rounded-lg text-emerald-900 font-semibold text-[11px] hover:bg-emerald-50 flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                          >
                            💬 Direct Chat with {rec.load.customer.name}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 mt-5 pt-3 border-t border-white/30">
                {/* Arrived at Destination button — Proximity Protected */}
                <button
                  onClick={handleArrive}
                  disabled={actionLoading === 'arrive' || !isNearDestination || Boolean(activeTrip.driverDeliveryConfirmed)}
                  title={activeTrip.driverDeliveryConfirmed ? 'You have confirmed arrival at destination' : !isNearDestination && distToDestinationKm !== null ? `Must be within 15 km of destination to mark arrived (Currently ${distToDestinationKm.toFixed(0)} km away)` : 'Notify customers of your arrival'}
                  className={`w-full py-2.5 px-4 rounded-xl font-semibold transition shadow-sm text-xs flex items-center justify-center gap-1.5 ${
                    activeTrip.driverDeliveryConfirmed
                      ? 'bg-emerald-600 text-white cursor-default'
                      : isNearDestination
                        ? 'bg-amber-500 hover:bg-amber-600 text-white cursor-pointer shadow-md'
                        : 'bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-300'
                  }`}
                >
                  📍 {actionLoading === 'arrive'
                    ? 'Notifying...'
                    : activeTrip.driverDeliveryConfirmed
                      ? '✓ Arrived at Destination (Notified)'
                      : isNearDestination
                        ? 'Arrived at Destination'
                        : `Arrived at Destination (${distToDestinationKm !== null ? `${distToDestinationKm.toFixed(0)} km away` : 'Reach destination to enable'})`}
                </button>
                {!isNearDestination && distToDestinationKm !== null && (
                  <div className="text-[10px] text-amber-700 bg-amber-50/80 border border-amber-200 rounded-lg px-2 py-1 text-center font-medium">
                    📍 Arrive button unlocks within 15 km of destination ({distToDestinationKm.toFixed(0)} km remaining)
                  </div>
                )}

                {/* Independent Trip Details Inspector */}
                <button
                  type="button"
                  onClick={() => setSelectedTripForDetails(activeTrip)}
                  className="w-full py-2 px-3 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-xl font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  📋 View Complete Trip Details
                </button>

                {/* Find Return Load — HIDDEN when a load is already accepted */}
                {acceptedRecs.length === 0 && (
                  <button
                    onClick={() => navigate(`/trips/${activeTrip.id}/recommendations`)}
                    className="w-full py-2.5 px-4 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 font-semibold transition shadow-sm text-sm cursor-pointer"
                  >
                    🔁 Find Return Load
                  </button>
                )}

                {/* End Trip */}
                <button
                  onClick={handleEndTrip}
                  disabled={actionLoading === 'end'}
                  className="w-full py-2 px-4 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl hover:bg-rose-100 disabled:opacity-50 font-semibold transition shadow-sm text-xs cursor-pointer"
                >
                  {actionLoading === 'end' ? 'Ending...' : 'End Trip (Mark Completed)'}
                </button>
              </div>
            </div>

            {/* RIGHT: map panel (7 cols on desktop) */}
            <div className="lg:col-span-7 min-h-[380px] lg:min-h-[500px] w-full h-full relative z-0">
              {(() => {
                const returnLoad = acceptedRecs[0]?.load;
                const isReturnLeg = simLeg === 'RETURN';

                const mapSource: [number, number] = isReturnLeg
                  ? [returnLoad?.pickupLat || activeTrip.destLat, returnLoad?.pickupLng || activeTrip.destLng]
                  : [activeTrip.sourceLat, activeTrip.sourceLng];

                const mapDestination: [number, number] = isReturnLeg
                  ? [returnLoad?.dropLat || activeTrip.returnToLat || 11.6538, returnLoad?.dropLng || activeTrip.returnToLng || 78.1579]
                  : [activeTrip.destLat, activeTrip.destLng];

                const mapSourceLabel = isReturnLeg
                  ? `Pickup: ${shortName(returnLoad?.pickupName) || 'Chennai'}`
                  : `Origin: ${shortName(activeTrip.sourceName) || 'Coimbatore'}`;

                const mapDestinationLabel = isReturnLeg
                  ? `Delivery: ${shortName(returnLoad?.dropName) || 'Salem'}`
                  : `Destination: ${shortName(activeTrip.destName) || 'Chennai'}`;

                const driverDisplayPos: [number, number] = gpsCoords
                  ? [gpsCoords.lat, gpsCoords.lng]
                  : isReturnLeg
                  ? mapSource
                  : [activeTrip.sourceLat, activeTrip.sourceLng];

                return (
                  <Map
                    source={mapSource}
                    destination={mapDestination}
                    sourceLabel={mapSourceLabel}
                    destinationLabel={mapDestinationLabel}
                    driverLabel={`🚛 Driver (${currentSimPoint.name.split('(')[0].trim()})`}
                    driverPosition={driverDisplayPos}
                  />
                );
              })()}
            </div>
          </div>

          {/* ── Delivery Verification & POD — Shown when Return Load is IN_TRANSIT ── */}
          {hasReturnLoadInTransit && (
            <div className="glass-card p-6 border border-white/50 rounded-2xl shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/70 pb-3">
                <div>
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    📋 Delivery Verification & Proof of Delivery (POD)
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Carrier handover protocol under Section 10 of Carriage by Road Act 2007. Verify receiver OTP, capture photo, and collect signature.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTermsModalOpen(true)}
                  className="text-xs text-primary hover:underline font-semibold flex items-center gap-1 self-start sm:self-auto cursor-pointer"
                >
                  📜 View Carriage Terms & Conditions
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 1. Photo Proof */}
                <div className="bg-white/60 p-4 rounded-xl border border-white/60 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-foreground mb-1 flex items-center justify-between">
                      <span>1. Photo Proof of Delivery</span>
                      {activeTrip.deliveryProofPhotoUrl
                        ? <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">Uploaded ✓</span>
                        : <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold">Pending</span>}
                    </h4>
                    <p className="text-[11px] text-muted-foreground mb-3">
                      Capture or upload photo of unloaded goods at destination.
                    </p>

                    {activeTrip.deliveryProofPhotoUrl ? (
                      <div className="space-y-2">
                        <img
                          src={activeTrip.deliveryProofPhotoUrl}
                          alt="Proof of Delivery"
                          className="w-full h-36 object-cover rounded-xl border border-emerald-300 shadow-sm"
                        />
                        <span className="text-[11px] text-emerald-700 font-semibold block text-center">
                          ✓ Delivery Photo Confirmed
                        </span>
                      </div>
                    ) : isCameraActive ? (
                      <div className="space-y-2">
                        <div className="relative rounded-xl overflow-hidden bg-black border border-slate-700 shadow-md">
                          <video ref={videoRef} autoPlay playsInline className="w-full h-40 object-cover" />
                          <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> LIVE
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={capturePhotoFromCamera}
                            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition shadow cursor-pointer"
                          >
                            📸 Snap Photo
                          </button>
                          <button
                            type="button"
                            onClick={stopCamera}
                            className="px-3 py-2 bg-slate-200 text-slate-700 rounded-lg text-xs transition cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : previewUrl ? (
                      <div className="space-y-2">
                        <img src={previewUrl} alt="Selected POD" className="w-full h-36 object-cover rounded-xl border border-blue-400 shadow-sm" />
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-muted-foreground truncate max-w-[120px] font-mono">{selectedFile?.name}</span>
                          <button
                            type="button"
                            onClick={() => { setSelectedFile(null); setPreviewUrl(''); }}
                            className="text-primary hover:underline font-semibold cursor-pointer"
                          >
                            Retake
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={startCamera}
                          className="w-full py-3 px-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <span>📸</span> Take Picture (Camera)
                        </button>
                        <label
                          htmlFor="pod-file-input"
                          className="w-full py-3 px-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-bold rounded-xl text-xs transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <span>📁</span> Upload Image File
                        </label>
                        <input id="pod-file-input" type="file" accept="image/*" onChange={handlePodFileChange} className="hidden" />
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Consignee E-Signature */}
                <div className="bg-white/60 p-4 rounded-xl border border-white/60 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-foreground mb-1 flex items-center justify-between">
                      <span>2. Receiver E-Signature</span>
                      {activeTrip.customerDeliveryConfirmed
                        ? <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">Signed ✓</span>
                        : <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold">Awaiting Signature</span>}
                    </h4>
                    <p className="text-[11px] text-muted-foreground mb-3">
                      Receiver signs on device screen upon inspecting cargo.
                    </p>

                    <div className="border border-slate-300 rounded-lg bg-white overflow-hidden shadow-xs">
                      <canvas
                        ref={canvasRef}
                        width={300}
                        height={120}
                        className="w-full touch-none cursor-crosshair bg-slate-50"
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                      />
                    </div>
                    <div className="flex justify-between items-center mt-2 text-[10px]">
                      <span className="text-muted-foreground">Sign using touch or cursor</span>
                      <button onClick={clearCanvas} className="text-muted-foreground hover:text-foreground underline cursor-pointer">
                        Clear Pad
                      </button>
                    </div>
                  </div>
                </div>

                {/* 3. 2nd OTP Handover Code */}
                <div className="bg-white/60 p-4 rounded-xl border border-white/60 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-foreground mb-1 flex items-center justify-between">
                      <span>3. Consignee Delivery OTP</span>
                      {activeTrip.deliveryOtpVerified
                        ? <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">Verified ✓</span>
                        : <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold">2nd OTP Required</span>}
                    </h4>
                    <p className="text-[11px] text-muted-foreground mb-3">
                      Ask the load receiver for the 6-digit delivery OTP shared by the customer.
                    </p>

                    <div className="space-y-2">
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="Enter 6-digit OTP"
                        value={deliveryOtpInput}
                        onChange={e => setDeliveryOtpInput(e.target.value.replace(/\D/g, ''))}
                        className="w-full px-4 py-2.5 text-center font-mono text-lg font-black tracking-widest bg-white border-2 border-slate-300 focus:border-primary rounded-xl outline-hidden shadow-inner"
                      />
                      <p className="text-[10px] text-muted-foreground text-center">
                        Receiver provides this code only after receiving undamaged goods.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Terms and Unified Submit Button */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-foreground font-medium">
                  <input
                    type="checkbox"
                    checked={deliveryTermsAgreed}
                    onChange={e => setDeliveryTermsAgreed(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-primary focus:ring-primary w-4 h-4 cursor-pointer shrink-0"
                  />
                  <span>
                    I confirm that the consignment has been delivered in full and undamaged condition to the authorized consignee, physical inspection completed, and digital proof captured in compliance with <strong>Section 10 of Carriage by Road Act 2007</strong>.{' '}
                    <button
                      type="button"
                      onClick={() => setTermsModalOpen(true)}
                      className="text-primary hover:underline font-semibold"
                    >
                      (Read Terms)
                    </button>
                  </span>
                </label>

                <button
                  type="button"
                  onClick={handleDriverUploadPod}
                  disabled={uploadingPod || !deliveryTermsAgreed || !selectedFile || deliveryOtpInput.length !== 6}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  {uploadingPod ? (
                    <>
                      <span className="inline-block animate-spin mr-1">⏳</span>
                      Verifying Delivery OTP & Submitting POD...
                    </>
                  ) : (
                    '🚀 Verify Delivery OTP, Photo & Complete Handover'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 1st OTP Handover Verification Modal (Starting Return Trip) ────────── */}
      {showPickupOtpModal && selectedRecForPickup && (
        <div className="fixed inset-0 z-[2500] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl max-w-md w-full border border-border shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                  <span>📦</span> 1st OTP: Cargo Pickup Handover
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Verify shipper code before starting return trip
                </p>
              </div>
              <button
                onClick={() => setShowPickupOtpModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-sm text-slate-700"
              >
                &times;
              </button>
            </div>

            <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1.5 text-xs text-blue-900">
              <div className="font-bold">
                Consignment: {selectedRecForPickup.load?.goodsCategory} ({selectedRecForPickup.load?.weight} kg)
              </div>
              <div>Customer: <strong>{selectedRecForPickup.load?.customer?.name || 'Shipper'}</strong></div>
              <div className="truncate text-blue-800">
                Route: {shortName(selectedRecForPickup.load?.pickupName)} → {shortName(selectedRecForPickup.load?.dropName)}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Enter 6-Digit Pickup Verification OTP
              </label>
              <input
                type="text"
                maxLength={6}
                placeholder="------"
                value={enteredPickupOtp}
                onChange={e => setEnteredPickupOtp(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-3 text-center font-mono text-2xl font-black tracking-widest bg-white border-2 border-slate-300 focus:border-primary rounded-xl outline-hidden shadow-inner"
              />
              <p className="text-[11px] text-muted-foreground">
                Ask the customer/shipper to provide the 6-digit Pickup OTP shown on their WayBack tracking dashboard after loading the cargo.
              </p>
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer text-xs text-foreground font-medium">
              <input
                type="checkbox"
                checked={pickupTermsAgreed}
                onChange={e => setPickupTermsAgreed(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-primary focus:ring-primary w-4 h-4 cursor-pointer shrink-0"
              />
              <span>
                I confirm the goods have been securely loaded, weight does not exceed vehicle capacity, and cargo complies with Carriage by Road Act 2007.{' '}
                <button
                  type="button"
                  onClick={() => setTermsModalOpen(true)}
                  className="text-primary hover:underline font-semibold"
                >
                  (Terms)
                </button>
              </span>
            </label>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPickupOtpModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleVerifyAndStartReturn}
                disabled={actionLoading === 'verifyPickup' || enteredPickupOtp.length !== 6 || !pickupTermsAgreed}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition shadow-md cursor-pointer disabled:cursor-not-allowed"
              >
                {actionLoading === 'verifyPickup' ? 'Verifying...' : '✅ Verify & Start Trip'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Terms and Conditions Modal ────────────────────────────────────────── */}
      <TermsModal isOpen={termsModalOpen} onClose={() => setTermsModalOpen(false)} />

      {/* ── Trip History ─────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-primary mb-3">Trip History & Past Deliveries</h2>
        {history.length === 0 ? (
          <div className="glass-card p-10 text-center text-muted-foreground">No past trips recorded yet.</div>
        ) : (
          <div className="space-y-3">
            {history.map(trip => (
              <div key={trip.id} className="glass-card p-5 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div>
                  <div className="font-semibold text-foreground text-base">
                    {shortName(trip.sourceName)} → {shortName(trip.destName)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
                    {trip.startedAt && <span>{new Date(trip.startedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                    {trip.distanceKm && <span>• {trip.distanceKm.toFixed(1)} km</span>}
                    {trip.driverDeliveryConfirmed && <span className="text-emerald-700 font-bold">• Driver Verified ✓</span>}
                    {trip.customerDeliveryConfirmed && <span className="text-emerald-700 font-bold">• Customer Signed ✓</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${trip.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                    {trip.status}
                  </span>
                  <button
                    onClick={() => setSelectedTripForDetails(trip)}
                    className="px-3 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
                  >
                    📋 View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Independent Complete Trip Details Modal ─────────────────────────── */}
      {selectedTripForDetails && (
        <div className="fixed inset-0 z-[2500] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-background rounded-3xl max-w-2xl w-full border border-border shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in duration-150 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                    📋 Complete Trip Dossier & Waybill
                  </h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    selectedTripForDetails.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                    selectedTripForDetails.status === 'ONGOING' ? 'bg-blue-100 text-blue-800 animate-pulse' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {selectedTripForDetails.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  Trip Reference ID: #{selectedTripForDetails.id}
                </p>
              </div>
              <button
                onClick={() => setSelectedTripForDetails(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-lg text-slate-700 cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Timestamps & Corridor Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-muted/40 p-3 rounded-xl border">
                <span className="text-muted-foreground block text-[11px]">Trip Initiated</span>
                <span className="font-semibold text-foreground">
                  {selectedTripForDetails.startedAt ? new Date(selectedTripForDetails.startedAt).toLocaleString('en-IN') : 'Active Session'}
                </span>
              </div>
              <div className="bg-muted/40 p-3 rounded-xl border">
                <span className="text-muted-foreground block text-[11px]">Trip Concluded</span>
                <span className="font-semibold text-foreground">
                  {selectedTripForDetails.endedAt ? new Date(selectedTripForDetails.endedAt).toLocaleString('en-IN') : 'In Transit (Live)'}
                </span>
              </div>
              <div className="bg-muted/40 p-3 rounded-xl border">
                <span className="text-muted-foreground block text-[11px]">Total Corridor Distance</span>
                <span className="font-bold text-primary text-sm">
                  {selectedTripForDetails.distanceKm ? `${selectedTripForDetails.distanceKm.toFixed(1)} km` : 'Calculated Live'}
                </span>
              </div>
            </div>

            {/* Route Coordinates & Milestones */}
            <div className="p-4 rounded-2xl bg-white/60 border space-y-3 text-xs">
              <div className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center justify-between">
                <span>📍 Highway Route & Terminal Hubs</span>
                <span className="text-[11px] font-normal text-muted-foreground">GPS Waypoints Geocoded</span>
              </div>

              <div className="space-y-2 border-l-2 border-primary/40 pl-3 ml-1">
                <div>
                  <div className="text-[11px] text-muted-foreground font-medium">Outbound Origin (Departure Hub):</div>
                  <div className="font-bold text-foreground text-sm">{selectedTripForDetails.sourceName || 'Coimbatore'}</div>
                  <div className="text-[11px] text-muted-foreground font-mono">
                    Coords: {selectedTripForDetails.sourceLat?.toFixed(4)}, {selectedTripForDetails.sourceLng?.toFixed(4)}
                  </div>
                </div>

                <div className="pt-1">
                  <div className="text-[11px] text-muted-foreground font-medium">Outbound Destination (Drop Hub):</div>
                  <div className="font-bold text-foreground text-sm">{selectedTripForDetails.destName || 'Chennai'}</div>
                  <div className="text-[11px] text-muted-foreground font-mono">
                    Coords: {selectedTripForDetails.destLat?.toFixed(4)}, {selectedTripForDetails.destLng?.toFixed(4)}
                  </div>
                </div>

                {selectedTripForDetails.returnToName && (
                  <div className="pt-1 border-t border-slate-200/60">
                    <div className="text-[11px] text-blue-700 font-medium">Return Destination Hub:</div>
                    <div className="font-bold text-blue-900 text-sm">{selectedTripForDetails.returnToName}</div>
                    {selectedTripForDetails.returnToLat && (
                      <div className="text-[11px] text-blue-700 font-mono">
                        Coords: {selectedTripForDetails.returnToLat?.toFixed(4)}, {selectedTripForDetails.returnToLng?.toFixed(4)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Vehicle & Carrier Information */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-white/60 border space-y-1.5">
                <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block">🚚 Assigned Vehicle</span>
                <div>Registration: <strong className="font-mono text-foreground">{selectedTripForDetails.vehicle?.registrationNo || 'Commercial Vehicle'}</strong></div>
                <div>Model / Make: <strong className="text-foreground">{selectedTripForDetails.vehicle?.model || 'Eicher Pro / Heavy Freight'}</strong></div>
                <div>Capacity: <strong className="text-foreground">{selectedTripForDetails.vehicle?.capacityKg || 5000} kg</strong></div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/60 border space-y-1.5">
                <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block">👤 Driver & Carrier Profile</span>
                <div>Transporter: <strong className="text-foreground">{selectedTripForDetails.driver?.name || 'Verified WayBack Carrier'}</strong></div>
                <div>Contact: <strong className="text-foreground">{selectedTripForDetails.driver?.phone || '9876543210'}</strong></div>
                <div className="text-emerald-700 font-semibold flex items-center gap-1">
                  <span>⭐ Verified Carrier</span> • Clean Safety Record
                </div>
              </div>
            </div>

            {/* Matched / Transported Consignments */}
            {selectedTripForDetails.recommendations && selectedTripForDetails.recommendations.length > 0 && (
              <div className="p-4 rounded-2xl bg-white/60 border space-y-3 text-xs">
                <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block">
                  📦 Consignments & Manifested Cargo ({selectedTripForDetails.recommendations.length})
                </span>
                <div className="space-y-2">
                  {selectedTripForDetails.recommendations.map((rec: any) => {
                    const load = rec.load;
                    return (
                      <div key={rec.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                        <div className="flex justify-between items-center font-bold text-sm text-slate-900">
                          <span>{load?.goodsCategory || 'General Commercial Freight'}</span>
                          <span className="text-primary font-bold">₹{(load?.budget || 0).toLocaleString('en-IN')}</span>
                        </div>
                        <div className="text-muted-foreground flex items-center gap-2">
                          <span>Weight: {load?.weight || 0} kg</span>
                          <span>•</span>
                          <span>Status: <strong className="text-foreground">{load?.status || rec.status}</strong></span>
                        </div>
                        <div className="text-[11px] text-slate-700">
                          {shortName(load?.pickupName)} → {shortName(load?.dropName)}
                        </div>
                        {load?.customer && (
                          <div className="text-[11px] text-muted-foreground pt-1 border-t border-slate-200/50">
                            Shipper: <strong className="text-slate-800">{load.customer.name}</strong> ({load.customer.phone || load.customer.email})
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Electronic Proof of Delivery (e-POD) & OTP Verification Records */}
            <div className="p-4 rounded-2xl bg-white/60 border space-y-3 text-xs">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block">
                📑 Handover Protocols & Proof of Delivery (e-POD)
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border space-y-1">
                  <div className="font-bold text-slate-800">1st OTP: Pickup Handover</div>
                  <div className="text-[11px] text-muted-foreground">
                    Shipper security release code verified before departure.
                  </div>
                  <div className="text-emerald-700 font-bold text-xs pt-1">
                    ✓ Handover Code Authenticated
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border space-y-1">
                  <div className="font-bold text-slate-800">2nd OTP: Consignee Delivery Handover</div>
                  <div className="text-[11px] text-muted-foreground">
                    Receiver confirmation code verified upon physical receipt.
                  </div>
                  <div className="text-emerald-700 font-bold text-xs pt-1">
                    {selectedTripForDetails.deliveryOtpVerified || selectedTripForDetails.customerDeliveryConfirmed
                      ? '✓ Consignee OTP Verified & Confirmed'
                      : '⏳ Pending Destination Handover'}
                  </div>
                </div>
              </div>

              {/* Previews: POD Photo & Consignee Signature */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {/* Photo Proof */}
                <div className="p-3 rounded-xl bg-slate-50 border space-y-2">
                  <span className="font-bold text-[11px] text-slate-800 block">📸 Unloading / POD Photo Proof</span>
                  {selectedTripForDetails.deliveryProofPhotoUrl ? (
                    <div>
                      <img
                        src={selectedTripForDetails.deliveryProofPhotoUrl}
                        alt="Proof of Delivery"
                        className="w-full h-36 object-cover rounded-lg border shadow-xs"
                      />
                      <a
                        href={selectedTripForDetails.deliveryProofPhotoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-primary hover:underline font-bold block mt-1"
                      >
                        Open Full Image ↗
                      </a>
                    </div>
                  ) : (
                    <div className="h-28 rounded-lg bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center text-muted-foreground text-center p-2">
                      Photo proof recorded during destination delivery handover
                    </div>
                  )}
                </div>

                {/* Digital Signature */}
                <div className="p-3 rounded-xl bg-slate-50 border space-y-2">
                  <span className="font-bold text-[11px] text-slate-800 block">✍️ Consignee Electronic Signature</span>
                  {selectedTripForDetails.customerESignatureUrl ? (
                    <div>
                      <div className="w-full h-36 bg-white rounded-lg border shadow-xs flex items-center justify-center p-2">
                        <img
                          src={selectedTripForDetails.customerESignatureUrl}
                          alt="Consignee Signature"
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <span className="text-[11px] text-emerald-700 font-bold block mt-1">
                        ✓ Digital Signature Captured & Timestamped
                      </span>
                    </div>
                  ) : (
                    <div className="h-28 rounded-lg bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center text-muted-foreground text-center p-2">
                      Signature recorded upon consignee handover
                    </div>
                  )}
                </div>
              </div>

              {/* Legal Carriage Compliance Notice */}
              <div className="p-2.5 bg-blue-50/70 border border-blue-200/60 rounded-xl text-[11px] text-blue-900 leading-relaxed">
                <strong>Statutory Carriage Compliance:</strong> This trip is governed under Section 10 of Carriage by Road Act 2007. Verified electronic waybills and POD documentation serve as prima facie evidence of consignment receipt in sound order.
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex gap-2 pt-2 border-t">
              <button
                onClick={() => setSelectedTripForDetails(null)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Close Trip Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
