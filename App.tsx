
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Container, ParseStats, BlockConfig, BlockStats, RTG_BLOCK_NAMES, AppMode, ContainerRequest, ScheduleData, PlanningSettings, ContainerFlow, User } from './types';
import { parseExcelFile } from './services/excelService';
import FileUpload from './components/FileUpload';
import YardRowView from './components/YardRowView';
import HeapBlockView from './components/HeapBlockView';
import BlockConfigurator from './components/BlockConfigurator';
import VesselStatistics from './components/VesselStatistics';
import YardStatistics from './components/YardStatistics';
import DwellTimeStatistics from './components/DwellTimeStatistics';
import Layout from './components/Layout';
import GateForm from './components/GateForm';
import YardDashboard from './components/YardDashboard';
import LoginForm from './components/LoginForm';
import NotificationOverlay from './components/NotificationOverlay';
import { startAlarm, stopAlarm } from './services/audioService';
import { initSupabase, syncTable, fetchTableData, subscribeToChanges, CloudConfig } from './services/supabaseService';

const STORAGE_KEYS = {
  CONTAINERS: 'yard_containers_v1',
  BLOCK_CONFIGS: 'yardBlockConfigs_v5',
  REQUESTS: 'port_requests_v1',
  SCHEDULE: 'yard_schedule_data_v1',
  CLOUD_CONFIG: 'yard_cloud_config_v1',
  USER_SESSION: 'port_user_session_v1'
};

const getMachineType = (name: string): 'RTG' | 'RS' => {
    return RTG_BLOCK_NAMES.includes(name.toUpperCase()) ? 'RTG' : 'RS';
};

export const calculateTEU = (container: Container): number => {
    if (container.iso && container.iso.length > 0) {
      const code = container.iso.trim().toUpperCase();
      const prefix = code.charAt(0);
      if (prefix === '1' || prefix === '2') return 1;
      if (prefix === '4' || prefix === 'L') return 2;
    }
    if (container.size >= 40) return 2;
    return 1;
};

const DEFAULT_BLOCKS: BlockConfig[] = [
    // 1. Nhóm A1 - D1
    { name: 'A1', capacity: 676, group: 'GP', isDefault: true, totalBays: 30, rowsPerBay: 6, tiersPerBay: 5, blockType: 'GRID' },
    { name: 'B1', capacity: 676, group: 'GP', isDefault: true, totalBays: 30, rowsPerBay: 6, tiersPerBay: 5, blockType: 'GRID' },
    { name: 'C1', capacity: 676, group: 'GP', isDefault: true, totalBays: 30, rowsPerBay: 6, tiersPerBay: 5, blockType: 'GRID' },
    { name: 'D1', capacity: 676, group: 'GP', isDefault: true, totalBays: 30, rowsPerBay: 6, tiersPerBay: 5, blockType: 'GRID' },
    
    // 2. Nhóm A2 - D2
    { name: 'A2', capacity: 884, group: 'GP', isDefault: true, totalBays: 35, rowsPerBay: 6, tiersPerBay: 5, blockType: 'GRID' },
    { name: 'B2', capacity: 884, group: 'GP', isDefault: true, totalBays: 35, rowsPerBay: 6, tiersPerBay: 5, blockType: 'GRID' },
    { name: 'C2', capacity: 884, group: 'GP', isDefault: true, totalBays: 35, rowsPerBay: 6, tiersPerBay: 5, blockType: 'GRID' },
    { name: 'D2', capacity: 884, group: 'GP', isDefault: true, totalBays: 35, rowsPerBay: 6, tiersPerBay: 5, blockType: 'GRID' },

    // 3. Nhóm E1 - H1
    { name: 'E1', capacity: 676, group: 'GP', isDefault: true, totalBays: 30, rowsPerBay: 6, tiersPerBay: 5, blockType: 'GRID' },
    { name: 'F1', capacity: 676, group: 'GP', isDefault: true, totalBays: 30, rowsPerBay: 6, tiersPerBay: 5, blockType: 'GRID' },
    { name: 'G1', capacity: 676, group: 'GP', isDefault: true, totalBays: 30, rowsPerBay: 6, tiersPerBay: 5, blockType: 'GRID' },
    { name: 'H1', capacity: 676, group: 'GP', isDefault: true, totalBays: 30, rowsPerBay: 6, tiersPerBay: 5, blockType: 'GRID' },

    // 4. Nhóm E2 - H2
    { name: 'E2', capacity: 884, group: 'GP', isDefault: true, totalBays: 35, rowsPerBay: 6, tiersPerBay: 5, blockType: 'GRID' },
    { name: 'F2', capacity: 884, group: 'GP', isDefault: true, totalBays: 35, rowsPerBay: 6, tiersPerBay: 5, blockType: 'GRID' },
    { name: 'G2', capacity: 884, group: 'GP', isDefault: true, totalBays: 35, rowsPerBay: 6, tiersPerBay: 5, blockType: 'GRID' },
    { name: 'H2', capacity: 884, group: 'GP', isDefault: true, totalBays: 35, rowsPerBay: 6, tiersPerBay: 5, blockType: 'GRID' },

    // 5. Nhóm A0, H0, I0
    { name: 'A0', capacity: 650, group: 'GP', isDefault: true, totalBays: 25, rowsPerBay: 6, tiersPerBay: 5, blockType: 'GRID', machineType: 'RTG' },
    { name: 'H0', capacity: 650, group: 'GP', isDefault: true, totalBays: 25, rowsPerBay: 6, tiersPerBay: 5, blockType: 'GRID', machineType: 'RTG' },
    { name: 'I0', capacity: 650, group: 'GP', isDefault: true, totalBays: 25, rowsPerBay: 6, tiersPerBay: 5, blockType: 'GRID', machineType: 'RTG' },

    // 6. Nhóm N1 - N4
    { name: 'N1', totalBays: 5, rowsPerBay: 19, tiersPerBay: 5, capacity: 376, machineType: 'RS', group: 'GP', blockType: 'GRID', isDefault: true },
    { name: 'N2', totalBays: 5, rowsPerBay: 18, tiersPerBay: 5, capacity: 344, machineType: 'RS', group: 'GP', blockType: 'GRID', isDefault: true },
    { name: 'N3', totalBays: 7, rowsPerBay: 15, tiersPerBay: 5, capacity: 408, machineType: 'RS', group: 'GP', blockType: 'GRID', isDefault: true },
    { name: 'N4', totalBays: 3, rowsPerBay: 14, tiersPerBay: 5, capacity: 162, machineType: 'RS', group: 'GP', blockType: 'GRID', isDefault: true },

    // 7. Nhóm Z1, Z2
    { name: 'Z1', totalBays: 14, rowsPerBay: 6, tiersPerBay: 5, capacity: 126, machineType: 'RS', group: 'GP', blockType: 'GRID', isDefault: true },
    { name: 'Z2', totalBays: 31, rowsPerBay: 6, tiersPerBay: 5, capacity: 222, machineType: 'RS', group: 'GP', blockType: 'GRID', isDefault: true },

    // 8. Nhóm I1, I2
    { name: 'I1', capacity: 676, group: 'GP', isDefault: true, totalBays: 30, rowsPerBay: 6, tiersPerBay: 5, blockType: 'GRID', machineType: 'RTG' },
    { name: 'I2', capacity: 884, group: 'GP', isDefault: true, totalBays: 35, rowsPerBay: 6, tiersPerBay: 5, blockType: 'GRID', machineType: 'RTG' },

    // 9. Nhóm R1 - R4
    { name: 'R1', totalBays: 10, rowsPerBay: 6, tiersPerBay: 5, capacity: 300, machineType: 'RS', group: 'GP', blockType: 'GRID', isDefault: true },
    { name: 'R3', totalBays: 10, rowsPerBay: 6, tiersPerBay: 5, capacity: 300, machineType: 'RS', group: 'GP', blockType: 'GRID', isDefault: true },
    { name: 'R4', totalBays: 10, rowsPerBay: 6, tiersPerBay: 5, capacity: 300, machineType: 'RS', group: 'GP', blockType: 'GRID', isDefault: true },
    { name: 'R2', totalBays: 10, rowsPerBay: 6, tiersPerBay: 5, capacity: 300, machineType: 'RS', group: 'GP', blockType: 'GRID', isDefault: true },

    // 10. Nhóm bãi RỖNG & Khác
    { name: 'B0', totalBays: 26, rowsPerBay: 11, tiersPerBay: 5, capacity: 1352, machineType: 'RS', group: 'RỖNG', blockType: 'GRID', isDefault: true },
    { name: 'C0', totalBays: 26, rowsPerBay: 10, tiersPerBay: 5, capacity: 1222, machineType: 'RS', group: 'RỖNG', blockType: 'GRID', isDefault: true },
    { name: 'D0', totalBays: 26, rowsPerBay: 10, tiersPerBay: 5, capacity: 1222, machineType: 'RS', group: 'RỖNG', blockType: 'GRID', isDefault: true },
    { name: 'E0', totalBays: 26, rowsPerBay: 9, tiersPerBay: 5, capacity: 1092, machineType: 'RS', group: 'RỖNG', blockType: 'GRID', isDefault: true },
    { name: 'F0', totalBays: 2, rowsPerBay: 40, tiersPerBay: 5, capacity: 394, machineType: 'RS', group: 'RỖNG', blockType: 'GRID', isDefault: true },
    { name: 'L0', totalBays: 22, rowsPerBay: 10, tiersPerBay: 5, capacity: 1034, machineType: 'RS', group: 'RỖNG', blockType: 'GRID', isDefault: true },
    { name: 'M0', totalBays: 24, rowsPerBay: 10, tiersPerBay: 5, capacity: 1128, machineType: 'RS', group: 'RỖNG', blockType: 'GRID', isDefault: true },
    { name: 'M1', totalBays: 26, rowsPerBay: 10, tiersPerBay: 5, capacity: 1222, machineType: 'RS', group: 'RỖNG', blockType: 'GRID', isDefault: true },
    { name: 'L1', totalBays: 26, rowsPerBay: 10, tiersPerBay: 5, capacity: 1222, machineType: 'RS', group: 'RỖNG', blockType: 'GRID', isDefault: true },
    { name: 'K1', totalBays: 16, rowsPerBay: 6, tiersPerBay: 5, capacity: 432, machineType: 'RS', group: 'RỖNG', blockType: 'GRID', isDefault: true },
    { name: 'N6', totalBays: 4, rowsPerBay: 8, tiersPerBay: 5, capacity: 148, machineType: 'RS', group: 'RỖNG', blockType: 'GRID', isDefault: true },
    { name: 'N7', totalBays: 3, rowsPerBay: 30, tiersPerBay: 5, capacity: 441, machineType: 'RS', group: 'RỖNG', blockType: 'GRID', isDefault: true },
    { name: 'N8', totalBays: 2, rowsPerBay: 20, tiersPerBay: 5, capacity: 40, machineType: 'RS', group: 'RỖNG', blockType: 'GRID', isDefault: true },
    { name: 'N9', totalBays: 2, rowsPerBay: 30, tiersPerBay: 5, capacity: 60, machineType: 'RS', group: 'RỖNG', blockType: 'GRID', isDefault: true },
    { name: 'N10', totalBays: 2, rowsPerBay: 20, tiersPerBay: 5, capacity: 40, machineType: 'RS', group: 'RỖNG', blockType: 'GRID', isDefault: true },
    { name: 'N11', totalBays: 10, rowsPerBay: 8, tiersPerBay: 5, capacity: 80, machineType: 'RS', group: 'RỖNG', blockType: 'GRID', isDefault: true },
    { name: 'T0', totalBays: 40, rowsPerBay: 5, tiersPerBay: 5, capacity: 80, machineType: 'RS', group: 'RỖNG', blockType: 'GRID', isDefault: true },
    { name: 'T2', totalBays: 14, rowsPerBay: 6, tiersPerBay: 5, capacity: 42, machineType: 'RS', group: 'RỖNG', blockType: 'GRID', isDefault: true },
    { name: 'Z0', totalBays: 18, rowsPerBay: 7, tiersPerBay: 5, capacity: 72, machineType: 'RS', group: 'RỖNG', blockType: 'GRID', isDefault: true },
    
    // Bãi Zone/Heap
    { name: 'APR01', capacity: 500, group: 'OTHER', isDefault: true, totalBays: 0, rowsPerBay: 0, tiersPerBay: 0, blockType: 'HEAP', machineType: 'RS' },
    { name: 'APR02', capacity: 500, group: 'OTHER', isDefault: true, totalBays: 0, rowsPerBay: 0, tiersPerBay: 0, blockType: 'HEAP', machineType: 'RS' },
    { name: 'CFS 1', capacity: 500, group: 'OTHER', isDefault: true, totalBays: 0, rowsPerBay: 0, tiersPerBay: 0, blockType: 'HEAP', machineType: 'RS' },
    { name: 'CFS 2', capacity: 500, group: 'OTHER', isDefault: true, totalBays: 0, rowsPerBay: 0, tiersPerBay: 0, blockType: 'HEAP', machineType: 'RS' },
    { name: 'CFS 3', capacity: 500, group: 'OTHER', isDefault: true, totalBays: 0, rowsPerBay: 0, tiersPerBay: 0, blockType: 'HEAP', machineType: 'RS' },
    { name: 'CFS 4', capacity: 500, group: 'OTHER', isDefault: true, totalBays: 0, rowsPerBay: 0, tiersPerBay: 0, blockType: 'HEAP', machineType: 'RS' },
    { name: 'CFS 5', capacity: 500, group: 'OTHER', isDefault: true, totalBays: 0, rowsPerBay: 0, tiersPerBay: 0, blockType: 'HEAP', machineType: 'RS' },
    { name: 'MNR', capacity: 500, group: 'OTHER', isDefault: true, totalBays: 0, rowsPerBay: 0, tiersPerBay: 0, blockType: 'HEAP', machineType: 'RS' },
    { name: 'MNR1', capacity: 500, group: 'OTHER', isDefault: true, totalBays: 0, rowsPerBay: 0, tiersPerBay: 0, blockType: 'HEAP', machineType: 'RS' },
    { name: 'WAS', capacity: 500, group: 'OTHER', isDefault: true, totalBays: 0, rowsPerBay: 0, tiersPerBay: 0, blockType: 'HEAP', machineType: 'RS' },
].map((b: any): BlockConfig => {
    if (b.blockType === 'HEAP') return b as BlockConfig;
    return { ...b, machineType: b.machineType || getMachineType(b.name), blockType: 'GRID' } as BlockConfig;
});

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.USER_SESSION);
    return saved ? JSON.parse(saved) : null;
  });

  const [mode, setMode] = useState<AppMode>('VIEWER');
  const [cloudConfig, setCloudConfig] = useState<CloudConfig | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CLOUD_CONFIG);
    return saved ? JSON.parse(saved) : null;
  });
  const [isCloudConnected, setIsCloudConnected] = useState(false);

  const [requests, setRequests] = useState<ContainerRequest[]>([]);
  const [containers, setContainers] = useState<Container[]>([]);
  const [schedule, setSchedule] = useState<ScheduleData[]>([]);
  const [blockConfigs, setBlockConfigs] = useState<BlockConfig[]>(DEFAULT_BLOCKS);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [stats, setStats] = useState<ParseStats | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [view, setView] = useState<'map' | 'stats' | 'vessel_stats' | 'dwell_stats'>('map');
  const [isoTypeFilter, setIsoTypeFilter] = useState<'ALL' | 'DRY' | 'REEFER'>('ALL');
  const [flowFilter, setFlowFilter] = useState<'ALL' | ContainerFlow>('ALL');
  const [vessels, setVessels] = useState<string[]>([]);
  const [selectedVessels, setSelectedVessels] = useState<string[]>(['', '', '']);

  // Role Protection Effect
  useEffect(() => {
    if (user?.role === 'GATE') {
      setMode('GATE');
    } else if (user?.role === 'PLANNER' && mode === 'GATE') {
      setMode('VIEWER');
    }
  }, [user, mode]);

  // Cloud Sync Effect
  useEffect(() => {
    if (cloudConfig) {
      const client = initSupabase(cloudConfig);
      if (client) {
        setIsCloudConnected(true);
        localStorage.setItem(STORAGE_KEYS.CLOUD_CONFIG, JSON.stringify(cloudConfig));
        
        const loadCloudData = async () => {
          const cloudRequests = await fetchTableData('yard_requests');
          if (cloudRequests.length > 0) {
            setRequests(cloudRequests);
          }
          
          const inventoryData = await fetchTableData('yard_containers');
          if (inventoryData.length > 0) {
            const snapshot = inventoryData[0];
            if (snapshot.containers) setContainers(snapshot.containers);
            if (snapshot.vessels) setVessels(snapshot.vessels);
            if (snapshot.stats) setStats(snapshot.stats);
          }

          const scheduleCloudData = await fetchTableData('yard_schedule');
          if (scheduleCloudData.length > 0) {
            const snapshot = scheduleCloudData[0];
            if (snapshot.schedule) setSchedule(snapshot.schedule);
          }
        };

        loadCloudData();

        subscribeToChanges('yard_containers', (newData) => {
          if (newData && newData.containers) {
            setContainers(newData.containers);
            if (newData.vessels) setVessels(newData.vessels);
            if (newData.stats) setStats(newData.stats);
          }
        });

        subscribeToChanges('yard_schedule', (newData) => {
          if (newData && newData.schedule) {
            setSchedule(newData.schedule);
          }
        });

        subscribeToChanges('yard_requests', (itemData: any) => {
           if (itemData && itemData.id) {
             setRequests(prev => {
                const existing = prev.find(r => r.id === itemData.id);
                
                const isYardUser = user?.role === 'PLANNER' || (user?.role === 'ADMIN' && (mode === 'YARD' || mode === 'VIEWER'));
                const isGateUser = user?.role === 'GATE' || (user?.role === 'ADMIN' && mode === 'GATE');

                // --- ĐỒNG BỘ HÓA TẮT BÁO ĐỘNG ---
                if (isYardUser) {
                    // Nếu bất kỳ user nào đánh dấu đã nhận (acknowledgedByYard), tắt chuông cho các user Yard còn lại
                    if (itemData.acknowledgedByYard) {
                        stopAlarm();
                        window.dispatchEvent(new CustomEvent('port-notification-close', { detail: { id: itemData.id } }));
                    } else if (!existing && itemData.status === 'pending') {
                        triggerStrongNotification(itemData.id, 'YÊU CẦU MỚI', `Tàu ${itemData.vesselName} đang chờ cấp vị trí hạ bãi.`);
                    }
                } 
                
                if (isGateUser) {
                    // Nếu bất kỳ user nào đánh dấu đã nhận (acknowledgedByGate), tắt chuông cho các user Gate còn lại
                    if (itemData.acknowledgedByGate) {
                        stopAlarm();
                        window.dispatchEvent(new CustomEvent('port-notification-close', { detail: { id: itemData.id } }));
                    } else if (existing && existing.status === 'pending' && itemData.status === 'assigned') {
                        triggerStrongNotification(itemData.id, 'ĐÃ CÓ VỊ TRÍ', `Vị trí bãi: ${itemData.assignedLocation} cho tàu ${itemData.vesselName}`);
                    }
                }

                if (existing) {
                  return prev.map(r => r.id === itemData.id ? itemData : r);
                } else {
                  return [...prev, itemData];
                }
             });
           }
        });
      }
    }
  }, [cloudConfig, user, mode]);

  // Listener cho việc bấm xác nhận từ Overlay (Tác động lên Cloud)
  useEffect(() => {
    const handleAcknowledgeCloud = async (e: any) => {
        const { id, type } = e.detail;
        const req = requests.find(r => r.id === id);
        if (req && isCloudConnected) {
            const updated = { ...req };
            if (type === 'YARD') updated.acknowledgedByYard = true;
            if (type === 'GATE') updated.acknowledgedByGate = true;
            await syncTable('yard_requests', id, updated);
        }
    };
    window.addEventListener('port-request-acknowledge-cloud', handleAcknowledgeCloud);
    return () => window.removeEventListener('port-request-acknowledge-cloud', handleAcknowledgeCloud);
  }, [requests, isCloudConnected]);

  const triggerStrongNotification = (requestId: string, title: string, body: string) => {
    startAlarm();
    window.dispatchEvent(new CustomEvent('port-notification', { detail: { id: requestId, title, body } }));
  };

  const handleLogin = (newUser: User) => {
    setUser(newUser);
    localStorage.setItem(STORAGE_KEYS.USER_SESSION, JSON.stringify(newUser));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEYS.USER_SESSION);
  };

  const handleFileUpload = async (file: File) => {
    setIsLoading(true);
    try {
      const { containers: parsedData, stats: parseStats, vessels: parsedVessels } = await parseExcelFile(file);
      setContainers(parsedData);
      setStats(parseStats);
      setVessels(parsedVessels);

      if (isCloudConnected) {
        await syncTable('yard_containers', 'inventory_snapshot', {
           containers: parsedData, vessels: parsedVessels, stats: parseStats, timestamp: Date.now()
        });
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleScheduleChange = async (newSchedule: ScheduleData[]) => {
      setSchedule(newSchedule);
      if (isCloudConnected) {
          await syncTable('yard_schedule', 'schedule_snapshot', { schedule: newSchedule, timestamp: Date.now() });
      }
  };

  const containersByBlock = useMemo(() => {
    return containers.reduce((acc, container) => {
        let blockName = container.block;
        if (!acc[blockName]) acc[blockName] = [];
        acc[blockName].push(container);
        return acc;
    }, {} as Record<string, Container[]>);
  }, [containers]);

  const highlightedContainerIds = useMemo(() => {
    const trimmedSearch = searchTerm.trim().toUpperCase();
    if (!trimmedSearch) return new Set<string>();
    return new Set(containers.filter(c => 
        c.id.toUpperCase().includes(trimmedSearch) || 
        c.location.toUpperCase().includes(trimmedSearch.replace(/-/g, ''))
    ).map(c => c.id));
  }, [searchTerm, containers]);

  const processedStats = useMemo(() => {
    const statsMap: Record<string, BlockStats> = {};
    blockConfigs.forEach(block => {
      statsMap[block.name] = {
        name: block.name, group: block.group || 'GP', capacity: block.capacity || 0,
        exportFullTeus: 0, importFullTeus: 0, emptyTeus: 0,
        exportFullCount: 0, importFullCount: 0, emptyCount: 0
      };
    });
    containers.forEach(c => {
      const blockStats = statsMap[c.block];
      if (!blockStats) return;
      if (c.isMultiBay && c.partType === 'end') return;
      const teus = calculateTEU(c);
      if (c.status === 'EMPTY') { blockStats.emptyCount++; blockStats.emptyTeus += teus; }
      else if (c.flow === 'EXPORT') { blockStats.exportFullCount++; blockStats.exportFullTeus += teus; }
      else { blockStats.importFullCount++; blockStats.importFullTeus += teus; }
    });
    return Object.values(statsMap);
  }, [containers, blockConfigs]);

  const onAddBlock = (newB: Omit<BlockConfig, 'isDefault'>) => setBlockConfigs([...blockConfigs, { ...newB, isDefault: false }]);
  const onUpdateBlock = (updB: BlockConfig) => setBlockConfigs(blockConfigs.map(b => b.name === updB.name ? updB : b));
  const onRemoveBlock = (name: string) => setBlockConfigs(blockConfigs.filter(b => b.name !== name));

  if (!user) return <LoginForm onLogin={handleLogin} />;

  return (
    <Layout mode={mode} setMode={setMode} isCloudConnected={isCloudConnected} onCloudConfig={(config) => setCloudConfig(config)} user={user} onLogout={handleLogout}>
      {(mode === 'GATE' && (user.role === 'GATE' || user.role === 'ADMIN')) && (
        <GateForm 
          onSubmit={(req) => {
            const newId = `REQ-${Date.now()}`;
            const newReq: ContainerRequest = { ...req, id: newId, status: 'pending', timestamp: Date.now(), acknowledgedByYard: false, acknowledgedByGate: false };
            setRequests(prev => [...prev, newReq]);
            if (isCloudConnected) syncTable('yard_requests', newId, newReq);
          }} 
          requests={requests} 
          onAcknowledge={(id) => {
            const req = requests.find(r => r.id === id);
            if (req && isCloudConnected) {
              syncTable('yard_requests', id, { ...req, acknowledgedByGate: true });
            }
            stopAlarm();
          }} 
        />
      )}
      
      {(user.role === 'PLANNER' || user.role === 'ADMIN') && (
        <>
          {mode === 'YARD' && (
            <YardDashboard 
              requests={requests} 
              onAssign={(id, loc) => {
                const req = requests.find(r => r.id === id);
                if (req && isCloudConnected) {
                  syncTable('yard_requests', id, { ...req, status: 'assigned' as const, assignedLocation: loc, acknowledgedByGate: false });
                }
              }} 
              containers={containers} schedule={schedule} blocks={blockConfigs} 
              onAcknowledge={(id) => {
                const req = requests.find(r => r.id === id);
                if (req && isCloudConnected) {
                    syncTable('yard_requests', id, { ...req, acknowledgedByYard: true });
                }
                stopAlarm();
              }} 
            />
          )}
          
          {mode === 'VIEWER' && (
            <div className="space-y-4">
                <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
                    {[
                        { id: 'map', label: 'Yard Map', icon: 'M9 20l-5.447-2.724A2 2 0 013 15.382V6.618a2 2 0 011.553-1.944L9 2l6 3 5.447-2.724A2 2 0 0121 4.618v8.764a2 2 0 01-1.553 1.944L15 18l-6 2z' },
                        { id: 'stats', label: 'Yard Stats', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
                        { id: 'vessel_stats', label: 'Vessel Stats', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
                        { id: 'dwell_stats', label: 'Dwell Time', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' }
                    ].map((tab) => (
                        <button key={tab.id} onClick={() => setView(tab.id as any)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border ${view === tab.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200'}`}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} /></svg>
                            {tab.label}
                        </button>
                    ))}
                </div>
                {view === 'map' && (
                  <div className="space-y-4">
                    <div className="flex justify-center flex-col items-center gap-2">
                        <FileUpload onFileUpload={handleFileUpload} isLoading={isLoading} />
                        {stats && (
                            <div className="flex items-center space-x-4 text-[10px] text-slate-500 font-bold uppercase">
                                <span>Total Rows: {stats.totalRows.toLocaleString()}</span>
                                <span>Created: {stats.createdContainers.toLocaleString()}</span>
                            </div>
                        )}
                    </div>
                    <div className="bg-white p-4 rounded-xl shadow border border-slate-200 space-y-4">
                      <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1 space-y-1 w-full">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Search Container / Location</label>
                          <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full px-4 py-2 border rounded-md text-sm outline-none focus:ring-1 ring-blue-500" placeholder="Enter container number or location" />
                        </div>
                        <div className="w-full md:w-48 space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Flow Filter</label>
                          <select value={flowFilter} onChange={(e) => setFlowFilter(e.target.value as any)} className="w-full px-3 py-2 border rounded-md text-sm bg-white">
                            <option value="ALL">All Flows</option>
                            <option value="IMPORT">Import</option>
                            <option value="EXPORT">Export</option>
                            <option value="IMPORT STORAGE">Import Storage</option>
                            <option value="STORAGE EMPTY">Storage Empty</option>
                          </select>
                        </div>
                      </div>
                    </div>
                    <BlockConfigurator blocks={blockConfigs} onAddBlock={onAddBlock} onUpdateBlock={onUpdateBlock} onRemoveBlock={onRemoveBlock} />
                    {containers.length > 0 ? (
                      <div className="space-y-6">
                          {blockConfigs.map(block => {
                              const blockContainers = containersByBlock[block.name] || [];
                              return block.blockType === 'HEAP' ? (
                                  <HeapBlockView key={block.name} label={block.name} containers={blockContainers} capacity={block.capacity || 100} highlightedContainerIds={highlightedContainerIds} selectedVessels={selectedVessels} filterColors={['bg-sky-500', 'bg-lime-500', 'bg-amber-500']} flowFilter={flowFilter} />
                              ) : (
                                  <YardRowView key={block.name} label={block.name} containers={blockContainers} totalBays={block.totalBays} rowsPerBay={block.rowsPerBay} tiersPerBay={block.tiersPerBay} highlightedContainerIds={highlightedContainerIds} selectedVessels={selectedVessels} filterColors={['bg-sky-500', 'bg-lime-500', 'bg-amber-500']} flowFilter={flowFilter} />
                              );
                          })}
                      </div>
                    ) : (
                      <div className="bg-white rounded-xl p-20 text-center border-2 border-dashed border-slate-200">
                          <p className="text-slate-400 font-bold uppercase tracking-widest">No Yard Data Uploaded</p>
                      </div>
                    )}
                  </div>
                )}
                {view === 'stats' && <YardStatistics data={processedStats} containers={containers} blocks={blockConfigs} isoTypeFilter={isoTypeFilter} onFilterChange={setIsoTypeFilter} />}
                {view === 'vessel_stats' && <VesselStatistics containers={containers} vessels={vessels} blocks={blockConfigs} onSelectVessels={setSelectedVessels} scheduleData={schedule} onScheduleChange={handleScheduleChange} />}
                {view === 'dwell_stats' && <DwellTimeStatistics containers={containers} />}
            </div>
          )}
        </>
      )}
      <NotificationOverlay userRole={user.role} />
    </Layout>
  );
};

export default App;
