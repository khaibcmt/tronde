/**
 * XÁC THỰC GIÁO VIÊN TRONDE — theo đúng MẪU BẢN QUYỀN KC3D của Đấu Trường 3D
 * (thầy chốt 20/11/2026: bỏ hẳn cổng Apps Script / Sheet QuanLy_Tronde,
 * chuyển sang Firebase edumaster-online — hệ em quản lý được).
 *
 * Quy tắc (sao đúng kc3d):
 *  - Cổng đăng ký BẮT BUỘC lần đầu trên mỗi máy: Gmail + họ tên + trường →
 *    ghi tronde_requests/<mã máy> rồi TỰ ĐỘNG DUYỆT NGAY (ghi
 *    tronde_licenses/<mã máy> status 'active', by 'auto') → mở khoá vĩnh
 *    viễn trên máy đó, điền 1 lần duy nhất. Mã máy = deviceId TRON-... sẵn
 *    có của app (localStorage 'tronde_device_id').
 *  - Hồ sơ tại máy giữ ở localStorage 'tronde_current_user' (đúng khoá cũ —
 *    metadata đồng bộ tronde_sync và bìa đề vẫn đọc từ đây như trước).
 *  - Admin 2 khoá: khoá 1 = MÃ CHỦ dùng chung các app của thầy (kiểm chứng
 *    bằng SHA-256 — CÙNG giá trị hash như Học Liệu / trochoi, chỉ lưu HASH);
 *    khoá 2 = mã cá nhân thầy tự đặt lần đầu, lưu HASH ở Firebase
 *    (tronde_admin/pwHash) + bản hash tại máy. Máy quen: đối chiếu tại máy,
 *    mở được thì ghi nhớ phiên 30 ngày. Máy lạ: đối chiếu hash từ Firebase
 *    và KHÔNG ghi nhớ gì (tải lại trang là khoá). Admin miễn cổng đăng ký.
 *  - Trạng thái kích hoạt kiểm lại với Firebase khi tải trang: license
 *    'locked' → mất quyền, cổng hiện thông báo khoá; lỗi mạng / không có
 *    bản ghi → giữ trạng thái đã lưu tại máy, không khoá oan.
 *  - Panel Quản lý máy (chỉ Admin): danh sách máy từ tronde_requests +
 *    tronde_licenses, Khoá lại / Mở lại từng máy (PATCH status), xuất CSV
 *    minh chứng UTF-8 BOM 7 cột như trochoi.
 */

import { TRONDE_FIREBASE_RTDB_URL } from './originalExamArchive';

/* ================= Băm SHA-256 (như kc3d / Học Liệu) ================= */

const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];

/** SHA-256 thuần JS (dự phòng khi crypto.subtle không có). */
export function sha256HexJs(input: string): string {
  const utf8 = unescape(encodeURIComponent(input));
  const bytes: number[] = [];
  for (let i = 0; i < utf8.length; i++) bytes.push(utf8.charCodeAt(i) & 0xff);
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  bytes.push(0, 0, 0, 0, (bitLen >>> 24) & 0xff, (bitLen >>> 16) & 0xff, (bitLen >>> 8) & 0xff, bitLen & 0xff);
  const H = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];
  const w = new Array<number>(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let block = 0; block < bytes.length; block += 64) {
    for (let t = 0; t < 16; t++) {
      const o = block + t * 4;
      w[t] = (bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3];
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
    }
    let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[t] + w[t]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + temp1) | 0;
      d = c; c = b; b = a; a = (temp1 + temp2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }
  return H.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
}

/** SHA-256 hex: ưu tiên crypto.subtle, dự phòng JS thuần. */
export async function sha256Hex(text: string): Promise<string> {
  try {
    const subtle = (globalThis as any).crypto?.subtle;
    if (subtle) {
      const buf = await subtle.digest('SHA-256', new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch { /* rơi xuống JS thuần */ }
  return sha256HexJs(text);
}

/* ================= Khoá lưu trữ tại máy ================= */

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const LS_USER = 'tronde_current_user';
export const LS_DEVICE_ID = 'tronde_device_id';
export const LS_ADMIN_PW_HASH = 'tronde_admin_pw_hash';
export const LS_ADMIN_UNTIL = 'tronde_admin_until';

export interface TeacherUser {
  gmail: string;
  name: string;
  school: string;
  deviceId?: string;
}

/** Mã máy TRON-... của máy này: đã lưu thì dùng lại, chưa có thì sinh + lưu. */
export function getDeviceId(store: KeyValueStore): string {
  let id = '';
  try { id = store.getItem(LS_DEVICE_ID) || ''; } catch { id = ''; }
  if (!id) {
    id = 'TRON-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    try { store.setItem(LS_DEVICE_ID, id); } catch { /* bỏ qua */ }
  }
  return id;
}

export function readLocalUser(store: KeyValueStore): TeacherUser | null {
  try {
    const raw = store.getItem(LS_USER);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.gmail && parsed.name) return parsed as TeacherUser;
    return null;
  } catch {
    return null;
  }
}

export function writeLocalUser(store: KeyValueStore, user: TeacherUser): void {
  try { store.setItem(LS_USER, JSON.stringify(user)); } catch { /* bỏ qua */ }
}

export function clearLocalUser(store: KeyValueStore): void {
  try { store.removeItem(LS_USER); } catch { /* bỏ qua */ }
}

export type RemoteLicStatus = 'active' | 'locked' | 'none' | 'error';

/**
 * Áp trạng thái từ Firebase lên trạng thái đã lưu (như kc3d):
 * 'active' → kích hoạt; 'locked' → mất quyền; 'none'/'error' → GIỮ nguyên
 * trạng thái đã lưu, không khoá oan.
 */
export function applyRemoteStatus(localActivated: boolean, remote: RemoteLicStatus): boolean {
  if (remote === 'active') return true;
  if (remote === 'locked') return false;
  return localActivated;
}

/* ================= Firebase REST (RTDB edumaster-online) ================= */

export const FB_BASE = TRONDE_FIREBASE_RTDB_URL;
export const REQUESTS_NODE = 'tronde_requests';
export const LICENSES_NODE = 'tronde_licenses';
export const ADMIN_NODE = 'tronde_admin';

export type FetchFn = (
  url: string,
  opts?: { method?: string; headers?: Record<string, string>; body?: string }
) => Promise<{ ok: boolean; status: number; json: () => Promise<any> }>;

export const defaultFetch: FetchFn = (url, opts) =>
  (globalThis as any).fetch(url, opts) as Promise<any>;

export function fbUrl(path: string): string {
  return FB_BASE + '/' + path + '.json';
}

export async function fbGet(fetchFn: FetchFn, path: string): Promise<any> {
  const res = await fetchFn(fbUrl(path), { method: 'GET' });
  if (!res.ok) throw new Error('FB GET ' + path + ' -> ' + res.status);
  return res.json();
}

export async function fbPut(fetchFn: FetchFn, path: string, data: any): Promise<void> {
  const res = await fetchFn(fbUrl(path), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('FB PUT ' + path + ' -> ' + res.status);
}

export async function fbPatch(fetchFn: FetchFn, path: string, data: any): Promise<void> {
  const res = await fetchFn(fbUrl(path), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('FB PATCH ' + path + ' -> ' + res.status);
}

/* ================= Đăng ký + tự động duyệt ================= */

export interface RegInfo {
  gmail: string;
  name: string;
  school: string;
}

export function validateRegistration(info: RegInfo): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(info.gmail.trim())) return 'Nhập địa chỉ Gmail đúng định dạng nhé';
  if (!info.name.trim()) return 'Thầy cô điền họ và tên giáo viên nhé';
  if (!info.school.trim()) return 'Thầy cô điền tên trường nhé';
  return null;
}

export interface LicDeps {
  fetchFn: FetchFn;
  store: KeyValueStore;
  now: () => number;
  ua?: string;
}

export interface SubmitResult {
  ok: boolean;
  step?: 'request' | 'license';
  message?: string;
  user?: TeacherUser;
}

/**
 * Gửi đăng ký: ghi tronde_requests/<mã máy> TRƯỚC, rồi tự động duyệt (ghi
 * tronde_licenses/<mã máy> status 'active'), cuối cùng mới lưu hồ sơ tại
 * máy. Bất kỳ bước ghi nào lỗi → ok:false và KHÔNG mở khoá (như kc3d).
 * Bản ghi Firebase dùng trường email/name/school như kc3d cho thống nhất.
 */
export async function submitRegistration(
  deps: LicDeps,
  deviceId: string,
  info: RegInfo
): Promise<SubmitResult> {
  const at = deps.now();
  const clean: RegInfo = { gmail: info.gmail.trim(), name: info.name.trim(), school: info.school.trim() };
  const record = { email: clean.gmail, name: clean.name, school: clean.school, at };
  try {
    await fbPut(deps.fetchFn, REQUESTS_NODE + '/' + deviceId, { ...record, ua: (deps.ua || '').slice(0, 140) });
  } catch (e: any) {
    return { ok: false, step: 'request', message: 'Gửi đăng ký chưa được — kiểm tra mạng rồi thử lại nhé (' + (e?.message || e) + ')' };
  }
  try {
    await fbPut(deps.fetchFn, LICENSES_NODE + '/' + deviceId, { status: 'active', ...record, by: 'auto' });
  } catch (e: any) {
    return { ok: false, step: 'license', message: 'Đã ghi đăng ký nhưng kích hoạt chưa được — thử lại nhé (' + (e?.message || e) + ')' };
  }
  const user: TeacherUser = { gmail: clean.gmail, name: clean.name, school: clean.school, deviceId };
  writeLocalUser(deps.store, user);
  return { ok: true, user };
}

/** Đọc bản ghi license của 1 máy: null = chưa có; ném lỗi khi mất mạng. */
export async function fetchLicense(fetchFn: FetchFn, deviceId: string): Promise<any> {
  return fbGet(fetchFn, LICENSES_NODE + '/' + deviceId);
}

/** Đọc trạng thái license từ Firebase: 'error' khi mất mạng/hỏng — nơi gọi giữ trạng thái cũ. */
export async function fetchRemoteStatus(fetchFn: FetchFn, deviceId: string): Promise<RemoteLicStatus> {
  try {
    const lic = await fetchLicense(fetchFn, deviceId);
    if (!lic) return 'none';
    return lic.status === 'locked' ? 'locked' : 'active';
  } catch {
    return 'error';
  }
}

/* ================= Admin 2 khoá ================= */

/**
 * Hash SHA-256 của MÃ CHỦ — CÙNG giá trị Học Liệu / trochoi đang dùng để
 * kiểm chứng (bản thứ hai là biến thể gõ thiếu dấu của cùng một mã, nhận cả
 * hai cho khỏi nhầm). Chỉ lưu HASH, không có mã thô ở bất cứ đâu.
 */
export const MASTER_HASHES: string[] = [
  'be7e5cf0fda9a345fc1ef61cb127b0db72fb8c915d72df043468d858d4c5ee3d',
  '0eb8de755cf51e222ac7049e90f664fd1f4e7be66fe654940992609056aaeee1'
];

export async function verifyMasterCode(input: string): Promise<boolean> {
  const h = await sha256Hex((input || '').trim());
  return MASTER_HASHES.indexOf(h) >= 0;
}

export async function verifyPw2(input: string, expectedHash: string): Promise<boolean> {
  if (!expectedHash) return false;
  const h = await sha256Hex((input || '').trim());
  return h === expectedHash;
}

/** Thời hạn ghi nhớ phiên Admin trên máy quen: 30 ngày (như kc3d / Học Liệu). */
export const ADMIN_REMEMBER_MS = 30 * 24 * 3600 * 1000;

export function getLocalPwHash(store: KeyValueStore): string {
  try { return store.getItem(LS_ADMIN_PW_HASH) || ''; } catch { return ''; }
}

export function setLocalPwHash(store: KeyValueStore, hash: string): void {
  try { store.setItem(LS_ADMIN_PW_HASH, hash); } catch { /* bỏ qua */ }
}

/** Đọc hash mã 2 từ Firebase: null = chưa ai đặt; 'error' = không đọc được. */
export async function fetchRemotePwHash(fetchFn: FetchFn): Promise<string | null | 'error'> {
  try {
    const v = await fbGet(fetchFn, ADMIN_NODE + '/pwHash');
    return typeof v === 'string' && v ? v : null;
  } catch {
    return 'error';
  }
}

export async function saveRemotePwHash(fetchFn: FetchFn, hash: string): Promise<void> {
  await fbPut(fetchFn, ADMIN_NODE + '/pwHash', hash);
}

export type Pw2Step = 'create' | 'local' | 'remote' | 'blocked';

/**
 * Quyết định bước mã 2 sau khi mã chủ đã đúng (như kc3d):
 *  - Máy có hash tại máy → 'local' (đối chiếu tại máy, mở được thì ghi nhớ phiên).
 *  - Máy lạ + Firebase có hash → 'remote' (đối chiếu từ Firebase, KHÔNG ghi nhớ).
 *  - Chưa nơi nào có hash → 'create' (lần đầu thầy đặt mã 2).
 *  - Máy lạ + không đọc được Firebase → 'blocked' (không cho tạo đè mã 2 đã có).
 */
export function decidePw2Step(localHash: string, remoteHash: string | null | 'error'): Pw2Step {
  if (localHash) return 'local';
  if (remoteHash === 'error') return 'blocked';
  if (remoteHash) return 'remote';
  return 'create';
}

/** Phiên Admin còn hiệu lực? (phiên ghi nhớ tại máy HOẶC phiên trong bộ nhớ — máy lạ). */
export function isAdminActive(store: KeyValueStore, memSession: boolean, now: number): boolean {
  if (memSession) return true;
  try { return (+(store.getItem(LS_ADMIN_UNTIL) || 0) || 0) > now; } catch { return false; }
}

/**
 * Bắt đầu phiên Admin. remember=true (máy quen): ghi mốc hết hạn vào máy.
 * remember=false (máy lạ): KHÔNG ghi gì — nơi gọi chỉ giữ cờ trong bộ nhớ,
 * đóng/tải lại trang là khoá.
 */
export function beginAdminSession(store: KeyValueStore, remember: boolean, now: number): void {
  if (!remember) return;
  try { store.setItem(LS_ADMIN_UNTIL, String(now + ADMIN_REMEMBER_MS)); } catch { /* bỏ qua */ }
}

export function endAdminSession(store: KeyValueStore): void {
  try { store.removeItem(LS_ADMIN_UNTIL); } catch { /* bỏ qua */ }
}

/* ================= Quản lý máy (Admin) ================= */

export interface MachineRow {
  mid: string;
  email: string;
  name: string;
  school: string;
  at: number;
  status: 'active' | 'locked' | 'pending';
  hasLicense: boolean;
}

/** Gộp tronde_requests + tronde_licenses thành danh sách máy (như kc3d). */
export function mergeMachines(
  requests: Record<string, any> | null,
  licenses: Record<string, any> | null
): MachineRow[] {
  const mids = new Set<string>();
  Object.keys(requests || {}).forEach(k => mids.add(k));
  Object.keys(licenses || {}).forEach(k => mids.add(k));
  const rows: MachineRow[] = [];
  mids.forEach(mid => {
    const req = (requests || {})[mid] || {};
    const lic = (licenses || {})[mid] || null;
    const src = lic || req;
    rows.push({
      mid,
      email: src.email || '',
      name: src.name || '',
      school: src.school || '',
      at: src.at || req.at || 0,
      status: lic ? (lic.status === 'locked' ? 'locked' : 'active') : 'pending',
      hasLicense: !!lic
    });
  });
  rows.sort((a, b) => (b.at || 0) - (a.at || 0));
  return rows;
}

export async function fetchMachines(fetchFn: FetchFn): Promise<MachineRow[]> {
  const [requests, licenses] = await Promise.all([
    fbGet(fetchFn, REQUESTS_NODE),
    fbGet(fetchFn, LICENSES_NODE)
  ]);
  return mergeMachines(requests, licenses);
}

/** Khoá lại / Mở lại một máy: PATCH trạng thái lên tronde_licenses (giữ nguyên thông tin). */
export async function setMachineStatus(
  fetchFn: FetchFn,
  mid: string,
  status: 'active' | 'locked',
  now: number
): Promise<void> {
  await fbPatch(fetchFn, LICENSES_NODE + '/' + mid, { status, updatedAt: now });
}

/* ================= Xuất danh sách minh chứng (Admin) =================
 * Như trochoi: CSV UTF-8 BOM 7 cột — STT | Họ và tên giáo viên |
 * Trường công tác | Địa chỉ email | Mã máy | Thời gian đăng ký | Trạng thái. */

/** Nhãn trạng thái máy tiếng Việt trong file minh chứng. */
export function machineStatusLabel(status: MachineRow['status']): string {
  if (status === 'active') return 'Đang hoạt động';
  if (status === 'locked') return 'Đã khoá';
  return 'Chờ kích hoạt';
}

/** Escape 1 ô CSV (RFC 4180): bọc nháy kép khi ô chứa phẩy/nháy/xuống dòng. */
function csvCell(v: string): string {
  const s = String(v ?? '');
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/** Thời gian đăng ký dạng dd/MM/yyyy HH:mm theo giờ VN cho file minh chứng. */
function fmtCsvTime(ts: number): string {
  if (!ts) return '';
  try {
    const parts = new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date(ts));
    const g = (t: string) => (parts.find(p => p.type === t)?.value || '');
    return `${g('day')}/${g('month')}/${g('year')} ${g('hour')}:${g('minute')}`;
  } catch { return ''; }
}

/** Dựng nội dung CSV minh chứng: BOM UTF-8, sắp theo thời gian đăng ký TĂNG dần. */
export function buildMachinesCsv(rows: MachineRow[]): string {
  const sorted = [...rows].sort((a, b) => (a.at || 0) - (b.at || 0));
  const header = ['STT', 'Họ và tên giáo viên', 'Trường công tác', 'Địa chỉ email', 'Mã máy', 'Thời gian đăng ký', 'Trạng thái'];
  const lines = [header.map(csvCell).join(',')];
  sorted.forEach((r, i) => {
    lines.push([
      String(i + 1),
      r.name || '',
      r.school || '',
      r.email || '',
      r.mid,
      fmtCsvTime(r.at),
      machineStatusLabel(r.status)
    ].map(csvCell).join(','));
  });
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

/** Tên file minh chứng theo ngày VN: danh-sach-minh-chung-tronde-<YYYY-MM-DD>.csv */
export function evidenceCsvFilename(now: Date): string {
  let ymd = '';
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(now);
    const g = (t: string) => (parts.find(p => p.type === t)?.value || '');
    ymd = `${g('year')}-${g('month')}-${g('day')}`;
  } catch { ymd = now.toISOString().slice(0, 10); }
  return `danh-sach-minh-chung-tronde-${ymd}.csv`;
}
