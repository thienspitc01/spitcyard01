
import React, { useState, useMemo } from 'react';
import { ContainerRequest, ContainerSize } from '../types';

interface GateFormProps {
  onSubmit: (request: Omit<ContainerRequest, 'id' | 'status' | 'timestamp'>) => void;
  requests: ContainerRequest[];
  onAcknowledge: (id: string) => void;
}

const GateForm: React.FC<GateFormProps> = ({ onSubmit, requests, onAcknowledge }) => {
  const [formData, setFormData] = useState({
    vesselName: '',
    transshipmentPort: '',
    weight: '',
    size: '20' as ContainerSize
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vesselName || !formData.transshipmentPort || !formData.weight) {
      alert('Vui lòng điền đầy đủ thông tin tàu, cảng và trọng lượng');
      return;
    }
    onSubmit({
      vesselName: formData.vesselName.toUpperCase(),
      transshipmentPort: formData.transshipmentPort.toUpperCase(),
      weight: parseFloat(formData.weight),
      size: formData.size
    });
    setFormData({ vesselName: '', transshipmentPort: '', weight: '', size: '20' });
  };

  const pendingAssignments = useMemo(() => 
    requests.filter(r => r.status === 'assigned' && !r.acknowledgedByGate)
  , [requests]);

  const assignmentHistory = useMemo(() => 
    requests.filter(r => r.status === 'assigned').sort((a,b) => b.timestamp - a.timestamp)
  , [requests]);

  return (
    <div className="max-w-7xl mx-auto space-y-12">
      {/* CẢNH BÁO VỊ TRÍ MỚI (BANNER NHẢY LÊN) */}
      {pendingAssignments.length > 0 && (
        <div className="bg-red-600 animate-in slide-in-from-top-10 duration-500 text-white p-8 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl shadow-red-200 border-4 border-white/20">
          <div className="flex items-center gap-6 text-center md:text-left">
            <div className="bg-white p-4 rounded-full text-red-600 shadow-xl animate-bounce">
              <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
            </div>
            <div>
              <h3 className="text-2xl font-black uppercase tracking-tighter italic leading-none">THÔNG BÁO: ĐÃ CÓ VỊ TRÍ HẠ BÃI!</h3>
              <p className="text-sm font-bold opacity-90 uppercase tracking-widest mt-2">Vui lòng kiểm tra danh sách bên phải và bấm "Xác nhận" để tắt chuông báo động.</p>
            </div>
          </div>
          <button 
            onClick={() => pendingAssignments.forEach(r => onAcknowledge(r.id))}
            className="bg-white text-red-600 px-10 py-5 rounded-[1.5rem] font-black text-sm hover:bg-slate-50 transition-all shadow-2xl active:scale-95 whitespace-nowrap"
          >
            ĐÃ NHẬN THÔNG TIN & TẮT CHUÔNG
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Form Container */}
        <div className="bg-white rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden h-fit">
          <div className="bg-blue-600 px-10 py-8 relative">
            <div className="absolute top-0 right-0 p-6 opacity-10">
               <svg className="w-24 h-24 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" /><path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7h-3v7h3V7zM16.95 9a1.5 1.5 0 011.05 2.54l-1.05 1.05V15a1 1 0 001 1h1a1 1 0 001-1V8.5L16.95 6.45A1.5 1.5 0 0115.5 5H14v4h2.95z" /></svg>
            </div>
            <h2 className="text-white text-3xl font-black uppercase tracking-tighter italic">Khai Báo Cổng</h2>
            <p className="text-blue-100 text-xs font-bold uppercase tracking-widest mt-1">Hệ thống gọi Yard Planner hỗ trợ TOS</p>
          </div>
          
          <form onSubmit={handleSubmit} className="p-10 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Tên Tàu (Vessel)</label>
                <input 
                  type="text" 
                  placeholder="VD: MAERSK SEOUL"
                  className="w-full px-6 py-5 rounded-[1.5rem] border-2 border-slate-50 bg-slate-50 focus:bg-white focus:border-blue-600 transition-all outline-none font-bold uppercase text-lg shadow-inner"
                  value={formData.vesselName}
                  onChange={(e) => setFormData({...formData, vesselName: e.target.value})}
                />
              </div>
              
              <div className="space-y-3">
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Cảng POD</label>
                <input 
                  type="text" 
                  placeholder="VD: SINGAPORE"
                  className="w-full px-6 py-5 rounded-[1.5rem] border-2 border-slate-50 bg-slate-50 focus:bg-white focus:border-blue-600 transition-all outline-none font-bold uppercase text-lg shadow-inner"
                  value={formData.transshipmentPort}
                  onChange={(e) => setFormData({...formData, transshipmentPort: e.target.value})}
                />
              </div>

              <div className="space-y-3">
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Kích Thước</label>
                <div className="flex gap-4">
                  <label className="flex-1">
                    <input type="radio" className="sr-only peer" name="size" checked={formData.size === '20'} onChange={() => setFormData({...formData, size: '20'})} />
                    <div className="text-center py-5 rounded-[1.5rem] border-2 border-slate-50 bg-slate-50 cursor-pointer peer-checked:bg-blue-600 peer-checked:text-white peer-checked:border-blue-600 font-black transition-all uppercase text-lg shadow-sm">20 FT</div>
                  </label>
                  <label className="flex-1">
                    <input type="radio" className="sr-only peer" name="size" checked={formData.size === '40'} onChange={() => setFormData({...formData, size: '40'})} />
                    <div className="text-center py-5 rounded-[1.5rem] border-2 border-slate-50 bg-slate-50 cursor-pointer peer-checked:bg-blue-600 peer-checked:text-white peer-checked:border-blue-600 font-black transition-all uppercase text-lg shadow-sm">40 FT</div>
                  </label>
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Trọng Lượng (Tấn)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    placeholder="0.00"
                    className="w-full px-6 py-5 rounded-[1.5rem] border-2 border-slate-50 bg-slate-50 focus:bg-white focus:border-blue-600 transition-all outline-none pr-20 font-bold text-lg shadow-inner"
                    value={formData.weight}
                    onChange={(e) => setFormData({...formData, weight: e.target.value})}
                  />
                  <span className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm italic">MT</span>
                </div>
              </div>
            </div>

            <button 
              type="submit"
              className="w-full bg-slate-900 hover:bg-black text-white font-black py-6 rounded-[2rem] shadow-2xl transition-all flex items-center justify-center gap-4 group"
            >
              <span className="text-lg tracking-tight uppercase italic">GỬI YÊU CẦU CHO YARD PLANNER</span>
              <svg className="w-6 h-6 group-hover:translate-x-2 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </form>
        </div>

        {/* Real-time Status Area */}
        <div className="flex flex-col gap-8">
            <div className="bg-white rounded-[3rem] shadow-2xl border border-slate-200 overflow-hidden flex-1 flex flex-col">
              <div className="bg-slate-900 px-10 py-8 border-b border-slate-800 flex justify-between items-center">
                <div>
                  <h2 className="text-white text-2xl font-black uppercase tracking-tighter italic">Lịch sử cấp vị trí</h2>
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">Thông tin vị trí tức thời từ Planner</p>
                </div>
                <div className="bg-blue-600 px-5 py-2 rounded-xl text-xs font-black text-white shadow-lg animate-pulse">
                  {assignmentHistory.length} PHIẾU
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto max-h-[550px] p-6 space-y-4 scrollbar-hide bg-slate-50">
                {assignmentHistory.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 py-32">
                    <svg className="w-24 h-24 mb-6 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    <span className="text-sm font-black uppercase tracking-widest italic opacity-40">Đang chờ Yard Planner cấp vị trí...</span>
                  </div>
                ) : (
                  assignmentHistory.map(req => (
                    <div 
                      key={req.id} 
                      className={`p-8 rounded-[2rem] border-4 transition-all duration-500 group relative ${!req.acknowledgedByGate ? 'bg-white border-blue-600 shadow-2xl scale-[1.02] z-10' : 'bg-white border-transparent shadow-sm opacity-80'}`}
                    >
                      {!req.acknowledgedByGate && (
                          <div className="absolute top-0 right-0 bg-blue-600 text-white text-[9px] font-black px-4 py-1.5 rounded-bl-2xl uppercase tracking-tighter animate-pulse shadow-lg">Vị trí mới</div>
                      )}
                      <div className="flex justify-between items-center">
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <span className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">{req.vesselName}</span>
                          </div>
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{req.transshipmentPort} • {req.size}FT • {req.weight}MT</p>
                          <p className="text-[9px] font-bold text-slate-300 uppercase italic">{new Date(req.timestamp).toLocaleTimeString()}</p>
                        </div>
                        <div className="text-right">
                          <div className={`text-4xl font-black tracking-tighter mb-4 ${!req.acknowledgedByGate ? 'text-blue-600' : 'text-slate-800'}`}>
                            {req.assignedLocation}
                          </div>
                          {!req.acknowledgedByGate && (
                            <button 
                              onClick={() => onAcknowledge(req.id)}
                              className="bg-blue-600 text-white text-[11px] font-black px-8 py-3 rounded-xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 uppercase italic tracking-tighter active:scale-95"
                            >
                              Bấm để xác nhận
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            
            {/* Legend for Gate */}
            <div className="bg-white p-6 rounded-[2.5rem] shadow-lg border border-slate-100 flex items-center justify-center gap-10">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-600 animate-pulse"></div>
                    <span className="text-[10px] font-black text-slate-500 uppercase">Chờ xác nhận</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-slate-200"></div>
                    <span className="text-[10px] font-black text-slate-500 uppercase">Đã vào bãi</span>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default GateForm;
