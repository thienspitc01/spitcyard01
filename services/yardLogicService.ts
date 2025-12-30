
import { Container, ContainerRequest, ScheduleData, BlockConfig, YardSuggestion, YardRuleConfig, YardReservation, PlanningSettings } from '../types';

interface YardContext {
  containers: Container[];
  schedule: ScheduleData[];
  blocks: BlockConfig[];
  allRequests: ContainerRequest[];
}

export class YardBrain {
  private static getLogicalBay(bay: number, size: string | number): number {
    const is40 = String(size) === '40';
    if (!is40) return bay % 2 !== 0 ? bay : bay - 1; 
    if (bay % 2 === 0) return bay; 
    return bay + 1; 
  }

  public static findOptimalLocation(
    request: ContainerRequest, 
    context: YardContext,
    settings: PlanningSettings,
    existingReservations: Map<string, YardReservation>
  ): YardSuggestion {
    const trace: string[] = [];
    const { containers, schedule, blocks, allRequests } = context;
    const rules = settings.rules;
    
    const reqVessel = request.vesselName.trim().toUpperCase();
    const reqPod = request.transshipmentPort.trim().toUpperCase();
    const reqSize = String(request.size);
    const is40 = reqSize === '40';
    const reqWeight = request.weight || 0;
    const reqIsHeavy = reqWeight >= 18;
    
    trace.push(`ALGORITHM V10.0 | REQ: ${reqVessel} | POD: ${reqPod} | SIZE: ${reqSize} | WG: ${reqIsHeavy ? 'GE18' : 'LT18'}`);
    trace.push(`Strict Policy: Only same weight group stacking allowed.`);

    const yardMap = new Map<string, Container>();
    containers.forEach(c => {
      if (c.location && c.location !== 'Unmapped') {
        yardMap.set(this.getLocKey(c.block, c.bay, c.row, c.tier), c);
      }
    });

    const assignedMap = new Map<string, any>();
    allRequests.forEach(r => {
      if (r.status === 'assigned' && r.assignedLocation) {
        const [bl, ba, ro, ti] = r.assignedLocation.split('-');
        const bNum = parseInt(ba);
        const footprint = String(r.size) === '40' ? [bNum - 1, bNum + 1] : [bNum];
        footprint.forEach(f => {
          assignedMap.set(this.getLocKey(bl, f, parseInt(ro), parseInt(ti)), {
            vessel: r.vesselName, transshipmentPort: r.transshipmentPort,
            size: String(r.size) === '40' ? 40 : 20, weight: r.weight,
            block: bl, bay: f, row: parseInt(ro), tier: parseInt(ti)
          });
        });
      }
    });

    // 🔴 STEP 1: TÌM NHÓM LÕI (CORE GROUP)
    let vMatch = 0, pMatch = 0;
    const coreContainers = [
      ...containers.filter(c => c.location && c.location !== 'Unmapped' && (!c.isMultiBay || c.partType === 'start')),
      ...allRequests.filter(r => r.status === 'assigned' && r.assignedLocation).map(r => ({
        block: r.assignedLocation!.split('-')[0],
        bay: parseInt(r.assignedLocation!.split('-')[1]),
        row: parseInt(r.assignedLocation!.split('-')[2]),
        tier: parseInt(r.assignedLocation!.split('-')[3]),
        vessel: r.vesselName,
        transshipmentPort: r.transshipmentPort,
        size: String(r.size) === '40' ? 40 : 20,
        weight: r.weight || 0
      }))
    ].filter(c => {
      const cVessel = (c.vessel || '').trim().toUpperCase();
      const cPod = (c.transshipmentPort || '').trim().toUpperCase();
      const cSize = String(c.size === 40 ? '40' : '20');

      const isSameVessel = cVessel === reqVessel || (cVessel.length > 0 && (cVessel.includes(reqVessel) || reqVessel.includes(cVessel)));
      const isSamePod = cPod === reqPod || (cPod.length > 0 && (cPod.includes(reqPod) || reqPod.includes(cPod)));
      const isSameSize = cSize === reqSize;

      if (isSameVessel) vMatch++;
      if (isSameVessel && isSamePod && isSameSize) {
        pMatch++;
        return true;
      }
      return false;
    });

    trace.push(`Step 1: Core Group Size: ${coreContainers.length} same Vessel/POD/Size`);

    if (coreContainers.length > 0) {
      // 🔴 STEP 2: STACK TIẾP NỐI (SAME WG ONLY)
      trace.push(`Step 2: Stacking on existing group...`);
      const sameWgContainers = coreContainers.filter(c => ((c.weight || 0) >= 18) === reqIsHeavy);

      if (sameWgContainers.length > 0) {
        const sorted = [...sameWgContainers].sort((a, b) => b.tier - a.tier);
        for (const c of sorted) {
          const logicalBay = this.getLogicalBay(c.bay, c.size);
          const targetTier = c.tier + 1;
          const maxTier = rules.maxTierByBlock[c.block] || 5;

          if (targetTier <= maxTier) {
            if (this.isLocSafe(c.block, logicalBay, c.row, targetTier, request, yardMap, assignedMap, existingReservations, rules, trace, blocks)) {
              return {
                suggestedBlock: c.block, bay: logicalBay.toString().padStart(2, '0'),
                row: c.row.toString().padStart(2, '0'), tier: targetTier.toString(),
                reasoning: `CLUSTER: Xếp tầng ${targetTier} cùng nhóm ${reqIsHeavy ? 'GE18' : 'LT18'} tại ${c.block}-${logicalBay}`,
                priorityLevel: 'CLUSTER', reservationId: `RES-S2-${Date.now()}`, validationTrace: trace
              };
            }
          }
        }
      }

      // 🔴 STEP 3: MỞ ROW MỚI TRONG BAY ĐANG CÓ NHÓM
      trace.push(`Step 3: Expansion in existing bays...`);
      const groupBays = Array.from(new Set(coreContainers.map(c => `${c.block}|${this.getLogicalBay(c.bay, c.size)}`)));
      const ROW_ORDER = [6, 5, 4, 3, 2, 1];

      for (const entry of groupBays) {
        const [bName, bStr] = entry.split('|');
        const bayNum = parseInt(bStr);
        for (const row of ROW_ORDER) {
          if (this.isLocSafe(bName, bayNum, row, 1, request, yardMap, assignedMap, existingReservations, rules, trace, blocks)) {
            return {
              suggestedBlock: bName, bay: bayNum.toString().padStart(2, '0'),
              row: row.toString().padStart(2, '0'), tier: "1",
              reasoning: `CLUSTER: Mở Row mới trong Bay ${bayNum} (Tier 1 sạch)`,
              priorityLevel: 'CLUSTER', reservationId: `RES-S3-${Date.now()}`, validationTrace: trace
            };
          }
        }
      }
    }

    // 🔴 STEP 4: FALLBACK THEO CẦU TÀU (DYNAMIC)
    trace.push(`Step 4: Dynamic Berth fallback search...`);
    const vesselSched = schedule.find(s => {
        const vName = s.vesselName.trim().toUpperCase();
        return vName === reqVessel || vName.includes(reqVessel) || reqVessel.includes(vName);
    });
    
    const berth = vesselSched?.berth?.toUpperCase() || 'BARGING';
    // Lấy danh sách block từ settings thay vì map tĩnh
    const berthConfig = settings.berthMapping.find(m => m.berthName === berth) || settings.berthMapping.find(m => m.berthName === 'BARGING');
    const allowedBlocks = berthConfig ? berthConfig.assignedBlocks : [];
    
    trace.push(`Checking Blocks assigned to ${berth}: ${allowedBlocks.join(', ')}`);
    const ROW_ORDER = [6, 5, 4, 3, 2, 1];

    for (const bName of allowedBlocks) {
      const bConfig = blocks.find(b => b.name === bName);
      if (!bConfig || bConfig.blockType === 'HEAP') continue;

      const startBay = is40 ? 2 : 1;
      const bayStep = 2; 

      for (let b = startBay; b <= (bConfig.totalBays || 70); b += bayStep) {
        for (const row of ROW_ORDER) {
          if (this.isLocSafe(bName, b, row, 1, request, yardMap, assignedMap, existingReservations, rules, trace, blocks)) {
            return {
              suggestedBlock: bName, bay: b.toString().padStart(2, '0'),
              row: row.toString().padStart(2, '0'), tier: "1",
              reasoning: `BERTH: Hạ bãi tại Block ${bName} dành cho cầu ${berth}`,
              priorityLevel: 'BERTH', reservationId: `RES-S4-${Date.now()}`, validationTrace: trace
            };
          }
        }
      }
    }

    return { 
      status: "FAIL", reasoning: 'Không tìm thấy vị trí an toàn tuân thủ quy tắc trọng lượng và cầu tàu.', notFound: true, 
      validationTrace: trace, priorityLevel: 'NONE', suggestedBlock: '', bay: '', row: '', tier: ''
    } as any;
  }

  private static isLocSafe(block: string, bay: number, row: number, tier: number, request: ContainerRequest, yardMap: Map<string, Container>, assignedMap: Map<string, any>, resv: Map<string, any>, rules: YardRuleConfig, trace: string[], allBlocks: BlockConfig[]): boolean {
    const is40 = String(request.size) === '40';
    if (is40 && bay % 2 !== 0) return false;
    if (!is40 && bay % 2 === 0) return false;

    const baysToCheck = is40 ? [bay - 1, bay + 1] : [bay];
    for (const bNum of baysToCheck) {
      const key = this.getLocKey(block, bNum, row, tier);
      if (yardMap.has(key) || assignedMap.has(key)) return false;
      for (const r of resv.values()) if (r.location === key && r.expiry > Date.now()) return false;
    }

    if (tier > 1) {
      const reqIsHeavy = request.weight >= 18;
      for (const bNum of baysToCheck) {
        const belowKey = this.getLocKey(block, bNum, row, tier - 1);
        const cont = yardMap.get(belowKey) || assignedMap.get(belowKey);
        if (!cont) return false;
        if (is40 && cont.size !== 40) return false;
        const isBelowHeavy = (cont.weight || 0) >= 18;
        if (reqIsHeavy !== isBelowHeavy) return false;
      }
    }
    return true;
  }

  private static getLocKey(b: string, bay: number, r: number, t: number): string {
    return `${b}-${bay.toString().padStart(2, '0')}-${r.toString().padStart(2, '0')}-${t}`;
  }
}
