import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchApi } from '../lib/api';

export default function Vehicles() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');

  const loadVehicles = async () => {
    try {
      const query = new URLSearchParams();
      if (search) query.append('search', search);
      if (type) query.append('type', type);
      
      const res = await fetchApi(`/vehicles?${query.toString()}`);
      setVehicles(res.data.vehicles);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVehicles();
  }, [search, type]);

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this vehicle?')) {
      try {
        await fetchApi(`/vehicles/${id}`, { method: 'DELETE' });
        loadVehicles();
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">My Vehicles</h1>
        <Link to="/vehicles/new" className="bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90">
          Add Vehicle
        </Link>
      </div>

      <div className="flex gap-4 mb-6">
        <input 
          type="text" 
          placeholder="Search vehicles..." 
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="p-2 border rounded flex-1 bg-background"
        />
        <select 
          value={type} 
          onChange={e => setType(e.target.value)}
          className="p-2 border rounded bg-background"
        >
          <option value="">All Types</option>
          <option value="TRUCK">Truck</option>
          <option value="MINI_TRUCK">Mini Truck</option>
          <option value="PICKUP">Pickup</option>
          <option value="TEMPO">Tempo</option>
          <option value="VAN">Van</option>
          <option value="OTHER">Other</option>
        </select>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : vehicles.length === 0 ? (
        <div className="p-8 text-center bg-muted/20 rounded border">No vehicles found.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {vehicles.map(v => (
            <div key={v.id} className="bg-card border rounded-lg p-4 shadow-sm flex flex-col">
              <h3 className="font-bold text-lg">{v.make} {v.model} ({v.year})</h3>
              <p className="text-sm text-muted-foreground mb-4">{v.registrationNo} • {v.type}</p>
              
              <div className="mt-auto flex gap-2">
                <Link to={`/vehicles/${v.id}`} className="text-sm border px-3 py-1 rounded hover:bg-muted text-center flex-1">View</Link>
                <Link to={`/vehicles/${v.id}/edit`} className="text-sm border px-3 py-1 rounded hover:bg-muted text-center flex-1">Edit</Link>
                <button onClick={() => handleDelete(v.id)} className="text-sm border border-destructive text-destructive px-3 py-1 rounded hover:bg-destructive/10">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
