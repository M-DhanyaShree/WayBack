import { useState, useEffect } from 'react';
import { fetchApi } from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
}

function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <div className="bg-card border rounded-xl p-6 shadow-sm">
      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
      <div className="text-3xl font-bold">{value}</div>
      {sub && <div className="text-sm text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function DriverDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApi('/analytics/driver').then(res => {
      setData(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-muted-foreground">Loading driver analytics...</div>;
  if (!data) return <div className="p-8 text-muted-foreground">Could not load analytics.</div>;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <StatCard label="Trips Completed" value={data.tripsCompleted ?? 0} />
      <StatCard label="Recommendation Acceptance" value={`${Number(data.recommendationAcceptanceRate ?? 0).toFixed(1)}%`} />
      <StatCard label="Delivery Completion Rate" value={`${Number(data.deliveryCompletionRate ?? 0).toFixed(1)}%`} />
      <StatCard label="Total Earnings" value={`₹${Number(data.earnings ?? 0).toLocaleString()}`} sub="From successful deliveries" />
      <StatCard label="Daily Trip Utilization" value={Number(data.utilization ?? 0).toFixed(2)} sub="Avg trips/day since first trip" />
    </div>
  );
}

function CustomerDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApi('/analytics/customer').then(res => {
      setData(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-muted-foreground">Loading customer analytics...</div>;
  if (!data) return <div className="p-8 text-muted-foreground">Could not load analytics.</div>;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <StatCard label="Loads Created" value={data.loadsCreated ?? 0} />
      <StatCard label="Successful Deliveries" value={data.successfulDeliveries ?? 0} />
      <StatCard label="Total Spending" value={`₹${Number(data.spending ?? 0).toLocaleString()}`} sub="Across all completed payments" />
    </div>
  );
}

function AdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApi('/analytics/admin').then(res => {
      setData(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-muted-foreground">Loading admin analytics...</div>;
  if (!data) return <div className="p-8 text-muted-foreground">Could not load analytics.</div>;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold mb-4">Platform Metrics</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <StatCard label="Total Users" value={data.platformMetrics?.totalUsers ?? 0} />
          <StatCard label="Total Vehicles" value={data.platformMetrics?.totalVehicles ?? 0} />
          <StatCard label="Total Trips" value={data.platformMetrics?.totalTrips ?? 0} />
          <StatCard label="Total Loads" value={data.platformMetrics?.totalLoads ?? 0} />
          <StatCard label="Total Volume Processed" value={`₹${Number(data.platformMetrics?.totalVolumeProcessed ?? 0).toLocaleString()}`} sub="Sum of successful payments" />
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Recommendation Performance</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard label="Total Generated" value={data.recommendationPerformance?.totalGenerated ?? 0} />
          <StatCard label="Accepted" value={data.recommendationPerformance?.accepted ?? 0} />
          <StatCard label="Rejected" value={data.recommendationPerformance?.rejected ?? 0} />
          <StatCard label="Acceptance Rate" value={`${Number(data.recommendationPerformance?.acceptanceRate ?? 0).toFixed(1)}%`} />
        </div>
      </div>
    </div>
  );
}

export default function Analytics() {
  const { user } = useAuth();

  const renderDashboard = () => {
    switch (user?.role) {
      case 'DRIVER':      return <DriverDashboard />;
      case 'CUSTOMER':    return <CustomerDashboard />;
      case 'ADMIN':       return <AdminDashboard />;
      default:            return <div className="p-8 text-muted-foreground">No analytics available for your role.</div>;
    }
  };

  return (
    <div className="page-wrapper max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="text-muted-foreground mt-1">{user?.role} dashboard overview</p>
      </div>
      {renderDashboard()}
    </div>
  );
}
