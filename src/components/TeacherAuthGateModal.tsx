import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { TeacherUser } from '../utils/teacherLicense';
import {
  KeyValueStore,
  MachineRow,
  applyRemoteStatus,
  beginAdminSession,
  buildMachinesCsv,
  clearLocalUser,
  decidePw2Step,
  defaultFetch,
  endAdminSession,
  evidenceCsvFilename,
  fetchLicense,
  fetchMachines,
  fetchRemotePwHash,
  getDeviceId,
  getLocalPwHash,
  isAdminActive,
  readLocalUser,
  saveRemotePwHash,
  setLocalPwHash,
  setMachineStatus,
  sha256Hex,
  submitRegistration,
  validateRegistration,
  verifyMasterCode,
  verifyPw2,
  writeLocalUser,
} from '../utils/teacherLicense';

/**
 * Cổng xác thực giáo viên Tronde — THEO MẪU BẢN QUYỀN KC3D (trochoi):
 *  - Máy chưa đăng ký (và không phải Admin) → cổng đăng ký hiện ngay khi mở
 *    app: Gmail + họ tên + trường → ghi tronde_requests/<TRON-...> rồi TỰ
 *    ĐỘNG DUYỆT NGAY (tronde_licenses status 'active') → vào app, điền 1
 *    lần duy nhất, các lần sau vào thẳng.
 *  - Khi tải trang, trạng thái kiểm lại với Firebase: license 'locked' →
 *    cổng hiện thông báo khoá, không cho đăng ký lại; lỗi mạng/không có
 *    bản ghi → giữ hồ sơ đã lưu tại máy, không khoá oan.
 *  - Admin 2 khoá (mã chủ dùng chung + mã 2 thầy tự đặt lần đầu): miễn
 *    cổng đăng ký; panel 🔐 Quản lý máy chỉ hiện khi đang ở quyền Admin.
 * Toàn bộ logic thuần nằm ở utils/teacherLicense.ts.
 */

export type TeacherAuthUser = TeacherUser;

const safeStore: KeyValueStore = {
  getItem: (k: string) => {
    try { return localStorage.getItem(k); } catch { return null; }
  },
  setItem: (k: string, v: string) => {
    try { localStorage.setItem(k, v); } catch { /* bỏ qua */ }
  },
  removeItem: (k: string) => {
    try { localStorage.removeItem(k); } catch { /* bỏ qua */ }
  }
};

export interface TeacherAuthGateApi {
  user: TeacherAuthUser | null;
  deviceId: string;
  isAdmin: boolean;
  openAdmin: () => void;
  openMachines: () => void;
  modals: React.ReactNode;
}

interface UseTeacherAuthGateOpts {
  onAuthenticated?: (user: TeacherAuthUser) => void;
}

type AdminStep =
  | { kind: 'master' }
  | { kind: 'create' }
  | { kind: 'pw2'; mode: 'local' | 'remote'; expectedHash: string };

/* ----- Style cho modal Admin / Quản lý máy (port từ LicenseGate trochoi) ----- */
const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.72)', zIndex: 999990,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px'
};
const cardStyle: React.CSSProperties = {
  background: 'linear-gradient(160deg, #111c33, #0b1220)', color: '#e2e8f0',
  width: '100%', maxWidth: '520px', borderRadius: '16px', border: '2px solid #6366f1',
  boxShadow: '0 18px 50px rgba(0,0,0,0.5)', maxHeight: '88vh', overflowY: 'auto', padding: '20px 22px',
  fontFamily: "'Times New Roman', Times, serif"
};
const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '9px',
  border: '1.5px solid #475569', background: '#0f172a', color: '#f8fafc', fontSize: '15px', fontWeight: 600
};
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '13.5px', fontWeight: 800, margin: '10px 0 4px', color: '#c7d2fe' };
const primaryBtn: React.CSSProperties = {
  padding: '11px 18px', border: 0, borderRadius: '10px', background: 'linear-gradient(135deg,#2e9e4f,#15803d)',
  color: '#fff', fontWeight: 900, fontSize: '15px', cursor: 'pointer'
};
const ghostBtn: React.CSSProperties = {
  padding: '11px 16px', border: '1.5px solid #475569', borderRadius: '10px', background: 'transparent',
  color: '#cbd5e1', fontWeight: 800, fontSize: '14.5px', cursor: 'pointer'
};

export function useTeacherAuthGate(opts: UseTeacherAuthGateOpts = {}): TeacherAuthGateApi {
  const onAuthenticatedRef = useRef(opts.onAuthenticated);
  onAuthenticatedRef.current = opts.onAuthenticated;

  const [deviceId] = useState<string>(() => getDeviceId(safeStore));
  const [user, setUser] = useState<TeacherAuthUser | null>(() => readLocalUser(safeStore));
  const [lockedNotice, setLockedNotice] = useState<boolean>(false);
  const [memAdmin, setMemAdmin] = useState<boolean>(false);
  const [adminOn, setAdminOn] = useState<boolean>(() => isAdminActive(safeStore, false, Date.now()));
  const isAdmin = adminOn || memAdmin;

  const [toast, setToast] = useState<string>('');
  const toastTimer = useRef<any>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4000);
  }, []);

  /* ----- Kiểm trạng thái kích hoạt với Firebase khi tải trang ----- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let lic: any = undefined;
      try { lic = await fetchLicense(defaultFetch, deviceId); } catch { lic = undefined; }
      if (cancelled || lic === undefined) return; // mất mạng → giữ trạng thái đã lưu
      const local = readLocalUser(safeStore);
      const remote = !lic ? 'none' : lic.status === 'locked' ? 'locked' : 'active';
      const next = applyRemoteStatus(!!local, remote as any);
      if (remote === 'locked') {
        if (local) { clearLocalUser(safeStore); setUser(null); }
        setLockedNotice(true);
        return;
      }
      if (next && !local && lic) {
        // Máy đã có license active mà hồ sơ tại máy bị mất → khôi phục từ license.
        const restored: TeacherAuthUser = {
          gmail: lic.email || '', name: lic.name || '', school: lic.school || '', deviceId
        };
        if (restored.gmail && restored.name) {
          writeLocalUser(safeStore, restored);
          setUser(restored);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [deviceId]);

  /* ----- Cổng đăng ký ----- */
  const [gmail, setGmail] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isPressed, setIsPressed] = useState<boolean>(false);

  const gateOpen = !isAdmin && !user;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg('');
    const info = {
      gmail: gmail.trim().toLowerCase(),
      name: teacherName.trim(),
      school: schoolName.trim(),
    };
    const err = validateRegistration(info);
    if (err) { setErrorMsg(err); return; }
    setIsSubmitting(true);
    const res = await submitRegistration(
      { fetchFn: defaultFetch, store: safeStore, now: () => Date.now(), ua: (navigator as any)?.userAgent || '' },
      deviceId,
      info
    );
    setIsSubmitting(false);
    if (!res.ok || !res.user) {
      setErrorMsg(res.message || 'Gửi đăng ký chưa được — kiểm tra mạng rồi thử lại nhé.');
      return;
    }
    setUser(res.user);
    setLockedNotice(false);
    if (onAuthenticatedRef.current) onAuthenticatedRef.current(res.user);
  };

  /* ----- Admin 2 khoá ----- */
  const [adminStep, setAdminStep] = useState<AdminStep | null>(null);
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [fMaster, setFMaster] = useState('');
  const [fPw2, setFPw2] = useState('');
  const [fPw2b, setFPw2b] = useState('');

  const finishAdminLogin = (remember: boolean) => {
    beginAdminSession(safeStore, remember, Date.now());
    if (!remember) setMemAdmin(true);
    setAdminOn(true);
    setAdminStep(null);
    setFMaster(''); setFPw2(''); setFPw2b('');
    showToast(remember
      ? '👑 Đã mở Admin — máy này đã ghi nhớ phiên Admin.'
      : '👑 Đã mở Admin cho lần mở trang này — máy lạ KHÔNG ghi nhớ, tải lại trang là khoá.');
  };

  const openAdmin = useCallback(() => {
    if (isAdmin) {
      if (window.confirm('Thoát chế độ Admin?')) {
        endAdminSession(safeStore);
        setMemAdmin(false);
        setAdminOn(false);
        showToast('🔒 Đã thoát Admin.');
      }
      return;
    }
    setAdminError('');
    setFMaster(''); setFPw2(''); setFPw2b('');
    setAdminStep({ kind: 'master' });
  }, [isAdmin, showToast]);

  const submitMaster = async () => {
    setAdminBusy(true);
    setAdminError('');
    const okMaster = await verifyMasterCode(fMaster);
    if (!okMaster) { setAdminBusy(false); setAdminError('❌ Sai mã chủ (KEY).'); return; }
    const localHash = getLocalPwHash(safeStore);
    if (localHash) {
      setAdminBusy(false);
      setAdminStep({ kind: 'pw2', mode: 'local', expectedHash: localHash });
      return;
    }
    const remote = await fetchRemotePwHash(defaultFetch);
    setAdminBusy(false);
    const step = decidePw2Step('', remote);
    if (step === 'blocked') {
      setAdminError('❌ Không đọc được máy chủ để kiểm mã Admin — kiểm tra mạng rồi thử lại.');
      return;
    }
    if (step === 'create') { setAdminStep({ kind: 'create' }); return; }
    setAdminStep({ kind: 'pw2', mode: 'remote', expectedHash: remote as string });
  };

  const submitCreatePw2 = async () => {
    if (fPw2.trim().length < 4) { setAdminError('⚠️ Mã Admin cần ít nhất 4 ký tự.'); return; }
    if (fPw2 !== fPw2b) { setAdminError('⚠️ Hai lần nhập mã Admin chưa khớp nhau.'); return; }
    setAdminBusy(true);
    setAdminError('');
    try {
      const hash = await sha256Hex(fPw2.trim());
      await saveRemotePwHash(defaultFetch, hash);
      setLocalPwHash(safeStore, hash);
    } catch {
      setAdminBusy(false);
      setAdminError('❌ Lưu mã Admin chưa được — kiểm tra mạng rồi thử lại.');
      return;
    }
    setAdminBusy(false);
    finishAdminLogin(true);
    showToast('🔑 Đã đặt mã Admin của thầy — từ nay mở Admin bằng mã chủ + mã này.');
  };

  const submitPw2 = async (step: { mode: 'local' | 'remote'; expectedHash: string }) => {
    setAdminBusy(true);
    setAdminError('');
    const okPw = await verifyPw2(fPw2, step.expectedHash);
    setAdminBusy(false);
    if (!okPw) { setAdminError('❌ Sai mã Admin của thầy.'); return; }
    finishAdminLogin(step.mode === 'local');
  };

  /* ----- Quản lý máy ----- */
  const [showMachines, setShowMachines] = useState(false);
  const [machines, setMachines] = useState<MachineRow[]>([]);
  const [machinesBusy, setMachinesBusy] = useState(false);
  const [machinesError, setMachinesError] = useState('');

  const loadMachines = useCallback(async () => {
    setMachinesBusy(true);
    setMachinesError('');
    try {
      setMachines(await fetchMachines(defaultFetch));
    } catch {
      setMachinesError('❌ Chưa tải được danh sách máy — kiểm tra mạng rồi thử lại.');
    }
    setMachinesBusy(false);
  }, []);

  const openMachines = useCallback(() => {
    setShowMachines(true);
    loadMachines();
  }, [loadMachines]);

  /* Xuất danh sách minh chứng: CSV toàn bộ máy trong panel (như trochoi). */
  const exportEvidence = () => {
    try {
      const blob = new Blob([buildMachinesCsv(machines)], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = evidenceCsvFilename(new Date());
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      showToast('📥 Đã xuất danh sách minh chứng (' + machines.length + ' máy).');
    } catch {
      setMachinesError('❌ Xuất danh sách chưa được — thử lại nhé.');
    }
  };

  const toggleMachine = async (row: MachineRow) => {
    const next = row.status === 'locked' ? 'active' : 'locked';
    if (next === 'locked' && !window.confirm('Khoá lại máy ' + row.mid + '? Máy đó sẽ bị chặn ở cổng đăng nhập ở lần mở trang kế tiếp.')) return;
    setMachinesBusy(true);
    try {
      await setMachineStatus(defaultFetch, row.mid, next, Date.now());
      showToast(next === 'locked' ? '🔒 Đã khoá máy ' + row.mid : '✅ Đã mở lại máy ' + row.mid);
      await loadMachines();
    } catch {
      setMachinesError('❌ Đổi trạng thái chưa được — thử lại nhé.');
    }
    setMachinesBusy(false);
  };

  const fmtTime = (ts: number) => {
    if (!ts) return '';
    try { return new Date(ts).toLocaleString('vi-VN'); } catch { return ''; }
  };

  /* ----- JSX ----- */
  const gateJsx = gateOpen && (
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

        {/* Thông báo chuyển hệ (thầy soạn sẵn — giữ nguyên văn) */}
        <div
          style={{
            padding: '11px 14px',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: 700,
            background: '#fffbeb',
            color: '#92400e',
            border: '1.5px solid #f59e0b',
            marginBottom: '14px',
            lineHeight: 1.45,
            textAlign: 'center',
            boxShadow: '0 6px 16px -6px rgba(245, 158, 11, 0.45)',
          }}
        >
          <i className="fa-solid fa-bullhorn" style={{ marginRight: '6px', color: '#d97706' }} />
          Do quá trình nâng cấp, làm phiền quý thầy cô xác nhận lại thông tin đăng nhập!
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
          <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#94a3b8', fontWeight: 600 }}>
            Mã máy của máy này (cố định):{' '}
            <b style={{ color: '#7c3aed', letterSpacing: '0.5px' }}>{deviceId}</b>
          </p>
        </div>

        {lockedNotice ? (
          <div style={{ textAlign: 'left' }}>
            <div
              style={{
                padding: '13px 15px',
                borderRadius: '12px',
                fontSize: '14.5px',
                fontWeight: 700,
                background: '#fff1f2',
                color: '#be123c',
                border: '1px solid #fecdd3',
                lineHeight: 1.5,
              }}
            >
              <i className="fa-solid fa-lock" style={{ marginRight: '6px' }} />
              Máy này đã bị Admin khoá quyền sử dụng phần mềm. Nếu thầy/cô cần mở
              lại, vui lòng liên hệ Admin — hoặc đăng nhập Admin ngay trên máy này
              để mở khoá ở panel Quản lý máy.
            </div>
          </div>
        ) : (
          <form
            id="formAuthGate"
            onSubmit={handleSubmit}
            style={{ textAlign: 'left' }}
          >
            {/* KHỐI 3D 1: ĐỊA CHỈ GMAIL */}
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

            {/* KHỐI 3D 2: HỌ VÀ TÊN */}
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

            {/* KHỐI 3D 3: TRƯỜNG CÔNG TÁC */}
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
                  <span>Đang kích hoạt máy này...</span>
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
              Đăng ký 1 lần duy nhất — hệ thống tự động kích hoạt ngay cho máy này
            </p>
          </form>
        )}

        {/* Điểm vào Admin (miễn cổng đăng ký) */}
        <button
          type="button"
          onClick={openAdmin}
          style={{
            marginTop: '14px',
            background: 'transparent',
            border: 'none',
            color: '#64748b',
            fontSize: '12.5px',
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: "'Times New Roman', Times, serif",
          }}
        >
          🔑 Đăng nhập Admin
        </button>
      </div>
    </div>
  );

  const modals = (
    <>
      {gateJsx}

      {adminStep && (
        <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) setAdminStep(null); }}>
          <div style={{ ...cardStyle, maxWidth: '440px' }}>
            <div style={{ textAlign: 'center', fontSize: '19px', fontWeight: 900, color: '#facc15' }}>🔑 ĐĂNG NHẬP ADMIN</div>
            {adminStep.kind === 'master' && (
              <>
                <p style={{ fontSize: '14.5px', margin: '10px 0 0' }}><b>Bước 1/2</b> — Nhập <b>mã chủ (KEY)</b> dùng chung các trang của thầy:</p>
                <label style={labelStyle}>Mã chủ</label>
                <input style={inputStyle} type="password" value={fMaster} autoFocus
                  onChange={e => setFMaster(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !adminBusy) submitMaster(); }} />
              </>
            )}
            {adminStep.kind === 'create' && (
              <>
                <p style={{ fontSize: '14.5px', margin: '10px 0 0', lineHeight: 1.6 }}>
                  <b>Bước 2/2</b> — Đây là <b>lần đầu</b> mở Admin: thầy <b>tự đặt mã Admin riêng</b> (khoá 2).
                  Mã này lưu dạng mã hoá ở máy chủ + tại máy này; từ nay mở Admin phải có đủ <b>mã chủ + mã này</b>.
                </p>
                <label style={labelStyle}>Đặt mã Admin (ít nhất 4 ký tự)</label>
                <input style={inputStyle} type="password" value={fPw2} autoFocus onChange={e => setFPw2(e.target.value)} />
                <label style={labelStyle}>Nhập lại mã Admin</label>
                <input style={inputStyle} type="password" value={fPw2b} onChange={e => setFPw2b(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !adminBusy) submitCreatePw2(); }} />
              </>
            )}
            {adminStep.kind === 'pw2' && (
              <>
                <p style={{ fontSize: '14.5px', margin: '10px 0 0', lineHeight: 1.6 }}>
                  <b>Bước 2/2</b> — Nhập <b>mã Admin của thầy</b> (khoá 2):
                  {adminStep.mode === 'remote'
                    ? ' Máy này là MÁY LẠ — mở được nhưng KHÔNG ghi nhớ, tải lại trang là khoá.'
                    : ' Máy này đã có mã Admin — mở được sẽ ghi nhớ phiên Admin.'}
                </p>
                <label style={labelStyle}>Mã Admin</label>
                <input style={inputStyle} type="password" value={fPw2} autoFocus
                  onChange={e => setFPw2(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !adminBusy) submitPw2(adminStep as any); }} />
              </>
            )}
            {adminError && <p style={{ color: '#fca5a5', fontWeight: 700, fontSize: '14px', margin: '10px 0 0' }}>{adminError}</p>}
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px', justifyContent: 'flex-end' }}>
              <button type="button" style={ghostBtn} onClick={() => setAdminStep(null)}>Huỷ</button>
              <button type="button" style={primaryBtn} disabled={adminBusy}
                onClick={() => {
                  if (adminStep.kind === 'master') submitMaster();
                  else if (adminStep.kind === 'create') submitCreatePw2();
                  else submitPw2(adminStep as any);
                }}>
                {adminBusy ? '⏳ Đang kiểm...' : '🔓 Mở Admin'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showMachines && (
        <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) setShowMachines(false); }}>
          <div style={{ ...cardStyle, maxWidth: '640px' }}>
            <div style={{ fontSize: '19px', fontWeight: 900, color: '#facc15' }}>🔐 QUẢN LÝ MÁY ĐÃ KÍCH HOẠT (Admin)</div>
            <p style={{ fontSize: '13.5px', color: '#fbbf24', fontWeight: 700, margin: '8px 0 0', lineHeight: 1.55 }}>
              ⚡ Chế độ TỰ ĐỘNG DUYỆT đang bật: máy gửi đăng ký là kích hoạt ngay, thầy không cần duyệt tay.
              Muốn thu hồi máy nào thì bấm 🔒 Khoá lại — máy đó bị chặn ở cổng ở lần mở trang kế tiếp.
            </p>
            {machinesError && <p style={{ color: '#fca5a5', fontWeight: 700, fontSize: '14px', margin: '10px 0 0' }}>{machinesError}</p>}
            {machinesBusy && <p style={{ fontSize: '14.5px', margin: '12px 0 0' }}>⏳ Đang tải danh sách...</p>}
            {!machinesBusy && machines.length === 0 && !machinesError && (
              <p style={{ fontSize: '14.5px', color: '#94a3b8', margin: '12px 0 0' }}>Chưa có máy nào đăng ký.</p>
            )}
            <div style={{ marginTop: '10px' }}>
              {machines.map(row => (
                <div key={row.mid} style={{ border: '1.5px solid #334155', borderRadius: '10px', padding: '9px 12px', margin: '7px 0', fontSize: '14px', lineHeight: 1.55 }}>
                  <b>{row.name || '?'}</b> — {row.school || '?'}<br />
                  ✉️ {row.email || '?'}<br />
                  🖥️ Mã máy: <b>{row.mid}</b>
                  {row.mid === deviceId && <span style={{ color: '#4ade80', fontWeight: 800 }}> (Máy chủ — máy này)</span>}
                  {' • '}{fmtTime(row.at)}
                  {' • '}{row.status === 'active'
                    ? <span style={{ color: '#4ade80', fontWeight: 800 }}>✅ Đã kích hoạt</span>
                    : row.status === 'locked'
                      ? <span style={{ color: '#f87171', fontWeight: 800 }}>🔒 Đã khoá</span>
                      : <span style={{ color: '#fbbf24', fontWeight: 800 }}>⏳ Chờ kích hoạt</span>}
                  <br />
                  {row.status === 'locked' ? (
                    <button type="button" disabled={machinesBusy} onClick={() => toggleMachine(row)}
                      style={{ marginTop: '6px', padding: '7px 14px', border: 0, borderRadius: '8px', background: '#2e9e4f', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>
                      ✔️ Mở lại
                    </button>
                  ) : (
                    <button type="button" disabled={machinesBusy} onClick={() => toggleMachine(row)}
                      style={{ marginTop: '6px', padding: '7px 14px', border: 0, borderRadius: '8px', background: row.status === 'pending' ? '#2e9e4f' : '#dc2626', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>
                      {row.status === 'pending' ? '✔️ Mở khoá' : '🔒 Khoá lại'}
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '14px', justifyContent: 'flex-end' }}>
              <button type="button" style={{ ...primaryBtn, marginRight: 'auto' }} disabled={machinesBusy || machines.length === 0} onClick={exportEvidence}>📥 Xuất danh sách minh chứng</button>
              <button type="button" style={ghostBtn} onClick={loadMachines}>↻ Tải lại</button>
              <button type="button" style={ghostBtn} onClick={() => setShowMachines(false)}>Đóng</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed', left: '50%', bottom: '22px', transform: 'translateX(-50%)', zIndex: 999995,
          background: '#1e293b', color: '#f8fafc', border: '1.5px solid #6366f1', borderRadius: '10px',
          padding: '10px 16px', fontSize: '14.5px', fontWeight: 700, boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
          maxWidth: '92vw', textAlign: 'center', fontFamily: "'Times New Roman', Times, serif"
        }}>{toast}</div>
      )}
    </>
  );

  return { user, deviceId, isAdmin, openAdmin, openMachines, modals };
}
