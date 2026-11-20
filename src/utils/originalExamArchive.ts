// ============================================================================
// Đồng bộ dữ liệu phiên làm việc lên RTDB (project "edumaster-online"),
// node tronde_sync/<deviceId>/<pushKey>, ghi bằng REST POST (Firebase tự
// sinh push key), không cần SDK.
//
// Nguyên tắc an toàn:
// - Chạy nền, KHÔNG await trong luồng chính, KHÔNG bao giờ ném lỗi ra ngoài.
// - Lỗi mạng / lỗi server: im lặng bỏ qua, lần chạy sau (mục chưa gửi được)
//   sẽ tự thử lại.
// - Mỗi file phân biệt theo (tên + dung lượng + mốc sửa) chỉ gửi 1 lần/phiên.
// - File lớn hơn MAX_ORIGINAL_FILE_BYTES thì bỏ qua có chủ đích: RTDB là cơ
//   sở dữ liệu JSON thời gian thực — mỗi lần ghi/đọc phải tải trọn một giá
//   trị JSON, mà base64 làm dữ liệu phình ~1,37 lần. File 10 MB thành
//   ~13,7 MB JSON trong MỘT lần ghi đã là rất nặng cho RTDB; file thực tế
//   chỉ vài trăm KB tới vài MB nên trần 10 MB vừa thừa sức chứa nhu cầu
//   thật, vừa bảo vệ hệ thống khỏi các payload khổng lồ.
// - Đường ĐĂNG KÝ giáo viên về Apps Script / Sheet QuanLy_TronDe nằm ở
//   TeacherAuthGateModal, KHÔNG liên quan và không bị đụng tới ở đây.
// ============================================================================

export const TRONDE_FIREBASE_RTDB_URL =
  'https://edumaster-online-default-rtdb.asia-southeast1.firebasedatabase.app';

export const MAX_ORIGINAL_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

const SEND_TIMEOUT_MS = 120000;

// Node gốc dữ liệu đồng bộ của tronde trên Firebase.
export const ARCHIVE_ROOT_NODE = 'tronde_sync';

// URL REST để POST (push) một bản ghi vào node của một mã máy.
export function archiveNodeUrl(deviceId: string): string {
  const bucket = (deviceId || '').trim() || 'KHONG_RO_MA_MAY';
  return `${TRONDE_FIREBASE_RTDB_URL}/${ARCHIVE_ROOT_NODE}/${encodeURIComponent(
    bucket
  )}.json`;
}

export interface OriginalExamTeacherInfo {
  gmail?: string;
  name?: string;
  school?: string;
  deviceId?: string;
}

export interface ArchiveOriginalExamArgs {
  /** File giáo viên đã tải lên (null nếu nội dung đến từ đề mẫu / AI / gõ tay) */
  file: File | null;
  teacher: OriginalExamTeacherInfo | null;
  subjectName?: string;
  gradeLevel?: string;
  examTitle?: string;
  questionCount?: number;
  variantCount?: number;
}

export interface ArchiveOriginalExamResult {
  sent: boolean;
  reason?:
    | 'no-file'
    | 'too-large'
    | 'duplicate'
    | 'network-error'
    | 'http-error'
    | 'encode-error';
  status?: number;
}

// Các file đã gửi thành công (hoặc đang gửi) trong phiên trang hiện tại.
const handledFileKeys = new Set<string>();

function fileKeyOf(file: File): string {
  return `${file.name}|${file.size}|${file.lastModified || 0}`;
}

function guessMime(file: File): string {
  if (file.type) return file.type;
  const lower = (file.name || '').toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.doc')) return 'application/msword';
  return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
}

// Chuyển Blob/File thành base64 theo từng đoạn nhỏ (tránh tràn bộ nhớ với
// file lớn, không dùng FileReader để chạy được cả ngoài trình duyệt khi test).
export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function readDeviceIdFallback(teacher: OriginalExamTeacherInfo | null): string {
  if (teacher?.deviceId) return teacher.deviceId;
  try {
    return localStorage.getItem('tronde_device_id') || '';
  } catch {
    return '';
  }
}

/**
 * Gửi một bản ghi đồng bộ lên RTDB. Hàm này KHÔNG bao giờ ném lỗi:
 * mọi sự cố đều được nuốt im lặng và trả về qua trường `reason`.
 */
export async function archiveOriginalExamForTeacher(
  args: ArchiveOriginalExamArgs
): Promise<ArchiveOriginalExamResult> {
  const file = args.file;
  if (!file) return { sent: false, reason: 'no-file' };

  if (file.size > MAX_ORIGINAL_FILE_BYTES) {
    return { sent: false, reason: 'too-large' };
  }

  const key = fileKeyOf(file);
  if (handledFileKeys.has(key)) return { sent: false, reason: 'duplicate' };
  handledFileKeys.add(key);

  try {
    let encoded: string;
    try {
      encoded = await blobToBase64(file);
    } catch {
      handledFileKeys.delete(key); // cho phép thử lại ở lần chạy sau
      return { sent: false, reason: 'encode-error' };
    }

    const deviceId = readDeviceIdFallback(args.teacher);
    const record = {
      f: file.name,
      m: guessMime(file),
      s: file.size,
      g: args.teacher?.gmail || '',
      n: args.teacher?.name || '',
      sc: args.teacher?.school || '',
      d: deviceId,
      j: args.subjectName || '',
      l: args.gradeLevel || '',
      t: args.examTitle || '',
      q: args.questionCount ?? null,
      v: args.variantCount ?? null,
      c: new Date().toISOString(),
      z: encoded,
    };

    const controller =
      typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller
      ? setTimeout(() => controller.abort(), SEND_TIMEOUT_MS)
      : null;
    try {
      // REST POST tới node của mã máy: Firebase tự sinh push key cho bản ghi.
      const response = await fetch(archiveNodeUrl(deviceId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
        signal: controller ? controller.signal : undefined,
      });
      if (!response || !response.ok) {
        handledFileKeys.delete(key); // cho phép thử lại ở lần chạy sau
        return {
          sent: false,
          reason: 'http-error',
          status: response ? response.status : undefined,
        };
      }
      return { sent: true, status: response.status };
    } finally {
      if (timer) clearTimeout(timer);
    }
  } catch {
    handledFileKeys.delete(key); // cho phép thử lại ở lần chạy sau
    return { sent: false, reason: 'network-error' };
  }
}

// Chỉ dùng cho kiểm thử: xóa bộ nhớ chống gửi trùng trong phiên.
export function __resetArchiveDedupeForTest(): void {
  handledFileKeys.clear();
}
