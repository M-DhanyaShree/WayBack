import { useState, useEffect } from 'react';
import { fetchApi } from '../lib/api';

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApi('/dashboard/admin-stats').then(res => {
      setStats(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8">Loading Admin Dashboard...</div>;

  return (
    <div className="page-wrapper max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Admin Control Panel</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="glass-card p-5 text-center">
          <div className="text-muted-foreground text-sm uppercase font-bold">Total Users</div>
          <div className="text-3xl font-black">{stats?.totalUsers || 0}</div>
        </div>
        <div className="glass-card p-5 text-center">
          <div className="text-muted-foreground text-sm uppercase font-bold">Total Trips</div>
          <div className="text-3xl font-black">{stats?.totalTrips || 0}</div>
        </div>
        <div className="glass-card p-5 text-center">
          <div className="text-muted-foreground text-sm uppercase font-bold">Pending Verifications</div>
          <div className="text-3xl font-black text-amber-600">{stats?.pendingVerifications || 0}</div>
        </div>
        <div className="glass-card p-5 text-center">
          <div className="text-muted-foreground text-sm uppercase font-bold">Open Tickets</div>
          <div className="text-3xl font-black text-red-600">{stats?.openTickets || 0}</div>
        </div>
      </div>

      <div className="glass-card p-6">
        <h2 className="text-xl font-bold mb-4">Verification Queue</h2>
        <div className="p-4 text-center text-muted-foreground border-2 border-dashed rounded-xl">
          No pending verifications at the moment.
        </div>
      </div>
    </div>
  );
}
