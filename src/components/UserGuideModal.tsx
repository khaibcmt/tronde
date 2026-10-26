import React, { useState } from 'react';
import {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white border border-slate-300 rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-600 text-white">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">
                Cẩm Nang Hướng Dẫn Sử Dụng & Tự Động Cập Nhật Tính Năng (Chuẩn 2025)
              </h2>
              <p className="text-xs text-slate-300">
                Tài liệu kỹ thuật đồng bộ tự động mỗi khi nâng cấp module mới trên hệ thống
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Đóng hướng dẫn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 py-3 bg-slate-100 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('WORKFLOW')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'WORKFLOW'
                ? 'btn-3d-primary text-white'
                : 'btn-3d-neutral text-slate-700'
            }`}
          >
            1. Quy Trình 4 Bước Chuẩn Hóa & Trộn Đề
          </button>
          <button
            onClick={() => setActiveTab('SPEC_2025')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'SPEC_2025'
                ? 'btn-3d-primary text-white'
                : 'btn-3d-neutral text-slate-700'
            }`}
          >
            2. Quy Chuẩn Định Dạng File Word (.docx) 3 Phần
          </button>
          <button
            onClick={() => setActiveTab('AUTO_CHANGELOG')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'AUTO_CHANGELOG'
                ? 'btn-3d-purple text-white'
                : 'btn-3d-neutral text-slate-700'
            }`}
          >
            3. Nhật Ký Nâng Cấp Tự Động Điền ({features.length} Module)
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/60">
          {activeTab === 'WORKFLOW' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 bg-white rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">
                    Bước 01 · Tiếp nhận Đề gốc
                  </span>
                  <FileCheck2 className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Tải lên File Word (.docx) hoặc Nạp Đề Mẫu 2025
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Hệ thống tự động giải nén cây XML của file Word ngay trên trình duyệt, nhận diện
                  chính xác các thẻ gạch chân <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">&lt;w:u&gt;</code> và
                  tô màu đỏ <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">&lt;w:color&gt;</code> cùng công thức toán OMML.
                </p>
              </div>

              <div className="p-5 bg-white rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                    Bước 02 · Kiểm lỗi & Sửa trực tiếp 1 chạm
                  </span>
                  <Sparkles className="w-5 h-5 text-amber-600" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Xử lý cảnh báo trên Live In-App Editor
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Nếu có câu thiếu hoặc thừa đáp án, bấm nút <strong>[Sửa ngay]</strong> bên cột trái.
                  Màn hình tự cuộn tới đúng câu lỗi để giáo viên click chọn tròn A/B/C/D, gạt Đúng/Sai
                  hoặc nhập đáp số rồi bấm <strong>[Lưu chỉnh sửa]</strong>.
                </p>
              </div>

              <div className="p-5 bg-white rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                    Bước 03 · Canh hàng & Hoán vị Fisher-Yates
                  </span>
                  <LayoutGrid className="w-5 h-5 text-emerald-600" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Tự động chia cột & Đánh số lại từ Câu 1 ở mỗi phần
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Tự động đo độ dài phương án (&lt;15 ký tự: 4 cột ngang; 15-35 ký tự: 2 cột; &gt;35 ký tự: 4 dòng)
                  và đặt vào bảng ẩn không viền trong Word giúp thẳng hàng tuyệt đối, không bao giờ xô lệch.
                </p>
              </div>

              <div className="p-5 bg-white rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-700 uppercase tracking-wider">
                    Bước 04 · Xuất Bộ Đề (.zip) & Mã QR Chấm Thi
                  </span>
                  <QrCode className="w-5 h-5 text-purple-600" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Chèn trực tiếp Mã QR vào cuối trang đáp án Word
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Tự động sinh mã QR tương thích <strong>QM2025, TNMaker, Azota</strong> và nhúng vào
                  trang cuối của từng file Word hoán vị, giúp giáo viên quét nhập đáp án trong 1 giây.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'SPEC_2025' && (
            <div className="space-y-4">
              <div className="p-5 bg-white rounded-xl border border-slate-200 space-y-3">
                <h3 className="text-base font-bold text-slate-900">
                  Quy tắc soạn thảo Đề gốc trên Microsoft Word (.docx)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                    <div className="font-bold text-blue-800">PHẦN I. Trắc nghiệm 4 lựa chọn</div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Bắt đầu bằng dòng tiêu đề <code>PHẦN I</code>. Các câu bắt đầu bằng{' '}
                      <code>Câu 1.</code> kèm 4 phương án <code>A. B. C. D.</code>. Đánh dấu đáp án đúng
                      bằng <strong>Gạch chân (Ctrl+U)</strong> hoặc <strong>Tô màu đỏ (#FF0000)</strong>.
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                    <div className="font-bold text-emerald-800">PHẦN II. Trắc nghiệm Đúng / Sai</div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Bắt đầu bằng <code>PHẦN II</code>. Mỗi câu có 4 lệnh hỏi con{' '}
                      <code>a) b) c) d)</code>. Ý nào <strong>Gạch chân hoặc Tô đỏ</strong> hệ thống tự
                      gán là <strong>Đúng (Đ)</strong>; ý bình thường tự gán là <strong>Sai (S)</strong>.
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                    <div className="font-bold text-amber-800">PHẦN III. Trả lời ngắn</div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Bắt đầu bằng <code>PHẦN III</code>. Cuối câu ghi từ khóa{' '}
                      <code>Đáp án: 12,5</code> hoặc tô đỏ/gạch chân trực tiếp con số đáp án ở cuối câu.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-5 bg-white rounded-xl border border-slate-200 space-y-2">
                <h4 className="text-sm font-bold text-slate-900">
                  Cấu trúc chuỗi Payload Mã QR Đa Nền Tảng (Mục V.1)
                </h4>
                <pre className="p-3 rounded-lg bg-slate-900 text-emerald-400 text-xs font-mono overflow-x-auto">
                  MADE:101 | PHAN1: 1A,2C,3B,4D,5A,6B | PHAN2: 1-TFTT,2-TFTF | PHAN3: 1:30,2:0,3:2
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'AUTO_CHANGELOG' && (
            <div className="space-y-6">
              <div className="p-5 bg-white rounded-xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Danh mục tính năng đã tự động tích hợp vào Hướng dẫn sử dụng
                    </h3>
                    <p className="text-xs text-slate-500">
                      Mỗi khi trang web nâng cấp tính năng mới, mục hướng dẫn bên dưới sẽ tự động điền thông số kỹ thuật.
                    </p>
                  </div>
                  <span className="text-xs font-mono font-semibold text-purple-700">
                    Auto-Sync Registry Active
                  </span>
                </div>

                <div className="space-y-3">
                  {features.map((feat) => (
                    <div
                      key={feat.id}
                      className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col gap-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>{feat.title}</span>
                        </div>
                        <div className="text-xs text-slate-500 font-mono shrink-0">
                          {feat.version} · {feat.releaseDate} · {feat.category}
                        </div>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {feat.description}
                      </p>
                      <div className="flex items-center gap-1.5 text-xs font-mono text-blue-700 pt-1">
                        <Code2 className="w-3.5 h-3.5 shrink-0" />
                        <span>{feat.technicalSpec}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Form giả lập/thực thi nâng cấp tính năng mới tự động điền vào Hướng dẫn */}
              <form
                onSubmit={handleAddFeature}
                className="p-5 bg-white rounded-xl border border-slate-200 space-y-4"
              >
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <PlusCircle className="w-4 h-4 text-purple-600" />
                  <span>Đăng ký Module / Tính năng nâng cấp mới (Tự động điền vào Cẩm nang)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Tên tính năng mới (VD: Nhận diện công thức LaTeX $...$)"
                    className="md:col-span-2 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newVersion}
                      onChange={(e) => setNewVersion(e.target.value)}
                      placeholder="v2.6.0"
                      className="w-24 px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                    />
                    <select
                      value={newCategory}
                      onChange={(e) =>
                        setNewCategory(e.target.value as FeatureReleaseItem['category'])
                      }
                      className="flex-1 px-2 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                    >
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
                    className="px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                  />
                  <input
                    type="text"
                    value={newTechSpec}
                    onChange={(e) => setNewTechSpec(e.target.value)}
                    placeholder="Thông số kỹ thuật (VD: Regex $...$ sang OMML Word)"
                    className="px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg text-xs font-bold text-white btn-3d-purple whitespace-nowrap"
                  >
                    + Tự Động Điền Tính Năng Mới Vào Hướng Dẫn
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-600">
            Hệ thống vận hành 100% Client-side · Bảo mật tuyệt đối đề thi gốc của Giáo viên
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg text-xs font-bold text-white btn-3d-primary"
          >
            Đã hiểu & Quay lại làm việc
          </button>
        </div>
      </div>
    </div>
  );
};
