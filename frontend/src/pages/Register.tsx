import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { fetchApi } from '../lib/api';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('CUSTOMER');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchApi('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, name, role }),
      });
      navigate('/login');
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    document.body.classList.add('auth-bg');
    return () => {
      document.body.classList.remove('auth-bg');
    };
  }, []);

  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <div className="glass-card w-full max-w-md p-10 text-foreground">
        <div className="flex flex-col items-center mb-8">
          <span className="text-4xl font-extrabold text-primary tracking-tight mb-1">WayBack</span>
          <span className="text-sm text-muted-foreground">Logistics & Transport Platform</span>
        </div>

        <h2 className="text-xl font-bold text-center mb-6">Create an account</h2>

        {error && <div className="p-3 mb-4 text-sm text-destructive bg-destructive/10 rounded-lg border border-destructive/20">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              required
              className="glass-input w-full p-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              required
              className="glass-input w-full p-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              required
              className="glass-input w-full p-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Role</label>
            <select
              className="glass-input w-full p-3 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="CUSTOMER">Customer (Sender/Receiver)</option>
              <option value="DRIVER">Driver / Fleet Owner</option>
            </select>
          </div>
          <button type="submit" className="w-full p-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors shadow-md mt-2">
            Sign Up
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account? <Link to="/login" className="text-primary font-semibold hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}
