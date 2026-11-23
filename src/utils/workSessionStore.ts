import type { ExamQuestion } from '../types/exam';

/**
 * KHO TỰ LƯU BUỔI LÀM VIỆC (IndexedDB tại máy giáo viên):
 * Mỗi lần giáo viên sửa một câu trong Trình biên tập đề gốc, toàn bộ danh sách
 * câu hỏi hiện tại được tự động lưu vào đây (không cần bấm nút Lưu riêng).
 * Khi tải lại trang / mở lại app, buổi làm việc được khôi phục nguyên trạng —
 * các câu đã sửa giữ nguyên, danh sách lỗi được tính lại từ dữ liệu đã lưu.
 *
 * Chỉ lưu TẠI MÁY (IndexedDB của trình duyệt), không gửi đi đâu.
 */

export interface WorkSessionSnapshot {
  questions: ExamQuestion[];
  fileName: string;
  savedAt: number;
}

const DB_NAME = 'tronde_work_db';
const STORE_NAME = 'sessions';
const SESSION_KEY = 'current';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Trình duyệt không hỗ trợ IndexedDB'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Không mở được IndexedDB'));
  });
}

/** Lưu (ghi đè) buổi làm việc hiện tại. Nuốt mọi lỗi — tự lưu là nền, không bao giờ làm phiền giáo viên. */
export async function saveWorkSession(snapshot: WorkSessionSnapshot): Promise<boolean> {
  try {
    const db = await openDb();
    return await new Promise<boolean>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(snapshot, SESSION_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
    });
  } catch {
    return false;
  }
}

/**
 * Mốc dọn phiên cũ một lần (23/11/2026): các buổi làm việc được TỰ LƯU BỞI
 * BẢN CŨ — trước khi luật "tải về xong là xóa sạch nội dung đề + về trang
 * mặc định" có hiệu lực — bị hủy ngay khi mở app, không khôi phục nữa.
 * Phiên lưu sau mốc này (bản mới) vẫn khôi phục bình thường để chống mất
 * việc khi trình duyệt tắt giữa chừng lúc đang sửa đề.
 */
export const ZERO_TRACE_SESSION_EPOCH = 1795412670000; // 23/11/2026 12:44:30 (Asia/Bangkok)

/** Đọc buổi làm việc đã lưu (null nếu chưa có, đọc lỗi, hoặc là phiên cũ trước luật xóa sạch). */
export async function loadWorkSession(): Promise<WorkSessionSnapshot | null> {
  try {
    const db = await openDb();
    return await new Promise<WorkSessionSnapshot | null>((resolve) => {
      const req = db
        .transaction(STORE_NAME, 'readonly')
        .objectStore(STORE_NAME)
        .get(SESSION_KEY);
      req.onsuccess = () => {
        db.close();
        const val = req.result as WorkSessionSnapshot | undefined;
        if (
          val &&
          Array.isArray(val.questions) &&
          val.questions.length > 0 &&
          typeof val.savedAt === 'number' &&
          val.savedAt >= ZERO_TRACE_SESSION_EPOCH
        ) {
          resolve(val);
        } else {
          if (val) void clearWorkSession();
          resolve(null);
        }
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

/** Xóa buổi làm việc đã lưu (khi giáo viên chủ động làm mới hoàn toàn). */
export async function clearWorkSession(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(SESSION_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    });
  } catch {
    /* bỏ qua */
  }
}
