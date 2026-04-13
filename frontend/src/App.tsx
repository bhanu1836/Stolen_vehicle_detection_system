import { FormEvent, Suspense, useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { LogOut, Menu, Search, Shield, Trash2, X } from 'lucide-react';
import { lazy } from 'react';

const LandingPage = lazy(() => import('./components/LandingPage'));
const UnifiedAuth = lazy(() => import('./components/UnifiedAuth'));
const AnalyticsPanel = lazy(() => import('./components/AnalyticsPanel'));
const AdminManagement = lazy(() => import('./components/AdminManagement'));
const DetectionHistory = lazy(() => import('./components/DetectionHistory'));

type UserRole = 'customer' | 'admin' | 'police';

interface AuthUser {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
}

interface UserListItem extends AuthUser {
  phone?: string;
  is_active?: boolean;
}

interface AuthResponse {
  token: string;
  user: AuthUser;
}

interface Vehicle {
  id: string;
  vehicle_number: string;
  vehicle_type: string;
  make: string;
  model: string;
  color: string;
  last_seen_location: string;
  last_seen_time: string;
  notes: string;
  status: string;
}

interface CaseItem {
  id: string;
  status: string;
  vehicle?: Vehicle;
  customer?: { full_name: string; email: string; phone?: string };
  latest_detection?: { location: string; detected_at?: string; plate_number?: string };
}

interface Insights {
  total_users: number;
  total_customers: number;
  total_police: number;
  active_theft_reports: number;
  found_vehicles: number;
  open_cases: number;
}

interface DetectionResult {
  plate_number?: string;
  match_found?: boolean;
  case_id?: string;
}

interface DailyAnalytics {
  date: string;
  detections: number;
  matches: number;
}

const API_BASE = 'http://localhost:8000';
const getErrorMessage = (error: unknown): string => error instanceof Error ? error.message : 'Unexpected error occurred';

const initialVehicleForm = {
  vehicle_number: '',
  vehicle_type: 'Car',
  make: '',
  model: '',
  color: '',
  last_seen_location: '',
  last_seen_time: '',
  notes: '',
};

function App() {
  const webcamRef = useRef<Webcam | null>(null);

  // Auth states
  const [token, setToken] = useState(() => localStorage.getItem('token') || '');
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [authError, setAuthError] = useState('');
  
  // UI states
  const [showUnifiedAuth, setShowUnifiedAuth] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Customer states
  const [vehicleForm, setVehicleForm] = useState(initialVehicleForm);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  
  // Admin states
  const [insights, setInsights] = useState<Insights | null>(null);
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [captureLocation, setCaptureLocation] = useState('Main Gate Camera');
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [dailyAnalytics, setDailyAnalytics] = useState<DailyAnalytics[]>([]);
  const [newStaff, setNewStaff] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'police' as 'admin' | 'police',
    phone: '',
  });
  const [adminTab, setAdminTab] = useState<'dashboard' | 'users' | 'detections'>('dashboard');
  
  // Police states
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [searchCase, setSearchCase] = useState('');
  
  // Search/filter state
  // Note: searchVehicle, searchUser for future filtering UI

  const isCustomer = user?.role === 'customer';
  const isAdmin = user?.role === 'admin';
  const isPolice = user?.role === 'police';

  // Message auto-clear
  useEffect(() => {
    if (!message && !error && !authError) return;
    const timeout = setTimeout(() => {
      setMessage('');
      setError('');
      setAuthError('');
    }, 4000);
    return () => clearTimeout(timeout);
  }, [message, error, authError]);

  // Persist auth
  useEffect(() => {
    if (token) localStorage.setItem('token', token);
    if (user) localStorage.setItem('user', JSON.stringify(user));
  }, [token, user]);

  const request = async (path: string, options: RequestInit = {}, useAuth = false, authToken?: string) => {
    const activeToken = authToken ?? token;
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: useAuth
        ? { 'Content-Type': 'application/json', Authorization: `Bearer ${activeToken}`, ...options.headers }
        : options.headers,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || data.error || 'Request failed');
    return data;
  };

  const handleUnifiedAuth = async (email: string, password: string, isRegister: boolean, fullName?: string, phone?: string) => {
    try {
      setAuthError('');
      setIsAuthLoading(true);
      
      const payload = isRegister
        ? { full_name: fullName, email, phone: phone || '', password }
        : { email, password };

      const path = isRegister ? '/auth/customer/register' : '/auth/login';
      const data: AuthResponse = await request(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      // Auto-detect role from response
      setToken(data.token);
      setUser(data.user);
      setShowUnifiedAuth(false);
      setMessage(`Welcome ${data.user.full_name}! Role: ${data.user.role.toUpperCase()}`);
      
      // Load role-specific data
      if (data.user.role === 'customer') {
        const vehicleData = await request('/customer/stolen-vehicles', {}, true, data.token);
        setVehicles(vehicleData.vehicles || []);
      } else if (data.user.role === 'admin') {
        const [insights, users, analytics] = await Promise.all([
          request('/admin/insights', {}, true, data.token),
          request('/admin/users', {}, true, data.token),
          request('/admin/analytics/daily?days=7', {}, true, data.token),
        ]);
        setInsights(insights);
        setUsers(users.users || []);
        setDailyAnalytics(analytics.daily || []);
      } else if (data.user.role === 'police') {
        const caseData = await request('/police/cases', {}, true, data.token);
        setCases(caseData.cases || []);
      }
    } catch (err) {
      setAuthError(getErrorMessage(err));
      throw err;
    } finally {
      setIsAuthLoading(false);
    }
  };

  const submitVehicle = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      await request('/customer/stolen-vehicles', {
        method: 'POST',
        body: JSON.stringify({ ...vehicleForm, last_seen_time: new Date(vehicleForm.last_seen_time).toISOString() }),
      }, true);
      
      const data = await request('/customer/stolen-vehicles', {}, true);
      setVehicles(data.vehicles || []);
      setVehicleForm(initialVehicleForm);
      setMessage('Vehicle reported successfully!');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const handleDetection = async () => {
    try {
      setIsDetecting(true);
      setError('');
      const frames: string[] = [];
      for (let i = 0; i < 3; i++) {
        const frame = webcamRef.current?.getScreenshot();
        if (frame) frames.push(frame);
        await new Promise(r => setTimeout(r, 100));
      }

      if (!frames.length) throw new Error('No frames captured');

      const result = await request('/admin/detect', {
        method: 'POST',
        body: JSON.stringify({ location: captureLocation, frames: frames.map(data => ({ data })) }),
      }, true);

      setDetectionResult(result);
      setMessage(result.match_found ? 'Match found! Case created.' : 'No matches found.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsDetecting(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken('');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setVehicles([]);
    setCases([]);
    setUsers([]);
    setMessage('Logged out successfully');
  };

  const handleAddStaff = async () => {
    try {
      setError('');
      if (!newStaff.full_name || !newStaff.email || !newStaff.password) {
        setError('Please fill in all required fields');
        return;
      }
      if (newStaff.password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
      
      const data = await request('/admin/users/staff', {
        method: 'POST',
        body: JSON.stringify(newStaff),
      }, true);
      
      setUsers([...users, data.user]);
      setNewStaff({
        full_name: '',
        email: '',
        password: '',
        role: 'police' as 'admin' | 'police',
        phone: '',
      });
      setMessage(`Staff added successfully! ${newStaff.role.toUpperCase()} account created.`);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  // Filtered data
  const filteredCases = cases.filter(c => c.vehicle?.vehicle_number.toLowerCase().includes(searchCase.toLowerCase()));

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a1428] via-[#0d1b2a] to-[#1a3a52]">
        <Suspense fallback={<div className="flex h-screen items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>}>
          <UnifiedAuth
            isOpen={showUnifiedAuth}
            onClose={() => setShowUnifiedAuth(false)}
            onSuccess={handleUnifiedAuth}
            error={authError}
            isLoading={isAuthLoading}
          />
          <LandingPage onLogin={() => setShowUnifiedAuth(true)} />
        </Suspense>
      </div>
    );
  }

  // Authenticated app
  return (
    <div className="min-h-screen bg-[#0a0e27] text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-blue-950/50 bg-[#0d1635]/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-blue-400" />
              <h1 className="text-lg font-bold truncate">Smart Plate AI</h1>
            </div>

            <div className="hidden sm:flex items-center gap-4">
              <span className="px-3 py-1 rounded-full bg-blue-950/50 text-sm font-medium text-blue-300">
                {user.role.toUpperCase()}
              </span>
              <p className="text-sm text-slate-400">{user.full_name}</p>
              <button
                onClick={logout}
                className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="sm:hidden p-2 hover:bg-slate-800 rounded-lg"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="mt-4 space-y-2 border-t border-slate-800 pt-4">
              <p className="text-sm text-slate-400">{user.role.toUpperCase()} • {user.full_name}</p>
              <button
                onClick={() => {
                  logout();
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-slate-700 hover:bg-slate-800"
              >
                <LogOut className="h-4 w-4" /> Logout
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {message && <div className="mb-4 rounded-lg border border-emerald-700 bg-emerald-900/20 px-4 py-3 text-emerald-300">{message}</div>}
        {error && <div className="mb-4 rounded-lg border border-rose-700 bg-rose-900/20 px-4 py-3 text-rose-300">{error}</div>}

        {/* Customer Dashboard */}
        {isCustomer && (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              {/* Report Vehicle */}
              <section className="rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900/50 to-slate-950 p-6">
                <h2 className="mb-4 text-xl font-bold">Report Stolen Vehicle</h2>
                <form className="grid gap-3 sm:grid-cols-2" onSubmit={submitVehicle}>
                  <input
                    id="vehicleNumber"
                    required
                    placeholder="Number Plate (e.g., DL01AB1234)"
                    aria-label="Number Plate"
                    value={vehicleForm.vehicle_number}
                    onChange={(e) => setVehicleForm(prev => ({ ...prev, vehicle_number: e.target.value }))}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <select
                    id="vehicleType"
                    required
                    aria-label="Vehicle Type"
                    value={vehicleForm.vehicle_type}
                    onChange={(e) => setVehicleForm(prev => ({ ...prev, vehicle_type: e.target.value }))}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option>Car</option>
                    <option>Bike</option>
                    <option>SUV</option>
                    <option>Truck</option>
                  </select>
                  <input
                    placeholder="Make"
                    value={vehicleForm.make}
                    onChange={(e) => setVehicleForm(prev => ({ ...prev, make: e.target.value }))}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <input
                    placeholder="Model"
                    value={vehicleForm.model}
                    onChange={(e) => setVehicleForm(prev => ({ ...prev, model: e.target.value }))}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <input
                    placeholder="Color"
                    value={vehicleForm.color}
                    onChange={(e) => setVehicleForm(prev => ({ ...prev, color: e.target.value }))}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <input
                    required
                    placeholder="Last Seen Location"
                    aria-label="Last Seen Location"
                    value={vehicleForm.last_seen_location}
                    onChange={(e) => setVehicleForm(prev => ({ ...prev, last_seen_location: e.target.value }))}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <input
                    required
                    type="datetime-local"
                    aria-label="Last Seen Time"
                    value={vehicleForm.last_seen_time}
                    onChange={(e) => setVehicleForm(prev => ({ ...prev, last_seen_time: e.target.value }))}
                    className="sm:col-span-2 rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <textarea
                    placeholder="Additional details (optional)"
                    rows={2}
                    value={vehicleForm.notes}
                    onChange={(e) => setVehicleForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="sm:col-span-2 rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button className="sm:col-span-2 rounded-lg bg-blue-500 px-4 py-2 font-semibold hover:bg-blue-600">
                    Submit Report
                  </button>
                </form>
              </section>
            </div>

            {/* Cases Sidebar */}
            <div className="rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900/50 to-slate-950 p-6 h-fit">
              <h2 className="mb-4 text-xl font-bold">My Reports ({vehicles.length})</h2>
              <div className="space-y-3">
                {vehicles.map((v) => (
                  <div key={v.id} className="rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm">
                    <p className="font-semibold text-cyan-300">{v.vehicle_number}</p>
                    <p className="text-xs text-slate-400">{v.vehicle_type} • {v.make}</p>
                    <p className="text-xs text-slate-500">Status: {v.status}</p>
                  </div>
                ))}
                {vehicles.length === 0 && <p className="text-slate-400">No reports yet</p>}
              </div>
            </div>
          </div>
        )}

        {/* Admin Dashboard */}
        {isAdmin && (
          <div className="space-y-6">
            {/* Admin Tabs */}
            <div className="flex gap-2 border-b border-slate-800 overflow-x-auto pb-0">
              <button
                onClick={() => setAdminTab('dashboard')}
                className={`px-6 py-3 font-medium whitespace-nowrap border-b-2 transition-colors ${
                  adminTab === 'dashboard'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-slate-400 hover:text-slate-300'
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setAdminTab('users')}
                className={`px-6 py-3 font-medium whitespace-nowrap border-b-2 transition-colors ${
                  adminTab === 'users'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-slate-400 hover:text-slate-300'
                }`}
              >
                User Management
              </button>
              <button
                onClick={() => setAdminTab('detections')}
                className={`px-6 py-3 font-medium whitespace-nowrap border-b-2 transition-colors ${
                  adminTab === 'detections'
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-slate-400 hover:text-slate-300'
                }`}
              >
                Detection History
              </button>
            </div>

            {adminTab === 'dashboard' && (
              <div className="space-y-6">
                {/* Stats */}
                <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              <div className="rounded-lg border border-cyan-700/30 bg-cyan-950/20 p-4">
                <p className="text-xs uppercase text-cyan-300">Total Users</p>
                <p className="text-3xl font-bold text-cyan-400">{insights?.total_users || 0}</p>
              </div>
              <div className="rounded-lg border border-blue-700/30 bg-blue-950/20 p-4">
                <p className="text-xs uppercase text-blue-300">Customers</p>
                <p className="text-3xl font-bold text-blue-400">{insights?.total_customers || 0}</p>
              </div>
              <div className="rounded-lg border border-amber-700/30 bg-amber-950/20 p-4">
                <p className="text-xs uppercase text-amber-300">Police</p>
                <p className="text-3xl font-bold text-amber-400">{insights?.total_police || 0}</p>
              </div>
              <div className="rounded-lg border border-red-700/30 bg-red-950/20 p-4">
                <p className="text-xs uppercase text-red-300">Active Reports</p>
                <p className="text-3xl font-bold text-red-400">{insights?.active_theft_reports || 0}</p>
              </div>
              <div className="rounded-lg border border-emerald-700/30 bg-emerald-950/20 p-4">
                <p className="text-xs uppercase text-emerald-300">Recovered</p>
                <p className="text-3xl font-bold text-emerald-400">{insights?.found_vehicles || 0}</p>
              </div>
              <div className="rounded-lg border border-purple-700/30 bg-purple-950/20 p-4">
                <p className="text-xs uppercase text-purple-300">Open Cases</p>
                <p className="text-3xl font-bold text-purple-400">{insights?.open_cases || 0}</p>
              </div>
            </section>

            {/* Analytics */}
            <section className="rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900/50 to-slate-950 p-6">
              <h2 className="mb-4 text-xl font-bold">Analytics Dashboard</h2>
              <AnalyticsPanel dailyAnalytics={dailyAnalytics} />
            </section>

            {/* Detection Console */}
            <section className="rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900/50 to-slate-950 p-6">
              <h2 className="mb-4 text-xl font-bold">Camera Detection</h2>
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <Webcam
                    ref={webcamRef}
                    className="w-full rounded-lg border border-slate-700"
                    videoConstraints={{ width: 640, height: 360 }}
                  />
                </div>
                <div className="space-y-3">
                  <input
                    placeholder="Camera location"
                    value={captureLocation}
                    onChange={(e) => setCaptureLocation(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleDetection}
                    disabled={isDetecting}
                    className="w-full rounded-lg bg-blue-500 px-4 py-2 font-semibold disabled:opacity-50"
                  >
                    {isDetecting ? 'Processing...' : 'Detect Plate'}
                  </button>
                  {detectionResult && (
                    <div className="rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm">
                      <p>Plate: {detectionResult.plate_number || 'N/A'}</p>
                      <p>Match: {detectionResult.match_found ? '✓' : '✗'}</p>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Staff Management */}
            <section className="rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900/50 to-slate-950 p-6">
              <h2 className="mb-4 text-xl font-bold">Staff Management</h2>
              <div className="mb-4 grid gap-2 sm:grid-cols-5">
                <input
                  placeholder="Name"
                  value={newStaff.full_name}
                  onChange={(e) => setNewStaff(prev => ({ ...prev, full_name: e.target.value }))}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={newStaff.email}
                  onChange={(e) => setNewStaff(prev => ({ ...prev, email: e.target.value }))}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={newStaff.password}
                  onChange={(e) => setNewStaff(prev => ({ ...prev, password: e.target.value }))}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <select
                  aria-label="Staff Role"
                  value={newStaff.role}
                  onChange={(e) => setNewStaff(prev => ({ ...prev, role: e.target.value as 'admin' | 'police' }))}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="police">Police</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  onClick={handleAddStaff}
                  className="rounded-lg bg-blue-500 px-4 py-2 font-semibold hover:bg-blue-600"
                >
                  Add Staff
                </button>
              </div>
            </section>
            </div>
            )}

            {/* User Deletion */}
            <section className="rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900/50 to-slate-950 p-6">
              <div className="mb-6">
                <h2 className="mb-2 text-xl font-bold text-white">User Management</h2>
                <p className="text-sm text-slate-400">Delete users and manage access.</p>
              </div>

              <div className="rounded-lg border border-slate-800 overflow-hidden">
                <div className="border-b border-slate-800 bg-slate-950 px-6 py-4">
                  <h3 className="font-semibold text-white">All Users</h3>
                </div>
                
                {users.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    <p>No users found</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-800">
                    {users.map((u) => (
                      <div key={u.id} className="px-6 py-4 hover:bg-slate-800/30 transition">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-white">{u.full_name}</p>
                            <p className="text-sm text-slate-400">{u.email}</p>
                            <div className="flex items-center gap-3 mt-2">
                              <span className={`text-xs px-2 py-1 rounded font-semibold ${
                                u.role === 'admin' ? 'bg-purple-950/50 text-purple-300 border border-purple-700/50' :
                                u.role === 'police' ? 'bg-amber-950/50 text-amber-300 border border-amber-700/50' :
                                'bg-blue-950/50 text-blue-300 border border-blue-700/50'
                              }`}>
                                {u.role.toUpperCase()}
                              </span>
                              <span className="text-xs text-slate-400">{u.is_active ? '✓ Active' : '✗ Inactive'}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              if (window.confirm(`PERMANENTLY DELETE user ${u.email}?\n\nThis will:\n- Delete user account\n- Delete all user data\n- Cannot be undone!`)) {
                                fetch(`http://localhost:8000/admin/users/${u.id}`, {
                                  method: 'DELETE',
                                  headers: { Authorization: `Bearer ${token}` },
                                }).then(r => r.json()).then(() => {
                                  setUsers(users.filter(x => x.id !== u.id));
                                }).catch(e => alert('Error: ' + e.message));
                              }
                            }}
                            className="flex items-center gap-2 rounded-lg bg-red-600/20 px-4 py-2 text-red-400 border border-red-700/50 hover:bg-red-600/40 font-semibold transition"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {adminTab === 'users' && (
              <Suspense fallback={<div className="text-center py-8 text-slate-400">Loading user management...</div>}>
                <AdminManagement token={token} />
              </Suspense>
            )}

            {adminTab === 'detections' && (
              <Suspense fallback={<div className="text-center py-8 text-slate-400">Loading detection history...</div>}>
                <DetectionHistory token={token} />
              </Suspense>
            )}
          </div>
        )}

        {/* Police Dashboard */}
        {isPolice && (
          <section className="rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900/50 to-slate-950 p-6">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-2xl font-bold">Assigned Cases</h2>
              <div className="flex items-center gap-2">
                <Search className="h-5 w-5 text-slate-500" />
                <input
                  placeholder="Search by plate..."
                  value={searchCase}
                  onChange={(e) => setSearchCase(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="space-y-4">
              {filteredCases.map(c => (
                <div key={c.id} className="rounded-lg border border-slate-700 bg-slate-900 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="font-bold text-cyan-300">{c.vehicle?.vehicle_number}</p>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      c.status === 'open' ? 'bg-red-900/30 text-red-300' :
                      c.status === 'investigating' ? 'bg-amber-900/30 text-amber-300' :
                      c.status === 'found' ? 'bg-emerald-900/30 text-emerald-300' :
                      c.status === 'closed' ? 'bg-slate-700 text-slate-300' :
                      'bg-blue-900/30 text-blue-300'
                    }`}>
                      {c.status?.toUpperCase()}
                    </span>
                  </div>
                  
                  <p className="text-sm text-slate-300">Customer: {c.customer?.full_name}</p>
                  <p className="text-sm text-slate-400">{c.vehicle?.make} {c.vehicle?.model} • {c.vehicle?.color}</p>
                  
                  {c.latest_detection && (
                    <div className="mt-3 rounded-lg bg-slate-800/50 p-3 border border-slate-700">
                      <p className="text-xs text-slate-400 font-semibold">Latest Detection:</p>
                      <p className="text-sm text-cyan-300">📍 Camera Location: {c.latest_detection.location}</p>
                      {c.latest_detection.detected_at && (
                        <p className="text-sm text-slate-400">🕐 Detected: {new Date(c.latest_detection.detected_at!).toLocaleString()}</p>
                      )}
                      {c.latest_detection.plate_number && (
                        <p className="text-sm text-slate-400">🔍 Plate: {c.latest_detection.plate_number}</p>
                      )}
                    </div>
                  )}
                  
                  <p className="text-xs text-slate-500 mt-2">Last Seen: {c.vehicle?.last_seen_location}</p>
                  
                  {c.status === 'open' || c.status === 'assigned' || c.status === 'detected' || c.status === 'investigating' ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        onClick={async () => {
                          try {
                            setError('');
                            await request(`/police/cases/${c.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ status: 'investigating', note: 'Case started investigation' }),
                            }, true);
                            setCases(cases.map(x => x.id === c.id ? { ...x, status: 'investigating' } : x));
                            setMessage('Case marked as investigating');
                          } catch (err) {
                            setError(getErrorMessage(err));
                          }
                        }}
                        disabled={c.status === 'investigating'}
                        className="flex-1 min-w-max rounded-lg bg-amber-600/20 px-3 py-2 text-amber-300 border border-amber-700/50 hover:bg-amber-600/40 disabled:opacity-60 disabled:cursor-not-allowed font-semibold text-sm"
                      >
                        🔍 Investigating
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            setError('');
                            await request(`/police/cases/${c.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ status: 'found', note: 'Vehicle found and recovered' }),
                            }, true);
                            setCases(cases.map(x => x.id === c.id ? { ...x, status: 'found' } : x));
                            
                            // Send email notification to customer
                            if (c.customer?.email) {
                              try {
                                await fetch('http://localhost:3000/webhook/case-status-update', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    customer_email: c.customer.email,
                                    customer_name: c.customer.full_name,
                                    vehicle_number: c.vehicle?.vehicle_number,
                                    status: 'found',
                                    message: 'Great news! Your vehicle has been found and recovered by our police team.'
                                  })
                                });
                              } catch {
                                // Silently fail to send email (N8N webhook not available)
                              }
                            }
                            
                            setMessage('Case marked as vehicle found! Customer notified.');
                          } catch (err) {
                            setError(getErrorMessage(err));
                          }
                        }}
                        className="flex-1 min-w-max rounded-lg bg-emerald-600/20 px-3 py-2 text-emerald-300 border border-emerald-700/50 hover:bg-emerald-600/40 font-semibold text-sm"
                      >
                        ✓ Found
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            setError('');
                            await request(`/police/cases/${c.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ status: 'closed', note: 'Case closed - no match found' }),
                            }, true);
                            setCases(cases.map(x => x.id === c.id ? { ...x, status: 'closed' } : x));
                            setMessage('Case closed');
                          } catch (err) {
                            setError(getErrorMessage(err));
                          }
                        }}
                        className="flex-1 min-w-max rounded-lg bg-slate-600/20 px-3 py-2 text-slate-300 border border-slate-700/50 hover:bg-slate-600/40 font-semibold text-sm"
                      >
                        ✕ Close
                      </button>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-lg bg-slate-800/30 p-2 text-center">
                      <p className="text-sm text-slate-400">Case is {c.status}</p>
                    </div>
                  )}
                </div>
              ))}
              {cases.length === 0 && <p className="text-slate-400">No assigned cases</p>}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;




