import { Eye, EyeOff, Shield } from 'lucide-react';
import { FormEvent, useState } from 'react';

interface UnifiedAuthProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (email: string, password: string, isRegister: boolean, fullName?: string, phone?: string) => Promise<void>;
  error: string;
  isLoading?: boolean;
}

export default function UnifiedAuth({ isOpen, onClose, onSuccess, error, isLoading }: UnifiedAuthProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [localError, setLocalError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError('');

    // Validation
    if (!email || !password) {
      setLocalError('Email and password are required');
      return;
    }

    if (mode === 'register') {
      if (!fullName) {
        setLocalError('Full name is required');
        return;
      }
      if (password.length < 6) {
        setLocalError('Password must be at least 6 characters');
        return;
      }
      if (password !== confirmPassword) {
        setLocalError('Passwords do not match');
        return;
      }
    }

    try {
      await onSuccess(email, password, mode === 'register', fullName, phone);
      // Reset form on success
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setFullName('');
      setPhone('');
      setMode('login');
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setLocalError(errorMsg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-blue-600/40 bg-gradient-to-br from-slate-900 via-blue-950/50 to-slate-900 p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mb-3 inline-flex rounded-lg bg-blue-500/20 p-3">
            <Shield className="h-6 w-6 text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold text-white">Smart Plate AI</h2>
          <p className="mt-2 text-sm text-slate-300">
            {mode === 'login' 
              ? 'Sign In' 
              : 'Create Account'}
          </p>
        </div>

        {/* Display Errors */}
        {error && (
          <div className="mb-4 rounded-lg border border-rose-700/50 bg-rose-900/20 p-3 text-sm text-rose-200">
            {error}
          </div>
        )}
        {localError && (
          <div className="mb-4 rounded-lg border border-rose-700/50 bg-rose-900/20 p-3 text-sm text-rose-200">
            {localError}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          {/* Full Name - Register Only */}
          {mode === 'register' && (
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                className="w-full rounded-lg border border-slate-700 bg-slate-950/50 px-4 py-2.5 text-white placeholder-slate-500 transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Email */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full rounded-lg border border-slate-700 bg-slate-950/50 px-4 py-2.5 text-white placeholder-slate-500 transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Phone - Register Only */}
          {mode === 'register' && (
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Phone (Optional)</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 XXXXX XXXXX"
                className="w-full rounded-lg border border-slate-700 bg-slate-950/50 px-4 py-2.5 text-white placeholder-slate-500 transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Password */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-300">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-slate-700 bg-slate-950/50 px-4 py-2.5 pr-10 text-white placeholder-slate-500 transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 transition hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Confirm Password - Register Only */}
          {mode === 'register' && (
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/50 px-4 py-2.5 pr-10 text-white placeholder-slate-500 transition focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 transition hover:text-slate-300"
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-2.5 font-semibold text-white transition hover:from-blue-600 hover:to-cyan-600 disabled:from-slate-600 disabled:to-slate-600"
          >
            {isLoading
              ? 'Processing...'
              : mode === 'login'
              ? 'Sign In'
              : 'Create Account'}
          </button>
        </form>

        {/* Mode Toggle */}
        <div className="mt-6 border-t border-slate-700 pt-6">
          <p className="mb-3 text-center text-sm text-slate-400">
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
          </p>
          <button
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setLocalError('');
            }}
            className="w-full rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800"
          >
            {mode === 'login' ? 'Create Account' : 'Sign In Instead'}
          </button>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="mt-4 w-full rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800"
        >
          Close
        </button>
      </div>
    </div>
  );
}
