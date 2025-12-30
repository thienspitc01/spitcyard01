
import { GoogleGenAI, Type } from "@google/genai";
import { YardSuggestion, ContainerRequest, PlanningSettings, ScheduleData } from "../types";

export const getYardSuggestion = async (
  request: ContainerRequest, 
  context: {
    matchingClusters: string[], // Danh sách vị trí các cont giống nhóm đã có trên bãi
    vesselSchedule?: ScheduleData,
    isInsideWindow: boolean,
    reservedLocations: string[],
    occupiedLocations: string[]
  },
  settings: PlanningSettings
): Promise<YardSuggestion> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const weightGroupLabel = request.weight <= 18 ? "Nhóm Nhẹ (<=18T)" : "Nhóm Nặng (>18T)";
  const bayRule = request.size === '20' 
    ? "20': CHỈ chọn BAY LẺ (01, 03, 05...)" 
    : "40': CHỈ chọn BAY CHẴN (02, 06, 10...)";

  const vesselBerth = context.vesselSchedule?.berth || "Không xác định";
  const berthBlocks = settings.berthMapping.find(m => m.berthName === vesselBerth)?.assignedBlocks || [];

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Bạn là Yard Planner chuyên nghiệp của hệ thống TOS. Hãy quyết định vị trí hạ bãi dựa trên THỨ TỰ ƯU TIÊN nghiêm ngặt:

THÔNG TIN CONTAINER:
- Tàu: ${request.vesselName} | POD: ${request.transshipmentPort} | Size: ${request.size}" | ${weightGroupLabel}

THỨ TỰ PHÂN TÍCH ƯU TIÊN (HÀNH ĐỘNG THEO THỨ TỰ):
1. CLUSTERING (Gom cụm): Nếu bãi đã có container cùng nhóm, hãy chọn vị trí tiếp theo trong cụm đó.
   Các vị trí tương đồng hiện có: ${context.matchingClusters.join(', ') || 'Chưa có'}.
   Quy tắc: Ưu tiên cùng Row (lên tầng 5), nếu Row đầy tìm Row trống trong cùng Bay, nếu Bay hết chỗ tìm Bay lân cận cùng Block.

2. BERTH STRATEGY (Theo cầu tàu): Nếu không có cụm, kiểm tra cầu tàu của tàu này là ${vesselBerth}.
   Các Block ưu tiên cho cầu bến này: ${berthBlocks.join(', ') || 'Không có cài đặt'}.

3. WINDOW RULES (Theo lịch tàu):
   Nếu tàu TRONG lịch: Ưu tiên các Block Window: ${settings.inWindowBlocks.join(', ')}.
   Nếu tàu NGOÀI lịch: Ưu tiên các Block: ${settings.outWindowBlocks.join(', ')}.

4. IMPORT FALLBACK (Bãi hàng nhập): Nếu tất cả trên đều đầy, gợi ý vào bãi hàng nhập: ${settings.importFallbackBlocks.join(', ')}.

RÀNG BUỘC KỸ THUẬT (BẮT BUỘC):
- Định dạng: Block-Bay-Row-Tier (VD: A1-01-02-3).
- Quy tắc Bay: ${bayRule}.
- Giới hạn RTG: Row tối đa 06, Tier tối đa 5.
- CẤM TRÙNG: Vị trí đã có (${context.occupiedLocations.slice(0, 50).join(', ')}) hoặc vừa cấp (${context.reservedLocations.join(', ')}).

NẾU KHÔNG CÒN CHỖ TRỐNG PHÙ HỢP: Đặt "notFound": true.

Trả về JSON: {"suggestedBlock": "string", "bay": "string", "row": "string", "tier": "string", "priorityLevel": "CLUSTER|BERTH|WINDOW|IMPORT_FALLBACK|NONE", "reasoning": "Giải thích vắn tắt lý do chọn", "notFound": boolean}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestedBlock: { type: Type.STRING },
            bay: { type: Type.STRING },
            row: { type: Type.STRING },
            tier: { type: Type.STRING },
            priorityLevel: { type: Type.STRING },
            reasoning: { type: Type.STRING },
            notFound: { type: Type.BOOLEAN }
          },
          required: ["reasoning", "notFound", "priorityLevel"]
        }
      }
    });

    const result = JSON.parse(response.text || '{}') as YardSuggestion;
    return {
      ...result,
      bay: result.bay?.padStart(2, '0'),
      row: result.row?.padStart(2, '0')
    };
  } catch (error) {
    console.error("Gemini Error:", error);
    return { reasoning: "Lỗi AI phân tích", notFound: true, priorityLevel: 'NONE', suggestedBlock: '', bay: '', row: '', tier: '' };
  }
};
