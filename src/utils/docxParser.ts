import JSZip from 'jszip';
import {
  ExamQuestion,
  OptionPart1,
  PartType,
  SubItemPart2,
  ValidationIssue,
} from '../types/exam';

const RED_COLOR_HEXES = new Set([
  'FF0000',
  'C00000',
  'ED1C24',
  'EE0000',
  'CC0000',
  'RED',
  '#FF0000',
  '#C00000',
  '#ED1C24',
]);

interface ParsedRun {
  text: string;
  isUnderline: boolean;
  isRed: boolean;
  isBold: boolean;
  hasFormula: boolean;
}

interface ParsedParagraph {
  fullText: string;
  runs: ParsedRun[];
  hasUnderline: boolean;
  hasRed: boolean;
  hasFormula: boolean;
}

/**
 * Thuật toán phân loại độ dài phương án (Mục IV.1)
 * - < 15 ký tự: 1_ROW_4_COL (4 cột ngang trên 1 dòng)
 * - 15 - 35 ký tự: 2_ROW_2_COL (2 cột x 2 hàng)
 * - > 35 ký tự: 4_ROW_1_COL (4 dòng độc lập)
 */
export function computeAutoLayoutForOptions(
  options: OptionPart1[]
): '1_ROW_4_COL' | '2_ROW_2_COL' | '4_ROW_1_COL' {
  if (!options || options.length === 0) return '4_ROW_1_COL';
  const maxLen = Math.max(...options.map((o) => o.text.trim().length));
  if (maxLen < 15) {
    return '1_ROW_4_COL';
  }
  if (maxLen <= 35) {
    return '2_ROW_2_COL';
  }
  return '4_ROW_1_COL';
}

/**
 * Đánh số lại từ Câu 1 ở mỗi phần hoặc đánh số liên tục (Mục II.3)
 */
export function recalculateQuestionNumbering(
  questions: ExamQuestion[],
  resetPerPart: boolean
): ExamQuestion[] {
  let continuousCounter = 1;
  const partCounters: Record<PartType, number> = {
    PART_1: 1,
    PART_2: 1,
    PART_3: 1,
  };

  return questions.map((q) => {
    const displayIndex = resetPerPart
      ? partCounters[q.part]++
      : continuousCounter++;
    const computedLayout =
      q.part === 'PART_1' && q.options
        ? computeAutoLayoutForOptions(q.options)
        : q.computedLayout;
    return {
      ...q,
      displayIndex,
      computedLayout,
    };
  });
}

/**
 * Bộ kiểm tra lỗi thông minh (Validator - Mục III.1)
 */
export function validateExamQuestions(
  questions: ExamQuestion[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  questions.forEach((q) => {
    const partLabel =
      q.part === 'PART_1'
        ? 'Phần I'
        : q.part === 'PART_2'
        ? 'Phần II'
        : 'Phần III';

    if (q.part === 'PART_1') {
      const opts = q.options || [];
      if (opts.length !== 4) {
        issues.push({
          id: `issue-${q.id}-incomplete`,
          questionId: q.id,
          part: q.part,
          questionIndex: q.displayIndex,
          severity: 'ERROR',
          code: 'P1_INCOMPLETE_OPTIONS',
          message: `${partLabel} - Câu ${q.displayIndex}: Không đủ 4 phương án A, B, C, D (hiện có ${opts.length}).`,
          suggestion: 'Bổ sung đủ 4 phương án lựa chọn cho câu hỏi.',
        });
      }
      const correctOpts = opts.filter((o) => o.isCorrect);
      if (correctOpts.length === 0) {
        issues.push({
          id: `issue-${q.id}-missing`,
          questionId: q.id,
          part: q.part,
          questionIndex: q.displayIndex,
          severity: 'ERROR',
          code: 'P1_MISSING_CORRECT',
          message: `${partLabel} - Câu ${q.displayIndex}: Thiếu đáp án đúng (chưa gạch chân hoặc tô màu đỏ).`,
          suggestion: 'Click chọn 1 đáp án A, B, C hoặc D trên khung sửa nhanh.',
        });
      } else if (correctOpts.length > 1) {
        const labels = correctOpts.map((o) => o.currentLabel).join(', ');
        issues.push({
          id: `issue-${q.id}-multiple`,
          questionId: q.id,
          part: q.part,
          questionIndex: q.displayIndex,
          severity: 'ERROR',
          code: 'P1_MULTIPLE_CORRECT',
          message: `${partLabel} - Câu ${q.displayIndex}: Thừa đáp án đúng (${correctOpts.length} phương án đang chọn: ${labels}).`,
          suggestion: 'Chỉ giữ lại duy nhất 1 phương án đúng ở Phần I.',
        });
      }
    } else if (q.part === 'PART_2') {
      const subs = q.subItems || [];
      if (subs.length !== 4) {
        issues.push({
          id: `issue-${q.id}-p2-incomplete`,
          questionId: q.id,
          part: q.part,
          questionIndex: q.displayIndex,
          severity: 'ERROR',
          code: 'P2_INCOMPLETE_SUBITEMS',
          message: `${partLabel} - Câu ${q.displayIndex}: Không đủ 4 lệnh hỏi con a), b), c), d) (hiện có ${subs.length}).`,
          suggestion: 'Bổ sung đủ 4 ý a), b), c), d) cho câu Đúng/Sai.',
        });
      } else {
        const emptySub = subs.find((s) => !s.text.trim());
        if (emptySub) {
          issues.push({
            id: `issue-${q.id}-p2-empty`,
            questionId: q.id,
            part: q.part,
            questionIndex: q.displayIndex,
            severity: 'ERROR',
            code: 'P2_INCOMPLETE_SUBITEMS',
            message: `${partLabel} - Câu ${q.displayIndex}: Ý ${emptySub.currentLabel}) bị bỏ trống nội dung dữ kiện.`,
            suggestion: 'Nhập nội dung phát biểu cho ý bị trống.',
          });
        }
      }
    } else if (q.part === 'PART_3') {
      const ans = (q.shortAnswer || '').trim();
      if (!ans) {
        issues.push({
          id: `issue-${q.id}-p3-missing`,
          questionId: q.id,
          part: q.part,
          questionIndex: q.displayIndex,
          severity: 'ERROR',
          code: 'P3_MISSING_SHORT_ANSWER',
          message: `${partLabel} - Câu ${q.displayIndex}: Thiếu đáp số trả lời ngắn (chưa có từ khóa "Đáp án:" hoặc tô đỏ/gạch chân).`,
          suggestion: 'Nhập giá trị số (VD: 12,5 hoặc -0,75) vào ô Đáp số.',
        });
      } else if (!/^-?\d+([.,]\d+)?$/.test(ans)) {
        issues.push({
          id: `issue-${q.id}-p3-format`,
          questionId: q.id,
          part: q.part,
          questionIndex: q.displayIndex,
          severity: 'WARNING',
          code: 'P3_INVALID_FORMAT',
          message: `${partLabel} - Câu ${q.displayIndex}: Đáp số "${ans}" không phải định dạng số tiêu chuẩn phiếu tô.`,
          suggestion: 'Đáp số trả lời ngắn chỉ nên gồm chữ số, dấu trừ (-) và dấu phẩy/chấm thập phân.',
        });
      }
    }
  });

  return issues;
}

/**
 * Kiểm tra xem một node <w:rPr> có thuộc tính gạch chân (<w:u>) hay tô màu đỏ (<w:color>) không
 */
function inspectRunProperties(rPr: Element | null): {
  isUnderline: boolean;
  isRed: boolean;
  isBold: boolean;
} {
  if (!rPr) return { isUnderline: false, isRed: false, isBold: false };

  let isUnderline = false;
  let isRed = false;
  let isBold = false;

  const uNodes = rPr.getElementsByTagName('w:u');
  if (uNodes.length > 0) {
    const val = uNodes[0].getAttribute('w:val');
    if (!val || (val !== 'none' && val !== 'false' && val !== '0')) {
      isUnderline = true;
    }
  }

  const colorNodes = rPr.getElementsByTagName('w:color');
  if (colorNodes.length > 0) {
    const rawColor = (colorNodes[0].getAttribute('w:val') || '').toUpperCase().trim();
    if (RED_COLOR_HEXES.has(rawColor)) {
      isRed = true;
    } else if (/^[C-F][0-9A-F]0000$/i.test(rawColor) || /^[C-F][0-9A-F][0-3][0-9A-F][0-3][0-9A-F]$/i.test(rawColor)) {
      // Nhận diện cả các sắc thái đỏ đậm/đỏ tươi trong Word
      isRed = true;
    }
  }

  const bNodes = rPr.getElementsByTagName('w:b');
  if (bNodes.length > 0) {
    const val = bNodes[0].getAttribute('w:val');
    if (!val || (val !== 'false' && val !== '0')) {
      isBold = true;
    }
  }

  return { isUnderline, isRed, isBold };
}

/**
 * Trích xuất văn bản từ công thức toán OMML (<m:oMath> hoặc <m:oMathPara>)
 */
function extractOmmlText(mathNode: Element): string {
  const mTexts = mathNode.getElementsByTagName('m:t');
  let out = '';
  for (let i = 0; i < mTexts.length; i++) {
    out += mTexts[i].textContent || '';
  }
  return out;
}

/**
 * Bóc tách cây XML của file Word (.docx) thành danh sách các đoạn văn kèm thuộc tính Gạch chân / Tô đỏ
 */
function extractParagraphsFromDocxXml(xmlString: string): ParsedParagraph[] {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'application/xml');
  const pNodes = xmlDoc.getElementsByTagName('w:p');
  const result: ParsedParagraph[] = [];

  for (let i = 0; i < pNodes.length; i++) {
    const p = pNodes[i];
    const runs: ParsedRun[] = [];
    let hasFormula = false;

    const childNodes = p.childNodes;
    for (let j = 0; j < childNodes.length; j++) {
      const child = childNodes[j] as Element;
      if (!child.tagName) continue;

      if (child.tagName === 'w:r') {
        const rPr = child.getElementsByTagName('w:rPr')[0] || null;
        const props = inspectRunProperties(rPr);
        const tNodes = child.getElementsByTagName('w:t');
        let text = '';
        for (let k = 0; k < tNodes.length; k++) {
          text += tNodes[k].textContent || '';
        }
        const tabNodes = child.getElementsByTagName('w:tab');
        if (tabNodes.length > 0 && !text.endsWith(' ')) {
          text += '\t';
        }
        if (text) {
          runs.push({
            text,
            isUnderline: props.isUnderline,
            isRed: props.isRed,
            isBold: props.isBold,
            hasFormula: false,
          });
        }
      } else if (child.tagName === 'm:oMath' || child.tagName === 'm:oMathPara') {
        hasFormula = true;
        const mathText = extractOmmlText(child);
        if (mathText) {
          runs.push({
            text: ` ${mathText} `,
            isUnderline: false,
            isRed: false,
            isBold: false,
            hasFormula: true,
          });
        }
      }
    }

    const fullText = runs.map((r) => r.text).join('').trim();
    if (fullText) {
      result.push({
        fullText,
        runs,
        hasUnderline: runs.some((r) => r.isUnderline && r.text.trim().length > 0),
        hasRed: runs.some((r) => r.isRed && r.text.trim().length > 0),
        hasFormula,
      });
    }
  }

  return result;
}

/**
 * Kiểm tra xem một khoảng vị trí ký tự [start, end) trong đoạn văn có chứa run gạch chân hoặc tô đỏ không
 */
function checkRangeHighlight(
  runs: ParsedRun[],
  fullRawText: string,
  segmentText: string,
  approxStartIndex: number
): { isUnderline: boolean; isRed: boolean } {
  const startIdx = fullRawText.indexOf(segmentText, Math.max(0, approxStartIndex - 5));
  if (startIdx === -1) {
    return {
      isUnderline: runs.some((r) => r.isUnderline && r.text.trim().length > 0),
      isRed: runs.some((r) => r.isRed && r.text.trim().length > 0),
    };
  }
  const endIdx = startIdx + segmentText.length;

  let cursor = 0;
  let isUnderline = false;
  let isRed = false;

  for (const run of runs) {
    const runStart = cursor;
    const runEnd = cursor + run.text.length;
    cursor = runEnd;

    // Kiểm tra giao nhau giữa [runStart, runEnd) và [startIdx, endIdx)
    if (runEnd > startIdx && runStart < endIdx && run.text.trim().length > 0) {
      if (run.isUnderline) isUnderline = true;
      if (run.isRed) isRed = true;
    }
  }

  return { isUnderline, isRed };
}

/**
 * Phân tích File Word (.docx) theo cấu trúc 3 phần năm 2025
 */
export async function parseDocxExamFile(
  file: File,
  resetPerPart = true
): Promise<ExamQuestion[]> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  const docXmlFile = zip.file('word/document.xml');

  if (!docXmlFile) {
    throw new Error('Không tìm thấy cấu trúc word/document.xml hợp lệ trong tệp .docx');
  }

  const xmlString = await docXmlFile.async('string');
  const paragraphs = extractParagraphsFromDocxXml(xmlString);

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

  for (const para of paragraphs) {
    const text = para.fullText;
    const rawJoined = para.runs.map((r) => r.text).join('');

    // 1. Nhận diện tiêu đề chuyển PHẦN I, PHẦN II, PHẦN III
    if (/^PHẦN\s+(I|1)\b/i.test(text) && !/^PHẦN\s+(II|III)/i.test(text)) {
      pushCurrentQuestion();
      currentPart = 'PART_1';
      continue;
    }
    if (/^PHẦN\s+(II|2)\b/i.test(text) && !/^PHẦN\s+III/i.test(text)) {
      pushCurrentQuestion();
      currentPart = 'PART_2';
      continue;
    }
    if (/^PHẦN\s+(III|3)\b/i.test(text)) {
      pushCurrentQuestion();
      currentPart = 'PART_3';
      continue;
    }

    // 2. Nhận diện bắt đầu một câu hỏi mới: "Câu 1.", "Câu 1:", "Câu 12."
    const qMatch = text.match(/^Câu\s+(\d+)\s*[.:]\s*(.*)$/i);
    if (qMatch) {
      pushCurrentQuestion();
      const stemContent = qMatch[2].trim();

      currentQuestion = {
        id: `q-${currentPart.toLowerCase()}-${globalIndex}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        part: currentPart,
        originalIndex: globalIndex++,
        displayIndex: 1,
        stemText: stemContent,
        hasFormula: para.hasFormula,
        options: currentPart === 'PART_1' ? [] : undefined,
        subItems: currentPart === 'PART_2' ? [] : undefined,
        shortAnswer: currentPart === 'PART_3' ? '' : undefined,
        shortAnswerDetectedBy: currentPart === 'PART_3' ? 'NONE' : undefined,
      };

      // Nếu ở Phần III và ngay trong dòng Câu X có chứa "Đáp án: ..." hoặc phần cuối tô đỏ/gạch chân
      if (currentPart === 'PART_3') {
        const ansKeyword = stemContent.match(/(?:Đáp\s*án|Đáp\s*số|ĐS)\s*[:=]\s*([-\d.,]+)/i);
        if (ansKeyword) {
          currentQuestion.shortAnswer = ansKeyword[1].trim();
          currentQuestion.shortAnswerDetectedBy = 'KEYWORD';
          currentQuestion.stemText = stemContent.replace(ansKeyword[0], '').trim();
        } else {
          const highlightedRuns = para.runs.filter((r) => (r.isUnderline || r.isRed) && /[-\d.,]+/.test(r.text));
          if (highlightedRuns.length > 0) {
            const numMatch = highlightedRuns.map((r) => r.text).join('').match(/-?\d+([.,]\d+)?/);
            if (numMatch) {
              currentQuestion.shortAnswer = numMatch[0];
              currentQuestion.shortAnswerDetectedBy = 'UNDERLINE_RED';
            }
          }
        }
      }
      continue;
    }

    if (!currentQuestion) continue;

    // 3. Xử lý nội dung bên trong câu hỏi tùy theo từng Phần
    if (currentQuestion.part === 'PART_1') {
      // Tìm các phương án A. B. C. D. trên cùng 1 dòng hoặc nhiều dòng
      const optionRegex = /\b([A-D])\s*[.:]\s*([^\t]+?)(?=(?:\s+\b[A-D]\s*[.:]|\t+\b[A-D]\s*[.:]|$))/g;
      const matches = [...text.matchAll(optionRegex)];

      if (matches.length > 0) {
        for (const m of matches) {
          const label = m[1].toUpperCase() as 'A' | 'B' | 'C' | 'D';
          const optText = m[2].trim();
          const fullSegment = m[0];
          const hl = checkRangeHighlight(para.runs, rawJoined, fullSegment, m.index || 0);
          const isCorrect = hl.isUnderline || hl.isRed;

          currentQuestion.options = currentQuestion.options || [];
          currentQuestion.options.push({
            id: `${currentQuestion.id}-opt-${label}`,
            originalLabel: label,
            currentLabel: label,
            text: optText,
            isUnderline: hl.isUnderline,
            isRed: hl.isRed,
            isCorrect,
          });
        }
      } else {
        currentQuestion.stemText += (currentQuestion.stemText ? ' ' : '') + text;
      }
    } else if (currentQuestion.part === 'PART_2') {
      // Tìm các ý a) b) c) d) hoặc a. b. c. d.
      const subMatch = text.match(/^([a-d])\s*[).]\s*(.+)$/i);
      if (subMatch) {
        const label = subMatch[1].toLowerCase() as 'a' | 'b' | 'c' | 'd';
        const subText = subMatch[2].trim();
        const isTrue = para.hasUnderline || para.hasRed;

        currentQuestion.subItems = currentQuestion.subItems || [];
        currentQuestion.subItems.push({
          id: `${currentQuestion.id}-sub-${label}`,
          originalLabel: label,
          currentLabel: label,
          text: subText,
          isUnderline: para.hasUnderline,
          isRed: para.hasRed,
          isTrue,
        });
      } else {
        currentQuestion.stemText += (currentQuestion.stemText ? ' ' : '') + text;
      }
    } else if (currentQuestion.part === 'PART_3') {
      const ansKeyword = text.match(/(?:Đáp\s*án|Đáp\s*số|ĐS)\s*[:=]\s*([-\d.,]+)/i);
      if (ansKeyword) {
        currentQuestion.shortAnswer = ansKeyword[1].trim();
        currentQuestion.shortAnswerDetectedBy = 'KEYWORD';
      } else if (para.hasUnderline || para.hasRed) {
        const numMatch = text.match(/-?\d+([.,]\d+)?/);
        if (numMatch) {
          currentQuestion.shortAnswer = numMatch[0];
          currentQuestion.shortAnswerDetectedBy = 'UNDERLINE_RED';
        }
      } else {
        currentQuestion.stemText += (currentQuestion.stemText ? ' ' : '') + text;
      }
    }
  }

  pushCurrentQuestion();

  return recalculateQuestionNumbering(questions, resetPerPart);
}
