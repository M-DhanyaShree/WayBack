import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchApi } from '../lib/api';

export default function Profile() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('info');
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Settings forms
  const [flexLevel, setFlexLevel] = useState('BALANCED');
  const [utilization, setUtilization] = useState(0.8);
  const [prefSaving, setPrefSaving] = useState(false);

  useEffect(() => {
    fetchApi('/profile').then(res => {
      setProfile(res.data.profile);
      if (res.data.driverPreference) {
         setFlexLevel(res.data.driverPreference.flexibilityLevel);
         setUtilization(res.data.driverPreference.preferredUtilization);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8">Loading profile...</div>;

  return (
    <div className="page-wrapper max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Profile Settings</h1>
      
      <div className="flex gap-4 border-b border-slate-200 mb-6">
        <button onClick={() => setActiveTab('info')} className={`pb-2 px-1 font-semibold ${activeTab === 'info' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}>Personal Info</button>
        {user?.role === 'DRIVER' && (
          <button onClick={() => setActiveTab('preferences')} className={`pb-2 px-1 font-semibold ${activeTab === 'preferences' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}>Preferences</button>
        )}
        <button onClick={() => setActiveTab('verification')} className={`pb-2 px-1 font-semibold ${activeTab === 'verification' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}>Verification</button>
        <button onClick={() => setActiveTab('support')} className={`pb-2 px-1 font-semibold ${activeTab === 'support' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}>Support Tickets</button>
      </div>

      {activeTab === 'info' && (
        <div className="glass-card p-6">
          <h2 className="text-xl font-bold mb-4">Personal Details</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-muted-foreground">Name</label>
              <div className="text-lg">{user?.name}</div>
            </div>
            <div>
              <label className="text-sm font-semibold text-muted-foreground">Email</label>
              <div className="text-lg">{user?.email}</div>
            </div>
            <div>
              <label className="text-sm font-semibold text-muted-foreground">Role</label>
              <div className="text-lg">{user?.role}</div>
            </div>
            <div>
              <label className="text-sm font-semibold text-muted-foreground">Phone</label>
              <div className="text-lg">{profile?.phone || 'Not provided'}</div>
            </div>
            <div>
              <label className="text-sm font-semibold text-muted-foreground">Address</label>
              <div className="text-lg">{profile?.address || 'Not provided'}</div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'preferences' && user?.role === 'DRIVER' && (
        <div className="glass-card p-6">
          <h2 className="text-xl font-bold mb-4">Driver Preferences</h2>
          <p className="text-sm text-muted-foreground mb-6">Configure how the AI matches return loads for you.</p>
          
          <div className="space-y-6 max-w-lg">
            <div>
              <label className="block text-sm font-semibold mb-2">Flexibility Level</label>
              <select value={flexLevel} onChange={e => setFlexLevel(e.target.value)} className="glass-input w-full p-2.5 rounded-lg text-sm">
                <option value="STRICT">Strict (Minimal detours, exact timing)</option>
                <option value="BALANCED">Balanced (Standard matching)</option>
                <option value="FLEXIBLE">Flexible (Larger detours permitted)</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-semibold mb-2">Minimum Capacity Utilization (%)</label>
              <input type="number" step="0.01" max="1" min="0" value={utilization} onChange={e => setUtilization(parseFloat(e.target.value))} className="glass-input w-full p-2.5 rounded-lg text-sm" />
              <div className="text-xs text-muted-foreground mt-1">E.g. 0.8 means only match loads that fill at least 80% of your vehicle.</div>
            </div>

            <button 
               onClick={async () => {
                 setPrefSaving(true);
                 await fetchApi('/profile/preferences', {
                   method: 'PUT',
                   body: JSON.stringify({ flexibilityLevel: flexLevel, preferredUtilization: utilization })
                 });
                 setPrefSaving(false);
                 alert('Preferences updated successfully!');
               }}
               disabled={prefSaving}
               className="bg-primary text-white py-2 px-4 rounded-lg font-semibold hover:bg-primary/90 transition disabled:opacity-50"
            >
              {prefSaving ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'verification' && (
        <div className="glass-card p-6">
          <h2 className="text-xl font-bold mb-4">Account Verification</h2>
          <div className="mb-4">
            Status: <span className="font-bold text-amber-600">Pending</span>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Please upload your documents for verification.</p>
          <div className="space-y-4">
            <input type="text" placeholder="ID Document URL" className="w-full p-2 border rounded" />
            <input type="text" placeholder="Address Proof URL" className="w-full p-2 border rounded" />
            <button className="px-4 py-2 bg-primary text-white rounded">Submit for Verification</button>
          </div>
        </div>
      )}

      {activeTab === 'support' && (
        <div className="glass-card p-6">
          <h2 className="text-xl font-bold mb-4">Support Tickets</h2>
          <p className="text-sm text-muted-foreground mb-4">Need help? Create a ticket.</p>
          <div className="space-y-4">
            <input type="text" placeholder="Subject" className="w-full p-2 border rounded" />
            <textarea placeholder="Describe your issue..." className="w-full p-2 border rounded h-32"></textarea>
            <button className="px-4 py-2 bg-primary text-white rounded">Submit Ticket</button>
          </div>
        </div>
      )}
    </div>
  );
}
