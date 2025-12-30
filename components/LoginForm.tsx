
import React, { useState } from 'react';
import { UserRole, User } from '../types';

interface LoginFormProps {
  onLogin: (user: User) => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLogin }) => {
  const [role, setRole] = useState<UserRole>('PLANNER');
  const [username, setUsername] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      alert('Vui lòng nhập tên người dùng');
      return;
    }
    onLogin({ username, role });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-6 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse"></div>

      <div className="w-full max-w-md bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[3rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-500">
        <div className="p-10">
          <div className="text-center mb-10">
            <div className="bg-blue-600 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-blue-500/40">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic">PORT LOGIN</h1>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2">Hệ thống quản lý bãi container</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Tên người dùng</label>
              <input 
                type="text" 
                placeholder="Nhập họ tên của bạn..."
                className="w-full px-6 py-5 bg-white/5 border border-white/10 rounded-[1.5rem] outline-none focus:ring-2 ring-blue-500 text-white font-bold placeholder:text-slate-600 transition-all"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Chọn vai trò</label>
              <div className="grid grid-cols-3 gap-2">
                <button 
                  type="button"
                  onClick={() => setRole('ADMIN')}
                  className={`py-4 rounded-[1.2rem] font-black text-[9px] uppercase tracking-tighter transition-all border ${role === 'ADMIN' ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-500/20' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
                >
                  Admin
                </button>
                <button 
                  type="button"
                  onClick={() => setRole('PLANNER')}
                  className={`py-4 rounded-[1.2rem] font-black text-[9px] uppercase tracking-tighter transition-all border ${role === 'PLANNER' ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
                >
                  Planner
                </button>
                <button 
                  type="button"
                  onClick={() => setRole('GATE')}
                  className={`py-4 rounded-[1.2rem] font-black text-[9px] uppercase tracking-tighter transition-all border ${role === 'GATE' ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
                >
                  Gate Staff
                </button>
              </div>
            </div>

            <button 
              type="submit"
              className="w-full bg-white text-slate-900 font-black py-6 rounded-[2rem] shadow-2xl hover:bg-slate-100 active:scale-[0.98] transition-all uppercase italic tracking-tight mt-4"
            >
              Đăng nhập ngay
            </button>
          </form>
        </div>
        
        <div className="bg-white/5 p-6 text-center border-t border-white/10">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Phiên bản Smart Port v2.0 • 2024
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
