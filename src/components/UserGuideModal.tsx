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
    title: 'Xuất 3 File Excel (.xlsx) Đáp Án Chuẩn Định Dạng QM 2025, TNMaker & Azota',
    subtitle: 'Nạp trực tiếp đáp án cả 3 phần vào ứng dụng chấm thi hoặc phần mềm quản lý điểm',
    icon: <FileSpreadsheet className="w-6 h-6" />,
    theme: SYNCHRONIZED_THEMES[1], // Emerald
    bullets: [
      {
        bold: '3 tệp Excel (.xlsx) chuyên biệt từng phần mềm',
        text: 'Hệ thống tự động xuất 3 file Excel riêng cho QM 2025, TNMaker và Azota để giáo viên import trực tiếp khi dùng tính năng "Nhập đáp án từ file Excel".',
      },
      {
        bold: 'Đầy đủ cả 3 phần thi chuẩn 2025',
        text: 'Bao gồm toàn bộ câu hỏi Phần I (A, B, C, D), Phần II (tách 4 ý a, b, c, d chuẩn Đ/S hoặc T/F) và Phần III (chuẩn hóa dấu phẩy/chấm thập phân tối đa 4 ký tự).',
      },
      {
        bold: 'Tải lẻ 1 chạm hoặc đóng gói tự động',
        text: 'Giáo viên có thể tải lẻ từng file Excel ngay tại bảng Mã QR hoặc tải trọn bộ trong thư mục File_Excel_Dap_An_Chuan_3_Phan_Mem của gói .zip.',
      },
    ],
    techSpecTitle: 'CẤU TRÚC OPENXML SPREADSHEET (.XLSX)',
    techSpecDetail:
      'Định dạng chuẩn Microsoft Excel .xlsx · Tự động chia cột theo Mã đề (101, 102, 103, 104...) · Tương thích 100% Excel 2010–2025 & Google Sheets.',
  },
  {
    code: 'TÍNH NĂNG 03 · KHUNG TÍM THẠCH ANH',
    group: 'CORE_STEM',
    groupLabel: 'Bóc Tách & Công Thức',
    title: 'Bộ Vi Xử Lý Bóc Tách Đa Tầng 4 Phần (Trắc Nghiệm & Phần IV Tự Luận Thông Minh)',
    subtitle: 'Đọc sâu cấu trúc XML của file Word (.docx, .doc), giữ nguyên Phần Tự Luận & tự động đánh số phần linh hoạt',
    icon: <Cpu className="w-6 h-6" />,
    theme: SYNCHRONIZED_THEMES[2], // Violet
    bullets: [
      {
        bold: '3 kênh nhận diện đáp án đúng thông minh',
        text: 'Tự động phát hiện phương án đúng thông qua: (1) Gạch chân (<w:u>), (2) Tô chữ màu đỏ (<w:color>), hoặc (3) Bảng đáp án tổng hợp đặt ở cuối đề thi.',
      },
      {
        bold: 'Hỗ trợ Phần IV Tự Luận (Giữ nguyên câu hỏi — Không trộn)',
        text: 'Tiếp nhận và giữ nguyên thứ tự các câu hỏi Phần IV. Tự luận ở mọi mã đề. Nếu đề gốc không có Phần III (câu hỏi trả lời ngắn), khi xuất đề hệ thống tự động trình bày theo thứ tự: PHẦN I, PHẦN II, PHẦN III. Tự luận.',
      },
      {
        bold: 'Tích hợp thông minh Tự Luận vào Bảng Đáp Án',
        text: 'Trong phần đáp án xuất ra: nếu câu tự luận có sẵn đáp án/lời giải sẽ tự động tích hợp vào; nếu chưa có đáp án thì phần đáp án vẫn hiển thị nguyên vẹn câu hỏi tự luận (không đóng khung bảng) để giáo viên dễ dàng chỉnh sửa.',
      },
    ],
    techSpecTitle: 'CƠ CHẾ BÓC TÁCH AST & OPENXML 4 PHẦN',
    techSpecDetail:
      'Quét đồng thời Phần I, II, III và Phần IV (Tự luận) · Tự động co giãn tiêu đề PHẦN III / PHẦN IV · Bảo toàn câu hỏi tự luận trong Bảng đáp án.',
  },
  {
    code: 'TÍNH NĂNG 04 · KHUNG VÀNG HỔ PHÁCH',
    group: 'CORE_STEM',
    groupLabel: 'Bóc Tách & Công Thức',
    title: 'Bộ Hiển Thị & Bảo Toàn Công Thức Toán - Lý - Hóa - Sinh Đa Tầng',
    subtitle: 'Xử lý triệt để công thức LaTeX, Office Math, chỉ số hóa học và ký hiệu di truyền',
    icon: <FlaskConical className="w-6 h-6" />,
    theme: SYNCHRONIZED_THEMES[3], // Amber
    bullets: [
      {
        bold: 'Toán học & Vật lý',
        text: 'Hiển thị sắc nét phân số, căn thức, tích phân, giới hạn, vectơ, hệ phương trình, ma trận, độ C (°C), bước sóng (λ), tần số góc (ω) bằng bộ dựng KaTeX & OMML.',
      },
      {
        bold: 'Hóa học chuyên sâu',
        text: 'Bảo toàn 100% chỉ số dưới (H₂SO₄, C₆H₁₂O₆), điện tích ion chỉ số trên (Fe³⁺, SO₄²⁻, Cu²⁺) và các mũi tên phản ứng hóa học một chiều/thuận nghịch có điều kiện nhiệt độ, xúc tác.',
      },
      {
        bold: 'Sinh học & Di truyền học',
        text: 'Hiển thị chuẩn xác kiểu gene (AaBbDd), liên kết giới tính (XᴬXᵃ, XᵃY), cấu trúc mạch DNA (3’ → 5’, 5’ → 3’), phép lai Mendel và chuỗi thức ăn sinh thái.',
      },
    ],
    techSpecTitle: 'ĐỘNG CƠ DỰNG CÔNG THỨC KÉP (DUAL MATH ENGINE)',
    techSpecDetail:
      'KaTeX HTML/MathML Renderer trên giao diện + Bộ chuyển đổi Subscript/Superscript (<w:vertAlign>) & Office Math khi xuất file Word.',
  },
  {
    code: 'TÍNH NĂNG 05 · KHUNG ĐỎ HỒNG NGỌC',
    group: 'CORE_STEM',
    groupLabel: 'Bóc Tách & Công Thức',
    title: 'Động Cơ Xử Lý Hình Ảnh, Sơ Đồ Phả Hệ, Đồ Thị 300 DPI Không Mất Ảnh Khi Trộn',
    subtitle: 'Bảo toàn 100% hình vẽ theo đúng câu hỏi khi hoán vị sang mọi mã đề 101, 102, 103, 104',
    icon: <ImageIcon className="w-6 h-6" />,
    theme: SYNCHRONIZED_THEMES[4], // Rose
    bullets: [
      {
        bold: 'Không bao giờ mất ảnh khi trộn đề',
        text: 'Mỗi hình ảnh, đồ thị hàm số, hình chóp không gian, mạch điện hay sơ đồ phả hệ được gắn định danh [HINH_ANH_CAU_X] và sao chép sâu (Deep Clone) đi kèm câu hỏi đó sang mọi mã đề.',
      },
      {
        bold: 'Tự động làm nét & Khử nền xám bản chụp',
        text: 'Thuật toán xử lý ảnh 300 DPI tự động cân bằng trắng, xóa nền xám của ảnh chụp điện thoại và giữ nguyên tỷ lệ khung hình (Aspect Ratio) gốc.',
      },
      {
        bold: 'Khóa liền kề câu hỏi trong Word',
        text: 'Xuất ảnh ở chế độ In Line with Text (<wp:inline>), tự động căn giữa trang và khóa <w:keepNext/> để hình vẽ không bị trôi sang trang khác.',
      },
    ],
    techSpecTitle: 'CHUẨN ĐỒ HỌA OPENXML DRAWINGML',
    techSpecDetail:
      'Hỗ trợ PNG, JPEG, SVG Vector 300 DPI · Tự động đóng gói vào word/media/ và khai báo Relationship rId riêng biệt cho từng mã đề.',
  },
  {
    code: 'TÍNH NĂNG 06 · KHUNG XANH CỔ VỊT',
    group: 'EDITOR_AI',
    groupLabel: 'Biên Tập & AI Gemini',
    title: 'Trình Biên Tập Trực Tiếp (Live In-App Editor) & Tự Động Sửa Lỗi 1 Chạm',
    subtitle: 'Kiểm tra lỗi toàn diện và sửa đáp án ngay trên trình duyệt trong 1 giây',
    icon: <FileCheck2 className="w-6 h-6" />,
    theme: SYNCHRONIZED_THEMES[5], // Teal
    bullets: [
      {
        bold: 'Quét lỗi tự động thời gian thực',
        text: 'Phát hiện ngay lập tức câu thiếu đáp án đúng, câu có nhiều hơn 1 đáp án đúng, câu Phần II thiếu ý a/b/c/d hoặc câu Phần III chưa điền đáp số.',
      },
      {
        bold: 'Nút "Sửa ngay" cuộn thẳng tới câu lỗi',
        text: 'Bấm vào thông báo lỗi sẽ cuộn màn hình đến đúng câu hỏi đó, tự động mở khung biên tập để thầy cô chọn đáp án A/B/C/D hoặc gạt Đúng/Sai chỉ bằng 1 cú nhấp chuột.',
      },
      {
        bold: 'Nút "Tự Động Sửa Nhanh Tất Cả Lỗi"',
        text: 'Tự động chuẩn hóa toàn bộ các câu chưa gán đáp án trong đề chỉ bằng 1 chạm duy nhất, giúp mở khóa nút [Trộn Đề Ngay] tức thì.',
      },
    ],
    techSpecTitle: 'BỘ KIỂM ĐỊNH ĐỀ THI (REALTIME VALIDATOR)',
    techSpecDetail:
      'Đồng bộ cây dữ liệu câu hỏi tức thời · Hỗ trợ thêm/xóa hình ảnh minh họa cho từng câu và khóa cố định vị trí câu không muốn đảo.',
  },
  {
    code: 'TÍNH NĂNG 07 · KHUNG XANH CHÀM SÂU',
    group: 'EDITOR_AI',
    groupLabel: 'Biên Tập & AI Gemini',
    title: 'Khung Chỉnh Sửa Văn Bản Word Gốc & Dán Nhanh Trực Tiếp (Clipboard HTML)',
    subtitle: 'Sửa trực tiếp toàn bộ văn bản đề thi hoặc dán nhanh Ctrl+V từ Microsoft Word',
    icon: <ClipboardPaste className="w-6 h-6" />,
    theme: SYNCHRONIZED_THEMES[6], // Indigo
    bullets: [
      {
        bold: 'Dán trực tiếp từ Word (Ctrl+V)',
        text: 'Không cần lưu thành file, thầy cô có thể bôi đen đề thi trong Microsoft Word rồi dán thẳng vào hệ thống; định dạng gạch chân và chữ đỏ vẫn được giữ nguyên 100%.',
      },
      {
        bold: 'Chỉnh sửa văn bản nguồn toàn đề',
        text: 'Cung cấp cửa sổ chỉnh sửa văn bản Word gốc ngay trên ứng dụng để giáo viên sửa nhanh hàng loạt câu hỏi, thêm câu mới hoặc dán bổ sung bảng đáp án.',
      },
      {
        bold: 'Biên dịch lại tức thì',
        text: 'Ngay khi bấm "Cập nhật nội dung", hệ thống tự động phân tích lại toàn bộ câu hỏi và giữ nguyên các hình ảnh đã gắn trước đó.',
      },
    ],
    techSpecTitle: 'BỘ PHÂN TÍCH CLIPBOARD RICH-TEXT',
    techSpecDetail:
      'Đọc đồng thời kênh text/html và text/plain từ Clipboard · Tự động chuyển đổi thẻ <u>, <span style="color:red"> sang đáp án đúng.',
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
        text: 'Tạo đồng thời 4 mã đề tương đương (Đề AI 201, 202, 203, 204) với câu chữ và số liệu mới hoàn toàn nhưng giữ nguyên 100% dạng toán, mức độ nhận thức và cấu trúc 3 phần.',
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
      'Tự động co giãn độ rộng cột (<w:tblLayout w:type="autofit"/>) vừa khít khổ giấy A4 kèm khung chữ ký Cán bộ chấm thi.',
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
        bold: 'Đề mẫu Kiểm tra Cuối HK1 Sinh học 12 (28 câu chuẩn 18-4-6)',
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
    title: 'Đóng Gói Trọn Bộ (.zip) Đồng Nhất Quy Chuẩn Đặt Tên Tệp Khảo Thí',
    subtitle: 'Đồng bộ tên file nén và toàn bộ tệp bên trong theo chuẩn quản lý hồ sơ chuyên môn',
    icon: <Download className="w-6 h-6" />,
    theme: SYNCHRONIZED_THEMES[11], // Cyan
    bullets: [
      {
        bold: 'Quy chuẩn đặt tên tự động đồng nhất',
        text: 'Tự động đặt tên theo cấu trúc: Môn [Tên môn] - Lớp [Lớp] - Kỳ kiểm tra [Kỳ] - [dd-mm-yy] - [Hậu tố].docx/.xlsx/.png/.zip cho mọi tệp xuất ra.',
      },
      {
        bold: 'Đầy đủ 6 thành phần trong 1 lần tải (.zip)',
        text: 'Gồm: (1) Thư mục các mã đề học sinh, (2) Đề gốc chuẩn, (3) Bảng đáp án ma trận A4 nhúng 3 mã QR, (4) Ma trận & Đặc tả CV 7991, (5) Thư mục ảnh QR 3 phần mềm, (6) Thư mục 3 file Excel .xlsx.',
      },
      {
        bold: 'Định dạng Word chuẩn in ấn nhà trường',
        text: 'Font Times New Roman 12pt đồng bộ, bảng chia cột phương án A/B/C/D ẩn viền tự động căn chỉnh và đánh số trang "Trang X/Y - Mã đề Z" ở chân trang.',
      },
    ],
    techSpecTitle: 'CẤU TRÚC GÓI KHẢO THÍ TOÀN DIỆN (.ZIP)',
    techSpecDetail:
      'Ví dụ tên tệp: Môn Sinh học - Lớp 12 - Kỳ kiểm tra Cuối học kì 1 - 30-10-26 - Mã đề 101.docx.',
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
  const [newVersion, setNewVersion] = useState('v4.1.0');
  const [newCategory, setNewCategory] = useState<FeatureReleaseItem['category']>('QR_ENGINE');
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
1. Tiếp nhận đa định dạng: Word (.docx, .doc), PDF, bản chụp/scan 300 DPI, ảnh sơ đồ đồ thị và dán trực tiếp từ bộ nhớ tạm (HTML Clipboard).
2. Bảo toàn 100% công thức & hình ảnh: Chống nuốt chữ, chống rỗng đáp án. Bảo toàn công thức Toán - Lý - Hóa (chỉ số trên/dưới, mũi tên phản ứng) - Sinh (phả hệ, phép lai, DNA) và giữ nguyên 100% hình ảnh khi trộn đề.
3. Chuẩn hóa đầu ra khảo thí: Xuất tệp Word (.docx) chuẩn Times New Roman 12pt, Bảng đáp án ma trận A4 gọn 1 trang, Ma trận & Bản đặc tả chuẩn Công văn 7991/BGDĐT-GDTrH.
4. Tương thích 100% 3 phần mềm chấm thi: Tạo đồng thời 3 mã QR và 3 file Excel (.xlsx) chuẩn định dạng gốc cho QM 2025, TNMaker và Azota.

II. TỔNG HỢP 12 TÍNH NĂNG ĐỘT PHÁ (MỖI TÍNH NĂNG 1 KHUNG MÀU ĐỒNG BỘ)
${featureLines}

III. QUY TRÌNH HƯỚNG DẪN SỬ DỤNG 6 BƯỚC THỰC CHIẾN
- Bước 1: Chuẩn bị file Word đề gốc (.docx/.doc), PDF hoặc chọn 1 trong 2 Đề mẫu chuẩn 2025 (Sinh học 12 Cuối HK1 / Đề Tổng hợp KHTN).
- Bước 2: Tải đề lên hệ thống hoặc dán trực tiếp nội dung từ Word (Ctrl+V).
- Bước 3: Kiểm tra cảnh báo lỗi và bấm [Tự Động Sửa Nhanh Tất Cả Lỗi] hoặc sửa từng câu trực tiếp trên giao diện.
- Bước 4: (Tùy chọn) Mở AI Gemini Studio để nhân bản cùng lúc 4 đề tương đương mới.
- Bước 5: Cấu hình thông tin trường, môn, lớp, số lượng mã đề (101, 102, 103, 104...) và bấm [Trộn Đề Ngay].
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
      version: newVersion.trim() || 'v4.1.0',
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
            4. Chuẩn Đề 2025 & Chuẩn 3 Mã QR (QM · TNMaker · Azota)
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
                    Toàn bộ 12 tính năng từ Bóc tách công thức Toán-Lý-Hóa-Sinh, Giữ nguyên hình ảnh 300 DPI, AI Gemini 4 luồng, Ma trận CV 7991 đến Bộ 3 Mã QR & 3 File Excel chấm thi (QM 2025 · TNMaker · Azota).
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
                    3 Mã QR & Excel (2)
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
                    Công Thức & Ảnh 300 DPI (4)
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
                    Biên Tập & AI (3)
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
                        Hệ Thống Chuyên Gia Xử Lý, Biên Tập & Trộn Đề Thi Chuẩn 2025
                      </h3>
                      <p className="text-xs text-blue-200 mt-0.5">
                        Tác giả phát triển: <strong className="text-white">Thầy Hồ Tấn Khải</strong> · Email: khaibcmt@gmail.com · ĐT/Zalo: 0939580982
                      </p>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-blue-100 leading-relaxed">
                  Được thiết kế với vai trò là <strong className="text-amber-300">Chuyên gia Sư phạm & Chuyên gia AI Khảo thí</strong>, hệ thống giải quyết triệt để mọi vấn đề mất công thức Toán - Lý - Hóa - Sinh, mất hình ảnh sơ đồ khi trộn đề, tự động hóa việc lập Ma trận & Bản đặc tả theo Công văn 7991/BGDĐT-GDTrH và tạo bộ 3 mã QR chấm thi chuẩn xác 100% cho QM 2025, TNMaker, Azota.
                </p>
              </div>

              {/* 6 Nguyên tắc cốt lõi — Mỗi nguyên tắc 1 khung viền màu đồng bộ khác nhau */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {[
                  {
                    num: 'NGUYÊN TẮC 01',
                    title: 'Tiếp Nhận Đa Định Dạng Đầu Vào',
                    desc: 'Đọc trực tiếp tệp Word (.docx, .doc), PDF, ảnh chụp/scan đề thi 300 DPI, ảnh sơ đồ đồ thị và hỗ trợ dán trực tiếp từ bộ nhớ tạm (Ctrl+V từ Word) mà không cần chuyển đổi thủ công.',
                    spec: 'Hỗ trợ .docx, .doc, .pdf, .png, .jpg & HTML Clipboard.',
                    theme: SYNCHRONIZED_THEMES[0], // Blue
                    icon: <FileText className="w-5 h-5" />,
                  },
                  {
                    num: 'NGUYÊN TẮC 02',
                    title: 'Bảo Toàn 100% Công Thức Toán - Lý - Hóa - Sinh',
                    desc: 'Chống nuốt chữ, chống rỗng phương án. Giữ nguyên phân số, tích phân, vectơ, chỉ số hóa học trên/dưới (H₂SO₄, Fe³⁺), mũi tên phản ứng và ký hiệu di truyền sinh học (AaBb, XᴬXᵃ).',
                    spec: 'KaTeX + Office Math (<m:oMath>) + Sub/Superscript.',
                    theme: SYNCHRONIZED_THEMES[1], // Emerald
                    icon: <FlaskConical className="w-5 h-5" />,
                  },
                  {
                    num: 'NGUYÊN TẮC 03',
                    title: 'Giữ Nguyên Hình Ảnh, Bảng Biểu & Phả Hệ Khi Trộn',
                    desc: 'Mọi hình vẽ, đồ thị hàm số, hình không gian và sơ đồ phả hệ được gắn kết chặt chẽ với câu hỏi gốc và sao chép nguyên vẹn sang tất cả các mã đề 101, 102, 103, 104.',
                    spec: 'Deep Clone Media + Khóa liền kề <w:keepNext/>.',
                    theme: SYNCHRONIZED_THEMES[4], // Rose
                    icon: <ImageIcon className="w-5 h-5" />,
                  },
                  {
                    num: 'NGUYÊN TẮC 04',
                    title: 'Tương Thích 100% Với 3 App Chấm Thi Điện Thoại',
                    desc: 'Tạo 3 mã QR độc lập và 3 file Excel (.xlsx) đúng chuẩn định dạng gốc của QM 2025, TNMaker và Azota. Quét 1 lần nhận đủ đáp án cả 3 phần không bao giờ báo lỗi.',
                    spec: 'Chuẩn JSON/String gốc QM 2025 · TNMaker · Azota.',
                    theme: SYNCHRONIZED_THEMES[2], // Violet
                    icon: <QrCode className="w-5 h-5" />,
                  },
                  {
                    num: 'NGUYÊN TẮC 05',
                    title: 'Chuẩn Hóa Công Văn 7991 & Bảng Đáp Án Gọn 1 Trang',
                    desc: 'Tự động xây dựng Khung ma trận (40% NB - 30% TH - 30% VD) và Bản đặc tả theo CV 7991. Bảng đáp án đối chiếu ngang nhiều mã đề giúp tiết kiệm 70% giấy in và không rối mắt.',
                    spec: 'Phụ lục 1 & 2 CV 7991 + Ma trận đối chiếu A4.',
                    theme: SYNCHRONIZED_THEMES[3], // Amber
                    icon: <LayoutGrid className="w-5 h-5" />,
                  },
                  {
                    num: 'NGUYÊN TẮC 06',
                    title: 'Bảo Mật Đề Thi Tuyệt Đối (Client-Side Zero-Trace)',
                    desc: 'Toàn bộ quá trình đọc file, sửa lỗi và trộn đề diễn ra trực tiếp trên trình duyệt máy tính của giáo viên. Không lưu trữ đề thi lên máy chủ, bảo mật tuyệt đối kỳ kiểm tra.',
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
                  Chỉ với 6 bước đơn giản từ lúc nạp đề gốc đến khi xuất trọn bộ đề hoán vị, bảng đáp án ma trận, bản đặc tả CV 7991 và 3 mã QR chấm thi.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {[
                  {
                    step: 'BƯỚC 01 · KHUNG XANH LAM',
                    title: 'Chuẩn Bị Đề Gốc Hoặc Chọn Kho Đề Mẫu Chuẩn 2025',
                    desc: 'Soạn đề thi theo 3 phần (PHẦN I, PHẦN II, PHẦN III). Đánh dấu đáp án đúng bằng cách Gạch chân (Ctrl+U), Tô chữ màu đỏ hoặc đặt Bảng đáp án ở cuối đề. Hoặc bấm chọn ngay "Đề Mẫu Sinh Học 12 Cuối HK1" / "Đề Mẫu Tổng Hợp Toán-Lý-Hóa-Sinh" có sẵn trên thanh công cụ.',
                    tip: 'Mẹo: Có thể dùng cả file Word (.docx, .doc) lẫn bản PDF hoặc ảnh chụp đề thi.',
                    theme: SYNCHRONIZED_THEMES[0], // Blue
                  },
                  {
                    step: 'BƯỚC 02 · KHUNG XANH NGỌC LỤC BẢO',
                    title: 'Tải Đề Lên Hệ Thống Hoặc Dán Nhanh Từ Word (Ctrl+V)',
                    desc: 'Bấm nút [Tải Word / PDF] trên thanh công cụ hoặc kéo thả tệp vào màn hình. Ngoài ra, thầy cô có thể bấm nút [Sửa / Dán Văn Bản Word Gốc] để dán trực tiếp nội dung vừa copy từ Microsoft Word.',
                    tip: 'Mẹo: Hệ thống tự động bóc tách câu hỏi, công thức và hình ảnh chỉ trong 1–2 giây.',
                    theme: SYNCHRONIZED_THEMES[1], // Emerald
                  },
                  {
                    step: 'BƯỚC 03 · KHUNG VÀNG HỔ PHÁCH',
                    title: 'Kiểm Tra & Bấm "Tự Động Sửa Nhanh Tất Cả Lỗi" 1 Chạm',
                    desc: 'Nếu đề gốc có câu quên gạch chân đáp án, bảng cảnh báo sẽ liệt kê chi tiết. Thầy cô bấm [Sửa ngay] để chọn đáp án cho từng câu hoặc bấm nút [Tự Động Sửa Nhanh Tất Cả Lỗi] để hệ thống chuẩn hóa toàn bộ đề tức thì.',
                    tip: 'Mẹo: Có thể nhấp vào bất kỳ câu hỏi nào để sửa nội dung, công thức hoặc chèn thêm hình ảnh.',
                    theme: SYNCHRONIZED_THEMES[3], // Amber
                  },
                  {
                    step: 'BƯỚC 04 · KHUNG HỒNG TÍM AI',
                    title: '(Tùy Chọn) Nhân Bản 4 Đề Tương Đương Bằng AI Gemini Studio',
                    desc: 'Nếu muốn tạo thêm bộ đề mới cho ca thi khác hoặc đề ôn tập tương đương, mở khung "AI Gemini Studio — Tạo Đề Tương Đương", chọn tạo 4 đề cùng lúc và bấm thực thi. Có thể nạp thẳng đề AI vừa tạo vào bộ trộn đề.',
                    tip: 'Mẹo: Có thể ghi chú yêu cầu riêng như "Cho số liệu chẵn dễ tính" để AI tuân thủ.',
                    theme: SYNCHRONIZED_THEMES[7], // Fuchsia
                  },
                  {
                    step: 'BƯỚC 05 · KHUNG TÍM THẠCH ANH',
                    title: 'Thiết Lập Thông Tin Kỳ Kiểm Tra & Bấm "Trộn Đề Ngay"',
                    desc: 'Tại cột cấu hình bên trái, nhập Tên đơn vị (Sở GD&ĐT Vĩnh Long - Trường THPT Mang Thít), Môn học, Khối lớp, Kỳ kiểm tra, Thời gian làm bài, chọn số lượng mã đề (4, 6, 8... mã đề) rồi bấm nút [Trộn Đề Ngay].',
                    tip: 'Mẹo: Tên Môn, Lớp, Kỳ kiểm tra sẽ được dùng để đặt tên đồng nhất cho toàn bộ file xuất ra.',
                    theme: SYNCHRONIZED_THEMES[2], // Violet
                  },
                  {
                    step: 'BƯỚC 06 · KHUNG ĐỎ HỒNG NGỌC',
                    title: 'Quét Bộ 3 Mã QR (QM · TNMaker · Azota) & Tải Trọn Bộ (.zip)',
                    desc: 'Sau khi trộn xong: (1) Mở Bảng Đáp Án để xem Ma trận đối chiếu gọn 1 trang và quét trực tiếp 3 Mã QR hoặc tải 3 file Excel (.xlsx), (2) Xem & tải file Word Ma trận Đặc tả CV 7991, (3) Bấm [Tải Bộ Đề (.zip)] để nhận trọn gói.',
                    tip: 'Mẹo: Gói .zip đã chứa sẵn các đề Word, Bảng đáp án, Ma trận 7991, 3 ảnh QR và 3 file Excel.',
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
              TAB 4: CHUẨN ĐỀ 2025 & ĐẶC TẢ 3 MÃ QR (QM 2025 · TNMAKER · AZOTA)
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
                        'Đánh dấu đáp án đúng bằng Gạch chân (Ctrl+U), Tô màu đỏ hoặc ghi ở bảng đáp án cuối đề.',
                        'Điểm chuẩn CV 7991: 0,25 điểm/câu (18 câu = 4,5 điểm).',
                      ],
                      sample: 'Câu 1. Đơn vị cấu tạo của DNA là?\nA. Amino acid.   B. Nucleotide (Gạch chân)',
                      theme: SYNCHRONIZED_THEMES[0], // Blue
                    },
                    {
                      badge: 'PHẦN II · KHUNG TÍM THẠCH ANH',
                      title: 'Trắc Nghiệm Đúng / Sai (4 Ý a, b, c, d)',
                      rules: [
                        'Mỗi câu có phần dẫn và 4 mệnh đề nhỏ ký hiệu a), b), c), d).',
                        'Mệnh đề nào ĐÚNG thì Gạch chân hoặc Tô đỏ (hoặc ghi chữ Đ/Đúng ở cuối mệnh đề); mệnh đề không đánh dấu tự động nhận là SAI.',
                        'Điểm chuẩn CV 7991: 1,0 điểm/câu (4 câu = 16 lệnh = 4,0 điểm).',
                      ],
                      sample: 'a) Mạch mới tổng hợp chiều 5’→3’. (Gạch chân = ĐÚNG)\nb) Enzyme tháo xoắn là DNA polymerase. (= SAI)',
                      theme: SYNCHRONIZED_THEMES[2], // Violet
                    },
                    {
                      badge: 'PHẦN III · KHUNG XANH NGỌC LỤC BẢO',
                      title: 'Trắc Nghiệm Trả Lời Ngắn (Điền Đáp Số)',
                      rules: [
                        'Câu hỏi tính toán yêu cầu học sinh tô/điền con số (tối đa 4 ký tự bao gồm dấu âm - và dấu phẩy ,).',
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
                        'Nếu câu tự luận có sẵn "Đáp án:" / "Lời giải:" thì tự động tích hợp vào bảng đáp án; nếu không có đáp án thì bảng đáp án vẫn giữ nguyên câu hỏi tự luận (không có thuộc tính bảng) để giáo viên dễ dàng chỉnh sửa.',
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

              {/* Phần B: Đặc tả 3 Mã QR Chấm Thi Chuẩn Gốc 100% (3 Khung màu đồng bộ riêng) */}
              <div>
                <h3 className="text-base font-black text-slate-900 mb-3 flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-emerald-600" />
                  B. Đặc Tả Chuẩn Kỹ Thuật Bộ 3 Mã QR & 3 File Excel Chấm Thi (Hoạt Động 100% Không Lỗi)
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
