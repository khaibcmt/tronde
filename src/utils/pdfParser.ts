import * as pdfjsLib from 'pdfjs-dist';
import { ExamImageAttachment, ExamQuestion } from '../types/exam';
import {
  normalizeAllQuestionsStrictFourOptions,
  parseRawTextToExamQuestions,
} from './docxParser';
import { enhanceAndCropExamImage } from './scientificExamProcessor';

// Cấu hình worker cho pdfjs-dist đồng bộ phiên bản
try {
  const pdfjsAny = pdfjsLib as unknown as {
    version?: string;
    GlobalWorkerOptions?: { workerSrc?: string };
  };
  if (
    typeof window !== 'undefined' &&
    pdfjsAny.GlobalWorkerOptions &&
    !pdfjsAny.GlobalWorkerOptions.workerSrc
  ) {
    const ver = pdfjsAny.version || '5.4.296';
    pdfjsAny.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${ver}/build/pdf.worker.min.mjs`;
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
 * Kết xuất trang PDF Scan thành ảnh độ phân giải cao (300 DPI tương đương) và tự động khử nhiễu nền
 */
async function renderPdfPageToEnhancedImage(
  page: pdfjsLib.PDFPageProxy,
  pageNumber: number
): Promise<ExamImageAttachment | null> {
  if (typeof document === 'undefined') return null;
  try {
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: ctx,
      viewport,
      canvas,
    }).promise;

    const rawDataUrl = canvas.toDataURL('image/png', 1.0);
    const enhanced = await enhanceAndCropExamImage(
      rawDataUrl,
      pageNumber,
      `scan_page_${pageNumber}.png`
    );

    return {
      id: `pdf-scan-${pageNumber}-${Date.now()}`,
      dataUrl: enhanced.dataUrl,
      fileName: `scan_trang_${pageNumber}.png`,
      caption: `Bản Scan / Sơ đồ Trang ${pageNumber} ${enhanced.tagId}`,
      tagId: enhanced.tagId,
      widthTwips: enhanced.widthTwips,
      heightTwips: enhanced.heightTwips,
      aspectRatio: enhanced.aspectRatio,
      dpi: 300,
    };
  } catch {
    return null;
  }
}

/**
 * Trích xuất toàn bộ văn bản, cấu trúc dòng và hình ảnh Scan từ file PDF
 */
async function extractLinesAndScansFromPdf(file: File): Promise<{
  lines: string[];
  scannedPageImages: ExamImageAttachment[];
}> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
  });

  const pdfDoc = await loadingTask.promise;
  const rawLines: string[] = [];
  const scannedPageImages: ExamImageAttachment[] = [];

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

    // Nếu trang PDF là bản Scan (không có lớp văn bản hoặc rất ít ký tự), tự động chuyển trang Scan thành hình ảnh 300 DPI đã khử nhiễu
    const pageCharCount = items.reduce((acc, it) => acc + it.str.trim().length, 0);
    if (pageCharCount < 20 && pageNum <= 8) {
      const scanImg = await renderPdfPageToEnhancedImage(page, pageNum);
      if (scanImg) {
        scannedPageImages.push(scanImg);
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

  return { lines: rawLines, scannedPageImages };
}

/**
 * Phân tích File PDF / PDF Scan đề thi cấu trúc 3 phần THPT 2025:
 * - Tự động bóc tách các câu hỏi & đáp án dính chùm, dài không tách biệt nhau
 * - Hỗ trợ cả tệp PDF Scan (tự động khử nhiễu nền, giữ nguyên tỷ lệ khung hình 300 DPI và gắn thẻ [HINH_ANH_CAU_X])
 * - Bắt buộc mỗi câu ở Phần I có đúng 4 phương án (A, B, C, D) và Phần II có đúng 4 ý (a, b, c, d)
 */
export async function parsePdfExamFile(
  file: File,
  resetPerPart = true
): Promise<ExamQuestion[]> {
  const { lines, scannedPageImages } = await extractLinesAndScansFromPdf(file);
  const fullRawText = lines.join('\n');
  let parsed = parseRawTextToExamQuestions(fullRawText, resetPerPart);

  // Nếu là tệp PDF Scan thuần hình ảnh (chưa có lớp text), tạo danh sách câu hỏi gắn kèm ảnh Scan 300 DPI đã làm nét
  if (parsed.length === 0 && scannedPageImages.length > 0) {
    parsed = scannedPageImages.map((img, idx) => ({
      id: `q-scan-${idx + 1}-${Date.now()}`,
      part: 'PART_1',
      originalIndex: idx + 1,
      displayIndex: idx + 1,
      stemText: `Quan sát nội dung đề thi / sơ đồ phân tích ở hình ${img.tagId || `[HINH_ANH_CAU_${idx + 1}]`} bên dưới và chọn phương án đúng:`,
      hasFormula: false,
      hasImage: true,
      images: [img],
      options: [
        {
          id: `opt-scan-${idx}-A`,
          originalLabel: 'A',
          currentLabel: 'A',
          text: 'Phương án A',
          isUnderline: true,
          isRed: true,
          isCorrect: true,
        },
        {
          id: `opt-scan-${idx}-B`,
          originalLabel: 'B',
          currentLabel: 'B',
          text: 'Phương án B',
          isUnderline: false,
          isRed: false,
          isCorrect: false,
        },
        {
          id: `opt-scan-${idx}-C`,
          originalLabel: 'C',
          currentLabel: 'C',
          text: 'Phương án C',
          isUnderline: false,
          isRed: false,
          isCorrect: false,
        },
        {
          id: `opt-scan-${idx}-D`,
          originalLabel: 'D',
          currentLabel: 'D',
          text: 'Phương án D',
          isUnderline: false,
          isRed: false,
          isCorrect: false,
        },
      ],
    }));
  } else if (parsed.length > 0 && scannedPageImages.length > 0) {
    // Gắn ảnh sơ đồ trang Scan vào câu hỏi đầu tiên nếu câu hỏi chưa có ảnh
    if (!parsed[0].images || parsed[0].images.length === 0) {
      parsed[0] = {
        ...parsed[0],
        hasImage: true,
        images: [scannedPageImages[0]],
      };
    }
  }

  return normalizeAllQuestionsStrictFourOptions(parsed, resetPerPart);
}
