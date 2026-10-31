export type PartType = 'PART_1' | 'PART_2' | 'PART_3';

export type LayoutMode = 'AUTO' | '1_ROW_4_COL' | '2_ROW_2_COL' | '4_ROW_1_COL';

export type QRAppFormat = 'STANDARD_2025' | 'QM2025' | 'TNMAKER' | 'AZOTA';

export type GeminiModelTier =
  | '3.5-flash-lite'
  | '3.8-flash'
  | '3.1-pro'
  | '4-argon';

export type BloomLevel =
  | 'NHAN_BIET'
  | 'THONG_HIEU'
  | 'VAN_DUNG'
  | 'VAN_DUNG_CAO';

export interface ExamImageAttachment {
  id: string;
  dataUrl: string; // Base64 data URL (image/png, image/jpeg, image/svg+xml, etc.)
  fileName?: string;
  caption?: string;
  tagId?: string;        // Thẻ định danh chuẩn: [HINH_ANH_CAU_X]
  widthTwips?: number;   // Chiều rộng chuẩn OpenXML Twips (giữ nguyên aspect ratio)
  heightTwips?: number;  // Chiều cao chuẩn OpenXML Twips (giữ nguyên aspect ratio)
  aspectRatio?: number;  // Tỷ lệ khung hình gốc (width / height)
  dpi?: number;          // Độ phân giải chuẩn hóa (mặc định >= 300 DPI cho đồ thị/sơ đồ)
}

export interface ExamTableCell {
  text: string;
  align?: 'left' | 'center' | 'right';
  isHeader?: boolean;
  isBold?: boolean;
  colSpan?: number;      // w:gridSpan (ô gộp ngang)
  rowSpan?: number;      // w:vMerge (ô gộp dọc)
  vMergeContinue?: boolean;
}

export interface ExamStemTable {
  id: string;
  caption?: string;
  isMatchingColumns?: boolean; // Bảng ghép đôi (Cột A - Cột B)
  rows: ExamTableCell[][];
}

export interface OptionPart1 {
  id: string;
  originalLabel: 'A' | 'B' | 'C' | 'D';
  currentLabel: 'A' | 'B' | 'C' | 'D';
  text: string;
  richHtml?: string;
  images?: ExamImageAttachment[];
  isUnderline: boolean;
  isRed: boolean;
  isCorrect: boolean;
}

export interface SubItemPart2 {
  id: string;
  originalLabel: 'a' | 'b' | 'c' | 'd';
  currentLabel: 'a' | 'b' | 'c' | 'd';
  text: string;
  richHtml?: string;
  images?: ExamImageAttachment[];
  isUnderline: boolean;
  isRed: boolean;
  isTrue: boolean; // Đúng (true) hoặc Sai (false)
}

export interface ExamQuestion {
  id: string;
  part: PartType;
  originalIndex: number; // Số câu trong đề gốc
  displayIndex: number;  // Số câu hiển thị (sau khi đánh số lại hoặc liên tục)
  stemText: string;
  stemRichHtml?: string;
  hasFormula?: boolean;
  hasImage?: boolean;
  images?: ExamImageAttachment[]; // Danh sách hình ảnh, sơ đồ, đồ thị đính kèm ([HINH_ANH_CAU_X])
  stemTables?: ExamStemTable[];   // Bảng dữ liệu hoặc bảng ghép đôi Cột A - Cột B thuộc phần dẫn câu hỏi
  rawFormulaOmmlXml?: string;     // Khối XML công thức toán gốc OMML (nếu có)
  formulaLatex?: string;          // Biểu diễn LaTeX công thức (nếu có)

  // Siêu dữ liệu Sư phạm & AI
  explanation?: string;
  bloomLevel?: BloomLevel;
  learningOutcome?: string;
  isAiCloned?: boolean;

  // Phần I: Trắc nghiệm 4 lựa chọn
  options?: OptionPart1[];
  computedLayout?: '1_ROW_4_COL' | '2_ROW_2_COL' | '4_ROW_1_COL';

  // Phần II: Trắc nghiệm Đúng / Sai
  subItems?: SubItemPart2[];

  // Phần III: Trắc nghiệm Trả lời ngắn / Điền khuyết
  shortAnswer?: string;
  shortAnswerDetectedBy?: 'KEYWORD' | 'UNDERLINE_RED' | 'MANUAL' | 'NONE';
}

export interface ValidationIssue {
  id: string;
  questionId: string;
  part: PartType;
  questionIndex: number;
  severity: 'ERROR' | 'WARNING';
  code:
    | 'P1_MISSING_CORRECT'
    | 'P1_MULTIPLE_CORRECT'
    | 'P1_INCOMPLETE_OPTIONS'
    | 'P2_INCOMPLETE_SUBITEMS'
    | 'P3_MISSING_SHORT_ANSWER'
    | 'P3_INVALID_FORMAT';
  message: string;
  suggestion: string;
}

export interface ShuffleConfig {
  numVariants: number; // 4, 8, 12, 24...
  examCodeDigits: 3 | 4; // 3 số (101) hoặc 4 số (1001)
  customCodes?: string[];
  layoutOverride: LayoutMode;
  resetNumberingPerPart: boolean; // Mặc định BẬT: Đánh số lại từ Câu 1 ở mỗi phần
  shuffleQuestions: boolean;
  shuffleOptionsPart1: boolean;
  shuffleSubItemsPart2: boolean;
  qrFormat: QRAppFormat;
  embedQrInWord: boolean;
  embedPhieuQM2025?: boolean; // Tự động chèn Phiếu trả lời trắc nghiệm QM 2025 (16.5cm x 8.2cm) vào đầu Trang 1 của mỗi mã đề Word
  includeSolutionsInExport: boolean; // Tùy chọn xuất kèm lời giải chi tiết trong Word

  // Thông tin tiêu đề đề thi & Quốc hiệu Tiêu ngữ
  departmentName: string; // VD: SỞ GD&ĐT VĨNH LONG
  schoolName: string;     // VD: TRƯỜNG THPT MANG THÍT
  nationalHeader: string; // VD: CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
  nationalMotto: string;  // VD: Độc lập - Tự do - Hạnh phúc
  examTitle: string;      // VD: KỲ THI TỐT NGHIỆP THPT NĂM 2025
  examSubtitle: string;   // VD: ĐỀ THI CHÍNH THỨC
  subjectName: string;    // VD: TOÁN HỌC
  gradeLevel?: string;    // VD: Lớp 12
  schoolYear: string;     // VD: Năm 2026 - 2027
  durationMinutes: number; // VD: 90
}

export interface SingleQrItem {
  appId: 'QM2025' | 'TNMAKER' | 'AZOTA';
  appName: string;
  qrPayload: string;
  qrDataUrl: string;
}

export interface TripleGradingQrSet {
  qm2025: SingleQrItem;
  tnmaker: SingleQrItem;
  azota: SingleQrItem;
}

export interface ShuffledVariant {
  examCode: string;
  createdAt: string;
  questions: ExamQuestion[];
  qrPayload: string;
  qrDataUrl: string;
  tripleQr?: TripleGradingQrSet;
  answerKey: {
    part1: { questionNumber: number; answer: 'A' | 'B' | 'C' | 'D' }[];
    part2: { questionNumber: number; answers: ('Đ' | 'S')[]; tfString: string; dsString: string }[];
    part3: { questionNumber: number; answer: string }[];
  };
}

export interface FeatureReleaseItem {
  id: string;
  version: string;
  releaseDate: string;
  title: string;
  category: 'CORE_PARSER' | 'LIVE_EDITOR' | 'AUTO_LAYOUT' | 'QR_ENGINE' | 'WORD_EXPORT' | 'AI_ENGINE';
  description: string;
  technicalSpec: string;
  autoDetected: boolean;
}
