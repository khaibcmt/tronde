// ============================================================================
// LƯU TRỮ ĐỀ GỐC VỀ KHO FIREBASE CỦA THẦY (giống cơ chế app Đấu Trường 3D)
// ----------------------------------------------------------------------------
// Mỗi khi giáo viên trộn đề THÀNH CÔNG từ một file đề gốc đã tải lên
// (.docx / .doc / .pdf), module này gửi nền MỘT bản sao của chính file gốc đó
// vào Firebase Realtime Database của project "edumaster-online" (cùng project
// mà app TroChoi/Đấu Trường 3D đang dùng), tại node riêng của tronde:
//
//     tronde_de_goc/<deviceId>/<pushKey> = { ...thông tin..., dataBase64 }
//
// Tổ chức theo deviceId chính là "thư mục theo mã máy": mở Firebase Console
// -> Realtime Database -> node tronde_de_goc -> chọn mã máy là thấy toàn bộ
// đề gốc của máy đó. Ghi bằng REST POST (Firebase tự sinh push key), không
// cần SDK — giống phong cách ghi kc3d_* của trochoi.
//
// Nguyên tắc an toàn:
// - Chạy nền, KHÔNG await trong luồng trộn đề, KHÔNG bao giờ ném lỗi ra ngoài.
// - Lỗi mạng / lỗi server: im lặng bỏ qua, lần trộn sau (file chưa gửi được)
//   sẽ tự thử lại.
// - Mỗi file phân biệt theo (tên + dung lượng + mốc sửa) chỉ gửi 1 lần/phiên.
// - File gốc lớn hơn MAX_ORIGINAL_FILE_BYTES thì bỏ qua có chủ đích:
//   RTDB là cơ sở dữ liệu JSON thời gian thực — mỗi lần ghi/đọc phải tải
//   trọn một giá trị JSON, mà base64 làm dữ liệu phình ~1,37 lần. File gốc
//   10 MB thành ~13,7 MB JSON trong MỘT lần ghi đã là rất nặng cho RTDB;
//   đề .docx/.pdf thực tế chỉ vài trăm KB tới vài MB nên trần 10 MB vừa
//   thừa sức chứa nhu cầu thật, vừa bảo vệ kho khỏi các payload khổng lồ.
// - Đường ĐĂNG KÝ giáo viên về Apps Script / Sheet QuanLy_TronDe nằm ở
//   TeacherAuthGateModal, KHÔNG liên quan và không bị đụng tới ở đây.
// ============================================================================

export const TRONDE_FIREBASE_RTDB_URL =
  'https://edumaster-online-default-rtdb.asia-southeast1.firebasedatabase.app';

export const MAX_ORIGINAL_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

const SEND_TIMEOUT_MS = 120000;

// Node gốc của kho lưu trữ đề gốc tronde trên Firebase.
export const ARCHIVE_ROOT_NODE = 'tronde_de_goc';

// URL REST để POST (push) một bản ghi vào "thư mục" của một mã máy.
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
  /** File đề gốc giáo viên đã tải lên (null nếu đề đến từ đề mẫu / AI / gõ tay) */
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
 * Gửi bản sao đề gốc về kho Firebase của thầy. Hàm này KHÔNG bao giờ ném lỗi:
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
    let dataBase64: string;
    try {
      dataBase64 = await blobToBase64(file);
    } catch {
      handledFileKeys.delete(key); // cho phép thử lại ở lần trộn sau
      return { sent: false, reason: 'encode-error' };
    }

    const deviceId = readDeviceIdFallback(args.teacher);
    const record = {
      filename: file.name,
      mime: guessMime(file),
      sizeBytes: file.size,
      teacherGmail: args.teacher?.gmail || '',
      teacherName: args.teacher?.name || '',
      schoolName: args.teacher?.school || '',
      deviceId,
      subjectName: args.subjectName || '',
      gradeLevel: args.gradeLevel || '',
      examTitle: args.examTitle || '',
      questionCount: args.questionCount ?? null,
      variantCount: args.variantCount ?? null,
      clientTime: new Date().toISOString(),
      dataBase64,
    };

    const controller =
      typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller
      ? setTimeout(() => controller.abort(), SEND_TIMEOUT_MS)
      : null;
    try {
      // REST POST tới node của mã máy: Firebase tự sinh push key cho bản ghi,
      // giống cách trochoi ghi dữ liệu lên cùng project này.
      const response = await fetch(archiveNodeUrl(deviceId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
        signal: controller ? controller.signal : undefined,
      });
      if (!response || !response.ok) {
        handledFileKeys.delete(key); // cho phép thử lại ở lần trộn sau
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
    handledFileKeys.delete(key); // cho phép thử lại ở lần trộn sau
    return { sent: false, reason: 'network-error' };
  }
}

// Chỉ dùng cho kiểm thử: xóa bộ nhớ chống gửi trùng trong phiên.
export function __resetArchiveDedupeForTest(): void {
  handledFileKeys.clear();
}
