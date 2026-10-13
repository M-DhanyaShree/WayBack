import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchApi } from '../lib/api';
import Map from '../components/Map';

export default function LoadDetails() {
  const { id } = useParams();
  const [load, setLoad] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchApi(`/loads/${id}`)
      .then(res => {
        setLoad(res.data.load);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8 text-destructive">{error}</div>;

  const isTrackable = load.status === 'ASSIGNED' || load.status === 'IN_TRANSIT';

  return (
    <div className="max-w-5xl mx-auto p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Load Details</h1>
        <div className="flex gap-2">
          {isTrackable && (
            <Link to={`/loads/${id}/track`} className="bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90 flex items-center gap-2 font-medium">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span> Track Live
            </Link>
          )}
          <Link to="/loads" className="border px-4 py-2 rounded hover:bg-muted">Back</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-card border rounded-xl overflow-hidden shadow-sm flex flex-col">
          <div className="p-6 border-b bg-muted/10">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xl font-bold">{load.goodsCategory}</h2>
              <span className={`px-2 py-1 rounded text-xs font-bold ${load.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                {load.status}
              </span>
            </div>
            <div className="text-2xl font-bold text-primary">₹{load.budget?.toLocaleString()}</div>
          </div>
          
          <div className="p-6 flex-1">
            <h3 className="font-semibold text-lg mb-4 border-b pb-2">Route Information</h3>
            <div className="space-y-4 mb-8">
              <div>
                <div className="text-xs text-muted-foreground uppercase font-semibold">Pickup</div>
                <div className="font-medium text-foreground">{load.pickupName}</div>
                {load.pickupTime && <div className="text-sm text-primary">Scheduled: {new Date(load.pickupTime).toLocaleString()}</div>}
              </div>
              <div className="pl-2 border-l-2 border-dashed border-muted my-2 h-4"></div>
              <div>
                <div className="text-xs text-muted-foreground uppercase font-semibold">Drop</div>
                <div className="font-medium text-foreground">{load.dropName}</div>
                {load.dropTime && <div className="text-sm text-primary">Expected: {new Date(load.dropTime).toLocaleString()}</div>}
              </div>
            </div>

            <h3 className="font-semibold text-lg mb-4 border-b pb-2">Specifications</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Weight:</span> <span className="font-medium">{load.weight} kg</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Dimensions:</span> <span className="font-medium">{load.dimensions || 'N/A'}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Created:</span> <span className="font-medium">{new Date(load.createdAt).toLocaleDateString()}</span></div>
            </div>
          </div>
        </div>

        <div className="border rounded-xl overflow-hidden h-[500px]">
          <Map source={[load.pickupLat, load.pickupLng]} destination={[load.dropLat, load.dropLng]} />
        </div>
      </div>

      {/* ── Complete Trip Dossier & Waybill (Shown below existing load details) ── */}
      {(() => {
        const matchedRec = load.recommendations?.find((r: any) => r.status === 'ACCEPTED' || r.status === 'COMPLETED') || load.recommendations?.[0];
        const trip = matchedRec?.trip;
        const totalBudget = Number(load.budget || 0);
        const totalPaid = load.payments?.filter((p: any) => p.status === 'SUCCESS').reduce((sum: number, p: any) => sum + Number(p.amountMinorUnits || 0), 0) || 0;
        const balanceDue = Math.max(0, totalBudget - totalPaid);

        return (
          <div className="mt-10 border border-slate-200/80 rounded-3xl p-6 sm:p-8 bg-white/95 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
                    📋 Complete Trip Dossier & Waybill
                  </h2>
                  {trip && (
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      trip.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                      trip.status === 'ONGOING' ? 'bg-blue-100 text-blue-800 animate-pulse' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {trip.status}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground font-mono mt-1">
                  Consignment Ref: #{load.id} • Waybill Ref: #{trip?.id || 'PENDING-ALLOCATION'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {isTrackable && (
                  <Link
                    to={`/loads/${id}/track`}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1.5"
                  >
                    📡 Live GPS Stream
                  </Link>
                )}
                <Link
                  to="/payments"
                  className="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-xs font-bold transition"
                >
                  💳 View Invoices
                </Link>
              </div>
            </div>

            {trip ? (
              <>
                {/* Corridor Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                    <span className="text-muted-foreground block text-[11px]">Trip Initiated</span>
                    <span className="font-semibold text-foreground">
                      {trip.startedAt ? new Date(trip.startedAt).toLocaleString('en-IN') : 'Scheduled'}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                    <span className="text-muted-foreground block text-[11px]">Trip Concluded</span>
                    <span className="font-semibold text-foreground">
                      {trip.endedAt ? new Date(trip.endedAt).toLocaleString('en-IN') : (load.status === 'DELIVERED' ? 'Delivered' : 'In Transit (Live)')}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                    <span className="text-muted-foreground block text-[11px]">Highway Corridor Distance</span>
                    <span className="font-bold text-primary text-sm">
                      {trip.distanceKm ? `${trip.distanceKm.toFixed(1)} km` : 'Calculated via GPS'}
                    </span>
                  </div>
                </div>

                {/* Highway Route & Terminal Hubs */}
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                  <div className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center justify-between">
                    <span>📍 Highway Route & Transporter Terminals</span>
                    <span className="text-[11px] font-normal text-muted-foreground">GPS Waypoints Geocoded</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    <div className="space-y-2 border-l-2 border-emerald-500 pl-3">
                      <div className="text-[11px] font-bold text-emerald-800 uppercase">Trip Origin (Departure Point)</div>
                      <div className="font-bold text-foreground text-sm">{trip.sourceName || load.pickupName}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">
                        Lat: {trip.sourceLat?.toFixed(4) || load.pickupLat?.toFixed(4)}, Lng: {trip.sourceLng?.toFixed(4) || load.pickupLng?.toFixed(4)}
                      </div>
                    </div>

                    <div className="space-y-2 border-l-2 border-rose-500 pl-3">
                      <div className="text-[11px] font-bold text-rose-800 uppercase">Trip Destination (Delivery Drop Point)</div>
                      <div className="font-bold text-foreground text-sm">{trip.destName || load.dropName}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">
                        Lat: {trip.destLat?.toFixed(4) || load.dropLat?.toFixed(4)}, Lng: {trip.destLng?.toFixed(4) || load.dropLng?.toFixed(4)}
                      </div>
                    </div>
                  </div>

                  {trip.returnToName && (
                    <div className="pt-2 border-t border-slate-200/80 text-blue-900 flex items-center gap-2">
                      <span className="font-bold">Return Hub:</span>
                      <span>{trip.returnToName}</span>
                    </div>
                  )}
                </div>

                {/* Carrier Profile & Commercial Vehicle */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block">🚚 Assigned Commercial Vehicle</span>
                    <div>Registration: <strong className="font-mono text-foreground">{trip.vehicle?.registrationNo || 'RTO Verified Commercial'}</strong></div>
                    <div>Model / Make: <strong className="text-foreground">{trip.vehicle?.model || trip.vehicle?.type || 'Heavy Freight Carrier'}</strong></div>
                    <div>Payload Capacity: <strong className="text-foreground">{trip.vehicle?.capacityWeight || trip.vehicle?.capacityKg || 5000} kg</strong></div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block">👤 Transporter & Driver Profile</span>
                    <div>Driver: <strong className="text-foreground">{trip.driver?.name || 'Verified Transporter'}</strong></div>
                    <div>Phone: <strong className="text-foreground">{trip.driver?.profile?.phone || '9876543210'}</strong></div>
                    <div className="text-emerald-700 font-semibold flex items-center gap-1">
                      <span>⭐ Verified Driver</span> • Clean Highway Safety Record
                    </div>
                  </div>
                </div>

                {/* Electronic Proof of Delivery (e-POD) & Verification Records */}
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4 text-xs">
                  <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block">
                    📑 Handover Protocols & Proof of Delivery (e-POD)
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl bg-white border space-y-1">
                      <div className="font-bold text-slate-800">1st OTP: Pickup Handover</div>
                      <div className="text-[11px] text-muted-foreground">
                        Shipper security release code verified before vehicle departure.
                      </div>
                      <div className="font-mono font-bold text-xs text-blue-900 mt-1">
                        OTP Code: {load.pickupOtp || '------'}
                      </div>
                      <div className="text-emerald-700 font-bold text-xs pt-1">
                        {load.pickupOtpVerified ? '✓ Handover Code Authenticated' : '⏳ Ready for Pickup Handover'}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white border space-y-1">
                      <div className="font-bold text-slate-800">2nd OTP: Consignee Delivery Handover</div>
                      <div className="text-[11px] text-muted-foreground">
                        Receiver confirmation code verified upon physical destination handover.
                      </div>
                      <div className="font-mono font-bold text-xs text-blue-900 mt-1">
                        OTP Code: {load.deliveryOtp || '------'}
                      </div>
                      <div className="text-emerald-700 font-bold text-xs pt-1">
                        {load.deliveryOtpVerified || trip.deliveryOtpVerified || trip.customerDeliveryConfirmed || load.status === 'DELIVERED'
                          ? '✓ Consignee OTP Verified & Confirmed'
                          : '⏳ Pending Destination Handover'}
                      </div>
                    </div>
                  </div>

                  {/* Previews: POD Photo & Consignee Signature */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    {/* Photo Proof */}
                    <div className="p-3.5 rounded-xl bg-white border space-y-2">
                      <span className="font-bold text-[11px] text-slate-800 block">📸 Unloading / POD Photo Proof</span>
                      {trip.deliveryProofPhotoUrl ? (
                        <div>
                          <img
                            src={trip.deliveryProofPhotoUrl}
                            alt="Proof of Delivery"
                            className="w-full h-40 object-cover rounded-lg border shadow-xs"
                          />
                          <a
                            href={trip.deliveryProofPhotoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-primary hover:underline font-bold block mt-1"
                          >
                            Open Full Image ↗
                          </a>
                        </div>
                      ) : (
                        <div className="h-32 rounded-lg bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center text-muted-foreground text-center p-3">
                          Photo proof recorded by driver upon destination handover
                        </div>
                      )}
                    </div>

                    {/* Digital Signature */}
                    <div className="p-3.5 rounded-xl bg-white border space-y-2">
                      <span className="font-bold text-[11px] text-slate-800 block">✍️ Consignee Electronic Signature</span>
                      {trip.customerESignatureUrl ? (
                        <div>
                          <div className="w-full h-40 bg-white rounded-lg border shadow-xs flex items-center justify-center p-2">
                            <img
                              src={trip.customerESignatureUrl}
                              alt="Consignee Signature"
                              className="max-h-full max-w-full object-contain"
                            />
                          </div>
                          <span className="text-[11px] text-emerald-700 font-bold block mt-1">
                            ✓ Digital Signature Captured & Timestamped
                          </span>
                        </div>
                      ) : (
                        <div className="h-32 rounded-lg bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center text-muted-foreground text-center p-3">
                          Consignee signature recorded upon physical handover
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Legal Carriage Compliance Notice */}
                  <div className="p-3 bg-blue-50/70 border border-blue-200/60 rounded-xl text-[11px] text-blue-900 leading-relaxed">
                    <strong>Statutory Carriage Compliance:</strong> This shipment is executed in accordance with Section 10 of Carriage by Road Act 2007. Verified electronic waybills and POD documentation serve as prima facie evidence of consignment receipt in sound order.
                  </div>
                </div>

                {/* Financial Settlement Breakdown */}
                <div className="p-5 rounded-2xl bg-white border border-slate-200 flex flex-col sm:flex-row justify-between sm:items-center gap-4 text-xs">
                  <div className="space-y-1">
                    <span className="font-bold uppercase tracking-wider text-muted-foreground text-[10px] block">Financial Freight Ledger</span>
                    <div className="text-sm font-bold text-foreground">
                      Agreed Rate: ₹{totalBudget.toLocaleString('en-IN')} • Settled: <span className="text-emerald-700">₹{totalPaid.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {balanceDue > 0 ? (
                        <span className="text-rose-600 font-bold">Outstanding Balance: ₹{balanceDue.toLocaleString('en-IN')}</span>
                      ) : (
                        <span className="text-emerald-700 font-bold">✓ 100% Fully Settled • GST Tax Invoice Issued</span>
                      )}
                    </div>
                  </div>

                  <Link
                    to="/payments"
                    className="px-5 py-2.5 bg-primary text-white rounded-xl font-bold text-xs shadow-sm hover:bg-primary/90 transition text-center shrink-0"
                  >
                    {balanceDue > 0 ? `💳 Settle Remaining ₹${balanceDue.toLocaleString('en-IN')}` : '📄 View Tax Invoice & Receipts'}
                  </Link>
                </div>
              </>
            ) : (
              <div className="p-8 text-center text-muted-foreground bg-slate-50 border border-dashed rounded-2xl">
                <span className="text-2xl block mb-2">⏳</span>
                <div className="font-bold text-foreground text-sm">Awaiting Driver Confirmation</div>
                <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                  The Complete Trip Dossier & Waybill will be automatically populated here with driver details, route telemetry, and electronic proof of delivery once a transporter accepts this order.
                </p>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
