import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import TermsModal from '../components/TermsModal';

export default function Loads() {
  const { user } = useAuth();
  const { openChat } = useChat();
  const [loads, setLoads] = useState<any[]>([]);
  const [negotiations, setNegotiations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [counterPrices, setCounterPrices] = useState<Record<string, string>>({});
  const [termsModalOpen, setTermsModalOpen] = useState(false);

  const fetchLoads = async () => {
    const res = await fetchApi('/loads');
    setLoads(res.data.loads || []);
  };

  const fetchNegotiations = async () => {
    if (user?.role !== 'CUSTOMER') return;
    try {
      const res = await fetchApi('/loads/negotiations/pending');
      setNegotiations(res.data.negotiations || []);
    } catch {/* endpoint may not exist yet, silent */}
  };

  useEffect(() => {
    Promise.all([fetchLoads(), fetchNegotiations()]).finally(() => setLoading(false));
    const interval = setInterval(fetchNegotiations, 10000);
    return () => clearInterval(interval);
  }, [user]);

  const handleCustomerApproveDriver = async (recId: string) => {
    setRespondingId(recId);
    try {
      await fetchApi(`/recommendations/${recId}/customer-approve`, {
        method: 'POST',
      });
      alert('🎉 Driver approved! The driver has been notified to confirm and accept your load.');
      await Promise.all([fetchLoads(), fetchNegotiations()]);
    } catch (err: any) {
      alert(err.message || 'Failed to approve driver');
    } finally {
      setRespondingId(null);
    }
  };

  const handleNegotiationRespond = async (recId: string, action: 'approve' | 'reject') => {
    setRespondingId(recId);
    try {
      await fetchApi(`/recommendations/${recId}/negotiate/respond`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      await Promise.all([fetchLoads(), fetchNegotiations()]);
    } catch (err) {
      console.error(err);
    } finally {
      setRespondingId(null);
    }
  };

  const handleCounterOffer = async (recId: string) => {
    const price = counterPrices[recId];
    if (!price || isNaN(parseInt(price))) return;
    setRespondingId(recId);
    try {
      const res = await fetchApi(`/recommendations/${recId}/counter-offer`, {
        method: 'POST',
        body: JSON.stringify({ counterPrice: parseInt(price) }),
      });
      const d = res.data;
      if (d.autoAccepted) {
        alert(`✅ System auto-accepted at ₹${d.agreedPrice}! Load assigned.`);
      } else {
        alert(`❌ Counter-offer ₹${price} is below floor price ₹${d.floor}. Offer rejected. Driver notified.`);
      }
      await Promise.all([fetchLoads(), fetchNegotiations()]);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRespondingId(null);
    }
  };

  const shortName = (name?: string) => {
    if (!name) return '';
    const parts = name.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length <= 2) return parts.join(', ');
    return parts.slice(0, 2).join(', ');
  };

  const activeNegotiations = negotiations.filter((neg: any) => {
    const load = loads.find(l => l.id === neg.loadId || l.id === neg.load?.id) || neg.load;
    if (!load) return false;
    // Stop suggesting drivers once confirmed with a driver or completed
    const confirmedStatuses = ['RESERVED', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'CANCELLED'];
    if (confirmedStatuses.includes(load.status)) return false;
    if (neg.status === 'ACCEPTED' || neg.status === 'COMPLETED' || neg.status === 'CANCELLED' || neg.status === 'REJECTED') return false;
    return true;
  });

  const activeLoads = loads.filter(l => l.status !== 'DELIVERED' && l.status !== 'CANCELLED');
  const historyLoads = loads.filter(l => l.status === 'DELIVERED' || l.status === 'CANCELLED');

  if (loading) return <div className="p-8">Loading loads...</div>;

  return (
    <div className="page-wrapper max-w-6xl mx-auto px-4 py-8 space-y-10">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Manage Freight Loads</h1>
          <p className="text-xs text-muted-foreground mt-1">Track active shipments, approve transporter proposals, and view past completed delivery waybills</p>
        </div>
        {user?.role === 'CUSTOMER' && (
          <Link to="/loads/new" className="px-4 py-2 bg-primary text-white rounded-xl font-bold shadow-sm hover:bg-primary/90 transition text-sm">
            + Create New Load
          </Link>
        )}
      </div>

      {/* ── Driver Matches & Proposals (Only for unconfirmed / pending loads) ── */}
      {user?.role === 'CUSTOMER' && activeNegotiations.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-lg font-bold flex items-center gap-2">
              🤝 Driver Matches & Pending Proposals
              <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-0.5 rounded-full font-bold">{activeNegotiations.length}</span>
            </h2>
            <button
              onClick={() => setTermsModalOpen(true)}
              className="text-xs text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer self-start sm:self-auto"
            >
              📜 Carriage Terms & Conditions ↗
            </button>
          </div>
          <div className="space-y-4">
            {activeNegotiations.map((neg: any) => {
              const isPreApproved = neg.terms === 'CUSTOMER_PRE_APPROVED';
              const isPendingMatch = neg.status === 'PENDING';

              return (
                <div key={neg.id} className="glass-card p-5 border-l-4 border-amber-400 bg-amber-50/40">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">🚛</span>
                        <div>
                          <div className="font-bold text-base flex items-center gap-2">
                            <span>{neg.trip?.driver?.name || 'Verified Highway Driver'}</span>
                            <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-semibold">
                              ⭐ {neg.trip?.driver?.profile?.trustScore ? `${neg.trip?.driver?.profile?.trustScore} Trust Score` : '5.0★ Rating'}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground truncate" title={`${neg.load?.pickupName} → ${neg.load?.dropName}`}>
                            Cargo: <strong className="text-slate-800">{neg.load?.goodsCategory}</strong> • {shortName(neg.load?.pickupName)} → {shortName(neg.load?.dropName)}
                          </div>
                        </div>
                      </div>

                      <div className="bg-white/80 rounded-xl p-3.5 text-xs space-y-1.5 mt-2 border border-slate-200">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Assigned Vehicle:</span>
                          <span className="font-mono font-bold text-slate-800">
                            {neg.trip?.vehicle?.type} • {neg.trip?.vehicle?.registrationNo || 'RTO Verified'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Freight Rate:</span>
                          <span className="font-bold text-primary text-sm">
                            ₹{(neg.proposedPrice || neg.load?.budget || 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                        {neg.terms && !isPreApproved && (
                          <div className="pt-1 text-slate-600">
                            <span className="text-muted-foreground font-semibold">Driver Terms: </span>{neg.terms}
                          </div>
                        )}
                      </div>

                      {/* Counter-offer input if driver proposed different price */}
                      {neg.proposedPrice && (
                        <div className="mt-3 flex gap-2 items-center">
                          <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₹</span>
                            <input
                              type="number"
                              placeholder="Your counter price"
                              value={counterPrices[neg.id] || ''}
                              onChange={e => setCounterPrices(p => ({ ...p, [neg.id]: e.target.value }))}
                              className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
                            />
                          </div>
                          <button
                            onClick={() => handleCounterOffer(neg.id)}
                            disabled={respondingId === neg.id || !counterPrices[neg.id]}
                            className="px-3.5 py-2 bg-primary text-white rounded-lg font-semibold text-xs hover:bg-primary/90 disabled:opacity-50 transition whitespace-nowrap cursor-pointer"
                          >
                            💬 Counter Offer
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 shrink-0">
                      {isPendingMatch ? (
                        <>
                          {isPreApproved ? (
                            <div className="px-3.5 py-2 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold text-center">
                              ✓ You Approved Driver
                              <span className="block text-[10px] font-normal text-emerald-700">Awaiting driver acceptance</span>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleCustomerApproveDriver(neg.id)}
                              disabled={respondingId === neg.id || (neg.load?.customerId && neg.load.customerId !== user?.id)}
                              title={neg.load?.customerId && neg.load.customerId !== user?.id ? "You can only approve orders that you created" : "Pre-approve this driver"}
                              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              ✅ Approve Driver
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          {neg.status === 'ACCEPTED' ? (
                            <div className="px-3.5 py-2 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold text-center">
                              ✓ Terms Accepted
                            </div>
                          ) : (
                            <button
                              onClick={() => handleNegotiationRespond(neg.id, 'approve')}
                              disabled={respondingId === neg.id || (neg.load?.customerId && neg.load.customerId !== user?.id)}
                              title={neg.load?.customerId && neg.load.customerId !== user?.id ? "You can only approve orders that you created" : "Approve negotiated terms"}
                              className="px-5 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700 disabled:opacity-50 transition shadow-sm cursor-pointer"
                            >
                              ✅ Approve Terms
                            </button>
                          )}
                        </>
                      )}

                      {neg.trip?.driver && (
                        <button
                          onClick={() =>
                            openChat({
                              id: neg.trip.driver.id,
                              name: neg.trip.driver.name,
                              role: 'DRIVER',
                              tripId: neg.trip.id,
                            })
                          }
                          className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 rounded-xl font-semibold text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          💬 Direct Chat
                        </button>
                      )}

                      {/* Reject button: DISABLED / HIDDEN once customer has accepted or pre-approved */}
                      {isPreApproved || neg.status === 'ACCEPTED' ? (
                        <button
                          disabled
                          title="Order already accepted. Reject option is disabled."
                          className="px-4 py-1.5 bg-slate-100 text-slate-400 rounded-xl font-medium text-[11px] cursor-not-allowed opacity-60 flex items-center justify-center gap-1"
                        >
                          🔒 Reject Disabled
                        </button>
                      ) : (
                        <button
                          onClick={() => handleNegotiationRespond(neg.id, 'reject')}
                          disabled={respondingId === neg.id || (neg.load?.customerId && neg.load.customerId !== user?.id)}
                          className="px-4 py-1.5 bg-slate-100 text-slate-600 rounded-xl font-medium text-xs hover:bg-rose-50 hover:text-rose-700 transition cursor-pointer disabled:opacity-50"
                        >
                          ✕ Reject
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Active Shipments Section ────────────────────────────────────────── */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          🚚 Active Freight Shipments
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">{activeLoads.length}</span>
        </h2>

        {activeLoads.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground glass-card rounded-2xl border border-dashed">
            No active shipments currently in transit or pending. Click "Create New Load" above to post a shipment.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeLoads.map(load => (
              <div key={load.id} className="glass-card p-5 hover:shadow-lg transition rounded-2xl border border-white/50 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg text-foreground">{load.goodsCategory}</h3>
                    <span className="font-bold text-primary text-base">₹{load.budget?.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                    <span>{load.weight} kg</span>
                    <span>•</span>
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                      load.status === 'ASSIGNED' ? 'bg-blue-100 text-blue-800' :
                      load.status === 'IN_TRANSIT' ? 'bg-purple-100 text-purple-800 animate-pulse' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {load.status}
                    </span>
                  </div>
                  <div className="text-xs space-y-1 mb-4 text-slate-700">
                    <div className="truncate" title={load.pickupName}><span className="font-bold text-slate-900">Pickup:</span> {shortName(load.pickupName)}</div>
                    <div className="truncate" title={load.dropName}><span className="font-bold text-slate-900">Drop:</span> {shortName(load.dropName)}</div>
                  </div>

                  {/* 🔐 Two-Factor Handover OTPs */}
                  {(load.pickupOtp || load.deliveryOtp) && (
                    <div className="bg-blue-50/70 border border-blue-200/80 p-2.5 rounded-xl mb-3 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] text-blue-700 uppercase font-bold block">1st Pickup OTP</span>
                        <span className="font-mono font-black text-blue-950 text-sm tracking-wider">{load.pickupOtp || '------'}</span>
                        {load.pickupOtpVerified ? (
                          <span className="text-[10px] text-emerald-700 ml-1 font-bold">✓ Verified</span>
                        ) : (
                          <span className="text-[10px] text-amber-700 ml-1 font-medium">⏳ Pickup</span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-emerald-700 uppercase font-bold block">2nd Delivery OTP</span>
                        <span className="font-mono font-black text-emerald-950 text-sm tracking-wider">{load.deliveryOtp || '------'}</span>
                        {load.deliveryOtpVerified ? (
                          <span className="text-[10px] text-emerald-700 ml-1 font-bold">✓ Delivered</span>
                        ) : (
                          <span className="text-[10px] text-slate-500 ml-1 font-medium">⏳ Delivery</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-200/60">
                  <Link to={`/loads/${load.id}`} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition">
                    📋 View Details & Waybill
                  </Link>
                  {(load.status === 'IN_TRANSIT' || load.status === 'ASSIGNED') && (
                    <Link to={`/loads/${load.id}/track`} className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg text-xs font-bold transition flex items-center gap-1">
                      📡 Live GPS Tracking
                    </Link>
                  )}
                  {user?.role === 'CUSTOMER' && (load.status === 'ASSIGNED' || load.status === 'IN_TRANSIT') && (
                    <Link to="/payments" className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-bold transition flex items-center gap-1">
                      💳 Payments & Escrow
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Shipment History & Past Deliveries (loads history) ────────────────── */}
      <div className="space-y-4 pt-4 border-t border-slate-200">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          📦 Shipment History & Past Deliveries
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">{historyLoads.length}</span>
        </h2>

        {historyLoads.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground glass-card rounded-2xl border border-dashed">
            No completed shipments in history yet. Delivered loads will appear here alongside their complete electronic proof of delivery and waybill dossier.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {historyLoads.map(load => (
              <div key={load.id} className="glass-card p-5 hover:shadow-lg transition rounded-2xl border border-white/50 flex flex-col justify-between bg-white/70">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg text-foreground">{load.goodsCategory}</h3>
                    <span className="font-bold text-primary text-base">₹{load.budget?.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                    <span>{load.weight} kg</span>
                    <span>•</span>
                    <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                      load.status === 'DELIVERED' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {load.status === 'DELIVERED' ? '✓ DELIVERED' : load.status}
                    </span>
                    {load.deliveryOtpVerified && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px]">
                        ✓ OTP Handover Verified
                      </span>
                    )}
                  </div>
                  <div className="text-xs space-y-1 mb-4 text-slate-700">
                    <div className="truncate" title={load.pickupName}><span className="font-bold text-slate-900">Pickup:</span> {shortName(load.pickupName)}</div>
                    <div className="truncate" title={load.dropName}><span className="font-bold text-slate-900">Drop:</span> {shortName(load.dropName)}</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-200/60">
                  <Link to={`/loads/${load.id}`} className="px-3.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-lg text-xs font-bold transition shadow-xs flex items-center gap-1.5">
                    📋 View Complete Waybill Dossier
                  </Link>
                  <Link to="/payments" className="px-3.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-bold transition flex items-center gap-1">
                    📄 Invoices & GST Receipts
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 📜 Carriage Terms & Conditions Modal */}
      <TermsModal isOpen={termsModalOpen} onClose={() => setTermsModalOpen(false)} />
    </div>
  );
}
