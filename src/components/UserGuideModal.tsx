import React, { useState } from 'react';
import {
  Award,
  BookOpen,
  Bot,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Cpu,
  Download,
  FileCheck2,
  FileCode,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  HelpCircle,
  Image as ImageIcon,
  Key,
  Layers,
  LayoutGrid,
  PlusCircle,
  QrCode,
  Save,
  ShieldCheck,
  Shuffle,
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

export const UserGuideModal: React.FC<UserGuideModalProps> = ({
  isOpen,
  onClose,
  features,
  onRegisterNewFeature,
}) => {
  const [activeTab, setActiveTab] = useState<GuideTab>('ROLES');
  const [isExporting, setIsExporting] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // State form đăng ký tính năng mới
  const [newTitle, setNewTitle] = useState('');
  const [newVersion, setNewVersion] = useState('v2.6.0');
  const [newCategory, setNewCategory] = useState<FeatureReleaseItem['category']>('AUTO_LAYOUT');
  const [newDesc, setNewDesc] = useState('');
  const [newTechSpec, setNewTechSpec] = useState('');

  if (!isOpen) return null;

  const handleDownloadDocx = async () => {
    setIsExporting(true);
    try {
      const blob = await exportUserManualDocx(features);
      triggerBrowserDownload(blob, 'Huong_Dan_Su_Dung_He_Thong_EduMix_2025.docx');
    } catch (err) {
      console.error('Lỗi xuất tài liệu hướng dẫn Word:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyText = () => {
    const fullText = `TÀI LIỆU HƯỚNG DẪN SỬ DỤNG & ĐẶC TẢ TÍNH NĂNG HỆ THỐNG EDUMIX 2025
Tác giả: Thầy Hồ Tấn Khải — Giáo viên Trường THPT Mang Thít, Sở GD&ĐT Vĩnh Long
Liên hệ: Email: khaibcmt@gmail.com | Zalo: 0939580982

I. VAI TRÒ VÀ NGUYÊN TẮC HOẠT ĐỘNG
- Hệ thống xử lý, phân tích, biên tập và chuẩn hóa tài liệu đề thi chuyên sâu cấp độ cao (Deep Exam Parser & Word XML Synthesizer).
- Tiếp nhận đa định dạng: Word (.docx, .doc), PDF, bản chụp/scan, ảnh sơ đồ đồ thị và HTML Clipboard.
- Chống nuốt chữ, chống rỗng đáp án (Strict Non-Empty Rule). Bảo toàn 100% biểu thức Toán học, Vật lý, Hóa học (chỉ số trên/dưới, mũi tên phản ứng có điều kiện) và Sinh học (phả hệ, phép lai, chuỗi thức ăn).
- Xuất tệp Word (.docx) chuẩn khảo thí font Times New Roman 12pt, căn trái đều, bảng ẩn không viền chống xô lệch, đánh số trang và số mã đề tự động.
- Vận hành 100% Client-side trên trình duyệt máy tính giáo viên, cam kết bảo mật Zero-Trace không lưu trữ đề thi lên server.

II. TỔNG QUAN 8 TÍNH NĂNG VÀ CÔNG NGHỆ ĐỘT PHÁ
1. Bộ vi xử lý bóc tách đa tầng (Deep Exam Parser): Quét song song thẻ <w:t>, công thức <m:oMath>, MathType OLE và ảnh vector EMF/WMF. Nhận diện đáp án đúng bằng cả 3 cách: Gạch chân, Tô đỏ, Bảng đáp án cuối đề.
2. Trình biên tập trực tiếp 1 chạm (Live In-App Editor): Tự động phát hiện câu lỗi, nút "Sửa ngay" cuộn thẳng đến câu lỗi, nút "Tự động sửa nhanh tất cả lỗi" giúp chuẩn hóa tức thì.
3. Động cơ xử lý hình ảnh 300 DPI: Khử sạch nền xám bản scan thành nền trắng tinh khiết, giữ nguyên tỷ lệ aspect ratio, gắn thẻ [HINH_ANH_CAU_X] khóa liền kề In Line with Text trong Word.
4. AI Gemini Studio (Cụm 4 luồng chuyên gia): Chạy song song tạo cùng lúc 1-4 bộ đề tương đương; tùy biến số liệu, đảo câu Đúng/Sai theo chỉ dẫn giáo viên; bảo mật ẩn danh Zero-Trace.
5. Ma trận & Bản đặc tả chuẩn Công văn 7991/BGDĐT-GDTrH: Tự động phân chia Phụ lục 1 (Khung ma trận tỉ lệ 40%-30%-30%) và Phụ lục 2 (Bản đặc tả Yêu cầu cần đạt chuẩn GDPT 2018), xuất file Word riêng kèm khung duyệt ký BGH.
6. Bảng ma trận đối chiếu đa mã đề: Xếp các mã đề (101, 102, 103, 104...) song song theo cột, gọn trên 1 trang giấy duy nhất, tiết kiệm 70% diện tích, chống rối mắt khi chấm thi.
7. Mã QR Tổng hợp Đa Mã Đề (Master Multi-Exam QR Code): Tích hợp key chấm thi của toàn bộ mã đề vào 1 mã QR duy nhất, quét 1 lần nạp đủ tất cả mã đề trên điện thoại (QM, Azota, TNMaker); tự động nhúng vào trang cuối Word.
8. Đóng gói tệp nén (.zip) đồng nhất quy chuẩn tên file: Đồng bộ cú pháp đặt tên theo chuẩn: Môn [Tên môn] - Lớp [Lớp] - Kỳ kiểm tra [Kỳ] - [dd-mm-yy] [Hậu tố].docx/.zip.

III. QUY TRÌNH HƯỚNG DẪN 5 BƯỚC THỰC HIỆN
- Bước 1: Soạn file Word đề gốc (đánh dấu đáp án đúng bằng Gạch chân Ctrl+U hoặc Tô màu đỏ).
- Bước 2: Bấm nút [Tải Word / PDF] để nạp đề vào hệ thống.
- Bước 3: Xem cảnh báo, bấm [Sửa ngay] hoặc [Tự Động Sửa Nhanh Tất Cả Lỗi].
- Bước 4: Nhập thông tin trường, môn thi, chọn số lượng mã đề và bấm [Trộn Đề Ngay].
- Bước 5: Bấm [Tải Trọn Bộ 4 Đề (.zip)] để tải toàn bộ đề thi, bảng ma trận đối chiếu, mã QR và bản đặc tả CV 7991.`;

    navigator.clipboard.writeText(fullText);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 3000);
  };

  const handleAddFeature = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDesc.trim()) return;

    const item: FeatureReleaseItem = {
      id: `feat-custom-${Date.now()}`,
      version: newVersion.trim() || 'v2.6.0',
      releaseDate: new Date().toISOString().slice(0, 10),
      title: newTitle.trim(),
      category: newCategory,
      description: newDesc.trim(),
      technicalSpec:
        newTechSpec.trim() ||
        'Tự động đồng bộ vào Pipeline Client-side và cập nhật tài liệu hướng dẫn.',
      autoDetected: true,
    };

    onRegisterNewFeature(item);
    setNewTitle('');
    setNewDesc('');
    setNewTechSpec('');
  };

  const featureCardStyles = [
    {
      cardClass: 'guide-card-3d-blue',
      badgeClass: 'btn-3d-primary',
      titleColor: 'text-blue-950',
      specBox: 'bg-blue-50 border-blue-300 text-blue-900',
    },
    {
      cardClass: 'guide-card-3d-emerald',
      badgeClass: 'btn-3d-emerald',
      titleColor: 'text-emerald-950',
      specBox: 'bg-emerald-50 border-emerald-300 text-emerald-900',
    },
    {
      cardClass: 'guide-card-3d-amber',
      badgeClass: 'btn-3d-orange',
      titleColor: 'text-amber-950',
      specBox: 'bg-amber-50 border-amber-300 text-amber-900',
    },
    {
      cardClass: 'guide-card-3d-purple',
      badgeClass: 'btn-3d-purple',
      titleColor: 'text-purple-950',
      specBox: 'bg-purple-50 border-purple-300 text-purple-900',
    },
    {
      cardClass: 'guide-card-3d-rose',
      badgeClass: 'btn-3d-rose',
      titleColor: 'text-rose-950',
      specBox: 'bg-rose-50 border-rose-300 text-rose-900',
    },
    {
      cardClass: 'guide-card-3d-cyan',
      badgeClass: 'btn-3d-cyan',
      titleColor: 'text-cyan-950',
      specBox: 'bg-cyan-50 border-cyan-300 text-cyan-900',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-3 sm:p-5">
      <div className="modal-3d-shell rounded-3xl max-w-6xl w-full max-h-[94vh] flex flex-col overflow-hidden bg-white shadow-2xl border-4 border-sky-400">
        {/* ================= MODAL HEADER 3D ================= */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-950 via-indigo-900 to-purple-950 text-white border-b-4 border-sky-400 shadow-lg flex-wrap gap-3">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl logo-3d-badge flex items-center justify-center text-white shrink-0 shadow-md">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black tracking-tight text-white uppercase">
                  CẨM NANG HƯỚNG DẪN SỬ DỤNG &amp; ĐẶC TẢ TÍNH NĂNG
                </h2>
                <span className="text-lg sm:text-xl font-black animate-edumix-gradient">
                  EduMix 2025
                </span>
              </div>
              <p className="text-xs font-semibold text-sky-200">
                Tác giả: Thầy Hồ Tấn Khải — Trường THPT Mang Thít, Sở GD&amp;ĐT Vĩnh Long · Hotline/Zalo: 0939580982
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Nút Xuất Word Hướng Dẫn */}
            <button
              type="button"
              onClick={handleDownloadDocx}
              disabled={isExporting}
              className="px-3.5 py-2 rounded-xl text-xs font-black text-white btn-3d-emerald flex items-center gap-1.5 cursor-pointer shadow-md"
              title="Xuất toàn bộ hướng dẫn, vai trò và tính năng ra file Word (.docx) chuẩn đẹp"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? 'Đang tạo Word...' : 'Tải Hướng Dẫn (.docx)'}</span>
            </button>

            {/* Nút Sao chép Văn bản */}
            <button
              type="button"
              onClick={handleCopyText}
              className="px-3.5 py-2 rounded-xl text-xs font-black text-sky-950 bg-sky-100 border border-sky-300 hover:bg-sky-200 flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Sao chép toàn bộ văn bản hướng dẫn vào bộ nhớ tạm"
            >
              {copySuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700">Đã sao chép!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Sao chép text</span>
                </>
              )}
            </button>

            {/* Nút Đóng */}
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl text-xs font-extrabold text-white btn-3d-rose flex items-center gap-1 shrink-0 cursor-pointer"
              aria-label="Đóng hướng dẫn"
            >
              <X className="w-4 h-4" />
              <span>Đóng</span>
            </button>
          </div>
        </div>

        {/* ================= THANH TABS ĐIỀU HƯỚNG 3D ================= */}
        <div className="px-6 py-3 toolbar-3d flex flex-wrap items-center justify-between gap-2.5 border-b-2 border-sky-200">
          <nav className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab('ROLES')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'ROLES'
                  ? 'btn-3d-primary text-white ring-4 ring-blue-300 scale-105'
                  : 'bg-white hover:bg-sky-50 text-slate-700 border border-sky-300'
              }`}
            >
              1. 🌟 Vai Trò &amp; Sứ Mệnh
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('FEATURES')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'FEATURES'
                  ? 'btn-3d-purple text-white ring-4 ring-purple-300 scale-105'
                  : 'bg-white hover:bg-sky-50 text-slate-700 border border-sky-300'
              }`}
            >
              2. 🚀 Toàn Bộ 8 Tính Năng
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('WORKFLOW')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'WORKFLOW'
                  ? 'btn-3d-emerald text-white ring-4 ring-emerald-300 scale-105'
                  : 'bg-white hover:bg-sky-50 text-slate-700 border border-sky-300'
              }`}
            >
              3. 📖 Hướng Dẫn Từng Bước
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('SPEC_2025')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'SPEC_2025'
                  ? 'btn-3d-orange text-white ring-4 ring-amber-300 scale-105'
                  : 'bg-white hover:bg-sky-50 text-slate-700 border border-sky-300'
              }`}
            >
              4. 📝 Quy Chuẩn Đề Thi 2025
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('AUTO_CHANGELOG')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === 'AUTO_CHANGELOG'
                  ? 'btn-3d-rose text-white ring-4 ring-rose-300 scale-105'
                  : 'bg-white hover:bg-sky-50 text-slate-700 border border-sky-300'
              }`}
            >
              5. 📜 Nhật Ký &amp; Đăng Ký Module ({features.length})
            </button>
          </nav>

          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-100 border-2 border-amber-400 text-amber-950 text-xs font-extrabold shadow-2xs">
            <Award className="w-4 h-4 text-amber-600" />
            <span>Chuẩn GDPT 2018 &amp; CV 7991</span>
          </div>
        </div>

        {/* ================= NỘI DUNG CHÍNH ================= */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
          {/* ================= TAB 1: VAI TRÒ & SỨ MỆNH ================= */}
          {activeTab === 'ROLES' && (
            <div className="space-y-5">
              <div className="p-5 rounded-2xl guide-card-3d-blue space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-7 rounded-full bg-blue-700" />
                  <h3 className="text-base sm:text-lg font-black text-blue-950 uppercase">
                    VAI TRÒ VÀ NGUYÊN TẮC HOẠT ĐỘNG CỦA HỆ THỐNG
                  </h3>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed font-medium">
                  <strong>EduMix 2025</strong> là Bộ vi xử lý, phân tích, biên tập và chuẩn hóa tài liệu đề thi cấp độ chuyên sâu (Deep Exam Parser &amp; Word XML Synthesizer). Nhiệm vụ tối cao của hệ thống là giải phóng giáo viên khỏi các công đoạn thủ công tốn thời gian, đảm bảo tính chuẩn xác, khách quan và chuyên nghiệp trong công tác khảo thí định kỳ cũng như luyện thi tốt nghiệp THPT.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-white border-2 border-sky-300 shadow-sm space-y-2">
                  <div className="flex items-center gap-2 text-sky-900 font-extrabold text-sm">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    <span>1. Chống Nuốt Chữ &amp; Bảo Toàn 100% Công Thức</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Tuyệt đối không chỉ đọc văn bản thuần. Hệ thống duyệt song song cây thẻ <code className="font-mono bg-sky-100 text-blue-900 px-1 py-0.5 rounded">&lt;w:t&gt;</code>, đối tượng công thức <code className="font-mono bg-sky-100 text-blue-900 px-1 py-0.5 rounded">&lt;m:oMath&gt;</code>, MathType OLE và ảnh vector EMF/WMF. Nghiêm cấm xuất đáp án rỗng (Strict Non-Empty Rule).
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-white border-2 border-sky-300 shadow-sm space-y-2">
                  <div className="flex items-center gap-2 text-sky-900 font-extrabold text-sm">
                    <LayoutGrid className="w-5 h-5 text-blue-600" />
                    <span>2. Chuẩn Hóa Cấu Trúc Đề Thi THPT 2025</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Hỗ trợ trọn vẹn cả 3 phần thi theo định dạng mới của Bộ GD&amp;ĐT: Phần I (Trắc nghiệm nhiều lựa chọn A, B, C, D), Phần II (Trắc nghiệm Đúng/Sai với 4 ý a, b, c, d) và Phần III (Trắc nghiệm trả lời ngắn).
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-white border-2 border-sky-300 shadow-sm space-y-2">
                  <div className="flex items-center gap-2 text-sky-900 font-extrabold text-sm">
                    <FileCheck2 className="w-5 h-5 text-amber-600" />
                    <span>3. Tuân Thủ Nghiêm Ngặt Công Văn 7991</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Tự động tạo lập Phụ lục 1 (Khung Ma Trận) và Phụ lục 2 (Bản Đặc Tả) theo đúng chuẩn tỉ lệ nhận thức: 40% Nhận biết (4.0đ), 30% Thông hiểu (3.0đ), 30% Vận dụng (3.0đ) cùng khung duyệt ký của Ban Giám Hiệu.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-white border-2 border-sky-300 shadow-sm space-y-2">
                  <div className="flex items-center gap-2 text-sky-900 font-extrabold text-sm">
                    <LockIcon className="w-5 h-5 text-purple-600" />
                    <span>4. Vận Hành 100% Client-Side &amp; Bảo Mật Zero-Trace</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Mọi quá trình đọc file, phân tích XML, trộn đề và sinh mã QR đều diễn ra ngay trên máy tính của thầy cô. Không gửi dữ liệu đề gốc lên máy chủ lạ, tự động tiêu hủy dấu vết phiên sau khi tải tệp.
                  </p>
                </div>
              </div>

              {/* Thông tin tác giả */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-indigo-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-700 text-white flex items-center justify-center font-bold text-sm">
                    HTK
                  </div>
                  <div>
                    <div className="text-sm font-black text-indigo-950">
                      Tác giả: Thầy Hồ Tấn Khải
                    </div>
                    <div className="text-xs text-indigo-700 font-medium">
                      Giáo viên Trường THPT Mang Thít — Tỉnh Vĩnh Long
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs font-bold text-slate-700">
                  <span>✉️ Email: khaibcmt@gmail.com</span>
                  <span>💬 Zalo: 0939580982</span>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 2: TOÀN BỘ 8 TÍNH NĂNG ĐỘT PHÁ ================= */}
          {activeTab === 'FEATURES' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Tính năng 1 */}
                <div className="p-4 rounded-2xl guide-card-3d-blue space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-0.5 rounded-lg text-xs font-black text-white btn-3d-primary uppercase">
                      Tính năng 01
                    </span>
                    <FileCode className="w-5 h-5 text-blue-700" />
                  </div>
                  <h4 className="text-sm font-black text-blue-950">
                    Bộ Vi Xử Lý Bóc Tách Đa Tầng (Deep Exam Parser)
                  </h4>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">
                    Quét song song text thuần và cây công thức toán OMML/LaTeX, MathType OLE và ảnh vector. Nhận diện đáp án đúng bằng 3 cách linh hoạt: Gạch chân, Tô màu đỏ, hoặc Bảng đáp án cuối đề.
                  </p>
                </div>

                {/* Tính năng 2 */}
                <div className="p-4 rounded-2xl guide-card-3d-amber space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-0.5 rounded-lg text-xs font-black text-white btn-3d-orange uppercase">
                      Tính năng 02
                    </span>
                    <Sparkles className="w-5 h-5 text-amber-700" />
                  </div>
                  <h4 className="text-sm font-black text-amber-950">
                    Trình Biên Tập Trực Tiếp 1 Chạm (Live In-App Editor)
                  </h4>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">
                    Validator tự động bắt lỗi câu hỏi thiếu/thừa đáp án. Nút "Sửa ngay" cuộn thẳng đến câu lỗi; nút "Tự động sửa nhanh tất cả lỗi" giúp chuẩn hóa đề thi chỉ bằng 1 cú click.
                  </p>
                </div>

                {/* Tính năng 3 */}
                <div className="p-4 rounded-2xl guide-card-3d-emerald space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-0.5 rounded-lg text-xs font-black text-white btn-3d-emerald uppercase">
                      Tính năng 03
                    </span>
                    <ImageIcon className="w-5 h-5 text-emerald-700" />
                  </div>
                  <h4 className="text-sm font-black text-emerald-950">
                    Động Cơ Xử Lý Hình Ảnh, Đồ Thị, Sơ Đồ 300 DPI
                  </h4>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">
                    Tự động crop viền thừa, khử nhiễu nền xám của bản scan thành nền trắng tinh khiết (#FFFFFF), giữ nguyên tỷ lệ khung hình và xuất chuẩn In Line with Text khóa liền kề câu hỏi trong Word.
                  </p>
                </div>

                {/* Tính năng 4 */}
                <div className="p-4 rounded-2xl guide-card-3d-purple space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-0.5 rounded-lg text-xs font-black text-white btn-3d-purple uppercase">
                      Tính năng 04
                    </span>
                    <Bot className="w-5 h-5 text-purple-700" />
                  </div>
                  <h4 className="text-sm font-black text-purple-950">
                    AI Gemini Studio — Tạo 4 Đề Tương Đương Song Song
                  </h4>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">
                    Vận hành cụm 4 luồng chuyên gia song song (Gemini 3.8 Flash/Pro). Giáo viên có thể chỉ dẫn AI đổi số liệu chẵn, đảo câu Đúng/Sai, đổi sơ đồ sinh học nhưng giữ nguyên ma trận nhận thức.
                  </p>
                </div>

                {/* Tính năng 5 */}
                <div className="p-4 rounded-2xl guide-card-3d-cyan space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-0.5 rounded-lg text-xs font-black text-white btn-3d-cyan uppercase">
                      Tính năng 05
                    </span>
                    <FileSpreadsheet className="w-5 h-5 text-cyan-700" />
                  </div>
                  <h4 className="text-sm font-black text-cyan-950">
                    Khung Ma Trận &amp; Bản Đặc Tả Công Văn 7991
                  </h4>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">
                    Tự động sinh Phụ lục 1 (Khung Ma Trận 40%-30%-30%) và Phụ lục 2 (Bản Đặc Tả Yêu cầu cần đạt chuẩn GDPT 2018). Có nút tải file Word chuyên dụng kèm khung chữ ký phê duyệt Ban Giám Hiệu.
                  </p>
                </div>

                {/* Tính năng 6 */}
                <div className="p-4 rounded-2xl guide-card-3d-rose space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-0.5 rounded-lg text-xs font-black text-white btn-3d-rose uppercase">
                      Tính năng 06
                    </span>
                    <LayoutGrid className="w-5 h-5 text-rose-700" />
                  </div>
                  <h4 className="text-sm font-black text-rose-950">
                    Bảng Ma Trận Đáp Án Đối Chiếu Đa Mã Đề (Tiết Kiệm 70%)
                  </h4>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">
                    Xếp các mã đề (101, 102, 103, 104...) song song theo cột, nằm gọn trong 1 trang A4 duy nhất. Trực quan với badge màu A/B/C/D, bảng Đúng/Sai và đáp số ngắn, chống xô lệch và rối mắt.
                  </p>
                </div>

                {/* Tính năng 7 */}
                <div className="p-4 rounded-2xl guide-card-3d-purple space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-0.5 rounded-lg text-xs font-black text-white btn-3d-purple uppercase">
                      Tính năng 07
                    </span>
                    <QrCode className="w-5 h-5 text-purple-700" />
                  </div>
                  <h4 className="text-sm font-black text-purple-950">
                    Mã QR Tổng Hợp Đa Mã Đề (Master Multi QR Code)
                  </h4>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">
                    Quét 1 lần duy nhất nạp đủ toàn bộ mã đề vào ứng dụng chấm thi điện thoại (QM, Azota, TNMaker). Tự động nhúng mã QR vào trang cuối file Word và xuất kèm file ảnh PNG.
                  </p>
                </div>

                {/* Tính năng 8 */}
                <div className="p-4 rounded-2xl guide-card-3d-emerald space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-0.5 rounded-lg text-xs font-black text-white btn-3d-emerald uppercase">
                      Tính năng 08
                    </span>
                    <Workflow className="w-5 h-5 text-emerald-700" />
                  </div>
                  <h4 className="text-sm font-black text-emerald-950">
                    Đóng Gói .ZIP Đồng Nhất Quy Chuẩn Tên File
                  </h4>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">
                    Đồng bộ 100% cú pháp đặt tên cho file nén và các file Word bên trong: Môn [Tên môn] - Lớp [Lớp] - Kỳ kiểm tra [Kỳ] - [dd-mm-yy] [Hậu tố].docx/.zip.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 3: HƯỚNG DẪN TỪNG BƯỚC ================= */}
          {activeTab === 'WORKFLOW' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Bước 1 */}
                <div className="p-5 rounded-2xl guide-card-3d-blue space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-xl text-xs font-black text-white btn-3d-primary uppercase">
                      Bước 01 · Chuẩn bị đề gốc
                    </span>
                    <FileText className="w-5 h-5 text-blue-700" />
                  </div>
                  <h4 className="text-sm font-black text-blue-950">
                    Soạn Đề Thi Trên Word Theo Cấu Trúc 3 Phần
                  </h4>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">
                    Chia đề thành PHẦN I, PHẦN II, PHẦN III. Đánh dấu đáp án đúng bằng cách <strong>Gạch chân (Ctrl+U)</strong> hoặc <strong>Tô chữ màu đỏ</strong>. Có thể đính kèm bảng đáp án ở cuối trang nếu có.
                  </p>
                </div>

                {/* Bước 2 */}
                <div className="p-5 rounded-2xl guide-card-3d-emerald space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-xl text-xs font-black text-white btn-3d-emerald uppercase">
                      Bước 02 · Tải file lên
                    </span>
                    <Zap className="w-5 h-5 text-emerald-700" />
                  </div>
                  <h4 className="text-sm font-black text-emerald-950">
                    Bấm Nút "Tải Word / PDF" Màu Xanh Lam Nổi Bật
                  </h4>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">
                    Chọn tệp Word (.docx) từ máy tính hoặc bấm "Nạp Đề Mẫu 2025" để trải nghiệm. Hệ thống sẽ phân tích cú pháp và hiển thị toàn bộ cây câu hỏi lên màn hình trong tích tắc.
                  </p>
                </div>

                {/* Bước 3 */}
                <div className="p-5 rounded-2xl guide-card-3d-amber space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-xl text-xs font-black text-white btn-3d-orange uppercase">
                      Bước 03 · Sửa lỗi trực tiếp
                    </span>
                    <Sparkles className="w-5 h-5 text-amber-700" />
                  </div>
                  <h4 className="text-sm font-black text-amber-950">
                    Xử Lý Cảnh Báo Trên Live In-App Editor
                  </h4>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">
                    Nếu phát hiện câu bị lỗi đáp án, bấm nút <strong>[Sửa ngay]</strong> để cuộn tới câu lỗi và click chọn đáp án, hoặc bấm nút <strong>[Tự Động Sửa Nhanh Tất Cả Lỗi]</strong> rồi bấm <strong>[Lưu chỉnh sửa]</strong>.
                  </p>
                </div>

                {/* Bước 4 */}
                <div className="p-5 rounded-2xl guide-card-3d-purple space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-xl text-xs font-black text-white btn-3d-purple uppercase">
                      Bước 04 · Cấu hình &amp; Trộn đề
                    </span>
                    <Shuffle className="w-5 h-5 text-purple-700" />
                  </div>
                  <h4 className="text-sm font-black text-purple-950">
                    Nhập Thông Tin Trường, Môn Thi &amp; Bấm [Trộn Đề Ngay]
                  </h4>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">
                    Nhập Tên Sở/Trường, Tên bài kiểm tra, Môn thi, chọn số lượng mã đề (2, 4, 8, 12 mã). Sau đó bấm nút màu đỏ nổi bật <strong>[Trộn Đề Ngay]</strong> bên cột trái.
                  </p>
                </div>
              </div>

              {/* Bước 5 Khung Lớn */}
              <div className="p-5 rounded-2xl guide-card-3d-cyan space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-xl text-xs font-black text-white btn-3d-cyan uppercase">
                    Bước 05 · Tải trọn bộ đề thi và sử dụng
                  </span>
                  <Download className="w-5 h-5 text-cyan-700" />
                </div>
                <h4 className="text-sm font-black text-cyan-950">
                  Tải Về Trọn Bộ File .ZIP &amp; Sử Dụng Mã QR Chấm Thi
                </h4>
                <p className="text-xs text-slate-700 leading-relaxed font-medium">
                  Bấm nút <strong>[Tải Trọn Bộ 4 Đề (.zip)]</strong> để tải toàn bộ các đề thi hoán vị, Bảng đáp án ma trận đối chiếu A4 và Khung ma trận đặc tả CV 7991. Dùng điện thoại mở app chấm thi quét <strong>Mã QR Tổng Hợp</strong> để nạp toàn bộ mã đề trong 1 giây!
                </p>
              </div>
            </div>
          )}

          {/* ================= TAB 4: QUY CHUẨN ĐỀ THI 2025 ================= */}
          {activeTab === 'SPEC_2025' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Phần I */}
                <div className="p-4 rounded-2xl guide-card-3d-blue space-y-2">
                  <span className="px-3 py-0.5 rounded-lg text-xs font-black text-white btn-3d-primary uppercase">
                    PHẦN I · 4 Lựa chọn
                  </span>
                  <h4 className="text-sm font-black text-blue-950">
                    Trắc nghiệm nhiều phương án (A, B, C, D)
                  </h4>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">
                    Dòng tiêu đề: <code className="font-bold text-blue-900 bg-blue-100 px-1 py-0.5 rounded">PHẦN I</code>. Bắt đầu bằng <code className="font-bold text-blue-900 bg-blue-100 px-1 py-0.5 rounded">Câu 1.</code> kèm 4 phương án A., B., C., D. Đánh dấu đáp án đúng bằng <strong>Gạch chân (Ctrl+U)</strong> hoặc <strong>Tô chữ màu đỏ</strong>.
                  </p>
                </div>

                {/* Phần II */}
                <div className="p-4 rounded-2xl guide-card-3d-emerald space-y-2">
                  <span className="px-3 py-0.5 rounded-lg text-xs font-black text-white btn-3d-emerald uppercase">
                    PHẦN II · Đúng / Sai
                  </span>
                  <h4 className="text-sm font-black text-emerald-950">
                    Mỗi câu gồm 4 lệnh hỏi a), b), c), d)
                  </h4>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">
                    Dòng tiêu đề: <code className="font-bold text-emerald-900 bg-emerald-100 px-1 py-0.5 rounded">PHẦN II</code>. Các ý a), b), c), d) có <strong>Gạch chân hoặc Tô đỏ</strong> được nhận diện là <strong>Đúng (Đ)</strong>; ý không đánh dấu là <strong>Sai (S)</strong>.
                  </p>
                </div>

                {/* Phần III */}
                <div className="p-4 rounded-2xl guide-card-3d-rose space-y-2">
                  <span className="px-3 py-0.5 rounded-lg text-xs font-black text-white btn-3d-rose uppercase">
                    PHẦN III · Trả lời ngắn
                  </span>
                  <h4 className="text-sm font-black text-rose-950">
                    Trích xuất đáp số cuối câu
                  </h4>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">
                    Dòng tiêu đề: <code className="font-bold text-rose-900 bg-rose-100 px-1 py-0.5 rounded">PHẦN III</code>. Cuối câu ghi cú pháp <code className="font-bold text-rose-900 bg-rose-100 px-1 py-0.5 rounded">Đáp án: 150</code> hoặc gạch chân/tô đỏ trực tiếp con số đáp án.
                  </p>
                </div>
              </div>

              {/* Khung Payload QR */}
              <div className="p-4 rounded-2xl guide-card-3d-cyan space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-cyan-950 flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-cyan-700" />
                    <span>Cấu Trúc Chuỗi Payload Mã QR Đa Mã Đề Chuẩn Sư Phạm</span>
                  </h4>
                  <span className="text-xs font-mono font-bold text-cyan-900 bg-cyan-100 px-2 py-0.5 rounded border border-cyan-300">
                    Tương thích QM, Azota, TNMaker
                  </span>
                </div>
                <div className="p-3 bg-slate-900 rounded-xl text-emerald-400 font-mono text-xs overflow-x-auto border-2 border-cyan-400 shadow-inner">
                  MADE:101;PHAN1:1A,2B,3C,4D...;PHAN2:1-TFTF,2-FTTT...;PHAN3:1:150,2:-2.5... | MADE:102;PHAN1:...
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 5: NHẬT KÝ & ĐĂNG KÝ MODULE ================= */}
          {activeTab === 'AUTO_CHANGELOG' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {features.map((feat, idx) => {
                  const style = featureCardStyles[idx % featureCardStyles.length];
                  return (
                    <div
                      key={feat.id}
                      className={`p-4 rounded-2xl ${style.cardClass} flex flex-col justify-between gap-2.5`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`px-3 py-1 rounded-xl text-[11px] font-black text-white ${style.badgeClass} font-mono`}
                          >
                            {feat.version} · {feat.category}
                          </span>
                          <span className="text-xs font-mono font-bold text-slate-500">
                            {feat.releaseDate}
                          </span>
                        </div>

                        <div className={`flex items-start gap-2 text-sm font-black ${style.titleColor}`}>
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{feat.title}</span>
                        </div>

                        <p className="text-xs text-slate-700 font-medium leading-relaxed">
                          {feat.description}
                        </p>
                      </div>

                      <div
                        className={`p-2.5 rounded-xl border ${style.specBox} flex items-center gap-1.5 text-[11px] font-mono font-bold`}
                      >
                        <Code2 className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate" title={feat.technicalSpec}>
                          {feat.technicalSpec}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Form Đăng ký tính năng mới */}
              <form
                onSubmit={handleAddFeature}
                className="p-5 rounded-2xl guide-card-3d-purple space-y-4 shadow-sm"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-sm font-black text-purple-950">
                    <PlusCircle className="w-5 h-5 text-purple-600" />
                    <span>
                      Đăng Ký Module / Tính Năng Nâng Cấp Mới (Tự động điền khung 3D)
                    </span>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-purple-100 border border-purple-300 text-xs font-mono font-bold text-purple-900">
                    Auto-Sync Registry
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Tên tính năng mới (VD: Bảng ma trận đặc tả CV 7991)"
                    className="md:col-span-2 px-3.5 py-2 text-xs font-bold bg-white border-2 border-purple-300 rounded-xl focus:outline-none focus:border-blue-600"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newVersion}
                      onChange={(e) => setNewVersion(e.target.value)}
                      placeholder="v2.7.0"
                      className="w-24 px-3 py-2 text-xs font-mono font-bold bg-white border-2 border-purple-300 rounded-xl focus:outline-none focus:border-blue-600"
                    />
                    <select
                      value={newCategory}
                      onChange={(e) =>
                        setNewCategory(e.target.value as FeatureReleaseItem['category'])
                      }
                      className="flex-1 px-2 py-2 text-xs font-bold border-2 border-purple-300 rounded-xl bg-white"
                    >
                      <option value="CORE_PARSER">CORE_PARSER</option>
                      <option value="LIVE_EDITOR">LIVE_EDITOR</option>
                      <option value="AUTO_LAYOUT">AUTO_LAYOUT</option>
                      <option value="QR_ENGINE">QR_ENGINE</option>
                      <option value="WORD_EXPORT">WORD_EXPORT</option>
                      <option value="AI_ENGINE">AI_ENGINE</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Mô tả chi tiết cách hoạt động của tính năng mới..."
                    className="px-3.5 py-2 text-xs font-medium bg-white border-2 border-purple-300 rounded-xl focus:outline-none focus:border-blue-600"
                  />
                  <input
                    type="text"
                    value={newTechSpec}
                    onChange={(e) => setNewTechSpec(e.target.value)}
                    placeholder="Thông số kỹ thuật (VD: Phụ lục 1 & 2 chuẩn CV 7991)"
                    className="px-3.5 py-2 text-xs font-mono font-medium bg-white border-2 border-purple-300 rounded-xl focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl text-xs font-black text-white btn-3d-purple whitespace-nowrap cursor-pointer shadow-md"
                  >
                    + Tự Động Điền Tính Năng Mới Vào Khung 3D
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* ================= MODAL FOOTER 3D ================= */}
        <div className="px-6 py-3.5 bg-white border-t-2 border-sky-300 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-extrabold text-sky-950">
            EduMix 2025 · Tác giả: Thầy Hồ Tấn Khải — Trường THPT Mang Thít, Tỉnh Vĩnh Long · Vận hành 100% Client-side
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadDocx}
              disabled={isExporting}
              className="px-4 py-2 rounded-xl text-xs font-black text-white btn-3d-emerald cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 inline mr-1" />
              <span>{isExporting ? 'Đang xuất...' : 'Tải File Word Hướng Dẫn (.docx)'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl text-xs font-black text-white btn-3d-primary cursor-pointer"
            >
              Đã hiểu &amp; Quay lại làm việc
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

function LockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
