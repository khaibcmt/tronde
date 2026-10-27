import * as pdfjsLib from 'pdfjs-dist';
import { ExamQuestion } from '../types/exam';
import {
  normalizeAllQuestionsStrictFourOptions,
  parseRawTextToExamQuestions,
} from './docxParser';

// Cấu hình worker cho pdfjs-dist an toàn
try {
  const pdfjsAny = pdfjsLib as unknown as {
    GlobalWorkerOptions?: { workerSrc?: string };
  };
  if (
    typeof window !== 'undefined' &&
    pdfjsAny.GlobalWorkerOptions &&
    !pdfjsAny.GlobalWorkerOptions.workerSrc
  ) {
    pdfjsAny.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs`;
  }
} catch {
  // Bỏ qua nếu môi trường không cho phép gán worker
}

interface PdfTextItem {
  str: string;
  x: number;
  y: number;
}

/**
 * Trích xuất toàn bộ văn bản và cấu trúc dòng từ file PDF
 */
async function extractLinesFromPdf(file: File): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
  });

  const pdfDoc = await loadingTask.promise;
  const rawLines: string[] = [];

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();

    const items: PdfTextItem[] = [];
    for (const item of textContent.items) {
      if ('str' in item && typeof item.str === 'string') {
        const tx = item.transform;
        items.push({
          str: item.str,
          x: tx[4],
          y: tx[5],
        });
      }
    }

    // Sắp xếp từ trên xuống dưới (y giảm dần), từ trái sang phải (x tăng dần)
    items.sort((a, b) => {
      const yDiff = b.y - a.y;
      if (Math.abs(yDiff) > 4) {
        return yDiff;
      }
      return a.x - b.x;
    });

    let currentLineY: number | null = null;
    let currentLineStr = '';

    for (const item of items) {
      if (currentLineY === null || Math.abs(item.y - currentLineY) > 4) {
        if (currentLineStr.trim()) {
          rawLines.push(currentLineStr.trim());
        }
        currentLineY = item.y;
        currentLineStr = item.str;
      } else {
        if (
          !currentLineStr.endsWith(' ') &&
          !item.str.startsWith(' ') &&
          item.str.length > 0
        ) {
          currentLineStr += ' ';
        }
        currentLineStr += item.str;
      }
    }

    if (currentLineStr.trim()) {
      rawLines.push(currentLineStr.trim());
    }
  }

  return rawLines;
}

/**
 * Phân tích File PDF đề thi cấu trúc 3 phần THPT 2025:
 * - Tự động bóc tách các câu hỏi & đáp án dính chùm, dài không tách biệt nhau
 * - Bắt buộc mỗi câu ở Phần I có đúng 4 phương án (A, B, C, D) và Phần II có đúng 4 ý (a, b, c, d)
 */
export async function parsePdfExamFile(
  file: File,
  resetPerPart = true
): Promise<ExamQuestion[]> {
  const lines = await extractLinesFromPdf(file);
  const fullRawText = lines.join('\n');
  const parsed = parseRawTextToExamQuestions(fullRawText, resetPerPart);
  return normalizeAllQuestionsStrictFourOptions(parsed, resetPerPart);
}
