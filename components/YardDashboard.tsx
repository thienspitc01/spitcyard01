
import React, { useState, useEffect, useMemo } from 'react';
import { ContainerRequest, YardSuggestion, Container, PlanningSettings, ScheduleData, BlockConfig, YardReservation } from '../types';
import { YardBrain } from '../services/yardLogicService';

interface YardDashboardProps {
  requests: ContainerRequest[];
  onAssign: (requestId: string, location: string) => void;
  containers: Container[];
  schedule: ScheduleData[];
  blocks: BlockConfig[];
  onAcknowledge: (id: string) => void;
}

const YardDashboard: React.FC<YardDashboardProps> = ({ requests, onAssign, containers, schedule, blocks, onAcknowledge }) => {
  const [loadingSuggestion, setLoadingSuggestion] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Record<string, YardSuggestion>>({});
  const [showSettings, setShowSettings] = useState(false);
  const [reservations, setReservations] = useState<Map<string, YardReservation>>(new Map());

  const [settings, setSettings] = useState<PlanningSettings>(() => {
    const saved = localStorage.getItem('planning_settings_v19');
    if (saved) return JSON.parse(saved);
    // FIX: Added missing properties 'outWindowBlocks' and 'importFallbackBlocks' to satisfy PlanningSettings interface
    return {
      inWindowBlocks: ['A2', 'B2', 'C2', 'A1', 'B1', 'C1'],
      outWindowBlocks: ['D1', 'E1', 'F1', 'G1', 'H1', 'D2', 'E2', 'F2', 'G2', 'H2'],
      importFallbackBlocks: ['A0', 'H0', 'I0', 'B0', 'C0', 'D0', 'E0'],
      berthMapping: [
        { berthName: '1A', assignedBlocks: ['A0', 'A1', 'B1', 'C1'] },
        { berthName: '1B', assignedBlocks: ['A0', 'A1', 'B1', 'C1'] },
        { berthName: '2', assignedBlocks: ['A2', 'B2', 'C2'] },
        { berthName: 'BARGING', assignedBlocks: ['D1', 'E1', 'F1', 'G1', 'H1', 'D2', 'E2', 'F2', 'G2', 'H2'] }
      ],
      rules: {
        maxTierByBlock: { "A1": 5, "B1": 5, "C1": 5, "A2": 5, "B2": 5, "C2": 5, "B0": 6, "C0": 6 },
        weightStackingPolicy: { GE18_on_LT18: true, LT18_on_GE18: true },
        groupingPolicy: { 
          enableGroupStack: true, 
          requireSamePod: true, 
          requireSameVessel: true, 
          requireSameSize: true,
          preventStackingOnImport: true
        }
      }
    } as PlanningSettings;
  });

  useEffect(() => {
    localStorage.setItem('planning_settings_v19', JSON.stringify(settings));
  }, [settings]);

  const runScoringEngine = (req: ContainerRequest) => {
    setLoadingSuggestion(req.id);
    setTimeout(() => {
      const suggestion = YardBrain.findOptimalLocation(
        req, 
        { containers, schedule, blocks, allRequests: requests }, 
        settings, 
        reservations
      );
      
      if (!suggestion.notFound && suggestion.reservationId) {
        const loc = `${suggestion.suggestedBlock}-${suggestion.bay}-${suggestion.row}-${suggestion.tier}`;
        setReservations(prev => {
          const next = new Map(prev);
          next.set(suggestion.reservationId!, { location: loc, expiry: Date.now() + 3 * 60 * 1000, requestId: req.id });
          return next;
        });
      }

      setSuggestions(prev => ({ ...prev, [req.id]: suggestion }));
      setLoadingSuggestion(null);
      onAcknowledge(req.id);
    }, 600);
  };

  const handleQuickAssign = (reqId: string) => {
    const sug = suggestions[reqId];
    if (sug && !sug.notFound) {
      onAssign(reqId, `${sug.suggestedBlock}-${sug.bay}-${sug.row}-${sug.tier}`);
      if (sug.reservationId) {
        setReservations(prev => {
          const next = new Map(prev);
          next.delete(sug.reservationId!);
          return next;
        });
      }
    }
  };

  const toggleBlockInBerth = (berthIndex: number, blockName: string) => {
    setSettings(prev => {
      const newMapping = [...prev.berthMapping];
      const berth = newMapping[berthIndex];
      if (berth.assignedBlocks.includes(blockName)) {
        berth.assignedBlocks = berth.assignedBlocks.filter(b => b !== blockName);
      } else {
        berth.assignedBlocks = [...berth.assignedBlocks, blockName];
      }
      return { ...prev, berthMapping: newMapping };
    });
  };

  const availableBlockNames = blocks.filter(b => b.blockType === 'GRID').map(b => b.name).sort();

  return (
    <div className="space-y-8 p-4">
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 flex justify-between items-center">
        <div className="flex items-center gap-5">
          <div className="bg-blue-600 p-3 rounded-2xl shadow-xl">
             <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
          </div>
          <div>
            <h3 className="font-black text-slate-900 text-xl uppercase italic tracking-tight">Yard Planning & Strategy</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Cấu hình linh hoạt Quy tắc Cầu tàu & Xếp chồng</p>
          </div>
        </div>
        <button onClick={() => setShowSettings(!showSettings)} className="px-6 py-3 rounded-2xl text-xs font-black bg-slate-900 text-white shadow-lg transition-all active:scale-95">
          {showSettings ? 'ĐÓNG CẤU HÌNH' : 'HIỆU CHỈNH KẾ HOẠCH'}
        </button>
      </div>

      {showSettings && (
        <div className="bg-white rounded-[2.5rem] p-10 shadow-2xl border-4 border-blue-50 space-y-10 animate-in slide-in-from-top-4 duration-300">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-8 bg-blue-600 rounded-full"></div>
                  <h4 className="text-lg font-black text-slate-800 uppercase italic tracking-tight">Berth Mapping Rules (Cầu tàu)</h4>
                </div>
                <div className="space-y-6">
                    {settings.berthMapping.map((berth, idx) => (
                        <div key={berth.berthName} className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="bg-blue-600 text-white px-4 py-1 rounded-xl text-xs font-black italic tracking-widest">{berth.berthName}</span>
                                <span className="text-[10px] text-slate-400 font-bold uppercase">{berth.assignedBlocks.length} Blocks assigned</span>
                            </div>
                            
                            <div className="flex flex-wrap gap-1.5">
                                {availableBlockNames.map(bName => {
                                    const isAssigned = berth.assignedBlocks.includes(bName);
                                    return (
                                        <button
                                            key={bName}
                                            onClick={() => toggleBlockInBerth(idx, bName)}
                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${isAssigned ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-white text-slate-400 border border-slate-100 hover:border-slate-300'}`}
                                        >
                                            {bName}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
              </div>

              <div className="space-y-8">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-8 bg-slate-900 rounded-full"></div>
                  <h4 className="text-lg font-black text-slate-800 uppercase italic tracking-tight">Logic & Sequence</h4>
                </div>
                
                <div className="bg-slate-900 p-8 rounded-[2.5rem] text-[11px] font-mono text-slate-300 leading-relaxed shadow-xl border-l-8 border-blue-600">
                    <div className="text-blue-400 font-black mb-4 uppercase tracking-widest text-sm">// YARD BRAIN INSTRUCTIONS</div>
                    <div className="space-y-4">
                      <p className="flex gap-2">
                        <span className="text-blue-500 font-black">1.</span>
                        <span><b>Clustering First:</b> Ưu tiên xếp vào các Row đã có container cùng Vessel/POD/Size/WeightGroup.</span>
                      </p>
                      <p className="flex gap-2">
                        <span className="text-blue-500 font-black">2.</span>
                        <span><b>Dynamic Berth:</b> Nếu không có cụm, hệ thống tìm trong các Block được chỉ định cho Cầu tàu của Tàu đó.</span>
                      </p>
                      <p className="flex gap-2">
                        <span className="text-blue-500 font-black">3.</span>
                        <span><b>WG Segregation:</b> [Nặng chỉ chồng Nặng] & [Nhẹ chỉ chồng Nhẹ] - Không bao giờ trộn lẫn.</span>
                      </p>
                    </div>
                </div>

                <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100">
                  <h5 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-3">Thông tin cấu hình</h5>
                  <p className="text-xs text-blue-800 leading-relaxed font-bold italic">
                    "Các thay đổi sẽ được áp dụng tức thì cho các yêu cầu Xin vị trí mới. Dữ liệu đã gán trước đó không bị ảnh hưởng."
                  </p>
                </div>
              </div>
           </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-8">
          {requests.filter(r => r.status === 'pending').map(req => {
             const vesselInSched = schedule.find(s => s.vesselName.toUpperCase() === req.vesselName.toUpperCase());
             const berthLabel = vesselInSched?.berth || 'BARGING';

             return (
              <div key={req.id} className="bg-white rounded-[2.5rem] p-10 shadow-xl border border-slate-100 group hover:border-blue-200 transition-all">
                <div className="flex flex-col gap-10">
                  <div className="flex flex-col md:flex-row gap-10">
                    <div className="flex-1 space-y-6">
                      <div className="flex items-center gap-6">
                        <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-lg relative">
                           <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                           <div className="absolute -top-2 -right-2 bg-blue-600 text-[8px] font-black px-2 py-1 rounded-lg shadow-lg uppercase">Berth: {berthLabel}</div>
                        </div>
                        <div>
                          <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic">{req.vesselName}</h3>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest">POD: {req.transshipmentPort}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${req.weight >= 18 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                               {req.weight >= 18 ? 'NẶNG (GE18)' : 'NHẸ (LT18)'}
                            </span>
                            <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded text-[10px] font-black uppercase">{req.size}" FT</span>
                          </div>
                        </div>
                      </div>

                      {!suggestions[req.id] && !loadingSuggestion && (
                        <button onClick={() => runScoringEngine(req)} className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl shadow-xl hover:bg-blue-700 transition-all active:scale-95 text-sm tracking-widest uppercase italic">
                          XIN VỊ TRÍ (DYNAMIC ENGINE)
                        </button>
                      )}
                    </div>

                    <div className="md:w-96">
                      {suggestions[req.id] && !suggestions[req.id].notFound && (
                        <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300">
                           <div className="flex justify-between items-center mb-4">
                              <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase italic tracking-tighter shadow-lg ${suggestions[req.id].priorityLevel === 'CLUSTER' ? 'bg-green-600' : 'bg-blue-600'}`}>
                                {suggestions[req.id].priorityLevel} MATCHED
                              </span>
                           </div>
                           <div className="text-5xl font-black mb-6 tracking-tighter text-blue-400">
                              {suggestions[req.id].suggestedBlock}-{suggestions[req.id].bay}-{suggestions[req.id].row}-{suggestions[req.id].tier}
                           </div>
                           
                           <button onClick={() => handleQuickAssign(req.id)} className="w-full bg-white text-slate-900 font-black py-4 rounded-2xl hover:bg-slate-50 transition-all active:scale-95 shadow-xl uppercase italic tracking-tighter text-sm">XÁC NHẬN VỊ TRÍ</button>
                        </div>
                      )}
                    </div>
                  </div>

                  {suggestions[req.id] && (
                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                        Nhật ký phân tích
                      </h4>
                      <div className="space-y-2">
                        {suggestions[req.id].validationTrace?.map((line, idx) => (
                          <div key={idx} className="flex gap-3 text-[10px] font-bold text-slate-600 italic">
                             <span className="text-blue-500">[{idx+1}]</span>
                             <span>{line}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="space-y-6">
           <h4 className="text-sm font-black text-slate-900 uppercase italic">Reservations (Locked)</h4>
           {Array.from(reservations.entries()).map(([id, res]) => (
             <div key={id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center animate-in fade-in duration-300">
                <div>
                   <div className="text-[10px] font-black text-slate-400 uppercase tracking-tighter italic">Vị trí đang giữ</div>
                   <div className="text-sm font-bold text-slate-800 tracking-tight">{res.location}</div>
                </div>
                <div className="text-right">
                   <div className="text-[9px] font-bold text-blue-600 uppercase italic">Locked</div>
                   <div className="text-[9px] text-slate-400 font-mono mt-1">
                      {Math.max(0, Math.floor((res.expiry - Date.now()) / 1000))}s
                   </div>
                </div>
             </div>
           ))}
        </div>
      </div>
    </div>
  );
};

export default YardDashboard;
