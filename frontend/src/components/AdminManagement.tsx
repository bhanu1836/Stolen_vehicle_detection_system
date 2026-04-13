import React, { useState, useEffect } from 'react';
import { Trash2, User, Mail, Phone, Lock, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface AdminUser {
  _id: string;
  full_name: string;
  email: string;
  phone?: string;
  role: 'customer' | 'police' | 'admin';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface AdminManagementProps {
  token: string;
  onRefresh?: () => void;
}

export const AdminManagement: React.FC<AdminManagementProps> = ({ token, onRefresh }) => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:8000/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
        setError('');
      }
    } catch {
      setError('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (userId: string, email: string) => {
    if (!window.confirm(`Are you sure you want to DELETE user ${email}?\n\nThis will:\n- Permanently delete the user account\n- Delete all their data\n- This action CANNOT be undone!`)) {
      return;
    }

    setDeleting(userId);
    setError('');
    try {
      const response = await fetch(`http://localhost:8000/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(`✓ User ${email} deleted successfully`);
        setUsers(users.filter(u => u._id !== userId));
        setTimeout(() => setSuccess(''), 4000);
        onRefresh?.();
      } else {
        setError(`Failed to delete user: ${data.detail || 'Unknown error'}`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(`Error deleting user: ${errorMsg}`);
      console.error('Delete error:', err);
    } finally {
      setDeleting(null);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-950/50 text-purple-300 border-purple-700/50';
      case 'police':
        return 'bg-amber-950/50 text-amber-300 border-amber-700/50';
      case 'customer':
        return 'bg-blue-950/50 text-blue-300 border-blue-700/50';
      default:
        return 'bg-slate-950/50 text-slate-300 border-slate-700/50';
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">User Management</h2>
          <p className="text-slate-400">Manage system users and access control</p>
        </div>
        <button
          onClick={fetchUsers}
          disabled={loading}
          className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="rounded-lg border border-red-700/50 bg-red-950/50 p-4 text-red-300">
          ⚠️ {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-emerald-700/50 bg-emerald-950/50 p-4 text-emerald-300">
          ✓ {success}
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-blue-700/30 bg-blue-950/20 p-4">
          <p className="text-xs uppercase text-blue-300">Total Users</p>
          <p className="text-3xl font-bold text-blue-400">{users.length}</p>
        </div>
        <div className="rounded-lg border border-purple-700/30 bg-purple-950/20 p-4">
          <p className="text-xs uppercase text-purple-300">Admins</p>
          <p className="text-3xl font-bold text-purple-400">{users.filter(u => u.role === 'admin').length}</p>
        </div>
        <div className="rounded-lg border border-amber-700/30 bg-amber-950/20 p-4">
          <p className="text-xs uppercase text-amber-300">Police</p>
          <p className="text-3xl font-bold text-amber-400">{users.filter(u => u.role === 'police').length}</p>
        </div>
        <div className="rounded-lg border border-cyan-700/30 bg-cyan-950/20 p-4">
          <p className="text-xs uppercase text-cyan-300">Customers</p>
          <p className="text-3xl font-bold text-cyan-400">{users.filter(u => u.role === 'customer').length}</p>
        </div>
      </div>

      {/* Users List */}
      <div className="rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900/50 to-slate-950 overflow-hidden">
        <div className="sticky top-0 border-b border-slate-800 bg-slate-950 px-6 py-4">
          <h3 className="font-bold text-white">All Users ({users.length})</h3>
        </div>

        {users.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <User className="mx-auto mb-2 h-8 w-8 opacity-50" />
            <p>No users found</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {users.map((user) => (
              <div key={user._id}>
                {/* User Summary */}
                <button
                  onClick={() => setExpandedUser(expandedUser === user._id ? null : user._id)}
                  className="w-full px-6 py-4 hover:bg-slate-800/50 transition-colors text-left"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      {/* Avatar */}
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800">
                        <User className="h-5 w-5 text-slate-400" />
                      </div>

                      {/* Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-white">{user.full_name}</p>
                          <span className={`inline-block px-2 py-1 rounded text-xs font-semibold border ${getRoleColor(user.role)}`}>
                            {user.role.toUpperCase()}
                          </span>
                          {user.is_active ? (
                            <CheckCircle className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-400" />
                          )}
                        </div>
                        <p className="text-sm text-slate-400">{user.email}</p>
                      </div>

                      {/* Chevron */}
                      <div className="text-slate-400">
                        {expandedUser === user._id ? (
                          <ChevronUp className="h-5 w-5" />
                        ) : (
                          <ChevronDown className="h-5 w-5" />
                        )}
                      </div>
                    </div>
                  </div>
                </button>

                {/* Expanded Details */}
                {expandedUser === user._id && (
                  <div className="border-t border-slate-800 bg-slate-950/50 px-6 py-4 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      {/* Email */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-slate-400 text-sm">
                          <Mail className="h-4 w-4" />
                          <span>Email</span>
                        </div>
                        <p className="text-white font-mono text-sm">{user.email}</p>
                      </div>

                      {/* Phone */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-slate-400 text-sm">
                          <Phone className="h-4 w-4" />
                          <span>Phone</span>
                        </div>
                        <p className="text-white font-mono text-sm">{user.phone || 'N/A'}</p>
                      </div>

                      {/* Role */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-slate-400 text-sm">
                          <Lock className="h-4 w-4" />
                          <span>Role</span>
                        </div>
                        <p className="text-white capitalize">{user.role}</p>
                      </div>

                      {/* Status */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-slate-400 text-sm">
                          <CheckCircle className="h-4 w-4" />
                          <span>Status</span>
                        </div>
                        <p className={user.is_active ? 'text-emerald-400' : 'text-red-400'}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </p>
                      </div>

                      {/* Created */}
                      <div className="space-y-1">
                        <p className="text-slate-400 text-xs">Created</p>
                        <p className="text-white text-sm">{formatDate(user.created_at)}</p>
                      </div>

                      {/* Updated */}
                      <div className="space-y-1">
                        <p className="text-slate-400 text-xs">Updated</p>
                        <p className="text-white text-sm">{formatDate(user.updated_at)}</p>
                      </div>
                    </div>

                    {/* Delete Button */}
                    <div className="flex gap-2 pt-4 border-t border-slate-800">
                      <button
                        onClick={() => deleteUser(user._id, user.email)}
                        disabled={deleting === user._id}
                        className={`flex items-center gap-2 rounded-lg px-4 py-2 border font-semibold transition-all ${
                          deleting === user._id
                            ? 'bg-red-600/50 text-red-300 border-red-600 cursor-not-allowed opacity-60'
                            : 'bg-red-600/20 text-red-400 border-red-700/50 hover:bg-red-600/40 hover:border-red-600'
                        }`}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>{deleting === user._id ? 'Deleting...' : 'Delete User'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminManagement;
