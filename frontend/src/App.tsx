import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Link } from 'react-router-dom';

import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Profile from './pages/Profile';
import Vehicles from './pages/Vehicles';
import VehicleForm from './pages/VehicleForm';
import VehicleDetails from './pages/VehicleDetails';
import Loads from './pages/Loads';
import LoadForm from './pages/LoadForm';
import LoadDetails from './pages/LoadDetails';
import TrackLoad from './pages/TrackLoad';
import Trips from './pages/Trips';
import StartTrip from './pages/StartTrip';
import Recommendations from './pages/Recommendations';
import ActiveTripTracking from './pages/ActiveTripTracking';
import Payments from './pages/Payments';
import Analytics from './pages/Analytics';
import Reviews from './pages/Reviews';
import AdminDashboard from './pages/AdminDashboard';
import NotificationsDropdown from './components/NotificationsDropdown';
import ChatDrawer from './components/ChatDrawer';
import { ChatProvider, useChat } from './context/ChatContext';

const queryClient = new QueryClient();

import { Outlet } from 'react-router-dom';

function ProtectedRoute({ children, allowedRoles }: { children?: React.ReactNode, allowedRoles?: string[] }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading WayBack...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" replace />;
  return children ? <>{children}</> : <Outlet />;
}

function Navbar() {
  const { user, logout } = useAuth();
  const { openChat, unreadTotal } = useChat();
  if (!user) return null;

  return (
    <nav className="p-4 flex justify-between items-center glass-nav sticky top-0 z-50">
      <div className="flex items-center gap-6">
        <Link to="/" className="font-extrabold text-xl tracking-tight text-primary">WayBack</Link>
        <div className="hidden md:flex items-center gap-4">
          <Link to="/" className="text-sm font-medium hover:text-primary transition-colors">Dashboard</Link>
          
          {(user.role === 'CUSTOMER' || user.role === 'ADMIN') && (
            <Link to="/loads" className="text-sm font-medium hover:text-primary transition-colors">Loads</Link>
          )}

          {(user.role === 'DRIVER' || user.role === 'ADMIN') && (
            <>
              <Link to="/trips" className="text-sm font-medium hover:text-primary transition-colors">Trips</Link>
              <Link to="/vehicles" className="text-sm font-medium hover:text-primary transition-colors">Vehicles</Link>
            </>
          )}

          <Link to="/payments" className="text-sm font-medium hover:text-primary transition-colors">Payments</Link>
          <Link to="/reviews" className="text-sm font-medium hover:text-primary transition-colors">Reviews</Link>
          {user.role === 'ADMIN' && (
            <Link to="/admin" className="text-sm font-bold text-purple-700 hover:text-purple-900 transition-colors bg-purple-100 px-3 py-1 rounded-full">⚙ Admin</Link>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
        {/* Chat / Messenger Icon */}
        <button
          onClick={() => openChat()}
          className="p-2 bg-white/50 rounded-full hover:bg-white/80 transition relative cursor-pointer"
          title="Direct Messenger"
        >
          💬
          {unreadTotal > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full text-white text-[10px] flex items-center justify-center font-bold">
              {unreadTotal > 9 ? '9+' : unreadTotal}
            </span>
          )}
        </button>

        <NotificationsDropdown />

        {user.role === 'DRIVER' && (
          <Link to="/trips/tracking" className="px-3 py-1 text-xs font-bold text-green-700 bg-green-100 rounded-full flex items-center gap-2 hover:bg-green-200 transition-colors">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Live Map
          </Link>
        )}

        <Link to="/profile" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 rounded-full bg-muted overflow-hidden">
            {user.profile?.avatarUrl ? (
              <img src={user.profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-primary/20 text-primary font-bold">
                {user.name?.charAt(0)}
              </div>
            )}
          </div>
        </Link>
        <button onClick={logout} className="text-sm font-bold text-destructive hover:text-destructive/80 transition-colors">
          Logout
        </button>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ChatProvider>
          <BrowserRouter>
            <div className="min-h-screen flex flex-col">
              <Navbar />
              <ChatDrawer />
              <main className="flex-1 flex flex-col">
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                <Route element={<ProtectedRoute />}>
                  <Route path="/" element={<Home />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/payments" element={<Payments />} />
                  <Route path="/reviews" element={<Reviews />} />

                  <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
                    <Route path="/admin" element={<AdminDashboard />} />
                    <Route path="/analytics" element={<Analytics />} />
                  </Route>

                  <Route element={<ProtectedRoute allowedRoles={['DRIVER', 'ADMIN']} />}>
                    <Route path="/vehicles" element={<Vehicles />} />
                    <Route path="/vehicles/new" element={<VehicleForm />} />
                    <Route path="/vehicles/:id" element={<VehicleDetails />} />
                    <Route path="/vehicles/:id/edit" element={<VehicleForm />} />
                  </Route>

                  <Route element={<ProtectedRoute allowedRoles={['DRIVER', 'ADMIN']} />}>
                    <Route path="/trips" element={<Trips />} />
                    <Route path="/trips/start" element={<StartTrip />} />
                    <Route path="/trips/:tripId/recommendations" element={<Recommendations />} />
                    <Route path="/trips/tracking" element={<ActiveTripTracking />} />
                  </Route>

                  <Route element={<ProtectedRoute allowedRoles={['CUSTOMER', 'ADMIN']} />}>
                    <Route path="/loads" element={<Loads />} />
                    <Route path="/loads/new" element={<LoadForm />} />
                    <Route path="/loads/:id" element={<LoadDetails />} />
                    <Route path="/loads/:id/edit" element={<LoadForm />} />
                    <Route path="/loads/:id/track" element={<TrackLoad />} />
                  </Route>
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
        </ChatProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
