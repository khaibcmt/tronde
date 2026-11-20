// ============================================================================
// LƯU TRỮ ĐỀ GỐC VỀ GOOGLE CỦA THẦY (QuanLy_TronDe)
// ----------------------------------------------------------------------------
// Mỗi khi giáo viên trộn đề THÀNH CÔNG từ một file đề gốc đã tải lên
// (.docx / .doc / .pdf), module này gửi nền MỘT bản sao của chính file gốc đó
// về Google Apps Script của thầy (cùng endpoint với đăng ký giáo viên).
// Apps Script (hàm xử lý action "luu_de_goc") sẽ lưu file vào thư mục Drive
// "DeGoc_Tronde_LuuTru" và ghi log vào Sheet QuanLy_Tronde.
//
// Nguyên tắc an toàn:
// - Chạy nền, KHÔNG await trong luồng trộn đề, KHÔNG bao giờ ném lỗi ra ngoài.
// - Lỗi mạng / lỗi server: im lặng bỏ qua, lần trộn sau (file chưa gửi được)
//   sẽ tự thử lại.
// - Mỗi file phân biệt theo (tên + dung lượng + mốc sửa) chỉ gửi 1 lần/phiên.
// - File gốc lớn hơn MAX_ORIGINAL_FILE_BYTES thì bỏ qua có chủ đích:
//   Apps Script giới hạn thân POST khoảng 50 MB, mà base64 phình ~1,37 lần,
//   nên 30 MB file gốc (~41 MB dữ liệu gửi) là ngưỡng an toàn.
// - Phía Google: cần hàm xử lý action "luu_de_goc" trong Apps Script
//   QuanLy_TronDe (xem HUONG_DAN_DAN_APPS_SCRIPT.md trong thư mục bàn giao).
// ============================================================================

export const TRONDE_GOOGLE_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbzwdXDqUQbWShXFFYrgX17fCnhi0jc4TLFaoECm6DvTi8zcDO8i37dsxnLQfErZNRfj/exec';

export const MAX_ORIGINAL_FILE_BYTES = 30 * 1024 * 1024; // 30 MB

const SEND_TIMEOUT_MS = 120000;

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
 * Gửi bản sao đề gốc về Google của thầy. Hàm này KHÔNG bao giờ ném lỗi:
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

    const payload = {
      action: 'luu_de_goc',
      filename: file.name,
      mime: guessMime(file),
      sizeBytes: file.size,
      dataBase64,
      meta: {
        teacherGmail: args.teacher?.gmail || '',
        teacherName: args.teacher?.name || '',
        schoolName: args.teacher?.school || '',
        deviceId: readDeviceIdFallback(args.teacher),
        subjectName: args.subjectName || '',
        gradeLevel: args.gradeLevel || '',
        examTitle: args.examTitle || '',
        questionCount: args.questionCount ?? null,
        variantCount: args.variantCount ?? null,
        clientTime: new Date().toISOString(),
      },
    };

    const controller =
      typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller
      ? setTimeout(() => controller.abort(), SEND_TIMEOUT_MS)
      : null;
    try {
      const response = await fetch(TRONDE_GOOGLE_SCRIPT_URL, {
        method: 'POST',
        // text/plain = "simple request", tránh CORS preflight với Apps Script
        // (giống hệt cách cổng xác thực giáo viên đang gọi).
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
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
