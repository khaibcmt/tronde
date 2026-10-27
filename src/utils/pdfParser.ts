import * as pdfjsLib from 'pdfjs-dist';
import {
  ExamQuestion,
  PartType,
  OptionPart1,
  SubItemPart2,
} from '../types/exam';
import {
  recalculateQuestionNumbering,
  computeAutoLayoutForOptions,
} from './docxParser';

// Cấu hình worker cho pdfjs-dist an toàn
try {
  const pdfjsAny = pdfjsLib as unknown as { GlobalWorkerOptions?: { workerSrc?: string } };
  if (typeof window !== 'undefined' && pdfjsAny.GlobalWorkerOptions && !pdfjsAny.GlobalWorkerOptions.workerSrc) {
    pdfjsAny.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs`;
  }
} catch {
  // Bỏ qua nếu môi trường không cho phép gán worker
}

interface PdfTextItem {
  str: string;
  x: number;
  y: number;
  hasBold?: boolean;
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

    // Gom các đoạn text theo tọa độ Y xấp xỉ trên cùng 1 dòng
    const items: PdfTextItem[] = [];
    for (const item of textContent.items) {
      if ('str' in item && typeof item.str === 'string') {
        const tx = item.transform; // [scaleX, skewY, skewX, scaleY, transX, transY]
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

    // Gom thành các dòng hoàn chỉnh
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
        // Cùng dòng, thêm khoảng trắng nếu cần
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
 * Phân tích File PDF đề thi cấu trúc 3 phần THPT 2025
 * Hỗ trợ nhận diện tự động:
 * - Tiêu đề phần (PHẦN I, PHẦN II, PHẦN III)
 * - Câu hỏi các định dạng: Câu 1., Câu 1:, Bài 1., Question 1...
 * - Phần I: A., B., C., D. (nhận diện đáp án đúng qua dấu *, [A], gạch chân)
 * - Phần II: a), b), c), d) (nhận diện Đúng/Sai qua (Đ)/(S), [Đ], [S])
 * - Phần III: Câu trả lời ngắn
 */
export async function parsePdfExamFile(
  file: File,
  resetPerPart = true
): Promise<ExamQuestion[]> {
  const lines = await extractLinesFromPdf(file);

  let currentPart: PartType = 'PART_1';
  const questions: ExamQuestion[] = [];
  let currentQuestion: ExamQuestion | null = null;
  let globalIndex = 1;

  const pushCurrentQuestion = () => {
    if (!currentQuestion) return;
    if (currentQuestion.part === 'PART_1' && currentQuestion.options) {
      currentQuestion.computedLayout = computeAutoLayoutForOptions(currentQuestion.options);
    }
    questions.push(currentQuestion);
    currentQuestion = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // 1. Nhận diện chuyển phần
    if (/^PHẦN\s+(I|1)\b/i.test(line) && !/^PHẦN\s+(II|III)/i.test(line)) {
      pushCurrentQuestion();
      currentPart = 'PART_1';
      continue;
    }
    if (/^PHẦN\s+(II|2)\b/i.test(line) && !/^PHẦN\s+III/i.test(line)) {
      pushCurrentQuestion();
      currentPart = 'PART_2';
      continue;
    }
    if (/^PHẦN\s+(III|3)\b/i.test(line)) {
      pushCurrentQuestion();
      currentPart = 'PART_3';
      continue;
    }

    // 2. Nhận diện bắt đầu câu hỏi mới
    // Hỗ trợ: "Câu 1.", "Câu 1:", "Câu 1 -", "Câu 01.", "Bài 1:", "Question 1:"
    const qMatch = line.match(/^(?:Câu|Bài|Question)\s*(\d+)[\s.:\-–—]*(.*)$/i);
    if (qMatch) {
      pushCurrentQuestion();
      const stemContent = qMatch[2].trim();

      currentQuestion = {
        id: `q-pdf-${currentPart.toLowerCase()}-${globalIndex}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        part: currentPart,
        originalIndex: globalIndex++,
        displayIndex: 1,
        stemText: stemContent,
        hasFormula: /[√∫∑πΔαβλθ±×÷≤≥≠∈∉→∞\^_{}]/.test(stemContent),
        options: currentPart === 'PART_1' ? [] : undefined,
        subItems: currentPart === 'PART_2' ? [] : undefined,
        shortAnswer: currentPart === 'PART_3' ? '' : undefined,
        shortAnswerDetectedBy: currentPart === 'PART_3' ? 'NONE' : undefined,
      };

      // Nếu ở Phần III và dòng câu hỏi đã chứa đáp án
      if (currentPart === 'PART_3') {
        const ansKeyword = stemContent.match(/(?:Đáp\s*án|Đáp\s*số|ĐS)\s*[:=]\s*([-\d.,]+)/i);
        if (ansKeyword) {
          currentQuestion.shortAnswer = ansKeyword[1].trim();
          currentQuestion.shortAnswerDetectedBy = 'KEYWORD';
          currentQuestion.stemText = stemContent.replace(ansKeyword[0], '').trim();
        }
      }
      continue;
    }

    if (!currentQuestion) continue;

    // 3. Xử lý nội dung bên trong câu hỏi tùy theo từng phần
    if (currentQuestion.part === 'PART_1') {
      // Tìm các phương án A. B. C. D. hoặc *A. (có dấu sao đánh dấu đáp án đúng)
      const optionMatches = [
        ...line.matchAll(/(?:^|\s|\t)([*#]?)\s*([A-D])\s*[.:)]\s*([^A-D\t\n]+?)(?=(?:\s+[*#]?[A-D]\s*[.:)]|\t+[*#]?[A-D]\s*[.:)]|$))/g),
      ];

      if (optionMatches.length > 0) {
        for (const m of optionMatches) {
          const isMarked = m[1] === '*' || m[1] === '#';
          const label = m[2].toUpperCase() as 'A' | 'B' | 'C' | 'D';
          let optText = m[3].trim();

          let isCorrect = isMarked;
          // Nhận diện nếu có [Đúng] hoặc (Đúng) ở cuối
          if (/(?:\[Đúng\]|\(Đúng\)|\(Đ\)|\[Đ\])$/i.test(optText)) {
            isCorrect = true;
            optText = optText.replace(/(?:\[Đúng\]|\(Đúng\)|\(Đ\)|\[Đ\])$/i, '').trim();
          }

          currentQuestion.options = currentQuestion.options || [];
          // Tránh duplicate nếu phương án đã có
          const exists = currentQuestion.options.find((o: OptionPart1) => o.originalLabel === label);
          if (!exists) {
            currentQuestion.options.push({
              id: `${currentQuestion.id}-opt-${label}`,
              originalLabel: label,
              currentLabel: label,
              text: optText,
              isUnderline: isCorrect,
              isRed: isCorrect,
              isCorrect,
            });
          }
        }
      } else {
        // Nối dòng vào đề bài nếu chưa có phương án
        if (!currentQuestion.options || currentQuestion.options.length === 0) {
          currentQuestion.stemText += (currentQuestion.stemText ? ' ' : '') + line;
        } else {
          // Nối vào phương án cuối cùng đang có
          const lastOpt = currentQuestion.options[currentQuestion.options.length - 1];
          lastOpt.text += (lastOpt.text ? ' ' : '') + line;
        }
      }
    } else if (currentQuestion.part === 'PART_2') {
      // Nhận diện các ý a) b) c) d) hoặc a. b. c. d.
      const subMatch = line.match(/^([a-d])\s*[).]\s*(.+)$/i);
      if (subMatch) {
        const label = subMatch[1].toLowerCase() as 'a' | 'b' | 'c' | 'd';
        let subText = subMatch[2].trim();

        // Nhận diện đánh dấu Đúng/Sai
        let isTrue = false;
        if (/(?:\(Đ\)|\(Đúng\)|\(True\)|\(T\)|\[Đ\]|\[Đúng\]|:\s*Đúng)$/i.test(subText)) {
          isTrue = true;
          subText = subText.replace(/(?:\(Đ\)|\(Đúng\)|\(True\)|\(T\)|\[Đ\]|\[Đúng\]|:\s*Đúng)$/i, '').trim();
        } else if (/(?:\(S\)|\(Sai\)|\(False\)|\(F\)|\[S\]|\[Sai\]|:\s*Sai)$/i.test(subText)) {
          isTrue = false;
          subText = subText.replace(/(?:\(S\)|\(Sai\)|\(False\)|\(F\)|\[S\]|\[Sai\]|:\s*Sai)$/i, '').trim();
        }

        currentQuestion.subItems = currentQuestion.subItems || [];
        const exists = currentQuestion.subItems.find((s: SubItemPart2) => s.originalLabel === label);
        if (!exists) {
          currentQuestion.subItems.push({
            id: `${currentQuestion.id}-sub-${label}`,
            originalLabel: label,
            currentLabel: label,
            text: subText,
            isUnderline: isTrue,
            isRed: isTrue,
            isTrue,
          });
        }
      } else {
        if (!currentQuestion.subItems || currentQuestion.subItems.length === 0) {
          currentQuestion.stemText += (currentQuestion.stemText ? ' ' : '') + line;
        } else {
          const lastSub = currentQuestion.subItems[currentQuestion.subItems.length - 1];
          lastSub.text += (lastSub.text ? ' ' : '') + line;
        }
      }
    } else if (currentQuestion.part === 'PART_3') {
      const ansKeyword = line.match(/(?:Đáp\s*án|Đáp\s*số|ĐS)\s*[:=]\s*([-\d.,]+)/i);
      if (ansKeyword) {
        currentQuestion.shortAnswer = ansKeyword[1].trim();
        currentQuestion.shortAnswerDetectedBy = 'KEYWORD';
      } else {
        currentQuestion.stemText += (currentQuestion.stemText ? ' ' : '') + line;
      }
    }
  }

  pushCurrentQuestion();

  return recalculateQuestionNumbering(questions, resetPerPart);
}
