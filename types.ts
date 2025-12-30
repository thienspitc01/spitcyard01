
export type ContainerSize = '20' | '40';

export interface ContainerRequest {
  id: string;
  vesselName: string;
  transshipmentPort: string;
  weight: number;
  size: ContainerSize;
  status: 'pending' | 'assigned';
  assignedLocation?: string;
  timestamp: number;
  weightGroup?: 'LT18' | 'GE18';
  acknowledgedByGate?: boolean;
  acknowledgedByYard?: boolean;
  reservationId?: string;
}

export interface YardRuleConfig {
  maxTierByBlock: Record<string, number>;
  weightStackingPolicy: {
    GE18_on_LT18: boolean;
    LT18_on_GE18: boolean;
  };
  groupingPolicy: {
    enableGroupStack: boolean;
    requireSamePod: boolean;
    requireSameVessel: boolean;
    requireSameSize: boolean;
    preventStackingOnImport: boolean;
  };
}

export interface YardSuggestion {
  suggestedBlock: string;
  bay: string;
  row: string;
  tier: string;
  reasoning: string;
  priorityLevel: 'CLUSTER' | 'BERTH' | 'WINDOW' | 'IMPORT_FALLBACK' | 'NONE';
  notFound?: boolean;
  validationTrace?: string[]; // Nhật ký kiểm tra các vị trí
  reservationId?: string;
}

export interface YardReservation {
  location: string;
  expiry: number;
  requestId: string;
}

export type AppMode = 'GATE' | 'YARD' | 'VIEWER';

// Updated UserRole to include ADMIN
export type UserRole = 'PLANNER' | 'GATE' | 'ADMIN';

export interface User {
  username: string;
  role: UserRole;
}

export interface BerthConfig {
  berthName: string;
  assignedBlocks: string[];
}

export interface PlanningSettings {
  inWindowBlocks: string[];
  outWindowBlocks: string[];
  berthMapping: BerthConfig[];
  importFallbackBlocks: string[];
  rules: YardRuleConfig;
}

export interface BlockConfig {
  name: string;
  totalBays: number;
  rowsPerBay: number;
  tiersPerBay: number;
  capacity?: number;
  group?: string;
  isDefault?: boolean;
  machineType?: 'RTG' | 'RS';
  blockType?: 'GRID' | 'HEAP';
}

export type ContainerFlow = 'EXPORT' | 'IMPORT' | 'IMPORT STORAGE' | 'STORAGE EMPTY';

export interface Container {
  id: string;
  location: string;
  block: string;
  bay: number;
  row: number;
  tier: number;
  owner: string;
  size: 20 | 40;
  isMultiBay: boolean;
  partType?: 'start' | 'end';
  vessel?: string;
  status?: 'FULL' | 'EMPTY';
  flow?: ContainerFlow;
  detailedFlow?: string;
  type?: 'GP' | 'REEFER';
  iso?: string;
  dwellDays?: number;
  commodity?: string;
  billOfLading?: string;
  inDate?: string;
  holdReason?: string;
  transshipmentPort?: string;
  weight?: number;
}

export interface ParseStats {
  totalRows: number;
  createdContainers: number;
  skippedRows: number;
}

export interface ParseResult {
  containers: Container[];
  vessels: string[];
  stats: ParseStats;
}

export interface BlockStats {
  name: string;
  group: string;
  capacity: number;
  exportFullTeus: number;
  importFullTeus: number;
  emptyTeus: number;
  exportFullCount: number;
  importFullCount: number;
  emptyCount: number;
}

export interface ScheduleData {
    vesselName: string;
    voyage?: string;
    discharge: number;
    load: number;
    berth?: string;
}

export const RTG_BLOCK_NAMES = [
    'A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1', 'H1', 'I1',
    'A2', 'B2', 'C2', 'D2', 'E2', 'F2', 'G2', 'H2', 'I2',
    'A0', 'H0', 'I0'
];
