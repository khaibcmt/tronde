import React, { useState } from 'react';
import {
  Award,
  BookOpen,
  Bot,
  Check,
  CheckCircle2,
  ClipboardPaste,
  Code2,
  Copy,
  Cpu,
  Download,
  FileCheck2,
  FileCode,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  GraduationCap,
  HelpCircle,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  PlusCircle,
  QrCode,
  Save,
  ShieldCheck,
  Sparkles,
  Workflow,
  X,
  Zap,
} from 'lucide-react';
import { FeatureReleaseItem } from '../types/exam';
import { exportUserManualDocx, triggerBrowserDownload } from '../utils/docxExporter';

interface UserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  features: FeatureReleaseItem[];
  onRegisterNewFeature: (item: FeatureReleaseItem) => void;
}

type GuideTab = 'ROLES' | 'FEATURES' | 'WORKFLOW' | 'SPEC_2025' | 'AUTO_CHANGELOG';

interface SynchronizedColorTheme {
  id: string;
  name: string;
  frameBorder: string;
  frameBg: string;
  headerBg: string;
  headerText: string;
  iconBoxBg: string;
  iconColor: string;
  titleColor: string;
  bulletIconColor: string;
  specBorder: string;
  specBg: string;
  specTitleColor: string;
  specTextColor: string;
  accentBar: string;
}

/**
 * 12 Bảng màu đồng bộ độc lập (Mỗi tính năng 1 khung viền & tông màu đồng bộ riêng biệt)
 */
const SYNCHRONIZED_THEMES: SynchronizedColorTheme[] = [
  {
    id: 'blue',
    name: 'Xanh Lam Hoàng Gia (Royal Blue)',
    frameBorder: 'border-blue-500',
    frameBg: 'bg-gradient-to-br from-blue-50/90 via-white to-blue-50/40',
    headerBg: 'bg-gradient-to-r from-blue-700 via-blue-600 to-blue-700',
    headerText: 'text-white',
    iconBoxBg: 'bg-blue-600 text-white shadow-md shadow-blue-600/25',
    iconColor: 'text-white',
    titleColor: 'text-blue-950',
    bulletIconColor: 'text-blue-600',
    specBorder: 'border-blue-300',
    specBg: 'bg-blue-100/70',
    specTitleColor: 'text-blue-900',
    specTextColor: 'text-blue-950',
    accentBar: 'bg-blue-600',
  },
  {
    id: 'emerald',
    name: 'Xanh Ngọc Lục Bảo (Emerald)',
    frameBorder: 'border-emerald-500',
    frameBg: 'bg-gradient-to-br from-emerald-50/90 via-white to-emerald-50/40',
    headerBg: 'bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-700',
    headerText: 'text-white',
    iconBoxBg: 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25',
    iconColor: 'text-white',
    titleColor: 'text-emerald-950',
    bulletIconColor: 'text-emerald-600',
    specBorder: 'border-emerald-300',
    specBg: 'bg-emerald-100/70',
    specTitleColor: 'text-emerald-900',
    specTextColor: 'text-emerald-950',
    accentBar: 'bg-emerald-600',
  },
  {
    id: 'violet',
    name: 'Tím Thạch Anh (Violet)',
    frameBorder: 'border-violet-500',
    frameBg: 'bg-gradient-to-br from-violet-50/90 via-white to-violet-50/40',
    headerBg: 'bg-gradient-to-r from-violet-700 via-violet-600 to-violet-700',
    headerText: 'text-white',
    iconBoxBg: 'bg-violet-600 text-white shadow-md shadow-violet-600/25',
    iconColor: 'text-white',
    titleColor: 'text-violet-950',
    bulletIconColor: 'text-violet-600',
    specBorder: 'border-violet-300',
    specBg: 'bg-violet-100/70',
    specTitleColor: 'text-violet-900',
    specTextColor: 'text-violet-950',
    accentBar: 'bg-violet-600',
  },
  {
    id: 'amber',
    name: 'Vàng Hổ Phách (Amber Gold)',
    frameBorder: 'border-amber-500',
    frameBg: 'bg-gradient-to-br from-amber-50/90 via-white to-amber-50/40',
    headerBg: 'bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600',
    headerText: 'text-white',
    iconBoxBg: 'bg-amber-600 text-white shadow-md shadow-amber-600/25',
    iconColor: 'text-white',
    titleColor: 'text-amber-950',
    bulletIconColor: 'text-amber-600',
    specBorder: 'border-amber-300',
    specBg: 'bg-amber-100/70',
    specTitleColor: 'text-amber-900',
    specTextColor: 'text-amber-950',
    accentBar: 'bg-amber-500',
  },
  {
    id: 'rose',
    name: 'Đỏ Hồng Ngọc (Ruby Rose)',
    frameBorder: 'border-rose-500',
    frameBg: 'bg-gradient-to-br from-rose-50/90 via-white to-rose-50/40',
    headerBg: 'bg-gradient-to-r from-rose-700 via-rose-600 to-rose-700',
    headerText: 'text-white',
    iconBoxBg: 'bg-rose-600 text-white shadow-md shadow-rose-600/25',
    iconColor: 'text-white',
    titleColor: 'text-rose-950',
    bulletIconColor: 'text-rose-600',
    specBorder: 'border-rose-300',
    specBg: 'bg-rose-100/70',
    specTitleColor: 'text-rose-900',
    specTextColor: 'text-rose-950',
    accentBar: 'bg-rose-600',
  },
  {
    id: 'teal',
    name: 'Xanh Cổ Vịt (Deep Teal)',
    frameBorder: 'border-teal-500',
    frameBg: 'bg-gradient-to-br from-teal-50/90 via-white to-teal-50/40',
    headerBg: 'bg-gradient-to-r from-teal-700 via-teal-600 to-teal-700',
    headerText: 'text-white',
    iconBoxBg: 'bg-teal-600 text-white shadow-md shadow-teal-600/25',
    iconColor: 'text-white',
    titleColor: 'text-teal-950',
    bulletIconColor: 'text-teal-600',
    specBorder: 'border-teal-300',
    specBg: 'bg-teal-100/70',
    specTitleColor: 'text-teal-900',
    specTextColor: 'text-teal-950',
    accentBar: 'bg-teal-600',
  },
  {
    id: 'indigo',
    name: 'Xanh Chàm Sâu (Indigo)',
    frameBorder: 'border-indigo-500',
    frameBg: 'bg-gradient-to-br from-indigo-50/90 via-white to-indigo-50/40',
    headerBg: 'bg-gradient-to-r from-indigo-700 via-indigo-600 to-indigo-700',
    headerText: 'text-white',
    iconBoxBg: 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25',
    iconColor: 'text-white',
    titleColor: 'text-indigo-950',
    bulletIconColor: 'text-indigo-600',
    specBorder: 'border-indigo-300',
    specBg: 'bg-indigo-100/70',
    specTitleColor: 'text-indigo-900',
    specTextColor: 'text-indigo-950',
    accentBar: 'bg-indigo-600',
  },
  {
    id: 'fuchsia',
    name: 'Hồng Tím AI (Fuchsia)',
    frameBorder: 'border-fuchsia-500',
    frameBg: 'bg-gradient-to-br from-fuchsia-50/90 via-white to-fuchsia-50/40',
    headerBg: 'bg-gradient-to-r from-fuchsia-700 via-fuchsia-600 to-fuchsia-700',
    headerText: 'text-white',
    iconBoxBg: 'bg-fuchsia-600 text-white shadow-md shadow-fuchsia-600/25',
    iconColor: 'text-white',
    titleColor: 'text-fuchsia-950',
    bulletIconColor: 'text-fuchsia-600',
    specBorder: 'border-fuchsia-300',
    specBg: 'bg-fuchsia-100/70',
    specTitleColor: 'text-fuchsia-900',
    specTextColor: 'text-fuchsia-950',
    accentBar: 'bg-fuchsia-600',
  },
  {
    id: 'sky',
    name: 'Xanh Da Trời (Sky Blue)',
    frameBorder: 'border-sky-500',
    frameBg: 'bg-gradient-to-br from-sky-50/90 via-white to-sky-50/40',
    headerBg: 'bg-gradient-to-r from-sky-700 via-sky-600 to-sky-700',
    headerText: 'text-white',
    iconBoxBg: 'bg-sky-600 text-white shadow-md shadow-sky-600/25',
    iconColor: 'text-white',
    titleColor: 'text-sky-950',
    bulletIconColor: 'text-sky-600',
    specBorder: 'border-sky-300',
    specBg: 'bg-sky-100/70',
    specTitleColor: 'text-sky-900',
    specTextColor: 'text-sky-950',
    accentBar: 'bg-sky-600',
  },
  {
    id: 'orange',
    name: 'Cam Năng Lượng (Vibrant Orange)',
    frameBorder: 'border-orange-500',
    frameBg: 'bg-gradient-to-br from-orange-50/90 via-white to-orange-50/40',
    headerBg: 'bg-gradient-to-r from-orange-600 via-orange-500 to-orange-600',
    headerText: 'text-white',
    iconBoxBg: 'bg-orange-600 text-white shadow-md shadow-orange-600/25',
    iconColor: 'text-white',
    titleColor: 'text-orange-950',
    bulletIconColor: 'text-orange-600',
    specBorder: 'border-orange-300',
    specBg: 'bg-orange-100/70',
    specTitleColor: 'text-orange-900',
    specTextColor: 'text-orange-950',
    accentBar: 'bg-orange-500',
  },
  {
    id: 'lime',
    name: 'Xanh Lá Mạ Sư Phạm (Lime Green)',
    frameBorder: 'border-lime-600',
    frameBg: 'bg-gradient-to-br from-lime-50/90 via-white to-lime-50/40',
    headerBg: 'bg-gradient-to-r from-lime-700 via-lime-600 to-lime-700',
    headerText: 'text-white',
    iconBoxBg: 'bg-lime-600 text-white shadow-md shadow-lime-600/25',
    iconColor: 'text-white',
    titleColor: 'text-lime-950',
    bulletIconColor: 'text-lime-600',
    specBorder: 'border-lime-300',
    specBg: 'bg-lime-100/70',
    specTitleColor: 'text-lime-900',
    specTextColor: 'text-lime-950',
    accentBar: 'bg-lime-600',
  },
  {
    id: 'cyan',
    name: 'Xanh Băng Khảo Thí (Cyan Ice)',
    frameBorder: 'border-cyan-500',
    frameBg: 'bg-gradient-to-br from-cyan-50/90 via-white to-cyan-50/40',
    headerBg: 'bg-gradient-to-r from-cyan-700 via-cyan-600 to-cyan-700',
    headerText: 'text-white',
    iconBoxBg: 'bg-cyan-600 text-white shadow-md shadow-cyan-600/25',
    iconColor: 'text-white',
    titleColor: 'text-cyan-950',
    bulletIconColor: 'text-cyan-600',
    specBorder: 'border-cyan-300',
    specBg: 'bg-cyan-100/70',
    specTitleColor: 'text-cyan-900',
    specTextColor: 'text-cyan-950',
    accentBar: 'bg-cyan-600',
  },
];

interface ComprehensiveFeatureItem {
  code: string;
  group: 'QR_EXCEL' | 'CORE_STEM' | 'EDITOR_AI' | 'EXPORT_7991';
  groupLabel: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  theme: SynchronizedColorTheme;
  bullets: Array<{ bold: string; text: string }>;
  techSpecTitle: string;
  techSpecDetail: string;
}

const ALL_12_SYSTEM_FEATURES: ComprehensiveFeatureItem[] = [
  {
    code: 'TÍNH NĂNG 01 · KHUNG XANH LAM',
    group: 'QR_EXCEL',
    groupLabel: 'Chấm Thi QR & Excel',
    title: 'Bộ 3 Mã QR Chấm Thi Chuẩn Gốc 100% (1. QM 2025 · 2. TNMaker · 3. Azota)',
    subtitle: 'Quét nhận diện 100% không lỗi trên cả 3 phần mềm chấm thi điện thoại phổ biến nhất',
    icon: <QrCode className="w-6 h-6" />,
    theme: SYNCHRONIZED_THEMES[0], // Blue
    bullets: [
      {
        bold: 'Tạo đồng thời 3 mã QR độc lập',
        text: 'Mỗi phần mềm (1. QM 2025, 2. TNMaker, 3. Azota) có một mã QR riêng được biên dịch đúng cấu trúc JSON và chuỗi ký tự gốc của nhà phát triển ứng dụng đó.',
      },
      {
        bold: 'Hỗ trợ cả QR Tổng Hợp & QR Từng Mã Đề',
        text: 'Chế độ QR Tổng Hợp tích hợp toàn bộ mã đề (101, 102, 103, 104...) vào 1 mã duy nhất giúp giáo viên quét 1 lần nạp đủ cả bộ đề; đồng thời hỗ trợ xem/tải lẻ QR của từng mã đề.',
      },
      {
        bold: 'Tự động nhúng vào Word & Tải PNG 520px',
        text: 'Tự động nhúng cả 3 khung mã QR song song vào trang cuối file Word Bảng Đáp Án với độ tương phản Đen/Trắng 100% và viền Quiet Zone rộng 4 ô chuẩn Camera AI.',
      },
    ],
    techSpecTitle: 'THÔNG SỐ KỸ THUẬT QR 3 NỀN TẢNG',
    techSpecDetail:
      'QM 2025 (JSON v:2025 + Pipe String) · TNMaker (JSON app:TNMaker_2025 P1/P2/P3) · Azota (JSON platform:AZOTA_2025 TF/SA) · ECC Level M/L.',
  },
  {
    code: 'TÍNH NĂNG 02 · KHUNG XANH NGỌC LỤC BẢO',
    group: 'QR_EXCEL',
    groupLabel: 'Chấm Thi QR & Excel',
    title: 'Ô Tùy Chọn Phiếu Trả Lời Trắc Nghiệm Nổi Bật & Xuất 3 File Excel (.xlsx) Chuẩn',
    subtitle: 'Tự chọn 5 mẫu phiếu chuẩn QM 2025 hoặc tải lên phiếu riêng (.pdf, .jpg, .png) nhúng thẳng vào mọi đề trộn',
    icon: <FileSpreadsheet className="w-6 h-6" />,
    theme: SYNCHRONIZED_THEMES[1], // Emerald
    bullets: [
      {
        bold: 'Khung chọn Phiếu Trả Lời Trắc Nghiệm nổi bật (5 mẫu mặc định + Tải phiếu riêng)',
        text: 'Tích hợp sẵn 5 mẫu phiếu chuẩn: QM 2025 (40-8-6), QM (40-16-12), QM (30-20-00), QM A4-40-Ngang (40-0-0) và QM Ôn tập TL Ngắn (0-0-10). Giáo viên có thể chọn tự động, chọn mẫu bất kỳ hoặc tự tải phiếu riêng (.pdf, .jpg, .png) để hệ thống tự động nhúng vào tất cả các mã đề trộn.',
      },
      {
        bold: '3 tệp Excel (.xlsx) chuyên biệt từng phần mềm',
        text: 'Hệ thống tự động xuất 3 file Excel riêng cho QM 2025, TNMaker và Azota (đủ Phần I ABCD, Phần II Đ/S a-b-c-d, Phần III trả lời ngắn tối đa 4 ký tự) để import trực tiếp.',
      },
      {
        bold: 'Xem trước trực quan & Đóng gói tự động',
        text: 'Hỗ trợ xem trước sắc nét mẫu phiếu ngay trên giao diện và tự động đóng gói kèm 3 file Excel đáp án trong tệp .zip.',
      },
    ],
    techSpecTitle: 'PHIẾU TRẢ LỜI TÙY CHỌN & OPENXML SPREADSHEET (.XLSX)',
    techSpecDetail:
      '5 Mẫu phiếu QM 2025 mặc định + Tải phiếu tùy chọn (.PDF/.JPG/.PNG) nhúng vào mọi đề trộn · 3 File Excel .xlsx chuẩn QM 2025, TNMaker, Azota.',
  },
  {
    code: 'TÍNH NĂNG 03 · KHUNG TÍM THẠCH ANH',
    group: 'CORE_STEM',
    groupLabel: 'Bóc Tách & Công Thức',
    title: 'Bộ Tự Động Chữa Lỗi Đề Gốc (Auto-Healing Pipeline) & Bóc Tách Đa Tầng 4 Phần',
    subtitle: 'Tự động bắt lỗi và phục hồi định dạng Word (.docx), bảng biểu vỡ khung, giữ nguyên Phần IV Tự Luận',
    icon: <Cpu className="w-6 h-6" />,
    theme: SYNCHRONIZED_THEMES[2], // Violet
    bullets: [
      {
        bold: 'Auto-Healing Bảng biểu vỡ khung & Đè chữ',
        text: 'Tự động gỡ bỏ thuộc tính bảng bao quanh chữ (w:tblpPr / Around) đưa về khối độc lập (In-line/Block) chống đè chữ; tự động tái cân bằng các bảng chia cột phương án A, B, C, D bị méo về tỷ lệ chuẩn 25% × 4 cột hoặc 50% × 2 cột.',
      },
      {
        bold: 'Đa kênh nhận diện đáp án chuẩn (Không bịa đáp án)',
        text: 'Tự động phát hiện phương án đúng qua Gạch chân (<w:u>), Tô chữ màu đỏ/xanh nổi bật (<w:color>), Tô nền Highlight hoặc Bảng đáp án cuối đề. Bảo toàn 100% đáp án của giáo viên, cảnh báo nếu Phần II có 4 Đúng/4 Sai.',
      },
      {
        bold: 'Hỗ trợ Phần IV Tự Luận (Giữ nguyên câu hỏi — Không trộn)',
        text: 'Tiếp nhận và giữ nguyên thứ tự các câu hỏi Tự luận ở mọi mã đề. Nếu đề không có Phần III trả lời ngắn, tự động đánh mục thành PHẦN III. Tự luận và tích hợp lời giải/câu hỏi vào Bảng đáp án.',
      },
    ],
    techSpecTitle: 'AUTO-HEALING PIPELINE & AST PARSER 4 PHẦN',
    techSpecDetail:
      'Gỡ bảng nổi w:tblpPr · Tái cân bằng cột 25%/50% · Quét đồng thời Phần I, II, III và Phần IV (Tự luận) · Không tự ý bịa đáp án.',
  },
  {
    code: 'TÍNH NĂNG 04 · KHUNG VÀNG HỔ PHÁCH',
    group: 'CORE_STEM',
    groupLabel: 'Bóc Tách & Công Thức',
    title: 'Hàn Gắn & Chuẩn Hóa Công Thức Toán - Lý - Hóa - Sinh, Vectơ, Số Mũ & Ký Hiệu Đặc Biệt',
    subtitle: 'Hàn gắn công thức đứt đoạn, tự nâng/hạ chỉ số Hóa học, chuẩn hóa phân số Sinh học & MathType OLE',
    icon: <FlaskConical className="w-6 h-6" />,
    theme: SYNCHRONIZED_THEMES[3], // Amber
    bullets: [
      {
        bold: 'Hàn gắn công thức Toán & Vật lý (OMML + MathType OLE)',
        text: 'Tự động nối các thẻ <m:oMath> hoặc <w:r> bị cắt đôi (Equation Stitcher); dịch chuẩn OMML và MathType OLE (fallback ảnh vector/bitmap nếu object lỗi). Bảo toàn tuyệt đối dấu vectơ (v⃗, a⃗, F⃗, AB⃗), số mũ, căn thức và ký hiệu đặc biệt (Ω, μ, λ, π, Δ, α, β, ω, ⊥, ∥, °C).',
      },
      {
        bold: 'Tự động nâng/hạ chỉ số Hóa học & Phương trình phản ứng',
        text: 'Tự phát hiện công thức Hóa học gõ bằng chữ thường (H2SO4, Ca(OH)2, Fe3O4, Cu2+, SO42-) để chuyển thành chỉ số dưới/trên chuẩn (H₂SO₄, Ca(OH)₂, Cu²⁺, SO₄²⁻); giữ nguyên trạng thái (dd), (k), (r), (l), mũi tên nhiệt độ/xúc tác (→, ⇌), kết tủa (↓), bay hơi (↑).',
      },
      {
        bold: 'Chuẩn hóa ký hiệu Di truyền Sinh học',
        text: 'Tự động đóng gói kiểu gen phân số gõ gạch chân hoặc gạch chéo (AB/ab) về phân số chuẩn \\frac{AB}{ab}; bảo toàn kiểu gen NST giới tính (XᴬXᵃ, XᴬY), dấu nhân phép lai (×) và ký hiệu giới tính đực (♂) / cái (♀).',
      },
    ],
    techSpecTitle: 'EQUATION STITCHER & DUAL RENDERER (KATEX + MATHJAX 3)',
    techSpecDetail:
      'OMML XSLT + MathType OLE Stream/WMF Fallback · Auto Sub/Superscript Hóa học · Phân số kiểu gen Sinh học · CSS chống vỡ dòng công thức.',
  },
  {
    code: 'TÍNH NĂNG 05 · KHUNG ĐỎ HỒNG NGỌC',
    group: 'CORE_STEM',
    groupLabel: 'Bóc Tách & Công Thức',
    title: 'Động Cơ Nhận Diện & Bóc Tách Hình Ảnh Đa Tầng Từ Đề Gốc (Không Lỗi, Không Rơi Ảnh)',
    subtitle: 'Thu hồi ảnh trôi nổi, đọc ảnh dòng riêng/dưới đáp án/bảng 2 cột và giải mã WMF/EMF 300 DPI',
    icon: <ImageIcon className="w-6 h-6" />,
    theme: SYNCHRONIZED_THEMES[4], // Rose
    bullets: [
      {
        bold: 'Nhận diện 100% ảnh từ đề gốc (.docx, .pdf & dán Ctrl+V)',
        text: 'Tự động bóc tách ảnh nằm trên đoạn văn độc lập (không bị xóa nhầm ở đầu đề), ảnh nằm dưới 4 đáp án A/B/C/D, ảnh kèm chú thích ("Hình 1", "Hình bên", "Sơ đồ", "Đồ thị"), ảnh trong bảng chia 2 cột không viền và ảnh trong <mc:AlternateContent> / Drawing Canvas.',
      },
      {
        bold: 'Thu hồi chủ quyền không gian (Spatial Ownership) & Gom mảnh sơ đồ',
        text: 'Thuật toán tự động khóa ảnh trôi nổi (wp:anchor / Floating) vào đúng câu hỏi sở hữu, tuyệt đối không để ảnh rơi sang câu kế tiếp; tự động gom các shape rời rạc thành 1 ảnh PNG phẳng và gắn nhãn [HINH_ANH_CAU_X].',
      },
      {
        bold: 'Giải mã WMF/EMF & Chống biến dạng tỉ lệ (Aspect Ratio Preserver)',
        text: 'Đọc mọi định dạng (.png, .jpg, .jpeg, .jfif, .gif, .bmp, .webp, .svg, .tif) và giải mã trực tiếp ảnh .wmf/.emf (MathType, ChemDraw, Sketchpad). Tự động khử nền xám, khóa tỉ lệ gốc chống méo hình và giới hạn max-width 100%.',
      },
    ],
    techSpecTitle: 'SPATIAL OWNERSHIP HEURISTIC & WMF/EMF DECODER 300 DPI',
    techSpecDetail:
      'Hỗ trợ wp:inline, wp:anchor, v:imagedata, mc:Fallback, WMF/EMF DIB & Vector · Deep Clone [HINH_ANH_CAU_X] sang mọi mã đề 101–104.',
  },
  {
    code: 'TÍNH NĂNG 06 · KHUNG XANH CỔ VỊT',
    group: 'EDITOR_AI',
    groupLabel: 'Biên Tập & AI Gemini',
    title: 'Lưu Chỉnh Sửa Từng Câu Độc Lập, Nút Lưu Toàn Bộ & Tự Động Sửa Lỗi 1 Chạm',
    subtitle: 'Lưu câu hỏi tức thì khi chuyển câu không lo mất chỉnh sửa, kiểm định lỗi thời gian thực',
    icon: <FileCheck2 className="w-6 h-6" />,
    theme: SYNCHRONIZED_THEMES[5], // Teal
    bullets: [
      {
        bold: 'Nút "Lưu câu này" ở từng câu & "Lưu Toàn Bộ Chỉnh Sửa"',
        text: 'Khi chỉnh sửa nội dung, công thức, đáp án hay hình ảnh ở bất kỳ câu nào, giáo viên có thể bấm [Lưu câu này] ngay tại thẻ câu hỏi hoặc bấm [Lưu Toàn Bộ Chỉnh Sửa] trên thanh công cụ để chuyển sang câu khác/tab khác mà không bị mất hay trôi dữ liệu.',
      },
      {
        bold: 'Quét lỗi tự động & Cuộn thẳng tới câu lỗi',
        text: 'Phát hiện tức thời câu thiếu đáp án, câu Phần II có cả 4 ý Đúng hoặc 4 ý Sai, câu Phần III vượt quá 4 ký tự. Bấm [Sửa ngay] sẽ cuộn màn hình đến đúng câu đó để chỉnh sửa trong 1 giây.',
      },
      {
        bold: 'Nút "Tự Động Sửa Nhanh Tất Cả Lỗi"',
        text: 'Tự động chuẩn hóa bố cục 4 phương án A/B/C/D, công thức và các cảnh báo định dạng toàn đề chỉ bằng 1 chạm duy nhất.',
      },
    ],
    techSpecTitle: 'PER-QUESTION STATE LOCK & REALTIME VALIDATOR',
    techSpecDetail:
      'Lưu trạng thái từng câu (kèm dấu thời gian) + Nút Lưu Toàn Bộ Chỉnh Sửa đồng bộ 2 chiều giữa Thẻ câu hỏi 3D và Trang giấy Word A4.',
  },
  {
    code: 'TÍNH NĂNG 07 · KHUNG XANH CHÀM SÂU',
    group: 'EDITOR_AI',
    groupLabel: 'Biên Tập & AI Gemini',
    title: 'Khung Chỉnh Sửa Văn Bản Word Gốc & Dán Nhanh Trực Tiếp (Clipboard HTML Kèm Ảnh)',
    subtitle: 'Sửa trực tiếp toàn bộ văn bản đề thi hoặc dán nhanh Ctrl+V từ Microsoft Word giữ nguyên cả ảnh & công thức',
    icon: <ClipboardPaste className="w-6 h-6" />,
    theme: SYNCHRONIZED_THEMES[6], // Indigo
    bullets: [
      {
        bold: 'Dán trực tiếp từ Word (Ctrl+V) giữ nguyên Ảnh, Công thức & Đáp án',
        text: 'Bôi đen đề thi trong Microsoft Word rồi dán thẳng vào hệ thống: định dạng gạch chân, chữ đỏ, chỉ số trên/dưới (sub/sup) và cả hình ảnh cắt dán từ Word đều được nhận diện đầy đủ.',
      },
      {
        bold: 'Chỉnh sửa văn bản nguồn toàn đề',
        text: 'Cung cấp cửa sổ chỉnh sửa văn bản Word gốc ngay trên ứng dụng để giáo viên sửa nhanh hàng loạt câu hỏi, thêm câu mới hoặc dán bổ sung bảng đáp án.',
      },
      {
        bold: 'Biên dịch lại tức thì & Bảo toàn hình ảnh đã gắn',
        text: 'Ngay khi bấm cập nhật, hệ thống tự động phân tích lại toàn bộ câu hỏi và tự động khôi phục các hình ảnh đã gắn của từng câu hỏi.',
      },
    ],
    techSpecTitle: 'BỘ PHÂN TÍCH CLIPBOARD RICH-TEXT & IMAGE RECOVERY',
    techSpecDetail:
      'Đọc đồng thời kênh text/html (gồm thẻ <img>, <u>, <sub>, <sup>, màu chữ) và text/plain · Tự động khôi phục ảnh theo câu.',
  },
  {
    code: 'TÍNH NĂNG 08 · KHUNG HỒNG TÍM AI',
    group: 'EDITOR_AI',
    groupLabel: 'Biên Tập & AI Gemini',
    title: 'AI Gemini Studio — Cụm 4 Luồng Chuyên Gia Tạo Đề Tương Đương Song Song',
    subtitle: 'Nhân bản cùng lúc từ 1 đến 4 đề thi mới hoàn toàn theo đúng ma trận đề gốc',
    icon: <Bot className="w-6 h-6" />,
    theme: SYNCHRONIZED_THEMES[7], // Fuchsia
    bullets: [
      {
        bold: '4 luồng AI chạy song song tốc độ cao',
        text: 'Tạo đồng thời 4 mã đề tương đương (Đề AI 201, 202, 203, 204) với câu chữ và số liệu mới hoàn toàn nhưng giữ nguyên 100% dạng toán, mức độ nhận thức và cấu trúc đề gốc.',
      },
      {
        bold: 'Tùy biến theo yêu cầu chuyên môn của giáo viên',
        text: 'Hỗ trợ ô nhập yêu cầu riêng (ví dụ: đổi số liệu chẵn dễ tính nhẩm, đảo mệnh đề Đúng thành Sai, giữ nguyên hình vẽ gốc) và tự động tính toán lại đáp số chính xác.',
      },
      {
        bold: 'Môi trường cô lập bảo mật Zero-Trace',
        text: 'Tự động ẩn danh thông tin trường/kỳ thi trước khi xử lý và tự động xóa sạch bộ nhớ tạm ngay sau khi giáo viên tải bộ đề về máy.',
      },
    ],
    techSpecTitle: 'CỤM ĐA TÁC TỬ AI (4-CHANNEL PARALLEL GEMINI)',
    techSpecDetail:
      'Hỗ trợ nạp thẳng đề AI vừa tạo vào Trình trộn đề chỉ với 1 chạm hoặc tải gói .zip 4 đề AI tương đương độc lập.',
  },
  {
    code: 'TÍNH NĂNG 09 · KHUNG XANH DA TRỜI',
    group: 'EXPORT_7991',
    groupLabel: 'Ma Trận 7991 & Xuất Bản',
    title: 'Khung Ma Trận & Bản Đặc Tả Chuẩn Công Văn 7991/BGDĐT-GDTrH',
    subtitle: 'Tự động lập Phụ lục 1 (Khung ma trận) và Phụ lục 2 (Bản đặc tả GDPT 2018)',
    icon: <LayoutGrid className="w-6 h-6" />,
    theme: SYNCHRONIZED_THEMES[8], // Sky
    bullets: [
      {
        bold: 'Tỷ lệ nhận thức chuẩn 40% - 30% - 30%',
        text: 'Tự động phân bổ câu hỏi và tính điểm theo đúng tỷ lệ vàng của Bộ GD&ĐT: Nhận biết 40% (4,0 điểm) — Thông hiểu 30% (3,0 điểm) — Vận dụng 30% (3,0 điểm).',
      },
      {
        bold: 'Đầy đủ Phụ lục 1 & Phụ lục 2',
        text: 'Hiển thị trực quan bảng Khung ma trận 9 cột mức độ và Bản đặc tả Yêu cầu cần đạt chi tiết theo chương trình GDPT 2018 ngay trên màn hình.',
      },
      {
        bold: 'Xuất file Word (.docx) trình ký Ban Giám Hiệu',
        text: 'Tải riêng file Word Ma trận & Bản đặc tả có sẵn Quốc hiệu Tiêu ngữ và khung chữ ký 3 bên: Hiệu trưởng duyệt — Tổ trưởng chuyên môn — Giáo viên ra đề.',
      },
    ],
    techSpecTitle: 'CHUẨN CÔNG VĂN 7991/BGDĐT-GDTrH (20/12/2024)',
    techSpecDetail:
      'Phần I: 0,25đ/câu · Phần II: 1,0đ/câu (4 lệnh a, b, c, d) · Phần III: 0,25đ–0,5đ/câu · Tổng cộng chuẩn 10,0 điểm.',
  },
  {
    code: 'TÍNH NĂNG 10 · KHUNG CAM NĂNG LƯỢNG',
    group: 'EXPORT_7991',
    groupLabel: 'Ma Trận 7991 & Xuất Bản',
    title: 'Bảng Ma Trận Đáp Án Đối Chiếu Đa Mã Đề Gọn Trên 1 Trang A4',
    subtitle: 'Tiết kiệm 70% diện tích giấy in, chống rối mắt tuyệt đối khi dò đáp án nhiều mã đề',
    icon: <Layers className="w-6 h-6" />,
    theme: SYNCHRONIZED_THEMES[9], // Orange
    bullets: [
      {
        bold: 'Xếp cột song song thông minh',
        text: 'Thay vì tách từng bảng rời rạc tốn nhiều trang giấy, hệ thống xếp các mã đề (101, 102, 103, 104...) thành các cột song song đối chiếu trực tiếp theo từng câu hỏi.',
      },
      {
        bold: 'Phân màu trực quan từng phương án',
        text: 'Phần I hiển thị nhãn màu riêng cho A (Xanh lam), B (Xanh lá), C (Cam), D (Tím); Phần II hiển thị rõ chuỗi Đ-S-Đ-S kèm từng ý a, b, c, d; Phần III in đậm đáp số ngắn.',
      },
      {
        bold: '3 chế độ xem linh hoạt',
        text: 'Chuyển đổi tức thì giữa: (1) Ma Trận Đối Chiếu Đa Mã Đề, (2) Bảng Khảo Thí A4 nộp nhà trường và (3) Thẻ 3 Cột Màu chi tiết.',
      },
    ],
    techSpecTitle: 'BỐ CỤC CROSS-REFERENCING A4 PORTRAIT',
    techSpecDetail:
      'Tự động co giãn độ rộng cột (<w:tblLayout w:type="autofit"/>) vừa khít khổ giấy A4 kèm khung chữ ký Người ra đề.',
  },
  {
    code: 'TÍNH NĂNG 11 · KHUNG XANH LÁ MẠ',
    group: 'CORE_STEM',
    groupLabel: 'Bóc Tách & Công Thức',
    title: 'Kho Đề Mẫu Chuẩn 2025 (Đề Sinh Học 12 Cuối HK1 & Đề Tổng Hợp KHTN)',
    subtitle: 'Tích hợp sẵn các bộ đề mẫu hoàn chỉnh 100% không lỗi để giáo viên trải nghiệm ngay',
    icon: <GraduationCap className="w-6 h-6" />,
    theme: SYNCHRONIZED_THEMES[10], // Lime
    bullets: [
      {
        bold: 'Đề mẫu Kiểm tra Sinh học 12 (28 câu chuẩn 18-4-6)',
        text: 'Đầy đủ sơ đồ tái bản DNA, cơ chế điều hòa Operon Lac, bài tập đột biến DNA-RNA-Protein, quy luật Mendel, hoán vị gene, liên kết giới tính, ưu thế lai và 2 sơ đồ phả hệ người.',
      },
      {
        bold: 'Đề mẫu Tổng hợp Toán - Lý - Hóa - Sinh',
        text: 'Bao quát trọn vẹn 4 môn Khoa học tự nhiên với đồ thị hàm số bậc ba, hình chóp khối lập phương, mạch điện xoay chiều RLC và chuỗi phản ứng hóa hữu cơ.',
      },
      {
        bold: 'Tải về máy hoặc nạp thẳng 1 chạm',
        text: 'Cho phép nạp trực tiếp vào bộ trộn đề chỉ bằng 1 nút bấm hoặc tải về file Word (.docx) chuẩn làm tài liệu mẫu soạn đề.',
      },
    ],
    techSpecTitle: 'CHUẨN ĐỀ MẪU TRƯỜNG THPT MANG THÍT — SỞ GD&ĐT VĨNH LONG',
    techSpecDetail:
      'Đính kèm sẵn 4 sơ đồ khoa học Vector SVG độ phân giải 300 DPI + Đáp án chuẩn cho cả 3 phần thi.',
  },
  {
    code: 'TÍNH NĂNG 12 · KHUNG XANH BĂNG',
    group: 'EXPORT_7991',
    groupLabel: 'Ma Trận 7991 & Xuất Bản',
    title: 'Tùy Chỉnh Thời Gian (Mặc Định 45 Phút), Kỳ Kiểm Tra Ôn Tập & Đóng Gói (.zip) Đồng Nhất',
    subtitle: 'Cấu hình mặc định thông minh 45 phút - Kiểm tra ôn tập, nhúng Phiếu trả lời và đặt tên file đồng bộ',
    icon: <Download className="w-6 h-6" />,
    theme: SYNCHRONIZED_THEMES[11], // Cyan
    bullets: [
      {
        bold: 'Mặc định thông minh: Thời gian 45 phút & Kỳ "KIỂM TRA ÔN TẬP"',
        text: 'Thiết lập sẵn thời gian làm bài mặc định là 45 phút (có nút chọn nhanh 15p, 45p, 60p, 90p hoặc tự nhập số phút) và kỳ kiểm tra mặc định là "KIỂM TRA ÔN TẬP" (chọn nhanh Giữa kỳ, Cuối kỳ, Thi thử THPT).',
      },
      {
        bold: 'Quy chuẩn đặt tên tự động đồng nhất',
        text: 'Tự động đặt tên theo cấu trúc: Môn [Tên môn] - Lớp [Lớp] - Kỳ kiểm tra [Kỳ] - [dd-mm-yy] - [Hậu tố].docx/.xlsx/.png/.zip cho mọi tệp xuất ra.',
      },
      {
        bold: 'Đầy đủ 2 thư mục chuẩn khảo thí trong 1 lần tải (.zip)',
        text: 'Gồm: (1) Thư mục các mã đề (Đề gốc đối chiếu + tất cả các Mã đề học sinh có nhúng sẵn Phiếu trả lời trắc nghiệm đã chọn) và (2) Thư mục đáp án (Bảng đáp án chung nhúng 3 mã QR, ảnh QR Chung & 3 file Excel .xlsx).',
      },
    ],
    techSpecTitle: 'CẤU HÌNH MẶC ĐỊNH 45 PHÚT & GÓI KHẢO THÍ (.ZIP)',
    techSpecDetail:
      'Mặc định 45 phút · Kỳ kiểm tra ôn tập · Nhúng Phiếu trả lời tùy chọn vào mọi mã đề · Font Times New Roman 12pt chuẩn in ấn.',
  },
];

export const UserGuideModal: React.FC<UserGuideModalProps> = ({
  isOpen,
  onClose,
  features,
  onRegisterNewFeature,
}) => {
  const [activeTab, setActiveTab] = useState<GuideTab>('FEATURES');
  const [featureGroupFilter, setFeatureGroupFilter] = useState<
    'ALL' | 'QR_EXCEL' | 'CORE_STEM' | 'EDITOR_AI' | 'EXPORT_7991'
  >('ALL');
  const [isExporting, setIsExporting] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // State form đăng ký tính năng mới
  const [newTitle, setNewTitle] = useState('');
  const [newVersion, setNewVersion] = useState('v4.7.0');
  const [newCategory, setNewCategory] = useState<FeatureReleaseItem['category']>('CORE_PARSER');
  const [newDesc, setNewDesc] = useState('');
  const [newTechSpec, setNewTechSpec] = useState('');

  if (!isOpen) return null;

  const filteredFeatures =
    featureGroupFilter === 'ALL'
      ? ALL_12_SYSTEM_FEATURES
      : ALL_12_SYSTEM_FEATURES.filter((f) => f.group === featureGroupFilter);

  const handleDownloadDocx = async () => {
    setIsExporting(true);
    try {
      const blob = await exportUserManualDocx(features);
      triggerBrowserDownload(blob, 'Huong_Dan_Su_Dung_Va_12_Tinh_Nang_EduMix_2025.docx');
    } catch (err) {
      console.error('Lỗi xuất tài liệu hướng dẫn Word:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyText = () => {
    const featureLines = ALL_12_SYSTEM_FEATURES.map(
      (f, idx) =>
        `${idx + 1}. ${f.title} (${f.code}):\n` +
        f.bullets.map((b) => `   + ${b.bold}: ${b.text}`).join('\n') +
        `\n   [Thông số kỹ thuật]: ${f.techSpecDetail}`
    ).join('\n\n');

    const fullText = `TÀI LIỆU HƯỚNG DẪN SỬ DỤNG & ĐẶC TẢ 12 TÍNH NĂNG HỆ THỐNG EDUMIX 2025
Tác giả: Thầy Hồ Tấn Khải — Giáo viên Trường THPT Mang Thít, Sở GD&ĐT Vĩnh Long
Liên hệ: Email: khaibcmt@gmail.com | Điện thoại / Zalo: 0939580982

I. VAI TRÒ VÀ NGUYÊN TẮC HOẠT ĐỘNG CỐT LÕI
1. Tiếp nhận đa định dạng & Tự động chữa lỗi (Auto-Healing 4 Engines): Đọc trực tiếp Word (.docx, .doc), PDF, ảnh chụp/scan 300 DPI, ảnh WMF/EMF và dán trực tiếp từ bộ nhớ tạm (HTML Clipboard). Tự động sửa bảng đè chữ, tái cân bằng cột phương án A/B/C/D.
2. Bảo toàn 100% công thức Toán - Lý - Hóa - Sinh & Hình ảnh đề gốc: Hàn gắn công thức bị gãy (<m:oMath>), tự nâng/hạ chỉ số Hóa học (H₂SO₄, Cu²⁺, SO₄²⁻, mũi tên →, ⇌, ↓, ↑), chuẩn hóa phân số kiểu gen Sinh học (AB/ab, XᴬXᵃ, ♂, ♀), giữ nguyên vectơ Vật lý (v⃗, F⃗) và ký hiệu đặc biệt (Ω, μ, λ, Δ, α, β, ω, ⊥, ∥). Thu hồi ảnh trôi nổi, ảnh dòng riêng, ảnh dưới đáp án A/B/C/D và ảnh bảng 2 cột không bao giờ mất ảnh khi trộn.
3. Lưu chỉnh sửa từng câu & Lưu toàn bộ chỉnh sửa: Có nút [Lưu câu này] ở từng câu và nút [Lưu Toàn Bộ Chỉnh Sửa] trên thanh công cụ để chuyển câu không bị mất thay đổi.
4. Ô tùy chọn Phiếu trả lời trắc nghiệm nổi bật: Chọn nhanh 5 mẫu phiếu chuẩn QM 2025 hoặc tải lên phiếu riêng (.pdf, .jpg, .png) để tự động nhúng vào mọi mã đề trộn. Mặc định thời gian làm bài 45 phút và kỳ kiểm tra là "KIỂM TRA ÔN TẬP".
5. Chuẩn hóa đầu ra khảo thí: Xuất tệp Word (.docx) chuẩn Times New Roman 12pt, Bảng đáp án ma trận A4 gọn 1 trang, Ma trận & Bản đặc tả chuẩn Công văn 7991/BGDĐT-GDTrH.
6. Tương thích 100% 3 phần mềm chấm thi: Tạo đồng thời 3 mã QR và 3 file Excel (.xlsx) chuẩn định dạng gốc cho QM 2025, TNMaker và Azota.

II. TỔNG HỢP 12 TÍNH NĂNG ĐỘT PHÁ (MỖI TÍNH NĂNG 1 KHUNG MÀU ĐỒNG BỘ)
${featureLines}

III. QUY TRÌNH HƯỚNG DẪN SỬ DỤNG 6 BƯỚC THỰC CHIẾN
- Bước 1: Chuẩn bị file Word đề gốc (.docx/.doc), PDF hoặc chọn 1 trong 2 Đề mẫu chuẩn 2025 (Sinh học 12 Cuối HK1 / Đề Tổng hợp KHTN).
- Bước 2: Tải đề lên hệ thống hoặc dán trực tiếp nội dung từ Word (Ctrl+V). Hệ thống tự động chạy 4 Engine Auto-Healing khôi phục ảnh, bảng biểu và công thức.
- Bước 3: Chỉnh sửa câu hỏi/đáp án, bấm [Lưu câu này] ở từng câu hoặc [Lưu Toàn Bộ Chỉnh Sửa] để khóa dữ liệu không bị mất khi chuyển câu.
- Bước 4: (Tùy chọn) Mở AI Gemini Studio để nhân bản cùng lúc 4 đề tương đương mới.
- Bước 5: Cấu hình thông tin trường, môn, lớp, Thời gian làm bài (mặc định 45 phút), Kỳ kiểm tra (mặc định KIỂM TRA ÔN TẬP), chọn Phiếu trả lời trắc nghiệm (5 mẫu có sẵn hoặc tải phiếu riêng) và bấm [Trộn Đề Ngay].
- Bước 6: Quét trực tiếp Bộ 3 Mã QR (QM 2025, TNMaker, Azota), tải 3 file Excel (.xlsx), xuất Ma trận CV 7991 hoặc bấm [Tải Trọn Bộ Đề (.zip)].`;

    navigator.clipboard.writeText(fullText);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  const handleAddFeature = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDesc.trim()) return;

    const item: FeatureReleaseItem = {
      id: `feat-custom-${Date.now()}`,
      version: newVersion.trim() || 'v4.7.0',
      releaseDate: new Date().toISOString().slice(0, 7),
      title: newTitle.trim(),
      category: newCategory,
      description: newDesc.trim(),
      technicalSpec: newTechSpec.trim() || 'Chuẩn OpenXML & QR 2025',
      autoDetected: false,
    };

    onRegisterNewFeature(item);
    setNewTitle('');
    setNewDesc('');
    setNewTechSpec('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white border-2 border-slate-300 rounded-3xl max-w-6xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto max-h-[93vh] flex flex-col shadow-2xl">
        {/* Header Modal */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 px-6 py-4 text-white flex flex-wrap items-center justify-between gap-4 shrink-0 border-b-2 border-blue-500/40">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center border-2 border-white/30 shadow-lg shrink-0">
              <BookOpen className="w-6 h-6 text-slate-950" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">
                  Cẩm Nang 12 Tính Năng & Hướng Dẫn Sử Dụng Toàn Diện — EduMix 2025
                </h2>
              </div>
              <p className="text-xs text-blue-200 mt-0.5 font-medium">
                Tác giả: Thầy Hồ Tấn Khải — Trường THPT Mang Thít, Sở GD&ĐT Vĩnh Long · Trình bày khung viền đồng bộ 12 màu độc lập
              </p>
            </div>
          </div>

          {/* Cụm nút Xuất Word & Copy */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleCopyText}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/25 transition-all flex items-center gap-1.5 cursor-pointer"
              title="Sao chép toàn bộ nội dung hướng dẫn"
            >
              {copySuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-300">Đã sao chép!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-blue-200" />
                  <span>Sao chép văn bản</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownloadDocx}
              disabled={isExporting}
              className="px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 transition-all flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4 stroke-[2.5]" />
              <span>{isExporting ? 'Đang tạo Word...' : 'Tải Cẩm Nang (.docx)'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="text-slate-300 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
              title="Đóng cửa sổ"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-slate-100 border-b-2 border-slate-200 px-5 py-2.5 flex items-center gap-2 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('FEATURES')}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer border-2 ${
              activeTab === 'FEATURES'
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300 hover:text-emerald-700'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            1. Trọn Bộ 12 Tính Năng (12 Khung Màu Đồng Bộ)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ROLES')}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer border-2 ${
              activeTab === 'ROLES'
                ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:text-blue-700'
            }`}
          >
            <Award className="w-4 h-4" />
            2. Vai Trò & 6 Nguyên Tắc Cốt Lõi
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('WORKFLOW')}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer border-2 ${
              activeTab === 'WORKFLOW'
                ? 'bg-violet-600 text-white border-violet-700 shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:border-violet-300 hover:text-violet-700'
            }`}
          >
            <Workflow className="w-4 h-4" />
            3. Quy Trình 6 Bước Sử Dụng
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('SPEC_2025')}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer border-2 ${
              activeTab === 'SPEC_2025'
                ? 'bg-amber-600 text-white border-amber-700 shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:border-amber-300 hover:text-amber-700'
            }`}
          >
            <FileCode className="w-4 h-4" />
            4. Chuẩn Đề 2025 · Auto-Healing · Phiếu Trả Lời & 3 Mã QR
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('AUTO_CHANGELOG')}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer border-2 ${
              activeTab === 'AUTO_CHANGELOG'
                ? 'bg-rose-600 text-white border-rose-700 shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:border-rose-300 hover:text-rose-700'
            }`}
          >
            <Zap className="w-4 h-4" />
            5. Nhật Ký Nâng Cấp ({features.length})
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/70">
          {/* =====================================================================
              TAB 1: TRỌN BỘ 12 TÍNH NĂNG (MỖI TÍNH NĂNG 1 KHUNG VIỀN ĐỒNG BỘ MÀU RIÊNG)
             ===================================================================== */}
          {activeTab === 'FEATURES' && (
            <div className="space-y-5">
              {/* Banner giới thiệu & Bộ lọc nhanh */}
              <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-emerald-600 shrink-0" />
                    Hệ Thống 12 Tính Năng Toàn Diện — Mỗi Tính Năng Bố Trí Trong 1 Khung Viền Đồng Bộ Màu Riêng
                  </h3>
                  <p className="text-xs text-slate-600 mt-1">
                    Bao gồm đầy đủ các nâng cấp mới nhất: Auto-Healing 4 Engine chuẩn hóa công thức Toán-Lý-Hóa-Sinh & bảng biểu, Bóc tách 100% ảnh đề gốc (kể cả WMF/EMF, ảnh dòng riêng, bảng 2 cột), Lưu chỉnh sửa từng câu & Lưu toàn bộ, Ô chọn Phiếu trả lời trắc nghiệm tùy chỉnh, Thời gian mặc định 45 phút - Kiểm tra ôn tập.
                  </p>
                </div>

                {/* Bộ lọc nhóm tính năng */}
                <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200 shrink-0">
                  <button
                    type="button"
                    onClick={() => setFeatureGroupFilter('ALL')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      featureGroupFilter === 'ALL'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Tất cả (12)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeatureGroupFilter('QR_EXCEL')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      featureGroupFilter === 'QR_EXCEL'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-blue-700'
                    }`}
                  >
                    QR, Phiếu TL & Excel (2)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeatureGroupFilter('CORE_STEM')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      featureGroupFilter === 'CORE_STEM'
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-amber-700'
                    }`}
                  >
                    Auto-Heal, Công Thức & Ảnh (4)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeatureGroupFilter('EDITOR_AI')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      featureGroupFilter === 'EDITOR_AI'
                        ? 'bg-fuchsia-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-fuchsia-700'
                    }`}
                  >
                    Lưu Câu Hỏi, Biên Tập & AI (3)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeatureGroupFilter('EXPORT_7991')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      featureGroupFilter === 'EXPORT_7991'
                        ? 'bg-sky-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-sky-700'
                    }`}
                  >
                    CV 7991 & Xuất File (3)
                  </button>
                </div>
              </div>

              {/* Dải 12 ô màu minh họa đồng bộ */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                {ALL_12_SYSTEM_FEATURES.map((feat, idx) => (
                  <div
                    key={feat.code}
                    className={`border-2 ${feat.theme.frameBorder} ${feat.theme.frameBg} rounded-xl px-2.5 py-2 flex items-center gap-2 shadow-xs`}
                  >
                    <span
                      className={`w-6 h-6 rounded-lg ${feat.theme.iconBoxBg} flex items-center justify-center text-[11px] font-black shrink-0`}
                    >
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <span className={`text-[11px] font-bold ${feat.theme.titleColor} truncate`}>
                      {feat.title.split('(')[0].trim()}
                    </span>
                  </div>
                ))}
              </div>

              {/* Lưới 12 Khung Tính Năng — Mỗi Khung 1 Viền & Màu Đồng Bộ Riêng */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {filteredFeatures.map((feat) => {
                  const t = feat.theme;
                  return (
                    <div
                      key={feat.code}
                      className={`border-2 ${t.frameBorder} ${t.frameBg} rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-200 flex flex-col justify-between`}
                    >
                      {/* Thanh Header đồng bộ màu của khung */}
                      <div>
                        <div
                          className={`${t.headerBg} ${t.headerText} px-4 py-2.5 flex items-center justify-between gap-2 border-b ${t.frameBorder}`}
                        >
                          <span className="text-[11px] font-black uppercase tracking-wider">
                            {feat.code}
                          </span>
                          <span className="text-[11px] font-semibold opacity-95">
                            Nhóm: {feat.groupLabel} · Màu: {t.name.split('(')[0].trim()}
                          </span>
                        </div>

                        {/* Phần thân của khung tính năng */}
                        <div className="p-5">
                          <div className="flex items-start gap-3.5 mb-3.5">
                            <div
                              className={`w-12 h-12 rounded-2xl ${t.iconBoxBg} flex items-center justify-center shrink-0`}
                            >
                              {feat.icon}
                            </div>
                            <div>
                              <h4 className={`text-base font-black ${t.titleColor} leading-snug`}>
                                {feat.title}
                              </h4>
                              <p className="text-xs font-semibold text-slate-600 mt-1">
                                {feat.subtitle}
                              </p>
                            </div>
                          </div>

                          {/* Danh sách chi tiết có icon đồng bộ màu */}
                          <ul className="space-y-2.5 text-xs text-slate-700 leading-relaxed mt-3">
                            {feat.bullets.map((b, bIdx) => (
                              <li key={bIdx} className="flex items-start gap-2.5">
                                <CheckCircle2
                                  className={`w-4 h-4 ${t.bulletIconColor} shrink-0 mt-0.5`}
                                />
                                <span>
                                  <strong className={t.titleColor}>{b.bold}:</strong> {b.text}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Khung thông số kỹ thuật đồng bộ màu ở đáy thẻ */}
                      <div className="px-5 pb-4 pt-1">
                        <div
                          className={`border-2 ${t.specBorder} ${t.specBg} rounded-xl p-3 flex items-start gap-2.5`}
                        >
                          <div className={`w-1.5 self-stretch rounded-full ${t.accentBar} shrink-0`} />
                          <div>
                            <div className={`text-[10px] font-black uppercase tracking-wider ${t.specTitleColor}`}>
                              {feat.techSpecTitle}
                            </div>
                            <div className={`text-xs font-semibold ${t.specTextColor} mt-0.5 leading-snug`}>
                              {feat.techSpecDetail}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* =====================================================================
              TAB 2: VAI TRÒ & 6 NGUYÊN TẮC CỐT LÕI (MỖI NGUYÊN TẮC 1 KHUNG MÀU ĐỒNG BỘ)
             ===================================================================== */}
          {activeTab === 'ROLES' && (
            <div className="space-y-6">
              {/* Khung Thông Tin Tác Giả & Đơn Vị */}
              <div className="border-2 border-indigo-600 bg-gradient-to-r from-indigo-950 via-blue-900 to-slate-900 rounded-2xl p-6 text-white shadow-lg">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/15 pb-4 mb-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-14 h-14 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-lg shrink-0">
                      <GraduationCap className="w-8 h-8" />
                    </div>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-amber-300">
                        SỞ GD&ĐT VĨNH LONG — TRƯỜNG THPT MANG THÍT
                      </div>
                      <h3 className="text-lg sm:text-xl font-black text-white mt-0.5">
                        Hệ Thống Chuyên Gia Xử Lý, Tự Động Chữa Lỗi (Auto-Heal) & Trộn Đề Thi Chuẩn 2025
                      </h3>
                      <p className="text-xs text-blue-200 mt-0.5">
                        Tác giả phát triển: <strong className="text-white">Thầy Hồ Tấn Khải</strong> · Email: khaibcmt@gmail.com · ĐT/Zalo: 0939580982
                      </p>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-blue-100 leading-relaxed">
                  Được thiết kế với vai trò là <strong className="text-amber-300">Kỹ sư Trưởng Xử lý Văn bản Khảo thí & Chuyên gia AI Sư phạm</strong>, hệ thống giải quyết triệt để mọi lỗi định dạng đề gốc: tự động thu hồi hình ảnh trôi nổi, giải mã ảnh WMF/EMF, hàn gắn công thức Toán - Lý - Hóa - Sinh bị gãy, lưu chỉnh sửa từng câu độc lập, tùy chọn Phiếu trả lời trắc nghiệm nhúng thẳng vào đề trộn, tự động hóa Ma trận CV 7991 và tạo bộ 3 mã QR chấm thi chuẩn xác 100%.
                </p>
              </div>

              {/* 6 Nguyên tắc cốt lõi — Mỗi nguyên tắc 1 khung viền màu đồng bộ khác nhau */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {[
                  {
                    num: 'NGUYÊN TẮC 01',
                    title: 'Tiếp Nhận Đa Định Dạng & Tự Động Chữa Lỗi (Auto-Heal)',
                    desc: 'Đọc trực tiếp tệp Word (.docx, .doc), PDF, ảnh chụp/scan 300 DPI, ảnh công thức WMF/EMF và dán trực tiếp từ Word (Ctrl+V). Tự động gỡ bảng đè chữ và cân bằng cột phương án A/B/C/D.',
                    spec: 'Hỗ trợ .docx, .pdf, .png, .jpg, .wmf, .emf & HTML Clipboard.',
                    theme: SYNCHRONIZED_THEMES[0], // Blue
                    icon: <FileText className="w-5 h-5" />,
                  },
                  {
                    num: 'NGUYÊN TẮC 02',
                    title: 'Bảo Toàn 100% Công Thức Toán - Lý - Hóa - Sinh & Vectơ',
                    desc: 'Hàn gắn công thức bị gãy (<m:oMath>), giữ nguyên vectơ (v⃗, F⃗), ký hiệu đặc biệt (Ω, μ, λ, Δ, α, β, ω, ⊥, ∥), tự động nâng/hạ chỉ số Hóa học (H₂SO₄, Cu²⁺, SO₄²⁻, →, ⇌) và phân số kiểu gen Sinh học (AB/ab, XᴬXᵃ, ♂, ♀).',
                    spec: 'KaTeX + MathJax 3 + OMML Stitcher + MathType OLE Fallback.',
                    theme: SYNCHRONIZED_THEMES[1], // Emerald
                    icon: <FlaskConical className="w-5 h-5" />,
                  },
                  {
                    num: 'NGUYÊN TẮC 03',
                    title: 'Nhận Diện 100% Ảnh Đề Gốc & Không Mất Ảnh Khi Trộn',
                    desc: 'Tự động thu hồi ảnh trôi nổi (Floating), ảnh nằm trên dòng riêng, ảnh dưới 4 phương án A/B/C/D, ảnh trong bảng 2 cột và Drawing Canvas. Gắn định danh [HINH_ANH_CAU_X] sao chép sang mọi mã đề 101–104.',
                    spec: 'Spatial Ownership Heuristic + WMF/EMF Decoder + KeepNext.',
                    theme: SYNCHRONIZED_THEMES[4], // Rose
                    icon: <ImageIcon className="w-5 h-5" />,
                  },
                  {
                    num: 'NGUYÊN TẮC 04',
                    title: 'Tùy Chọn Phiếu Trả Lời & Tương Thích 3 App Chấm Thi',
                    desc: 'Tích hợp ô chọn 5 mẫu Phiếu trả lời QM 2025 chuẩn hoặc tải phiếu riêng (.pdf, .jpg, .png) để nhúng vào các đề trộn. Tạo đồng thời 3 mã QR và 3 file Excel (.xlsx) chuẩn QM 2025, TNMaker và Azota.',
                    spec: '5 Phiếu QM 2025 + Upload Phiếu Riêng + 3 QR & 3 Excel.',
                    theme: SYNCHRONIZED_THEMES[2], // Violet
                    icon: <QrCode className="w-5 h-5" />,
                  },
                  {
                    num: 'NGUYÊN TẮC 05',
                    title: 'Lưu Từng Câu Độc Lập & Mặc Định 45 Phút - Ôn Tập',
                    desc: 'Nút [Lưu câu này] ở từng câu và [Lưu Toàn Bộ Chỉnh Sửa] giúp chuyển câu không mất dữ liệu. Mặc định sẵn thời gian 45 phút, kỳ "KIỂM TRA ÔN TẬP", kèm Ma trận CV 7991 & Bảng đáp án gọn 1 trang A4.',
                    spec: 'Per-Question Save + Global Save + Mặc định 45p / Ôn tập.',
                    theme: SYNCHRONIZED_THEMES[3], // Amber
                    icon: <LayoutGrid className="w-5 h-5" />,
                  },
                  {
                    num: 'NGUYÊN TẮC 06',
                    title: 'Bảo Mật Đề Thi Tuyệt Đối (Client-Side Zero-Trace)',
                    desc: 'Toàn bộ quá trình đọc file, tự động chữa lỗi, lưu chỉnh sửa và trộn đề diễn ra trực tiếp trên trình duyệt máy tính của giáo viên. Không lưu trữ đề thi lên máy chủ, bảo mật tuyệt đối kỳ kiểm tra.',
                    spec: '100% Browser Processing + Zero-Trace Memory Purge.',
                    theme: SYNCHRONIZED_THEMES[5], // Teal
                    icon: <ShieldCheck className="w-5 h-5" />,
                  },
                ].map((item) => {
                  const t = item.theme;
                  return (
                    <div
                      key={item.num}
                      className={`border-2 ${t.frameBorder} ${t.frameBg} rounded-2xl overflow-hidden shadow-md flex flex-col justify-between`}
                    >
                      <div>
                        <div className={`${t.headerBg} ${t.headerText} px-4 py-2 text-xs font-black uppercase tracking-wider flex items-center justify-between`}>
                          <span>{item.num}</span>
                          <span>{t.name.split('(')[0].trim()}</span>
                        </div>
                        <div className="p-5">
                          <div className="flex items-center gap-3 mb-3">
                            <div className={`w-10 h-10 rounded-xl ${t.iconBoxBg} flex items-center justify-center shrink-0`}>
                              {item.icon}
                            </div>
                            <h4 className={`text-sm font-black ${t.titleColor} leading-snug`}>
                              {item.title}
                            </h4>
                          </div>
                          <p className="text-xs text-slate-700 leading-relaxed">
                            {item.desc}
                          </p>
                        </div>
                      </div>
                      <div className="px-5 pb-4">
                        <div className={`border ${t.specBorder} ${t.specBg} rounded-xl px-3 py-2 text-[11px] font-bold ${t.specTextColor}`}>
                          {item.spec}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* =====================================================================
              TAB 3: QUY TRÌNH 6 BƯỚC SỬ DỤNG (MỖI BƯỚC 1 KHUNG VIỀN ĐỒNG BỘ MÀU RIÊNG)
             ===================================================================== */}
          {activeTab === 'WORKFLOW' && (
            <div className="space-y-5">
              <div className="bg-white border-2 border-violet-400 rounded-2xl p-4 sm:p-5 shadow-sm">
                <h3 className="text-base sm:text-lg font-black text-violet-950 flex items-center gap-2">
                  <Workflow className="w-5 h-5 text-violet-600" />
                  Quy Trình 6 Bước Sử Dụng Chuẩn Sư Phạm — Mỗi Bước 1 Khung Viền Màu Đồng Bộ
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  Chỉ với 6 bước đơn giản từ lúc nạp đề gốc (tự động chữa lỗi ảnh & công thức), lưu chỉnh sửa từng câu, chọn Phiếu trả lời trắc nghiệm đến khi xuất trọn bộ đề hoán vị (.zip).
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {[
                  {
                    step: 'BƯỚC 01 · KHUNG XANH LAM',
                    title: 'Chuẩn Bị Đề Gốc Hoặc Chọn Kho Đề Mẫu Chuẩn 2025',
                    desc: 'Soạn đề thi theo cấu trúc Phần I, Phần II, Phần III và Phần IV Tự luận (nếu có). Đánh dấu đáp án đúng bằng Gạch chân (Ctrl+U), Tô chữ màu đỏ/xanh, Tô nền Highlight hoặc đặt Bảng đáp án ở cuối đề. Hoặc bấm chọn ngay "Đề Mẫu Sinh Học 12" / "Đề Mẫu Tổng Hợp KHTN" có sẵn.',
                    tip: 'Mẹo: Đề gốc có ảnh trôi nổi, công thức gõ thô (H2SO4, AB/ab) hay bảng lệch cột đều được hệ thống tự động sửa chuẩn.',
                    theme: SYNCHRONIZED_THEMES[0], // Blue
                  },
                  {
                    step: 'BƯỚC 02 · KHUNG XANH NGỌC LỤC BẢO',
                    title: 'Tải Đề Lên (.docx / .pdf) Hoặc Dán Nhanh Từ Word (Ctrl+V)',
                    desc: 'Bấm nút [Tải Word / PDF] hoặc kéo thả tệp vào màn hình; hoặc mở khung [Sửa / Dán Văn Bản Word Gốc] để dán trực tiếp từ Microsoft Word. Hệ thống lập tức kích hoạt 4 Engine Auto-Healing để thu hồi hình ảnh, giải mã WMF/EMF và hàn gắn công thức.',
                    tip: 'Mẹo: Cả ảnh nằm trên dòng riêng, ảnh dưới 4 phương án A/B/C/D hay ảnh trong bảng 2 cột đều được gắn đúng câu hỏi.',
                    theme: SYNCHRONIZED_THEMES[1], // Emerald
                  },
                  {
                    step: 'BƯỚC 03 · KHUNG VÀNG HỔ PHÁCH',
                    title: 'Chỉnh Sửa Câu Hỏi, Bấm "Lưu Câu Này" & "Lưu Toàn Bộ Chỉnh Sửa"',
                    desc: 'Khi chỉnh sửa nội dung, công thức, đáp án hoặc chèn thêm ảnh ở từng câu, bấm nút [Lưu câu này] ngay trên thẻ câu hỏi đó hoặc bấm nút [Lưu Toàn Bộ Chỉnh Sửa] trên thanh công cụ để khóa dữ liệu, giúp chuyển sang câu khác không bao giờ bị mất nội dung vừa sửa.',
                    tip: 'Mẹo: Nếu có cảnh báo câu thiếu đáp án, bấm [Sửa ngay] để cuộn tới đúng câu đó hoặc bấm [Tự Động Sửa Nhanh Tất Cả Lỗi].',
                    theme: SYNCHRONIZED_THEMES[3], // Amber
                  },
                  {
                    step: 'BƯỚC 04 · KHUNG HỒNG TÍM AI',
                    title: '(Tùy Chọn) Nhân Bản 4 Đề Tương Đương Bằng AI Gemini Studio',
                    desc: 'Nếu muốn tạo thêm bộ đề mới cho ca thi khác hoặc đề ôn tập tương đương, mở tab "AI Gemini Studio — Tạo Đề Tương Đương", chọn tạo 4 đề cùng lúc và bấm thực thi. Có thể nạp thẳng đề AI vừa tạo vào bộ trộn đề.',
                    tip: 'Mẹo: Có thể ghi chú yêu cầu riêng như "Đổi số liệu chẵn dễ tính" để AI tuân thủ chính xác.',
                    theme: SYNCHRONIZED_THEMES[7], // Fuchsia
                  },
                  {
                    step: 'BƯỚC 05 · KHUNG TÍM THẠCH ANH',
                    title: 'Chọn Phiếu Trả Lời Trắc Nghiệm, Thời Gian (45p) & Bấm "Trộn Đề Ngay"',
                    desc: 'Tại cột cấu hình bên trái: Kỳ kiểm tra mặc định là "KIỂM TRA ÔN TẬP" và Thời gian làm bài mặc định là 45 phút (tùy chỉnh linh hoạt). Tại ô nổi bật "Tùy chọn Phiếu Trả Lời Trắc Nghiệm", chọn 1 trong 5 mẫu phiếu chuẩn QM 2025 hoặc bấm [Tải phiếu riêng (.pdf/.jpg/.png)] rồi bấm [Trộn Đề Ngay].',
                    tip: 'Mẹo: Phiếu trả lời do giáo viên chọn hoặc tự tải lên sẽ được nhúng vào tất cả các mã đề trộn giống hệt phiếu mặc định.',
                    theme: SYNCHRONIZED_THEMES[2], // Violet
                  },
                  {
                    step: 'BƯỚC 06 · KHUNG ĐỎ HỒNG NGỌC',
                    title: 'Quét Bộ 3 Mã QR (QM · TNMaker · Azota) & Tải Trọn Bộ (.zip)',
                    desc: 'Sau khi trộn xong: (1) Mở Bảng Đáp Án để xem Ma trận đối chiếu gọn 1 trang và quét trực tiếp 3 Mã QR hoặc tải 3 file Excel (.xlsx), (2) Xem & tải file Word Ma trận Đặc tả CV 7991, (3) Bấm [Tải Bộ Đề (.zip)] để nhận trọn gói 2 thư mục (Thư mục các mã đề & Thư mục đáp án).',
                    tip: 'Mẹo: Mọi file trong gói .zip đều được đặt tên đồng nhất theo Môn - Lớp - Kỳ kiểm tra - Ngày tháng.',
                    theme: SYNCHRONIZED_THEMES[4], // Rose
                  },
                ].map((st) => {
                  const t = st.theme;
                  return (
                    <div
                      key={st.step}
                      className={`border-2 ${t.frameBorder} ${t.frameBg} rounded-2xl overflow-hidden shadow-md flex flex-col justify-between`}
                    >
                      <div>
                        <div className={`${t.headerBg} ${t.headerText} px-4 py-2.5 text-xs font-black uppercase tracking-wider flex items-center justify-between`}>
                          <span>{st.step}</span>
                          <span>{t.name.split('(')[0].trim()}</span>
                        </div>
                        <div className="p-5">
                          <h4 className={`text-base font-black ${t.titleColor} mb-2`}>
                            {st.title}
                          </h4>
                          <p className="text-xs text-slate-700 leading-relaxed">
                            {st.desc}
                          </p>
                        </div>
                      </div>
                      <div className="px-5 pb-4">
                        <div className={`border-2 ${t.specBorder} ${t.specBg} rounded-xl px-3.5 py-2.5 text-xs font-bold ${t.specTextColor}`}>
                          {st.tip}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* =====================================================================
              TAB 4: CHUẨN ĐỀ 2025 · AUTO-HEALING 4 ENGINE · PHIẾU TRẢ LỜI & 3 MÃ QR
             ===================================================================== */}
          {activeTab === 'SPEC_2025' && (
            <div className="space-y-6">
              {/* Phần A: 4 Phần cấu trúc đề thi 2025 (Trắc nghiệm & Tự luận) */}
              <div>
                <h3 className="text-base font-black text-slate-900 mb-3 flex items-center gap-2">
                  <Code2 className="w-5 h-5 text-blue-600" />
                  A. Quy Chuẩn Nhận Diện 4 Phần Thi (Phần I, Phần II, Phần III & Phần IV Tự Luận)
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {[
                    {
                      badge: 'PHẦN I · KHUNG XANH LAM',
                      title: 'Trắc Nghiệm Nhiều Lựa Chọn (A, B, C, D)',
                      rules: [
                        'Mỗi câu bắt đầu bằng "Câu 1.", "Câu 2."... gồm 4 phương án A., B., C., D.',
                        'Đánh dấu đáp án đúng bằng Gạch chân (Ctrl+U), Tô màu đỏ/xanh nổi bật, Tô nền Highlight hoặc ghi ở bảng đáp án cuối đề.',
                        'Hình ảnh đặt ở phần dẫn, đặt ở dòng riêng dưới 4 phương án A/B/C/D hoặc đặt trong bảng 2 cột đều được tự động gắn đúng vào câu hỏi.',
                      ],
                      sample: 'Câu 1. Đơn vị cấu tạo của DNA là?\nA. Amino acid.   B. Nucleotide (Gạch chân)',
                      theme: SYNCHRONIZED_THEMES[0], // Blue
                    },
                    {
                      badge: 'PHẦN II · KHUNG TÍM THẠCH ANH',
                      title: 'Trắc Nghiệm Đúng / Sai (4 Ý a, b, c, d)',
                      rules: [
                        'Mỗi câu có phần dẫn và 4 mệnh đề nhỏ ký hiệu a), b), c), d).',
                        'Mệnh đề nào ĐÚNG thì Gạch chân hoặc Tô đỏ (hoặc ghi Đ/Đúng ở cuối mệnh đề); mệnh đề không đánh dấu nhận là SAI. Hệ thống tự động cảnh báo nếu cả 4 ý đều Đúng hoặc cả 4 ý đều Sai.',
                        'Điểm chuẩn CV 7991: 1,0 điểm/câu (4 câu = 16 lệnh = 4,0 điểm).',
                      ],
                      sample: 'a) Mạch mới tổng hợp chiều 5’→3’. (Gạch chân = ĐÚNG)\nb) Enzyme tháo xoắn là DNA polymerase. (= SAI)',
                      theme: SYNCHRONIZED_THEMES[2], // Violet
                    },
                    {
                      badge: 'PHẦN III · KHUNG XANH NGỌC LỤC BẢO',
                      title: 'Trắc Nghiệm Trả Lời Ngắn (Điền Đáp Số Tối Đa 4 Ký Tự)',
                      rules: [
                        'Câu hỏi tính toán yêu cầu học sinh tô/điền con số tối đa 4 ký tự (bao gồm dấu âm "-" và dấu phẩy ",") đúng chuẩn 4 ô tô Phiếu trả lời 2025.',
                        'Ghi đáp số ở dòng cuối câu theo cú pháp: "Đáp án: 25,5" hoặc "<key: 25,5>".',
                        'Điểm chuẩn CV 7991: 0,25 điểm/câu (6 câu = 1,5 điểm).',
                      ],
                      sample: 'Câu 1. Tính hiệu suất phản ứng (%) làm tròn đến hàng đơn vị.\nĐáp án: 75',
                      theme: SYNCHRONIZED_THEMES[1], // Emerald
                    },
                    {
                      badge: 'PHẦN IV (HOẶC PHẦN III) · KHUNG VÀNG HỔ PHÁCH',
                      title: 'Phần Tự Luận (Giữ Nguyên Thứ Tự Câu Hỏi — Không Trộn)',
                      rules: [
                        'Bắt đầu bằng tiêu đề "PHẦN IV. Tự luận" (hoặc "PHẦN III. Tự luận"). Hệ thống giữ nguyên thứ tự các câu hỏi tự luận đưa lên, không đảo thứ tự câu.',
                        'Nếu đề gốc KHÔNG có Phần III (trả lời ngắn), khi xuất đề hệ thống tự động trình bày theo thứ tự: PHẦN I, PHẦN II, PHẦN III. Tự luận.',
                        'Nếu câu tự luận có sẵn "Đáp án:" / "Lời giải:" thì tự động tích hợp vào bảng đáp án; nếu không có đáp án thì bảng đáp án vẫn giữ nguyên câu hỏi tự luận để giáo viên dễ dàng chỉnh sửa.',
                      ],
                      sample: 'PHẦN IV. Tự luận\nCâu 1. Trình bày cơ chế tái bản DNA ở sinh vật nhân thực.\nĐáp án: Quá trình diễn ra theo nguyên tắc bổ sung và bán bảo toàn...',
                      theme: SYNCHRONIZED_THEMES[3], // Amber
                    },
                  ].map((part) => {
                    const t = part.theme;
                    return (
                      <div
                        key={part.badge}
                        className={`border-2 ${t.frameBorder} ${t.frameBg} rounded-2xl overflow-hidden shadow-md flex flex-col justify-between`}
                      >
                        <div>
                          <div className={`${t.headerBg} ${t.headerText} px-4 py-2 text-xs font-black uppercase tracking-wider`}>
                            {part.badge}
                          </div>
                          <div className="p-4">
                            <h4 className={`text-sm font-black ${t.titleColor} mb-2.5`}>
                              {part.title}
                            </h4>
                            <ul className="space-y-2 text-xs text-slate-700">
                              {part.rules.map((r, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <CheckCircle2 className={`w-4 h-4 ${t.bulletIconColor} shrink-0 mt-0.5`} />
                                  <span>{r}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                        <div className="px-4 pb-4">
                          <pre className={`border ${t.specBorder} ${t.specBg} rounded-xl p-2.5 text-[11px] font-mono ${t.specTextColor} whitespace-pre-wrap`}>
                            {part.sample}
                          </pre>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Phần B: Đặc tả 4 Engine Auto-Healing & Ô chọn Phiếu Trả Lời Trắc Nghiệm */}
              <div>
                <h3 className="text-base font-black text-slate-900 mb-3 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-rose-600" />
                  B. Đặc Tả 4 Engine Tự Động Chữa Lỗi (Auto-Healing) & Ô Tùy Chọn Phiếu Trả Lời Trắc Nghiệm
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {[
                    {
                      badge: 'AUTO-HEALING 4 ENGINES · KHUNG ĐỎ HỒNG NGỌC',
                      title: 'Cơ Chế Tự Động Bắt Lỗi & Sửa Đề Gốc Trước Khi Trộn',
                      items: [
                        'Engine 1 (Hình ảnh & Bảng biểu): Thu hồi ảnh trôi nổi (wp:anchor), ảnh dòng riêng, ảnh dưới 4 đáp án A/B/C/D, ảnh bảng 2 cột và giải mã WMF/EMF sang PNG 300 DPI. Gỡ bảng đè chữ (w:tblpPr) và cân bằng cột phương án 25% / 50%.',
                        'Engine 2 (Toán & Vật lý): Hàn gắn công thức bị cắt đôi (<m:oMath>), dịch MathType OLE (kèm fallback ảnh), bảo toàn vectơ (v⃗, a⃗, F⃗) và ký hiệu Ω, μ, λ, π, Δ, α, β, ω, ⊥, ∥.',
                        'Engine 3 & 4 (Hóa học, Sinh học & CSS): Tự nâng/hạ chỉ số Hóa học (H₂SO₄, Ca(OH)₂, Cu²⁺, SO₄²⁻, mũi tên →, ⇌, ↓, ↑), đóng gói phân số kiểu gen Sinh học (\\frac{AB}{ab}, XᴬXᵃ, ♂, ♀) và khóa khung ảnh/bảng bằng KaTeX + CSS Responsive.',
                      ],
                      theme: SYNCHRONIZED_THEMES[4], // Rose
                    },
                    {
                      badge: 'PHIẾU TRẢ LỜI & LƯU CHỈNH SỬA · KHUNG XANH CỔ VỊT',
                      title: 'Ô Tùy Chọn Phiếu Trả Lời Nổi Bật & Lưu Chỉnh Sửa Không Mất Dữ Liệu',
                      items: [
                        'Mặc định tích hợp sẵn 5 mẫu phiếu chuẩn: (1) QM 2025 40-8-6, (2) QM 40-16-12, (3) QM 30-20-00, (4) QM A4-40-Ngang 40-0-0, (5) QM Ôn tập TL Ngắn 0-0-10.',
                        'Cho phép giáo viên tự tải lên mẫu phiếu riêng (.pdf, .jpg, .png). Khi trộn đề, phiếu tùy chọn vẫn được tự động nhúng vào tất cả các mã đề Word giống hệt phiếu mặc định.',
                        'Tích hợp nút [Lưu câu này] ở từng câu hỏi và nút [Lưu Toàn Bộ Chỉnh Sửa] trên thanh công cụ; mặc định Thời gian làm bài 45 phút và Kỳ kiểm tra là "KIỂM TRA ÔN TẬP".',
                      ],
                      theme: SYNCHRONIZED_THEMES[5], // Teal
                    },
                  ].map((box) => {
                    const t = box.theme;
                    return (
                      <div
                        key={box.badge}
                        className={`border-2 ${t.frameBorder} ${t.frameBg} rounded-2xl overflow-hidden shadow-md flex flex-col justify-between`}
                      >
                        <div>
                          <div className={`${t.headerBg} ${t.headerText} px-4 py-2 text-xs font-black uppercase tracking-wider`}>
                            {box.badge}
                          </div>
                          <div className="p-4">
                            <h4 className={`text-sm font-black ${t.titleColor} mb-2.5`}>
                              {box.title}
                            </h4>
                            <ul className="space-y-2 text-xs text-slate-700">
                              {box.items.map((it, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                  <CheckCircle2 className={`w-4 h-4 ${t.bulletIconColor} shrink-0 mt-0.5`} />
                                  <span>{it}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Phần C: Đặc tả 3 Mã QR Chấm Thi Chuẩn Gốc 100% (3 Khung màu đồng bộ riêng) */}
              <div>
                <h3 className="text-base font-black text-slate-900 mb-3 flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-emerald-600" />
                  C. Đặc Tả Chuẩn Kỹ Thuật Bộ 3 Mã QR & 3 File Excel Chấm Thi (Hoạt Động 100% Không Lỗi)
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {[
                    {
                      app: '1. PHẦN MỀM QM 2025 · KHUNG XANH LAM',
                      title: 'Chuẩn Mã QR & Excel Cho App QM 2025',
                      desc: 'Tương thích hoàn toàn với tính năng "Quét QR Đáp Án" và "Nhập Excel" của phần mềm chấm thi QM 2025 trên iOS & Android.',
                      features: [
                        'Hỗ trợ cả chuỗi phân tách dấu gạch đứng (|) và cấu trúc JSON v:2025.',
                        'Phần II mã hóa đồng thời chuỗi ĐSĐS và TFTF cho 4 ý a, b, c, d.',
                        'File Excel .xlsx chuẩn cột: Mã đề | Câu/Ý | Phần thi | Đáp án chuẩn.',
                      ],
                      payloadSample: 'QM2025|CODE:101|P1:1A,2B...|P2:1DSDS...|P3:1=12,5',
                      theme: SYNCHRONIZED_THEMES[0], // Blue
                    },
                    {
                      app: '2. PHẦN MỀM TNMAKER · KHUNG XANH NGỌC',
                      title: 'Chuẩn Mã QR & Excel Cho App TNMaker',
                      desc: 'Tương thích 100% với mẫu phiếu THPT 2025 (3 phần) trên ứng dụng chấm trắc nghiệm TNMaker.',
                      features: [
                        'Chuẩn JSON TNMaker_2025 với đối tượng keys ánh xạ từng mã đề (101, 102, 103, 104).',
                        'Phần II tách rõ 4 mệnh đề Đ/S; Phần III chuẩn hóa dấu phẩy thập phân theo phiếu tô.',
                        'File Excel .xlsx bố trí các cột Mã đề 101, 102, 103, 104 song song.',
                      ],
                      payloadSample: '{"app":"TNMaker_2025","examCode":"101","P1":["A","C"],"P2":["ĐSĐS"],"P3":["12,5"]}',
                      theme: SYNCHRONIZED_THEMES[1], // Emerald
                    },
                    {
                      app: '3. PHẦN MỀM AZOTA · KHUNG VÀNG HỔ PHÁCH',
                      title: 'Chuẩn Mã QR & Excel Cho Nền Tảng Azota',
                      desc: 'Tương thích 100% với trình tạo đề và chấm phiếu giấy Form 2025 trên hệ thống Azota.',
                      features: [
                        'Chuẩn JSON AZOTA_2025 phân tách mảng MCQ (Phần I), TF (Phần II: a, b, c, d) và SA (Phần III).',
                        'Tự động đồng bộ cả dấu chấm (.) và dấu phẩy (,) cho đáp số trả lời ngắn.',
                        'File Excel .xlsx tách riêng từng dòng lệnh 1a, 1b, 1c, 1d chuẩn mẫu import Azota.',
                      ],
                      payloadSample: '{"platform":"AZOTA_2025","code":"101","MCQ":{"1":"A"},"TF":{"1":{"a":"Đ"}},"SA":{"1":"12.5"}}',
                      theme: SYNCHRONIZED_THEMES[3], // Amber
                    },
                  ].map((qrSpec) => {
                    const t = qrSpec.theme;
                    return (
                      <div
                        key={qrSpec.app}
                        className={`border-2 ${t.frameBorder} ${t.frameBg} rounded-2xl overflow-hidden shadow-md flex flex-col justify-between`}
                      >
                        <div>
                          <div className={`${t.headerBg} ${t.headerText} px-4 py-2 text-xs font-black uppercase tracking-wider`}>
                            {qrSpec.app}
                          </div>
                          <div className="p-4">
                            <h4 className={`text-sm font-black ${t.titleColor} mb-1.5`}>
                              {qrSpec.title}
                            </h4>
                            <p className="text-xs text-slate-600 mb-3 leading-relaxed">
                              {qrSpec.desc}
                            </p>
                            <ul className="space-y-2 text-xs text-slate-700">
                              {qrSpec.features.map((f, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <CheckCircle2 className={`w-4 h-4 ${t.bulletIconColor} shrink-0 mt-0.5`} />
                                  <span>{f}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                        <div className="px-4 pb-4">
                          <div className={`border ${t.specBorder} ${t.specBg} rounded-xl p-2.5`}>
                            <div className={`text-[10px] font-black uppercase ${t.specTitleColor} mb-1`}>
                              CẤU TRÚC PAYLOAD MẪU:
                            </div>
                            <code className={`text-[11px] font-mono ${t.specTextColor} break-all block`}>
                              {qrSpec.payloadSample}
                            </code>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              TAB 5: NHẬT KÝ NÂNG CẤP TỰ ĐỘNG (MỖI PHIÊN BẢN 1 KHUNG MÀU ĐỒNG BỘ)
             ===================================================================== */}
          {activeTab === 'AUTO_CHANGELOG' && (
            <div className="space-y-6">
              <div className="bg-white border-2 border-rose-400 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-base sm:text-lg font-black text-rose-950 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-rose-600" />
                    Nhật Ký Nâng Cấp Hệ Thống Tự Động (Auto-Sync Feature Registry)
                  </h3>
                  <p className="text-xs text-slate-600 mt-1">
                    Mỗi bản cập nhật tính năng đều được đóng khung viền màu đồng bộ riêng biệt và tự động xuất kèm khi tải file Word Hướng dẫn sử dụng.
                  </p>
                </div>
                <span className="text-xs font-black text-rose-700 bg-rose-50 border-2 border-rose-300 px-3.5 py-1.5 rounded-xl">
                  Đã kích hoạt: {features.length} mô-đun tính năng
                </span>
              </div>

              {/* Danh sách các tính năng trong Registry với khung màu luân phiên */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {features.map((item, idx) => {
                  const t = SYNCHRONIZED_THEMES[idx % SYNCHRONIZED_THEMES.length];
                  return (
                    <div
                      key={item.id}
                      className={`border-2 ${t.frameBorder} ${t.frameBg} rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between`}
                    >
                      <div>
                        <div className={`${t.headerBg} ${t.headerText} px-4 py-2 text-[11px] font-black uppercase tracking-wider flex items-center justify-between`}>
                          <span>
                            PHIÊN BẢN {item.version} · {item.category}
                          </span>
                          <span>{item.releaseDate}</span>
                        </div>
                        <div className="p-4">
                          <h4 className={`text-sm font-black ${t.titleColor} mb-1.5`}>
                            {item.title}
                          </h4>
                          <p className="text-xs text-slate-700 leading-relaxed">
                            {item.description}
                          </p>
                        </div>
                      </div>
                      {item.technicalSpec && (
                        <div className="px-4 pb-4">
                          <div className={`border ${t.specBorder} ${t.specBg} rounded-xl px-3 py-2 text-[11px] font-semibold ${t.specTextColor}`}>
                            <strong>Thông số:</strong> {item.technicalSpec}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Form đăng ký bổ sung tính năng mới */}
              <form
                onSubmit={handleAddFeature}
                className="bg-white border-2 border-indigo-400 rounded-2xl p-5 space-y-4 shadow-sm"
              >
                <div className="flex items-center gap-2 text-indigo-900 font-black text-sm">
                  <PlusCircle className="w-5 h-5 text-indigo-600" />
                  Bổ Sung Tính Năng Mới Vào Cẩm Nang Hướng Dẫn
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Tên tính năng mới *
                    </label>
                    <input
                      type="text"
                      required
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="VD: Nhận diện công thức Hóa học hữu cơ nâng cao..."
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Phiên bản & Phân nhóm
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newVersion}
                        onChange={(e) => setNewVersion(e.target.value)}
                        className="w-20 px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-mono"
                      />
                      <select
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value as FeatureReleaseItem['category'])}
                        className="flex-1 px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl"
                      >
                        <option value="QR_ENGINE">QR_ENGINE</option>
                        <option value="WORD_EXPORT">WORD_EXPORT</option>
                        <option value="CORE_PARSER">CORE_PARSER</option>
                        <option value="AUTO_LAYOUT">AUTO_LAYOUT</option>
                        <option value="LIVE_EDITOR">LIVE_EDITOR</option>
                        <option value="AI_ENGINE">AI_ENGINE</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Mô tả chi tiết tính năng & hướng dẫn *
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Nhập mô tả chi tiết cách hoạt động của tính năng..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-end justify-between gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Thông số kỹ thuật (Tùy chọn)
                    </label>
                    <input
                      type="text"
                      value={newTechSpec}
                      onChange={(e) => setNewTechSpec(e.target.value)}
                      placeholder="VD: OpenXML + KaTeX + QR Code ECC Level M"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl font-mono"
                    />
                  </div>

                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    Lưu Vào Hướng Dẫn
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Footer Modal */}
        <div className="bg-slate-100 border-t-2 border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-600 font-semibold">
            <HelpCircle className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              Mỗi tính năng được đóng khung có viền màu đồng bộ riêng biệt · Tương thích 100% QM 2025, TNMaker, Azota & Công văn 7991.
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleDownloadDocx}
              disabled={isExporting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Xuất File Word (.docx)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl transition-colors cursor-pointer"
            >
              Đã hiểu & Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
