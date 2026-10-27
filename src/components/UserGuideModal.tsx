import React, { useState } from 'react';
import {
  Award,
  BookOpen,
  CheckCircle2,
  Code2,
  FileCheck2,
  LayoutGrid,
  PlusCircle,
  QrCode,
  Sparkles,
  X,
} from 'lucide-react';
import { FeatureReleaseItem } from '../types/exam';

interface UserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  features: FeatureReleaseItem[];
  onRegisterNewFeature: (item: FeatureReleaseItem) => void;
}

export const UserGuideModal: React.FC<UserGuideModalProps> = ({
  isOpen,
  onClose,
  features,
  onRegisterNewFeature,
}) => {
  const [activeTab, setActiveTab] = useState<'WORKFLOW' | 'SPEC_2025' | 'AUTO_CHANGELOG'>('WORKFLOW');
  const [newTitle, setNewTitle] = useState('');
  const [newVersion, setNewVersion] = useState('v2.6.0');
  const [newCategory, setNewCategory] = useState<FeatureReleaseItem['category']>('AUTO_LAYOUT');
  const [newDesc, setNewDesc] = useState('');
  const [newTechSpec, setNewTechSpec] = useState('');

  if (!isOpen) return null;

  const handleAddFeature = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDesc.trim()) return;

    const item: FeatureReleaseItem = {
      id: `feat-custom-${Date.now()}`,
      version: newVersion.trim() || 'v2.6.0',
      releaseDate: new Date().toISOString().slice(0, 7),
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 backdrop-blur-sm p-4">
      <div className="modal-3d-shell rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* ================= MODAL HEADER 3D ĐA SẮC MÀU ================= */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-purple-900 text-white border-b-4 border-sky-400 shadow-lg">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl logo-3d-badge flex items-center justify-center text-white shrink-0">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">
                  CẨM NANG HƯỚNG DẪN SỬ DỤNG 3D —{' '}
                </h2>
                <span className="text-lg sm:text-xl font-black animate-edumix-gradient">
                  EduMix 2025
                </span>
              </div>
              <p className="text-xs font-semibold text-sky-200">
                Tác giả: Hồ Tấn Khải — Trường THPT Mang Thít · Tự động điền tính năng mới khi nâng cấp
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="px-3 py-2 rounded-xl text-xs font-extrabold text-white btn-3d-rose flex items-center gap-1 shrink-0"
            aria-label="Đóng hướng dẫn"
          >
            <X className="w-4 h-4" />
            <span>Đóng</span>
          </button>
        </div>

        {/* ================= THANH TAB NỔI 3D NHIỀU MÀU SẮC ================= */}
        <div className="px-6 py-3.5 toolbar-3d flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => setActiveTab('WORKFLOW')}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold text-white transition-all whitespace-nowrap shrink-0 ${
                activeTab === 'WORKFLOW'
                  ? 'btn-3d-primary ring-4 ring-blue-300 scale-105'
                  : 'btn-3d-cyan opacity-90 hover:opacity-100'
              }`}
            >
              1. Quy Trình 4 Bước Chuẩn Hóa & Trộn Đề
            </button>

            <button
              onClick={() => setActiveTab('SPEC_2025')}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold text-white transition-all whitespace-nowrap shrink-0 ${
                activeTab === 'SPEC_2025'
                  ? 'btn-3d-emerald ring-4 ring-emerald-300 scale-105'
                  : 'btn-3d-orange opacity-90 hover:opacity-100'
              }`}
            >
              2. Quy Chuẩn Định Dạng Word (.docx) 3 Phần
            </button>

            <button
              onClick={() => setActiveTab('AUTO_CHANGELOG')}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold text-white transition-all whitespace-nowrap shrink-0 ${
                activeTab === 'AUTO_CHANGELOG'
                  ? 'btn-3d-purple ring-4 ring-purple-300 scale-105'
                  : 'btn-3d-rose opacity-90 hover:opacity-100'
              }`}
            >
              3. Nhật Ký Nâng Cấp Tự Động Điền ({features.length} Module)
            </button>
          </div>

          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-100 border-2 border-amber-400 text-amber-950 text-xs font-extrabold shadow-xs">
            <Award className="w-4 h-4 text-amber-600" />
            <span>Chuẩn Bộ GD&ĐT 2025</span>
          </div>
        </div>

        {/* ================= NỘI DUNG CHÍNH VỚI CÁC KHUNG VIỀN 3D ĐA SẮC MÀU ================= */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* TAB 1: 4 KHUNG MÀU 3D CHO 4 BƯỚC */}
          {activeTab === 'WORKFLOW' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Khung 1: Màu Xanh Sapphire 3D */}
              <div className="p-5 rounded-2xl guide-card-3d-blue space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-xl text-xs font-black text-white btn-3d-primary uppercase tracking-wider">
                    Bước 01 · Tiếp nhận Đề gốc
                  </span>
                  <div className="w-10 h-10 rounded-xl btn-3d-primary text-white flex items-center justify-center">
                    <FileCheck2 className="w-5 h-5" />
                  </div>
                </div>
                <h3 className="text-base font-black text-blue-950">
                  Tải lên File Word (.docx) hoặc Nạp Đề Mẫu 2025
                </h3>
                <p className="text-sm text-slate-700 font-medium leading-relaxed">
                  Hệ thống tự động giải nén cây XML của file Word ngay trên trình duyệt, nhận diện
                  chính xác các thẻ gạch chân{' '}
                  <code className="text-xs font-bold bg-blue-100 text-blue-900 px-1.5 py-0.5 rounded border border-blue-300">
                    &lt;w:u&gt;
                  </code>{' '}
                  và tô màu đỏ{' '}
                  <code className="text-xs font-bold bg-rose-100 text-rose-900 px-1.5 py-0.5 rounded border border-rose-300">
                    &lt;w:color&gt;
                  </code>{' '}
                  cùng công thức toán OMML.
                </p>
              </div>

              {/* Khung 2: Màu Cam Hổ Phách 3D */}
              <div className="p-5 rounded-2xl guide-card-3d-amber space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-xl text-xs font-black text-white btn-3d-orange uppercase tracking-wider">
                    Bước 02 · Sửa lỗi trực tiếp 1 chạm
                  </span>
                  <div className="w-10 h-10 rounded-xl btn-3d-amber text-white flex items-center justify-center">
                    <Sparkles className="w-5 h-5" />
                  </div>
                </div>
                <h3 className="text-base font-black text-amber-950">
                  Xử lý cảnh báo trên Live In-App Editor
                </h3>
                <p className="text-sm text-slate-700 font-medium leading-relaxed">
                  Nếu có câu thiếu hoặc thừa đáp án, bấm nút 3D <strong>[Sửa ngay]</strong> bên cột trái.
                  Màn hình tự cuộn tới đúng câu lỗi để giáo viên click chọn nút <strong>A/B/C/D</strong>,
                  gạt <strong>Đúng/Sai</strong> hoặc nhập đáp số rồi bấm <strong>[Lưu chỉnh sửa]</strong>.
                </p>
              </div>

              {/* Khung 3: Màu Xanh Ngọc Lục Bảo 3D */}
              <div className="p-5 rounded-2xl guide-card-3d-emerald space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-xl text-xs font-black text-white btn-3d-emerald uppercase tracking-wider">
                    Bước 03 · Canh hàng & Hoán vị
                  </span>
                  <div className="w-10 h-10 rounded-xl btn-3d-emerald text-white flex items-center justify-center">
                    <LayoutGrid className="w-5 h-5" />
                  </div>
                </div>
                <h3 className="text-base font-black text-emerald-950">
                  Tự động chia cột & Đánh số lại từ Câu 1 ở mỗi phần
                </h3>
                <p className="text-sm text-slate-700 font-medium leading-relaxed">
                  Tự động đo độ dài phương án (&lt;15 ký tự: 4 cột ngang; 15-35 ký tự: 2 cột; &gt;35 ký tự: 4 dòng)
                  và đặt vào <strong>Bảng ẩn không viền</strong> trong Word giúp thẳng hàng tuyệt đối, không bao giờ xô lệch.
                </p>
              </div>

              {/* Khung 4: Màu Tím Hoàng Gia 3D */}
              <div className="p-5 rounded-2xl guide-card-3d-purple space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-xl text-xs font-black text-white btn-3d-purple uppercase tracking-wider">
                    Bước 04 · Xuất Bộ Đề (.zip) & Mã QR
                  </span>
                  <div className="w-10 h-10 rounded-xl btn-3d-purple text-white flex items-center justify-center">
                    <QrCode className="w-5 h-5" />
                  </div>
                </div>
                <h3 className="text-base font-black text-purple-950">
                  Chèn trực tiếp Mã QR vào cuối trang đáp án Word
                </h3>
                <p className="text-sm text-slate-700 font-medium leading-relaxed">
                  Tự động sinh mã QR tương thích <strong>QM2025, TNMaker, Azota</strong> và nhúng vào
                  trang cuối của từng file Word hoán vị, giúp giáo viên quét nhập đáp án trong 1 giây.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: 3 KHUNG MÀU 3D CHO 3 PHẦN ĐỀ THI + KHUNG CYAN 3D CHO PAYLOAD QR */}
          {activeTab === 'SPEC_2025' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Phần I: Khung Xanh Dương 3D */}
                <div className="p-5 rounded-2xl guide-card-3d-blue space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-xl text-xs font-black text-white btn-3d-primary">
                      PHẦN I · 4 Lựa Chọn
                    </span>
                    <span className="text-xs font-mono font-bold text-blue-700">
                      Câu 1 → Câu n
                    </span>
                  </div>
                  <h4 className="text-sm font-black text-blue-950">
                    Trắc nghiệm nhiều phương án (A, B, C, D)
                  </h4>
                  <p className="text-xs text-slate-700 font-medium leading-relaxed">
                    Bắt đầu bằng dòng tiêu đề <code className="font-bold text-blue-900">PHẦN I</code>.
                    Các câu bắt đầu bằng <code className="font-bold text-blue-900">Câu 1.</code> kèm 4
                    phương án <code className="font-bold text-blue-900">A. B. C. D.</code>. Đánh dấu đáp
                    án đúng bằng <strong>Gạch chân (Ctrl+U)</strong> hoặc <strong>Tô màu đỏ (#FF0000)</strong>.
                  </p>
                </div>

                {/* Phần II: Khung Xanh Ngọc 3D */}
                <div className="p-5 rounded-2xl guide-card-3d-emerald space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-xl text-xs font-black text-white btn-3d-emerald">
                      PHẦN II · Đúng / Sai
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-700">
                      Câu 1 → Câu m
                    </span>
                  </div>
                  <h4 className="text-sm font-black text-emerald-950">
                    Mỗi câu gồm 4 lệnh hỏi con a), b), c), d)
                  </h4>
                  <p className="text-xs text-slate-700 font-medium leading-relaxed">
                    Bắt đầu bằng <code className="font-bold text-emerald-900">PHẦN II</code>. Ý nào có{' '}
                    <strong>Gạch chân hoặc Tô đỏ</strong> hệ thống tự động gán là{' '}
                    <strong>Đúng (Đ)</strong>; ý không đánh dấu tự động gán là <strong>Sai (S)</strong>.
                  </p>
                </div>

                {/* Phần III: Khung Hồng Ruby 3D */}
                <div className="p-5 rounded-2xl guide-card-3d-rose space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-xl text-xs font-black text-white btn-3d-rose">
                      PHẦN III · Trả Lời Ngắn
                    </span>
                    <span className="text-xs font-mono font-bold text-rose-700">
                      Câu 1 → Câu k
                    </span>
                  </div>
                  <h4 className="text-sm font-black text-rose-950">
                    Tự động trích xuất đáp số cuối câu
                  </h4>
                  <p className="text-xs text-slate-700 font-medium leading-relaxed">
                    Bắt đầu bằng <code className="font-bold text-rose-900">PHẦN III</code>. Cuối câu ghi
                    từ khóa <code className="font-bold text-rose-900">Đáp án: 12,5</code> hoặc tô đỏ/gạch
                    chân trực tiếp con số đáp án ở cuối câu.
                  </p>
                </div>
              </div>

              {/* Khung Cyan 3D cho Cấu trúc Payload QR */}
              <div className="p-5 rounded-2xl guide-card-3d-cyan space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="text-sm font-black text-cyan-950 flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-cyan-700" />
                    <span>Cấu trúc chuỗi Payload Mã QR Đa Nền Tảng (QM2025, TNMaker, Azota)</span>
                  </h4>
                  <span className="px-3 py-1 rounded-lg bg-cyan-100 border border-cyan-300 text-xs font-mono font-bold text-cyan-900">
                    Quét siêu tốc &lt; 1 giây
                  </span>
                </div>
                <pre className="p-4 rounded-xl bg-slate-900 text-emerald-400 text-xs font-mono overflow-x-auto border-2 border-cyan-400 shadow-inner">
                  MADE:101 | PHAN1: 1A,2C,3B,4D,5A,6B | PHAN2: 1-TFTT,2-TFTF | PHAN3: 1:30,2:0,3:2
                </pre>
              </div>
            </div>
          )}

          {/* TAB 3: CÁC KHUNG 3D ĐA SẮC MÀU CHO NHẬT KÝ TỰ ĐỘNG ĐIỀN */}
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

              {/* Khung 3D Tím Hoàng Gia để thêm tính năng nâng cấp mới tự động điền */}
              <form
                onSubmit={handleAddFeature}
                className="p-5 rounded-2xl guide-card-3d-purple space-y-4"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-sm font-black text-purple-950">
                    <PlusCircle className="w-5 h-5 text-purple-600" />
                    <span>
                      Đăng ký Module / Tính năng nâng cấp mới (Tự động tạo Khung Màu 3D vào Cẩm nang)
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
                    placeholder="Tên tính năng mới (VD: Nhận diện công thức LaTeX $...$)"
                    className="md:col-span-2 px-3.5 py-2 text-xs font-bold bg-white border-2 border-purple-300 rounded-xl focus:outline-none focus:border-blue-600"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newVersion}
                      onChange={(e) => setNewVersion(e.target.value)}
                      placeholder="v2.6.0"
                      className="w-24 px-3 py-2 text-xs font-mono font-bold bg-white border-2 border-purple-300 rounded-xl focus:outline-none focus:border-blue-600"
                    />
                    <select
                      value={newCategory}
                      onChange={(e) =>
                        setNewCategory(e.target.value as FeatureReleaseItem['category'])
                      }
                      className="flex-1 px-2 py-2 text-xs font-bold border-2 border-purple-300 rounded-xl bg-white"
                    >
                      <option value="AI_ENGINE">AI_ENGINE</option>
                      <option value="CORE_PARSER">CORE_PARSER</option>
                      <option value="LIVE_EDITOR">LIVE_EDITOR</option>
                      <option value="AUTO_LAYOUT">AUTO_LAYOUT</option>
                      <option value="QR_ENGINE">QR_ENGINE</option>
                      <option value="WORD_EXPORT">WORD_EXPORT</option>
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
                    placeholder="Thông số kỹ thuật (VD: Regex $...$ sang OMML Word)"
                    className="px-3.5 py-2 text-xs font-mono font-medium bg-white border-2 border-purple-300 rounded-xl focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl text-xs font-black text-white btn-3d-purple whitespace-nowrap"
                  >
                    + Tự Động Điền Tính Năng Mới Vào Khung 3D
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* ================= FOOTER 3D ================= */}
        <div className="px-6 py-3.5 bg-white/95 border-t-2 border-sky-300 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-extrabold text-sky-950">
            EduMix 2025 · Tác giả: Hồ Tấn Khải — Trường THPT Mang Thít · Vận hành 100% Client-side
          </span>
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl text-xs font-black text-white btn-3d-emerald"
          >
            Đã hiểu & Quay lại làm việc
          </button>
        </div>
      </div>
    </div>
  );
};
