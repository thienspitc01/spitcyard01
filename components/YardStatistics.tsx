
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { BlockStats, Container, BlockConfig } from '../types';
// FIX: Import shared utility instead of defining it locally
import { calculateTEU } from '../App';

// Declare html2canvas globally since it's loaded via CDN
declare const html2canvas: any;

interface YardStatisticsProps {
  data: BlockStats[];
  isoTypeFilter: 'ALL' | 'DRY' | 'REEFER';
  onFilterChange: (filter: 'ALL' | 'DRY' | 'REEFER') => void;
  containers: Container[];
  blocks: BlockConfig[];
}

const RTG_BLOCKS_LIST = [
    'A0', 'A1', 'A2', 
    'B1', 'B2', 
    'C1', 'C2', 
    'D1', 'D2', 
    'E1', 'E2', 
    'F1', 'F2', 
    'G1', 'G2', 
    'H0', 'H1', 'H2', 
    'I0', 'I1', 'I2'
];

// Updated ProgressBar to support multiple colored segments (stacked)
const ProgressBar: React.FC<{
  items: { percentage: number; colorClass: string }[];
  heightClass?: string;
}> = ({ items, heightClass = "h-2.5" }) => (
  <div className={`w-full bg-slate-200 rounded-full ${heightClass} my-2 overflow-hidden flex shadow-inner`}>
    {items.map((item, index) => (
      <div
        key={index}
        className={`${item.colorClass} h-full transition-all duration-300`}
        style={{ width: `${item.percentage}%` }}
        title={`${item.percentage.toFixed(1)}%`}
      ></div>
    ))}
  </div>
);

const StatCell: React.FC<{ count: number; teus: number; percentage: number; colorClass: string; bgClass: string }> = ({ count, teus, percentage, colorClass, bgClass }) => (
  <td className={`border-b border-r border-slate-200 px-3 py-3 text-center align-top ${bgClass}`}>
    <div className="flex flex-col h-full justify-between">
        <div>
            <div className="font-semibold text-slate-800 text-sm">{count.toLocaleString()} <span className="text-[10px] text-slate-500 font-normal">cntr</span></div>
            <div className="font-bold text-slate-900 text-base">{teus.toLocaleString()} <span className="text-[10px] text-slate-500 font-normal">teu</span></div>
        </div>
        <div className="mt-2">
            <div className="text-xs font-bold text-slate-600 text-right mb-0.5">{percentage.toFixed(0)}%</div>
            <ProgressBar items={[{ percentage, colorClass }]} heightClass="h-1.5" />
        </div>
    </div>
  </td>
);

// Removed redundant calculateTEU definition here as it is now imported from App.tsx

const YardStatistics: React.FC<YardStatisticsProps> = ({ data, containers, blocks }) => {
  const [selectedBlocks, setSelectedBlocks] = useState<Set<string>>(new Set<string>());
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(true);
  const [isDetailOpen, setIsDetailOpen] = useState(true);
  
  const filterRef = useRef<HTMLTableHeaderCellElement>(null);
  
  // Refs for capturing images
  const yardCapacityRef = useRef<HTMLDivElement>(null);
  const stockOverviewRef = useRef<HTMLDivElement>(null);

  // Initialize selected blocks with all available blocks when data loads
  useEffect(() => {
    if (data.length > 0 && selectedBlocks.size === 0) {
      setSelectedBlocks(new Set<string>(data.map(b => b.name)));
    }
  }, [data]);

  // Handle click outside to close filter dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (data.length === 0) {
    return null;
  }

  const allBlockNames: string[] = Array.from<string>(new Set(data.map((b) => b.name))).sort();

  // Categorize Blocks
  const rtgBlocks = allBlockNames.filter(name => RTG_BLOCKS_LIST.includes(name));
  const rsBlocks = allBlockNames.filter(name => !RTG_BLOCKS_LIST.includes(name));

  const toggleBlock = (name: string) => {
    const newSelected = new Set(selectedBlocks);
    if (newSelected.has(name)) {
      newSelected.delete(name);
    } else {
      newSelected.add(name);
    }
    setSelectedBlocks(newSelected);
  };

  const toggleAll = () => {
    if (selectedBlocks.size === allBlockNames.length) {
      setSelectedBlocks(new Set());
    } else {
      setSelectedBlocks(new Set(allBlockNames));
    }
  };

  const toggleGroup = (groupBlocks: string[]) => {
      // Check if all blocks in this group are currently selected
      const allSelected = groupBlocks.every(b => selectedBlocks.has(b));
      
      const newSelected = new Set(selectedBlocks);
      if (allSelected) {
          // Deselect all in group
          groupBlocks.forEach(b => newSelected.delete(b));
      } else {
          // Select all in group
          groupBlocks.forEach(b => newSelected.add(b));
      }
      setSelectedBlocks(newSelected);
  };

  const isGroupSelected = (groupBlocks: string[]) => {
      return groupBlocks.length > 0 && groupBlocks.every(b => selectedBlocks.has(b));
  };


  // --- IMAGE EXPORT FUNCTION ---
  const handleExportImage = async (ref: React.RefObject<HTMLDivElement>, fileName: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent toggling the accordion when clicking the button
    
    if (ref.current && typeof html2canvas !== 'undefined') {
        try {
            // Using html2canvas to capture the element
            const canvas = await html2canvas(ref.current, {
                backgroundColor: '#ffffff', // Ensure white background
                scale: 2, // Higher resolution
                useCORS: true,
                logging: false,
            });
            
            const image = canvas.toDataURL("image/png");
            
            // Create a temporary link to trigger download
            const link = document.createElement('a');
            link.href = image;
            link.download = `${fileName}_${new Date().toISOString().slice(0,10)}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error("Export failed:", error);
            alert("Could not export image. Please try again.");
        }
    } else {
        alert("Export functionality is initializing. Please wait a moment.");
    }
  };

  const filteredData = data.filter(b => selectedBlocks.has(b.name));

  // --- CALCULATION FOR DETAILED TABLE ---
  const calculateTotals = (blocks: BlockStats[]) => {
    return blocks.reduce(
      (acc, block) => {
        acc.capacity += block.capacity;
        acc.exportFullTeus += block.exportFullTeus;
        acc.importFullTeus += block.importFullTeus;
        acc.emptyTeus += block.emptyTeus;
        acc.exportFullCount += block.exportFullCount;
        acc.importFullCount += block.importFullCount;
        acc.emptyCount += block.emptyCount;
        return acc;
      },
      { capacity: 0, exportFullTeus: 0, importFullTeus: 0, emptyTeus: 0, exportFullCount: 0, importFullCount: 0, emptyCount: 0 }
    );
  };
  
  const grandTotal = calculateTotals(filteredData);
  const totalUsed = grandTotal.exportFullTeus + grandTotal.importFullTeus + grandTotal.emptyTeus;
  const totalAvailable = grandTotal.capacity - totalUsed;
  
  const totalExportPercent = grandTotal.capacity > 0 ? (grandTotal.exportFullTeus / grandTotal.capacity) * 100 : 0;
  const totalImportPercent = grandTotal.capacity > 0 ? (grandTotal.importFullTeus / grandTotal.capacity) * 100 : 0;
  const totalEmptyPercent = grandTotal.capacity > 0 ? (grandTotal.emptyTeus / grandTotal.capacity) * 100 : 0;
  const totalUsedPercent = grandTotal.capacity > 0 ? (totalUsed / grandTotal.capacity) * 100 : 0;
  const totalAvailablePercent = grandTotal.capacity > 0 ? (totalAvailable / grandTotal.capacity) * 100 : 0;


  // --- CALCULATION FOR YARD CAPACITY TABLE (NEW) ---
  const capacityStats = useMemo(() => {
      // Updated capacities based on user request
      const CAP_INBOUND = 6124;
      const CAP_OUTBOUND = 7914;
      const CAP_EMPTY = 21024;
      const CAP_TOTAL = CAP_INBOUND + CAP_OUTBOUND + CAP_EMPTY;

      // Filter containers that are not end-parts of 40'
      const relevantContainers = containers.filter(c => !(c.isMultiBay && c.partType === 'end'));
      
      let inboundStock = 0;
      let outboundStock = 0;
      let emptyStock = 0;

      relevantContainers.forEach(c => {
          const teu = calculateTEU(c);

          // Priority 1: Outbound (Export - Full or Empty)
          if (c.flow === 'EXPORT') {
              outboundStock += teu;
          }
          // Priority 2: Empty Stock (Empty, non-Export)
          else if (c.status === 'EMPTY') {
              emptyStock += teu;
          } 
          // Priority 3: Inbound (Full, non-Export)
          else {
              inboundStock += teu;
          }
      });

      const totalStockTeus = inboundStock + outboundStock + emptyStock;
      
      return {
          inbound: {
              cap: CAP_INBOUND,
              stock: inboundStock,
              used: CAP_INBOUND > 0 ? (inboundStock / CAP_INBOUND) * 100 : 0,
              avail: CAP_INBOUND - inboundStock
          },
          outbound: {
              cap: CAP_OUTBOUND,
              stock: outboundStock,
              used: CAP_OUTBOUND > 0 ? (outboundStock / CAP_OUTBOUND) * 100 : 0,
              avail: CAP_OUTBOUND - outboundStock
          },
          empty: {
              cap: CAP_EMPTY,
              stock: emptyStock,
              used: CAP_EMPTY > 0 ? (emptyStock / CAP_EMPTY) * 100 : 0,
              avail: CAP_EMPTY - emptyStock
          },
          total: {
              cap: CAP_TOTAL,
              stock: totalStockTeus,
              used: CAP_TOTAL > 0 ? (totalStockTeus / CAP_TOTAL) * 100 : 0,
              avail: CAP_TOTAL - totalStockTeus
          }
      };
  }, [containers]);


  return (
    <div className="space-y-6">
      
      {/* --- NEW YARD CAPACITY TABLE --- */}
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden" ref={yardCapacityRef}>
        <div 
            className="w-full flex justify-between items-center p-4 bg-slate-800 text-white font-bold cursor-pointer hover:bg-slate-700 transition-colors"
            onClick={() => setIsSummaryOpen(!isSummaryOpen)}
        >
            <span>YARD CAPACITY</span>
            <div className="flex items-center space-x-3">
                 <button
                    onClick={(e) => handleExportImage(yardCapacityRef, 'Yard_Capacity_Report', e)}
                    className="p-1.5 bg-slate-600 hover:bg-blue-600 rounded text-xs flex items-center space-x-1 transition-colors border border-slate-500"
                    title="Export as Image"
                 >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4 4m4-4v12" />
                     </svg>
                     <span>Export Image</span>
                 </button>
                <svg className={`w-5 h-5 transition-transform ${isSummaryOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </div>
        </div>
        
        {isSummaryOpen && (
            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-gray-500 text-white uppercase text-sm font-bold tracking-wider">
                            <th className="p-3 border-r border-gray-400 text-left w-48"></th>
                            <th className="p-3 border-r border-gray-400 text-center w-40">Capacity (Teus)</th>
                            <th className="p-3 border-r border-gray-400 text-center w-40">Stock (Teus)</th>
                            <th className="p-3 border-r border-gray-400 text-left">Conditions</th>
                            <th className="p-3 border-r border-gray-400 text-center w-40">Capacity used (%)</th>
                            <th className="p-3 text-center w-40">Available Cap. (Teus)</th>
                        </tr>
                    </thead>
                    <tbody className="text-slate-800 font-semibold text-base">
                        {/* Inbound Row */}
                        <tr className="border-b border-gray-200">
                            <td className="p-3 bg-[#92d050] text-black">Inbound</td>
                            <td className="p-3 text-center border-r border-gray-200">{capacityStats.inbound.cap.toLocaleString()}</td>
                            <td className="p-3 text-center border-r border-gray-200">{capacityStats.inbound.stock.toLocaleString()}</td>
                            <td className="p-3 text-left pl-6 border-r border-gray-200 text-sm font-normal text-gray-500">
                                Status: <b>Full</b> & Flow: <b>Not Export</b>
                            </td>
                            <td className="p-3 text-center border-r border-gray-200">{capacityStats.inbound.used.toFixed(1)}%</td>
                            <td className={`p-3 text-center font-bold ${capacityStats.inbound.avail < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {capacityStats.inbound.avail.toLocaleString()}
                            </td>
                        </tr>
                        {/* Outbound Row */}
                        <tr className="border-b border-gray-200">
                            <td className="p-3 bg-[#ffc000] text-black">Outbound</td>
                            <td className="p-3 text-center border-r border-gray-200">{capacityStats.outbound.cap.toLocaleString()}</td>
                            <td className="p-3 text-center border-r border-gray-200">{capacityStats.outbound.stock.toLocaleString()}</td>
                            <td className="p-3 text-left pl-6 border-r border-gray-200 text-sm font-normal text-gray-500">
                                Status: <b>Full/Empty</b> & Flow: <b>Export</b>
                            </td>
                            <td className="p-3 text-center border-r border-gray-200">{capacityStats.outbound.used.toFixed(1)}%</td>
                             <td className={`p-3 text-center font-bold ${capacityStats.outbound.avail < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {capacityStats.outbound.avail.toLocaleString()}
                            </td>
                        </tr>
                        {/* Empty Stock Row */}
                        <tr className="border-b border-gray-200">
                            <td className="p-3 bg-[#00b0f0] text-black">Empty stock</td>
                            <td className="p-3 text-center border-r border-gray-200">{capacityStats.empty.cap.toLocaleString()}</td>
                            <td className="p-3 text-center border-r border-gray-200">{capacityStats.empty.stock.toLocaleString()}</td>
                            <td className="p-3 text-left pl-6 border-r border-gray-200 text-sm font-normal text-gray-500">
                                Status: <b>Empty</b> & Flow: <b>Not Export</b>
                            </td>
                             <td className="p-3 text-center border-r border-gray-200">{capacityStats.empty.used.toFixed(1)}%</td>
                            <td className={`p-3 text-center font-bold ${capacityStats.empty.avail < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {capacityStats.empty.avail.toLocaleString()}
                            </td>
                        </tr>
                         {/* Total Row */}
                        <tr className="font-bold bg-yellow-300">
                            <td className="p-3 text-black">Total</td>
                            <td className="p-3 text-center border-r border-yellow-400">{capacityStats.total.cap.toLocaleString()}</td>
                            <td className="p-3 text-center border-r border-yellow-400 text-lg">{capacityStats.total.stock.toLocaleString()}</td>
                            <td className="p-3 border-r border-yellow-400"></td>
                            <td className="p-3 text-center border-r border-yellow-400 text-lg">{capacityStats.total.used.toFixed(1)}%</td>
                            <td className={`p-3 text-center text-lg ${capacityStats.total.avail < 0 ? 'text-red-700' : 'text-slate-800'}`}>
                                {capacityStats.total.avail.toLocaleString()}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        )}
      </div>


      {/* --- EXISTING DETAILED TABLE --- */}
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 min-h-[500px]" ref={stockOverviewRef}>
        <div 
            className="w-full flex justify-between items-center p-4 bg-slate-800 text-white font-bold border-b border-slate-700 cursor-pointer hover:bg-slate-700 transition-colors"
            onClick={() => setIsDetailOpen(!isDetailOpen)}
        >
            <span>STOCK OVERVIEW (DETAILED BY BLOCK)</span>
            <div className="flex items-center space-x-3">
                <button
                    onClick={(e) => handleExportImage(stockOverviewRef, 'Stock_Overview_Report', e)}
                    className="p-1.5 bg-slate-600 hover:bg-blue-600 rounded text-xs flex items-center space-x-1 transition-colors border border-slate-500"
                    title="Export as Image"
                 >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4 4m4-4v12" />
                     </svg>
                     <span>Export Image</span>
                 </button>
                <svg className={`w-5 h-5 transition-transform ${isDetailOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </div>
        </div>

        {isDetailOpen && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
            <thead>
                {/* Header Row 1: High Level Grouping */}
                <tr className="bg-slate-700 text-white">
                {/* Empty space for Block/Capacity columns */}
                <th className="border-r border-slate-600 bg-white w-[200px]" colSpan={2}></th> 
                
                {/* STOCK Header */}
                <th className="border-r border-slate-600 py-2 px-4 bg-cyan-600 text-sm font-bold tracking-widest uppercase" colSpan={4}>
                    Stock Overview (TEU)
                </th>
                
                {/* AVAILABLE CAP Header */}
                <th className="py-2 px-4 bg-slate-700 text-sm font-bold tracking-widest uppercase" colSpan={2}>
                    Availability
                </th>
                </tr>

                {/* Header Row 2: Specific Columns */}
                <tr className="text-white text-xs uppercase font-bold tracking-wider">
                {/* BLOCK with Filter */}
                <th className="border-r border-slate-300 p-3 bg-cyan-700 w-28 text-left align-bottom relative group cursor-pointer" ref={filterRef} onClick={() => setIsFilterOpen(!isFilterOpen)}>
                    <div className="flex items-center justify-between">
                    <span>Block</span>
                    <svg className="w-4 h-4 text-cyan-200" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/>
                    </svg>
                    </div>
                    <div className="text-[9px] font-normal opacity-80 mt-1">
                    {selectedBlocks.size === allBlockNames.length ? 'All selected' : `${selectedBlocks.size} selected`}
                    </div>

                    {/* Filter Dropdown */}
                    {isFilterOpen && (
                    <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-2xl z-50 text-slate-700 max-h-96 flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-lg">
                            <label className="flex items-center space-x-2 cursor-pointer font-bold text-xs uppercase tracking-wide">
                                <input 
                                type="checkbox" 
                                checked={selectedBlocks.size === allBlockNames.length}
                                onChange={toggleAll}
                                className="rounded text-cyan-600 focus:ring-cyan-500 border-gray-300"
                                />
                                <span>Select All</span>
                            </label>
                        </div>
                        <div className="overflow-y-auto p-0 flex-1">
                            {/* RTG Section */}
                            {rtgBlocks.length > 0 && (
                                <div className="border-b border-slate-100">
                                    <div className="bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500 flex items-center justify-between sticky top-0">
                                        <span>RTG BLOCKS</span>
                                        <input 
                                            type="checkbox" 
                                            checked={isGroupSelected(rtgBlocks)}
                                            onChange={() => toggleGroup(rtgBlocks)}
                                            className="rounded text-blue-600 focus:ring-blue-500 border-gray-300 h-3 w-3"
                                        />
                                    </div>
                                    <div className="p-2 grid grid-cols-2 gap-1">
                                        {rtgBlocks.map((name: string) => (
                                            <label key={name} className="flex items-center space-x-2 cursor-pointer hover:bg-cyan-50 p-1 rounded transition-colors">
                                            <input 
                                                type="checkbox" 
                                                checked={selectedBlocks.has(name)}
                                                onChange={() => toggleBlock(name)}
                                                className="rounded text-cyan-600 focus:ring-cyan-500 border-gray-300 h-4 w-4"
                                            />
                                            <span className="text-xs font-medium text-slate-700">{name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* RS Section */}
                            {rsBlocks.length > 0 && (
                                <div>
                                    <div className="bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-500 flex items-center justify-between sticky top-0">
                                        <span>RS / OTHER BLOCKS</span>
                                        <input 
                                            type="checkbox" 
                                            checked={isGroupSelected(rsBlocks)}
                                            onChange={() => toggleGroup(rsBlocks)}
                                            className="rounded text-orange-600 focus:ring-orange-500 border-gray-300 h-3 w-3"
                                        />
                                    </div>
                                    <div className="p-2 grid grid-cols-2 gap-1">
                                        {rsBlocks.map((name: string) => (
                                            <label key={name} className="flex items-center space-x-2 cursor-pointer hover:bg-orange-50 p-1 rounded transition-colors">
                                            <input 
                                                type="checkbox" 
                                                checked={selectedBlocks.has(name)}
                                                onChange={() => toggleBlock(name)}
                                                className="rounded text-orange-600 focus:ring-orange-500 border-gray-300 h-4 w-4"
                                            />
                                            <span className="text-xs font-medium text-slate-700">{name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    )}
                </th>

                <th className="border-r border-slate-300 p-3 bg-cyan-700 w-24 align-bottom text-right">
                    <div className="opacity-70 text-[9px] mb-0.5">Max</div>
                    <div>Cap.</div>
                </th>
                
                <th className="border-r border-slate-300 p-3 bg-[#ffc000] w-40 align-bottom text-center text-yellow-900">
                    Outbound
                    <div className="text-[9px] opacity-75 font-normal">Export (Full/Empty)</div>
                </th>
                
                <th className="border-r border-slate-300 p-3 bg-[#92d050] w-40 align-bottom text-center text-green-900">
                    Inbound
                    <div className="text-[9px] opacity-75 font-normal">Import/Other</div>
                </th>
                
                <th className="border-r border-slate-300 p-3 bg-[#00b0f0] w-40 align-bottom text-center">
                    Empty Stock
                    <div className="text-[9px] opacity-75 font-normal text-white">Non-Export</div>
                </th>
                
                <th className="border-r border-slate-300 p-3 bg-purple-600 w-28 align-bottom text-center">
                    <div>Total</div>
                    <div>Used</div>
                </th>
                
                <th className="border-r border-slate-300 p-3 bg-slate-600 w-32 align-bottom text-center">
                    Available Teus
                </th>
                
                <th className="p-3 bg-slate-600 w-24 align-bottom text-center">
                    Avail %
                </th>
                </tr>
            </thead>
            <tbody className="text-slate-700 divide-y divide-slate-100">
                {filteredData.map((block, idx) => {
                const usedTeus = block.exportFullTeus + block.importFullTeus + block.emptyTeus;
                const availableTeus = block.capacity - usedTeus;
                
                const exportPercent = block.capacity > 0 ? (block.exportFullTeus / block.capacity) * 100 : 0;
                const importPercent = block.capacity > 0 ? (block.importFullTeus / block.capacity) * 100 : 0;
                const emptyPercent = block.capacity > 0 ? (block.emptyTeus / block.capacity) * 100 : 0;
                const totalUsedPercent = block.capacity > 0 ? (usedTeus / block.capacity) * 100 : 0;
                const availablePercent = block.capacity > 0 ? (availableTeus / block.capacity) * 100 : 0;

                const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50';

                return (
                    <tr key={block.name} className={`${rowBg} hover:bg-blue-50/50 transition-colors group`}>
                    <td className="border-r border-slate-200 p-3 font-bold text-center align-middle text-lg text-cyan-800 bg-inherit">
                        {block.name}
                    </td>
                    <td className="border-r border-slate-200 p-3 text-right align-middle font-bold text-lg text-slate-600 bg-inherit font-mono">
                        {block.capacity.toLocaleString()}
                    </td>
                    
                    {/* Outbound Stats (Export Full) */}
                    <StatCell count={block.exportFullCount} teus={block.exportFullTeus} percentage={exportPercent} colorClass="bg-[#ffc000]" bgClass="bg-yellow-50/30" />
                    
                    {/* Inbound Stats (Import Full) */}
                    <StatCell count={block.importFullCount} teus={block.importFullTeus} percentage={importPercent} colorClass="bg-[#92d050]" bgClass="bg-green-50/30" />
                    
                    {/* Empty Stats */}
                    <StatCell count={block.emptyCount} teus={block.emptyTeus} percentage={emptyPercent} colorClass="bg-[#00b0f0]" bgClass="bg-blue-50/30" />
                    
                    {/* Total Used */}
                    <td className="border-r border-slate-200 p-3 text-center align-middle bg-purple-50/30">
                        <div className="font-extrabold text-purple-700 text-xl">{totalUsedPercent.toFixed(0)}%</div>
                        <div className="text-xs text-slate-400 mt-1">
                            {usedTeus.toLocaleString()} / {block.capacity.toLocaleString()}
                        </div>
                    </td>

                    {/* Available Teus with Stacked Bar */}
                    <td className="border-r border-slate-200 p-3 text-center align-middle bg-inherit">
                        <div className="font-bold text-slate-700 text-base mb-1">{availableTeus.toLocaleString()}</div>
                        <ProgressBar 
                            heightClass="h-4"
                            items={[
                            { percentage: exportPercent, colorClass: 'bg-[#ffc000]' },
                            { percentage: importPercent, colorClass: 'bg-[#92d050]' },
                            { percentage: emptyPercent, colorClass: 'bg-[#00b0f0]' }
                        ]} />
                    </td>
                    
                    {/* Total % (Big Number) */}
                    <td className="p-3 text-center align-middle bg-inherit">
                        <div className={`font-black text-2xl ${availablePercent < 10 ? 'text-red-500' : 'text-slate-800'}`}>
                            {availablePercent.toFixed(0)}%
                        </div>
                    </td>
                    </tr>
                );
                })}
                
                {/* Total Row */}
                {filteredData.length > 0 && (
                <tr className="bg-slate-100 border-t-2 border-slate-300 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] sticky bottom-0 z-10">
                    <td className="border-r border-slate-300 p-4 font-black text-center text-slate-800 tracking-wider">TOTAL</td>
                    <td className="border-r border-slate-300 p-4 font-black text-right text-slate-800 font-mono text-lg">{grandTotal.capacity.toLocaleString()}</td>
                    
                    {/* Export Total */}
                    <td className="border-r border-slate-300 p-3 text-center align-top bg-yellow-100/50">
                        <div className="text-sm font-bold text-yellow-800">{grandTotal.exportFullTeus.toLocaleString()} <span className="text-[10px] font-normal opacity-70">TEU</span></div>
                        <div className="text-xs text-yellow-700 mt-0.5">({grandTotal.exportFullCount.toLocaleString()} cntr)</div>
                        <div className="text-xl font-black text-yellow-900 mt-2">{totalExportPercent.toFixed(0)}%</div>
                    </td>

                    {/* Import Total */}
                    <td className="border-r border-slate-300 p-3 text-center align-top bg-green-100/50">
                        <div className="text-sm font-bold text-green-800">{grandTotal.importFullTeus.toLocaleString()} <span className="text-[10px] font-normal opacity-70">TEU</span></div>
                        <div className="text-xs text-green-700 mt-0.5">({grandTotal.importFullCount.toLocaleString()} cntr)</div>
                        <div className="text-xl font-black text-green-900 mt-2">{totalImportPercent.toFixed(0)}%</div>
                    </td>

                    {/* Empty Total */}
                    <td className="border-r border-slate-300 p-3 text-center align-top bg-blue-100/50">
                        <div className="text-sm font-bold text-blue-800">{grandTotal.emptyTeus.toLocaleString()} <span className="text-[10px] font-normal opacity-70">TEU</span></div>
                        <div className="text-xs text-blue-700 mt-0.5">({grandTotal.emptyCount.toLocaleString()} cntr)</div>
                        <div className="text-xl font-black text-blue-900 mt-2">{totalEmptyPercent.toFixed(0)}%</div>
                    </td>
                    
                    {/* Total Used Summary */}
                    <td className="border-r border-slate-300 p-3 text-center align-middle bg-purple-100/50">
                        <div className="font-black text-2xl text-purple-900">{totalUsedPercent.toFixed(0)}%</div>
                        <div className="text-xs font-bold text-purple-800 uppercase tracking-wide mt-1">Occupied</div>
                    </td>

                    {/* Total Available Summary (Stacked Bar) */}
                    <td className="border-r border-slate-300 p-3 text-center align-middle">
                        <div className="font-bold text-lg text-slate-800 mb-1">{totalAvailable.toLocaleString()}</div>
                        <ProgressBar 
                        heightClass="h-4"
                        items={[
                            { percentage: totalExportPercent, colorClass: 'bg-[#ffc000]' },
                            { percentage: totalImportPercent, colorClass: 'bg-[#92d050]' },
                            { percentage: totalEmptyPercent, colorClass: 'bg-[#00b0f0]' }
                        ]} />
                    </td>

                    {/* Total Available % */}
                    <td className="p-3 text-center align-middle">
                        <div className="font-black text-2xl text-slate-800">{totalAvailablePercent.toFixed(0)}%</div>
                    </td>
                </tr>
                )}
            </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default YardStatistics;
