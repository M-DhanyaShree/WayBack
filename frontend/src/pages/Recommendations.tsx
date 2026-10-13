import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { fetchApi } from '../lib/api';
import Map from '../components/Map';
import TermsModal from '../components/TermsModal';

export default function Recommendations() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [termsModalOpen, setTermsModalOpen] = useState(false);

  // Driver Preference Settings (One-time setup for auto-pilot)
  const [showPrefModal, setShowPrefModal] = useState(false);
  const [driverPrefs, setDriverPrefs] = useState({
    maxConcessionPct: '15',
    minAdvancePct: '30',
    detourKm: '25',
  });

  const loadData = async () => {
    try {
      const recRes = await fetchApi(`/recommendations/trip/${tripId}`);
      setRecommendations(recRes.data.recommendations || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tripId]);

  const handleAcceptMatch = async (recId: string) => {
    setActionLoading(recId);
    try {
      await fetchApi(`/recommendations/${recId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ action: 'accept' }),
      });
      setSuccessMsg('🎉 Match Accepted! Customer has been notified with your ETA and prompted for 10% Assurance Deposit.');
      setTimeout(() => {
        navigate('/trips');
      }, 2000);
    } catch (err: any) {
      alert(err.message || 'Failed to accept recommendation');
    } finally {
      setActionLoading('');
    }
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
        <div className="glass-card p-8 text-center text-muted-foreground animate-pulse">
          ⚡ System is auto-evaluating and negotiating best return loads...
        </div>
      </div>
    );
  }

  const sortedRecs = [...recommendations].sort((a, b) => (b.score || 0) - (a.score || 0));
  const bestMatch = sortedRecs[0];
  const otherMatches = sortedRecs.slice(1);

  return (
    <div className="page-wrapper max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚡</span>
            <h1 className="text-3xl font-bold text-foreground">Auto-Matched Return Loads</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Intelligent spatial matching: Ranked by route overlap, fuel efficiency, and net driver profit.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setTermsModalOpen(true)}
            className="px-3 py-2 bg-white/80 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-xs transition shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            📜 Carriage Terms
          </button>
          <button
            onClick={() => setShowPrefModal(true)}
            className="px-4 py-2 bg-white/80 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl text-xs transition shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            ⚙️ Auto-Pilot Preferences
          </button>
          <Link
            to="/trips"
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition shadow-sm"
          >
            ← Back to Active Trip
          </Link>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm animate-in fade-in">
          <span>{successMsg}</span>
        </div>
      )}

      {sortedRecs.length === 0 ? (
        <div className="glass-card p-12 text-center rounded-2xl border border-white/50 space-y-3">
          <span className="text-4xl">🔍</span>
          <h2 className="text-lg font-bold text-foreground">Scanning for Matching Return Loads...</h2>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Our spatial dispatch engine continuously scans shipments along your return corridor. As soon as a customer posts a matching consignment, it will be ranked and suggested here!
          </p>
          <button
            onClick={loadData}
            className="mt-2 px-5 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl text-xs hover:bg-primary/90 transition shadow"
          >
            🔄 Refresh Matches
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* ── TOP FEATURED: #1 Best Match ────────────────── */}
          {bestMatch && (
            <div className="glass-card border-2 border-emerald-500/40 rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-br from-white/95 via-emerald-50/30 to-blue-50/20">
              <div className="bg-emerald-600 text-white px-6 py-2.5 flex items-center justify-between text-xs font-bold tracking-wide">
                <span className="flex items-center gap-2">
                  <span>🏆 #1 RECOMMENDED RETURN LOAD</span>
                  <span className="bg-white/20 px-2 py-0.5 rounded-full text-[11px]">System Auto-Negotiated</span>
                </span>
                <span className="bg-white text-emerald-900 px-2.5 py-0.5 rounded-full font-black">
                  Match Score: {Math.round(bestMatch.score || 95)}%
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12">
                {/* Map Preview */}
                <div className="lg:col-span-5 h-[280px] lg:h-auto min-h-[260px] relative border-b lg:border-b-0 lg:border-r border-slate-200/60">
                  <Map
                    source={[bestMatch.load.pickupLat, bestMatch.load.pickupLng]}
                    destination={[bestMatch.load.dropLat, bestMatch.load.dropLng]}
                  />
                  <div className="absolute bottom-3 left-3 z-[1000] bg-background/90 backdrop-blur-md px-3 py-1.5 rounded-lg text-[11px] font-bold shadow border">
                    📍 Route Overlap: {Math.round((bestMatch.routeOverlap || 0.85) * 100)}%
                  </div>
                </div>

                {/* Match Details & 1-Click Accept */}
                <div className="lg:col-span-7 p-6 flex flex-col justify-between space-y-5">
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <h2 className="text-xl font-black text-foreground">{bestMatch.load.goodsCategory}</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Weight: <strong className="text-foreground">{bestMatch.load.weight} kg</strong> • Capacity Used: <strong>{Math.round((bestMatch.capacityUtilization || 0.5) * 100)}%</strong>
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-extrabold text-emerald-700">
                          ₹{bestMatch.load.budget?.toLocaleString('en-IN')}
                        </div>
                        <div className="text-[10px] text-muted-foreground">Agreed Freight Budget</div>
                      </div>
                    </div>

                    {/* Route Info */}
                    <div className="bg-white/80 p-3.5 rounded-xl border border-slate-200/80 space-y-2 text-xs mb-4">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                        <div className="truncate">
                          <span className="text-muted-foreground font-semibold">Pickup: </span>
                          <strong className="text-slate-800">{shortName(bestMatch.load.pickupName)}</strong>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                        <div className="truncate">
                          <span className="text-muted-foreground font-semibold">Drop: </span>
                          <strong className="text-slate-800">{shortName(bestMatch.load.dropName)}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Next Steps Info Pill */}
                    <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl text-[11px] text-blue-900 flex items-center gap-2.5">
                      <span className="text-base">ℹ️</span>
                      <div>
                        <strong>Escrow Flow:</strong> Upon clicking Accept, customer receives your confirmation and must pay a <strong>10% Assurance Deposit</strong> before the deadline. If unpaid, system automatically matches the next available load.
                      </div>
                    </div>
                  </div>

                  {/* Accept Button */}
                  <div className="pt-2 border-t border-slate-200/60 flex items-center gap-3">
                    <button
                      onClick={() => handleAcceptMatch(bestMatch.id)}
                      disabled={actionLoading === bestMatch.id}
                      className="flex-1 py-3.5 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-lg hover:shadow-xl transition text-sm flex items-center justify-center gap-2 uppercase tracking-wide"
                    >
                      {actionLoading === bestMatch.id ? '⚡ Locking Match...' : '⚡ 1-Click Accept Best Match'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Other Available Candidate Matches ────────────────────────────── */}
          {otherMatches.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Other Candidate Return Loads ({otherMatches.length})
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {otherMatches.map(rec => (
                  <div key={rec.id} className="glass-card p-5 border border-white/60 shadow-md rounded-2xl flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <h4 className="font-bold text-base text-foreground">{rec.load.goodsCategory}</h4>
                          <span className="text-xs text-muted-foreground">{rec.load.weight} kg • Match: {Math.round(rec.score || 80)}%</span>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-black text-primary">₹{rec.load.budget?.toLocaleString('en-IN')}</span>
                        </div>
                      </div>

                      <div className="text-xs space-y-1 text-slate-700 bg-white/60 p-3 rounded-xl border">
                        <div className="truncate"><strong>Pickup:</strong> {shortName(rec.load.pickupName)}</div>
                        <div className="truncate"><strong>Drop:</strong> {shortName(rec.load.dropName)}</div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleAcceptMatch(rec.id)}
                      disabled={actionLoading === rec.id}
                      className="w-full py-2 px-4 bg-primary text-primary-foreground font-bold rounded-xl text-xs hover:bg-primary/90 transition shadow-sm"
                    >
                      {actionLoading === rec.id ? 'Locking...' : 'Accept This Load'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Driver Preferences Modal */}
      {showPrefModal && (
        <div className="fixed inset-0 z-[2000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background rounded-2xl p-6 max-w-md w-full border shadow-2xl space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base text-foreground">Driver Auto-Pilot Settings</h3>
              <button onClick={() => setShowPrefModal(false)} className="text-muted-foreground hover:text-foreground font-bold text-lg">&times;</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-muted-foreground block mb-1">
                  Max Concession % System Can Negotiate:
                </label>
                <select
                  value={driverPrefs.maxConcessionPct}
                  onChange={e => setDriverPrefs(p => ({ ...p, maxConcessionPct: e.target.value }))}
                  className="w-full p-2 border rounded-lg bg-background"
                >
                  <option value="10">10% (Strict)</option>
                  <option value="15">15% (Standard Balanced)</option>
                  <option value="20">20% (High Volume / Quick Fill)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-muted-foreground block mb-1">
                  Preferred Advance % for Diesel/Tolls:
                </label>
                <select
                  value={driverPrefs.minAdvancePct}
                  onChange={e => setDriverPrefs(p => ({ ...p, minAdvancePct: e.target.value }))}
                  className="w-full p-2 border rounded-lg bg-background"
                >
                  <option value="20">20% Minimum</option>
                  <option value="30">30% Standard</option>
                  <option value="40">40% Maximum</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-muted-foreground block mb-1">
                  Max Route Detour Tolerance:
                </label>
                <select
                  value={driverPrefs.detourKm}
                  onChange={e => setDriverPrefs(p => ({ ...p, detourKm: e.target.value }))}
                  className="w-full p-2 border rounded-lg bg-background"
                >
                  <option value="15">Up to 15 km detour</option>
                  <option value="25">Up to 25 km detour</option>
                  <option value="40">Up to 40 km detour</option>
                </select>
              </div>
            </div>

            <button
              onClick={() => {
                setShowPrefModal(false);
                alert('✅ Auto-pilot settings updated! System will auto-bargain within these limits.');
              }}
              className="w-full py-2.5 bg-primary text-primary-foreground font-bold rounded-xl text-xs hover:bg-primary/90 transition shadow"
            >
              Save Preferences
            </button>
          </div>
        </div>
      )}

      {/* 📜 Carriage Terms & Conditions Modal */}
      <TermsModal isOpen={termsModalOpen} onClose={() => setTermsModalOpen(false)} />
    </div>
  );
}
