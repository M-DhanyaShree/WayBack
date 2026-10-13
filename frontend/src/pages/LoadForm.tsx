import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchApi } from '../lib/api';
import Map, { reverseGeocode } from '../components/Map';
import LocationInput from '../components/LocationInput';

const GOODS_CATEGORIES = [
  'Textiles & Garments',
  'Auto Parts & Engineering',
  'Electronics & Electricals',
  'Furniture & Woodwork',
  'Agriculture & Agro Products',
  'FMCG & Packaged Groceries',
  'Hardware & Building Materials',
  'Machinery & Industrial Tools',
  'Chemicals & Pharmaceuticals',
  'General Merchandise & Parcels',
  'Other Freight'
];

export default function LoadForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(id ? true : false);
  const [error, setError] = useState('');

  const [pickup, setPickup] = useState<[number, number] | undefined>();
  const [drop, setDrop] = useState<[number, number] | undefined>();
  const [selecting, setSelecting] = useState<'pickup' | 'drop' | null>(null);

  const [formData, setFormData] = useState({
    pickupName: '',
    pickupTime: '',
    dropName: '',
    dropTime: '',
    weight: '250',
    dimLength: '4',
    dimWidth: '3',
    dimHeight: '3',
    goodsCategory: 'Textiles & Garments',
    goodsDetail: '',
    budget: '',
  });

  // Dynamic Pricing State
  const [pricingBreakdown, setPricingBreakdown] = useState<any>(null);
  const [pricingLoading, setPricingLoading] = useState(false);

  useEffect(() => {
    if (id) {
      fetchApi(`/loads/${id}`).then(res => {
        const l = res.data.load;
        setPickup([l.pickupLat, l.pickupLng]);
        setDrop([l.dropLat, l.dropLng]);
        const formatDateTime = (s: string) => {
          if (!s) return '';
          const d = new Date(s);
          return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        };

        let len = '4', wid = '3', hgt = '3';
        if (l.dimensions) {
          const parts = l.dimensions.replace(/ft/gi, '').split(/x|×/i).map((s: string) => s.trim());
          if (parts.length >= 3) {
            len = parts[0] || '4';
            wid = parts[1] || '3';
            hgt = parts[2] || '3';
          }
        }

        setFormData({
          pickupName: l.pickupName,
          pickupTime: formatDateTime(l.pickupTime),
          dropName: l.dropName,
          dropTime: formatDateTime(l.dropTime),
          weight: l.weight.toString(),
          dimLength: len,
          dimWidth: wid,
          dimHeight: hgt,
          goodsCategory: l.goodsCategory || 'Textiles & Garments',
          goodsDetail: '',
          budget: l.budget.toString(),
        });
        setLoading(false);
      }).catch(err => { setError(err.message); setLoading(false); });
    }
  }, [id]);

  // Dynamically calculate fair freight estimate whenever route or weight changes
  useEffect(() => {
    if (pickup && drop) {
      setPricingLoading(true);
      fetchApi('/pricing/estimate', {
        method: 'POST',
        body: JSON.stringify({
          originLat: pickup[0],
          originLng: pickup[1],
          destLat: drop[0],
          destLng: drop[1],
          weightKg: formData.weight,
        }),
      })
        .then(res => {
          const b = res.data.breakdown;
          setPricingBreakdown(b);
          if (!id || !formData.budget) {
            setFormData(prev => ({ ...prev, budget: b.finalEstimatedFare.toString() }));
          }
        })
        .catch(err => console.error('Pricing error:', err))
        .finally(() => setPricingLoading(false));
    }
  }, [pickup, drop, formData.weight]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const getCurrentLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setPickup([lat, lng]);
        const name = await reverseGeocode(lat, lng);
        setFormData(prev => ({ ...prev, pickupName: name }));
      },
      (err) => console.error('Location permission denied', err)
    );
  };

  const handleMapClick = async (lat: number, lng: number, name: string) => {
    if (selecting === 'pickup') {
      setPickup([lat, lng]);
      setFormData(prev => ({ ...prev, pickupName: name }));
      setSelecting(null);
    } else if (selecting === 'drop') {
      setDrop([lat, lng]);
      setFormData(prev => ({ ...prev, dropName: name }));
      setSelecting(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickup || !drop) { setError('Please select pickup and drop locations'); return; }
    try {
      const len = parseFloat(formData.dimLength) || 4;
      const wid = parseFloat(formData.dimWidth) || 3;
      const hgt = parseFloat(formData.dimHeight) || 3;
      const dimensions = `${len}×${wid}×${hgt} ft`;
      const volumeCbf = Math.round(len * wid * hgt);

      const payload = {
        pickupName: formData.pickupName,
        pickupLat: pickup[0],
        pickupLng: pickup[1],
        dropName: formData.dropName,
        dropLat: drop[0],
        dropLng: drop[1],
        weight: parseFloat(formData.weight) || 250,
        volumeCbf,
        dimensions,
        goodsCategory: formData.goodsDetail ? `${formData.goodsCategory} - ${formData.goodsDetail}` : formData.goodsCategory,
        pickupTime: formData.pickupTime ? new Date(formData.pickupTime).toISOString() : undefined,
        dropTime: formData.dropTime ? new Date(formData.dropTime).toISOString() : undefined,
        budget: Math.round(parseFloat(formData.budget) || 5000),
      };
      if (id) {
        await fetchApi(`/loads/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await fetchApi('/loads', { method: 'POST', body: JSON.stringify(payload) });
      }
      navigate('/loads');
    } catch (err: any) { setError(err.message); }
  };

  if (loading) return (
    <div className="flex h-[calc(100vh-65px)] items-center justify-center">
      <div className="glass-card p-8 text-muted-foreground">Loading...</div>
    </div>
  );

  const selectHint = selecting === 'pickup'
    ? '📍 Click the map to set Pickup'
    : selecting === 'drop'
      ? '📍 Click the map to set Drop'
      : null;

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-65px)]">
      {/* LEFT: Form */}
      <div className="md:w-1/2 m-3 mr-1.5 glass-card rounded-2xl overflow-y-auto p-6 space-y-5">
        <div>
          <h1 className="text-2xl font-bold">{id ? 'Edit Consignment' : 'Post Consignment Request'}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Automated return freight matching with dynamic fuel-indexed pricing
          </p>
        </div>

        {error && <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg border border-destructive/20">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Pickup */}
          <div className="bg-white/40 p-4 rounded-xl border border-white/60 space-y-3">
            <h2 className="font-semibold text-xs uppercase tracking-widest text-primary">1. Pickup Details</h2>

            <LocationInput
              label="Pickup Location"
              value={formData.pickupName}
              onChangeName={(name) => setFormData(prev => ({ ...prev, pickupName: name }))}
              onSelect={(lat, lng, name) => { setPickup([lat, lng]); setFormData(prev => ({ ...prev, pickupName: name })); }}
            />
            <div className="flex gap-2">
              <button type="button" className="flex-1 py-1.5 text-xs bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 text-blue-700 font-medium" onClick={getCurrentLocation}>
                📍 Use My Location
              </button>
              <button type="button" onClick={() => setSelecting(selecting === 'pickup' ? null : 'pickup')}
                className={`flex-1 py-1.5 text-xs rounded-lg border font-medium transition ${selecting === 'pickup' ? 'bg-primary text-white' : 'bg-white/60 hover:bg-white/80'}`}>
                {pickup ? '✅ Pickup Set' : '🗺 Pick on Map'}
              </button>
            </div>
            <div>
              <label className="block text-[11px] font-medium mb-1 text-muted-foreground">Pickup Schedule</label>
              <input type="datetime-local" name="pickupTime" value={formData.pickupTime} onChange={handleChange} className="glass-input w-full p-2 rounded-lg text-xs" />
            </div>
          </div>

          {/* Drop */}
          <div className="bg-white/40 p-4 rounded-xl border border-white/60 space-y-3">
            <h2 className="font-semibold text-xs uppercase tracking-widest text-primary">2. Drop Destination</h2>

            <LocationInput
              label="Drop Location"
              value={formData.dropName}
              onChangeName={(name) => setFormData(prev => ({ ...prev, dropName: name }))}
              onSelect={(lat, lng, name) => { setDrop([lat, lng]); setFormData(prev => ({ ...prev, dropName: name })); }}
            />
            <button type="button" onClick={() => setSelecting(selecting === 'drop' ? null : 'drop')}
              className={`w-full py-1.5 text-xs rounded-lg border font-medium transition ${selecting === 'drop' ? 'bg-primary text-white' : 'bg-white/60 hover:bg-white/80'}`}>
              {drop ? '✅ Drop Destination Set' : '🗺 Pick Drop on Map'}
            </button>
            <div>
              <label className="block text-[11px] font-medium mb-1 text-muted-foreground">Expected Delivery Time</label>
              <input type="datetime-local" name="dropTime" value={formData.dropTime} onChange={handleChange} className="glass-input w-full p-2 rounded-lg text-xs" />
            </div>
          </div>

          {/* Load Cargo Specs */}
          <div className="bg-white/40 p-4 rounded-xl border border-white/60 space-y-3">
            <h2 className="font-semibold text-xs uppercase tracking-widest text-primary">3. Goods & Cargo Dimensions</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-[11px] font-medium mb-1 text-muted-foreground">Goods Category</label>
                <select
                  name="goodsCategory"
                  required
                  value={formData.goodsCategory}
                  onChange={handleChange}
                  className="glass-input w-full p-2.5 rounded-lg text-xs font-semibold bg-white border border-slate-300"
                >
                  {GOODS_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-[11px] font-medium mb-1 text-muted-foreground">Specific Cargo Details (Optional)</label>
                <input
                  type="text"
                  name="goodsDetail"
                  value={formData.goodsDetail}
                  onChange={handleChange}
                  placeholder="e.g. Cotton Bales, 20 Motor Pumps, Wooden Desks"
                  className="glass-input w-full p-2 rounded-lg text-xs"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-[11px] font-medium mb-1 text-muted-foreground">Weight (kg)</label>
                <input
                  type="number"
                  step="1"
                  name="weight"
                  required
                  value={formData.weight}
                  onChange={handleChange}
                  className="glass-input w-full p-2 rounded-lg text-xs font-bold"
                />
              </div>

              {/* 3 Separate Dimension Boxes */}
              <div className="col-span-2 bg-white/60 p-3 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-[11px] font-bold text-slate-700">Dimensions (Feet)</label>
                  <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                    Vol: {((parseFloat(formData.dimLength) || 0) * (parseFloat(formData.dimWidth) || 0) * (parseFloat(formData.dimHeight) || 0)).toFixed(1)} cu.ft
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-0.5">Length (ft)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      name="dimLength"
                      required
                      value={formData.dimLength}
                      onChange={handleChange}
                      placeholder="e.g. 4"
                      className="glass-input w-full p-2 rounded-lg text-xs font-bold text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-0.5">Width (ft)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      name="dimWidth"
                      required
                      value={formData.dimWidth}
                      onChange={handleChange}
                      placeholder="e.g. 3"
                      className="glass-input w-full p-2 rounded-lg text-xs font-bold text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-0.5">Height (ft)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      name="dimHeight"
                      required
                      value={formData.dimHeight}
                      onChange={handleChange}
                      placeholder="e.g. 3"
                      className="glass-input w-full p-2 rounded-lg text-xs font-bold text-center"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Dynamic ML / Real-world Price Estimate Card */}
          {pricingBreakdown && (
            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-blue-50 border border-emerald-200/80 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                    ⚡ Dynamic Fair Freight Calculation
                  </span>
                  <div className="text-[11px] text-muted-foreground">
                    Estimated Route: <strong>{pricingBreakdown.distanceKm} km</strong>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-emerald-700">
                    ₹{pricingBreakdown.finalEstimatedFare.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[10px] text-emerald-600 font-bold bg-emerald-100 px-1.5 py-0.5 rounded">
                    Includes 20% Return Rebate
                  </div>
                </div>
              </div>

              {/* Cost Breakdown Accordion */}
              <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-emerald-200/60 text-slate-700">
                <div>⛽ Diesel Expense: <strong>₹{pricingBreakdown.fuelExpense}</strong></div>
                <div>👨‍✈️ Driver Allowance: <strong>₹{pricingBreakdown.driverAllowance}</strong></div>
                <div>🔧 Vehicle & Maintenance: <strong>₹{pricingBreakdown.vehicleBaseRent + pricingBreakdown.wearAndTearCost}</strong></div>
                <div>🛣️ Tolls Estimate: <strong>₹{pricingBreakdown.tollEstimate}</strong></div>
              </div>

              <div className="p-2.5 rounded-lg bg-white/80 border border-emerald-200 text-xs flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800">10% Assurance Deposit:</span>
                  <div className="text-[10px] text-muted-foreground">Required on match confirmation to lock truck</div>
                </div>
                <span className="font-black text-primary text-sm">
                  ₹{pricingBreakdown.milestones.assurance10Percent.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={pricingLoading}
              className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 shadow transition text-sm flex items-center justify-center gap-2"
            >
              {pricingLoading ? 'Calculating Fair Freight...' : id ? 'Update Consignment' : '🚀 Post Consignment'}
            </button>
            <button type="button" onClick={() => navigate('/loads')} className="py-3 px-5 bg-white/60 border border-border rounded-xl hover:bg-white/80 font-medium text-sm transition">
              Cancel
            </button>
          </div>
        </form>
      </div>

      {/* RIGHT: Map */}
      <div className="md:w-1/2 m-3 ml-1.5 rounded-2xl overflow-hidden shadow-lg relative">
        {selectHint && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-primary text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium animate-pulse">
            {selectHint}
          </div>
        )}
        <Map
          source={pickup}
          sourceLabel={formData.pickupName}
          destination={drop}
          destinationLabel={formData.dropName}
          interactive={true}
          onLocationSelect={handleMapClick}
        />
      </div>
    </div>
  );
}
