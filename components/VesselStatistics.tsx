
import React, { useState, useMemo, useRef, useEffect } from 'react';
/* Removed non-existent VesselStatsData import which caused build error */
import { BlockConfig, Container, ScheduleData, RTG_BLOCK_NAMES } from '../types';
import { calculateTEU } from '../App';

// Declare global libraries loaded via CDN
declare const pdfjsLib: any;
declare const Tesseract: any;
declare const html2canvas: any;

interface VesselStatisticsProps {
  containers: Container[];
  vessels: string[];
  blocks: BlockConfig[];
  onSelectVessels?: (vessels: string[]) => void;
  scheduleData: ScheduleData[];
  onScheduleChange: (newSchedule: ScheduleData[]) => void;
}

const STORAGE_KEY_TEXT = 'yard_schedule_text_v1';

type VesselFilterType = 'ALL' | 'SCHEDULE' | 'OTHER';

const VesselStatistics: React.FC<VesselStatisticsProps> = ({ 
    containers, 
    vessels, 
    blocks, 
    onSelectVessels,
    scheduleData,
    onScheduleChange 
}) => {
  const [selectedVessels, setSelectedVessels] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'filters' | 'schedule' | 'discharge' | 'load'>('filters');
  const [vesselFilterType, setVesselFilterType] = useState<VesselFilterType>('ALL');
  
  // Block Filter State
  const [selectedBlockNames, setSelectedBlockNames] = useState<Set<string>>(new Set());
  const [isBlockFilterOpen, setIsBlockFilterOpen] = useState(false);
  const blockFilterRef = useRef<HTMLTableHeaderCellElement>(null);

  const [pastedText, setPastedText] = useState(() => {
       return localStorage.getItem(STORAGE_KEY_TEXT) || '';
  });

  const [isParsing, setIsParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerCountRef = useRef<HTMLDivElement>(null);
  
  // Initialize selectedBlockNames with all blocks on mount/update
  useEffect(() => {
    if (blocks.length > 0) {
        setSelectedBlockNames(prev => {
             if (prev.size === 0) return new Set(blocks.map(b => b.name));
             return prev;
        });
    }
  }, [blocks]);

  // Click outside listener for Block Filter
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (blockFilterRef.current && !blockFilterRef.current.contains(event.target as Node)) {
        setIsBlockFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
      localStorage.setItem(STORAGE_KEY_TEXT, pastedText);
  }, [pastedText]);

  // Master Filter States
  const [isExportChecked, setIsExportChecked] = useState(true);
  const [isImportChecked, setIsImportChecked] = useState(true);

  // Sub Filter States
  const [filterExportFull, setFilterExportFull] = useState(true);
  const [filterExportEmpty, setFilterExportEmpty] = useState(true);
  const [filterImportFull, setFilterImportFull] = useState(true);
  const [filterImportEmpty, setFilterImportEmpty] = useState(true);

  const handleVesselSelection = (vessel: string) => {
    setSelectedVessels(prev =>
      prev.includes(vessel)
        ? prev.filter(v => v !== vessel)
        : [...prev, vessel]
    );
  };

  const handleExportImage = async () => {
      if (containerCountRef.current && typeof html2canvas !== 'undefined') {
          try {
              const originalElement = containerCountRef.current;
              const clone = originalElement.cloneNode(true) as HTMLElement;
              clone.style.position = 'absolute';
              clone.style.left = '-9999px';
              clone.style.top = '0';
              clone.style.width = 'max-content';
              clone.style.height = 'auto';
              clone.style.maxHeight = 'none';
              clone.style.overflow = 'visible';
              clone.style.zIndex = '-1';
              const stickyElements = clone.querySelectorAll('.sticky');
              stickyElements.forEach((el) => {
                  el.classList.remove('sticky');
                  (el as HTMLElement).style.position = 'static';
              });
              document.body.appendChild(clone);
              const canvas = await html2canvas(clone, {
                  backgroundColor: '#ffffff',
                  scale: 2,
                  useCORS: true,
                  logging: false,
                  windowWidth: clone.scrollWidth,
                  windowHeight: clone.scrollHeight
              });
              document.body.removeChild(clone);
              const image = canvas.toDataURL("image/png");
              const link = document.createElement('a');
              link.href = image;
              link.download = `Container_Count_Per_Block_${new Date().toISOString().slice(0,10)}.png`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
          } catch (error) {
              console.error("Export failed:", error);
              alert("Could not export image. Please try again.");
          }
      } else {
          alert("Export functionality is initializing or library missing.");
      }
  };
  
  // --- FILE HANDLING LOGIC (Multiple Files supported) ---
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      setIsParsing(true);
      // Xoá dữ liệu cũ khi upload mới như yêu cầu
      setPastedText(''); 
      onScheduleChange([]);

      let accumulatedText = '';

      try {
          for (let fIdx = 0; fIdx < files.length; fIdx++) {
              const file = files[fIdx];
              let fileText = '';
              
              if (file.type === 'application/pdf') {
                  if (typeof pdfjsLib === 'undefined') throw new Error('PDF library not loaded.');
                  const arrayBuffer = await file.arrayBuffer();
                  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
                  const pdf = await loadingTask.promise;
                  const maxPages = Math.min(pdf.numPages, 10);
                  for (let i = 1; i <= maxPages; i++) {
                      const page = await pdf.getPage(i);
                      const textContent = await page.getTextContent();
                      const pageText = textContent.items.map((item: any) => item.str).join(' ');
                      fileText += `${pageText} `;
                  }
              } else if (file.type.startsWith('image/')) {
                  if (typeof Tesseract === 'undefined') throw new Error('OCR library not loaded.');
                  setPastedText(prev => prev + `[Processing ${file.name}...] `);
                  const result = await Tesseract.recognize(file, 'eng');
                  fileText = result.data.text;
              }

              accumulatedText += `--- ${file.name} ---\n${fileText}\n\n`;
          }
          setPastedText(accumulatedText);
      } catch (error: any) {
          console.error("File parsing error:", error);
          setPastedText(`Error reading file: ${error.message}`);
      } finally {
          setIsParsing(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
      }
  };

  const triggerFileUpload = () => {
      fileInputRef.current?.click();
  };

  const handleScheduleParse = () => {
    if (!pastedText.trim()) return;
    parseTextAndExtractSchedule(pastedText);
  };

  const parseTextAndExtractSchedule = (text: string) => {
    const vesselMatches: { name: string; index: number }[] = [];
    vessels.forEach(v => {
        if (!v || v.trim().length === 0) return;
        const escapedV = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const patternParts = escapedV.trim().split(/\s+/);
        if (patternParts.length === 0) return;
        const pattern = patternParts.join('[\\s\\r\\n]+');
        const regex = new RegExp(pattern, 'gi');
        let m;
        while ((m = regex.exec(text)) !== null) {
            vesselMatches.push({ name: v, index: m.index });
        }
    });

    vesselMatches.sort((a, b) => a.index - b.index);

    const dataMatches: { discharge: number; load: number; index: number }[] = [];
    const disLoadRegex = /Dis\/Load[:\s]*([0-9., ]+?)\s*[\/|\\]\s*([0-9., ]+)/gi;
    let match;
    while ((match = disLoadRegex.exec(text)) !== null) {
        const cleanNumber = (s: string) => {
            if (!s) return 0;
            return parseInt(s.replace(/[^\d]/g, ''), 10) || 0;
        };
        dataMatches.push({
            discharge: cleanNumber(match[1]),
            load: cleanNumber(match[2]),
            index: match.index
        });
    }

    const newSchedule: ScheduleData[] = [];
    dataMatches.forEach(data => {
        let bestVessel = null;
        for (let i = vesselMatches.length - 1; i >= 0; i--) {
            if (vesselMatches[i].index < data.index) {
                bestVessel = vesselMatches[i];
                break;
            }
        }
        if (bestVessel) {
             if (!newSchedule.find(s => s.vesselName === bestVessel!.name)) {
                newSchedule.push({
                    vesselName: bestVessel.name,
                    discharge: data.discharge,
                    load: data.load
                });
             }
        }
    });
    
    onScheduleChange(newSchedule);
    if (newSchedule.length > 0) {
        const foundNames = newSchedule.map(s => s.vesselName);
        const uniqueSelection = Array.from(new Set([...selectedVessels, ...foundNames]));
        setSelectedVessels(uniqueSelection);
        if (onSelectVessels) onSelectVessels(uniqueSelection.slice(0, 3)); 
    }
  };

  const filteredVesselList = useMemo(() => {
      return vessels.filter(v => {
          const isScheduled = scheduleData.some(s => s.vesselName === v);
          if (vesselFilterType === 'SCHEDULE') return isScheduled;
          if (vesselFilterType === 'OTHER') return !isScheduled;
          return true;
      });
  }, [vessels, vesselFilterType, scheduleData]);

  const isAllVisibleSelected = filteredVesselList.length > 0 && filteredVesselList.every(v => selectedVessels.includes(v));
  
  const handleSelectAllToggle = () => {
      if (isAllVisibleSelected) {
          setSelectedVessels(prev => prev.filter(v => !filteredVesselList.includes(v)));
      } else {
          setSelectedVessels(prev => {
              const newSet = new Set(prev);
              filteredVesselList.forEach(v => newSet.add(v));
              return Array.from(newSet);
          });
      }
  };

  const allBlockNames = useMemo(() => blocks.map(b => b.name).sort(), [blocks]);
  const rtgBlocks = useMemo(() => allBlockNames.filter(name => RTG_BLOCK_NAMES.includes(name)), [allBlockNames]);
  const rsBlocks = useMemo(() => allBlockNames.filter(name => !RTG_BLOCK_NAMES.includes(name)), [allBlockNames]);

  const toggleBlock = (name: string) => {
    const newSelected = new Set(selectedBlockNames);
    if (newSelected.has(name)) newSelected.delete(name);
    else newSelected.add(name);
    setSelectedBlockNames(newSelected);
  };

  const toggleAllBlocks = () => {
    if (selectedBlockNames.size === allBlockNames.length) setSelectedBlockNames(new Set());
    else setSelectedBlockNames(new Set(allBlockNames));
  };

  const tableData = useMemo(() => {
    const data: Record<string, any> = {};
    const totals = { c20: 0, c40: 0, teus: 0, vesselCounts: {} as any };
    const displayedVesselsSorted = selectedVessels.filter(v => vessels.includes(v)).sort();
    displayedVesselsSorted.forEach(v => totals.vesselCounts[v] = 0);
    blocks.forEach(b => {
        data[b.name] = { c20: 0, c40: 0, teus: 0, vesselCounts: {} as any };
        displayedVesselsSorted.forEach(v => data[b.name].vesselCounts[v] = 0);
    });
    containers.forEach(c => {
        if (!c.vessel || (c.isMultiBay && c.partType === 'end')) return;
        const isExportFlow = c.flow === 'EXPORT';
        const isImportGroup = !isExportFlow; 
        const isFull = c.status === 'FULL';
        const isEmpty = c.status === 'EMPTY';
        let include = false;
        if (isExportFlow) {
            if (isExportChecked && ((isFull && filterExportFull) || (isEmpty && filterExportEmpty))) include = true;
        } else if (isImportGroup) {
            if (isImportChecked && ((isFull && filterImportFull) || (isEmpty && filterImportEmpty))) include = true;
        }
        if (!include) return;
        if (displayedVesselsSorted.includes(c.vessel)) {
             if (data[c.block]) {
                 const stats = data[c.block];
                 stats.vesselCounts[c.vessel] = (stats.vesselCounts[c.vessel] || 0) + 1;
                 if (c.size === 20) stats.c20++; else stats.c40++;
                 stats.teus += calculateTEU(c);
                 if (selectedBlockNames.has(c.block)) {
                    totals.vesselCounts[c.vessel] = (totals.vesselCounts[c.vessel] || 0) + 1;
                    if (c.size === 20) totals.c20++; else totals.c40++;
                    totals.teus += calculateTEU(c);
                 }
             }
        }
    });
    return { rows: data, totals, displayedVessels: displayedVesselsSorted };
  }, [containers, blocks, selectedVessels, isExportChecked, isImportChecked, filterExportFull, filterExportEmpty, filterImportFull, filterImportEmpty, selectedBlockNames]);

  const visibleBlocks = useMemo(() => {
      if (tableData.displayedVessels.length === 0) return [];
      return blocks.filter(block => (tableData.rows[block.name]?.teus > 0) && selectedBlockNames.has(block.name));
  }, [blocks, tableData, selectedBlockNames]);

  const dischargeAnalysis = useMemo(() => {
      const rtg = blocks.filter(b => b.machineType === 'RTG');
      const rtgCap = rtg.reduce((sum, b) => sum + (b.capacity || 0), 0);
      const rtgUsed = rtg.reduce((sum, b) => {
         const teus = containers.filter(c => c.block === b.name && !(c.isMultiBay && c.partType === 'end')).reduce((s, c) => s + calculateTEU(c), 0);
         return sum + teus;
      }, 0);
      return { rtgAvailable: rtgCap - rtgUsed, rtgCap, rtgUsed, rtgBlocks: rtg.map(b => b.name).join(', ') };
  }, [blocks, containers]);

  return (
    <div className="bg-white rounded-xl shadow-lg min-h-[600px] flex flex-col">
      <div className="flex border-b border-slate-200 overflow-x-auto">
         {['filters', 'schedule', 'discharge', 'load'].map(tabId => (
             <button key={tabId} onClick={() => setActiveTab(tabId as any)} className={`px-6 py-3 font-semibold text-sm whitespace-nowrap capitalize ${activeTab === tabId ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
               {tabId === 'filters' ? 'Statistics & Filters' : tabId === 'schedule' ? `Import Schedule (${scheduleData.length})` : `${tabId} Analysis`}
             </button>
         ))}
      </div>

      <div className="p-6">
          {activeTab === 'filters' && (
            <>
              <div className="flex flex-wrap gap-6 mb-6 p-4 bg-slate-50 border rounded-lg items-center">
                 <span className="font-bold text-slate-700 mr-2 uppercase text-xs">Filters:</span>
                 <div className="flex flex-col sm:flex-row gap-8">
                    <div className="flex items-center space-x-4 px-3 py-2 bg-green-50 border border-green-200 rounded">
                        <label className="flex items-center space-x-2 cursor-pointer select-none">
                            <input type="checkbox" checked={isExportChecked} onChange={e => setIsExportChecked(e.target.checked)} className="h-5 w-5 rounded border-gray-400 text-green-700 focus:ring-green-600" />
                            <span className="font-bold text-green-800 text-lg">Export</span>
                        </label>
                        <div className={`flex items-center space-x-3 pl-2 border-l border-green-200 ${!isExportChecked ? 'opacity-50 pointer-events-none' : ''}`}>
                            <label className="flex items-center space-x-2 cursor-pointer select-none"><input type="checkbox" checked={filterExportFull} onChange={e => setFilterExportFull(e.target.checked)} /><span className="text-sm font-medium text-slate-700">Full</span></label>
                            <label className="flex items-center space-x-2 cursor-pointer select-none"><input type="checkbox" checked={filterExportEmpty} onChange={e => setFilterExportEmpty(e.target.checked)} /><span className="text-sm font-medium text-slate-700">Empty</span></label>
                        </div>
                    </div>
                    <div className="flex items-center space-x-4 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded">
                        <label className="flex items-center space-x-2 cursor-pointer select-none">
                            <input type="checkbox" checked={isImportChecked} onChange={e => setIsImportChecked(e.target.checked)} className="h-5 w-5 rounded border-gray-400 text-yellow-600 focus:ring-yellow-600" />
                            <span className="font-bold text-yellow-800 text-lg">Import</span>
                        </label>
                        <div className={`flex items-center space-x-3 pl-2 border-l border-yellow-200 ${!isImportChecked ? 'opacity-50 pointer-events-none' : ''}`}>
                            <label className="flex items-center space-x-2 cursor-pointer select-none"><input type="checkbox" checked={filterImportFull} onChange={e => setFilterImportFull(e.target.checked)} /><span className="text-sm font-medium text-slate-700">Full</span></label>
                            <label className="flex items-center space-x-2 cursor-pointer select-none"><input type="checkbox" checked={filterImportEmpty} onChange={e => setFilterImportEmpty(e.target.checked)} /><span className="text-sm font-medium text-slate-700">Empty</span></label>
                        </div>
                    </div>
                 </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-1">
                  <h3 className="font-bold text-slate-800 mb-2 uppercase text-xs">Select Vessels</h3>
                  <div className="flex space-x-1 mb-2">
                      {['ALL', 'SCHEDULE', 'OTHER'].map(ft => (
                          <button key={ft} onClick={() => setVesselFilterType(ft as any)} className={`flex-1 py-1 text-[10px] font-black rounded uppercase ${vesselFilterType === ft ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>{ft}</button>
                      ))}
                  </div>
                  <div className="flex items-center justify-between px-2 py-2 mb-2 bg-slate-100 rounded border border-slate-200">
                      <label className="flex items-center space-x-2 cursor-pointer"><input type="checkbox" checked={isAllVisibleSelected} onChange={handleSelectAllToggle} className="h-4 w-4 rounded" /><span className="text-sm font-bold text-slate-800">Select All</span></label>
                  </div>
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2 bg-slate-50 p-3 rounded-md border">
                    {filteredVesselList.map(v => (
                      <label key={v} className={`flex items-center space-x-2 cursor-pointer p-1 rounded ${scheduleData.some(s => s.vesselName === v) ? 'bg-blue-50' : ''}`}>
                        <input type="checkbox" checked={selectedVessels.includes(v)} onChange={() => handleVesselSelection(v)} className="h-4 w-4" />
                        <span className="text-xs text-slate-700 break-all">{v}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="md:col-span-3">
                  <div className="flex justify-between items-center mb-2"><h3 className="font-bold text-slate-800 uppercase text-xs">Container Count per Block</h3><button onClick={handleExportImage} className="p-1.5 bg-white border rounded text-xs">Export Image</button></div>
                  <div className="overflow-x-auto max-h-[70vh] bg-white border rounded-lg" ref={containerCountRef}>
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-slate-100 sticky top-0 z-20">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase sticky left-0 bg-slate-100 cursor-pointer" onClick={() => setIsBlockFilterOpen(!isBlockFilterOpen)}>Block</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-black uppercase sticky left-[70px] bg-slate-50">COUNT</th>
                          {tableData.displayedVessels.map(v => <th key={v} className="px-4 py-3 text-center text-xs font-bold text-slate-600 uppercase">{v}</th>)}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-200">
                        {visibleBlocks.map(block => {
                             const row = tableData.rows[block.name];
                             return (
                              <tr key={block.name}>
                                <td className="px-4 py-3 font-bold text-slate-800 sticky left-0 bg-white shadow-sm">{block.name}</td>
                                <td className="px-4 py-2 text-center sticky left-[70px] bg-yellow-50 border-r"><div className="font-bold">{row.c20}/{row.c40}</div><div className="text-[10px]">{row.teus} T</div></td>
                                {tableData.displayedVessels.map(v => <td key={v} className="px-4 py-3 text-center font-bold">{row.vesselCounts[v] || '-'}</td>)}
                              </tr>
                             );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'schedule' && (
              <div className="max-w-4xl mx-auto space-y-6">
                 <div className="bg-blue-50 p-6 rounded-lg border border-blue-100">
                     <h3 className="font-bold text-lg text-blue-900 mb-4 uppercase italic tracking-tighter">Import Schedule Data</h3>
                     <p className="text-xs text-blue-800 mb-4 font-semibold opacity-70">Upload multiple PDF/Image files. New upload will replace old schedule data.</p>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div>
                             <label className="block text-[11px] font-black text-blue-900 mb-2 uppercase">1. Upload Files (PDF/Image)</label>
                             <div className="border-2 border-dashed border-blue-300 rounded-lg p-6 flex flex-col items-center justify-center bg-white h-48 cursor-pointer hover:bg-blue-50" onClick={triggerFileUpload}>
                                 {isParsing ? <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div> : <span className="text-xs font-black text-blue-500 uppercase tracking-widest">Select Files</span>}
                                 <input type="file" ref={fileInputRef} className="hidden" accept=".pdf, image/*" multiple onChange={handleFileSelect} />
                             </div>
                         </div>
                         <div>
                             <label className="block text-[11px] font-black text-blue-900 mb-2 uppercase">2. Extracted / Pasted Text</label>
                             <textarea className="w-full h-48 p-3 border border-blue-300 rounded-lg text-xs font-mono" value={pastedText} onChange={(e) => setPastedText(e.target.value)} placeholder="Paste or upload to populate..."></textarea>
                         </div>
                     </div>
                     <div className="mt-4 flex justify-end"><button onClick={handleScheduleParse} disabled={isParsing || !pastedText} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-black text-xs uppercase italic tracking-widest shadow-xl">Process & Auto-Select</button></div>
                 </div>
                 <div className="bg-white border rounded-lg overflow-hidden">
                     <div className="bg-slate-100 px-6 py-3 border-b font-black text-xs text-slate-700 uppercase tracking-widest italic">Parsed Schedule</div>
                     <table className="min-w-full divide-y divide-slate-200">
                         <thead><tr className="bg-slate-50"><th className="px-6 py-3 text-left text-[10px] font-black text-slate-500 uppercase">Vessel</th><th className="px-6 py-3 text-right text-[10px] font-black text-slate-500 uppercase">Discharge</th><th className="px-6 py-3 text-right text-[10px] font-black text-slate-500 uppercase">Load</th></tr></thead>
                         <tbody>{scheduleData.map((row, idx) => (<tr key={idx}><td className="px-6 py-4 text-sm font-bold">{row.vesselName}</td><td className="px-6 py-4 text-sm text-right text-green-600 font-bold">{row.discharge}</td><td className="px-6 py-4 text-sm text-right text-yellow-600 font-bold">{row.load}</td></tr>))}</tbody>
                     </table>
                 </div>
              </div>
          )}

          {activeTab === 'discharge' && (
              <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100 col-span-2">
                          <h4 className="font-bold text-indigo-900 mb-4 text-lg uppercase italic tracking-tighter">RTG Yard Capacity Status</h4>
                          <div className="grid grid-cols-3 gap-4 mb-6">
                              <div className="bg-white p-4 rounded shadow-sm text-center"><div className="text-[10px] text-indigo-400 uppercase font-bold">Total Capacity</div><div className="text-xl font-black">{dischargeAnalysis.rtgCap.toLocaleString()}</div></div>
                              <div className="bg-white p-4 rounded shadow-sm text-center"><div className="text-[10px] text-indigo-400 uppercase font-bold">Current Used</div><div className="text-xl font-black">{dischargeAnalysis.rtgUsed.toLocaleString()}</div></div>
                              <div className="bg-white p-4 rounded shadow-sm text-center"><div className="text-[10px] text-green-500 uppercase font-bold">Available</div><div className="text-xl font-black text-green-600">{dischargeAnalysis.rtgAvailable.toLocaleString()}</div></div>
                          </div>
                      </div>
                  </div>
              </div>
          )}

          {activeTab === 'load' && (
              <div className="space-y-6">
                 {scheduleData.map((row, idx) => {
                     const threshold = Math.round(row.load / 4);
                     const relevantBlocks = blocks.filter(b => (tableData.rows[b.name]?.vesselCounts[row.vesselName] || 0) > 0);
                     return (
                         <div key={idx} className="bg-white border rounded-lg overflow-hidden shadow-sm">
                             <div className="bg-orange-50 px-6 py-4 border-b flex justify-between items-center">
                                 <div><h4 className="text-lg font-black text-orange-900 uppercase italic tracking-tighter">{row.vesselName}</h4><div className="text-xs text-orange-700 mt-1 font-bold">Estimated Load: {row.load} • Warning Threshold: {threshold}</div></div>
                             </div>
                             <div className="px-6 py-4">
                                 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                     {relevantBlocks.map(block => {
                                         const count = tableData.rows[block.name]?.vesselCounts[row.vesselName] || 0;
                                         return (
                                             <div key={block.name} className={`p-4 rounded border ${count > threshold ? 'bg-red-50 border-red-300' : 'bg-slate-50'}`}>
                                                 <div className="flex justify-between items-center mb-1"><span className="font-black text-xs">{block.name}</span>{count > threshold && <span className="text-[9px] font-black text-red-600">OVER</span>}</div>
                                                 <div className="text-2xl font-black text-slate-800">{count}</div>
                                             </div>
                                         );
                                     })}
                                 </div>
                             </div>
                         </div>
                     );
                 })}
              </div>
          )}
      </div>
    </div>
  );
};

export default VesselStatistics;
