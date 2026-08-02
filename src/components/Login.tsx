import React, { useState } from 'react';
import { Lock, User, LogIn } from 'lucide-react';
import { postData } from '../api';

export default function Login({ onLoginSuccess }: { onLoginSuccess: (user: any) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Vui lòng nhập tài khoản và mật khẩu");
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const res = await postData('auth', 'login', { username, password });
      if (res.success && res.user) {
        localStorage.setItem('erp_user', JSON.stringify(res.user));
        if (res.app_secret) localStorage.setItem('app_secret', res.app_secret);
        if (res.firebase_secret) localStorage.setItem('firebase_secret', res.firebase_secret);
        onLoginSuccess(res.user);
      } else {
        setError(res.error || 'Sai tài khoản hoặc mật khẩu');
      }
    } catch (err: any) {
      setError(err.message || "Lỗi kết nối. Vui lòng thử lại!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-sky-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-sky-500/30">
            <Lock size={32} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Đăng Nhập Hệ Thống</h2>
          <p className="text-slate-500 mt-2 font-medium">ERP Quảng Cáo Nguyễn Hồ</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 text-sm text-center border border-red-100">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tài khoản</label>
            <div className="relative">
              <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-all text-slate-700"
                placeholder="Nhập tên đăng nhập..."
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Mật khẩu</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="password" 
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-all text-slate-700"
                placeholder="Nhập mật khẩu..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-sky-500 hover:bg-sky-600 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-70 disabled:cursor-not-allowed mt-2 shadow-lg shadow-sky-500/30"
          >
            {loading ? (
              <span>Đang xử lý...</span>
            ) : (
              <>
                <LogIn size={20} /> ĐĂNG NHẬP
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-slate-400">
          <p>&copy; {new Date().getFullYear()} Quảng Cáo Nguyễn Hồ. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
