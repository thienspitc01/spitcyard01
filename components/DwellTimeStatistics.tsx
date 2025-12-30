
import React, { useMemo, useRef } from 'react';
import { Container } from '../types';
import { calculateTEU } from '../App';

// Declare html2canvas globally
declare const html2canvas: any;
declare const XLSX: any;

interface DwellTimeStatisticsProps {
  containers: Container[];
}

interface GroupedStats {
    dwell: number;
    commodity: string;
    owners: string[];
    bls: string[];
    flows: string[];
    teus: number;
    containers: Container[];
}

const DwellTimeStatistics: React.FC<DwellTimeStatisticsProps> = ({ containers }) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const longStandingRef = useRef<HTMLDivElement>(null);

  // Filter out the 'end' parts of 40' containers to avoid double counting
  const uniqueContainers = useMemo(() => {
    return containers.filter(c => !(c.isMultiBay && c.partType === 'end'));
  }, [containers]);

  const stats = useMemo(() => {
    // Condition for "valid" dwell time statistics (<= 90 days)
    const dwellLimit90 = (c: Container) => (c.dwellDays || 0) <= 90;

    // Helper to calculate a single row
    // We enforce that the Average calculation ONLY considers containers meeting dwellLimit90
    const calculateRow = (categoryFilter: (c: Container) => boolean) => {
        // 1. Base Population (All containers in this category) - For Inventory Counts
        const basePopulation = uniqueContainers.filter(categoryFilter);
        const count = basePopulation.length;
        const teus = basePopulation.reduce((sum, c) => sum + calculateTEU(c), 0);

        // 2. Target Population (Only containers <= 90 days) - For Average Dwell Calculation
        const targetPopulation = basePopulation.filter(dwellLimit90);
        const countUnder90 = targetPopulation.length;
        
        // Sum of days for ONLY the target population
        const totalDwellDaysOfTarget = targetPopulation.reduce((sum, c) => sum + (c.dwellDays || 0), 0);
        
        // Average = Sum(Target) / Count(Target)
        const avgDwell = countUnder90 > 0 ? totalDwellDaysOfTarget / countUnder90 : 0;

        return { 
            count, 
            teus, 
            avgDwell, 
            totalDwell: totalDwellDaysOfTarget, 
            dwellPopCount: countUnder90, 
            countUnder90 
        };
    };

    // Helper to aggregate multiple rows (Weighted Average Logic)
    const aggregateRows = (rows: ReturnType<typeof calculateRow>[]) => {
        const count = rows.reduce((acc, r) => acc + r.count, 0);
        const teus = rows.reduce((acc, r) => acc + r.teus, 0);
        const countUnder90 = rows.reduce((acc, r) => acc + r.countUnder90, 0);
        
        const totalDwell = rows.reduce((acc, r) => acc + r.totalDwell, 0);
        const dwellPopCount = rows.reduce((acc, r) => acc + r.dwellPopCount, 0);
        
        const avgDwell = dwellPopCount > 0 ? totalDwell / dwellPopCount : 0;
        
        return { count, teus, avgDwell, totalDwell, dwellPopCount, countUnder90 };
    };

    // Use normalized flow for reliability
    const row1 = calculateRow(c => c.flow === 'IMPORT' && c.status === 'FULL');
    const row2 = calculateRow(c => c.flow === 'IMPORT STORAGE' && c.status === 'FULL');
    const row3 = aggregateRows([row1, row2]);
    const row4 = calculateRow(c => c.flow === 'EXPORT' && c.status === 'FULL');
    const row5 = aggregateRows([row3, row4]);
    const row6 = calculateRow(c => (c.flow === 'STORAGE EMPTY' || c.status === 'EMPTY'));
    const rowTotal = aggregateRows([row5, row6]);

    return { row1, row2, row3, row4, row5, row6, rowTotal };
  }, [uniqueContainers]);
  
  // Logic for Long Standing Cargo List (Grouped by Dwell -> Commodity)
  const groupedLongStanding: GroupedStats[] = useMemo(() => {
      // 1. Filter: 
      //    a. Dwell <= 90 days
      //    b. Hàng nhập (3): flow must be IMPORT or IMPORT STORAGE and status FULL.
      const validContainers = uniqueContainers.filter(c => {
          const isUnder90 = (c.dwellDays || 0) <= 90;
          const isImport = c.flow === 'IMPORT' || c.flow === 'IMPORT STORAGE'; 
          const isFull = c.status === 'FULL';
          
          return isUnder90 && isImport && isFull;
      });
      
      // 2. Group by Dwell Time then Commodity
      const groups = new Map<number, Map<string, Container[]>>();

      validContainers.forEach(c => {
          const dwell = c.dwellDays || 0;
          const comm = c.commodity ? c.commodity.trim() : '(Chưa rõ tên)'; 
          
          if (!groups.has(dwell)) {
              groups.set(dwell, new Map());
          }
          const dwellGroup = groups.get(dwell)!;
          
          if (!dwellGroup.has(comm)) {
              dwellGroup.set(comm, []);
          }
          dwellGroup.get(comm)!.push(c);
      });

      // 3. Flatten and Calculate Stats
      const result: GroupedStats[] = [];
      const sortedDwells = Array.from(groups.keys()).sort((a, b) => b - a);
      
      for (const dwell of sortedDwells) {
          const commMap = groups.get(dwell)!;
          const sortedComms = Array.from(commMap.keys()).sort(); 
          
          for (const comm of sortedComms) {
              const conts = commMap.get(comm)!;
              const teus = conts.reduce((sum, c) => sum + calculateTEU(c), 0);
              
              const owners = Array.from(new Set(conts.map(c => c.owner).filter(Boolean))).sort();
              const bls = Array.from(new Set(conts.map(c => c.billOfLading).filter(Boolean))).sort();
              const flows = Array.from(new Set(conts.map(c => c.flow || '').filter(Boolean))).sort();

              result.push({
                  dwell,
                  commodity: comm,
                  owners,
                  bls,
                  flows,
                  teus,
                  containers: conts
              });
          }
      }
      
      // 4. Take Top 10 Groups
      return result.slice(0, 10);
  }, [uniqueContainers]);


  const handleExportImage = async () => {
      if (reportRef.current && typeof html2canvas !== 'undefined') {
          try {
              const canvas = await html2canvas(reportRef.current, { scale: 2, backgroundColor: '#ffffff' });
              const image = canvas.toDataURL("image/png");
              const link = document.createElement('a');
              link.href = image;
              link.download = `Dwell_Time_Report_${new Date().toISOString().slice(0,10)}.png`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
          } catch (e) {
              alert("Export failed");
          }
      } else {
          alert("Export not ready");
      }
  };

  const handleExcelExport = () => {
      if (typeof XLSX === 'undefined') {
          alert("Excel library not loaded.");
          return;
      }

      const allContainersToExport = groupedLongStanding.flatMap(g => g.containers);

      if (allContainersToExport.length === 0) {
          alert("No data to export.");
          return;
      }

      const exportData = allContainersToExport.map(c => ({
          'Hãng khai thác': c.owner,
          'Container': c.id,
          'Kích cỡ': c.size,
          'Kích cỡ ISO': c.iso || '',
          'Hướng': c.flow || '',
          'Trạng thái': c.status || '',
          'F/E': c.status === 'EMPTY' ? 'E' : 'F',
          'Vị trí trên bãi': c.location,
          'Ngày nhập bãi': c.inDate || '',
          'Số ngày lưu bãi': c.dwellDays || 0,
          'Loại Hàng': c.type || '',
          'Hàng Hóa': c.commodity || '',
          'Số Vận Đơn': c.billOfLading || '',
          'Lý do giữ': c.holdReason || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const wscols = [
          { wch: 15 }, { wch: 15 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, 
          { wch: 10 }, { wch: 5 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, 
          { wch: 10 }, { wch: 20 }, { wch: 15 }, { wch: 20 }
      ];
      worksheet['!cols'] = wscols;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "TonLau_ChiTiet");
      XLSX.writeFile(workbook, `DanhMucHangTonLau_Details_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const renderTableRows = () => {
    if (groupedLongStanding.length === 0) {
        return (
            <tr>
                <td colSpan={7} className="border border-black p-6 text-center text-slate-500 italic">
                    Không có dữ liệu Hàng Nhập (Full) khớp với bộ lọc (≤ 90 ngày).
                </td>
            </tr>
        );
    }

    const rows: React.ReactNode[] = [];
    let i = 0;
    while (i < groupedLongStanding.length) {
        const current = groupedLongStanding[i];
        let span = 1;
        while (i + span < groupedLongStanding.length && groupedLongStanding[i + span].dwell === current.dwell) {
            span++;
        }
        
        for (let j = 0; j < span; j++) {
            const item = groupedLongStanding[i + j];
            const isFirst = j === 0;
            const globalIndex = i + j + 1;
            
            rows.push(
                <tr key={`${item.dwell}-${item.commodity}-${globalIndex}`} className="hover:bg-slate-50 text-center text-sm">
                    <td className="border border-black p-2">{globalIndex}</td>
                    {isFirst && (
                        <td 
                            className="border border-black p-2 font-bold text-red-600 align-middle bg-white text-lg" 
                            rowSpan={span}
                        >
                            {item.dwell}
                        </td>
                    )}
                    <td className="border border-black p-2 text-left">{item.commodity}</td>
                    <td className="border border-black p-2">
                        {item.owners.map((o, idx) => (
                            <div key={idx} className="whitespace-nowrap">{o}</div>
                        ))}
                    </td>
                    <td className="border border-black p-2 text-xs">
                         {item.bls.map((b, idx) => (
                             <div key={idx} className="whitespace-nowrap">{b}</div>
                         ))}
                    </td>
                    <td className="border border-black p-2 text-xs">
                        {item.flows.map((f, idx) => (
                            <div key={idx}>{f}</div>
                        ))}
                    </td>
                    <td className="border border-black p-2 font-bold">{item.teus}</td>
                </tr>
            );
        }
        i += span;
    }
    
    const emptyRowsCount = Math.max(0, 10 - groupedLongStanding.length);
    for (let k = 0; k < emptyRowsCount; k++) {
         rows.push(
            <tr key={`empty-${k}`} className="text-center text-sm">
                <td className="border border-black p-2">&nbsp;</td>
                <td className="border border-black p-2">&nbsp;</td>
                <td className="border border-black p-2">&nbsp;</td>
                <td className="border border-black p-2">&nbsp;</td>
                <td className="border border-black p-2">&nbsp;</td>
                <td className="border border-black p-2">&nbsp;</td>
                <td className="border border-black p-2">&nbsp;</td>
            </tr>
         );
    }

    return rows;
  };

  return (
    <div className="space-y-8">
        <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200" ref={reportRef}>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-800 uppercase tracking-tight italic">Dwell Time Statistics</h2>
                <div className="flex items-center space-x-4">
                    <div className="text-xs text-slate-500 italic text-right">
                        <div className="font-bold text-blue-600">* Avg Dwell tính cho cont ≤ 90 ngày.</div>
                        <div>* Count/TEUs phản ánh toàn bộ tồn bãi.</div>
                    </div>
                    <button 
                        onClick={handleExportImage}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center shadow transition-all active:scale-95"
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4 4m4-4v12" />
                        </svg>
                        Export Image
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto border border-slate-300">
                <table className="w-full border-collapse text-center">
                    <thead>
                        <tr className="text-black font-bold text-sm">
                            <th className="bg-blue-200 border border-slate-400 p-3 w-1/4">Hướng</th>
                            <th className="bg-amber-400 border border-slate-400 p-3 w-1/3" colSpan={2}>Điều kiện</th>
                            <th className="bg-lime-400 border border-slate-400 p-3" colSpan={4}>Tổng kết (Inventory)</th>
                        </tr>
                        <tr className="bg-blue-100 text-slate-800 font-bold text-xs uppercase text-center">
                            <th className="border border-slate-400 p-2">Phân loại</th>
                            <th className="border border-slate-400 p-2">Mô tả Flow</th>
                            <th className="border border-slate-400 p-2 w-16">F/E</th>
                            <th className="border border-slate-400 p-2 w-24">Tổng Cont</th>
                            <th className="border border-slate-400 p-2 w-24 bg-yellow-100 text-yellow-900">Cont ≤ 90</th>
                            <th className="border border-slate-400 p-2 w-24">Teus</th>
                            <th className="border border-slate-400 p-2 w-24">Avg Dwell (≤ 90)</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm text-slate-800">
                        <tr className="bg-white hover:bg-slate-50 transition-colors">
                            <td className="border border-slate-300 p-2 font-medium">Hàng nhập tàu (1)</td>
                            <td className="border border-slate-300 p-2">IMPORT</td>
                            <td className="border border-slate-300 p-2">F</td>
                            <td className="border border-slate-300 p-2">{stats.row1.count.toLocaleString()}</td>
                            <td className="border border-slate-300 p-2 bg-yellow-50 font-medium text-slate-900">{stats.row1.countUnder90.toLocaleString()}</td>
                            <td className="border border-slate-300 p-2">{stats.row1.teus.toLocaleString()}</td>
                            <td className="border border-slate-300 p-2 font-bold text-blue-700">{stats.row1.avgDwell.toFixed(1)}</td>
                        </tr>
                        <tr className="bg-white hover:bg-slate-50 transition-colors">
                            <td className="border border-slate-300 p-2 font-medium">Hàng nhập chuyển cảng (2)</td>
                            <td className="border border-slate-300 p-2">IMPORT STORAGE</td>
                            <td className="border border-slate-300 p-2">F</td>
                            <td className="border border-slate-300 p-2">{stats.row2.count.toLocaleString()}</td>
                            <td className="border border-slate-300 p-2 bg-yellow-50 font-medium text-slate-900">{stats.row2.countUnder90.toLocaleString()}</td>
                            <td className="border border-slate-300 p-2">{stats.row2.teus.toLocaleString()}</td>
                            <td className="border border-slate-300 p-2 font-bold text-blue-700">{stats.row2.avgDwell.toFixed(1)}</td>
                        </tr>
                        <tr className="bg-green-100 font-bold hover:bg-green-200 transition-colors border-t-2 border-green-300">
                            <td className="border border-slate-300 p-2">Hàng nhập (3) = (1)+(2)</td>
                            <td className="border border-slate-300 p-2 italic text-[10px]">IMPORT & IMPORT STORAGE</td>
                            <td className="border border-slate-300 p-2">F</td>
                            <td className="border border-slate-300 p-2">{stats.row3.count.toLocaleString()}</td>
                            <td className="border border-slate-300 p-2 bg-yellow-100 text-slate-900">{stats.row3.countUnder90.toLocaleString()}</td>
                            <td className="border border-slate-300 p-2">{stats.row3.teus.toLocaleString()}</td>
                            <td className="border border-slate-300 p-2 font-bold text-blue-800">{stats.row3.avgDwell.toFixed(1)}</td>
                        </tr>
                        <tr className="bg-white hover:bg-slate-50 transition-colors">
                            <td className="border border-slate-300 p-2 font-medium">Hàng xuất (4)</td>
                            <td className="border border-slate-300 p-2">EXPORT</td>
                            <td className="border border-slate-300 p-2">F</td>
                            <td className="border border-slate-300 p-2">{stats.row4.count.toLocaleString()}</td>
                            <td className="border border-slate-300 p-2 bg-yellow-50 font-medium text-slate-900">{stats.row4.countUnder90.toLocaleString()}</td>
                            <td className="border border-slate-300 p-2">{stats.row4.teus.toLocaleString()}</td>
                            <td className="border border-slate-300 p-2 font-bold text-blue-700">{stats.row4.avgDwell.toFixed(1)}</td>
                        </tr>
                        <tr className="bg-blue-100 font-bold hover:bg-blue-200 transition-colors border-t-2 border-blue-300">
                            <td className="border border-slate-300 p-2">Container hàng (3) + (4)</td>
                            <td className="border border-slate-300 p-2 italic text-[10px]">ALL FULL CONTAINERS</td>
                            <td className="border border-slate-300 p-2">F</td>
                            <td className="border border-slate-300 p-2">{stats.row5.count.toLocaleString()}</td>
                            <td className="border border-slate-300 p-2 bg-yellow-100 text-slate-900">{stats.row5.countUnder90.toLocaleString()}</td>
                            <td className="border border-slate-300 p-2">{stats.row5.teus.toLocaleString()}</td>
                            <td className="border border-slate-300 p-2 font-bold text-blue-800">{stats.row5.avgDwell.toFixed(1)}</td>
                        </tr>
                        <tr className="bg-blue-200 font-medium hover:bg-blue-300 transition-colors">
                            <td className="border border-slate-300 p-2">Container rỗng</td>
                            <td className="border border-slate-300 p-2">STORAGE EMPTY</td>
                            <td className="border border-slate-300 p-2">E</td>
                            <td className="border border-slate-300 p-2">{stats.row6.count.toLocaleString()}</td>
                            <td className="border border-slate-300 p-2 bg-yellow-50 text-slate-900">{stats.row6.countUnder90.toLocaleString()}</td>
                            <td className="border border-slate-300 p-2">{stats.row6.teus.toLocaleString()}</td>
                            <td className="border border-slate-300 p-2 font-bold text-blue-800">{stats.row6.avgDwell.toFixed(1)}</td>
                        </tr>
                        <tr className="bg-slate-700 text-white font-bold text-base shadow-2xl">
                            <td className="border border-slate-600 p-3 text-center uppercase tracking-widest" colSpan={3}>Tổng Tồn Bãi</td>
                            <td className="border border-slate-600 p-3">{stats.rowTotal.count.toLocaleString()}</td>
                            <td className="border border-slate-600 p-3 text-yellow-300">{stats.rowTotal.countUnder90.toLocaleString()}</td>
                            <td className="border border-slate-600 p-3">{stats.rowTotal.teus.toLocaleString()}</td>
                            <td className="border border-slate-600 p-3 font-bold">{stats.rowTotal.avgDwell.toFixed(1)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        {/* --- DANH MỤC HÀNG HOÁ TỒN LÂU --- */}
        <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200" ref={longStandingRef}>
             <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                 <div>
                    <h2 className="text-xl font-bold text-slate-800 uppercase italic tracking-tight underline decoration-blue-600 decoration-4 underline-offset-8">DANH MỤC HÀNG HOÁ TỒN LÂU (HÀNG NHẬP)</h2>
                    <p className="text-xs text-slate-500 mt-4 font-semibold uppercase tracking-widest">Top 10 Nhóm Tồn Lâu • Flow: Nhập (F) • Lưu bãi ≤ 90 ngày</p>
                 </div>
                 <button 
                    onClick={handleExcelExport}
                    className="bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-xl text-sm font-bold flex items-center shadow-lg transition-all active:scale-95"
                >
                    <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Tải Chi Tiết (Excel)
                </button>
             </div>

             <div className="overflow-x-auto border-2 border-black rounded-lg">
                <table className="w-full border-collapse">
                    <thead>
                         <tr className="bg-slate-900 text-white text-xs uppercase font-black text-center tracking-widest italic">
                            <th className="border border-black p-3 w-12">STT</th>
                            <th className="border border-black p-3 w-32 bg-red-600">Số ngày lưu</th>
                            <th className="border border-black p-3 text-left">Hàng hoá</th>
                            <th className="border border-black p-3">Hãng Khai thác</th>
                            <th className="border border-black p-3">Số vận đơn (BL)</th>
                            <th className="border border-black p-3">Hướng (Flow)</th>
                            <th className="border border-black p-3 text-blue-400">Teus</th>
                         </tr>
                    </thead>
                    <tbody className="text-sm text-slate-800">
                        {renderTableRows()}
                    </tbody>
                </table>
             </div>
        </div>
    </div>
  );
};

export default DwellTimeStatistics;
