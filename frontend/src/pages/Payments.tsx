import { useState, useEffect } from 'react';
import { fetchApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function Payments() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<any[]>([]);
  const [driverSummary, setDriverSummary] = useState<any>(null);
  const [loads, setLoads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Driver Payout State
  const [payoutUpi, setPayoutUpi] = useState('driver@okaxis');
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutLoading, setPayoutLoading] = useState(false);

  // Customer Pay Modal State
  const [selectedLoad, setSelectedLoad] = useState<any>(null);
  const [payType, setPayType] = useState<'ADVANCE' | 'BALANCE' | 'FULL'>('ADVANCE');
  const [payMethod, setPayMethod] = useState<'UPI' | 'NETBANKING' | 'CARD' | 'POD_CASH'>('UPI');
  const [customerUpi, setCustomerUpi] = useState('customer@okhdfcbank');
  const [customAmount, setCustomAmount] = useState('');
  const [paying, setPaying] = useState(false);

  // Selected Invoice Modal
  const [invoicePayment, setInvoicePayment] = useState<any>(null);

  const loadData = async () => {
    try {
      const historyPromise = fetchApi('/payments/history');
      const driverPromise = user?.role === 'DRIVER' ? fetchApi('/payments/driver/earnings') : Promise.resolve(null);
      const loadsPromise = user?.role === 'CUSTOMER' ? fetchApi('/loads') : Promise.resolve(null);

      const [histRes, driverRes, loadsRes] = await Promise.all([
        historyPromise,
        driverPromise,
        loadsPromise,
      ]);

      setPayments(histRes.data.payments || []);
      if (driverRes?.data) setDriverSummary(driverRes.data);
      if (loadsRes?.data) setLoads(loadsRes.data.loads || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleDriverWithdraw = async () => {
    if (!payoutAmount || Number(payoutAmount) <= 0) {
      alert('Please enter a valid withdrawal amount');
      return;
    }
    setPayoutLoading(true);
    try {
      const res = await fetchApi('/payments/driver/withdraw', {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(payoutAmount),
          upiId: payoutUpi,
        }),
      });
      setSuccessMsg(`✅ Instant UPI Payout of ₹${Number(payoutAmount).toLocaleString('en-IN')} sent to ${payoutUpi}! (Ref: ${res.data.transferRef})`);
      setPayoutAmount('');
      loadData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setPayoutLoading(false);
    }
  };

  const getLoadPaymentStats = (load: any) => {
    const totalBudget = Number(load?.budget || 0);
    const loadPayments = payments.filter((p: any) => 
      (p.loadId === load?.id || p.load?.id === load?.id) && p.status === 'SUCCESS'
    );
    const paidForLoad = loadPayments.reduce((sum: number, p: any) => sum + Number(p.amountMinorUnits || 0), 0);
    const balanceDue = Math.max(0, totalBudget - paidForLoad);
    const isFullyPaid = paidForLoad >= totalBudget && totalBudget > 0;
    const isDelivered = load?.status === 'DELIVERED';
    return { totalBudget, paidForLoad, balanceDue, isFullyPaid, isDelivered };
  };

  const handleCustomerPay = async () => {
    if (!selectedLoad) return;
    const stats = getLoadPaymentStats(selectedLoad);
    if (stats.balanceDue <= 0) {
      alert('This shipment is already fully settled. No further payment required.');
      setSelectedLoad(null);
      return;
    }

    setPaying(true);
    try {
      const enteredAmt = customAmount ? Number(customAmount) : stats.balanceDue;
      const amt = Math.min(stats.balanceDue, Math.max(1, enteredAmt));

      const res = await fetchApi('/payments', {
        method: 'POST',
        body: JSON.stringify({
          loadId: selectedLoad.id,
          amount: amt,
          paymentType: payType,
          method: payMethod,
          upiId: payMethod === 'UPI' ? customerUpi : undefined,
        }),
      });
      setSuccessMsg(`🎉 Payment of ₹${res.data.amount.toLocaleString('en-IN')} processed successfully via ${payMethod}!`);
      setSelectedLoad(null);
      setCustomAmount('');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Payment failed');
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-65px)] items-center justify-center">
        <div className="glass-card p-8 text-muted-foreground">Loading payments & settlements...</div>
      </div>
    );
  }

  return (
    <div className="page-wrapper max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground drop-shadow tracking-tight">
            {user?.role === 'DRIVER' ? 'Freight Earnings & UPI Settlements' : 'Payments, Invoices & Advances'}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {user?.role === 'DRIVER'
              ? 'Track trip earnings, advance receipts, and transfer funds instantly to your UPI or Bank A/C'
              : 'Manage shipment booking advances, balance on delivery (POD), and download GST invoices'}
          </p>
        </div>

        {user?.role === 'CUSTOMER' && (
          (() => {
            const pendingLoad = loads.find(l => getLoadPaymentStats(l).balanceDue > 0);
            return pendingLoad ? (
              <button
                onClick={() => {
                  const stats = getLoadPaymentStats(pendingLoad);
                  setSelectedLoad(pendingLoad);
                  setPayType(stats.isDelivered ? 'BALANCE' : stats.paidForLoad === 0 ? 'ADVANCE' : 'BALANCE');
                  setCustomAmount(String(stats.balanceDue));
                }}
                className="px-5 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl shadow hover:bg-primary/90 transition text-sm flex items-center gap-2 cursor-pointer"
              >
                💳 Make a Payment / Settle Balance
              </button>
            ) : loads.length > 0 ? (
              <div className="px-4 py-2 bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs border border-emerald-300">
                ✓ All Shipments Fully Settled
              </div>
            ) : null;
          })()
        )}
      </div>

      {successMsg && (
        <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 rounded-xl text-sm flex items-center justify-between shadow-sm">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="font-bold text-lg">&times;</button>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-800 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* ── DRIVER VIEW: Earnings & Instant UPI Payout ───────────────────────── */}
      {user?.role === 'DRIVER' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-10">
          {/* Earnings Card */}
          <div className="lg:col-span-5 glass-card p-6 border border-white/50 space-y-4 shadow-lg bg-gradient-to-br from-white/60 to-emerald-50/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Withdrawable Balance</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold animate-pulse">● Live Wallet</span>
            </div>
            <div className="text-4xl font-extrabold text-foreground">
              ₹{Number(driverSummary?.availableBalance ?? 0).toLocaleString('en-IN')}
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
              <div className="bg-white/60 p-3 rounded-xl border border-white/60">
                <span className="text-muted-foreground block">Completed Trips</span>
                <span className="font-bold text-foreground text-sm">{driverSummary?.totalTripsCompleted ?? 0}</span>
              </div>
              <div className="bg-white/60 p-3 rounded-xl border border-white/60">
                <span className="text-muted-foreground block">Active Trips</span>
                <span className="font-bold text-primary text-sm">{driverSummary?.activeTripsCount ?? 0}</span>
              </div>
            </div>
          </div>

          {/* Instant UPI Payout Card */}
          <div className="lg:col-span-7 glass-card p-6 border border-white/50 shadow-lg space-y-4">
            <h3 className="font-bold text-base text-foreground flex items-center gap-2">
              ⚡ Instant Payout to UPI / Bank Account
            </h3>
            <p className="text-xs text-muted-foreground">
              Transfer your freight earnings directly to your Google Pay, PhonePe, Paytm, or BHIM UPI ID in real time with 0% platform fee.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">UPI ID</label>
                <input
                  type="text"
                  placeholder="e.g. 9876543210@upi or name@okaxis"
                  value={payoutUpi}
                  onChange={(e) => setPayoutUpi(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white/80 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Amount (₹)</label>
                <input
                  type="number"
                  placeholder="Amount in ₹"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white/80 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleDriverWithdraw}
                disabled={payoutLoading}
                className="py-2 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md transition disabled:opacity-50"
              >
                {payoutLoading ? 'Transferring...' : '💸 Instant Withdraw to UPI'}
              </button>
              <button
                onClick={() => setPayoutAmount(String(driverSummary?.availableBalance || 5000))}
                className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium text-xs transition"
              >
                Withdraw Full Balance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CUSTOMER VIEW: Pending Loads to Pay ─────────────────────────────── */}
      {user?.role === 'CUSTOMER' && loads.length > 0 && (
        <div className="mb-10 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-primary">Shipment Payments & Milestone Dues</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loads.map((load) => {
              const { totalBudget, paidForLoad, balanceDue, isFullyPaid, isDelivered } = getLoadPaymentStats(load);
              const pctPaid = totalBudget > 0 ? Math.min(100, Math.round((paidForLoad / totalBudget) * 100)) : 0;

              return (
                <div key={load.id} className="glass-card p-5 border border-white/50 shadow-sm flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-base text-foreground">{load.goodsCategory}</h3>
                      <span className="font-bold text-primary text-base">₹{totalBudget.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">{load.weight} kg</span>
                      <span>•</span>
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        isDelivered ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {load.status}
                      </span>
                      {isFullyPaid && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                          ✓ 100% Settled
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-600 mt-2 truncate">
                      {load.pickupName?.split(',')[0]} → {load.dropName?.split(',')[0]}
                    </div>
                  </div>

                  {/* Financial Status Breakdown */}
                  <div className="bg-white/70 p-3.5 rounded-xl border border-white/60 space-y-2.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Agreed Total Freight:</span>
                      <span className="font-bold text-slate-800">₹{totalBudget.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount Settled to Date:</span>
                      <span className="font-bold text-emerald-700">₹{paidForLoad.toLocaleString('en-IN')} ({pctPaid}%)</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-slate-200/60 font-semibold">
                      <span className="text-slate-700">Remaining Balance Due:</span>
                      <span className={`font-bold text-sm ${balanceDue > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                        ₹{balanceDue.toLocaleString('en-IN')}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1">
                      <div
                        className={`h-full transition-all duration-300 ${isFullyPaid ? 'bg-emerald-500' : 'bg-primary'}`}
                        style={{ width: `${pctPaid}%` }}
                      />
                    </div>
                  </div>

                  {/* Action or Settled Badge — strictly enforce cannot pay again if fully paid */}
                  <div>
                    {isFullyPaid ? (
                      <div className="w-full py-2.5 px-3 bg-emerald-50 text-emerald-800 border border-emerald-300/80 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs">
                        <span>✅ Payment Complete & Fully Settled</span>
                      </div>
                    ) : isDelivered ? (
                      <button
                        onClick={() => {
                          setSelectedLoad(load);
                          setPayType('BALANCE');
                          setCustomAmount(String(balanceDue));
                        }}
                        className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        💳 Settle Remaining Balance: ₹{balanceDue.toLocaleString('en-IN')}
                      </button>
                    ) : paidForLoad === 0 ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedLoad(load);
                            setPayType('ADVANCE');
                            const initialAdvance = Math.min(balanceDue, Math.round(totalBudget * 0.10));
                            setCustomAmount(String(initialAdvance));
                          }}
                          className="flex-1 py-2 px-2.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg font-bold text-xs transition cursor-pointer"
                        >
                          Pay Advance (₹{Math.min(balanceDue, Math.round(totalBudget * 0.10)).toLocaleString('en-IN')})
                        </button>
                        <button
                          onClick={() => {
                            setSelectedLoad(load);
                            setPayType('FULL');
                            setCustomAmount(String(balanceDue));
                          }}
                          className="flex-1 py-2 px-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg font-bold text-xs transition shadow-sm cursor-pointer"
                        >
                          Pay Full (₹{balanceDue.toLocaleString('en-IN')})
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setSelectedLoad(load);
                          setPayType('BALANCE');
                          setCustomAmount(String(balanceDue));
                        }}
                        className="w-full py-2 px-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold text-xs transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        💳 Settle Remaining Balance: ₹{balanceDue.toLocaleString('en-IN')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Transaction Ledger / Invoices ─────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-primary mb-4">
          {user?.role === 'DRIVER' ? 'Freight Receipt Ledger' : 'Transaction History & Tax Invoices'}
        </h2>

        {payments.length === 0 ? (
          <div className="glass-card p-10 text-center text-muted-foreground">No payments recorded yet.</div>
        ) : (
          <div className="glass-card overflow-hidden border border-white/50 shadow-md rounded-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/60 border-b border-white/40 text-slate-700 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-4">Date & Time</th>
                    <th className="p-4">Transaction Ref</th>
                    <th className="p-4">Shipment Details</th>
                    <th className="p-4">Amount</th>
                    <th className="p-4">Method / Mode</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Invoice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/30">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-white/40 transition">
                      <td className="p-4 text-slate-700">
                        {new Date(p.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        <span className="block text-[10px] text-muted-foreground">{new Date(p.createdAt).toLocaleTimeString()}</span>
                      </td>
                      <td className="p-4 font-mono font-semibold text-slate-800 text-[11px]">{p.providerPaymentId || p.id?.slice(0, 16)}</td>
                      <td className="p-4">
                        <span className="font-semibold text-foreground">{p.load?.goodsCategory || 'Freight Transport'}</span>
                        {p.load && (
                          <span className="block text-[10px] text-muted-foreground truncate max-w-[200px]">
                            {p.load.pickupName?.split(',')[0]} → {p.load.dropName?.split(',')[0]}
                          </span>
                        )}
                      </td>
                      <td className="p-4 font-bold text-sm text-foreground">
                        ₹{Number(p.amountMinorUnits || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold text-[10px]">
                          📱 UPI / NetBanking
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          p.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-800' :
                          p.status === 'REFUNDED' ? 'bg-slate-100 text-slate-700' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {p.status === 'SUCCESS' ? '✓ SETTLED' : p.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => setInvoicePayment(p)}
                          className="px-3 py-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 rounded-lg text-xs font-semibold shadow-xs transition"
                        >
                          View Receipt
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── CUSTOMER PAYMENT CHECKOUT MODAL ─────────────────────────────── */}
      {selectedLoad && (() => {
        const { totalBudget, paidForLoad, balanceDue, isDelivered } = getLoadPaymentStats(selectedLoad);
        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-[2000] p-4">
            <div className="glass-card w-full max-w-md p-6 rounded-3xl border border-white/70 shadow-2xl bg-white/95 space-y-4">
              <div className="flex justify-between items-start border-b border-slate-200/60 pb-3">
                <div>
                  <h3 className="font-bold text-lg text-foreground">Freight Payment Checkout</h3>
                  <p className="text-[11px] text-muted-foreground">WayBack Escrow & Direct Transporter Settlement</p>
                </div>
                <button onClick={() => setSelectedLoad(null)} className="font-bold text-2xl text-slate-400 hover:text-slate-600 leading-none">&times;</button>
              </div>

              {/* Shipment Details & Balance Breakdown */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-sm text-slate-900">{selectedLoad.goodsCategory}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">{selectedLoad.weight} kg</span>
                </div>
                <div className="text-muted-foreground truncate">
                  {selectedLoad.pickupName?.split(',')[0]} → {selectedLoad.dropName?.split(',')[0]}
                </div>
                
                <div className="pt-2 border-t border-slate-200/80 space-y-1.5">
                  <div className="flex justify-between text-slate-600">
                    <span>Agreed Total Rate:</span>
                    <span className="font-bold text-slate-900">₹{totalBudget.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Already Settled to Date:</span>
                    <span className="font-bold text-emerald-700">₹{paidForLoad.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-200 font-bold text-slate-900 text-sm">
                    <span>Outstanding Balance Due:</span>
                    <span className="text-primary font-black text-base">₹{balanceDue.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {isDelivered && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-[11px] font-semibold flex items-center gap-2">
                    <span>📦</span>
                    <span>Consignment marked DELIVERED! Settle the remaining balance below.</span>
                  </div>
                )}
              </div>

              {/* Amount (pre-filled with remaining balance, capped at balanceDue) */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-700">Payable Amount (₹)</label>
                  <span className="text-[11px] text-muted-foreground">Remaining: ₹{balanceDue.toLocaleString('en-IN')}</span>
                </div>
                <input
                  type="number"
                  min="1"
                  max={balanceDue}
                  value={customAmount}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (val > balanceDue) {
                      setCustomAmount(String(balanceDue));
                    } else {
                      setCustomAmount(e.target.value);
                    }
                  }}
                  className="w-full px-3.5 py-2.5 text-lg font-black bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40 font-mono"
                />
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700 uppercase">Select Payment Mode</label>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setPayMethod('UPI')}
                    className={`py-2 px-2 rounded-xl font-bold border transition cursor-pointer ${payMethod === 'UPI' ? 'bg-emerald-50 text-emerald-800 border-emerald-500 shadow-xs' : 'bg-slate-50 text-slate-700'}`}
                  >
                    📱 UPI (GPay/Paytm)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayMethod('NETBANKING')}
                    className={`py-2 px-2 rounded-xl font-bold border transition cursor-pointer ${payMethod === 'NETBANKING' ? 'bg-blue-50 text-blue-800 border-blue-500 shadow-xs' : 'bg-slate-50 text-slate-700'}`}
                  >
                    🏦 NetBanking
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayMethod('CARD')}
                    className={`py-2 px-2 rounded-xl font-bold border transition cursor-pointer ${payMethod === 'CARD' ? 'bg-purple-50 text-purple-800 border-purple-500 shadow-xs' : 'bg-slate-50 text-slate-700'}`}
                  >
                    💳 Debit / Card
                  </button>
                </div>

                {payMethod === 'UPI' && (
                  <div className="pt-1">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Enter UPI ID</label>
                    <input
                      type="text"
                      value={customerUpi}
                      onChange={(e) => setCustomerUpi(e.target.value)}
                      placeholder="e.g. yourname@okhdfcbank"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-1">
                <button
                  onClick={handleCustomerPay}
                  disabled={paying || Number(customAmount || balanceDue) <= 0}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm shadow-md transition cursor-pointer"
                >
                  {paying ? 'Processing Payment...' : `Confirm & Pay ₹${Number(customAmount || balanceDue).toLocaleString('en-IN')}`}
                </button>
                <button
                  onClick={() => setSelectedLoad(null)}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── INVOICE / RECEIPT MODAL ───────────────────────────────────────────── */}
      {invoicePayment && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-[2000] p-4">
          <div className="glass-card w-full max-w-md p-6 rounded-3xl border border-white/70 shadow-2xl bg-white space-y-4">
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <div className="font-extrabold text-lg text-primary">WayBack Freight Bill</div>
                <div className="text-[11px] text-muted-foreground font-mono">Invoice #: {invoicePayment.id?.slice(0, 16)}</div>
              </div>
              <button onClick={() => setInvoicePayment(null)} className="font-bold text-xl text-slate-400 hover:text-slate-600">&times;</button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date:</span>
                <span className="font-semibold text-slate-800">{new Date(invoicePayment.createdAt).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Goods Description:</span>
                <span className="font-semibold text-slate-800">{invoicePayment.load?.goodsCategory || 'Freight Transport'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment Status:</span>
                <span className="font-bold text-emerald-700">PAID & SETTLED ✓</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment Method:</span>
                <span className="font-semibold text-slate-800">UPI / Digital Gateway</span>
              </div>

              <div className="border-t pt-3 space-y-1.5 bg-slate-50 p-3 rounded-xl">
                <div className="flex justify-between font-medium">
                  <span>Base Freight Charge:</span>
                  <span>₹{Number(invoicePayment.amountMinorUnits || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>GST & Tolls:</span>
                  <span>Included (0%)</span>
                </div>
                <div className="flex justify-between font-bold text-sm text-slate-900 border-t pt-1 mt-1">
                  <span>Total Settled Amount:</span>
                  <span className="text-primary font-black">₹{Number(invoicePayment.amountMinorUnits || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2 bg-slate-800 text-white rounded-xl font-bold text-xs hover:bg-slate-900 transition"
              >
                🖨 Print / Download PDF
              </button>
              <button
                onClick={() => setInvoicePayment(null)}
                className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
