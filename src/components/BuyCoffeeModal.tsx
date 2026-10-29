import React, { useState } from 'react';
import { X, Copy, Check, Heart, Sparkles, Coffee, Building2, UserCheck, CreditCard, MessageSquareHeart } from 'lucide-react';

interface BuyCoffeeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DonationTier {
  amount: number;
  label: string;
  badge: string;
}

const DONATION_TIERS: DonationTier[] = [
  { amount: 20000, label: '20.000đ', badge: 'Ly cà phê sáng' },
  { amount: 50000, label: '50.000đ', badge: 'Cà phê & Bánh ngọt' },
  { amount: 100000, label: '100.000đ', badge: 'Tiếp lửa đam mê' },
];

const BANK_CONFIG = {
  bankCode: 'VBA',
  bankName: 'Agribank (Nông nghiệp và Phát triển Nông thôn)',
  accountNumber: '7302215005734',
  accountName: 'HO TAN KHAI',
  memo: 'Moi ca phe tac gia',
};

export const BuyCoffeeModal: React.FC<BuyCoffeeModalProps> = ({ isOpen, onClose }) => {
  const [selectedAmount, setSelectedAmount] = useState<number>(20000);
  const [copiedAccount, setCopiedAccount] = useState<boolean>(false);
  const [copiedMemo, setCopiedMemo] = useState<boolean>(false);
  const [qrLoading, setQrLoading] = useState<boolean>(false);

  if (!isOpen) return null;

  const vietQrUrl = `https://img.vietqr.io/image/${BANK_CONFIG.bankCode}-${BANK_CONFIG.accountNumber}-compact2.png?amount=${selectedAmount}&addInfo=${encodeURIComponent(
    BANK_CONFIG.memo
  )}&accountName=${encodeURIComponent(BANK_CONFIG.accountName)}`;

  const handleSelectAmount = (amount: number) => {
    if (amount === selectedAmount) return;
    setQrLoading(true);
    setSelectedAmount(amount);
  };

  const handleCopyAccount = async () => {
    try {
      await navigator.clipboard.writeText(BANK_CONFIG.accountNumber);
      setCopiedAccount(true);
      setTimeout(() => setCopiedAccount(false), 2200);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = BANK_CONFIG.accountNumber;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedAccount(true);
      setTimeout(() => setCopiedAccount(false), 2200);
    }
  };

  const handleCopyMemo = async () => {
    try {
      await navigator.clipboard.writeText(BANK_CONFIG.memo);
      setCopiedMemo(true);
      setTimeout(() => setCopiedMemo(false), 2200);
    } catch {
      // Ignore fallback
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-3xl bg-gradient-to-b from-[#FFFDF9] via-[#FFF9F0] to-[#FEF3C7] border-2 border-amber-400 shadow-[0_20px_60px_rgba(0,0,0,0.55),0_6px_0_#B45309] overflow-hidden text-slate-900 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header ấm cúng tông Nâu Cà Phê & Vàng Hổ Phách */}
        <div className="relative bg-gradient-to-r from-[#451A03] via-[#78350F] to-[#92400E] px-5 py-4 text-white border-b-2 border-amber-400/60">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-lg border border-amber-200/60 shrink-0">
                {/* Hiệu ứng khói cà phê bốc lên */}
                <div className="coffee-steam-container" aria-hidden="true">
                  <span className="coffee-steam-line steam-1" />
                  <span className="coffee-steam-line steam-2" />
                  <span className="coffee-steam-line steam-3" />
                </div>
                <span className="text-xl select-none" role="img" aria-label="coffee">
                  ☕
                </span>
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black tracking-wide text-amber-200 flex items-center gap-1.5">
                  <span>Mời Tác Giả Ly Cà Phê</span>
                  <Heart className="w-4 h-4 text-rose-400 fill-rose-400 animate-pulse" />
                </h3>
                <p className="text-xs text-amber-100/90 font-medium">
                  Tiếp thêm năng lượng sáng tạo công cụ giáo dục miễn phí
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-amber-100 hover:text-white transition-colors cursor-pointer"
              title="Đóng cửa sổ"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Nội dung Modal */}
        <div className="p-4 sm:p-5 space-y-4">
          {/* Thông điệp tri ân */}
          <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-300/90 text-xs sm:text-[13px] text-amber-950 leading-relaxed shadow-2xs">
            <p className="font-semibold">
              🌟 <strong>Lời tri ân:</strong> Cảm ơn quý Thầy/Cô và đồng nghiệp đã tin tưởng đồng hành cùng <strong>EduMix 2025</strong>. Mỗi ly cà phê ủng hộ từ quý đồng nghiệp là nguồn động viên tinh thần vô giá để tác giả tiếp tục nâng cấp những tính năng mới, mạnh mẽ và hoàn thiện hơn nữa!
            </p>
          </div>

          {/* Thanh chọn nhanh mức tiền ủng hộ */}
          <div className="space-y-2">
            <label className="block text-xs font-black text-amber-950 uppercase tracking-wide flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Chọn nhanh mức ủng hộ (Mã VietQR tự động cập nhật):</span>
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {DONATION_TIERS.map((tier) => {
                const isSelected = selectedAmount === tier.amount;
                return (
                  <button
                    key={tier.amount}
                    type="button"
                    onClick={() => handleSelectAmount(tier.amount)}
                    className={`py-2.5 px-2 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer border-2 ${
                      isSelected
                        ? 'bg-gradient-to-b from-amber-500 to-orange-600 text-white border-amber-700 shadow-[0_4px_0_#78350F] -translate-y-0.5'
                        : 'bg-white hover:bg-amber-50 text-amber-950 border-amber-300 shadow-[0_3px_0_#FCD34D]'
                    }`}
                  >
                    <span className="text-sm sm:text-base font-black font-mono">
                      {tier.label}
                    </span>
                    <span
                      className={`text-[11px] font-bold mt-0.5 ${
                        isSelected ? 'text-amber-100' : 'text-amber-700'
                      }`}
                    >
                      {tier.badge}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Khung hiển thị mã VietQR động */}
          <div className="flex flex-col items-center justify-center p-3.5 rounded-2xl bg-white border-2 border-amber-300 shadow-inner">
            <div className="relative w-56 sm:w-64 min-h-[230px] flex items-center justify-center bg-slate-50 rounded-xl p-2 border border-slate-200">
              {qrLoading && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-2xs flex items-center justify-center rounded-xl z-10">
                  <span className="text-xs font-extrabold text-amber-800 animate-pulse">
                    Đang cập nhật mã QR {selectedAmount.toLocaleString('vi-VN')}đ...
                  </span>
                </div>
              )}
              <img
                key={vietQrUrl}
                src={vietQrUrl}
                alt={`Mã VietQR ủng hộ ${selectedAmount.toLocaleString('vi-VN')}đ - HO TAN KHAI`}
                onLoad={() => setQrLoading(false)}
                onError={() => setQrLoading(false)}
                className="w-full h-auto object-contain rounded-lg"
              />
            </div>
            <span className="mt-2 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-3 py-0.5 rounded-full">
              ✓ Quét bằng mọi App Ngân hàng hoặc MoMo / ViettelPay (Tự động điền 100%)
            </span>
          </div>

          {/* Bảng thông tin chuyển khoản phụ trợ */}
          <div className="p-3.5 rounded-2xl bg-white/95 border-2 border-amber-300/90 space-y-2 text-xs sm:text-[13px] shadow-2xs">
            <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-amber-100">
              <span className="font-bold text-slate-600 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Chủ tài khoản:</span>
              </span>
              <span className="font-black text-slate-900 tracking-wide">
                {BANK_CONFIG.accountName}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-amber-100">
              <span className="font-bold text-slate-600 flex items-center gap-1.5 shrink-0">
                <Building2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Ngân hàng:</span>
              </span>
              <span className="font-extrabold text-emerald-900 text-right">
                {BANK_CONFIG.bankName}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-amber-100">
              <span className="font-bold text-slate-600 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-blue-700 shrink-0" />
                <span>Số tài khoản:</span>
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-sm text-blue-900 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                  {BANK_CONFIG.accountNumber}
                </span>
                <button
                  type="button"
                  onClick={handleCopyAccount}
                  className={`px-2.5 py-1 rounded-lg font-extrabold text-xs flex items-center gap-1 transition-all cursor-pointer ${
                    copiedAccount
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-xs'
                  }`}
                  title="Sao chép số tài khoản vào bộ nhớ tạm"
                >
                  {copiedAccount ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Đã chép</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Sao chép</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-slate-600 flex items-center gap-1.5">
                <MessageSquareHeart className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Nội dung:</span>
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-amber-950 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                  {BANK_CONFIG.memo}
                </span>
                <button
                  type="button"
                  onClick={handleCopyMemo}
                  className="text-[11px] font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer"
                >
                  {copiedMemo ? 'Đã chép!' : 'Chép'}
                </button>
              </div>
            </div>
          </div>

          {/* Nút đóng dưới cùng */}
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#78350F] to-[#92400E] hover:from-[#92400E] hover:to-[#B45309] text-white font-black text-xs sm:text-sm shadow-md cursor-pointer transition-all"
            >
              Đóng cửa sổ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface FloatingCoffeeButtonProps {
  onClick: () => void;
}

export const FloatingCoffeeButton: React.FC<FloatingCoffeeButtonProps> = ({ onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-16 sm:bottom-14 right-3 sm:right-5 z-40 group flex items-center gap-2 px-3.5 py-2 rounded-full bg-gradient-to-r from-[#78350F] via-[#92400E] to-[#B45309] hover:from-[#92400E] hover:via-[#B45309] hover:to-[#D97706] text-amber-100 border-2 border-amber-300/90 shadow-[0_5px_0_#451A03,0_10px_25px_rgba(120,53,15,0.55)] hover:-translate-y-0.5 active:translate-y-0.5 transition-all cursor-pointer"
      title="Mời tác giả Hồ Tấn Khải ly cà phê qua mã VietQR động"
    >
      <div className="relative flex items-center justify-center w-7 h-7 rounded-full bg-amber-400/20 border border-amber-300/50">
        {/* Khói bốc lên nhẹ nhàng bằng CSS keyframes */}
        <div className="coffee-steam-container" aria-hidden="true">
          <span className="coffee-steam-line steam-1" />
          <span className="coffee-steam-line steam-2" />
          <span className="coffee-steam-line steam-3" />
        </div>
        <span className="text-base leading-none select-none" role="img" aria-label="coffee">
          ☕
        </span>
      </div>
      <span className="text-xs sm:text-[13px] font-black tracking-wide text-amber-100 group-hover:text-white whitespace-nowrap drop-shadow-xs">
        Mời Tác Giả Ly Cà Phê
      </span>
    </button>
  );
};
