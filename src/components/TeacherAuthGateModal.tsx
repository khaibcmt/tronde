import React, { useEffect, useState } from 'react';

export interface TeacherAuthUser {
  gmail: string;
  name: string;
  school: string;
  deviceId?: string;
}

interface TeacherAuthGateModalProps {
  isOpen: boolean;
  currentUser: TeacherAuthUser | null;
  onAuthenticated: (user: TeacherAuthUser) => void;
  onCloseIfAuthenticated?: () => void;
}

const GOOGLE_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbzwdXDqUQbWShXFFYrgX17fCnhi0jc4TLFaoECm6DvTi8zcDO8i37dsxnLQfErZNRfj/exec';

export const TeacherAuthGateModal: React.FC<TeacherAuthGateModalProps> = ({
  isOpen,
  currentUser,
  onAuthenticated,
  onCloseIfAuthenticated,
}) => {
  const [gmail, setGmail] = useState(currentUser?.gmail || '');
  const [teacherName, setTeacherName] = useState(currentUser?.name || '');
  const [schoolName, setSchoolName] = useState(currentUser?.school || '');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isPressed, setIsPressed] = useState<boolean>(false);

  useEffect(() => {
    if (currentUser) {
      setGmail(currentUser.gmail || '');
      setTeacherName(currentUser.name || '');
      setSchoolName(currentUser.school || '');
    }
  }, [currentUser]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg('');

    const gmailVal = gmail.trim().toLowerCase();
    const nameVal = teacherName.trim();
    const schoolVal = schoolName.trim();

    if (!gmailVal || !nameVal || !schoolVal) {
      setErrorMsg('Vui lòng điền đầy đủ Gmail, Họ và tên Thầy/Cô và Trường công tác.');
      return;
    }

    setIsSubmitting(true);

    let deviceId = '';
    try {
      deviceId = localStorage.getItem('tronde_device_id') || '';
      if (!deviceId) {
        deviceId =
          'TRON-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        localStorage.setItem('tronde_device_id', deviceId);
      }
    } catch {
      deviceId = 'TRON-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    let ip = '---';
    try {
      const resIp = await fetch('https://api.ipify.org?format=json');
      const dIp = await resIp.json();
      ip = dIp.ip || '---';
    } catch {
      ip = '---';
    }

    const payload = {
      gmail: gmailVal,
      teacherName: nameVal,
      schoolName: schoolVal,
      deviceId: deviceId,
      ipAddress: ip,
      status: 'active',
    };

    try {
      const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (result.status === 'duplicate' || result.status === 'error') {
        setErrorMsg(
          result.message ||
            'Tài khoản hoặc thiết bị không hợp lệ. Vui lòng kiểm tra lại!'
        );
        setIsSubmitting(false);
      } else {
        const userObj: TeacherAuthUser = {
          gmail: gmailVal,
          name: nameVal,
          school: schoolVal,
          deviceId,
        };
        try {
          localStorage.setItem('tronde_current_user', JSON.stringify(userObj));
        } catch {
          // ignore storage quota errors
        }
        setIsSubmitting(false);
        onAuthenticated(userObj);
      }
    } catch {
      const userObj: TeacherAuthUser = {
        gmail: gmailVal,
        name: nameVal,
        school: schoolVal,
        deviceId,
      };
      try {
        localStorage.setItem('tronde_current_user', JSON.stringify(userObj));
      } catch {
        // ignore storage quota errors
      }
      setIsSubmitting(false);
      onAuthenticated(userObj);
    }
  };

  return (
    <div
      id="authGateModal"
      style={{
        display: 'flex',
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'rgba(15,23,42,0.8)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        fontFamily: "'Times New Roman', Times, serif",
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '28px',
          maxWidth: '435px',
          width: '100%',
          padding: '32px 26px 26px 26px',
          boxShadow:
            '0 30px 60px -15px rgba(15,23,42,0.5), 0 0 0 1px rgba(255,255,255,0.8) inset',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
          fontFamily: "'Times New Roman', Times, serif",
        }}
      >
        {/* Dải sáng phát quang trên đỉnh */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '6px',
            background:
              'linear-gradient(90deg, #06b6d4, #3b82f6, #8b5cf6, #ec4899)',
            backgroundSize: '300% 300%',
            animation: 'gradientText 4s ease infinite',
          }}
        />

        {/* Nút đóng nhanh nếu giáo viên đã đăng nhập và mở lại để xem thông tin */}
        {currentUser && onCloseIfAuthenticated && (
          <button
            type="button"
            onClick={onCloseIfAuthenticated}
            title="Đóng hộp thoại"
            style={{
              position: 'absolute',
              top: '14px',
              right: '14px',
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              color: '#475569',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        )}

        {/* Điểm nhấp nháy trực quan phía trên */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 16px',
            background: '#0f172a',
            color: '#fff',
            borderRadius: '30px',
            fontSize: '12px',
            fontWeight: 700,
            marginBottom: '14px',
            boxShadow: '0 6px 16px rgba(15,23,42,0.25)',
          }}
        >
          <span
            style={{
              width: '9px',
              height: '9px',
              borderRadius: '50%',
              background: '#22c55e',
              animation: 'badgeBlink 1.2s infinite ease-in-out',
            }}
          />
          <span
            style={{
              letterSpacing: '0.8px',
              textTransform: 'uppercase',
              color: '#f8fafc',
            }}
          >
            HỆ THỐNG XÁC THỰC GIÁO VIÊN
          </span>
        </div>

        {/* LOGO 3D & TÊN WEB PHÁT QUANG */}
        <div style={{ marginBottom: '16px' }}>
          <div
            style={{
              width: '72px',
              height: '72px',
              margin: '0 auto 10px auto',
              borderRadius: '22px',
              background: 'linear-gradient(135deg, #2563eb, #7c3aed, #db2777)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '32px',
              animation: 'trondePulseGlow 3s infinite ease-in-out',
              border: '2px solid #ffffff',
            }}
          >
            <i className="fa-solid fa-layer-group" />
          </div>
          <h2
            style={{
              margin: '0 0 4px 0',
              fontSize: '25px',
              fontWeight: 900,
              letterSpacing: '-0.3px',
              background: 'linear-gradient(135deg, #1e40af, #6d28d9, #be185d)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundSize: '200% 200%',
              animation: 'gradientText 4s ease infinite',
            }}
          >
            TRONDE • EDUMIX PRO2025
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: '13.5px',
              color: '#64748b',
              fontWeight: 600,
            }}
          >
            Công cụ trộn đề thi trắc nghiệm chuẩn Bộ Giáo Dục
          </p>
        </div>

        <form
          id="formAuthGate"
          onSubmit={handleSubmit}
          style={{ textAlign: 'left' }}
        >
          {/* KHỐI 3D 1: ĐỊA CHỈ GMAIL (XANH LAM ĐẠI DƯƠNG - OCEAN BLUE 3D) */}
          <div
            className="tronde-input-3d"
            style={{
              marginBottom: '14px',
              background: '#f0f9ff',
              border: '1.5px solid #bae6fd',
              borderRadius: '16px',
              padding: '10px 14px',
              boxShadow:
                '0 8px 20px -6px rgba(14, 165, 233, 0.25), 0 3px 6px rgba(0,0,0,0.03)',
            }}
          >
            <label
              htmlFor="authGmail"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '13px',
                fontWeight: 700,
                color: '#0369a1',
                marginBottom: '5px',
              }}
            >
              <span>
                <i
                  className="fa-solid fa-envelope"
                  style={{ marginRight: '6px', color: '#0284c7' }}
                />
                Địa chỉ Gmail
              </span>
              <span style={{ color: '#e11d48', fontSize: '11.5px' }}>
                * Bắt buộc
              </span>
            </label>
            <input
              type="email"
              id="authGmail"
              required
              value={gmail}
              onChange={(e) => setGmail(e.target.value)}
              placeholder="nhap_gmail_thayco@gmail.com"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 10px',
                background: '#ffffff',
                border: '1px solid #7dd3fc',
                borderRadius: '10px',
                fontSize: '14.5px',
                fontWeight: 600,
                color: '#0c4a6e',
                outline: 'none',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.04)',
                fontFamily: "'Times New Roman', Times, serif",
              }}
            />
          </div>

          {/* KHỐI 3D 2: HỌ VÀ TÊN (TÍM THẠCH ANH - PURPLE VIOLET 3D) */}
          <div
            className="tronde-input-3d"
            style={{
              marginBottom: '14px',
              background: '#faf5ff',
              border: '1.5px solid #e9d5ff',
              borderRadius: '16px',
              padding: '10px 14px',
              boxShadow:
                '0 8px 20px -6px rgba(168, 85, 247, 0.25), 0 3px 6px rgba(0,0,0,0.03)',
            }}
          >
            <label
              htmlFor="authTeacherName"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '13px',
                fontWeight: 700,
                color: '#7e22ce',
                marginBottom: '5px',
              }}
            >
              <span>
                <i
                  className="fa-solid fa-user-tie"
                  style={{ marginRight: '6px', color: '#9333ea' }}
                />
                Họ và tên Thầy / Cô
              </span>
              <span style={{ color: '#e11d48', fontSize: '11.5px' }}>
                * Bắt buộc
              </span>
            </label>
            <input
              type="text"
              id="authTeacherName"
              required
              value={teacherName}
              onChange={(e) => setTeacherName(e.target.value)}
              placeholder="Ví dụ: Hồ Tấn Khải"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 10px',
                background: '#ffffff',
                border: '1px solid #d8b4fe',
                borderRadius: '10px',
                fontSize: '14.5px',
                fontWeight: 600,
                color: '#581c87',
                outline: 'none',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.04)',
                fontFamily: "'Times New Roman', Times, serif",
              }}
            />
          </div>

          {/* KHỐI 3D 3: TRƯỜNG CÔNG TÁC (CAM HỔ PHÁCH - AMBER ORANGE 3D) */}
          <div
            className="tronde-input-3d"
            style={{
              marginBottom: '18px',
              background: '#fffbeb',
              border: '1.5px solid #fde68a',
              borderRadius: '16px',
              padding: '10px 14px',
              boxShadow:
                '0 8px 20px -6px rgba(245, 158, 11, 0.25), 0 3px 6px rgba(0,0,0,0.03)',
            }}
          >
            <label
              htmlFor="authSchoolName"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '13px',
                fontWeight: 700,
                color: '#b45309',
                marginBottom: '5px',
              }}
            >
              <span>
                <i
                  className="fa-solid fa-school"
                  style={{ marginRight: '6px', color: '#d97706' }}
                />
                Trường công tác
              </span>
              <span style={{ color: '#e11d48', fontSize: '11.5px' }}>
                * Bắt buộc
              </span>
            </label>
            <input
              type="text"
              id="authSchoolName"
              required
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              placeholder="Ví dụ: THPT Mang Thít"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 10px',
                background: '#ffffff',
                border: '1px solid #fcd34d',
                borderRadius: '10px',
                fontSize: '14.5px',
                fontWeight: 600,
                color: '#78350f',
                outline: 'none',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.04)',
                fontFamily: "'Times New Roman', Times, serif",
              }}
            />
          </div>

          {/* Hộp báo lỗi */}
          {errorMsg && (
            <div
              id="authErrorMsg"
              style={{
                display: 'block',
                padding: '11px 14px',
                borderRadius: '12px',
                fontSize: '13.5px',
                fontWeight: 700,
                background: '#fff1f2',
                color: '#be123c',
                border: '1px solid #fecdd3',
                marginBottom: '14px',
                lineHeight: 1.4,
              }}
            >
              <i
                className="fa-solid fa-triangle-exclamation"
                style={{ marginRight: '6px' }}
              />
              {errorMsg}
            </div>
          )}

          {/* NÚT BẤM 3D GRADIENT NỔI KHỐI */}
          <button
            type="submit"
            id="btnSubmitAuth"
            disabled={isSubmitting}
            onMouseDown={() => setIsPressed(true)}
            onMouseUp={() => setIsPressed(false)}
            onMouseLeave={() => setIsPressed(false)}
            style={{
              width: '100%',
              background:
                'linear-gradient(135deg, #2563eb, #4f46e5 50%, #7c3aed)',
              color: '#ffffff',
              border: 'none',
              padding: '14px',
              borderRadius: '16px',
              fontWeight: 800,
              fontSize: '15.5px',
              cursor: isSubmitting ? 'wait' : 'pointer',
              boxShadow: isPressed
                ? '0 4px 10px -2px rgba(79, 70, 229, 0.4), 0 1px 0 #3730a3'
                : '0 12px 24px -6px rgba(79, 70, 229, 0.5), 0 4px 0 #3730a3',
              transform: isPressed ? 'translateY(3px)' : 'translateY(0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '9px',
              transition: 'all 0.15s ease',
              fontFamily: "'Times New Roman', Times, serif",
            }}
          >
            {isSubmitting ? (
              <>
                <i className="fa-solid fa-circle-notch fa-spin" />
                <span>Đang xác nhận dữ liệu...</span>
              </>
            ) : (
              <>
                <span>VÀO PHẦN MỀM TRỘN ĐỀ</span>
                <i className="fa-solid fa-arrow-right-long" />
              </>
            )}
          </button>

          <p
            style={{
              margin: '12px 0 0 0',
              textAlign: 'center',
              fontSize: '12px',
              color: '#94a3b8',
              fontWeight: 600,
            }}
          >
            <i
              className="fa-solid fa-shield-halved"
              style={{ color: '#10b981', marginRight: '4px' }}
            />{' '}
            Hệ thống lưu dữ liệu bảo mật và tự động ghi nhớ phiên dùng
          </p>
        </form>
      </div>
    </div>
  );
};
