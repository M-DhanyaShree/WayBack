import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { socket } from '../lib/socket';
import { fetchApi } from '../lib/api';
import Map from '../components/Map';
import { useChat } from '../context/ChatContext';
import TermsModal from '../components/TermsModal';

export default function TrackLoad() {
  const { id } = useParams();
  const { openChat } = useChat();
  const [load, setLoad] = useState<any>(null);
  const [paymentSummary, setPaymentSummary] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<[number, number] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Terms Modal State
  const [termsModalOpen, setTermsModalOpen] = useState(false);

  // Payment Modal State (3-Stage Milestone Escrow)
  const [showPayModal, setShowPayModal] = useState(false);
  const [payMilestone, setPayMilestone] = useState<'ASSURANCE' | 'ADVANCE' | 'BALANCE'>('ASSURANCE');
  const [selectedAdvancePct, setSelectedAdvancePct] = useState(30); // default 30% advance
  const [payMethod, setPayMethod] = useState<'UPI' | 'NETBANKING' | 'CARD'>('UPI');
  const [upiId, setUpiId] = useState('customer@okhdfcbank');
  const [paying, setPaying] = useState(false);
  const [paySuccessMsg, setPaySuccessMsg] = useState('');

  const fetchLoadData = async () => {
    try {
      const [loadRes, payRes] = await Promise.all([
        fetchApi(`/loads/${id}`),
        fetchApi(`/payments/load/${id}/summary`).catch(() => ({ data: null })),
      ]);
      setLoad(loadRes.data.load);
      if (payRes?.data) setPaymentSummary(payRes.data);
      
      // Initialize driver location if not yet streamed
      if (!driverLocation && loadRes.data.load) {
        if (loadRes.data.load.pickupLat && loadRes.data.load.pickupLng) {
          setDriverLocation([loadRes.data.load.pickupLat, loadRes.data.load.pickupLng]);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load tracking data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoadData();

    socket.connect();
    socket.emit('join_tracking', { loadId: id });

    socket.on('location_updated', (data: { lat: number; lng: number }) => {
      setDriverLocation([data.lat, data.lng]);
    });

    socket.on('status_updated', (data: any) => {
      setLoad((prev: any) => ({ ...prev, status: data.status }));
    });

    return () => {
      socket.emit('leave_tracking', { loadId: id });
      socket.off('location_updated');
      socket.off('status_updated');
    };
  }, [id]);

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

  const openPaymentModal = (type: 'ASSURANCE' | 'ADVANCE' | 'BALANCE') => {
    setPayMilestone(type);
    setShowPayModal(true);
  };

  const handleProcessPayment = async () => {
    if (!load) return;
    setPaying(true);
    try {
      const totalBudget = load.budget || 5000;
      let targetAmount = 0;

      if (payMilestone === 'ASSURANCE') {
        targetAmount = Math.round(totalBudget * 0.10);
      } else if (payMilestone === 'ADVANCE') {
        const fullAdvance = Math.round(totalBudget * (selectedAdvancePct / 100));
        const alreadyPaid = paymentSummary?.totalPaid || 0;
        targetAmount = Math.max(0, fullAdvance - alreadyPaid) || fullAdvance;
      } else if (payMilestone === 'BALANCE') {
        targetAmount = paymentSummary?.balanceDue || Math.round(totalBudget * 0.70);
      }

      const res = await fetchApi('/payments', {
        method: 'POST',
        body: JSON.stringify({
          loadId: load.id,
          amount: targetAmount,
          paymentType: payMilestone,
          advancePercent: payMilestone === 'ADVANCE' ? selectedAdvancePct : undefined,
          method: payMethod,
          upiId: payMethod === 'UPI' ? upiId : undefined,
        }),
      });

      const label = 
        payMilestone === 'ASSURANCE' ? '10% Assurance Deposit' :
        payMilestone === 'ADVANCE' ? `${selectedAdvancePct}% Advance` : 'Delivery Balance';

      setPaySuccessMsg(`🎉 ₹${res.data.amount.toLocaleString('en-IN')} ${label} paid successfully via ${payMethod}!`);
      setShowPayModal(false);
      fetchLoadData();
    } catch (err: any) {
      alert(err.message || 'Payment failed. Please try again.');
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-65px)] items-center justify-center">
        <div className="glass-card p-8 text-center text-muted-foreground animate-pulse">
          🚚 Connecting to truck GPS live feed...
        </div>
      </div>
    );
  }

  if (error || !load) {
    return (
      <div className="p-8 max-w-lg mx-auto mt-12 glass-card border border-rose-200 text-center">
        <h2 className="text-xl font-bold text-rose-600 mb-2">Tracking Unavailable</h2>
        <p className="text-sm text-muted-foreground mb-4">{error || 'Consignment not found'}</p>
        <Link to="/loads" className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold">
          Back to Loads
        </Link>
      </div>
    );
  }

  // Financial Figures
  const totalBudget = load.budget || 5000;
  const assuranceAmount = Math.round(totalBudget * 0.10);
  const totalPaid = paymentSummary?.totalPaid || 0;
  const isAssurancePaid = totalPaid >= assuranceAmount;
  const balanceDue = paymentSummary?.balanceDue ?? (totalBudget - totalPaid);
  const isFullyPaid = balanceDue === 0;

  const matchedRec = load.recommendations?.[0];
  const driver = matchedRec?.trip?.driver;
  const vehicle = matchedRec?.trip?.vehicle;

  return (
    <div className="page-wrapper max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Top Header */}
      <div className="glass-card p-5 border border-white/60 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-2xl">🚚</span>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Live Shipment Tracking & Milestones
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-sm">
                <span className="font-semibold text-primary">{load.goodsCategory}</span>
                <span className="text-muted-foreground">•</span>
                <span className="font-medium text-muted-foreground">{load.weight} kg</span>
                <span className="text-muted-foreground">•</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                  load.status === 'IN_TRANSIT' ? 'bg-emerald-100 text-emerald-800 animate-pulse' :
                  load.status === 'DELIVERED' ? 'bg-blue-100 text-blue-800' :
                  'bg-amber-100 text-amber-800'
                }`}>
                  {load.status === 'IN_TRANSIT' ? '🟢 IN TRANSIT (LIVE GPS)' : load.status}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: `Tracking ${load.goodsCategory}`,
                  text: `Track shipment from ${shortName(load.pickupName)} to ${shortName(load.dropName)} live on WayBack:`,
                  url: window.location.href,
                }).catch(() => {});
              } else {
                navigator.clipboard.writeText(window.location.href);
                alert('📋 Tracking link copied to clipboard!');
              }
            }}
            className="px-4 py-2 border border-slate-300 bg-white/80 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-xs transition flex items-center gap-2 shadow-sm"
          >
            🔗 Share Tracking
          </button>
          <Link
            to="/loads"
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition shadow-sm"
          >
            ← Back to Loads
          </Link>
        </div>
      </div>

      {/* ⚠️ Stage 1 Alert: 10% Mandatory Assurance Deposit Banner */}
      {!isAssurancePaid && (
        <div className="p-4 bg-amber-500/10 border-2 border-amber-400 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm animate-pulse">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔒</span>
            <div>
              <h4 className="font-bold text-amber-900 text-sm">
                10% Booking Assurance Deposit Required (₹{assuranceAmount.toLocaleString('en-IN')})
              </h4>
              <p className="text-xs text-amber-800">
                Please pay the 10% assurance deposit before the cancellation deadline to lock the truck. If unpaid, the system will automatically re-assign the truck to another load.
              </p>
            </div>
          </div>
          <button
            onClick={() => openPaymentModal('ASSURANCE')}
            className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs whitespace-nowrap shadow transition"
          >
            ⚡ Pay ₹{assuranceAmount.toLocaleString('en-IN')} Assurance Deposit
          </button>
        </div>
      )}

      {paySuccessMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 rounded-xl text-sm flex items-center justify-between shadow-sm">
          <span>{paySuccessMsg}</span>
          <button onClick={() => setPaySuccessMsg('')} className="font-bold text-lg">&times;</button>
        </div>
      )}

      {/* 🔐 Two-Factor Cargo Handover Verification Codes (OTPs) */}
      {(load.pickupOtp || matchedRec?.pickupOtp) && (
        <div className="glass-card p-5 border-2 border-primary/20 rounded-2xl shadow-md bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-emerald-50/60 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-primary/10 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">🔐</span>
              <div>
                <h3 className="font-bold text-base text-foreground">
                  Two-Factor Cargo Handover Verification Codes (OTPs)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Statutory Cargo Handover Protocol under Carriage by Road Act 2007
                </p>
              </div>
            </div>
            <button
              onClick={() => setTermsModalOpen(true)}
              className="text-xs text-primary hover:underline font-semibold flex items-center gap-1 self-start sm:self-auto cursor-pointer"
            >
              📜 View Carriage Terms & Conditions ↗
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1st OTP: Pickup Handover Code */}
            <div className="bg-white/90 p-4 rounded-xl border border-blue-200/80 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                  <span>📦</span> 1st OTP: Pickup Handover Code
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                  load.pickupOtpVerified ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800 animate-pulse'
                }`}>
                  {load.pickupOtpVerified ? 'Verified by Driver ✓ (In Transit)' : 'Awaiting Cargo Pickup ⏳'}
                </span>
              </div>

              <div className="flex items-center justify-between bg-blue-50/60 p-3 rounded-lg border border-blue-200">
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Provide to Driver at Pickup</div>
                  <div className="font-mono text-2xl font-black text-blue-950 tracking-widest">
                    {load.pickupOtp || matchedRec?.pickupOtp || '------'}
                  </div>
                </div>
                <button
                  onClick={() => {
                    const code = load.pickupOtp || matchedRec?.pickupOtp;
                    if (code) {
                      navigator.clipboard.writeText(code);
                      alert(`📋 Pickup OTP ${code} copied to clipboard!`);
                    }
                  }}
                  className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  Copy OTP
                </button>
              </div>

              <p className="text-[11px] text-muted-foreground">
                <strong>Process:</strong> Share this 6-digit code with your driver <em>only after physical loading</em> of cargo. The driver must input this code to verify pickup and start the journey.
              </p>
            </div>

            {/* 2nd OTP: Consignee Delivery Code */}
            <div className="bg-white/90 p-4 rounded-xl border border-emerald-200/80 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                  <span>📍</span> 2nd OTP: Consignee Delivery Code
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                  load.deliveryOtpVerified ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {load.deliveryOtpVerified ? 'Delivered & Confirmed ✓' : 'Awaiting Destination Delivery ⏳'}
                </span>
              </div>

              <div className="flex items-center justify-between bg-emerald-50/60 p-3 rounded-lg border border-emerald-200">
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Share with Consignee / Receiver</div>
                  <div className="font-mono text-2xl font-black text-emerald-950 tracking-widest">
                    {load.deliveryOtp || matchedRec?.deliveryOtp || '------'}
                  </div>
                </div>
                <button
                  onClick={() => {
                    const code = load.deliveryOtp || matchedRec?.deliveryOtp;
                    if (code) {
                      navigator.clipboard.writeText(code);
                      alert(`📋 Delivery OTP ${code} copied to clipboard!`);
                    }
                  }}
                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  Copy OTP
                </button>
              </div>

              <p className="text-[11px] text-muted-foreground">
                <strong>Process:</strong> Share this code with the cargo receiver. Driver must enter this OTP alongside <em>image proof and receiver signature</em> to mark shipment delivered.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Left Map + Right Info/Milestones */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Map Container */}
        <div className="lg:col-span-8 flex flex-col h-[520px] glass-card overflow-hidden border border-white/50 shadow-md relative">
          {(() => {
            const distToDropKm = (driverLocation && load.dropLat && load.dropLng)
              ? getHaversineDist(driverLocation[0], driverLocation[1], load.dropLat, load.dropLng)
              : null;
            const hasArrivedAtDrop = distToDropKm !== null && distToDropKm <= 5;

            return (
              <>
                <Map
                  source={[load.pickupLat, load.pickupLng]}
                  destination={[load.dropLat, load.dropLng]}
                  sourceLabel={`Pickup: ${shortName(load.pickupName)}`}
                  destinationLabel={`Delivery: ${shortName(load.dropName)}`}
                  driverLabel="🚛 Live Carrier"
                  driverPosition={driverLocation}
                />

                {/* Floating GPS Indicator Pill */}
                <div className="absolute top-4 left-4 z-[1000] bg-background/95 backdrop-blur-md px-4 py-2.5 rounded-xl shadow-lg border border-white/40 flex items-center gap-3">
                  {driverLocation ? (
                    <>
                      <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-emerald-800 flex items-center gap-1.5 flex-wrap">
                          <span>📡 Driver GPS Streaming Live</span>
                          {hasArrivedAtDrop ? (
                            <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                              🎯 Arrived at Destination
                            </span>
                          ) : distToDropKm !== null ? (
                            <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-semibold">
                              📍 {distToDropKm.toFixed(0)} km to {shortName(load.dropName)?.split(',')[0]}
                            </span>
                          ) : null}
                        </div>
                        <div className="text-[11px] text-muted-foreground font-mono">
                          Lat: {driverLocation[0].toFixed(4)}, Lng: {driverLocation[1].toFixed(4)}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-3 h-3 rounded-full bg-amber-400 shrink-0" />
                      <div className="text-xs text-muted-foreground font-medium">
                        Connecting to vehicle GPS transmitter...
                      </div>
                    </>
                  )}
                </div>
              </>
            );
          })()}

          {/* Floating Route Strip */}
          <div className="absolute bottom-4 left-4 right-4 z-[1000] bg-background/95 backdrop-blur-md p-3.5 rounded-xl shadow-lg border border-white/40 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 truncate max-w-[45%]">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
              <div className="truncate">
                <div className="font-bold text-slate-800 truncate">{shortName(load.pickupName)}</div>
                <div className="text-[10px] text-muted-foreground">Pickup Point</div>
              </div>
            </div>
            <div className="text-muted-foreground font-bold px-2">➔</div>
            <div className="flex items-center gap-2 truncate max-w-[45%] text-right justify-end">
              <div className="truncate">
                <div className="font-bold text-slate-800 truncate">{shortName(load.dropName)}</div>
                <div className="text-[10px] text-muted-foreground">Delivery Destination</div>
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
            </div>
          </div>
        </div>

        {/* Right Column: Driver Card & Indian Logistics Milestones */}
        <div className="lg:col-span-4 space-y-6">
          {/* Driver & Vehicle Card */}
          <div className="glass-card p-5 border border-white/50 shadow-md bg-gradient-to-br from-white/90 to-blue-50/40">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Assigned Transporter & Vehicle
            </h3>
            
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary font-bold text-xl flex items-center justify-center border border-primary/20 shrink-0">
                {driver?.name ? driver.name[0].toUpperCase() : '🚚'}
              </div>
              <div>
                <div className="font-bold text-base text-foreground">
                  {driver?.name || 'Assigned Driver'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {vehicle ? `${vehicle.model} (${vehicle.registrationNumber || 'Commercial'})` : 'Goods Transport Vehicle'}
                </div>
                <div className="text-xs text-emerald-600 font-semibold mt-0.5">
                  ⭐ 4.9 Verified Driver • Clean Safety Record
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60">
              <a
                href={`tel:${driver?.phone || '9876543210'}`}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-sm"
              >
                📞 Call Driver
              </a>
              <button
                onClick={() =>
                  driver &&
                  openChat({
                    id: driver.id,
                    name: driver.name,
                    role: 'DRIVER',
                    tripId: matchedRec?.trip?.id || matchedRec?.tripId,
                  })
                }
                className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                💬 Direct Chat
              </button>
            </div>
          </div>

          {/* 3-Stage Milestone Lifecycle Card */}
          <div className="glass-card p-5 border border-white/50 shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Payment Milestones (Structured Escrow)
              </h3>
              <span className="text-xs font-bold text-primary">₹{totalBudget.toLocaleString('en-IN')} Total</span>
            </div>

            <div className="space-y-3 text-sm">
              {/* Stage 1: 10% Assurance Deposit */}
              <div className={`p-3 rounded-xl border transition ${
                isAssurancePaid ? 'bg-emerald-50/70 border-emerald-200' : 'bg-amber-50/70 border-amber-200'
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <span>{isAssurancePaid ? '✅' : '⏳'}</span>
                    <span>1. Booking Assurance (10%)</span>
                  </div>
                  <span className="font-bold text-xs">₹{assuranceAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {isAssurancePaid ? 'Confirmed & Locked • Assurance credited to fare' : 'Required before cancellation deadline'}
                </div>
              </div>

              {/* Stage 2: Custom Advance (10% to 40% Max) */}
              <div className={`p-3 rounded-xl border transition ${
                totalPaid >= Math.round(totalBudget * 0.30) ? 'bg-emerald-50/70 border-emerald-200' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <span>{totalPaid >= Math.round(totalBudget * 0.30) ? '✅' : '⏳'}</span>
                    <span>2. Diesel & Route Advance (10-40%)</span>
                  </div>
                  <span className="font-bold text-xs">
                    ₹{(Math.round(totalBudget * 0.30)).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {totalPaid >= Math.round(totalBudget * 0.30)
                    ? 'Diesel & toll advance released to driver wallet'
                    : 'Choose 10% to 40% advance to release diesel & tolls'}
                </div>
                {isAssurancePaid && totalPaid < Math.round(totalBudget * 0.40) && !isFullyPaid && (
                  <button
                    onClick={() => openPaymentModal('ADVANCE')}
                    className="mt-2 w-full py-1.5 bg-primary text-primary-foreground font-semibold rounded-lg text-xs hover:bg-primary/90 transition shadow-sm"
                  >
                    💳 Choose & Pay Advance (10% to 40%)
                  </button>
                )}
              </div>

              {/* Stage 3: Delivery Completion & Balance Settlement */}
              <div className={`p-3 rounded-xl border transition ${
                isFullyPaid ? 'bg-emerald-50/70 border-emerald-200' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <span>{isFullyPaid ? '✅' : '⏳'}</span>
                    <span>3. Delivery Settlement (Balance)</span>
                  </div>
                  <span className="font-bold text-xs">₹{balanceDue.toLocaleString('en-IN')}</span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {isFullyPaid ? 'Settled in full • GST Tax Invoice ready' : 'Payable upon safe delivery and POD verification'}
                </div>
                {isAssurancePaid && !isFullyPaid && (
                  <button
                    onClick={() => openPaymentModal('BALANCE')}
                    className="mt-2 w-full py-1.5 bg-emerald-600 text-white font-semibold rounded-lg text-xs hover:bg-emerald-700 transition shadow-sm"
                  >
                    💳 Pay Remaining Balance: ₹{balanceDue.toLocaleString('en-IN')} (UPI)
                  </button>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200/60 flex justify-between text-xs text-muted-foreground">
              <span>Total Paid: <strong className="text-foreground">₹{totalPaid.toLocaleString('en-IN')}</strong></span>
              <Link to="/payments" className="text-primary font-bold hover:underline">
                View Tax Invoices →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Sheet Modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-[2000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl p-6 max-w-md w-full border shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-lg text-foreground">
                  {payMilestone === 'ASSURANCE' ? 'Pay 10% Booking Assurance' :
                   payMilestone === 'ADVANCE' ? 'Select & Pay Route Advance' : 'Settle Final Delivery Balance'}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  WayBack Secure Indian Logistics Escrow
                </p>
              </div>
              <button
                onClick={() => setShowPayModal(false)}
                className="text-muted-foreground hover:text-foreground text-xl font-bold p-1"
              >
                &times;
              </button>
            </div>

            {/* Advance Percentage Selector (Only when paying Advance) */}
            {payMilestone === 'ADVANCE' && (
              <div className="p-4 rounded-xl bg-muted/40 border space-y-3">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span>Choose Advance Percentage:</span>
                  <span className="text-primary font-black text-sm">{selectedAdvancePct}%</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[10, 20, 30, 40].map(pct => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setSelectedAdvancePct(pct)}
                      className={`py-1.5 rounded-lg border text-xs font-bold transition ${
                        selectedAdvancePct === pct ? 'bg-primary text-white border-primary shadow' : 'bg-background hover:bg-muted'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Advance Amount: <strong>₹{Math.round(totalBudget * (selectedAdvancePct / 100)).toLocaleString('en-IN')}</strong>
                  {totalPaid > 0 && <span> (minus ₹{totalPaid.toLocaleString('en-IN')} already paid)</span>}
                </div>
              </div>
            )}

            {/* Amount Summary */}
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground font-semibold">Amount to Pay Now:</div>
                <div className="text-3xl font-extrabold text-primary">
                  ₹{(
                    payMilestone === 'ASSURANCE' ? assuranceAmount :
                    payMilestone === 'ADVANCE' ? Math.max(0, Math.round(totalBudget * (selectedAdvancePct / 100)) - totalPaid) :
                    balanceDue
                  ).toLocaleString('en-IN')}
                </div>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <div>GST: Inclusive (5%)</div>
                <div className="font-bold text-emerald-600">Zero Convenience Fee</div>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Select Indian Payment Mode
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'UPI', label: '⚡ UPI / QR' },
                  { id: 'NETBANKING', label: '🏦 NetBanking' },
                  { id: 'CARD', label: '💳 Cards' },
                ].map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPayMethod(m.id as any)}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1 ${
                      payMethod === m.id
                        ? 'bg-primary text-primary-foreground border-primary shadow'
                        : 'bg-muted/40 text-foreground border-transparent hover:bg-muted'
                    }`}
                  >
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {payMethod === 'UPI' && (
              <div className="space-y-3 bg-muted/20 p-3.5 rounded-xl border">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Enter VPA / UPI ID (GPay, PhonePe, Paytm):
                  </label>
                  <input
                    type="text"
                    value={upiId}
                    onChange={e => setUpiId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm bg-background font-mono"
                    placeholder="mobile@upi or name@okaxis"
                  />
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="text-emerald-600 font-bold">🔒 Instant UPI Autopay</span>
                  <span>• Directly credited to driver's diesel wallet</span>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPayModal(false)}
                className="flex-1 py-2.5 border rounded-xl font-semibold text-sm hover:bg-muted transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={paying}
                onClick={handleProcessPayment}
                className="flex-1 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl text-sm hover:bg-primary/90 transition shadow flex items-center justify-center gap-2"
              >
                {paying ? 'Processing...' : `Pay via ${payMethod}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📜 Statutory Freight Terms & Conditions Modal */}
      <TermsModal isOpen={termsModalOpen} onClose={() => setTermsModalOpen(false)} />
    </div>
  );
}
