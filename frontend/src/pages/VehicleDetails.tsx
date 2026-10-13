import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchApi } from '../lib/api';

export default function VehicleDetails() {
  const { id } = useParams();
  const [vehicle, setVehicle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchApi(`/vehicles/${id}`)
      .then(res => {
        setVehicle(res.data.vehicle);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8 text-destructive">{error}</div>;

  return (
    <div className="max-w-3xl mx-auto p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Vehicle Details</h1>
        <div className="flex gap-2">
          <Link to={`/vehicles/${id}/edit`} className="bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90">
            Edit
          </Link>
          <Link to="/vehicles" className="border px-4 py-2 rounded hover:bg-muted">
            Back
          </Link>
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        <div className="p-6 border-b bg-muted/10">
          <h2 className="text-2xl font-bold">{vehicle.make} {vehicle.model} ({vehicle.year})</h2>
          <div className="flex items-center gap-2 mt-2">
            <span className="bg-secondary px-2 py-1 rounded text-xs font-medium">{vehicle.type}</span>
            <span className={`px-2 py-1 rounded text-xs font-medium ${vehicle.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {vehicle.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h3 className="font-semibold text-lg mb-4">Specifications</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b pb-1">
                <span className="text-muted-foreground">Registration No</span>
                <span className="font-medium">{vehicle.registrationNo}</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="text-muted-foreground">Capacity (Weight)</span>
                <span className="font-medium">{vehicle.capacityWeight} kg</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="text-muted-foreground">Capacity (Volume)</span>
                <span className="font-medium">{vehicle.capacityVolume} m³</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="text-muted-foreground">Dimensions</span>
                <span className="font-medium">{vehicle.dimensions || 'N/A'}</span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="text-muted-foreground">Added On</span>
                <span className="font-medium">{new Date(vehicle.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {vehicle.owner && (
            <div>
              <h3 className="font-semibold text-lg mb-4">Owner Information</h3>
              <div className="space-y-3 text-sm bg-muted/20 p-4 rounded border">
                <div><span className="text-muted-foreground">Name:</span> {vehicle.owner.name}</div>
                <div><span className="text-muted-foreground">Email:</span> {vehicle.owner.email}</div>
                {vehicle.owner.phone && <div><span className="text-muted-foreground">Phone:</span> {vehicle.owner.phone}</div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
