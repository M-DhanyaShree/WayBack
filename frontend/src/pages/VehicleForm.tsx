import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchApi } from '../lib/api';

export default function VehicleForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(id ? true : false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    registrationNo: '',
    type: 'TRUCK',
    make: '',
    model: '',
    year: new Date().getFullYear().toString(),
    capacityWeight: '',
    capacityVolume: '',
    dimensions: '',
    isActive: true
  });

  useEffect(() => {
    if (id) {
      fetchApi(`/vehicles/${id}`).then(res => {
        const v = res.data.vehicle;
        setFormData({
          registrationNo: v.registrationNo,
          type: v.type,
          make: v.make,
          model: v.model,
          year: v.year.toString(),
          capacityWeight: v.capacityWeight.toString(),
          capacityVolume: v.capacityVolume.toString(),
          dimensions: v.dimensions || '',
          isActive: v.isActive
        });
        setLoading(false);
      }).catch(err => {
        setError(err.message);
        setLoading(false);
      });
    }
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (id) {
        await fetchApi(`/vehicles/${id}`, {
          method: 'PUT',
          body: JSON.stringify(formData),
        });
      } else {
        await fetchApi('/vehicles', {
          method: 'POST',
          body: JSON.stringify(formData),
        });
      }
      navigate('/vehicles');
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">{id ? 'Edit Vehicle' : 'Add Vehicle'}</h1>
      
      {error && <div className="p-3 mb-4 text-sm text-destructive bg-destructive/10 rounded">{error}</div>}

      <form onSubmit={handleSubmit} className="bg-card p-6 border rounded-xl space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Registration Number</label>
          <input type="text" name="registrationNo" required disabled={!!id} value={formData.registrationNo} onChange={handleChange} className="w-full p-2 border rounded bg-background" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <select name="type" value={formData.type} onChange={handleChange} className="w-full p-2 border rounded bg-background">
              <option value="TRUCK">Truck</option>
              <option value="MINI_TRUCK">Mini Truck</option>
              <option value="PICKUP">Pickup</option>
              <option value="TEMPO">Tempo</option>
              <option value="VAN">Van</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Year</label>
            <input type="number" name="year" required value={formData.year} onChange={handleChange} className="w-full p-2 border rounded bg-background" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Make (Brand)</label>
            <input type="text" name="make" required value={formData.make} onChange={handleChange} className="w-full p-2 border rounded bg-background" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Model</label>
            <input type="text" name="model" required value={formData.model} onChange={handleChange} className="w-full p-2 border rounded bg-background" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Capacity Weight (kg)</label>
            <input type="number" step="0.01" name="capacityWeight" required value={formData.capacityWeight} onChange={handleChange} className="w-full p-2 border rounded bg-background" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Capacity Volume (m³)</label>
            <input type="number" step="0.01" name="capacityVolume" required value={formData.capacityVolume} onChange={handleChange} className="w-full p-2 border rounded bg-background" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Dimensions (L x W x H)</label>
          <input type="text" name="dimensions" value={formData.dimensions} onChange={handleChange} placeholder="e.g. 10ft x 5ft x 5ft" className="w-full p-2 border rounded bg-background" />
        </div>

        <div className="flex items-center gap-2 mt-4">
          <input type="checkbox" name="isActive" id="isActive" checked={formData.isActive} onChange={handleChange} />
          <label htmlFor="isActive" className="text-sm">Vehicle is active and available</label>
        </div>

        <div className="flex gap-4 pt-4">
          <button type="submit" className="flex-1 p-2 bg-primary text-primary-foreground rounded hover:bg-primary/90">
            {id ? 'Update' : 'Save'} Vehicle
          </button>
          <button type="button" onClick={() => navigate('/vehicles')} className="flex-1 p-2 border rounded hover:bg-muted">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
