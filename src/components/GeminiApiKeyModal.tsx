import React, { useState, useEffect } from 'react';
import { Settings, X, Key, Trash2, Save, ExternalLink, CheckCircle2, AlertCircle } from 'lucide-react';

interface GeminiApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeySaved?: (apiKey: string) => void;
}

export const GeminiApiKeyModal: React.FC<GeminiApiKeyModalProps> = ({
  isOpen,
  onClose,
  onKeySaved,
}) => {
  const [apiKey, setApiKey] = useState<string>('');
  const [showKey, setShowKey] = useState<boolean>(false);
  const [hasSavedKey, setHasSavedKey] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'SUCCESS' | 'INFO';
    text: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const stored =
        (typeof window !== 'undefined' &&
          (localStorage.getItem('gemini_api_key') ||
            localStorage.getItem('GEMINI_API_KEY'))) ||
        '';
      setApiKey(stored);
      setHasSavedKey(Boolean(stored && stored.trim().length > 0));
      setFeedbackMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      handleDelete();
      return;
    }
    try {
      localStorage.setItem('gemini_api_key', trimmed);
      localStorage.setItem('GEMINI_API_KEY', trimmed);
      setHasSavedKey(true);
      setFeedbackMessage({
        type: 'SUCCESS',
        text: 'Đã lưu API Key thành công vào trình duyệt (localStorage)!',
      });
      onKeySaved?.(trimmed);
      setTimeout(() => {
        setFeedbackMessage(null);
      }, 2500);
    } catch {
      setFeedbackMessage({
        type: 'INFO',
        text: 'Không thể lưu vào bộ nhớ trình duyệt.',
      });
    }
  };

  const handleDelete = () => {
    try {
      localStorage.removeItem('gemini_api_key');
      localStorage.removeItem('GEMINI_API_KEY');
      setApiKey('');
      setHasSavedKey(false);
      setFeedbackMessage({
        type: 'INFO',
        text: 'Đã xóa API Key khỏi bộ nhớ trình duyệt.',
      });
      onKeySaved?.('');
      setTimeout(() => {
        setFeedbackMessage(null);
      }, 2500);
    } catch {
      // Ignore
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl bg-[#131927] border-2 border-indigo-500/50 rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-6 text-white space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tiêu đề Modal */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-400" />
            <h3 className="text-base sm:text-lg font-black text-amber-400 tracking-wide">
              Cấu Hình Google Gemini API Key
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Đóng cửa sổ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Đoạn mô tả hướng dẫn */}
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
          Để sử dụng các tính năng <strong>AI Soạn Đề Thông Minh</strong> và <strong>AI Tutor Giải Thích Trực Tiếp</strong> trên GitHub Pages (không cần backend), giáo viên chỉ cần dán Google Gemini API Key của mình vào đây. Key sẽ được lưu cục bộ trên trình duyệt (localStorage) và không bao giờ bị mất khi tải lại trang.
        </p>

        {/* Khung trạng thái API Key */}
        {hasSavedKey ? (
          <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500 text-emerald-300 flex items-center gap-2 text-xs sm:text-sm font-bold shadow-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
            <span>Trình duyệt đã lưu API Key của Thầy/Cô. Các tính năng AI đang sẵn sàng!</span>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-slate-800/90 border border-slate-700 text-slate-300 flex items-center gap-2 text-xs sm:text-sm font-medium">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Chưa có API Key hoặc đang dùng chế độ dự phòng thông minh (offline fallback)...</span>
          </div>
        )}

        {/* Thông báo thao tác (nếu có) */}
        {feedbackMessage && (
          <div
            className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
              feedbackMessage.type === 'SUCCESS'
                ? 'bg-emerald-900/70 border border-emerald-400 text-emerald-200'
                : 'bg-amber-900/70 border border-amber-400 text-amber-200'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{feedbackMessage.text}</span>
          </div>
        )}

        {/* Ô nhập API Key */}
        <div className="space-y-1.5">
          <label className="block text-xs sm:text-sm font-extrabold text-slate-200">
            Google Gemini API Key:
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Dán AI Studio API Key vào đây (VD: AIzaSy...)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0b101d] border-2 border-slate-700 focus:border-sky-400 focus:outline-none text-white text-xs sm:text-sm font-mono tracking-wider shadow-inner"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 hover:text-white font-bold text-xs sm:text-sm shrink-0 cursor-pointer transition-colors"
            >
              {showKey ? 'Ẩn' : 'Hiện'}
            </button>
          </div>
        </div>

        {/* Khung hướng dẫn lấy key miễn phí & Ghi chú dự phòng */}
        <div className="p-3.5 rounded-xl bg-sky-950/40 border border-sky-800/60 space-y-2 text-xs text-sky-200">
          <div className="flex items-start gap-1.5">
            <span className="shrink-0">👉</span>
            <span>
              Chưa có API Key? Thầy/Cô có thể tạo miễn phí trong 30 giây tại:{' '}
              <a
                href="https://aistudio.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-400 underline font-black hover:text-sky-300 inline-flex items-center gap-1"
              >
                <span>Google AI Studio (aistudio.google.com)</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </span>
          </div>
          <div className="flex items-start gap-1.5 text-slate-300">
            <span className="shrink-0">💡</span>
            <span>
              <strong>Ghi chú:</strong> Nếu không nhập Key, hệ thống vẫn tự động chuyển sang chế độ mẫu dự phòng (offline fallback) để lớp học không bị gián đoạn.
            </span>
          </div>
        </div>

        {/* Cụm nút thao tác ở chân Modal */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-700">
          <button
            type="button"
            onClick={handleDelete}
            className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Xóa Key</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs sm:text-sm transition-colors cursor-pointer"
            >
              Đóng
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Lưu API Key</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
