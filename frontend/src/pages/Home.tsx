import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchApi } from '../lib/api';
import { Link } from 'react-router-dom';

export default function Home() {
  const { user } = useAuth();
  const [contextData, setContextData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationError, setLocationError] = useState(false);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const res = await fetchApi(`/dashboard/context?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`);
            setContextData(res.data.items || []);
          } catch (err) {
            console.error(err);
          } finally {
            setLoading(false);
          }
        },
        (err) => {
          console.error("Location permission denied", err);
          setLocationError(true);
          setLoading(false);
        }
      );
    } else {
      setLocationError(true);
      setLoading(false);
    }
  }, []);

  return (
    <div className="page-wrapper max-w-7xl mx-auto px-4 py-8">
      {/* Header Section */}
      <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-extrabold text-foreground tracking-tight mb-2">
            Welcome back, <span className="text-primary">{user?.name}</span> 👋
          </h1>
          <p className="text-muted-foreground text-lg">
            {user?.role === 'DRIVER' 
              ? 'Find loads and manage your active trips.' 
              : user?.role === 'CUSTOMER' 
              ? 'Book trucks and track your shipments.' 
              : 'Monitor platform activity and users.'}
          </p>
        </div>
        
        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3">
          {user?.role === 'DRIVER' && (
            <>
              <Link to="/trips/start" className="px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition shadow-lg shadow-primary/20 flex items-center gap-2">
                🚀 Start a Trip
              </Link>
              <Link to="/vehicles/new" className="px-6 py-2.5 bg-white/70 text-foreground font-semibold rounded-xl border border-white/50 hover:bg-white transition flex items-center gap-2">
                🚛 Add Vehicle
              </Link>
            </>
          )}
          {user?.role === 'CUSTOMER' && (
            <Link to="/loads/new" className="px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition shadow-lg shadow-primary/20 flex items-center gap-2">
              📦 Create New Load
            </Link>
          )}
          {user?.role === 'ADMIN' && (
            <Link to="/admin" className="px-6 py-2.5 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 transition shadow-lg shadow-purple-600/20 flex items-center gap-2">
              ⚙️ Admin Console
            </Link>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Left Column (Quick Links & Profile Summary) */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-card p-6 rounded-3xl border border-white/50 shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-primary/20 text-primary flex items-center justify-center text-2xl font-bold mb-4">
              {user?.name?.charAt(0)}
            </div>
            <h2 className="font-bold text-lg text-foreground">{user?.name}</h2>
            <p className="text-sm text-muted-foreground mb-4">{user?.email}</p>
            <div className="pt-4 border-t border-white/30 space-y-3">
              <Link to="/profile" className="block text-sm font-medium text-slate-700 hover:text-primary transition">👤 My Profile</Link>
              <Link to="/payments" className="block text-sm font-medium text-slate-700 hover:text-primary transition">💳 Payments & Wallet</Link>
            </div>
          </div>

          <div className="glass-card p-6 rounded-3xl border border-white/50 shadow-sm bg-gradient-to-br from-blue-50/50 to-indigo-50/50">
            <h3 className="font-bold text-sm text-blue-900 mb-2">Did you know?</h3>
            <p className="text-xs text-blue-800/80 leading-relaxed">
              Completing your profile verification increases your Trust Score and gives you priority access to {user?.role === 'DRIVER' ? 'premium loads' : 'verified drivers'}.
            </p>
          </div>
        </div>

        {/* Right Column (Live Context Map) */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-foreground">
              {user?.role === 'DRIVER' ? '📍 Loads Near You' : '📍 Active Loads & Vehicles Near You'}
            </h2>
            {loading && <span className="text-xs font-semibold px-3 py-1 bg-white/60 rounded-full animate-pulse text-muted-foreground">Scanning area...</span>}
          </div>

          {locationError ? (
            <div className="glass-card p-8 bg-amber-500/10 border-amber-400/30 rounded-3xl text-center">
              <div className="text-4xl mb-3">🧭</div>
              <h3 className="font-bold text-amber-900 mb-2">Location access required</h3>
              <p className="text-sm text-amber-800/80 max-w-md mx-auto mb-4">We need your location to show you real-time opportunities in your area.</p>
              <button onClick={() => window.location.reload()} className="px-5 py-2 bg-amber-500 text-white rounded-xl text-sm font-bold shadow-sm hover:bg-amber-600 transition">
                Retry Location Access
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {!loading && contextData.length === 0 && (
                <div className="col-span-full glass-card p-12 rounded-3xl text-center border-dashed">
                  <div className="text-4xl mb-3 opacity-50">🔭</div>
                  <p className="text-muted-foreground font-medium">It's quiet around here. Check back later for new updates.</p>
                </div>
              )}
              
              {contextData.map((item: any) => (
                <div key={item.id} className="glass-card p-5 rounded-3xl border border-white/60 shadow-sm hover:shadow-lg transition-all hover:-translate-y-1">
                  {user?.role === 'DRIVER' || item.itemType === 'LOAD' || item.goodsCategory ? (
                    // Render Load Card
                    <>
                      <div className="flex justify-between items-start mb-3">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                          item.status === 'PENDING' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {item.status || 'New Request'}
                        </span>
                        <span className="text-lg font-extrabold text-foreground">₹{(item.budget || 0).toLocaleString('en-IN')}</span>
                      </div>
                      <h3 className="font-bold text-base mb-1 truncate">{item.goodsCategory || 'Load'}</h3>
                      <p className="text-xs font-semibold text-muted-foreground mb-4">{item.weight} kg {item.customer?.name ? `• ${item.customer.name}` : ''}</p>
                      
                      <div className="space-y-3 relative before:absolute before:inset-y-2 before:left-[7px] before:w-0.5 before:bg-slate-200">
                        <div className="flex items-start gap-3 relative z-10">
                          <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-sm mt-0.5 shrink-0"></div>
                          <div className="min-w-0">
                            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Pickup</div>
                            <div className="text-sm font-medium text-foreground truncate" title={item.pickupName}>{item.pickupName?.split(',')[0] || item.pickupName}</div>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 relative z-10">
                          <div className="w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow-sm mt-0.5 shrink-0"></div>
                          <div className="min-w-0">
                            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Drop</div>
                            <div className="text-sm font-medium text-foreground truncate" title={item.dropName}>{item.dropName?.split(',')[0] || item.dropName}</div>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    // Render Trip / Vehicle Card
                    <>
                      <div className="flex justify-between items-start mb-3">
                        <span className="bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase">In Transit</span>
                        <span className="text-xs font-medium bg-slate-100 px-2 py-0.5 rounded text-slate-600">{item.status || 'Active Trip'}</span>
                      </div>
                      <h3 className="font-bold text-lg mb-1">{item.vehicle?.make || 'Vehicle'} {item.vehicle?.model || ''}</h3>
                      <p className="text-xs font-semibold text-muted-foreground mb-4">
                        {item.vehicle?.type || 'Truck'} • Cap: {item.vehicle?.capacityWeight || 0}kg • {item.driver?.name || 'Driver'}
                      </p>
                      <div className="bg-white/50 p-3 rounded-xl border border-white/60 flex items-start gap-3">
                        <div className="text-lg mt-0.5">🏁</div>
                        <div className="min-w-0">
                          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Dropping off near you</div>
                          <div className="text-sm font-medium text-foreground truncate">{item.destName || 'Destination'}</div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
