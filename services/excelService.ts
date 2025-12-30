
import { Container, ParseResult, ParseStats, ContainerFlow } from '../types';

declare const XLSX: any;

const findColumnValue = (row: any, possibleKeys: string[]): any => {
    const rowKeys = Object.keys(row);
    for (const key of rowKeys) {
        const lowerKey = key.toLowerCase().trim();
        if (possibleKeys.includes(lowerKey)) return row[key];
    }
    for (const key of rowKeys) {
        const lowerKey = key.toLowerCase().trim();
        if (possibleKeys.some(pk => pk.length > 1 && lowerKey.includes(pk))) return row[key];
    }
    return undefined;
};

export const parseExcelFile = (file: File): Promise<ParseResult> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet);

        const stats: ParseStats = { totalRows: json.length, createdContainers: 0, skippedRows: 0 };
        const vesselSet = new Set<string>();
        
        const containers: Container[] = json.flatMap((row): Container[] => {
          // 1. Nhận diện ID Container
          const idVal = findColumnValue(row, ['số cont', 'container', 'container number', 'cont', 'id', 'no', 'số']);
          if (!idVal) { 
              stats.skippedRows++; 
              return []; 
          }
          
          const id = idVal.toString().trim();
          
          // Kiểm tra dòng tổng kết hoặc dòng trống
          if (id === '' || id.toLowerCase() === 'total' || id.toLowerCase() === 'tổng cộng' || id.toLowerCase().startsWith('tổng')) {
              stats.skippedRows++;
              return [];
          }

          // 2. Lấy thông tin cơ bản
          const owner = findColumnValue(row, ['hãng khai thác', 'chủ hàng', 'owner', 'operator']) || 'Unknown';
          const vessel = findColumnValue(row, ['tên tàu', 'vessel']);
          if (vessel) vesselSet.add(vessel.toString().trim());

          const transshipmentPort = findColumnValue(row, ['cảng đích', 'pod', 'port', 'đích', 'transshipment'])?.toString().trim();

          // 3. Xử lý trọng lượng
          const weightVal = findColumnValue(row, ['trọng lượng', 'weight', 'gross weight', 'tấn', 'gw']);
          let weight = 0;
          if (weightVal !== undefined && weightVal !== null) {
              let weightStr = String(weightVal).trim();
              weightStr = weightStr.replace(/,/g, '.');
              const cleanWeightStr = weightStr.replace(/[^0-9.]/g, '');
              weight = parseFloat(cleanWeightStr) || 0;
              if (weight > 100) weight = weight / 1000;
          }

          const isoVal = findColumnValue(row, ['loại iso', 'iso code', 'iso', 'type', 'mã']);
          const iso = isoVal ? String(isoVal).trim().toUpperCase() : undefined;
          
          let size: 20 | 40 = 20;
          const sizeVal = findColumnValue(row, ['size', 'sz', 'length']);
          if (sizeVal) {
             const num = parseInt(String(sizeVal).replace(/\D/g, ''));
             if (num === 40 || num === 45) size = 40;
          } else if (iso && (iso.startsWith('4') || iso.startsWith('L'))) {
             size = 40;
          }

          // 4. F/E Mapping
          const feRaw = findColumnValue(row, ['f/e', 'fe', 'trạng thái cont', 'full/empty']);
          const feVal = (feRaw || '').toString().trim().toUpperCase();
          let status: 'FULL' | 'EMPTY' = 'FULL';
          if (feVal === 'E' || feVal.includes('EMPTY') || feVal.includes('RỖNG')) {
              status = 'EMPTY';
          }

          // 5. Hướng (Flow) Mapping
          const flowRaw = (findColumnValue(row, ['hướng', 'flow', 'category', 'cat', 'type', 'direction']) || '').toString().trim().toUpperCase();
          let flow: ContainerFlow | undefined;
          
          if (flowRaw.includes('EXPORT') || flowRaw.includes('XUẤT')) {
              flow = 'EXPORT';
          } else if (flowRaw.includes('IMPORT STORAGE') || flowRaw.includes('CHUYỂN CẢNG')) {
              flow = 'IMPORT STORAGE';
          } else if (flowRaw.includes('IMPORT') || flowRaw.includes('NHẬP')) {
              flow = 'IMPORT';
          } else if (flowRaw.includes('STORAGE EMPTY') || flowRaw.includes('EMPTY') || flowRaw.includes('RỖNG')) {
              flow = 'STORAGE EMPTY';
          }

          const dwellVal = findColumnValue(row, ['số ngày lưu bãi', 'dwell days', 'dwell', 'ngày lưu']);
          const dwellDays = dwellVal ? parseInt(String(dwellVal).replace(/\D/g, '')) : 0;

          const commodity = findColumnValue(row, ['hàng hóa', 'commodity', 'tên hàng', 'loại hàng'])?.toString().trim();
          const billOfLading = findColumnValue(row, ['số vận đơn', 'bill of lading', 'bl no', 'bl', 'số bill'])?.toString().trim();
          const inDate = findColumnValue(row, ['ngày nhập bãi', 'in date', 'ngày vào', 'ngày nhập'])?.toString().trim();
          const holdReason = findColumnValue(row, ['lý do giữ', 'hold reason', 'lý do'])?.toString().trim();
          const containerType = findColumnValue(row, ['loại cont', 'container type', 'type'])?.toString().trim();

          const locationRaw = findColumnValue(row, ['vị trí trên bãi', 'vị trí', 'location']);
          let block = 'UNK', bay = 0, rowNum = 0, tier = 0, isUnmapped = true;

          if (typeof locationRaw === 'string' && locationRaw.trim() !== '') {
             const loc = locationRaw.trim().toUpperCase().replace(/\s/g, '');
             const parts = loc.split('-');
             
             if (parts.length === 4) {
                 block = parts[0];
                 bay = parseInt(parts[1]) || 0;
                 rowNum = parseInt(parts[2]) || 0;
                 tier = parseInt(parts[3]) || 0;
                 isUnmapped = false;
             } else {
                 block = parts[0];
                 isUnmapped = false;
                 bay = parts[1] ? parseInt(parts[1]) : 0;
                 rowNum = 0;
                 tier = 0;
             }
          }

          const commonData = { 
              id, location: locationRaw?.toString().trim() || 'Unmapped', block, row: rowNum, tier, 
              owner, vessel: vessel?.toString().trim(), status, flow, 
              transshipmentPort, weight, size, iso,
              dwellDays, commodity, billOfLading, inDate, holdReason, type: containerType,
              detailedFlow: flowRaw
          };

          stats.createdContainers++;

          if (!isUnmapped && block !== 'UNK') {
              if (bay > 0 && bay % 2 === 0) {
                return [
                  { ...commonData, bay: bay - 1, size: 40, isMultiBay: true, partType: 'start' },
                  { ...commonData, bay: bay + 1, size: 40, isMultiBay: true, partType: 'end' }
                ];
              } else {
                return [{ ...commonData, bay, size: size as (20|40), isMultiBay: false }];
              }
          } else {
              return [{ ...commonData, bay: 0, isMultiBay: false }];
          }
        });
        
        resolve({ containers, stats, vessels: Array.from(vesselSet).sort() });
      } catch (error) { reject(error); }
    };
    reader.readAsBinaryString(file);
  });
};
