import React, { useState } from 'react';
import { Lock, ShieldCheck, Key, LogIn, AlertCircle } from 'lucide-react';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (role: 'Super Admin' | 'Operator') => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    if (cleanUser === 'admin' && cleanPass === 'admin2026') {
      onLoginSuccess('Super Admin');
    } else if (cleanUser === 'operator' && cleanPass === 'operator2026') {
      onLoginSuccess('Operator');
    } else {
      setErrorMsg('Invalid username or password. Default Admin: admin / admin2026');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-md rounded-3xl p-6 border border-indigo-500/40 space-y-5 shadow-2xl relative">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/40 flex items-center justify-center mx-auto shadow-lg">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-black text-white">Admin Authentication</h2>
          <p className="text-xs text-indigo-300">Restricted access — Authorized Organizers &amp; Staff Only</p>
        </div>

        {errorMsg && (
          <div className="bg-red-950/90 border border-red-500 p-3 rounded-2xl flex items-center space-x-2 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-1">Username</label>
            <div className="relative">
              <ShieldCheck className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Username (e.g. admin)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full glass-input rounded-xl pl-9 pr-3 py-2.5 text-xs"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-1">Password</label>
            <div className="relative">
              <Key className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="password"
                placeholder="Password (e.g. admin2026)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full glass-input rounded-xl pl-9 pr-3 py-2.5 text-xs"
                required
              />
            </div>
          </div>

          <div className="bg-gray-900/60 p-3 rounded-xl border border-gray-800 text-[11px] text-gray-400 space-y-1">
            <p className="font-bold text-gray-300">Default Credentials:</p>
            <p>&bull; <strong className="text-indigo-300">Super Admin:</strong> username: <code className="text-amber-300">admin</code> | pass: <code className="text-amber-300">admin2026</code></p>
            <p>&bull; <strong className="text-indigo-300">Operator:</strong> username: <code className="text-amber-300">operator</code> | pass: <code className="text-amber-300">operator2026</code></p>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold text-xs rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="w-2/3 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-lg flex items-center justify-center space-x-1.5"
            >
              <LogIn className="w-4 h-4" />
              <span>LOG IN TO ADMIN</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
