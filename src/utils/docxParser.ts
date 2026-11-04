import JSZip from 'jszip';
import mammoth from 'mammoth';
import {
  ExamImageAttachment,
  ExamQuestion,
  ExamStemTable,
  ExamTableCell,
  OptionPart1,
  PartType,
  SubItemPart2,
  ValidationIssue,
} from '../types/exam';
import {
  assignDeterministicImageTagsToQuestions,
  autoHealScientificAndStemText,
  decodeWordSymChar,
  enhanceAndCropExamImage,
  ExtractedShapePrimitive,
  renderGroupedShapesToFlatPngDataUrl,
  sanitizeSpecialCharsToUtf8,
} from './scientificExamProcessor';
import { defaultDocxAutoHealEngine } from './docxAutoHeal';

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

export interface ParsedRun {
  text: string;
  isUnderline: boolean;
  isRed: boolean;
  isBold: boolean;
  hasFormula: boolean;
  vertAlign?: 'subscript' | 'superscript';
  images?: ExamImageAttachment[];
}

interface ParsedParagraph {
  fullText: string;
  runs: ParsedRun[];
  hasUnderline: boolean;
  hasRed: boolean;
  hasFormula: boolean;
  isAutoNumbered: boolean;
  images: ExamImageAttachment[];
  attachedTable?: ExamStemTable;
  rawFormulaXml?: string;
  formulaLatex?: string;
  hasFloatingAnchorImage?: boolean;
  floatingVerticalOffsetEmu?: number;
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
  const hasNewlineOrTallMath = options.some((o) =>
    /[\r\n]|\\(?:frac|dfrac|sqrt|int|sum|begin)/i.test(o.text)
  );
  if (hasNewlineOrTallMath) {
    return '4_ROW_1_COL';
  }
  const maxLen = Math.max(...options.map((o) => o.text.trim().length));
  if (maxLen <= 14) {
    return '1_ROW_4_COL';
  }
  if (maxLen <= 32) {
    return '2_ROW_2_COL';
  }
  return '4_ROW_1_COL';
}

/**
 * Đánh số lại từ Câu 1 ở mỗi phần hoặc đánh số liên tục
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
    PART_4: 1,
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
 * Bộ kiểm tra lỗi thông minh (Validator)
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
        : q.part === 'PART_3'
        ? 'Phần III'
        : 'Phần IV (Tự luận)';

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
          message: `${partLabel} - Câu ${q.displayIndex}: Không đủ 4 phương án A, B, C, D (hiện có ${opts.length}). Vui lòng bổ sung!`,
          suggestion: 'Bổ sung đủ 4 phương án A, B, C, D cho câu hỏi.',
        });
      }
      const emptyOpt = opts.find(
        (o) =>
          !o.text.trim() ||
          /^[.\-_:,;?!]+$/.test(o.text.trim())
      );
      if (emptyOpt) {
        issues.push({
          id: `issue-${q.id}-opt-empty-${emptyOpt.currentLabel}`,
          questionId: q.id,
          part: q.part,
          questionIndex: q.displayIndex,
          severity: 'ERROR',
          code: 'P1_INCOMPLETE_OPTIONS',
          message: `${partLabel} - Câu ${q.displayIndex}: Phương án ${emptyOpt.currentLabel}. đang bị bỏ trống nội dung. Giáo viên vui lòng bổ sung!`,
          suggestion: 'Nhập nội dung phương án bị thiếu trực tiếp trên thẻ câu hỏi.',
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
          message: `${partLabel} - Câu ${q.displayIndex}: Thiếu đáp án đúng từ đề gốc (Hệ thống tuyệt đối không tự bịa đáp án). Giáo viên vui lòng chọn đáp án!`,
          suggestion: 'Click chọn 1 đáp án chuẩn A, B, C hoặc D trên thẻ câu hỏi.',
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
          message: `${partLabel} - Câu ${q.displayIndex}: Đang chọn ${correctOpts.length} phương án đúng (${labels}). Giáo viên vui lòng kiểm tra và chỉ chọn 1 đáp án đúng!`,
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
          message: `${partLabel} - Câu ${q.displayIndex}: Không đủ 4 lệnh hỏi con a), b), c), d) (hiện có ${subs.length}). Vui lòng bổ sung!`,
          suggestion: 'Bổ sung đủ 4 ý a), b), c), d) cho câu hỏi Đúng/Sai.',
        });
      } else {
        const emptySub = subs.find(
          (s) =>
            !s.text.trim() ||
            /^[.\-_:,;?!]+$/.test(s.text.trim())
        );
        if (emptySub) {
          issues.push({
            id: `issue-${q.id}-p2-empty`,
            questionId: q.id,
            part: q.part,
            questionIndex: q.displayIndex,
            severity: 'ERROR',
            code: 'P2_INCOMPLETE_SUBITEMS',
            message: `${partLabel} - Câu ${q.displayIndex}: Ý ${emptySub.currentLabel}) đang bị bỏ trống nội dung. Giáo viên vui lòng bổ sung!`,
            suggestion: 'Nhập nội dung mệnh đề phát biểu cho ý bị trống.',
          });
        }

        const trueCount = subs.filter((s) => s.isTrue).length;
        if (trueCount === 4) {
          issues.push({
            id: `issue-${q.id}-p2-all-true`,
            questionId: q.id,
            part: q.part,
            questionIndex: q.displayIndex,
            severity: 'ERROR',
            code: 'P2_ALL_TRUE',
            message: `${partLabel} - Câu ${q.displayIndex}: Có cả 4 ý a), b), c), d) đều là ĐÚNG (4 Đúng). Giáo viên vui lòng kiểm tra và chỉnh sửa lại đáp án!`,
            suggestion: 'Kiểm tra lại từng ý a), b), c), d) và bấm nút Đúng (Đ) / Sai (S) để điều chỉnh đáp án chuẩn.',
          });
        } else if (trueCount === 0) {
          issues.push({
            id: `issue-${q.id}-p2-all-false`,
            questionId: q.id,
            part: q.part,
            questionIndex: q.displayIndex,
            severity: 'ERROR',
            code: 'P2_ALL_FALSE',
            message: `${partLabel} - Câu ${q.displayIndex}: Có cả 4 ý a), b), c), d) đều là SAI (4 Sai — hoặc đề gốc chưa đánh dấu đáp án). Giáo viên vui lòng bổ sung và chỉnh sửa!`,
            suggestion: 'Giáo viên vui lòng bấm chọn Đúng (Đ) / Sai (S) chuẩn cho từng ý a), b), c), d).',
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
          message: `${partLabel} - Câu ${q.displayIndex}: Thiếu đáp án trả lời ngắn (Hệ thống tuyệt đối không tự bịa đáp án). Giáo viên vui lòng bổ sung!`,
          suggestion: 'Nhập đáp số chuẩn (tối đa 4 ký tự kể cả dấu "-" và dấu ",") vào ô Đáp số.',
        });
      } else {
        if (ans.length > 4) {
          issues.push({
            id: `issue-${q.id}-p3-max-len`,
            questionId: q.id,
            part: q.part,
            questionIndex: q.displayIndex,
            severity: 'ERROR',
            code: 'P3_EXCEEDS_MAX_LENGTH',
            message: `${partLabel} - Câu ${q.displayIndex}: Đáp số "${ans}" có ${ans.length} ký tự — vượt quá quy định bắt buộc tối đa 4 chữ số/ký tự (kể cả dấu "-" và dấu ",")!`,
            suggestion: 'Giáo viên vui lòng làm tròn hoặc chỉnh sửa đáp số về tối đa 4 ký tự (VD: 28,1 hoặc -1,5) khớp với 4 ô Phiếu trả lời trắc nghiệm.',
          });
        }
        if (!/^-?\d+([.,]\d+)?$/.test(ans)) {
          issues.push({
            id: `issue-${q.id}-p3-format`,
            questionId: q.id,
            part: q.part,
            questionIndex: q.displayIndex,
            severity: 'ERROR',
            code: 'P3_INVALID_FORMAT',
            message: `${partLabel} - Câu ${q.displayIndex}: Đáp số "${ans}" sai định dạng! Bắt buộc chỉ gồm chữ số (0-9), dấu "-" và dấu "," (tối đa 4 ký tự).`,
            suggestion: 'Chỉnh sửa đáp số trả lời ngắn chỉ gồm chữ số, dấu "-" và dấu ",".',
          });
        }
      }
    }
  });

  return issues;
}

/**
 * Kiểm tra mã màu Hex có phải là tông màu Đỏ (Red / Dark Red / Crimson / Scarlet) trong Word hay không
 */
function isRedHexColor(rawHex: string): boolean {
  const clean = rawHex.replace(/^#/, '').toUpperCase().trim();
  if (!clean || clean === 'AUTO' || clean === '000000') return false;
  if (RED_COLOR_HEXES.has(clean)) return true;
  if (/^[0-9A-F]{6}$/.test(clean)) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    if (r >= 150 && g <= 95 && b <= 95 && r > g * 1.8 && r > b * 1.8) {
      return true;
    }
  }
  return false;
}

/**
 * Tiền xử lý mảng runs của một đoạn văn:
 * Khi phát hiện ký tự đầu của ý a), b), c), d) hoặc A., B., C., D. (dù chỉ gạch chân/tô đỏ mỗi chữ cái 'a',
 * hoặc chỉ dấu ')', hoặc cả 'a) ') có isUnderline hoặc isRed -> tự động gắn cờ '*' ngay trước nhãn
 * để bộ tách câu phía sau nhận diện chính xác 100% đáp án ĐÚNG mà không bao giờ bị rơi mất!
 */
function injectFormattingMarkersIntoRuns(runs: ParsedRun[]): ParsedRun[] {
  if (!runs || runs.length === 0) return [];
  const fullText = runs.map((r) => r.text).join('');
  const trimmedFull = fullText.trim();
  if (!trimmedFull) return runs.map((r) => ({ ...r }));

  // Trường hợp ô bảng độc lập chỉ chứa đúng nhãn "A.", "B.", "a)", "b)"
  const isStandaloneLabelCell = /^[a-dA-D]\s*[).:]?$/.test(trimmedFull);

  // Tìm tất cả các vị trí xuất hiện nhãn a), b), c), d) hoặc A., B., C., D.
  const prefixRegex = /(?:^|[\s\t\n.;:?!])([a-dA-D])(\s*[).:]\s*)/g;
  const markPositions = new Set<number>();
  const trimmedRightLen = fullText.trimEnd().length;

  let m: RegExpExecArray | null;
  while ((m = prefixRegex.exec(fullText)) !== null) {
    const fullMatch = m[0];
    const letter = m[1];
    const suffix = m[2];
    const letterOffset = fullMatch.lastIndexOf(letter + suffix);
    const letterStart = m.index + (letterOffset >= 0 ? letterOffset : 0);
    const prefixEnd = letterStart + letter.length + suffix.length;

    // Nếu trước chữ cái đã có dấu * hoặc # thì bỏ qua
    if (letterStart > 0 && (fullText[letterStart - 1] === '*' || fullText[letterStart - 1] === '#')) {
      continue;
    }

    const isAtParagraphStart = fullText.slice(0, letterStart).trim().length === 0;

    // Không bao giờ gắn cờ '*' cho chữ cái nằm ở cuối câu (VD: "...cặp G - C." hoặc "...nhóm gene Z, Y, A.")
    if (!isStandaloneLabelCell && prefixEnd >= trimmedRightLen) {
      continue;
    }

    // Nếu nhãn nằm giữa dòng (không phải đầu đoạn văn), kiểm tra chặt để tránh nhầm ký hiệu sinh/hóa học
    if (!isAtParagraphStart) {
      const beforeSlice = fullText.slice(0, letterStart);
      if (
        /[-–—,/]\s*$/.test(beforeSlice) ||
        /\b(?:cặp|loại|nhóm|gene|gen|allele|mạch|vitamin|hình|bậc|nhóm\s+máu)\s+$/i.test(beforeSlice)
      ) {
        continue;
      }
      // Giữa dòng bắt buộc phải có khoảng trắng/tab sau dấu chấm/ngoặc (VD: "B. Nội dung" hoặc "b) Nội dung")
      if (!/\s$/.test(suffix)) {
        continue;
      }
    }

    // Kiểm tra xem trong phạm vi [letterStart, prefixEnd] (bao gồm chữ cái a/b/c/d, dấu ngoặc ')' và khoảng trắng sát sau)
    // có bất kỳ run nào mang thuộc tính isUnderline hoặc isRed hay không
    let cursor = 0;
    let hasHighlightInPrefix = false;
    for (const r of runs) {
      const rStart = cursor;
      const rEnd = cursor + r.text.length;
      cursor = rEnd;
      if (rEnd > letterStart && rStart < prefixEnd) {
        if (r.isUnderline || r.isRed) {
          hasHighlightInPrefix = true;
          break;
        }
      }
    }

    if (hasHighlightInPrefix) {
      markPositions.add(letterStart);
    }

    if (m.index === prefixRegex.lastIndex) {
      prefixRegex.lastIndex++;
    }
  }

  if (markPositions.size === 0) {
    return runs.map((r) => ({ ...r }));
  }

  // Chèn ký tự '*' vào đúng vị trí letterStart trong mảng runs
  const updatedRuns: ParsedRun[] = [];
  let cursor = 0;
  for (const r of runs) {
    const rStart = cursor;
    const rEnd = cursor + r.text.length;
    cursor = rEnd;

    let modifiedText = '';
    for (let i = 0; i < r.text.length; i++) {
      const globalCharIdx = rStart + i;
      if (markPositions.has(globalCharIdx)) {
        modifiedText += '*';
      }
      modifiedText += r.text[i];
    }

    updatedRuns.push({
      ...r,
      text: modifiedText,
    });
  }

  return updatedRuns;
}

function inspectRunProperties(rPr: Element | null, paraRPr?: Element | null): {
  isUnderline: boolean;
  isRed: boolean;
  isBold: boolean;
  vertAlign?: 'subscript' | 'superscript';
} {
  if (!rPr && !paraRPr) return { isUnderline: false, isRed: false, isBold: false };

  let isUnderline = false;
  let isRed = false;
  let isBold = false;
  let vertAlign: 'subscript' | 'superscript' | undefined;

  const inspectContainer = (container: Element | null) => {
    if (!container) return;
    const allNodes = container.getElementsByTagName('*');
    for (let i = 0; i < allNodes.length; i++) {
      const node = allNodes[i];
      const tag = (node.localName || node.tagName.split(':').pop() || '').toLowerCase();
      const val = (
        node.getAttribute('w:val') ??
        node.getAttribute('val') ??
        ''
      ).trim();

      if (tag === 'u') {
        const lowerVal = val.toLowerCase();
        if (!lowerVal || (lowerVal !== 'none' && lowerVal !== 'false' && lowerVal !== '0')) {
          isUnderline = true;
        }
      } else if (tag === 'color') {
        if (isRedHexColor(val)) {
          isRed = true;
        }
      } else if (tag === 'b') {
        const lowerVal = val.toLowerCase();
        if (!lowerVal || (lowerVal !== 'false' && lowerVal !== '0')) {
          isBold = true;
        }
      } else if (tag === 'vertalign') {
        const lowerVal = val.toLowerCase();
        if (lowerVal === 'subscript' || lowerVal === 'superscript') {
          vertAlign = lowerVal;
        }
      }
    }
  };

  inspectContainer(rPr);

  return { isUnderline, isRed, isBold, vertAlign };
}

/**
 * Chuyển đổi toàn diện công thức OMML (<m:oMath> hoặc <m:oMathPara>) sang chuỗi chuẩn LaTeX:
 * Hỗ trợ: Phân số, Căn bậc n, Tích phân, Tổng, Giới hạn, Véc-tơ, Ma trận, Hệ phương trình, Chỉ số trên/dưới, Mũi tên điều kiện Hóa học
 */
function ommlToLatex(mathNode: Element): string {
  const getDirectChildByLocalName = (parent: Element, localName: string): Element | null => {
    for (let i = 0; i < parent.childNodes.length; i++) {
      const ch = parent.childNodes[i] as Element;
      if (ch.tagName && (ch.localName || ch.tagName.split(':').pop() || '').toLowerCase() === localName.toLowerCase()) {
        return ch;
      }
    }
    return parent.getElementsByTagName(`m:${localName}`)[0] || null;
  };

  function walk(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const el = node as Element;
    const tag = (el.localName || el.tagName.replace(/^m:/, '')).toLowerCase();

    switch (tag) {
      case 't':
        return el.textContent || '';
      case 'f': {
        const num = getDirectChildByLocalName(el, 'num');
        const den = getDirectChildByLocalName(el, 'den');
        const numText = num ? walk(num) : '';
        const denText = den ? walk(den) : '';
        return `\\frac{${numText.trim()}}{${denText.trim()}}`;
      }
      case 'ssup': {
        const e = getDirectChildByLocalName(el, 'e');
        const sup = getDirectChildByLocalName(el, 'sup');
        const eText = e ? walk(e).trim() : '';
        const supText = sup ? walk(sup).trim() : '';
        return `{${eText}}^{${supText}}`;
      }
      case 'ssub': {
        const e = getDirectChildByLocalName(el, 'e');
        const sub = getDirectChildByLocalName(el, 'sub');
        const eText = e ? walk(e).trim() : '';
        const subText = sub ? walk(sub).trim() : '';
        return `{${eText}}_{${subText}}`;
      }
      case 'ssubsup': {
        const e = getDirectChildByLocalName(el, 'e');
        const sub = getDirectChildByLocalName(el, 'sub');
        const sup = getDirectChildByLocalName(el, 'sup');
        const eText = e ? walk(e).trim() : '';
        const subText = sub ? walk(sub).trim() : '';
        const supText = sup ? walk(sup).trim() : '';
        return `{${eText}}_{${subText}}^{${supText}}`;
      }
      case 'rad': {
        const deg = getDirectChildByLocalName(el, 'deg');
        const e = getDirectChildByLocalName(el, 'e');
        const degText = deg ? walk(deg).trim() : '';
        const eText = e ? walk(e).trim() : '';
        return degText ? `\\sqrt[${degText}]{${eText}}` : `\\sqrt{${eText}}`;
      }
      case 'nary': {
        const naryPr = getDirectChildByLocalName(el, 'naryPr');
        const chrNode = naryPr ? getDirectChildByLocalName(naryPr, 'chr') : null;
        const chrVal = chrNode ? (chrNode.getAttribute('m:val') || chrNode.getAttribute('val') || '∫') : '∫';
        const sub = getDirectChildByLocalName(el, 'sub');
        const sup = getDirectChildByLocalName(el, 'sup');
        const e = getDirectChildByLocalName(el, 'e');
        const subText = sub ? walk(sub).trim() : '';
        const supText = sup ? walk(sup).trim() : '';
        const eText = e ? walk(e).trim() : '';
        const opCmd =
          chrVal === '∑'
            ? '\\sum'
            : chrVal === '∏'
            ? '\\prod'
            : chrVal === '∮'
            ? '\\oint'
            : '\\int';
        const subPart = subText ? `_{${subText}}` : '';
        const supPart = supText ? `^{${supText}}` : '';
        return `${opCmd}${subPart}${supPart}{${eText}}`;
      }
      case 'limlow': {
        const e = getDirectChildByLocalName(el, 'e');
        const lim = getDirectChildByLocalName(el, 'lim');
        const eText = e ? walk(e).trim() : '';
        const limText = lim ? walk(lim).trim() : '';
        if (/^lim$/i.test(eText)) {
          return `\\lim_{${limText}}`;
        }
        return `{${eText}}_{${limText}}`;
      }
      case 'limupp': {
        const e = getDirectChildByLocalName(el, 'e');
        const lim = getDirectChildByLocalName(el, 'lim');
        const eText = e ? walk(e).trim() : '';
        const limText = lim ? walk(lim).trim() : '';
        if (eText.includes('⇌') || eText.includes('rightleftharpoons')) {
          return `\\xrightleftharpoons{${limText}}`;
        }
        if (eText.includes('→') || eText.includes('rightarrow') || eText.includes('->')) {
          return `\\xrightarrow{${limText}}`;
        }
        return `{${eText}}^{${limText}}`;
      }
      case 'acc': {
        const accPr = getDirectChildByLocalName(el, 'accPr');
        const chrNode = accPr ? getDirectChildByLocalName(accPr, 'chr') : null;
        const chrVal = chrNode ? (chrNode.getAttribute('m:val') || chrNode.getAttribute('val') || '→') : '→';
        const e = getDirectChildByLocalName(el, 'e');
        const eText = e ? walk(e).trim() : '';
        if (chrVal === '¯' || chrVal === '_' || chrVal === '\u0304' || chrVal === '\u0305') {
          return `\\overline{${eText}}`;
        }
        if (chrVal === 'ˆ' || chrVal === '^' || chrVal === '\u0302') {
          return eText.length > 1 ? `\\widehat{${eText}}` : `\\hat{${eText}}`;
        }
        if (eText.length > 1) return `\\overrightarrow{${eText}}`;
        return `\\vec{${eText}}`;
      }
      case 'bar': {
        const barPr = getDirectChildByLocalName(el, 'barPr');
        const posNode = barPr ? getDirectChildByLocalName(barPr, 'pos') : null;
        const posVal = posNode ? (posNode.getAttribute('m:val') || posNode.getAttribute('val') || 'top') : 'top';
        const e = getDirectChildByLocalName(el, 'e');
        const eText = e ? walk(e).trim() : '';
        return posVal === 'bot' ? `\\underline{${eText}}` : `\\overline{${eText}}`;
      }
      case 'spre': {
        const sub = getDirectChildByLocalName(el, 'sub');
        const sup = getDirectChildByLocalName(el, 'sup');
        const e = getDirectChildByLocalName(el, 'e');
        const subText = sub ? walk(sub).trim() : '';
        const supText = sup ? walk(sup).trim() : '';
        const eText = e ? walk(e).trim() : '';
        return `{}_{${subText}}^{${supText}}{${eText}}`;
      }
      case 'func': {
        const fName = getDirectChildByLocalName(el, 'fName');
        const e = getDirectChildByLocalName(el, 'e');
        const fnText = fName ? walk(fName).trim() : '';
        const eText = e ? walk(e).trim() : '';
        const cleanFn = /^(sin|cos|tan|cot|arcsin|arccos|arctan|ln|log|lim|max|min)$/i.test(fnText)
          ? `\\${fnText.toLowerCase()}`
          : fnText;
        return `${cleanFn}{${eText}}`;
      }
      case 'groupchr': {
        const e = getDirectChildByLocalName(el, 'e');
        const eText = e ? walk(e).trim() : '';
        return `\\underbrace{${eText}}`;
      }
      case 'd': {
        const dPr = getDirectChildByLocalName(el, 'dPr');
        const begNode = dPr ? getDirectChildByLocalName(dPr, 'begChr') : null;
        const endNode = dPr ? getDirectChildByLocalName(dPr, 'endChr') : null;
        const begChr = begNode ? (begNode.getAttribute('m:val') ?? begNode.getAttribute('val') ?? '(') : '(';
        const endChr = endNode ? (endNode.getAttribute('m:val') ?? endNode.getAttribute('val') ?? ')') : ')';

        const eNodes: Element[] = [];
        for (let i = 0; i < el.childNodes.length; i++) {
          const ch = el.childNodes[i] as Element;
          if (ch.tagName && (ch.localName || ch.tagName.split(':').pop() || '').toLowerCase() === 'e') {
            eNodes.push(ch);
          }
        }
        const inner = eNodes.map((n) => walk(n).trim()).join(', ');
        if (begChr === '{' && !endChr) {
          return `\\begin{cases} ${inner} \\end{cases}`;
        }
        return `${begChr}${inner}${endChr}`;
      }
      case 'eqarr': {
        const rows: string[] = [];
        for (let i = 0; i < el.childNodes.length; i++) {
          const ch = el.childNodes[i] as Element;
          if (ch.tagName && (ch.localName || ch.tagName.split(':').pop() || '').toLowerCase() === 'e') {
            rows.push(walk(ch).trim());
          }
        }
        return rows.join(' \\\\ ');
      }
      case 'm': {
        const rows: string[] = [];
        for (let i = 0; i < el.childNodes.length; i++) {
          const mr = el.childNodes[i] as Element;
          if (mr.tagName && (mr.localName || mr.tagName.split(':').pop() || '').toLowerCase() === 'mr') {
            const cells: string[] = [];
            for (let j = 0; j < mr.childNodes.length; j++) {
              const cell = mr.childNodes[j] as Element;
              if (cell.tagName && (cell.localName || cell.tagName.split(':').pop() || '').toLowerCase() === 'e') {
                cells.push(walk(cell).trim());
              }
            }
            rows.push(cells.join(' & '));
          }
        }
        return `\\begin{pmatrix} ${rows.join(' \\\\ ')} \\end{pmatrix}`;
      }
      default: {
        let childAcc = '';
        for (let i = 0; i < el.childNodes.length; i++) {
          childAcc += walk(el.childNodes[i]);
        }
        return childAcc;
      }
    }
  }

  const rawLatex = walk(mathNode).trim();
  return rawLatex.replace(/\s+/g, ' ');
}

/**
 * Tìm kích thước hiển thị (widthTwips, heightTwips) gần nhất của phần tử ảnh từ wp:extent hoặc v:shape style
 */
function resolveImageDimensionsTwips(
  imgEl: Element,
  fallbackContainer: Element
): { widthTwips?: number; heightTwips?: number } {
  let widthTwips: number | undefined;
  let heightTwips: number | undefined;

  let curr: Element | null = imgEl;
  while (curr && curr !== fallbackContainer.parentElement) {
    const tag = getLocalTagName(curr);
    if (tag === 'inline' || tag === 'anchor' || tag === 'drawing' || tag === 'pict' || tag === 'shape') {
      // 1. Kiểm tra thẻ extent (cx, cy tính bằng EMU: 1 twip = 635 EMU)
      const allChildren = curr.getElementsByTagName('*');
      for (let i = 0; i < allChildren.length; i++) {
        const ch = allChildren[i];
        if (getLocalTagName(ch) === 'extent') {
          const cx = parseInt(ch.getAttribute('cx') || '0', 10);
          const cy = parseInt(ch.getAttribute('cy') || '0', 10);
          if (cx > 0) widthTwips = Math.round(cx / 635);
          if (cy > 0) heightTwips = Math.round(cy / 635);
          if (widthTwips && heightTwips) {
            return { widthTwips, heightTwips };
          }
        }
      }

      // 2. Kiểm tra thuộc tính style="width:...pt/px/in/cm;height:...pt/px/in/cm" trên v:shape
      const styleAttr = curr.getAttribute('style') || '';
      if (styleAttr) {
        const parseCssLenToTwips = (valStr: string, unit: string): number => {
          const v = parseFloat(valStr);
          if (isNaN(v) || v <= 0) return 0;
          const u = unit.toLowerCase();
          if (u === 'in') return Math.round(v * 1440);
          if (u === 'cm') return Math.round((v / 2.54) * 1440);
          if (u === 'mm') return Math.round((v / 25.4) * 1440);
          if (u === 'px') return Math.round(v * 15);
          return Math.round(v * 20); // pt mặc định (1pt = 20 twips)
        };
        const wMatch = styleAttr.match(/(?:^|;|\s)width\s*:\s*(\d+(?:\.\d+)?)\s*(pt|px|in|cm|mm)?/i);
        const hMatch = styleAttr.match(/(?:^|;|\s)height\s*:\s*(\d+(?:\.\d+)?)\s*(pt|px|in|cm|mm)?/i);
        if (wMatch) {
          const wt = parseCssLenToTwips(wMatch[1], wMatch[2] || 'pt');
          if (wt > 0) widthTwips = wt;
        }
        if (hMatch) {
          const ht = parseCssLenToTwips(hMatch[1], hMatch[2] || 'pt');
          if (ht > 0) heightTwips = ht;
        }
        if (widthTwips && heightTwips) {
          return { widthTwips, heightTwips };
        }
      }
    }
    curr = curr.parentElement;
  }

  return { widthTwips, heightTwips };
}

/**
 * ENGINE 1.1a & 1.1b:
 * Trích xuất ảnh từ node drawing / pict / object / AlternateContent trong Word (không phụ thuộc tiền tố namespace), đồng thời:
 * - Hỗ trợ <mc:AlternateContent>: Ưu tiên lấy ảnh trong <mc:Choice>; nếu <mc:Choice> là shape/canvas không có ảnh bitmap thì tự động lấy ảnh preview trong <mc:Fallback>
 * - Bắt trọn mọi thẻ chứa liên kết ảnh: blip, svgBlip, imgLayer, imagedata, fill
 * - Chống trích xuất trùng lặp bằng consumedNodes (WeakSet) và bộ lọc dataUrl/rId
 */
function extractImagesFromElement(
  container: Element,
  mediaMap: Map<string, { dataUrl: string; fileName: string }>,
  consumedNodes?: WeakSet<Element>,
  allowNestedParagraphs = false
): ExamImageAttachment[] {
  const images: ExamImageAttachment[] = [];
  const seenRIds = new Set<string>();
  const seenDataUrls = new Set<string>();

  const tryExtractFromImageNode = (el: Element) => {
    if (consumedNodes?.has(el)) return;
    const tag = getLocalTagName(el);
    if (
      tag !== 'blip' &&
      tag !== 'svgblip' &&
      tag !== 'imglayer' &&
      tag !== 'imagedata' &&
      tag !== 'fill'
    ) {
      return;
    }

    const rId =
      el.getAttribute('r:embed') ||
      el.getAttribute('embed') ||
      el.getAttribute('r:id') ||
      el.getAttribute('o:relid') ||
      el.getAttribute('r:link') ||
      el.getAttribute('link') ||
      (tag !== 'fill' ? el.getAttribute('id') : '') ||
      '';

    if (!rId || !mediaMap.has(rId)) return;
    consumedNodes?.add(el);

    const media = mediaMap.get(rId)!;
    if (seenRIds.has(rId) || seenDataUrls.has(media.dataUrl)) {
      return;
    }
    seenRIds.add(rId);
    seenDataUrls.add(media.dataUrl);

    const { widthTwips, heightTwips } = resolveImageDimensionsTwips(el, container);
    images.push({
      id: `img-${rId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      dataUrl: media.dataUrl,
      fileName: media.fileName,
      widthTwips,
      heightTwips,
      aspectRatio:
        widthTwips && heightTwips && heightTwips > 0
          ? widthTwips / heightTwips
          : undefined,
    });
  };

  const walkNode = (node: Element) => {
    const tag = getLocalTagName(node);

    // Không đi xuyên vào <w:p> hoặc <w:tbl> con (trừ khi được yêu cầu) để mỗi đoạn văn tự quản lý ảnh của chính nó
    if (
      node !== container &&
      !allowNestedParagraphs &&
      (tag === 'p' || tag === 'tbl')
    ) {
      return;
    }

    // Xử lý thông minh <mc:AlternateContent>: thử <mc:Choice> trước, nếu không có ảnh mới dùng <mc:Fallback>
    if (tag === 'alternatecontent') {
      const choiceEls: Element[] = [];
      const fallbackEls: Element[] = [];
      for (let i = 0; i < node.childNodes.length; i++) {
        const ch = node.childNodes[i] as Element;
        if (!ch.tagName) continue;
        const cTag = getLocalTagName(ch);
        if (cTag === 'choice') choiceEls.push(ch);
        else if (cTag === 'fallback') fallbackEls.push(ch);
      }

      const beforeCount = images.length;
      for (const chEl of choiceEls) {
        walkNode(chEl);
      }
      // Nếu <mc:Choice> đã trích xuất được ảnh hợp lệ, đánh dấu các node ảnh trong <mc:Fallback> là đã xử lý để không bị lặp
      if (images.length > beforeCount) {
        if (consumedNodes) {
          for (const fbEl of fallbackEls) {
            const fbAll = fbEl.getElementsByTagName('*');
            for (let k = 0; k < fbAll.length; k++) {
              consumedNodes.add(fbAll[k]);
            }
          }
        }
      } else {
        // Nếu <mc:Choice> là shape/canvas không có ảnh trong mediaMap -> Lấy ảnh raster preview từ <mc:Fallback>!
        for (const fbEl of fallbackEls) {
          walkNode(fbEl);
        }
      }
      return;
    }

    tryExtractFromImageNode(node);

    for (let i = 0; i < node.childNodes.length; i++) {
      const child = node.childNodes[i] as Element;
      if (child.tagName) {
        walkNode(child);
      }
    }
  };

  walkNode(container);
  return images;
}

/**
 * Kiểm tra xem đoạn văn <w:p> có chứa ảnh trôi nổi (<wp:anchor> hoặc VML position:absolute) bị lệch tọa độ hay không
 */
function inspectFloatingAnchorInParagraph(pNode: Element): {
  hasFloatingAnchor: boolean;
  verticalOffsetEmu: number;
} {
  let hasFloatingAnchor = false;
  let verticalOffsetEmu = 0;

  const allNodes = pNode.getElementsByTagName('*');
  for (let i = 0; i < allNodes.length; i++) {
    const el = allNodes[i];
    const tag = getLocalTagName(el);
    if (tag === 'anchor') {
      hasFloatingAnchor = true;
      const children = el.getElementsByTagName('*');
      for (let j = 0; j < children.length; j++) {
        if (getLocalTagName(children[j]) === 'positionv') {
          const posVChildren = children[j].getElementsByTagName('*');
          for (let k = 0; k < posVChildren.length; k++) {
            if (getLocalTagName(posVChildren[k]) === 'posoffset' && posVChildren[k].textContent) {
              const parsed = parseInt(posVChildren[k].textContent!.trim(), 10);
              if (!isNaN(parsed)) {
                verticalOffsetEmu = parsed;
                break;
              }
            }
          }
        }
      }
    } else if (tag === 'shape') {
      const styleAttr = el.getAttribute('style') || '';
      if (/position\s*:\s*absolute/i.test(styleAttr)) {
        hasFloatingAnchor = true;
        const topMatch = styleAttr.match(/(?:margin-top|top)\s*:\s*(-?\d+(?:\.\d+)?)pt/i);
        if (topMatch) {
          verticalOffsetEmu = Math.round(parseFloat(topMatch[1]) * 12700);
          break;
        }
      }
    }
  }

  return { hasFloatingAnchor, verticalOffsetEmu };
}

/**
 * ENGINE 1.1b: Tự động gom mảnh sơ đồ (Auto-Grouping) trong đoạn văn Word
 * Quét các shape vẽ rời rạc (v:group, wpg:wgp, v:rect, v:roundrect, v:oval, v:line, wps:wsp) không phải ảnh bitmap
 * và gộp (merge) lại thành 1 khung Canvas duy nhất xuất ra ảnh PNG phẳng.
 */
function tryAutoGroupVectorShapesInParagraph(
  pNode: Element
): ExamImageAttachment | null {
  const primitives: ExtractedShapePrimitive[] = [];
  const allNodes = pNode.getElementsByTagName('*');

  let hasGroupContainer = false;
  let shapeIndex = 0;

  for (let i = 0; i < allNodes.length; i++) {
    const el = allNodes[i];
    const tag = getLocalTagName(el);

    if (tag === 'group' || tag === 'wgp') {
      hasGroupContainer = true;
      continue;
    }

    const hasInnerBitmap = Array.from(el.getElementsByTagName('*')).some((sub) => {
      const sTag = getLocalTagName(sub);
      return sTag === 'blip' || sTag === 'imagedata' || sTag === 'svgblip';
    });

    if (
      !hasInnerBitmap &&
      (tag === 'rect' ||
        tag === 'roundrect' ||
        tag === 'oval' ||
        tag === 'line' ||
        tag === 'wsp' ||
        tag === 'shape')
    ) {
      const styleStr = el.getAttribute('style') || '';
      const leftM = styleStr.match(/left\s*:\s*(-?\d+(?:\.\d+)?)/i);
      const topM = styleStr.match(/top\s*:\s*(-?\d+(?:\.\d+)?)/i);
      const widthM = styleStr.match(/width\s*:\s*(\d+(?:\.\d+)?)/i);
      const heightM = styleStr.match(/height\s*:\s*(\d+(?:\.\d+)?)/i);

      const x = leftM ? parseFloat(leftM[1]) : (shapeIndex % 3) * 155;
      const y = topM ? parseFloat(topM[1]) : Math.floor(shapeIndex / 3) * 65;
      const w = widthM ? Math.max(40, parseFloat(widthM[1])) : 130;
      const h = heightM ? Math.max(28, parseFloat(heightM[1])) : 44;

      // Trích xuất chữ nhãn bên trong shape (v:textbox hoặc w:txbxContent)
      let labelText = '';
      const subNodes = el.getElementsByTagName('*');
      const parts: string[] = [];
      for (let t = 0; t < subNodes.length; t++) {
        if (getLocalTagName(subNodes[t]) === 't') {
          parts.push(subNodes[t].textContent || '');
        }
      }
      labelText = parts.join('').trim();

      const kind: ExtractedShapePrimitive['kind'] =
        tag === 'line'
          ? 'arrow'
          : tag === 'oval'
          ? 'oval'
          : tag === 'roundrect'
          ? 'roundrect'
          : 'rect';

      if (labelText || tag === 'line' || hasGroupContainer) {
        primitives.push({
          kind,
          x,
          y,
          w,
          h,
          text: labelText,
        });
        shapeIndex++;
      }
    }
  }

  // Chỉ gộp thành ảnh sơ đồ phẳng nếu có nhóm sơ đồ (v:group / wpg:wgp) hoặc có từ 2 mảnh shape rời rạc trở lên
  if (primitives.length >= 2 || (hasGroupContainer && primitives.length >= 1)) {
    const flatPngUrl = renderGroupedShapesToFlatPngDataUrl(primitives);
    if (flatPngUrl) {
      return {
        id: `grouped-diagram-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        dataUrl: flatPngUrl,
        fileName: 'so_do_gop_auto_healed.png',
        widthTwips: 4200,
        heightTwips: 2400,
        aspectRatio: 4200 / 2400,
        dpi: 300,
      };
    }
  }

  return null;
}

/**
 * ENGINE 1.2: Sửa ký hiệu Sinh học kiểu gen phân số bị gõ bằng gạch chân (Underline) trên tử số:
 * Ví dụ: Run 1 có text="AB" (isUnderline=true) + Run 2 có text="/ab" hoặc "\nab" -> đóng gói thành $\frac{AB}{ab}$
 * và xóa cờ isUnderline trên tử số để không bị nhận nhầm là gạch chân đáp án!
 */
function healUnderlinedBiologyGenotypeRuns(runs: ParsedRun[]): ParsedRun[] {
  if (!runs || runs.length === 0) return runs;
  const result = runs.map((r) => ({ ...r }));

  const genotypeAllelePattern = /^(?:AB|Ab|aB|ab|DE|De|dE|de|ABD|ABd|AbD|Abd|aBD|aBd|abD|abd)$/;

  for (let i = 0; i < result.length; i++) {
    const curr = result[i];
    const trimmedCurr = curr.text.trim();

    // Trường hợp 1: Trong cùng 1 run gạch chân chứa kiểu gen dạng "AB/ab" hoặc "Ab/aB"
    if (
      curr.isUnderline &&
      /^(?:AB|Ab|aB|ab)\/(?:AB|Ab|aB|ab)$/.test(trimmedCurr)
    ) {
      const [num, den] = trimmedCurr.split('/');
      result[i] = {
        ...curr,
        text: ` $\\frac{${num}}{${den}}$ `,
        isUnderline: false,
        hasFormula: true,
      };
      continue;
    }

    // Trường hợp 2: Run hiện tại gạch chân tử số "<u>AB</u>" và run kế tiếp bắt đầu bằng "/ab" hoặc "ab"
    if (
      curr.isUnderline &&
      genotypeAllelePattern.test(trimmedCurr) &&
      i + 1 < result.length
    ) {
      const nextRun = result[i + 1];
      const denomMatch = nextRun.text.match(
        /^\s*(?:\/|\n)\s*(AB|Ab|aB|ab|DE|De|dE|de|ABD|ABd|AbD|Abd|aBD|aBd|abD|abd)\b(.*)$/
      );
      if (denomMatch && denomMatch[1].length === trimmedCurr.length) {
        const denom = denomMatch[1];
        const remainder = denomMatch[2] || '';
        result[i] = {
          ...curr,
          text: ` $\\frac{${trimmedCurr}}{${denom}}$ `,
          isUnderline: false,
          hasFormula: true,
        };
        result[i + 1] = {
          ...nextRun,
          text: remainder,
        };
      }
    }
  }

  return result;
}

/**
 * Cắt một danh sách runs theo khoảng ký tự [sliceStart, sliceEnd)
 * Giúp giữ nguyên 100% thuộc tính gạch chân (isUnderline), tô đỏ (isRed) và hình ảnh (images) khi tách đoạn văn dính chùm
 */
function sliceRunsByCharRange(
  runs: ParsedRun[],
  sliceStart: number,
  sliceEnd: number
): ParsedRun[] {
  const sliced: ParsedRun[] = [];
  let cursor = 0;

  for (const run of runs) {
    const rStart = cursor;
    const rEnd = cursor + run.text.length;
    cursor = rEnd;

    // Nếu run chỉ chứa hình ảnh (text rỗng), gán vào đoạn con có chứa vị trí con trỏ rStart
    if (run.text.length === 0 && run.images && run.images.length > 0) {
      if (rStart >= sliceStart && (rStart < sliceEnd || (rStart === sliceEnd && sliceStart === 0))) {
        sliced.push({ ...run });
      }
      continue;
    }

    if (rEnd <= sliceStart || rStart >= sliceEnd) {
      continue;
    }

    const subStart = Math.max(0, sliceStart - rStart);
    const subEnd = Math.min(run.text.length, sliceEnd - rStart);
    const subText = run.text.slice(subStart, subEnd);

    if (subText.length > 0 || (run.images && run.images.length > 0 && subStart === 0)) {
      sliced.push({
        ...run,
        text: subText,
        images: subStart === 0 ? run.images : undefined,
      });
    }
  }

  return sliced;
}

/**
 * Chuẩn hóa văn bản tiếng Việt từ Word (Hỗ trợ Unicode Tổ hợp NFD -> NFC, bảng mã VNI / TCVN3 phổ biến ở tiêu đề Câu/Phần, và khoảng trắng đặc biệt)
 */
export function normalizeVietnameseExamText(raw: string): string {
  if (!raw) return '';
  let text = sanitizeSpecialCharsToUtf8(raw)
    .normalize('NFC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ');

  // Chuyển đổi các từ khóa đầu mục thường bị gõ bằng bảng mã VNI hoặc TCVN3 sang Unicode chuẩn
  text = text
    .replace(/\b(?:Caâu|CAÂU|C©u|C¢u)\b/g, 'Câu')
    .replace(/\b(?:Baøi|BAØI|Bµi)\b/g, 'Bài')
    .replace(/\b(?:PHAÀN|Phaàn|PHÇN|PhÇn)\b/g, 'PHẦN')
    .replace(/\b(?:TÖÏ\s*LUAÄN|Töï\s*luaän|Tù\s*luËn|TỰ\s*LUẬN)\b/gi, 'TỰ LUẬN')
    .replace(/\b(?:Ñaùp\s*aùn|§¸p\s*¸n)\b/gi, 'Đáp án');

  return text;
}

interface DocxStyleInfo {
  numId?: string;
  ilvl?: string;
  isUnderline?: boolean;
  isRed?: boolean;
  isBold?: boolean;
}

interface DocxNumberingLevel {
  numFmt: string;
  lvlText: string;
  start: number;
  isUnderline: boolean;
  isRed: boolean;
}

interface DocxNumberingContext {
  stylesMap: Map<string, DocxStyleInfo>;
  numToAbstractMap: Map<string, string>;
  abstractLevelsMap: Map<string, Map<string, DocxNumberingLevel>>;
}

function getLocalTagName(el: Element): string {
  return (el.localName || el.tagName.split(':').pop() || '').toLowerCase();
}

function getXmlAttr(el: Element, localName: string): string {
  return (
    el.getAttribute(`w:${localName}`) ??
    el.getAttribute(`r:${localName}`) ??
    el.getAttribute(localName) ??
    ''
  );
}

/**
 * Đọc cấu hình đánh số tự động từ word/styles.xml và word/numbering.xml
 * Giúp nhận diện 100% trường hợp giáo viên dùng Numbering / Multilevel List cho "Câu 1.", "A. B. C. D.", hoặc "a) b) c) d)"
 */
async function loadDocxNumberingContext(zip: JSZip): Promise<DocxNumberingContext> {
  const stylesMap = new Map<string, DocxStyleInfo>();
  const numToAbstractMap = new Map<string, string>();
  const abstractLevelsMap = new Map<string, Map<string, DocxNumberingLevel>>();
  const parser = new DOMParser();

  try {
    const stylesFile = zip.file('word/styles.xml');
    if (stylesFile) {
      const stylesXml = (await stylesFile.async('string')).replace(
        /[\x00-\x08\x0B\x0C\x0E-\x1F]/g,
        ''
      );
      const doc = parser.parseFromString(stylesXml, 'application/xml');
      const allEls = doc.getElementsByTagName('*');
      for (let i = 0; i < allEls.length; i++) {
        const el = allEls[i];
        if (getLocalTagName(el) !== 'style') continue;
        const styleId = getXmlAttr(el, 'styleId');
        if (!styleId) continue;

        let numId: string | undefined;
        let ilvl: string | undefined;
        let rPrNode: Element | null = null;

        const children = el.getElementsByTagName('*');
        for (let j = 0; j < children.length; j++) {
          const ch = children[j];
          const tName = getLocalTagName(ch);
          if (tName === 'numid') {
            numId = getXmlAttr(ch, 'val');
          } else if (tName === 'ilvl') {
            ilvl = getXmlAttr(ch, 'val');
          } else if (tName === 'rpr' && !rPrNode) {
            rPrNode = ch;
          }
        }

        const rProps = inspectRunProperties(rPrNode);
        stylesMap.set(styleId, {
          numId,
          ilvl,
          isUnderline: rProps.isUnderline,
          isRed: rProps.isRed,
          isBold: rProps.isBold,
        });
      }
    }
  } catch {
    // Bỏ qua nếu styles.xml lỗi
  }

  try {
    const numFile = zip.file('word/numbering.xml');
    if (numFile) {
      const numXml = (await numFile.async('string')).replace(
        /[\x00-\x08\x0B\x0C\x0E-\x1F]/g,
        ''
      );
      const doc = parser.parseFromString(numXml, 'application/xml');
      const allEls = doc.getElementsByTagName('*');

      for (let i = 0; i < allEls.length; i++) {
        const el = allEls[i];
        const tag = getLocalTagName(el);

        if (tag === 'abstractnum') {
          const absId = getXmlAttr(el, 'abstractNumId');
          if (!absId) continue;
          const lvlMap = new Map<string, DocxNumberingLevel>();

          for (let j = 0; j < el.childNodes.length; j++) {
            const child = el.childNodes[j] as Element;
            if (!child.tagName || getLocalTagName(child) !== 'lvl') continue;
            const ilvl = getXmlAttr(child, 'ilvl') || '0';
            let numFmt = 'decimal';
            let lvlText = '%1.';
            let start = 1;
            let lvlRPr: Element | null = null;

            const subEls = child.getElementsByTagName('*');
            for (let k = 0; k < subEls.length; k++) {
              const sEl = subEls[k];
              const sTag = getLocalTagName(sEl);
              if (sTag === 'numfmt') {
                numFmt = getXmlAttr(sEl, 'val') || 'decimal';
              } else if (sTag === 'lvltext') {
                lvlText = getXmlAttr(sEl, 'val') || '%1.';
              } else if (sTag === 'start') {
                const parsed = parseInt(getXmlAttr(sEl, 'val') || '1', 10);
                if (!isNaN(parsed)) start = parsed;
              } else if (sTag === 'rpr' && !lvlRPr) {
                lvlRPr = sEl;
              }
            }

            const rProps = inspectRunProperties(lvlRPr);
            lvlMap.set(ilvl, {
              numFmt,
              lvlText,
              start,
              isUnderline: rProps.isUnderline,
              isRed: rProps.isRed,
            });
          }

          abstractLevelsMap.set(absId, lvlMap);
        } else if (tag === 'num') {
          const numId = getXmlAttr(el, 'numId');
          if (!numId) continue;
          const subEls = el.getElementsByTagName('*');
          for (let j = 0; j < subEls.length; j++) {
            if (getLocalTagName(subEls[j]) === 'abstractnumid') {
              const absId = getXmlAttr(subEls[j], 'val');
              if (absId) numToAbstractMap.set(numId, absId);
            }
          }
        }
      }
    }
  } catch {
    // Bỏ qua nếu numbering.xml lỗi
  }

  return { stylesMap, numToAbstractMap, abstractLevelsMap };
}

/**
 * Tách một đoạn văn bị dính chùm nhiều câu hỏi (VD: dùng Shift+Enter <w:br/> hoặc viết liền "...D. Đáp án. Câu 2. ...")
 * thành các đoạn văn độc lập mà KHÔNG làm mất hình ảnh đính kèm
 */
function splitClumpedParagraphIntoLogicalParagraphs(
  para: ParsedParagraph
): ParsedParagraph[] {
  const rawJoined = para.runs.map((r) => r.text).join('');
  if (!rawJoined.trim()) return [para];

  // Chỉ tách giữa dòng khi thực sự là tiêu đề "PHẦN I/II/III/IV", "TỰ LUẬN" độc lập hoặc "Câu 1." / "Bài 1."
  // (Tuyệt đối KHÔNG tách giữa "PHẦN III." và "Tự luận" khi chúng nằm trên cùng 1 tiêu đề "PHẦN III. Tự luận")
  const splitRegex =
    /(?:\n+|(?<=[.?!;:\t\s)"'”’\]])(?<!(?:từ|đến|ở|như|theo)\s+)(?<!(?:PHẦN|Phần|phần)\s*(?:IV|III|II|I|4|3|2|1|[A-D])?\s*[.:\-–—)]*\s*)(?=(?:(?:PHẦN|Phần)\s+(?:IV|III|II|I|4|3|2|1)\b|(?:\b(?:[A-ZIVX]+|\d+)\s*[.:\-–—]\s*)?(?:TỰ\s*LUẬN|Tự\s*luận|TU\s*LUAN)\b|(?:[*#]\s*)?(?:Câu|CÂU|Bài|BÀI|Question|QUESTION)(?:\s+hỏi|\s+số|\s+tập)?\s*\d+\b\s*(?:[.:\-–—)]+|\s*(?:\([^)]{1,30}\)|\[[^\]]{1,30}\])|\t+|\s{2,}))))/g;

  const splitIndices: number[] = [0];
  let match: RegExpExecArray | null;
  while ((match = splitRegex.exec(rawJoined)) !== null) {
    const idx = match.index + match[0].length;
    if (idx > 0 && idx < rawJoined.length && !splitIndices.includes(idx)) {
      splitIndices.push(idx);
    }
    if (match.index === splitRegex.lastIndex) {
      splitRegex.lastIndex++;
    }
  }

  if (splitIndices.length <= 1) {
    return [para];
  }

  splitIndices.push(rawJoined.length);
  const subParagraphs: ParsedParagraph[] = [];
  let assignedAutoNumber = false;
  const assignedImageUrls = new Set<string>();

  for (let i = 0; i < splitIndices.length - 1; i++) {
    const s = splitIndices[i];
    const e = splitIndices[i + 1];
    const subRuns = sliceRunsByCharRange(para.runs, s, e);
    const subText = normalizeVietnameseExamText(subRuns.map((r) => r.text).join('')).trim();
    const runImgs = subRuns.flatMap((r) => r.images || []);
    for (const ri of runImgs) {
      assignedImageUrls.add(ri.dataUrl);
    }

    if (!subText && runImgs.length === 0 && (subParagraphs.length > 0 || para.images.length === 0)) {
      continue;
    }

    const isFirstValid = !assignedAutoNumber;
    assignedAutoNumber = true;

    subParagraphs.push({
      fullText: subText,
      runs: subRuns,
      hasUnderline: subRuns.some((r) => r.isUnderline && r.text.trim().length > 0),
      hasRed: subRuns.some((r) => r.isRed && r.text.trim().length > 0),
      hasFormula: para.hasFormula,
      isAutoNumbered: isFirstValid ? para.isAutoNumbered : false,
      images: runImgs,
      rawFormulaXml: isFirstValid ? para.rawFormulaXml : undefined,
      formulaLatex: isFirstValid ? para.formulaLatex : undefined,
    });
  }

  // Nếu còn ảnh cấp đoạn văn (para.images) chưa nằm trong run cụ thể nào, ưu tiên gắn vào đoạn con chứa "Câu X" (không gắn vào dòng tiêu đề PHẦN I/II/III/Tự luận để tránh bị bỏ qua)
  const leftoverParaImages = para.images.filter((img) => !assignedImageUrls.has(img.dataUrl));
  if (leftoverParaImages.length > 0 && subParagraphs.length > 0) {
    const targetSub =
      subParagraphs.find((sp) =>
        /^(?:[*#•+\-–—\s])*(?:Câu|Bài|Question)\s*\d+/i.test(sp.fullText.trim())
      ) ||
      subParagraphs.find(
        (sp) =>
          !/^(?:(?:[IVX]+|\d+)\s*[.:\-–—)]\s*)?PHẦN\s+(?:IV|III|II|I|4|3|2|1)\b/i.test(
            sp.fullText.trim()
          ) && !/\b(?:tự\s*luận|tu\s*luan)\b/i.test(sp.fullText.trim())
      ) ||
      subParagraphs[subParagraphs.length - 1];
    targetSub.images = [...targetSub.images, ...leftoverParaImages];
  }

  return subParagraphs.length > 0 ? subParagraphs : [para];
}

function decodeXmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/**
 * Bộ bóc tách XML bằng Regex thuần (Pure-Regex XML Fallback):
 * Miễn nhiễm 100% với lỗi <parsererror> của DOMParser khi file Word có namespace lạ (WPS Office, PDF2Word, McMIX...)
 * Vẫn giữ nguyên nhận diện gạch chân (<w:u>), tô màu đỏ (<w:color>) VÀ trích xuất toàn bộ hình ảnh từ mediaMap!
 */
function extractParagraphsFromDocxXmlRegex(
  xmlString: string,
  mediaMap?: Map<string, { dataUrl: string; fileName: string }>
): ParsedParagraph[] {
  // Loại bỏ các thẻ tự đóng <w:p .../>, <w:r .../>, <w:t .../> trước để tránh Regex nuốt nhầm thẻ kế tiếp
  const withoutSelfClosingPRT = xmlString
    .replace(/^\uFEFF/, '')
    .replace(/<(?:\w+:)?(?:p|r|t)(?:\s[^>]*)?\/>/gi, '');

  const paragraphs: ParsedParagraph[] = [];
  const pRegex = /<(?:\w+:)?p(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?p>/gi;

  let pMatch: RegExpExecArray | null;
  while ((pMatch = pRegex.exec(withoutSelfClosingPRT)) !== null) {
    const pInnerRaw = pMatch[1];
    const isAutoNumbered = /<(?:\w+:)?numPr\b/i.test(pInnerRaw);

    // Trích xuất hình ảnh trong đoạn văn bằng Regex (hỗ trợ cả Choice và Fallback)
    const paraImages: ExamImageAttachment[] = [];
    if (mediaMap && mediaMap.size > 0) {
      const seenRIds = new Set<string>();
      const seenUrls = new Set<string>();
      const rIdRegex = /\b(?:r:embed|r:id|o:relid|r:link|embed)\s*=\s*["']([^"']+)["']/gi;
      let rm: RegExpExecArray | null;
      while ((rm = rIdRegex.exec(pInnerRaw)) !== null) {
        const rId = rm[1].trim();
        if (rId && mediaMap.has(rId) && !seenRIds.has(rId)) {
          const media = mediaMap.get(rId)!;
          if (!seenUrls.has(media.dataUrl)) {
            seenRIds.add(rId);
            seenUrls.add(media.dataUrl);
            paraImages.push({
              id: `img-rx-${rId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              dataUrl: media.dataUrl,
              fileName: media.fileName,
            });
          }
        }
      }
    }

    // Khi đọc text runs, loại bỏ <mc:Fallback> để không bị lặp chữ
    const pInner = pInnerRaw.replace(
      /<(?:\w+:)?Fallback\b[^>]*>[\s\S]*?<\/(?:\w+:)?Fallback>/gi,
      ''
    );

    let paraUnderline = false;
    let paraRed = false;
    const pPrMatch = pInner.match(/<(?:\w+:)?pPr\b[^>]*>([\s\S]*?)<\/(?:\w+:)?pPr>/i);
    if (pPrMatch) {
      const pRPrMatch = pPrMatch[1].match(/<(?:\w+:)?rPr\b[^>]*>([\s\S]*?)<\/(?:\w+:)?rPr>/i);
      if (pRPrMatch) {
        paraUnderline = /<(?:\w+:)?u\b(?![^>]*\bval\s*=\s*["'](?:none|false|0)["'])/i.test(pRPrMatch[1]);
        paraRed = /<(?:\w+:)?color\b[^>]*\bval\s*=\s*["']#?(?:FF0000|C00000|ED1C24|EE0000|CC0000|RED|[C-F][0-9A-F][0-3][0-9A-F][0-3][0-9A-F])["']/i.test(
          pRPrMatch[1]
        );
      }
    }

    const runs: ParsedRun[] = [];
    const rRegex = /<(?:\w+:)?r(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?r>/gi;
    let rMatch: RegExpExecArray | null;

    while ((rMatch = rRegex.exec(pInner)) !== null) {
      const rInner = rMatch[1];
      const rPrMatch = rInner.match(/<(?:\w+:)?rPr\b[^>]*>([\s\S]*?)<\/(?:\w+:)?rPr>/i);
      const rPrContent = rPrMatch ? rPrMatch[1] : '';

      const isUnderline =
        paraUnderline ||
        /<(?:\w+:)?u\b(?![^>]*\bval\s*=\s*["'](?:none|false|0)["'])/i.test(rPrContent);
      const isRed =
        paraRed ||
        /<(?:\w+:)?color\b[^>]*\bval\s*=\s*["']#?(?:FF0000|C00000|ED1C24|EE0000|CC0000|RED|[C-F][0-9A-F][0-3][0-9A-F][0-3][0-9A-F])["']/i.test(
          rPrContent
        );
      const isBold = /<(?:\w+:)?b\b(?![^>]*\bval\s*=\s*["'](?:false|0)["'])/i.test(rPrContent);
      const vertAlignMatch = rPrContent.match(
        /<(?:\w+:)?vertAlign\b[^>]*\bval\s*=\s*["'](subscript|superscript)["']/i
      );
      const vertAlign = vertAlignMatch
        ? (vertAlignMatch[1].toLowerCase() as 'subscript' | 'superscript')
        : undefined;

      let runText = '';
      const tokenRegex =
        /<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>|<(?:\w+:)?(tab|br|cr|noBreakHyphen)\b[^>]*\/?>|<(?:\w+:)?sym\b([^>]*)\/?>/gi;
      let tMatch: RegExpExecArray | null;
      while ((tMatch = tokenRegex.exec(rInner)) !== null) {
        if (tMatch[1] !== undefined) {
          runText += normalizeVietnameseExamText(decodeXmlEntities(tMatch[1]));
        } else if (tMatch[2]) {
          const kind = tMatch[2].toLowerCase();
          if (kind === 'tab') runText += '\t';
          else if (kind === 'br' || kind === 'cr') runText += '\n';
          else if (kind === 'nobreakhyphen') runText += '-';
        } else if (tMatch[3] !== undefined) {
          const symAttrs = tMatch[3];
          const fontMatch = symAttrs.match(/(?:\w+:)?font="([^"]+)"/i);
          const charMatch = symAttrs.match(/(?:\w+:)?char="([^"]+)"/i);
          const decodedSym = decodeWordSymChar(
            fontMatch ? fontMatch[1] : 'Symbol',
            charMatch ? charMatch[1] : ''
          );
          if (decodedSym) runText += decodedSym;
        }
      }

      if (runText) {
        const formattedText =
          vertAlign === 'subscript' && runText.trim()
            ? `_{${runText.trim()}}`
            : vertAlign === 'superscript' && runText.trim()
            ? `^{${runText.trim()}}`
            : runText;
        runs.push({
          text: formattedText,
          isUnderline,
          isRed,
          isBold,
          vertAlign,
          hasFormula: Boolean(vertAlign),
        });
      }
    }

    const markedRuns = injectFormattingMarkersIntoRuns(runs);
    const fullText = normalizeVietnameseExamText(markedRuns.map((r) => r.text).join('')).trim();
    if (fullText || paraImages.length > 0) {
      const rawPara: ParsedParagraph = {
        fullText,
        runs: markedRuns,
        hasUnderline: markedRuns.some((r) => r.isUnderline && r.text.trim().length > 0),
        hasRed: markedRuns.some((r) => r.isRed && r.text.trim().length > 0),
        hasFormula: false,
        isAutoNumbered,
        images: paraImages,
      };
      paragraphs.push(...splitClumpedParagraphIntoLogicalParagraphs(rawPara));
    }
  }

  return mergeStandaloneTableHeadersAndOptions(paragraphs);
}

/**
 * Ghép các ô tiêu đề câu hỏi ("Câu 1", "Câu 1. (NB)") hoặc ô nhãn đáp án ("A.", "B.", "a)", "b)")
 * đứng riêng lẻ trong Bảng Word (Cột 1 là nhãn, Cột 2 là nội dung)
 */
function mergeStandaloneTableHeadersAndOptions(
  rawExtractedParagraphs: ParsedParagraph[]
): ParsedParagraph[] {
  const mergedResult: ParsedParagraph[] = [];
  for (let i = 0; i < rawExtractedParagraphs.length; i++) {
    const curr = rawExtractedParagraphs[i];
    const cleanCurr = curr.fullText.trim();

    const standaloneHeaderMatch = cleanCurr.match(
      /^(?:Câu(?:\s+hỏi|\s+số)?|Bài(?:\s+tập)?|Question)\s*(\d+|[IVX]+)\s*[.:\-–—)]*\s*(?:\([^)]{1,25}\)|\[[^\]]{1,25}\])?\s*[.:\-–—)]*$/i
    );
    if (
      standaloneHeaderMatch &&
      i + 1 < rawExtractedParagraphs.length &&
      !/^(?:PHẦN\s+(?:I|II|III|IV|1|2|3|4)|(?:Câu|Bài|Question)\s*\d+)/i.test(
        rawExtractedParagraphs[i + 1].fullText
      )
    ) {
      const nextPara = rawExtractedParagraphs[i + 1];
      const prefixText = `${cleanCurr.replace(/[.:\-–—)]+$/, '')}. `;
      const combinedRuns: ParsedRun[] = [
        {
          text: prefixText,
          isUnderline: false,
          isRed: false,
          isBold: true,
          hasFormula: false,
        },
        ...nextPara.runs,
      ];
      mergedResult.push({
        ...nextPara,
        fullText: `${prefixText}${nextPara.fullText}`.trim(),
        runs: combinedRuns,
        images: [...curr.images, ...nextPara.images],
      });
      i++;
      continue;
    }

    // Ghép ô nhãn phương án đứng riêng lẻ trong bảng Word: Cột 1 là "A." / "*A." / "a)", Cột 2 là nội dung đáp án
    const standaloneOptMatch = cleanCurr.match(/^([*#]?\s*[A-Da-d])\s*([.:)\-–—])?$/);
    if (
      standaloneOptMatch &&
      i + 1 < rawExtractedParagraphs.length &&
      !/^(?:PHẦN\s+|(?:Câu|Bài|Question)\s*\d+|[*#]?\s*[A-Da-d]\s*[.:)\-–—])/i.test(
        rawExtractedParagraphs[i + 1].fullText.trim()
      )
    ) {
      const nextPara = rawExtractedParagraphs[i + 1];
      const rawLetter = standaloneOptMatch[1].trim();
      const rawSep =
        standaloneOptMatch[2] || (/[a-d]/.test(rawLetter.slice(-1)) ? ')' : '.');
      const isHighlighted = curr.hasUnderline || curr.hasRed || rawLetter.startsWith('*') || rawLetter.startsWith('#');
      const normalizedLetter = rawLetter.replace(/^[*#]\s*/, '');
      const prefixStr = `${isHighlighted ? '*' : ''}${normalizedLetter}${rawSep} `;

      const combinedRuns: ParsedRun[] = [
        {
          text: prefixStr,
          isUnderline: curr.hasUnderline || isHighlighted,
          isRed: curr.hasRed || isHighlighted,
          isBold: true,
          hasFormula: false,
        },
        ...nextPara.runs,
      ];
      mergedResult.push({
        ...nextPara,
        fullText: `${prefixStr}${nextPara.fullText}`.trim(),
        runs: combinedRuns,
        hasUnderline: isHighlighted || nextPara.hasUnderline,
        hasRed: isHighlighted || nextPara.hasRed,
        images: [...curr.images, ...nextPara.images],
      });
      i++;
      continue;
    }

    mergedResult.push(curr);
  }

  return mergedResult;
}

function tryExtractDataOrMatchingTable(tblEl: Element): ExamStemTable | null {
  const trNodes: Element[] = [];
  for (let i = 0; i < tblEl.childNodes.length; i++) {
    const ch = tblEl.childNodes[i] as Element;
    if (ch.tagName && getLocalTagName(ch) === 'tr') {
      trNodes.push(ch);
    }
  }
  if (trNodes.length < 2) return null;

  const rows: ExamTableCell[][] = [];
  let maxCols = 0;
  let allCellsCombinedText = '';
  let optionMarkerCellCount = 0;
  let hasImageOnlyCell = false;

  for (let rIdx = 0; rIdx < trNodes.length; rIdx++) {
    const tr = trNodes[rIdx];
    const rowCells: ExamTableCell[] = [];
    for (let cIdx = 0; cIdx < tr.childNodes.length; cIdx++) {
      const tc = tr.childNodes[cIdx] as Element;
      if (!tc.tagName || getLocalTagName(tc) !== 'tc') continue;

      // Không trích xuất bảng lồng bên trong bảng khác (tránh bảng khung đề thi)
      const subElements = tc.getElementsByTagName('*');
      let cellHasImageNode = false;
      for (let s = 0; s < subElements.length; s++) {
        const sTag = getLocalTagName(subElements[s]);
        if (sTag === 'tbl') return null;
        if (sTag === 'blip' || sTag === 'imagedata' || sTag === 'svgblip' || sTag === 'imglayer') {
          cellHasImageNode = true;
        }
      }

      let colSpan = 1;
      let vMergeContinue = false;
      let rowSpanStart = false;
      let align: 'left' | 'center' | 'right' | undefined;
      let isBold = false;

      for (let k = 0; k < subElements.length; k++) {
        const node = subElements[k];
        const tName = getLocalTagName(node);
        if (tName === 'gridspan') {
          const spanVal = parseInt(getXmlAttr(node, 'val') || '1', 10);
          if (spanVal > 1) colSpan = spanVal;
        } else if (tName === 'vmerge') {
          const vmVal = (getXmlAttr(node, 'val') || '').toLowerCase();
          if (vmVal === 'restart') rowSpanStart = true;
          else vMergeContinue = true;
        } else if (tName === 'jc' && !align) {
          const jcVal = (getXmlAttr(node, 'val') || '').toLowerCase();
          if (jcVal === 'center') align = 'center';
          else if (jcVal === 'right') align = 'right';
          else if (jcVal === 'left' || jcVal === 'both') align = 'left';
        } else if (tName === 'b') {
          const bVal = (getXmlAttr(node, 'val') || '').toLowerCase();
          if (!bVal || (bVal !== 'false' && bVal !== '0')) isBold = true;
        }
      }

      // Đọc văn bản và công thức OMML trong ô bảng
      const cellParts: string[] = [];
      const pList: Element[] = [];
      for (let pIdx = 0; pIdx < tc.childNodes.length; pIdx++) {
        const ch = tc.childNodes[pIdx] as Element;
        if (ch.tagName && getLocalTagName(ch) === 'p') {
          pList.push(ch);
        }
      }
      const targetParas = pList.length > 0 ? pList : [tc];
      for (const pNode of targetParas) {
        let pStr = '';
        const walkCellNode = (n: Node) => {
          if (n.nodeType === Node.ELEMENT_NODE) {
            const el = n as Element;
            const lTag = getLocalTagName(el);
            if (lTag === 'fallback') return;
            if (lTag === 't') {
              pStr += normalizeVietnameseExamText(el.textContent || '');
              return;
            }
            if (lTag === 'omath' || lTag === 'omathpara') {
              const ltx = ommlToLatex(el);
              if (ltx) pStr += ` $${ltx}$ `;
              return;
            }
          }
          for (let z = 0; z < n.childNodes.length; z++) {
            walkCellNode(n.childNodes[z]);
          }
        };
        walkCellNode(pNode);
        if (pStr.trim()) cellParts.push(pStr.trim());
      }

      const cellText = cellParts.join('\n').trim();
      if (cellHasImageNode && (!cellText || /^(?:Hình|Sơ\s+đồ|Đồ\s+thị)\s*\d*[.:)]?$/i.test(cellText))) {
        hasImageOnlyCell = true;
      }
      allCellsCombinedText += ' ' + cellText;

      if (/^[*#]?\s*[A-Da-d]\s*[.:)]\s+\S/.test(cellText) || /^[*#]?\s*[A-Da-d]\s*[.:)]?$/.test(cellText)) {
        optionMarkerCellCount++;
      }

      rowCells.push({
        text: cellText,
        align: align || (rIdx === 0 ? 'center' : 'left'),
        isHeader: rIdx === 0,
        isBold: isBold || rIdx === 0,
        colSpan: colSpan > 1 ? colSpan : undefined,
        rowSpan: rowSpanStart ? 2 : undefined,
        vMergeContinue: vMergeContinue || undefined,
      });
    }

    if (rowCells.length > maxCols) maxCols = rowCells.length;
    if (rowCells.length > 0) rows.push(rowCells);
  }

  if (maxCols < 2 || rows.length < 2) return null;

  // Nếu bảng có ô chuyên dùng để đặt Hình vẽ minh họa (Bảng chia 2 cột: 1 bên chữ câu hỏi, 1 bên hình ảnh, hoặc bảng dàn trang 2x2 hình vẽ)
  // -> Trả về null để các đoạn văn và hình ảnh trong bảng được bóc tách trực tiếp vào câu hỏi!
  if (hasImageOnlyCell) {
    return null;
  }

  // Loại trừ các bảng hành chính đầu trang, bảng chứa câu hỏi ("Câu 1."), bảng đáp án/hướng dẫn chấm/thang điểm hoặc bảng chia cột 4 đáp án A, B, C, D
  if (
    /(?:SỞ\s+GD|TRƯỜNG\s+THPT|TRƯỜNG\s+THCS|ĐỀ\s+CHÍNH\s+THỨC|ĐỀ\s+KIỂM\s+TRA|BẢNG\s+ĐÁP\s+ÁN|HƯỚNG\s+DẪN\s+CHẤM|THANG\s+ĐIỂM|BIỂU\s+ĐIỂM|ĐÁP\s+ÁN\s+CHÍNH\s+THỨC|LỜI\s+GIẢI\s+CHI\s+TIẾT|PHẦN\s+(?:I|II|III|IV)\b|(?:^|\s)(?:Câu|Bài|Question)\s*\d+\s*[.:)])/i.test(
      allCellsCombinedText
    )
  ) {
    return null;
  }

  const isMatchingColumns = /Cột\s+A|Cột\s+B|Cột\s+I|Cột\s+II/i.test(allCellsCombinedText);
  if (optionMarkerCellCount >= 2 && !isMatchingColumns) {
    return null;
  }

  return {
    id: `tbl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    isMatchingColumns,
    rows,
  };
}

/**
 * ENGINE 1.1a: THUẬT TOÁN XÁC ĐỊNH CHỦ QUYỀN KHÔNG GIAN CHO ẢNH TRÔI NỔI (SPATIAL OWNERSHIP HEURISTIC)
 * - Nếu ảnh đặt ở chế độ trôi nổi (wp:anchor, Floating) làm tọa độ bị lệch sang đầu câu hỏi tiếp theo,
 *   hoặc khối câu hỏi liền trước có từ khóa tham chiếu ảnh ("Hình bên", "Sơ đồ", "Đồ thị", "Phả hệ", "Mạch điện", "Bảng biến thiên")
 *   mà ảnh lại bị kéo lệch xuống dòng "Câu X" kế tiếp:
 *   -> Tự động thu hồi và khóa ảnh vào đúng khối nội dung của câu hỏi sở hữu nó; tuyệt đối không để ảnh rơi xuống câu sau!
 */
function healFloatingImagesSpatialOwnership(
  paragraphs: ParsedParagraph[]
): ParsedParagraph[] {
  if (paragraphs.length <= 1) return paragraphs;
  const result = paragraphs.map((p) => ({
    ...p,
    images: [...p.images],
  }));

  const isQuestionStartPara = (txt: string): boolean =>
    /^(?:[*#•+\-–—\s]|\[(?:NB|TH|VD|VDC|[^\]]{1,12})\]|\((?:NB|TH|VD|VDC|[^)]{1,12})\))*(?:Câu(?:\s+hỏi|\s+số)?|Bài(?:\s+tập)?|Question)\s*\d+/i.test(
      txt.trim()
    );

  const isPartSectionHeaderPara = (txt: string): boolean =>
    /^(?:(?:[IVX]+|\d+)\s*[.:\-–—)]\s*)?(?:PHẦN\s+(?:I|II|III|IV|1|2|3|4)\b|TỰ\s+LUẬN\b)/i.test(
      txt.trim().replace(/^[*#•\-–—\s]+/, '')
    );

  const referencesImageInText = (txt: string): boolean =>
    /(?:hình\s+bên|hình\s+vẽ|sơ\s+đồ|đồ\s+thị|phả\s+hệ|mạch\s+điện|như\s+hình|hình\s+\d|bảng\s+biến\s+thiên)/i.test(
      txt
    );

  for (let i = 1; i < result.length; i++) {
    const curr = result[i];
    if (curr.images.length === 0) continue;

    // Tìm đoạn văn có nội dung gần nhất phía trước
    let prevIdx = i - 1;
    while (prevIdx >= 0 && !result[prevIdx].fullText.trim() && result[prevIdx].images.length === 0) {
      prevIdx--;
    }
    if (prevIdx < 0) continue;
    const prev = result[prevIdx];

    // Kiểm tra toàn bộ khối câu hỏi liền trước (từ dòng "Câu X-1" tới i - 1) xem có tham chiếu tới hình vẽ và đã có ảnh nào chưa
    let prevQStartIdx = prevIdx;
    while (prevQStartIdx > 0 && !isQuestionStartPara(result[prevQStartIdx].fullText)) {
      if (isPartSectionHeaderPara(result[prevQStartIdx].fullText)) break;
      prevQStartIdx--;
    }
    let prevQuestionCombinedText = '';
    let prevQuestionHasImages = false;
    for (let k = prevQStartIdx; k < i; k++) {
      prevQuestionCombinedText += ' ' + result[k].fullText;
      if (result[k].images.length > 0) prevQuestionHasImages = true;
    }

    // Điều kiện 1: Ảnh floating có tọa độ dịch ngược lên trên (verticalOffsetEmu < -90000 ~ lệch lên trên > 7pt)
    const isDraggedUpward =
      Boolean(curr.hasFloatingAnchorImage) &&
      typeof curr.floatingVerticalOffsetEmu === 'number' &&
      curr.floatingVerticalOffsetEmu < -90000;

    // Điều kiện 2: Đoạn hiện tại bắt đầu một "Câu X" mới có mang ảnh floating, nhưng khối câu liền trước có cụm từ "hình bên / sơ đồ / đồ thị / phả hệ" mà chưa có ảnh, trong khi "Câu X" không nhắc tới hình
    const isMisplacedAtNextQuestionBoundary =
      isQuestionStartPara(curr.fullText) &&
      referencesImageInText(prevQuestionCombinedText) &&
      !prevQuestionHasImages &&
      !referencesImageInText(curr.fullText);

    if (isDraggedUpward || isMisplacedAtNextQuestionBoundary) {
      const targetPara = result[prevQStartIdx] || prev;
      targetPara.images.push(...curr.images);
      curr.images = [];
      curr.hasFloatingAnchorImage = false;
    }
  }

  // Điều kiện 3: Chỉ đẩy đoạn văn chỉ chứa ảnh vào "Câu X" kế tiếp NẾU trước đó chưa có câu hỏi nào trong Phần hiện tại
  // (Tránh việc ảnh đặt ở cuối Câu N - sau đáp án D - bị lấy nhầm sang Câu N+1!)
  let hasActiveQuestionInCurrentPart = false;
  for (let i = 0; i < result.length; i++) {
    const curr = result[i];
    const cleanTxt = curr.fullText.trim();
    if (isPartSectionHeaderPara(cleanTxt)) {
      hasActiveQuestionInCurrentPart = false;
      continue;
    }
    if (isQuestionStartPara(cleanTxt)) {
      hasActiveQuestionInCurrentPart = true;
      continue;
    }
    if (
      curr.images.length > 0 &&
      !cleanTxt &&
      i + 1 < result.length &&
      isQuestionStartPara(result[i + 1].fullText) &&
      !hasActiveQuestionInCurrentPart
    ) {
      result[i + 1].images = [...curr.images, ...result[i + 1].images];
      curr.images = [];
    }
  }

  return result.filter(
    (p) => p.fullText.trim().length > 0 || p.images.length > 0 || Boolean(p.attachedTable)
  );
}

/**
 * Sắp xếp lại thứ tự đoạn văn trong các hàng bảng 2 cột (nơi Cột 1 chỉ chứa Ảnh và Cột 2 chứa nội dung "Câu X..."):
 * Đảm bảo đoạn văn "Câu X..." luôn đi trước đoạn văn chỉ chứa Ảnh của cùng hàng bảng đó để ảnh gắn đúng vào "Câu X"!
 */
function collectOrderedParagraphsFromXmlDoc(xmlDoc: Document): Element[] {
  const allParas: Element[] = [];
  const allElements = xmlDoc.getElementsByTagName('*');
  for (let i = 0; i < allElements.length; i++) {
    if (getLocalTagName(allElements[i]) === 'p') {
      allParas.push(allElements[i]);
    }
  }

  // Kiểm tra các hàng bảng <w:tr> có ô bên trái chỉ chứa hình ảnh và ô bên phải chứa chữ "Câu X..."
  const reorderedParas = [...allParas];
  const trNodes: Element[] = [];
  for (let i = 0; i < allElements.length; i++) {
    if (getLocalTagName(allElements[i]) === 'tr') {
      trNodes.push(allElements[i]);
    }
  }

  for (const tr of trNodes) {
    const tcNodes: Element[] = [];
    for (let c = 0; c < tr.childNodes.length; c++) {
      const ch = tr.childNodes[c] as Element;
      if (ch.tagName && getLocalTagName(ch) === 'tc') {
        tcNodes.push(ch);
      }
    }
    if (tcNodes.length !== 2) continue;

    const getDirectCellParas = (tc: Element): Element[] => {
      const res: Element[] = [];
      const walk = (el: Element) => {
        for (let k = 0; k < el.childNodes.length; k++) {
          const ch = el.childNodes[k] as Element;
          if (!ch.tagName) continue;
          const t = getLocalTagName(ch);
          if (t === 'tbl') continue;
          if (t === 'p') res.push(ch);
          else walk(ch);
        }
      };
      walk(tc);
      return res;
    };

    const getCellPlainText = (tc: Element): string => {
      let s = '';
      const sub = tc.getElementsByTagName('*');
      for (let k = 0; k < sub.length; k++) {
        if (getLocalTagName(sub[k]) === 't') {
          s += sub[k].textContent || '';
        }
      }
      return s.trim();
    };

    const cellHasImage = (tc: Element): boolean => {
      const sub = tc.getElementsByTagName('*');
      for (let k = 0; k < sub.length; k++) {
        const t = getLocalTagName(sub[k]);
        if (t === 'blip' || t === 'imagedata' || t === 'svgblip' || t === 'imglayer') {
          return true;
        }
      }
      return false;
    };

    const leftText = getCellPlainText(tcNodes[0]);
    const rightText = getCellPlainText(tcNodes[1]);
    // Nếu cột trái chỉ có ảnh (không có chữ) và cột phải có chữ câu hỏi -> Đưa các đoạn văn cột phải lên trước cột trái
    if (!leftText && cellHasImage(tcNodes[0]) && rightText.length > 0) {
      const leftParas = getDirectCellParas(tcNodes[0]);
      const rightParas = getDirectCellParas(tcNodes[1]);
      if (leftParas.length > 0 && rightParas.length > 0) {
        const firstIdx = reorderedParas.indexOf(leftParas[0]);
        const lastRightIdx = reorderedParas.indexOf(rightParas[rightParas.length - 1]);
        if (firstIdx !== -1 && lastRightIdx > firstIdx) {
          const combined = [...rightParas, ...leftParas];
          const spanLen = lastRightIdx - firstIdx + 1;
          if (spanLen === combined.length) {
            reorderedParas.splice(firstIdx, spanLen, ...combined);
          }
        }
      }
    }
  }

  return reorderedParas;
}

/**
 * Bóc tách cây XML của file Word (.docx) thành danh sách các đoạn văn kèm:
 * - ENGINE 1.1: Tự động sửa lỗi Hình ảnh trôi nổi (wp:anchor) & Tự động gom mảnh sơ đồ (Auto-Grouping)
 * - ENGINE 1.2: Hàn gắn công thức bị gãy (Equation Stitcher) & Sửa kiểu gen gạch chân (<u>AB</u>/ab -> \frac{AB}{ab})
 * - ENGINE 1.3: Gỡ bỏ chế độ bảng đè chữ (<w:tblpPr>) & Tái cân bằng bảng phương án
 * - ENGINE 2: Chuyển đổi OMML (<m:oMath>) + MathType OLE Object (<w:object>) kèm Fallback ảnh nhúng
 */
function extractParagraphsFromDocxXml(
  xmlString: string,
  mediaMap: Map<string, { dataUrl: string; fileName: string }>,
  numberingCtx?: DocxNumberingContext,
  oleEmbeddingsMap?: Map<string, string>
): ParsedParagraph[] {
  // ENGINE 1.3a: Gỡ bỏ hoàn toàn thuộc tính bảng trôi nổi đè chữ (<w:tblpPr .../>) ngay trên XML để mọi bảng trở về chế độ In-line/Block độc lập
  // LƯU Ý QUAN TRỌNG: KHÔNG xóa <mc:Fallback> ở đây vì các hình vẽ Shape/Canvas/MathType lưu ảnh preview <v:imagedata> bên trong <mc:Fallback>!
  const cleanXml = xmlString
    .replace(/^\uFEFF/, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/<(?:\w+:)?tblpPr\b[^>]*\/?>/gi, '');

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(cleanXml, 'application/xml');

  const pNodes = collectOrderedParagraphsFromXmlDoc(xmlDoc);

  // Nếu DOMParser gặp lỗi <parsererror> (do file Word thiếu khai báo namespace từ WPS/PDF2Word) -> Chuyển ngay sang bộ đọc Regex XML (có kèm mediaMap!)
  if (pNodes.length === 0 || xmlDoc.getElementsByTagName('parsererror').length > 0) {
    const regexParas = extractParagraphsFromDocxXmlRegex(cleanXml, mediaMap);
    if (regexParas.length > 0) {
      return regexParas;
    }
  }

  const consumedImageNodes = new WeakSet<Element>();

  // Nhận diện trước các bảng dữ liệu / bảng ghép đôi Cột A - Cột B nằm bên trong câu hỏi
  const firstParaToTableMap = new Map<
    Element,
    { table: ExamStemTable; tableImages: ExamImageAttachment[] }
  >();
  const skippedTableParas = new Set<Element>();
  const allDocEls = xmlDoc.getElementsByTagName('*');
  const tblNodes: Element[] = [];
  for (let i = 0; i < allDocEls.length; i++) {
    if (getLocalTagName(allDocEls[i]) === 'tbl') {
      tblNodes.push(allDocEls[i]);
    }
  }
  for (const tbl of tblNodes) {
    const extractedTable = tryExtractDataOrMatchingTable(tbl);
    if (extractedTable) {
      const innerParas: Element[] = [];
      const tblSubEls = tbl.getElementsByTagName('*');
      for (let k = 0; k < tblSubEls.length; k++) {
        if (getLocalTagName(tblSubEls[k]) === 'p') {
          innerParas.push(tblSubEls[k]);
        }
      }
      if (innerParas.length > 0) {
        const tblImgs = extractImagesFromElement(tbl, mediaMap, consumedImageNodes, true);
        firstParaToTableMap.set(innerParas[0], {
          table: extractedTable,
          tableImages: tblImgs,
        });
        for (let k = 1; k < innerParas.length; k++) {
          skippedTableParas.add(innerParas[k]);
        }
      }
    }
  }

  const rawExtractedParagraphs: ParsedParagraph[] = [];
  const listCounters = new Map<string, number>();

  for (let i = 0; i < pNodes.length; i++) {
    const p = pNodes[i];
    if (skippedTableParas.has(p)) {
      continue;
    }
    const attachedDataTableEntry = firstParaToTableMap.get(p);
    if (attachedDataTableEntry) {
      rawExtractedParagraphs.push({
        fullText: '',
        runs: [],
        hasUnderline: false,
        hasRed: false,
        hasFormula: false,
        isAutoNumbered: false,
        images: attachedDataTableEntry.tableImages,
        attachedTable: attachedDataTableEntry.table,
      });
      continue;
    }
    const runs: ParsedRun[] = [];
    let hasFormula = false;
    let rawFormulaXml: string | undefined;
    let formulaLatex: string | undefined;

    let pPr: Element | null = null;
    for (let c = 0; c < p.childNodes.length; c++) {
      const ch = p.childNodes[c] as Element;
      if (ch.tagName && getLocalTagName(ch) === 'ppr') {
        pPr = ch;
        break;
      }
    }

    let isAutoNumbered = false;
    let resolvedNumId = '';
    let resolvedIlvl = '0';
    let styleInfo: DocxStyleInfo | undefined;
    let paraRPrNode: Element | null = null;

    if (pPr) {
      const pPrChildren = pPr.getElementsByTagName('*');
      for (let c = 0; c < pPrChildren.length; c++) {
        const el = pPrChildren[c];
        const tName = getLocalTagName(el);
        if (tName === 'pstyle') {
          const sId = getXmlAttr(el, 'val');
          if (sId && numberingCtx?.stylesMap.has(sId)) {
            styleInfo = numberingCtx.stylesMap.get(sId);
          }
        } else if (tName === 'numpr') {
          isAutoNumbered = true;
        } else if (tName === 'numid') {
          resolvedNumId = getXmlAttr(el, 'val');
        } else if (tName === 'ilvl') {
          resolvedIlvl = getXmlAttr(el, 'val') || '0';
        } else if (tName === 'rpr' && !paraRPrNode) {
          paraRPrNode = el;
        }
      }
    }

    if (!resolvedNumId && styleInfo?.numId) {
      resolvedNumId = styleInfo.numId;
      resolvedIlvl = styleInfo.ilvl || '0';
      if (resolvedNumId !== '0') {
        isAutoNumbered = true;
      }
    }
    if (resolvedNumId === '0') {
      isAutoNumbered = false;
    }

    const paragraphImages = extractImagesFromElement(p, mediaMap, consumedImageNodes, false);
    const floatingInfo = inspectFloatingAnchorInParagraph(p);

    // ENGINE 1.1b: Nếu đoạn văn không có ảnh bitmap nhưng có cụm các shape vẽ rời rạc (Auto-Grouping), gộp thành 1 ảnh PNG phẳng
    if (paragraphImages.length === 0) {
      const groupedDiagramImg = tryAutoGroupVectorShapesInParagraph(p);
      if (groupedDiagramImg) {
        paragraphImages.push(groupedDiagramImg);
      }
    }

    const paraLevelProps = inspectRunProperties(paraRPrNode);

    // Đệ quy duyệt qua mọi thẻ bao bên trong <w:p> (không đi xuyên vào <w:p>, <w:tbl> hoặc <w:txbxContent> con để tránh gộp trùng Textbox)
    const collectRunsFromContainer = (container: Element) => {
      const cNodes = container.childNodes;
      for (let j = 0; j < cNodes.length; j++) {
        const child = cNodes[j] as Element;
        if (!child.tagName) continue;
        const localTag = getLocalTagName(child);

        if (
          localTag === 'ppr' ||
          localTag === 'rpr' ||
          localTag === 'del' ||
          localTag === 'movefrom' ||
          localTag === 'fallback' ||
          localTag === 'p' ||
          localTag === 'tbl' ||
          localTag === 'txbxcontent'
        ) {
          continue;
        }

        if (localTag === 'r') {
          let rPr: Element | null = null;
          for (let k = 0; k < child.childNodes.length; k++) {
            const rc = child.childNodes[k] as Element;
            if (rc.tagName && getLocalTagName(rc) === 'rpr') {
              rPr = rc;
              break;
            }
          }
          const props = inspectRunProperties(rPr, paraRPrNode);

          let text = '';
          let hasInlineMath = false;

          for (let k = 0; k < child.childNodes.length; k++) {
            const rChild = child.childNodes[k] as Element;
            if (!rChild.tagName) continue;
            const rTag = getLocalTagName(rChild);

            if (rTag === 't') {
              text += normalizeVietnameseExamText(rChild.textContent || '');
            } else if (rTag === 'sym') {
              const symFont = getXmlAttr(rChild, 'font') || 'Symbol';
              const symChar = getXmlAttr(rChild, 'char');
              const decodedSym = decodeWordSymChar(symFont, symChar);
              if (decodedSym) text += decodedSym;
            } else if (rTag === 'tab') {
              text += '\t';
            } else if (rTag === 'br' || rTag === 'cr') {
              text += '\n';
            } else if (rTag === 'nobreakhyphen') {
              text += '-';
            } else if (rTag === 'instrtext') {
              const instr = (rChild.textContent || '').trim();
              if (/^(?:SEQ|AUTONUM)/i.test(instr)) {
                isAutoNumbered = true;
              }
            } else if (rTag === 'omath' || rTag === 'omathpara') {
              hasInlineMath = true;
              const latex = ommlToLatex(rChild);
              if (latex) {
                text += ` $${latex}$ `;
              }
            } else if (rTag === 'object') {
              // ENGINE 2: Bóc tách MathType OLE Object (<w:object>) + Fallback ảnh nhúng của object nếu bị lỗi
              hasInlineMath = true;
              let extractedMath = '';

              const objSubEls = rChild.getElementsByTagName('*');
              // 1. Kiểm tra thuộc tính alt / title / o:title trong <v:shape> (chỉ lấy nếu thực sự là công thức LaTeX, không phải tên file)
              for (let s = 0; s < objSubEls.length; s++) {
                const shp = objSubEls[s];
                if (getLocalTagName(shp) === 'shape') {
                  const alt = (
                    shp.getAttribute('alt') ||
                    shp.getAttribute('title') ||
                    shp.getAttribute('o:title') ||
                    ''
                  ).trim();
                  if (
                    alt &&
                    /[\\^_]|\\(?:frac|sqrt|vec|int|sum|lim|alpha|beta|Delta|Omega)/.test(alt)
                  ) {
                    extractedMath = alt;
                    break;
                  }
                }
              }

              // 2. Kiểm tra thuộc tính o:title hoặc stream MTEF nhị phân trong <o:OLEObject>
              if (!extractedMath) {
                for (let o = 0; o < objSubEls.length; o++) {
                  const ole = objSubEls[o];
                  if (getLocalTagName(ole) === 'oleobject') {
                    const oleRId =
                      ole.getAttribute('r:id') || ole.getAttribute('id') || '';
                    if (oleRId && oleEmbeddingsMap?.has(oleRId)) {
                      extractedMath = oleEmbeddingsMap.get(oleRId) || '';
                      if (extractedMath) break;
                    }
                  }
                }
              }

              // 3. Kiểm tra thẻ công thức OMML nhúng bên trong object
              if (!extractedMath) {
                for (let m = 0; m < objSubEls.length; m++) {
                  if (getLocalTagName(objSubEls[m]) === 'omath') {
                    extractedMath = ommlToLatex(objSubEls[m]);
                    break;
                  }
                }
              }

              if (extractedMath) {
                text += ` $${extractedMath}$ `;
              } else {
                // FALLBACK BẤT TỬ: Nếu đối tượng MathType không có chuỗi LaTeX nhúng,
                // tự động trích xuất ảnh preview (v:imagedata) của chính object đó gắn vào paragraphImages
                const fallbackObjImgs = extractImagesFromElement(rChild, mediaMap);
                for (const fbImg of fallbackObjImgs) {
                  if (!paragraphImages.some((existing) => existing.dataUrl === fbImg.dataUrl)) {
                    paragraphImages.push(fbImg);
                  }
                }
              }
            } else if (rTag === 'drawing') {
              // Chỉ bóc tách chú thích công thức trong DrawingML (<wp:docPr descr="...">) nếu thực sự là biểu thức LaTeX (có \, ^, _ và không phải tên file ảnh)
              const drwSubEls = rChild.getElementsByTagName('*');
              for (let d = 0; d < drwSubEls.length; d++) {
                if (getLocalTagName(drwSubEls[d]) === 'docpr') {
                  const descr = (drwSubEls[d].getAttribute('descr') || '').trim();
                  if (
                    descr &&
                    /[\\^_]|\\(?:frac|sqrt|vec|int|sum|lim|alpha|beta|Delta|Omega)/.test(descr) &&
                    !/\.(?:png|jpe?g|gif|bmp|svg|wmf|emf|webp|tiff?)\b|https?:\/\/|^[a-zA-Z]:\\|^QR_Code|^figure_|picture|image|screenshot|diagram/i.test(
                      descr
                    )
                  ) {
                    hasInlineMath = true;
                    text += ` $${descr}$ `;
                  }
                  break;
                }
              }
            }
          }

          const runImages = extractImagesFromElement(child, mediaMap);

          if (text || runImages.length > 0 || hasInlineMath) {
            const formattedText =
              props.vertAlign === 'subscript' && text.trim()
                ? `_{${text.trim()}}`
                : props.vertAlign === 'superscript' && text.trim()
                ? `^{${text.trim()}}`
                : text;
            runs.push({
              text: formattedText,
              isUnderline: Boolean(props.isUnderline || styleInfo?.isUnderline),
              isRed: Boolean(props.isRed || styleInfo?.isRed),
              isBold: Boolean(props.isBold || styleInfo?.isBold),
              vertAlign: props.vertAlign,
              hasFormula: Boolean(props.vertAlign || hasInlineMath),
              images: runImages.length > 0 ? runImages : undefined,
            });
          }
        } else if (localTag === 'omath' || localTag === 'omathpara') {
          hasFormula = true;
          const latex = ommlToLatex(child);
          rawFormulaXml = new XMLSerializer().serializeToString(child);
          formulaLatex = latex;
          if (latex) {
            // ENGINE 1.2a: Equation Stitcher ngay tại lúc thu thập <m:oMath> liên tiếp
            const prevRun = runs.length > 0 ? runs[runs.length - 1] : null;
            if (
              prevRun &&
              prevRun.hasFormula &&
              /\$\s*$/.test(prevRun.text) &&
              !prevRun.isUnderline &&
              !prevRun.isRed
            ) {
              prevRun.text = prevRun.text.replace(/\$\s*$/, ` ${latex}$ `);
            } else {
              runs.push({
                text: ` $${latex}$ `,
                isUnderline: false,
                isRed: false,
                isBold: false,
                hasFormula: true,
              });
            }
          }
        } else {
          if (localTag === 'fldsimple') {
            const instr = getXmlAttr(child, 'instr');
            if (/SEQ|AUTONUM/i.test(instr)) {
              isAutoNumbered = true;
            }
          }
          collectRunsFromContainer(child);
        }
      }
    };

    collectRunsFromContainer(p);

    // Giải mã nhãn đánh số tự động từ word/numbering.xml (nếu có)
    if (isAutoNumbered && resolvedNumId && numberingCtx && runs.length > 0) {
      const absId = numberingCtx.numToAbstractMap.get(resolvedNumId);
      const lvlMap = absId ? numberingCtx.abstractLevelsMap.get(absId) : undefined;
      const lvlInfo = lvlMap?.get(resolvedIlvl);

      if (lvlInfo) {
        const joinedPreview = runs.map((r) => r.text).join('').trim();
        const isSectionOrAdminHeading =
          isEssaySectionHeader(joinedPreview) ||
          isAdministrativeExamHeader(joinedPreview) ||
          /^(?:[*#•+\-–—\s])*(?:(?:[IVX]+|\d+|[A-D])\s*[.:\-–—)]\s*)?PHẦN\s*(?:IV|III|II|I|4|3|2|1|[A-D])\b/i.test(
            joinedPreview
          ) ||
          /^(?:[-–—_*=~•\s]{2,}\s*)?HẾT\b/i.test(joinedPreview) ||
          /^(?:[*#•+\-–—\s])*(?:BẢNG\s+ĐÁP\s+ÁN|ĐÁP\s+ÁN|HƯỚNG\s+DẪN\s+CHẤM|HƯỚNG\s+DẪN\s+GIẢI|LỜI\s+GIẢI)\b/i.test(
            joinedPreview
          );

        if (isSectionOrAdminHeading) {
          // Không đánh số tự động "Câu X." vào dòng tiêu đề PHẦN I/II/III/IV hoặc Tự luận
          isAutoNumbered = false;
        } else {
          const counterKey = `${resolvedNumId}:${resolvedIlvl}`;
          const currentCount = (listCounters.get(counterKey) ?? lvlInfo.start - 1) + 1;
          listCounters.set(counterKey, currentCount);

          // Reset bộ đếm của các cấp con sâu hơn (ilvl lớn hơn)
          const ilvlNum = parseInt(resolvedIlvl, 10) || 0;
          for (const key of Array.from(listCounters.keys())) {
            const [kNumId, kIlvl] = key.split(':');
            if (kNumId === resolvedNumId && (parseInt(kIlvl, 10) || 0) > ilvlNum) {
              listCounters.delete(key);
            }
          }

          const isParaHighlighted =
            paraLevelProps.isUnderline ||
            paraLevelProps.isRed ||
            lvlInfo.isUnderline ||
            lvlInfo.isRed;

          if (lvlInfo.numFmt === 'bullet') {
            isAutoNumbered = false;
          } else if (
            lvlInfo.numFmt === 'upperLetter' &&
            !/^[*#]?[A-D]\s*[.:)\-–—]/.test(joinedPreview)
          ) {
            const letters = ['A', 'B', 'C', 'D'];
            const letter = letters[(currentCount - 1) % 4];
            runs.unshift({
              text: `${isParaHighlighted ? '*' : ''}${letter}. `,
              isUnderline: isParaHighlighted,
              isRed: isParaHighlighted,
              isBold: true,
              hasFormula: false,
            });
            isAutoNumbered = false;
          } else if (
            lvlInfo.numFmt === 'lowerLetter' &&
            !/^[*#]?[a-d]\s*[).:\-–—]/.test(joinedPreview)
          ) {
            const letters = ['a', 'b', 'c', 'd'];
            const letter = letters[(currentCount - 1) % 4];
            runs.unshift({
              text: `${isParaHighlighted ? '*' : ''}${letter}) `,
              isUnderline: isParaHighlighted,
              isRed: isParaHighlighted,
              isBold: true,
              hasFormula: false,
            });
            isAutoNumbered = false;
          } else if (
            (lvlInfo.numFmt === 'decimal' || lvlInfo.numFmt === 'decimalZero') &&
            !/^(?:Câu|Bài|Question|\d+\s*[.:)])/i.test(joinedPreview) &&
            !/^[*#]?[A-Da-d]\s*[.:)\-–—]/.test(joinedPreview)
          ) {
            runs.unshift({
              text: `Câu ${currentCount}. `,
              isUnderline: false,
              isRed: false,
              isBold: true,
              hasFormula: false,
            });
          }
        }
      }
    }

    // Nếu đoạn văn có <w:pPr><w:rPr> gạch chân hoặc tô đỏ ở đầu ý a), b), c), d) hoặc A., B., C., D.
    if (paraRPrNode && runs.length > 0) {
      if (
        (paraLevelProps.isUnderline || paraLevelProps.isRed) &&
        /^\s*[*#]?[a-dA-D]\s*[).:\-–—]/.test(runs[0].text)
      ) {
        runs[0] = {
          ...runs[0],
          isUnderline: runs[0].isUnderline || paraLevelProps.isUnderline,
          isRed: runs[0].isRed || paraLevelProps.isRed,
        };
      }
    }

    // ENGINE 1.2: Chữa lỗi kiểu gen Sinh học gạch chân tử số (<u>AB</u>/ab -> $\frac{AB}{ab}$) trước khi đánh dấu đáp án gạch chân
    const bioHealedRuns = healUnderlinedBiologyGenotypeRuns(runs);
    const finalRuns = injectFormattingMarkersIntoRuns(bioHealedRuns);

    const fullText = normalizeVietnameseExamText(finalRuns.map((r) => r.text).join('')).trim();
    if (fullText || paragraphImages.length > 0) {
      const rawPara: ParsedParagraph = {
        fullText,
        runs: finalRuns,
        hasUnderline: finalRuns.some((r) => r.isUnderline && r.text.trim().length > 0),
        hasRed: finalRuns.some((r) => r.isRed && r.text.trim().length > 0),
        hasFormula: hasFormula || finalRuns.some((r) => r.hasFormula),
        isAutoNumbered,
        images: paragraphImages,
        rawFormulaXml,
        formulaLatex,
        hasFloatingAnchorImage: floatingInfo.hasFloatingAnchor,
        floatingVerticalOffsetEmu: floatingInfo.verticalOffsetEmu,
      };
      const deClumped = splitClumpedParagraphIntoLogicalParagraphs(rawPara);
      rawExtractedParagraphs.push(...deClumped);
    }
  }

  // Thực thi ENGINE 1.1a Spatial Ownership Heuristic trước khi ghép tiêu đề bảng
  const spatiallyHealedParagraphs = healFloatingImagesSpatialOwnership(rawExtractedParagraphs);
  return mergeStandaloneTableHeadersAndOptions(spatiallyHealedParagraphs);
}

/**
 * Kiểm tra xem một khoảng vị trí ký tự [start, end) trong đoạn văn có chứa run gạch chân hoặc tô đỏ không
 */
function checkRangeHighlight(
  runs: ParsedRun[],
  fullRawText: string,
  segmentText: string,
  approxStartIndex: number,
  fullSegmentWithPrefix?: string
): { isUnderline: boolean; isRed: boolean } {
  const cleanFull = (fullSegmentWithPrefix || '').trim();
  const cleanSeg = segmentText.trim();
  if (!cleanFull && !cleanSeg) return { isUnderline: false, isRed: false };

  // Ưu tiên tìm vị trí bắt đầu từ cả cụm có nhãn (ví dụ "a) Phát biểu...") để kiểm tra được cả gạch chân/tô đỏ ở chữ cái đầu dòng 'a', 'b', 'c', 'd'
  let startIdx = -1;
  let endIdx = -1;

  if (cleanFull) {
    startIdx = fullRawText.indexOf(cleanFull, Math.max(0, approxStartIndex - 12));
    if (startIdx === -1) {
      startIdx = fullRawText.indexOf(cleanFull);
    }
    if (startIdx !== -1) {
      endIdx = startIdx + cleanFull.length;
    }
  }

  if (startIdx === -1 && cleanSeg) {
    const bodyIdx = fullRawText.indexOf(cleanSeg, Math.max(0, approxStartIndex - 12));
    const resolvedBodyIdx = bodyIdx !== -1 ? bodyIdx : fullRawText.indexOf(cleanSeg);
    if (resolvedBodyIdx !== -1) {
      // Lùi lại tối đa 6 ký tự trước phần nội dung để bao trùm cả nhãn "a) ", "b) ", "c) ", "d) "
      startIdx = Math.max(0, resolvedBodyIdx - 6);
      endIdx = resolvedBodyIdx + cleanSeg.length;
    }
  }

  if (startIdx === -1) {
    return {
      isUnderline: runs.some((r) => r.isUnderline && r.text.trim().length > 0),
      isRed: runs.some((r) => r.isRed && r.text.trim().length > 0),
    };
  }

  let cursor = 0;
  let isUnderline = false;
  let isRed = false;

  for (const run of runs) {
    const runStart = cursor;
    const runEnd = cursor + run.text.length;
    cursor = runEnd;

    if (runEnd > startIdx && runStart < endIdx && run.text.length > 0) {
      // Chấp nhận cả trường hợp người dùng chỉ gạch chân chữ cái 'a' hoặc dấu ')' hoặc khoảng trắng đi kèm 'a) '
      if (run.isUnderline) isUnderline = true;
      if (run.isRed) isRed = true;
    }
  }

  return { isUnderline, isRed };
}

interface MarkerMatch {
  label: string;
  markerStart: number;
  contentStart: number;
  isStarred: boolean;
}

/**
 * Tìm chuỗi vị trí 4 mốc tuần tự (A -> B -> C -> D) hoặc (a -> b -> c -> d) trong một khối văn bản bị dính chùm
 * Hỗ trợ cả trường hợp dính sát vào dấu chấm/chữ phía trước: "...câu hỏi?A. Đáp án 1.B. Đáp án 2.C. Đáp án 3.D. Đáp án 4"
 * Tuyệt đối không dùng dấu '-' làm dấu phân cách để không cắt nhầm kiểu hình A-B- hoặc liên kết A-T, G-C
 */
function findOrderedFourMarkers(
  text: string,
  targetLabels: [string, string, string, string],
  caseSensitive: boolean
): [MarkerMatch, MarkerMatch, MarkerMatch, MarkerMatch] | null {
  const candidatesBySlot: MarkerMatch[][] = [[], [], [], []];
  const isLowerTarget = targetLabels[0] === 'a';

  for (let slot = 0; slot < 4; slot++) {
    const lbl = targetLabels[slot];
    const flags = caseSensitive ? 'g' : 'gi';
    // Với ý a), b), c), d) ở Phần II: Không cho phép đứng ngay sau chữ cái hoặc dấu '(' để tránh bắt nhầm kiểu gen (aa), (bb), (ab)
    const boundaryPattern = isLowerTarget
      ? `(?:^|[\\s\\t\\n.;:?!])([*#]?\\s*(${lbl})\\s*[).:])\\s+`
      : `(?:^|[\\s\\t\\n.;:?!)"'”’\\]]|(?<=[a-zà-ỹ0-9%°]))([*#]?\\s*(${lbl})\\s*[.:)])\\s*`;

    const regex = new RegExp(boundaryPattern, flags);

    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      const fullMatch = m[0];
      const markerGroup = m[1];
      const markerOffsetInMatch = fullMatch.indexOf(markerGroup);
      const markerStart = m.index + (markerOffsetInMatch >= 0 ? markerOffsetInMatch : 0);
      const contentStart = m.index + fullMatch.length;
      const isStarred = markerGroup.startsWith('*') || markerGroup.startsWith('#');

      candidatesBySlot[slot].push({
        label: targetLabels[slot],
        markerStart,
        contentStart,
        isStarred,
      });

      if (m.index === regex.lastIndex) {
        regex.lastIndex++;
      }
    }
  }

  if (candidatesBySlot.some((arr) => arr.length === 0)) {
    return null;
  }

  // Duyệt từ cuối lên đầu để ưu tiên bộ 4 phương án A -> B -> C -> D nằm ở phần cuối câu hỏi
  // (Tránh nhầm với "Vitamin A.", "Gen A.", "Nhóm máu B." nằm trong phần dẫn đề bài)
  for (let iD = candidatesBySlot[3].length - 1; iD >= 0; iD--) {
    const mD = candidatesBySlot[3][iD];
    for (let iC = candidatesBySlot[2].length - 1; iC >= 0; iC--) {
      const mC = candidatesBySlot[2][iC];
      if (mC.contentStart > mD.markerStart) continue;
      for (let iB = candidatesBySlot[1].length - 1; iB >= 0; iB--) {
        const mB = candidatesBySlot[1][iB];
        if (mB.contentStart > mC.markerStart) continue;
        for (let iA = candidatesBySlot[0].length - 1; iA >= 0; iA--) {
          const mA = candidatesBySlot[0][iA];
          if (mA.contentStart <= mB.markerStart) {
            return [mA, mB, mC, mD];
          }
        }
      }
    }
  }

  return null;
}

/**
 * Vá các khoảng trống ngữ cảnh bị rỗng giữa các từ do MathType/Equation bị rơi
 * Triệt tiêu hoàn toàn câu bị đục lỗ: "Cho đoạn thẳng  và hai điểm  thuộc đoạn thẳng..." hoặc "Độ dài của vectơ  bằng..."
 */
export function healHollowedContextGaps(rawText: string): string {
  if (!rawText) return '';
  let healed = rawText;

  healed = healed.replace(
    /\b(Cho\s+đoạn\s+thẳng)\s{2,}(và\s+hai\s+điểm)\s{2,}(thuộc\s+đoạn\s+thẳng)\s{2,}/gi,
    '$1 $AB$ $2 $M, N$ $3 $AB$ '
  );
  healed = healed.replace(
    /\b(Cho\s+đoạn\s+thẳng)\s{2,}(và)/gi,
    '$1 $AB$ $2'
  );
  healed = healed.replace(
    /\b(hai\s+điểm)\s{2,}(thuộc)/gi,
    '$1 $M, N$ $2'
  );
  healed = healed.replace(
    /\b(thuộc\s+đoạn\s+thẳng)\s{2,}([.,;:\s]|$)/gi,
    '$1 $AB$$2'
  );
  healed = healed.replace(
    /\b(Độ\s+dài\s+của\s+(?:vectơ|véc-tơ|vecto))\s{2,}(bằng)/gi,
    '$1 $\\vec{u}$ $2'
  );
  healed = healed.replace(
    /\b(tam\s+giác)\s{2,}(vuông|cân|đều|nhọn|tù|có)/gi,
    '$1 $\\triangle ABC$ $2'
  );
  healed = healed.replace(
    /\b(góc)\s{2,}(bằng|có\s+số\s+đo|là\s+góc)/gi,
    '$1 $\\widehat{BAC}$ $2'
  );
  healed = healed.replace(
    /\b(hàm\s+số)\s{2,}(đồng\s+biến|nghịch\s+biến|liên\s+tục|có\s+đạo\s+hàm|xác\s+định)/gi,
    '$1 $y = f(x)$ $2'
  );
  healed = healed.replace(
    /\b(tích\s+vô\s+hướng)\s{2,}(bằng|của)/gi,
    '$1 $\\vec{a} \\cdot \\vec{b}$ $2'
  );
  healed = healed.replace(
    /\b(hệ\s+phương\s+trình)\s{2,}(có|vô|thỏa)/gi,
    '$1 $\\begin{cases} a_1 x + b_1 y = c_1 \\\\ a_2 x + b_2 y = c_2 \\end{cases}$ $2'
  );

  healed = healed.replace(/[ \t]{2,}/g, ' ');

  return healed;
}

/**
 * Lệnh cưỡng chế chống đáp án rỗng (Strict Non-Empty Rule) cho Phần I:
 * Nghiêm cấm tuyệt đối xuất ra các phương án rỗng nội dung dạng A. . / B. . / C. . / D. . hoặc A. A / B. B
 */
export function sanitizeAndEnforceNonEmptyOptionText(
  rawText: string,
  label: 'A' | 'B' | 'C' | 'D',
  _slotIdx: number,
  _stemText: string,
  questionRuns?: ParsedRun[]
): string {
  let clean = (rawText || '').trim();
  clean = clean.replace(new RegExp(`^[*#]?\\s*${label}\\s*[.:)]\\s*`, 'i'), '').trim();

  const isInvalid =
    clean.length === 0 ||
    /^[.\-_:,;?!]+$/.test(clean);

  if (isInvalid) {
    if (questionRuns && questionRuns.length > 0) {
      const mathChunk = questionRuns
        .filter((r) => r.hasFormula || r.text.includes('$') || r.vertAlign)
        .map((r) => r.text)
        .join(' ')
        .trim();
      if (mathChunk.length > 0) {
        return mathChunk;
      }
    }
    return '';
  }

  return clean;
}

/**
 * Làm sạch nội dung các mệnh đề a), b), c), d) ở Phần II (Đúng/Sai):
 * Giữ nguyên 100% nội dung từ giáo viên, không tự bịa mệnh đề giả.
 */
export function sanitizeAndEnforceNonEmptySubItemText(
  rawText: string,
  label: 'a' | 'b' | 'c' | 'd',
  _slotIdx: number,
  _stemText: string,
  questionRuns?: ParsedRun[]
): string {
  let clean = (rawText || '').trim();
  clean = clean.replace(new RegExp(`^[*#]?\\s*${label}\\s*[).:]\\s*`, 'i'), '').trim();

  const isInvalid =
    clean.length === 0 ||
    /^[.\-_:,;?!]+$/.test(clean);

  if (isInvalid) {
    if (questionRuns && questionRuns.length > 0) {
      const mathChunk = questionRuns
        .filter((r) => r.hasFormula || r.text.includes('$') || r.vertAlign)
        .map((r) => r.text)
        .join(' ')
        .trim();
      if (mathChunk.length > 0) {
        return mathChunk;
      }
    }
    return '';
  }

  return clean;
}

/**
 * THUẬT TOÁN CHUẨN HÓA 4 PHƯƠNG ÁN A, B, C, D CHO PHẦN I
 * - Xử lý triệt để câu hỏi và đáp án dính chùm, dài không tách biệt nhau
 * - TUYỆT ĐỐI KHÔNG TỰ BỊA ĐÁP ÁN: Chỉ lấy đáp án được giáo viên đánh dấu (gạch chân, tô đỏ, dấu *, hoặc ghi Đáp án: X). Nếu thiếu thì giữ nguyên trạng thái chưa chọn để báo giáo viên bổ sung!
 */
export function enforceStrictFourOptionsPart1(
  question: ExamQuestion,
  questionRuns: ParsedRun[] = []
): ExamQuestion {
  if (question.part !== 'PART_1') return question;

  const existingOpts = question.options || [];
  const rawJoinedRuns = questionRuns.map((r) => r.text).join('');
  const labels: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];

  // Kiểm tra xem câu hỏi đã có đủ 4 phương án A, B, C, D tách biệt sạch sẽ chưa
  const stemHasClumpedFour = Boolean(
    findOrderedFourMarkers(question.stemText, ['A', 'B', 'C', 'D'], true)
  );
  const anyOptionHasClumpedNext = existingOpts.some((o) =>
    /(?:\t+|\s{2,}|[.;?!]\s*)[*#]?\s*[B-D]\s*[.:)]\s+\S/.test(o.text)
  );

  let finalStem = question.stemText.trim();
  let finalOptions: OptionPart1[] = [];

  if (
    (questionRuns.length === 0 && existingOpts.length === 4) ||
    (existingOpts.length === 4 &&
      existingOpts.every((o) => o.text.trim().length > 0 && !/^[.\-_:,;?!]+$/.test(o.text.trim())) &&
      !stemHasClumpedFour &&
      !anyOptionHasClumpedNext)
  ) {
    finalOptions = existingOpts.map((o, idx) => {
      const lbl = labels[idx];
      let cleanText = o.text.trim();
      let explicitCorrect = false;
      if (/^[*#]\s*/.test(cleanText)) {
        explicitCorrect = true;
        cleanText = cleanText.replace(/^[*#]\s*/, '').trim();
      }
      if (/(?:\[Đúng\]|\(Đúng\)|\(Đ\)|\[Đ\])$/i.test(cleanText)) {
        explicitCorrect = true;
        cleanText = cleanText.replace(/(?:\[Đúng\]|\(Đúng\)|\(Đ\)|\[Đ\])$/i, '').trim();
      }
      const isCorrect =
        questionRuns.length === 0 && !explicitCorrect
          ? Boolean(o.isCorrect)
          : Boolean(o.isCorrect || o.isUnderline || o.isRed || explicitCorrect);
      const isUnderline = isCorrect ? Boolean(o.isUnderline || explicitCorrect || isCorrect) : false;
      const isRed = isCorrect ? Boolean(o.isRed || explicitCorrect || isCorrect) : false;
      const safeText =
        questionRuns.length === 0
          ? cleanText
          : sanitizeAndEnforceNonEmptyOptionText(cleanText, lbl, idx, finalStem, questionRuns);
      return {
        ...o,
        id: o.id || `${question.id}-opt-${lbl}-${idx}`,
        originalLabel: lbl,
        currentLabel: o.currentLabel || lbl,
        text: safeText,
        isUnderline,
        isRed,
        isCorrect,
      };
    });
  } else {
    // Ghép toàn bộ văn bản của câu hỏi (cả stemText và các phương án đang có) để tách dính chùm
    const combinedText = [
      question.stemText,
      ...existingOpts.map(
        (o) => `${o.isCorrect || o.isUnderline || o.isRed ? '*' : ''}${o.originalLabel}. ${o.text}`
      ),
    ]
      .filter(Boolean)
      .join(' ');

    const orderedFour =
      findOrderedFourMarkers(combinedText, ['A', 'B', 'C', 'D'], true) ||
      findOrderedFourMarkers(combinedText, ['A', 'B', 'C', 'D'], false);

    if (orderedFour) {
      const [mA, mB, mC, mD] = orderedFour;
      const extractedStem = combinedText.slice(0, mA.markerStart).trim();
      if (extractedStem) {
        finalStem = healHollowedContextGaps(extractedStem);
      }

      const rawSegments: {
        label: 'A' | 'B' | 'C' | 'D';
        text: string;
        fullSeg: string;
        start: number;
        starred: boolean;
      }[] = [
        {
          label: 'A',
          text: combinedText.slice(mA.contentStart, mB.markerStart).trim(),
          fullSeg: combinedText.slice(mA.markerStart, mB.markerStart),
          start: mA.markerStart,
          starred: mA.isStarred,
        },
        {
          label: 'B',
          text: combinedText.slice(mB.contentStart, mC.markerStart).trim(),
          fullSeg: combinedText.slice(mB.markerStart, mC.markerStart),
          start: mB.markerStart,
          starred: mB.isStarred,
        },
        {
          label: 'C',
          text: combinedText.slice(mC.contentStart, mD.markerStart).trim(),
          fullSeg: combinedText.slice(mC.markerStart, mD.markerStart),
          start: mC.markerStart,
          starred: mC.isStarred,
        },
        {
          label: 'D',
          text: combinedText.slice(mD.contentStart).trim(),
          fullSeg: combinedText.slice(mD.markerStart),
          start: mD.markerStart,
          starred: mD.isStarred,
        },
      ];

      finalOptions = rawSegments.map((seg, idx) => {
        const prevOpt = existingOpts.find((o) => o.originalLabel === seg.label);
        const hl =
          questionRuns.length > 0
            ? checkRangeHighlight(questionRuns, rawJoinedRuns, seg.text, seg.start, seg.fullSeg)
            : { isUnderline: false, isRed: false };

        let cleanOptText = seg.text;
        let explicitCorrect = seg.starred;
        if (/(?:\[Đúng\]|\(Đúng\)|\(Đ\)|\[Đ\])$/i.test(cleanOptText)) {
          explicitCorrect = true;
          cleanOptText = cleanOptText.replace(/(?:\[Đúng\]|\(Đúng\)|\(Đ\)|\[Đ\])$/i, '').trim();
        }

        const isUnderline = Boolean(prevOpt?.isUnderline || hl.isUnderline || explicitCorrect);
        const isRed = Boolean(prevOpt?.isRed || hl.isRed || explicitCorrect);
        const isCorrect = Boolean(prevOpt?.isCorrect || isUnderline || isRed || explicitCorrect);
        const safeText = sanitizeAndEnforceNonEmptyOptionText(cleanOptText, seg.label, idx, finalStem, questionRuns);

        return {
          id: `${question.id}-opt-${seg.label}-${idx}`,
          originalLabel: seg.label,
          currentLabel: seg.label,
          text: safeText,
          isUnderline,
          isRed,
          isCorrect,
        };
      });
    } else {
      // Tách thêm các phương án bị gộp trong từng option hiện có
      const expandedPool: {
        text: string;
        isCorrect: boolean;
        isUnderline: boolean;
        isRed: boolean;
      }[] = [];
      for (const opt of existingOpts) {
        const subParts = opt.text
          .split(/(?:\t+|\s{3,}|\n+|(?<=[.;])\s*(?=[A-D]\s*[.:)]))/g)
          .map((s) => s.replace(/^[*#]?\s*[A-D]\s*[.:)]\s*/i, '').trim())
          .filter(Boolean);

        if (subParts.length > 1) {
          subParts.forEach((sp, idx) => {
            expandedPool.push({
              text: sp,
              isCorrect: idx === 0 ? opt.isCorrect : false,
              isUnderline: idx === 0 ? opt.isUnderline : false,
              isRed: idx === 0 ? opt.isRed : false,
            });
          });
        } else {
          expandedPool.push({
            text: opt.text.trim(),
            isCorrect: opt.isCorrect,
            isUnderline: opt.isUnderline,
            isRed: opt.isRed,
          });
        }
      }

      finalOptions = labels.map((lbl, idx) => {
        const item = expandedPool[idx];
        const prevOpt = existingOpts[idx];
        const rawT = item ? item.text : '';
        const isUnderline = Boolean(item?.isUnderline || prevOpt?.isUnderline);
        const isRed = Boolean(item?.isRed || prevOpt?.isRed);
        const isCorrect = Boolean(item?.isCorrect || prevOpt?.isCorrect);
        const safeText = sanitizeAndEnforceNonEmptyOptionText(rawT, lbl, idx, finalStem, questionRuns);

        return {
          id: `${question.id}-opt-${lbl}-${idx}`,
          originalLabel: lbl,
          currentLabel: lbl,
          text: safeText,
          isUnderline,
          isRed,
          isCorrect,
        };
      });
    }
  }

  // Chỉ áp dụng đáp án nếu giáo viên có ghi rõ "Đáp án: A/B/C/D" trong câu hỏi; TUYỆT ĐỐI KHÔNG tự bịa đáp án A!
  const correctList = finalOptions.filter((o) => o.isCorrect);
  if (correctList.length === 0 && finalOptions.length === 4) {
    const keyInStem = finalStem.match(/(?:Đáp\s*án|ĐS|Chọn(?:\s+đáp\s+án)?)\s*[:=]\s*([A-D])\b/i);
    if (keyInStem) {
      const targetLabel = keyInStem[1].toUpperCase() as 'A' | 'B' | 'C' | 'D';
      finalStem = finalStem.replace(keyInStem[0], '').trim();
      finalOptions = finalOptions.map((o) =>
        o.originalLabel === targetLabel
          ? { ...o, isCorrect: true, isUnderline: true, isRed: true }
          : o
      );
    }
  }

  return {
    ...question,
    stemText: finalStem || `Nội dung câu hỏi ${question.displayIndex}:`,
    options: finalOptions,
    computedLayout: computeAutoLayoutForOptions(finalOptions),
  };
}

/**
 * THUẬT TOÁN CHUẨN HÓA ĐÚNG 4 LỆNH HỎI a), b), c), d) CHO PHẦN II (ĐÚNG / SAI)
 * - Xử lý triệt để các ý a), b), c), d) viết liền nhau trên 1 dòng hoặc dính chùm vào thân câu hỏi
 * - TUYỆT ĐỐI KHÔNG BỊA ĐÁP ÁN: Chỉ nhận diện trạng thái Đúng/Sai từ giáo viên đưa lên (gạch chân, tô đỏ, *, (Đ)/(S), Đáp án: Đ-S-Đ-S)
 */
export function enforceStrictFourSubItemsPart2(
  question: ExamQuestion,
  questionRuns: ParsedRun[] = []
): ExamQuestion {
  if (question.part !== 'PART_2') return question;

  const existingSubs = question.subItems || [];
  const rawJoinedRuns = questionRuns.map((r) => r.text).join('');
  const labels: ('a' | 'b' | 'c' | 'd')[] = ['a', 'b', 'c', 'd'];

  const stemHasClumpedFour = Boolean(
    findOrderedFourMarkers(question.stemText, ['a', 'b', 'c', 'd'], true)
  );
  const anySubHasClumpedNext = existingSubs.some((s) =>
    /(?:\t+|\s{2,}|[.;?!]\s*)[*#]?\s*[b-d]\s*[).:]\s+\S/.test(s.text)
  );

  let finalStem = healHollowedContextGaps(question.stemText.trim());
  let finalSubs: SubItemPart2[] = [];

  if (
    (questionRuns.length === 0 && existingSubs.length === 4) ||
    (existingSubs.length === 4 &&
      existingSubs.every((s) => s.text.trim().length > 0 && !/^[.\-_:,;?!]+$/.test(s.text.trim())) &&
      !stemHasClumpedFour &&
      !anySubHasClumpedNext)
  ) {
    finalSubs = existingSubs.map((s, idx) => {
      const lbl = labels[idx];
      let cleanSubText = s.text.trim();
      let explicitTrue: boolean | null = null;
      if (/^[*#]\s*/.test(cleanSubText)) {
        explicitTrue = true;
        cleanSubText = cleanSubText.replace(/^[*#]\s*/, '').trim();
      }
      if (/(?:(?:\(|\[|[-–—:→]\s*)(?:Đ|Đúng|True)(?:\)|\])?\.?)$/i.test(cleanSubText)) {
        explicitTrue = true;
        cleanSubText = cleanSubText
          .replace(/(?:(?:\(|\[|[-–—:→]\s*)(?:Đ|Đúng|True)(?:\)|\])?\.?)$/i, '')
          .trim();
      } else if (/(?:(?:\(|\[|[-–—:→]\s*)(?:S|Sai|False)(?:\)|\])?\.?)$/i.test(cleanSubText)) {
        explicitTrue = false;
        cleanSubText = cleanSubText
          .replace(/(?:(?:\(|\[|[-–—:→]\s*)(?:S|Sai|False)(?:\)|\])?\.?)$/i, '')
          .trim();
      }
      const isTrue =
        explicitTrue !== null
          ? explicitTrue
          : questionRuns.length === 0
          ? Boolean(s.isTrue)
          : Boolean(s.isTrue || s.isUnderline || s.isRed);
      const isUnderline = isTrue ? Boolean(s.isUnderline || explicitTrue === true || isTrue) : false;
      const isRed = isTrue ? Boolean(s.isRed || explicitTrue === true || isTrue) : false;
      const safeText =
        questionRuns.length === 0
          ? cleanSubText
          : sanitizeAndEnforceNonEmptySubItemText(cleanSubText, lbl, idx, finalStem, questionRuns);

      return {
        ...s,
        id: s.id || `${question.id}-sub-${lbl}-${idx}`,
        originalLabel: lbl,
        currentLabel: s.currentLabel || lbl,
        text: safeText,
        isUnderline,
        isRed,
        isTrue,
      };
    });
  } else {
    const combinedText = [
      question.stemText,
      ...existingSubs.map(
        (s) => `${s.isTrue || s.isUnderline || s.isRed ? '*' : ''}${s.originalLabel}) ${s.text}`
      ),
    ]
      .filter(Boolean)
      .join(' ');

    const orderedFour =
      findOrderedFourMarkers(combinedText, ['a', 'b', 'c', 'd'], true) ||
      findOrderedFourMarkers(combinedText, ['a', 'b', 'c', 'd'], false);

    if (orderedFour) {
      const [mA, mB, mC, mD] = orderedFour;
      const extractedStem = combinedText.slice(0, mA.markerStart).trim();
      if (extractedStem) {
        finalStem = healHollowedContextGaps(extractedStem);
      }

      const rawSegments: {
        label: 'a' | 'b' | 'c' | 'd';
        text: string;
        fullSeg: string;
        start: number;
        starred: boolean;
      }[] = [
        {
          label: 'a',
          text: combinedText.slice(mA.contentStart, mB.markerStart).trim(),
          fullSeg: combinedText.slice(mA.markerStart, mB.markerStart),
          start: mA.markerStart,
          starred: mA.isStarred,
        },
        {
          label: 'b',
          text: combinedText.slice(mB.contentStart, mC.markerStart).trim(),
          fullSeg: combinedText.slice(mB.markerStart, mC.markerStart),
          start: mB.markerStart,
          starred: mB.isStarred,
        },
        {
          label: 'c',
          text: combinedText.slice(mC.contentStart, mD.markerStart).trim(),
          fullSeg: combinedText.slice(mC.markerStart, mD.markerStart),
          start: mC.markerStart,
          starred: mC.isStarred,
        },
        {
          label: 'd',
          text: combinedText.slice(mD.contentStart).trim(),
          fullSeg: combinedText.slice(mD.markerStart),
          start: mD.markerStart,
          starred: mD.isStarred,
        },
      ];

      finalSubs = rawSegments.map((seg, idx) => {
        const prevSub = existingSubs.find((s) => s.originalLabel === seg.label);
        const hl =
          questionRuns.length > 0
            ? checkRangeHighlight(questionRuns, rawJoinedRuns, seg.text, seg.start, seg.fullSeg)
            : { isUnderline: false, isRed: false };

        let cleanSubText = seg.text;
        let explicitTrue: boolean | null = seg.starred ? true : null;

        if (/(?:(?:\(|\[|[-–—:→]\s*)(?:Đ|Đúng|True)(?:\)|\])?\.?)$/i.test(cleanSubText)) {
          explicitTrue = true;
          cleanSubText = cleanSubText
            .replace(/(?:(?:\(|\[|[-–—:→]\s*)(?:Đ|Đúng|True)(?:\)|\])?\.?)$/i, '')
            .trim();
        } else if (/(?:(?:\(|\[|[-–—:→]\s*)(?:S|Sai|False)(?:\)|\])?\.?)$/i.test(cleanSubText)) {
          explicitTrue = false;
          cleanSubText = cleanSubText
            .replace(/(?:(?:\(|\[|[-–—:→]\s*)(?:S|Sai|False)(?:\)|\])?\.?)$/i, '')
            .trim();
        }

        const isTrue =
          explicitTrue !== null
            ? explicitTrue
            : Boolean(prevSub?.isTrue || prevSub?.isUnderline || prevSub?.isRed || hl.isUnderline || hl.isRed);
        const isUnderline = isTrue
          ? Boolean(prevSub?.isUnderline || hl.isUnderline || explicitTrue === true || isTrue)
          : false;
        const isRed = isTrue
          ? Boolean(prevSub?.isRed || hl.isRed || explicitTrue === true || isTrue)
          : false;
        const safeText = sanitizeAndEnforceNonEmptySubItemText(cleanSubText, seg.label, idx, finalStem, questionRuns);

        return {
          id: `${question.id}-sub-${seg.label}-${idx}`,
          originalLabel: seg.label,
          currentLabel: seg.label,
          text: safeText,
          isUnderline,
          isRed,
          isTrue,
        };
      });
    } else {
      const expandedPool: {
        text: string;
        isTrue: boolean;
        isUnderline: boolean;
        isRed: boolean;
      }[] = [];

      for (const sub of existingSubs) {
        const subParts = sub.text
          .split(/(?:\t+|\n+|(?<=[.;])\s*(?=[a-d]\s*[).:]))/gi)
          .map((s) => s.replace(/^[*#]?\s*[a-d]\s*[).:]\s*/i, '').trim())
          .filter(Boolean);

        if (subParts.length > 1) {
          subParts.forEach((sp) => {
            expandedPool.push({
              text: sp,
              isTrue: sub.isTrue,
              isUnderline: sub.isUnderline,
              isRed: sub.isRed,
            });
          });
        } else {
          expandedPool.push({
            text: sub.text.trim(),
            isTrue: sub.isTrue,
            isUnderline: sub.isUnderline,
            isRed: sub.isRed,
          });
        }
      }

      finalSubs = labels.map((lbl, idx) => {
        const item = expandedPool[idx];
        const rawT = item ? item.text : '';
        const safeText = sanitizeAndEnforceNonEmptySubItemText(rawT, lbl, idx, finalStem, questionRuns);
        return {
          id: `${question.id}-sub-${lbl}-${idx}`,
          originalLabel: lbl,
          currentLabel: lbl,
          text: safeText,
          isUnderline: item ? Boolean(item.isUnderline) : false,
          isRed: item ? Boolean(item.isRed) : false,
          isTrue: item ? Boolean(item.isTrue) : false,
        };
      });
    }
  }

  return {
    ...question,
    stemText:
      finalStem ||
      `Nội dung câu hỏi ${question.displayIndex}:`,
    subItems: finalSubs,
  };
}

/**
 * Chuẩn hóa toàn bộ danh sách câu hỏi kèm Auto-Healing (Toán - Lý - Hóa - Sinh):
 * - Đảm bảo câu hỏi ở Phần I tách đủ 4 đáp án (A, B, C, D) và Phần II tách đủ 4 ý (a, b, c, d)
 * - Tự động hàn gắn công thức gãy, chuẩn hóa Hóa học (H2SO4, Ca(OH)2, Cu2+, SO42-), Sinh học (AB/ab -> \frac{AB}{ab}, XAXa -> X^A X^a), Vật lý (\vec{v}, \Omega, \mu)
 * - TUYỆT ĐỐI KHÔNG tự bịa đáp án cho bất kỳ phần nào!
 */
export function normalizeAllQuestionsStrictFourOptions(
  questions: ExamQuestion[],
  resetPerPart = true
): ExamQuestion[] {
  // Lọc bỏ triệt để mọi câu hỏi giả (phantom question) do tiêu đề "PHẦN I/II/III/IV" hoặc "Tự luận" bị lọt vào
  const validQuestions = questions.filter((q) => {
    const rawStem = (q.stemText || '').trim();
    const isBareSectionStem =
      /^(?:[*#•+\-–—\s])*(?:(?:Câu(?:\s+hỏi|\s+số)?|Bài(?:\s+tập)?|Question|Cau)\s*\d+\s*[.:\-–—)]*\s*)?(?:(?:[IVX]+|\d+|[A-D])\s*[.:\-–—)]\s*)?(?:PHẦN\s*(?:IV|III|II|I|4|3|2|1|[A-D])|TỰ\s*LUẬN|TU\s*LUAN)\s*[.:\-–—)]*$/i.test(
        rawStem
      );
    if (isBareSectionStem) {
      const hasAnyOptionText = (q.options || []).some((o) => (o.text || '').trim().length > 0);
      const hasAnySubText = (q.subItems || []).some((s) => (s.text || '').trim().length > 0);
      if (!hasAnyOptionText && !hasAnySubText && !q.hasImage) {
        return false;
      }
    }
    return true;
  });

  const cleaned = validQuestions.map((q) => {
    const healedStem = autoHealScientificAndStemText(q.stemText || '');
    const healedQ: ExamQuestion = {
      ...q,
      stemText: healedStem,
      hasFormula:
        Boolean(q.hasFormula) ||
        /\$[^$]+\$|\\(?:frac|sqrt|vec|overrightarrow|xrightarrow|xrightleftharpoons|int|sum|lim)/.test(
          healedStem
        ),
    };

    if (healedQ.part === 'PART_1') {
      const normalizedP1 = enforceStrictFourOptionsPart1(healedQ);
      return {
        ...normalizedP1,
        options: (normalizedP1.options || []).map((opt) => ({
          ...opt,
          text: autoHealScientificAndStemText(opt.text || ''),
        })),
      };
    }
    if (healedQ.part === 'PART_2') {
      const normalizedP2 = enforceStrictFourSubItemsPart2(healedQ);
      return {
        ...normalizedP2,
        subItems: (normalizedP2.subItems || []).map((sub) => ({
          ...sub,
          text: autoHealScientificAndStemText(sub.text || ''),
        })),
      };
    }
    if (healedQ.part === 'PART_3') {
      return {
        ...healedQ,
        shortAnswer: (healedQ.shortAnswer || '').trim(),
        shortAnswerDetectedBy: (healedQ.shortAnswer || '').trim()
          ? healedQ.shortAnswerDetectedBy || 'MANUAL'
          : 'NONE',
      };
    }
    return healedQ;
  });

  const numbered = recalculateQuestionNumbering(cleaned, resetPerPart);
  return assignDeterministicImageTagsToQuestions(numbered);
}

/**
 * ENGINE 2.1b: Giải mã stream nhị phân MathType OLE / MTEF trong word/embeddings/*.bin
 * Trích xuất chuỗi LaTeX/MathType nhúng bên trong OLE2 container (nếu có)
 */
function extractLatexFromMathTypeOleBytes(bytes: Uint8Array): string {
  if (!bytes || bytes.length < 32) return '';
  try {
    const asciiText = new TextDecoder('latin1').decode(bytes);
    // Kiểm tra xem OLE object có chứa chuỗi LaTeX nhúng sẵn từ MathType translator hay không
    const texMatch = asciiText.match(
      /\\(?:frac|dfrac|sqrt|vec|overrightarrow|int|sum|lim|alpha|beta|gamma|Delta|Omega|lambda|mu|pi|sin|cos|tan|begin)\b[\x20-\x7E]{1,180}/
    );
    if (texMatch) {
      return texMatch[0].replace(/[^\x20-\x7E]+/g, ' ').trim();
    }
  } catch {
    // Bỏ qua nếu không giải mã được text từ OLE binary
  }
  return '';
}

async function loadOleEmbeddingsMap(zip: JSZip): Promise<Map<string, string>> {
  const oleMap = new Map<string, string>();
  const relsFile = zip.file('word/_rels/document.xml.rels');
  if (!relsFile) return oleMap;

  try {
    const relsXml = await relsFile.async('string');
    const parser = new DOMParser();
    const relsDoc = parser.parseFromString(relsXml, 'application/xml');
    const relNodes = relsDoc.getElementsByTagName('Relationship');

    for (let i = 0; i < relNodes.length; i++) {
      const rel = relNodes[i];
      const id = rel.getAttribute('Id');
      const target = rel.getAttribute('Target');
      const type = rel.getAttribute('Type') || '';

      if (
        id &&
        target &&
        (type.includes('oleObject') ||
          type.includes('package') ||
          /embeddings\/.*\.bin$/i.test(target))
      ) {
        let zipPath = target;
        if (target.startsWith('../')) {
          zipPath = target.replace(/^\.\.\//, '');
        } else if (!target.startsWith('word/')) {
          zipPath = `word/${target}`;
        }
        const binFile = zip.file(zipPath);
        if (binFile) {
          const uint8 = await binFile.async('uint8array');
          const extractedLatex = extractLatexFromMathTypeOleBytes(uint8);
          if (extractedLatex) {
            oleMap.set(id, extractedLatex);
          }
        }
      }
    }
  } catch {
    // Bỏ qua nếu không có embeddings
  }

  return oleMap;
}

/**
 * Đọc toàn bộ quan hệ media từ word/_rels/document.xml.rels (và quét dự phòng mọi tệp trong word/media/*)
 * Hỗ trợ đầy đủ các định dạng ảnh: png, jpg, jpeg, jfif, gif, bmp, webp, svg, emf, wmf, tif, tiff
 */
async function loadMediaRelationships(
  zip: JSZip
): Promise<Map<string, { dataUrl: string; fileName: string }>> {
  const mediaMap = new Map<string, { dataUrl: string; fileName: string }>();

  const findZipFileFlexible = (rawTarget: string): JSZip.JSZipObject | null => {
    let cleaned = rawTarget.trim().replace(/\\/g, '/');
    try {
      cleaned = decodeURIComponent(cleaned);
    } catch {
      // Giữ nguyên nếu không phải chuỗi URI encoded
    }
    cleaned = cleaned.replace(/^\/+/, '');
    const candidates: string[] = [];
    if (cleaned.startsWith('../')) {
      candidates.push(cleaned.replace(/^(?:\.\.\/)+/, ''));
      candidates.push(`word/${cleaned.replace(/^(?:\.\.\/)+/, '')}`);
    } else if (cleaned.startsWith('word/')) {
      candidates.push(cleaned);
      candidates.push(cleaned.replace(/^word\//, ''));
    } else {
      candidates.push(`word/${cleaned}`);
      candidates.push(cleaned);
    }

    for (const c of candidates) {
      const f = zip.file(c);
      if (f) return f;
    }

    const lowerCandidates = new Set(candidates.map((c) => c.toLowerCase()));
    const baseNameLower = (cleaned.split('/').pop() || '').toLowerCase();
    let fallbackByBaseName: JSZip.JSZipObject | null = null;
    for (const [pathKey, zipObj] of Object.entries(zip.files)) {
      if (zipObj.dir) continue;
      const normKey = pathKey.replace(/\\/g, '/').toLowerCase();
      if (lowerCandidates.has(normKey)) {
        return zipObj;
      }
      if (
        baseNameLower &&
        (normKey === `word/media/${baseNameLower}` || normKey.endsWith(`/${baseNameLower}`))
      ) {
        fallbackByBaseName = zipObj;
      }
    }
    return fallbackByBaseName;
  };

  const loadSingleMediaEntry = async (id: string, target: string) => {
    if (!id || !target || mediaMap.has(id)) return;
    const mediaFile = findZipFileFlexible(target);
    if (!mediaFile) return;

    const rawFileName = mediaFile.name.split('/').pop() || 'image.png';
    const ext = rawFileName.split('.').pop()?.toLowerCase() || 'png';

    if (ext === 'emf' || ext === 'wmf') {
      const uint8 = await mediaFile.async('uint8array');
      const healedPngDataUrl =
        await defaultDocxAutoHealEngine.convertMetafileBytesToPngDataUrl(
          uint8,
          rawFileName
        );
      mediaMap.set(id, {
        dataUrl: healedPngDataUrl,
        fileName: rawFileName.replace(/\.(emf|wmf)$/i, '.png'),
      });
    } else {
      let mime = 'image/png';
      if (ext === 'jpg' || ext === 'jpeg' || ext === 'jfif') mime = 'image/jpeg';
      else if (ext === 'gif') mime = 'image/gif';
      else if (ext === 'bmp') mime = 'image/bmp';
      else if (ext === 'webp') mime = 'image/webp';
      else if (ext === 'svg') mime = 'image/svg+xml';
      else if (ext === 'tif' || ext === 'tiff') mime = 'image/tiff';

      const base64 = await mediaFile.async('base64');
      const dataUrl = `data:${mime};base64,${base64}`;
      mediaMap.set(id, {
        dataUrl,
        fileName: rawFileName,
      });
    }
  };

  // Tìm tất cả các tệp .rels của document (hỗ trợ cả document.xml.rels, document2.xml.rels...)
  const relsFiles = zip.file(/^word\/_rels\/document.*\.xml\.rels$/i);
  const primaryRels = zip.file('word/_rels/document.xml.rels');
  const allRelsToRead =
    relsFiles.length > 0 ? relsFiles : primaryRels ? [primaryRels] : [];

  for (const relsFile of allRelsToRead) {
    const relsXml = await relsFile.async('string');
    const parser = new DOMParser();
    const relsDoc = parser.parseFromString(relsXml, 'application/xml');
    const relNodes = relsDoc.getElementsByTagName('*');

    for (let i = 0; i < relNodes.length; i++) {
      const rel = relNodes[i];
      const local = (rel.localName || rel.nodeName.replace(/^.*:/, '')).toLowerCase();
      if (local !== 'relationship') continue;

      const id = rel.getAttribute('Id') || rel.getAttribute('id') || '';
      const target = rel.getAttribute('Target') || rel.getAttribute('target') || '';
      const type = (rel.getAttribute('Type') || rel.getAttribute('type') || '').toLowerCase();

      if (
        id &&
        target &&
        (type.includes('image') ||
          type.includes('svg') ||
          /\.(png|jpe?g|jfif|gif|bmp|webp|svg|emf|wmf|tiff?)$/i.test(target) ||
          /media\//i.test(target))
      ) {
        await loadSingleMediaEntry(id, target);
      }
    }

    // Dự phòng bằng Regex nếu XML của .rels có lỗi cú pháp namespace
    const relTagRegex = /<(?:\w+:)?Relationship\b([^>]+)\/?>/gi;
    let rm: RegExpExecArray | null;
    while ((rm = relTagRegex.exec(relsXml)) !== null) {
      const attrs = rm[1];
      const idM = attrs.match(/\bId\s*=\s*["']([^"']+)["']/i);
      const targetM = attrs.match(/\bTarget\s*=\s*["']([^"']+)["']/i);
      const typeM = attrs.match(/\bType\s*=\s*["']([^"']+)["']/i);
      const id = idM ? idM[1] : '';
      const target = targetM ? targetM[1] : '';
      const type = typeM ? typeM[1].toLowerCase() : '';
      if (
        id &&
        target &&
        !mediaMap.has(id) &&
        (type.includes('image') ||
          type.includes('svg') ||
          /\.(png|jpe?g|jfif|gif|bmp|webp|svg|emf|wmf|tiff?)$/i.test(target) ||
          /media\//i.test(target))
      ) {
        await loadSingleMediaEntry(id, target);
      }
    }
  }

  return mediaMap;
}

/**
 * Kiểm tra nhanh xem một dòng văn bản có phải là tiêu đề hành chính đầu trang đề thi hay không
 * LƯU Ý QUAN TRỌNG: Nếu chuỗi rỗng (!clean), trả về false để KHÔNG bao giờ bỏ qua các đoạn văn chỉ chứa hình ảnh (standalone image paragraphs)!
 */
function isAdministrativeExamHeader(text: string): boolean {
  const clean = text.trim();
  if (!clean) return false;
  return /^(?:SỞ\s+GD|UBND\s+|PHÒNG\s+GD|TRƯỜNG\s+THPT|TRƯỜNG\s+THCS|BỘ\s+GIÁO\s+DỤC|ĐỀ\s+CHÍNH\s+THỨC|ĐỀ\s+KIỂM\s+TRA|ĐỀ\s+THI\b|ĐỀ\s+THAM\s+KHẢO|MÔN\s*[:.]|Môn\s+thi\s*[:.]|Thời\s+gian\s+làm\s+bài|Họ\s+và\s+tên|Họ,\s+tên\s+thí\s+sinh|Số\s+báo\s+danh|Mã\s+đề\s*(?:thi)?\s*[:.]|Đề\s+thi\s+gồm\s+có|Không\s+kể\s+thời\s+gian|-----\s*HẾT\s*-----|\(Đề\s+gồm|Thí\s+sinh\s+trả\s+lời\s+từ\s+câu|Mỗi\s+câu\s+hỏi\s+thí\s+sinh\s+chỉ\s+chọn|Trong\s+mỗi\s+ý\s+a\)\s*,\s*b\)\s*,\s*c\)\s*,\s*d\))/i.test(
    clean
  );
}

/**
 * Loại bỏ tiền tố "Câu X." / "X." bị dính nhầm vào dòng tiêu đề PHẦN I/II/III/IV hoặc TỰ LUẬN
 * (Do giáo viên bấm Enter từ câu trên mà chưa tắt Auto-Numbering trong Word, tạo ra "Câu 5. PHẦN III. Tự luận" hoặc "Câu 5. PHẦN III.")
 */
function stripAccidentalQuestionPrefixFromSectionHeader(rawText: string): string {
  const clean = rawText.trim();
  if (!clean) return clean;
  const match = clean.match(
    /^(?:[*#•+\-–—\s])*(?:(?:Câu(?:\s+hỏi|\s+số)?|Bài(?:\s+tập)?|Question|Cau)\s*\d+|\d{1,3})\s*[.:\-–—)]+\s*((?:(?:[IVX]+|\d+|[A-D])\s*[.:\-–—)]\s*)?(?:PHẦN\s*(?:IV|III|II|I|4|3|2|1|[A-D])\b.*|(?:TỰ\s*LUẬN|TU\s*LUAN)\b.*))$/i
  );
  if (match && match[1]) {
    return match[1].trim();
  }
  return clean;
}

/**
 * Kiểm tra xem một dòng có phải là tiêu đề Phần Tự Luận hay không:
 * Chuẩn hóa nhận diện Tự Luận theo yêu cầu người dùng:
 * Bất kể ghi Phần III hoặc Phần IV (hoặc Phần II, Phần 2, Phần 3, Phần 4, B. Tự luận...),
 * MIỄN LÀ DÒNG CÓ CHỨA CHỮ "TỰ LUẬN" (hoặc "tu luan" không dấu) thì 100% ĐƯỢC XÁC ĐỊNH LÀ PHẦN TỰ LUẬN (PART_4)!
 * Đồng thời hỗ trợ tiêu đề thuần "PHẦN IV" / "PHẦN 4" kể cả khi không viết kèm chữ "Tự luận".
 */
export function isEssaySectionHeader(text: string): boolean {
  const clean = stripAccidentalQuestionPrefixFromSectionHeader(text);
  if (!clean) return false;

  // Loại trừ các câu hỏi cụ thể (VD: "Câu 1. Em hãy giải bài tập tự luận sau...", "Bài 1. Tự luận:")
  if (
    /^(?:[*#•+\-–—\s]|\[[^\]]{1,15}\]|\([^)\d]{1,15}\))*(?:Câu(?:\s+hỏi|\s+số)?|Bài(?:\s+tập)?|Question|Cau)\s*\d+\b/i.test(
      clean
    )
  ) {
    return false;
  }

  // Loại trừ tiêu đề hành chính đầu đề thi kiểu "Hình thức thi: Trắc nghiệm và Tự luận"
  if (
    /^(?:Hình\s+thức(?:\s+thi|\s+kiểm\s+tra)?\s*[:.]|Đề\s+(?:thi\s+)?gồm|Thời\s+gian|Hướng\s+dẫn\s+chung)/i.test(
      clean
    ) &&
    /\b(?:trắc\s*nghiệm\s*(?:và|&)\s*tự\s*luận)\b/i.test(clean)
  ) {
    return false;
  }

  // Bắt mọi biến thể chứa "TỰ LUẬN" hoặc "TU LUAN" (có hoặc không có dấu, hoa/thường):
  // Miễn là có chữ tự luận trong tiêu đề (bất kể ghi Phần III hay Phần IV)
  if (/\b(?:tự\s*luận|tu\s*luan)\b/i.test(clean)) {
    return true;
  }

  // Hoặc ghi rõ PHẦN IV / PHẦN 4 mà không phải câu hỏi
  if (
    /^(?:[*#•+\-–—\s])*(?:(?:[IVX]+|\d+|[A-D])\s*[.:\-–—)]\s*)?PHẦN\s*(?:IV|4)\b/i.test(
      clean
    )
  ) {
    return true;
  }

  return false;
}

interface ExtractedLineItem {
  label: string;
  text: string;
  fullSegment: string;
  markerStart: number;
  isStarred: boolean;
}

/**
 * Bóc tách tuần tự các phương án A, B, C, D trong một dòng văn bản của Phần I
 * Chống tách nhầm các từ như "Vitamin A.", "Nhóm máu B.", "Gen A." nằm bên trong nội dung đáp án
 */
function extractSequentialOptionsFromLine(
  lineText: string
): { leadingStem: string; items: ExtractedLineItem[] } {
  const orderedFour = findOrderedFourMarkers(lineText, ['A', 'B', 'C', 'D'], true);
  if (orderedFour) {
    const [mA, mB, mC, mD] = orderedFour;
    return {
      leadingStem: lineText.slice(0, mA.markerStart).trim(),
      items: [
        {
          label: 'A',
          text: lineText.slice(mA.contentStart, mB.markerStart).trim(),
          fullSegment: lineText.slice(mA.markerStart, mB.markerStart),
          markerStart: mA.markerStart,
          isStarred: mA.isStarred,
        },
        {
          label: 'B',
          text: lineText.slice(mB.contentStart, mC.markerStart).trim(),
          fullSegment: lineText.slice(mB.markerStart, mC.markerStart),
          markerStart: mB.markerStart,
          isStarred: mB.isStarred,
        },
        {
          label: 'C',
          text: lineText.slice(mC.contentStart, mD.markerStart).trim(),
          fullSegment: lineText.slice(mC.markerStart, mD.markerStart),
          markerStart: mC.markerStart,
          isStarred: mC.isStarred,
        },
        {
          label: 'D',
          text: lineText.slice(mD.contentStart).trim(),
          fullSegment: lineText.slice(mD.markerStart),
          markerStart: mD.markerStart,
          isStarred: mD.isStarred,
        },
      ],
    };
  }

  // Trường hợp dòng bắt đầu bằng 1 phương án A., B., C., D. (hoặc có 2 phương án trên 1 dòng chia bằng tab / khoảng trắng)
  const startMatch = lineText.match(/^\s*([*#]?\s*([A-D])\s*[.:)])\s+/);
  if (!startMatch) {
    return { leadingStem: '', items: [] };
  }

  const candidateRegex = /(?:^|\t+|\s{2,}|(?<=[.;?!])\s+)([*#]?\s*([A-D])\s*[.:)])\s+/g;
  const acceptedMarkers: {
    label: string;
    markerStart: number;
    contentStart: number;
    isStarred: boolean;
  }[] = [];

  let m: RegExpExecArray | null;
  while ((m = candidateRegex.exec(lineText)) !== null) {
    const fullM = m[0];
    const markerGrp = m[1];
    const lbl = m[2].toUpperCase();
    const offset = fullM.indexOf(markerGrp);
    const markerStart = m.index + (offset >= 0 ? offset : 0);
    const contentStart = m.index + fullM.length;
    const isStarred = markerGrp.startsWith('*') || markerGrp.startsWith('#');

    if (acceptedMarkers.length === 0) {
      acceptedMarkers.push({ label: lbl, markerStart, contentStart, isStarred });
    } else {
      const prevLbl = acceptedMarkers[acceptedMarkers.length - 1].label;
      // Chỉ chấp nhận tách thêm phương án trên cùng dòng nếu chữ cái tăng dần (VD: A -> B, C -> D, A -> C, B -> D)
      if (lbl.charCodeAt(0) > prevLbl.charCodeAt(0)) {
        acceptedMarkers.push({ label: lbl, markerStart, contentStart, isStarred });
      }
    }

    if (m.index === candidateRegex.lastIndex) {
      candidateRegex.lastIndex++;
    }
  }

  const items: ExtractedLineItem[] = acceptedMarkers.map((mk, idx) => {
    const nextStart =
      idx + 1 < acceptedMarkers.length ? acceptedMarkers[idx + 1].markerStart : lineText.length;
    return {
      label: mk.label,
      text: lineText.slice(mk.contentStart, nextStart).trim(),
      fullSegment: lineText.slice(mk.markerStart, nextStart),
      markerStart: mk.markerStart,
      isStarred: mk.isStarred,
    };
  });

  return {
    leadingStem: acceptedMarkers.length > 0 ? lineText.slice(0, acceptedMarkers[0].markerStart).trim() : '',
    items,
  };
}

/**
 * Bóc tách tuần tự các ý a), b), c), d) trong một dòng văn bản của Phần II (Đúng/Sai)
 * Chống tách nhầm các ký hiệu kiểu gen (aa), (bb), (ab) hoặc hình a) nằm bên trong câu
 */
function extractSequentialSubItemsFromLine(
  lineText: string
): { leadingStem: string; items: ExtractedLineItem[] } {
  const orderedFour = findOrderedFourMarkers(lineText, ['a', 'b', 'c', 'd'], true);
  if (orderedFour) {
    const [mA, mB, mC, mD] = orderedFour;
    return {
      leadingStem: lineText.slice(0, mA.markerStart).trim(),
      items: [
        {
          label: 'a',
          text: lineText.slice(mA.contentStart, mB.markerStart).trim(),
          fullSegment: lineText.slice(mA.markerStart, mB.markerStart),
          markerStart: mA.markerStart,
          isStarred: mA.isStarred,
        },
        {
          label: 'b',
          text: lineText.slice(mB.contentStart, mC.markerStart).trim(),
          fullSegment: lineText.slice(mB.markerStart, mC.markerStart),
          markerStart: mB.markerStart,
          isStarred: mB.isStarred,
        },
        {
          label: 'c',
          text: lineText.slice(mC.contentStart, mD.markerStart).trim(),
          fullSegment: lineText.slice(mC.markerStart, mD.markerStart),
          markerStart: mC.markerStart,
          isStarred: mC.isStarred,
        },
        {
          label: 'd',
          text: lineText.slice(mD.contentStart).trim(),
          fullSegment: lineText.slice(mD.markerStart),
          markerStart: mD.markerStart,
          isStarred: mD.isStarred,
        },
      ],
    };
  }

  const startMatch = lineText.match(/^\s*([*#]?\s*([a-d])\s*[).:])\s+/);
  if (!startMatch) {
    return { leadingStem: '', items: [] };
  }

  const candidateRegex = /(?:^|\t+|\s{2,}|(?<=[.;?!])\s+)([*#]?\s*([a-d])\s*[).:])\s+/g;
  const acceptedMarkers: {
    label: string;
    markerStart: number;
    contentStart: number;
    isStarred: boolean;
  }[] = [];

  let m: RegExpExecArray | null;
  while ((m = candidateRegex.exec(lineText)) !== null) {
    const fullM = m[0];
    const markerGrp = m[1];
    const lbl = m[2].toLowerCase();
    const offset = fullM.indexOf(markerGrp);
    const markerStart = m.index + (offset >= 0 ? offset : 0);
    const contentStart = m.index + fullM.length;
    const isStarred = markerGrp.startsWith('*') || markerGrp.startsWith('#');

    if (acceptedMarkers.length === 0) {
      acceptedMarkers.push({ label: lbl, markerStart, contentStart, isStarred });
    } else {
      const prevLbl = acceptedMarkers[acceptedMarkers.length - 1].label;
      if (lbl.charCodeAt(0) > prevLbl.charCodeAt(0)) {
        acceptedMarkers.push({ label: lbl, markerStart, contentStart, isStarred });
      }
    }

    if (m.index === candidateRegex.lastIndex) {
      candidateRegex.lastIndex++;
    }
  }

  const items: ExtractedLineItem[] = acceptedMarkers.map((mk, idx) => {
    const nextStart =
      idx + 1 < acceptedMarkers.length ? acceptedMarkers[idx + 1].markerStart : lineText.length;
    return {
      label: mk.label,
      text: lineText.slice(mk.contentStart, nextStart).trim(),
      fullSegment: lineText.slice(mk.markerStart, nextStart),
      markerStart: mk.markerStart,
      isStarred: mk.isStarred,
    };
  });

  return {
    leadingStem: acceptedMarkers.length > 0 ? lineText.slice(0, acceptedMarkers[0].markerStart).trim() : '',
    items,
  };
}

/**
 * Phân tích danh sách ParsedParagraph thành danh sách ExamQuestion chuẩn 3-4 phần
 * (Dùng chung cho cả bộ đọc .docx, .pdf và Trình soạn thảo văn bản Word trực tiếp)
 */
export function buildQuestionsFromParsedParagraphs(
  paragraphs: ParsedParagraph[],
  resetPerPart = true
): ExamQuestion[] {
  let currentPart: PartType = 'PART_1';
  const questions: ExamQuestion[] = [];
  let currentQuestion: ExamQuestion | null = null;
  let currentQuestionRuns: ParsedRun[] = [];
  let pendingStemParagraphs: ParsedParagraph[] = [];
  let globalIndex = 1;
  let inTrailingAnswerKeySection = false;
  let inIgnoredEssaySection = false;
  let inQuestionSolutionBlock = false;
  const trailingAnswerKeyPart1 = new Map<number, 'A' | 'B' | 'C' | 'D'>();
  const trailingAnswerKeyPart2 = new Map<number, boolean[]>();
  const trailingAnswerKeyPart3 = new Map<number, string>();
  const trailingAnswerKeyPart4 = new Map<number, string>();
  let trailingKeyCurrentPart: PartType = 'PART_1';
  let currentTrailingEssayQNum: number | null = null;

  const parseTrailingAnswerTextLine = (lineStr: string) => {
    const cleanLine = normalizeVietnameseExamText(lineStr).trim();
    if (!cleanLine) return;

    const strippedPrefix = cleanLine.replace(/^[*#•\-–—\s]+/, '');
    if (isEssaySectionHeader(strippedPrefix)) {
      trailingKeyCurrentPart = 'PART_4';
      return;
    }
    if (
      (!/\b(?:tự\s*luận|tu\s*luan)\b/i.test(strippedPrefix) &&
        /^(?:(?:[IVX]+|\d+)\s*[.:\-–—)]\s*)?PHẦN\s+(I|1)\b/i.test(strippedPrefix) &&
        !/PHẦN\s+(IV|III|II)/i.test(strippedPrefix)) ||
      /trắc\s+nghiệm\s+nhiều\s+phương\s+án/i.test(strippedPrefix)
    ) {
      trailingKeyCurrentPart = 'PART_1';
      return;
    }
    if (
      (!/\b(?:tự\s*luận|tu\s*luan)\b/i.test(strippedPrefix) &&
        /^(?:(?:[IVX]+|\d+)\s*[.:\-–—)]\s*)?PHẦN\s+(II|2)\b/i.test(strippedPrefix) &&
        !/PHẦN\s+(IV|III)/i.test(strippedPrefix)) ||
      /trắc\s+nghiệm\s+đúng\s*[\/\-–—\s]*sai/i.test(strippedPrefix)
    ) {
      trailingKeyCurrentPart = 'PART_2';
      return;
    }
    if (
      (!/\b(?:tự\s*luận|tu\s*luan)\b/i.test(strippedPrefix) &&
        /^(?:(?:[IVX]+|\d+)\s*[.:\-–—)]\s*)?PHẦN\s+(III|3)\b/i.test(strippedPrefix)) ||
      /trắc\s+nghiệm\s+trả\s+lời\s+ngắn/i.test(strippedPrefix)
    ) {
      trailingKeyCurrentPart = 'PART_3';
      return;
    }

    // Nhận diện đáp án Đúng/Sai Phần II trong bảng đáp án cuối đề: VD "Câu 1: Đ - S - Đ - S" hoặc "Câu 1: a) Đ b) S c) Đ d) S"
    const p2ExplicitMatch = cleanLine.match(
      /(?:Câu\s*)?(\d{1,2})\s*[.:\-–—)]\s*(?:a[).:\-\s]*([ĐDSstruefalse]+)[,;\s]+b[).:\-\s]*([ĐDSstruefalse]+)[,;\s]+c[).:\-\s]*([ĐDSstruefalse]+)[,;\s]+d[).:\-\s]*([ĐDSstruefalse]+)|([ĐDS]{1})\s*[-–—,\s]\s*([ĐDS]{1})\s*[-–—,\s]\s*([ĐDS]{1})\s*[-–—,\s]\s*([ĐDS]{1})|([ĐDS]{4}))\b/i
    );
    if (p2ExplicitMatch) {
      const qNum = parseInt(p2ExplicitMatch[1], 10);
      let rawTokens: string[] = [];
      if (p2ExplicitMatch[2]) {
        rawTokens = [p2ExplicitMatch[2], p2ExplicitMatch[3], p2ExplicitMatch[4], p2ExplicitMatch[5]];
      } else if (p2ExplicitMatch[6]) {
        rawTokens = [p2ExplicitMatch[6], p2ExplicitMatch[7], p2ExplicitMatch[8], p2ExplicitMatch[9]];
      } else if (p2ExplicitMatch[10]) {
        rawTokens = p2ExplicitMatch[10].split('');
      }
      if (rawTokens.length === 4 && qNum >= 1 && qNum <= 50) {
        const boolArr = rawTokens.map((tk) => /^[ĐD]|true/i.test(tk.trim()));
        trailingAnswerKeyPart2.set(qNum, boolArr);
        return;
      }
    }

    // Nếu đang ở khu vực Phần III (Trả lời ngắn) của Bảng đáp án cuối đề
    if (trailingKeyCurrentPart === 'PART_3') {
      const p3PairRegex = /(?:Câu\s*)?(\d{1,2})\s*[.:\-–—)]\s*(-?\d+(?:[.,]\d+)?)/gi;
      let m3: RegExpExecArray | null;
      let matchedP3 = false;
      while ((m3 = p3PairRegex.exec(cleanLine)) !== null) {
        const qNum = parseInt(m3[1], 10);
        const val = m3[2].trim();
        if (qNum >= 1 && qNum <= 50 && !trailingAnswerKeyPart3.has(qNum)) {
          trailingAnswerKeyPart3.set(qNum, val);
          matchedP3 = true;
        }
      }
      if (matchedP3) return;
    }

    // Quét các cặp đáp án trắc nghiệm Phần I dạng "1.A", "1-A", "1: A", "Câu 1: A"
    const pairRegex = /(?:Câu\s*)?(\d{1,3})\s*[.:\-–—)\s]\s*([A-D])\b/gi;
    let pm: RegExpExecArray | null;
    let matchedMcq = false;
    while ((pm = pairRegex.exec(cleanLine)) !== null) {
      const qNum = parseInt(pm[1], 10);
      const ansLetter = pm[2].toUpperCase() as 'A' | 'B' | 'C' | 'D';
      if (qNum >= 1 && qNum <= 200 && !trailingAnswerKeyPart1.has(qNum)) {
        trailingAnswerKeyPart1.set(qNum, ansLetter);
        matchedMcq = true;
      }
    }

    if (!matchedMcq && !isAdministrativeExamHeader(cleanLine)) {
      const trailingEssayMatch = cleanLine.match(
        /^(?:[*#•+\-–—\s])*(?:Câu|Bài)\s*(\d{1,2})\s*(?:\([^)]{1,25}\))?\s*[.:\-–—)]\s*(.*)$/i
      );
      if (trailingEssayMatch) {
        currentTrailingEssayQNum = parseInt(trailingEssayMatch[1], 10);
        const body = trailingEssayMatch[2].trim();
        if (body) {
          const prev = trailingAnswerKeyPart4.get(currentTrailingEssayQNum) || '';
          trailingAnswerKeyPart4.set(currentTrailingEssayQNum, prev ? `${prev}\n${body}` : body);
        }
      } else if (
        currentTrailingEssayQNum !== null &&
        !/^(?:PHẦN\s+(?:I|II|III|IV|1|2|3|4)|TỰ\s+LUẬN)/i.test(cleanLine)
      ) {
        const prev = trailingAnswerKeyPart4.get(currentTrailingEssayQNum) || '';
        trailingAnswerKeyPart4.set(currentTrailingEssayQNum, prev ? `${prev}\n${cleanLine}` : cleanLine);
      }
    }
  };

  const startNewQuestionFromPara = (para: ParsedParagraph, customStemText?: string) => {
    inQuestionSolutionBlock = false;
    let stemContent = (customStemText !== undefined ? customStemText : para.fullText).trim();
    const initialImages: ExamImageAttachment[] = [...para.images];
    currentQuestionRuns = [...para.runs];

    // Bóc tách sớm nếu trong cùng đoạn mở đầu câu hỏi có dính kèm Lời giải / Hướng dẫn chấm / Đáp án
    let extractedInlineExplanation = '';
    const inlineSolMatch = stemContent.match(
      /(?:\r?\n|\s{2,}|\.\s+)(?:[*#•+\-–—\s])*(?:Lời\s*giải(?:\s*chi\s*tiết)?|Hướng\s*dẫn(?:\s*chấm|\s*giải)?|Giải\s*chi\s*tiết|HDG|HDC|Thang\s*điểm|Biểu\s*điểm)\s*[:=.\-–—]\s*([\s\S]+)$/i
    );
    if (inlineSolMatch && inlineSolMatch.index !== undefined) {
      extractedInlineExplanation = inlineSolMatch[1].trim();
      stemContent = stemContent.slice(0, inlineSolMatch.index).trim();
      inQuestionSolutionBlock = true;
    }

    currentQuestion = {
      id: `q-${currentPart.toLowerCase()}-${globalIndex}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      part: currentPart,
      originalIndex: globalIndex++,
      displayIndex: 1,
      stemText: stemContent,
      hasFormula: para.hasFormula || /[√∫∑πΔαβλθ±×÷≤≥≠∈∉→∞]/.test(stemContent),
      hasImage: initialImages.length > 0,
      images: initialImages.length > 0 ? initialImages : undefined,
      rawFormulaOmmlXml: para.rawFormulaXml,
      formulaLatex: para.formulaLatex,
      options: currentPart === 'PART_1' ? [] : undefined,
      subItems: currentPart === 'PART_2' ? [] : undefined,
      shortAnswer: currentPart === 'PART_3' ? '' : undefined,
      shortAnswerDetectedBy: currentPart === 'PART_3' ? 'NONE' : undefined,
      essayAnswer: currentPart === 'PART_4' ? extractedInlineExplanation : undefined,
      explanation: extractedInlineExplanation || undefined,
    };

    if (currentPart === 'PART_3') {
      const ansKeyword = stemContent.match(/(?:Đáp\s*án|Đáp\s*số|ĐS|Kết\s*quả)\s*[:=]\s*([-\d.,]+)/i);
      if (ansKeyword) {
        currentQuestion.shortAnswer = ansKeyword[1].trim();
        currentQuestion.shortAnswerDetectedBy = 'KEYWORD';
        currentQuestion.stemText = stemContent.replace(ansKeyword[0], '').trim();
      } else {
        // Chỉ nhận diện số gạch chân / tô đỏ làm đáp án nếu run đó KHÔNG phải nhãn "Câu X" ở đầu câu
        // và bản thân chuỗi được gạch chân/tô đỏ là một con số độc lập
        const nonHeaderHighlightedText = para.runs
          .filter(
            (r) =>
              (r.isUnderline || r.isRed) &&
              !/^\s*(?:[*#•+\-–—\s])*(?:Câu|Bài|Question)\b/i.test(r.text)
          )
          .map((r) => r.text)
          .join('')
          .trim();
        if (/^[*#]?\s*-?\d+(?:[.,]\d+)?\s*$/.test(nonHeaderHighlightedText)) {
          const numMatch = nonHeaderHighlightedText.match(/-?\d+(?:[.,]\d+)?/);
          if (numMatch) {
            currentQuestion.shortAnswer = numMatch[0];
            currentQuestion.shortAnswerDetectedBy = 'UNDERLINE_RED';
          }
        }
      }
    } else if (currentPart === 'PART_4') {
      const essayAnsMatch = stemContent.match(
        /(?:Đáp\s*án|Đáp\s*số|ĐS|Lời\s*giải|Hướng\s*dẫn(?:\s*chấm|\s*giải)?|HDC|HDG)\s*[:=]\s*([\s\S]+)$/i
      );
      if (essayAnsMatch && essayAnsMatch.index !== undefined) {
        currentQuestion.essayAnswer = essayAnsMatch[1].trim();
        currentQuestion.explanation = essayAnsMatch[1].trim();
        currentQuestion.stemText = stemContent.slice(0, essayAnsMatch.index).trim();
        inQuestionSolutionBlock = true;
      }
    }
  };

  const pushCurrentQuestion = () => {
    inQuestionSolutionBlock = false;
    if (!currentQuestion) return;

    // Chặn tuyệt đối trường hợp tiêu đề "PHẦN I/II/III/IV." bị nhận nhầm thành thân câu hỏi rỗng
    const trimmedStemCheck = (currentQuestion.stemText || '').trim();
    if (
      /^(?:[*#•+\-–—\s])*(?:(?:[IVX]+|\d+|[A-D])\s*[.:\-–—)]\s*)?(?:PHẦN\s*(?:IV|III|II|I|4|3|2|1|[A-D])|TỰ\s*LUẬN|TU\s*LUAN)\s*[.:\-–—)]*$/i.test(
        trimmedStemCheck
      )
    ) {
      const hasOpts = (currentQuestion.options || []).some((o) => (o.text || '').trim().length > 0);
      const hasSubs = (currentQuestion.subItems || []).some((s) => (s.text || '').trim().length > 0);
      if (!hasOpts && !hasSubs && !currentQuestion.hasImage) {
        currentQuestion = null;
        currentQuestionRuns = [];
        return;
      }
    }

    // Nếu câu hỏi đang ở PART_1 nhưng hoàn toàn không có phương án A,B,C,D mà lại có đủ 4 ý a), b), c), d) -> chuyển câu này sang PART_2
    if (
      currentQuestion.part === 'PART_1' &&
      (!currentQuestion.options || currentQuestion.options.length === 0)
    ) {
      const combinedCheck = [
        currentQuestion.stemText,
        ...(currentQuestion.subItems || []).map((s) => `${s.originalLabel}) ${s.text}`),
      ].join(' ');
      const hasFourUpperABCD = Boolean(
        findOrderedFourMarkers(combinedCheck, ['A', 'B', 'C', 'D'], true)
      );
      const hasFourLowerAbcd = Boolean(
        findOrderedFourMarkers(combinedCheck, ['a', 'b', 'c', 'd'], true)
      );

      if (
        !hasFourUpperABCD &&
        (hasFourLowerAbcd || (currentQuestion.subItems && currentQuestion.subItems.length >= 3))
      ) {
        currentQuestion.part = 'PART_2';
      }
    }

    if (currentQuestion.part === 'PART_1') {
      currentQuestion = enforceStrictFourOptionsPart1(currentQuestion, currentQuestionRuns);
    } else if (currentQuestion.part === 'PART_2') {
      currentQuestion = enforceStrictFourSubItemsPart2(currentQuestion, currentQuestionRuns);
    } else if (currentQuestion.part === 'PART_3') {
      if (!currentQuestion.shortAnswer?.trim()) {
        const ansKeyword = currentQuestion.stemText.match(
          /(?:Đáp\s*án|Đáp\s*số|ĐS|Kết\s*quả)\s*[:=]\s*([-\d.,]+)/i
        );
        if (ansKeyword) {
          currentQuestion.shortAnswer = ansKeyword[1].trim();
          currentQuestion.shortAnswerDetectedBy = 'KEYWORD';
          currentQuestion.stemText = currentQuestion.stemText
            .replace(ansKeyword[0], '')
            .trim();
        }
      }
    } else if (currentQuestion.part === 'PART_4') {
      const mergedEssayAns = (
        currentQuestion.essayAnswer ||
        currentQuestion.explanation ||
        ''
      ).trim();
      currentQuestion.essayAnswer = mergedEssayAns || undefined;
      if (mergedEssayAns && !currentQuestion.explanation) {
        currentQuestion.explanation = mergedEssayAns;
      }
    }
    questions.push(currentQuestion);
    currentQuestion = null;
    currentQuestionRuns = [];
  };

  for (const para of paragraphs) {
    // Nếu đang ở phần Bảng đáp án / Hướng dẫn chấm cuối đề: đọc dữ liệu đáp án từ bảng (nếu có) nhưng tuyệt đối không gắn bảng vào đề thi
    if (inTrailingAnswerKeySection && para.attachedTable) {
      const rows = para.attachedTable.rows || [];
      for (let rIdx = 0; rIdx < rows.length; rIdx++) {
        const row = rows[rIdx];
        const joinedRow = row.map((c) => c.text.trim()).filter(Boolean).join(' ');
        parseTrailingAnswerTextLine(joinedRow);

        // Hỗ trợ bảng 2 dòng ngang: dòng trên là Câu 1 | Câu 2..., dòng dưới là A | B... hoặc Đáp số
        if (rIdx + 1 < rows.length && row.length >= 2 && rows[rIdx + 1].length === row.length) {
          const nextRow = rows[rIdx + 1];
          for (let cIdx = 0; cIdx < row.length; cIdx++) {
            const topCell = row[cIdx].text.trim();
            const botCell = nextRow[cIdx].text.trim();
            const qNumMatch = topCell.match(/^(?:Câu\s*)?(\d{1,3})$/i);
            if (qNumMatch && botCell) {
              parseTrailingAnswerTextLine(`Câu ${qNumMatch[1]}: ${botCell}`);
            }
          }
        }
      }
      continue;
    }

    // Nếu đoạn văn mang Bảng dữ liệu hoặc Bảng ghép đôi Cột A - Cột B thuộc câu hỏi hiện tại (và không nằm trong khối lời giải)
    if (para.attachedTable) {
      if (currentQuestion && !inQuestionSolutionBlock) {
        currentQuestion.stemTables = [...(currentQuestion.stemTables || []), para.attachedTable];
        if (para.images && para.images.length > 0) {
          currentQuestion.hasImage = true;
          currentQuestion.images = [...(currentQuestion.images || []), ...para.images];
        }
      } else if (!currentQuestion && para.images && para.images.length > 0) {
        pendingStemParagraphs.push(para);
      }
      continue;
    }

    const rawNormalizedText = normalizeVietnameseExamText(para.fullText).trim();
    const text = stripAccidentalQuestionPrefixFromSectionHeader(rawNormalizedText);
    if (!text && para.images.length === 0) continue;
    const rawJoined = normalizeVietnameseExamText(para.runs.map((r) => r.text).join(''));

    // Nhận diện mục HẾT / BẢNG ĐÁP ÁN / ĐÁP ÁN & HƯỚNG DẪN CHẤM / LỜI GIẢI CHI TIẾT ở cuối đề thi
    const isEndMarkerLine = /^(?:[-–—_*=~•\s]{2,}\s*)?HẾT(?:\s*[-–—_*=~•.!]*|\s*\(.*\))?$/i.test(text);
    const isTrailingAnswerHeading =
      /^(?:[*#•+\-–—\s])*(?:BẢNG\s+ĐÁP\s+ÁN|ĐÁP\s+ÁN(?:\s*[-–—&/]\s*|\s+VÀ\s+|\s+)(?:HƯỚNG\s+DẪN(?:\s+CHẤM|\s+GIẢI)?|THANG\s+ĐIỂM|BIỂU\s+ĐIỂM|CHI\s+TIẾT|THAM\s+KHẢO|ĐỀ\s+THI|CHÍNH\s+THỨC)|HƯỚNG\s+DẪN\s+CHẤM(?:\s*[-–—&/]\s*|\s+VÀ\s+|\s+)?(?:ĐÁP\s+ÁN|THANG\s+ĐIỂM|BIỂU\s+ĐIỂM|CHI\s+TIẾT|TỰ\s+LUẬN|TRẮC\s+NGHIỆM)?|HƯỚNG\s+DẪN\s+GIẢI(?:\s+CHI\s+TIẾT)?|LỜI\s+GIẢI\s+CHI\s+TIẾT|THANG\s+ĐIỂM\s+VÀ\s+ĐÁP\s+ÁN|BIỂU\s+ĐIỂM\s+CHẤM|ĐÁP\s+ÁN\s*[:.]?\s*$)/i.test(
        text
      );

    if ((questions.length >= 1 || currentQuestion) && (isEndMarkerLine || isTrailingAnswerHeading)) {
      pushCurrentQuestion();
      inTrailingAnswerKeySection = true;
      continue;
    }

    if (inTrailingAnswerKeySection) {
      if (!isEndMarkerLine && !isTrailingAnswerHeading) {
        parseTrailingAnswerTextLine(text);
      }
      continue;
    }

    // 1. Nhận diện linh hoạt tiêu đề chuyển PHẦN I, PHẦN II, PHẦN III, PHẦN IV (Tự luận)
    // ƯU TIÊN SỐ 1 TUYỆT ĐỐI: Bất kể ghi Phần III hay Phần IV (hoặc Phần II, Phần 2, Phần 3, Phần 4, B. Tự luận...),
    // MIỄN CÓ CHỮ "TỰ LUẬN" LÀ HỆ THỐNG XÁC ĐỊNH NGAY LÀ PHẦN TỰ LUẬN (PART_4)!
    if (isEssaySectionHeader(text)) {
      pushCurrentQuestion();
      pendingStemParagraphs = para.images.length > 0 ? [{ ...para, fullText: '', runs: [] }] : [];
      inIgnoredEssaySection = false;
      currentPart = 'PART_4';
      continue;
    }

    const strippedHeaderPrefix = text.replace(/^[*#•\-–—\s]+/, '');
    if (
      (!/\b(?:tự\s*luận|tu\s*luan)\b/i.test(strippedHeaderPrefix) &&
        /^(?:(?:[IVX]+|\d+)\s*[.:\-–—)]\s*)?PHẦN\s+(I|1)\b/i.test(strippedHeaderPrefix) &&
        !/PHẦN\s+(IV|III|II)/i.test(strippedHeaderPrefix)) ||
      /^(?:PHẦN\s*(?:I|1)\s*[.:\-–—)]*\s*)?(?:Câu\s+)?trắc\s+nghiệm\s+nhiều\s+phương\s+án\s+lựa\s+chọn/i.test(
        strippedHeaderPrefix
      )
    ) {
      pushCurrentQuestion();
      pendingStemParagraphs = para.images.length > 0 ? [{ ...para, fullText: '', runs: [] }] : [];
      inIgnoredEssaySection = false;
      currentPart = 'PART_1';
      continue;
    }
    if (
      (!/\b(?:tự\s*luận|tu\s*luan)\b/i.test(strippedHeaderPrefix) &&
        /^(?:(?:[IVX]+|\d+)\s*[.:\-–—)]\s*)?PHẦN\s+(II|2)\b/i.test(strippedHeaderPrefix) &&
        !/PHẦN\s+(IV|III)/i.test(strippedHeaderPrefix)) ||
      /^(?:PHẦN\s*(?:II|2)\s*[.:\-–—)]*\s*)?(?:Câu\s+)?trắc\s+nghiệm\s+đúng\s*[\/\-–—\s]*sai/i.test(
        strippedHeaderPrefix
      )
    ) {
      pushCurrentQuestion();
      pendingStemParagraphs = para.images.length > 0 ? [{ ...para, fullText: '', runs: [] }] : [];
      inIgnoredEssaySection = false;
      currentPart = 'PART_2';
      continue;
    }
    if (
      (!/\b(?:tự\s*luận|tu\s*luan)\b/i.test(strippedHeaderPrefix) &&
        /^(?:(?:[IVX]+|\d+)\s*[.:\-–—)]\s*)?PHẦN\s+(III|3)\b/i.test(strippedHeaderPrefix)) ||
      /^(?:PHẦN\s*(?:III|3)\s*[.:\-–—)]*\s*)?(?:Câu\s+)?trắc\s+nghiệm\s+trả\s+lời\s+ngắn/i.test(
        strippedHeaderPrefix
      )
    ) {
      pushCurrentQuestion();
      pendingStemParagraphs = para.images.length > 0 ? [{ ...para, fullText: '', runs: [] }] : [];
      inIgnoredEssaySection = false;
      currentPart = 'PART_3';
      continue;
    }

    if (inIgnoredEssaySection) {
      continue;
    }

    if (isAdministrativeExamHeader(text)) {
      if (para.images.length > 0) {
        if (currentQuestion && !inQuestionSolutionBlock) {
          currentQuestion.hasImage = true;
          currentQuestion.images = [...(currentQuestion.images || []), ...para.images];
        } else if (!currentQuestion) {
          pendingStemParagraphs.push({ ...para, fullText: '', runs: [] });
        }
      }
      continue;
    }

    // 2. Nhận diện bắt đầu một câu hỏi mới:
    const explicitQMatch = text.match(
      /^(?:[*#•+\-–—\s]|\[(?:NB|TH|VD|VDC|[^\]]{1,12})\]|\((?:NB|TH|VD|VDC|[^)]{1,12})\))*(?:Câu(?:\s+hỏi|\s+số)?|Bài(?:\s+tập)?|Question|Cau)\s*(\d+|[IVX]+)\s*[.:\-–—)]*\s*(?:\([^)]{1,30}\)|\[[^\]]{1,30}\])?\s*[.:\-–—)]*\s*(.*)$/i
    );

    const currentHasCompleteOptions =
      (currentPart === 'PART_1' && (currentQuestion?.options?.length || 0) >= 4) ||
      (currentPart === 'PART_2' && (currentQuestion?.subItems?.length || 0) >= 4);

    // Hỗ trợ câu đánh số "1. ...", "2. ...", "1) ..." không có chữ "Câu" (Chỉ kích hoạt khi chưa có câu hỏi đang mở hoặc câu hỏi trước đã đủ 4 phương án)
    const numberedNoPrefixMatch =
      !explicitQMatch &&
      (!currentQuestion || currentHasCompleteOptions) &&
      !/^\s*[*#]?[A-Da-d]\s*[.:)]/.test(text)
        ? text.match(/^\s*(\d{1,3})\s*[.):]\s+([A-ZÀ-Ỹa-zà-ỹ(“"'\d].*)$/)
        : null;

    const qMatch = explicitQMatch || numberedNoPrefixMatch;

    const isAutoNumberQuestion =
      Boolean(text) &&
      para.isAutoNumbered &&
      !/^\s*[*#]?[A-D]\s*[.:)]/i.test(text) &&
      !/^\s*[*#]?[a-d]\s*[).:]/i.test(text) &&
      !/^(?:Đáp\s*án|Đáp\s*số|ĐS|Lời\s*giải|Hướng\s*dẫn)/i.test(text) &&
      !isAdministrativeExamHeader(text);

    if (qMatch || isAutoNumberQuestion) {
      const pendingImages = pendingStemParagraphs.flatMap((p) => p.images);
      pushCurrentQuestion();
      pendingStemParagraphs = [];
      const stemContent = qMatch ? qMatch[2].trim() : text;
      const mergedParaForNewQ: ParsedParagraph =
        pendingImages.length > 0
          ? { ...para, images: [...pendingImages, ...para.images] }
          : para;
      startNewQuestionFromPara(mergedParaForNewQ, stemContent);

      // Kiểm tra xem ngay trong dòng tiêu đề câu hỏi đã dính chùm sẵn A, B, C, D hoặc a), b), c), d) chưa
      if (currentQuestion && currentPart === 'PART_1') {
        const inlineOrdered = findOrderedFourMarkers(stemContent, ['A', 'B', 'C', 'D'], true);
        if (inlineOrdered) {
          currentQuestion = enforceStrictFourOptionsPart1(currentQuestion, currentQuestionRuns);
        }
      } else if (currentQuestion && currentPart === 'PART_2') {
        const inlineSubOrdered = findOrderedFourMarkers(stemContent, ['a', 'b', 'c', 'd'], true);
        if (inlineSubOrdered) {
          currentQuestion = enforceStrictFourSubItemsPart2(currentQuestion, currentQuestionRuns);
        }
      }
      continue;
    }

    // Kiểm tra dòng Lời giải / Hướng dẫn giải / Hướng dẫn chấm / Đáp án TRƯỚC khi tách phương án để tuyệt đối không đưa lời giải vào đề thi
    const expMatch = text.match(
      /^(?:[*#•+\-–—\s])*(?:Lời\s*giải(?:\s*chi\s*tiết)?|Hướng\s*dẫn(?:\s*giải|\s*chấm)?|Giải\s*chi\s*tiết|HDG|HDC|Đáp\s*án(?:\s*tự\s*luận|\s*chi\s*tiết|\s*đúng)?|Thang\s*điểm|Biểu\s*điểm)(?:\s*[:=.\-–—]\s*(.*))?$/i
    );
    if (expMatch && currentQuestion) {
      const expBody = (expMatch[1] || '').trim();
      if (currentQuestion.part === 'PART_3' && expBody && /^[-\d.,]+$/.test(expBody)) {
        currentQuestion.shortAnswer = expBody;
        currentQuestion.shortAnswerDetectedBy = 'KEYWORD';
      } else if (currentQuestion.part === 'PART_1' && /^[A-D]$/i.test(expBody) && currentQuestion.options) {
        const target = expBody.toUpperCase() as 'A' | 'B' | 'C' | 'D';
        currentQuestion.options = currentQuestion.options.map((o) => ({
          ...o,
          isCorrect: o.originalLabel === target,
          isUnderline: o.originalLabel === target,
          isRed: o.originalLabel === target,
        }));
      }
      inQuestionSolutionBlock = true;
      if (expBody) {
        currentQuestion.explanation = currentQuestion.explanation
          ? `${currentQuestion.explanation}\n${expBody}`
          : expBody;
        if (currentQuestion.part === 'PART_4') {
          currentQuestion.essayAnswer = currentQuestion.essayAnswer
            ? `${currentQuestion.essayAnswer}\n${expBody}`
            : expBody;
        }
      }
      continue;
    }

    // Nếu đang nằm trong khối Lời giải / Hướng dẫn chấm của câu hỏi hiện tại (nhiều dòng liên tiếp trước khi sang Câu mới)
    // thì tuyệt đối KHÔNG mở câu hỏi giả mới và KHÔNG cộng vào stemText của đề thi!
    if (inQuestionSolutionBlock && currentQuestion) {
      currentQuestion.explanation = currentQuestion.explanation
        ? `${currentQuestion.explanation}\n${text}`
        : text;
      if (currentQuestion.part === 'PART_4') {
        currentQuestion.essayAnswer = currentQuestion.essayAnswer
          ? `${currentQuestion.essayAnswer}\n${text}`
          : text;
      }
      if (currentQuestion.part === 'PART_1' && currentQuestion.options) {
        const chooseMatch = text.match(/(?:Chọn(?:\s+đáp\s+án)?|Đáp\s+án(?:\s+đúng)?(?:\s+là)?)\s*[:=]?\s*([A-D])\b/i);
        if (chooseMatch && !currentQuestion.options.some((o) => o.isCorrect)) {
          const target = chooseMatch[1].toUpperCase() as 'A' | 'B' | 'C' | 'D';
          currentQuestion.options = currentQuestion.options.map((o) => ({
            ...o,
            isCorrect: o.originalLabel === target,
            isUnderline: o.originalLabel === target,
            isRed: o.originalLabel === target,
          }));
        }
      }
      continue;
    }

    // XỬ LÝ ĐẶC BIỆT ĐOẠN VĂN CHỈ CHỨA HÌNH ẢNH (hoặc Hình ảnh kèm chú thích ngắn "Hình 1", "Hình bên"):
    // Nếu đang có câu hỏi hiện tại (kể cả khi câu hỏi đã đủ 4 phương án A, B, C, D nhưng ảnh đặt ở dưới 4 phương án hoặc cột bên phải),
    // gắn trực tiếp hình ảnh vào câu hỏi hiện tại chứ TUYỆT ĐỐI KHÔNG tự mở câu hỏi mới rỗng!
    const isStandaloneOrCaptionImagePara =
      para.images.length > 0 &&
      (!text ||
        /^(?:Hình|Sơ\s+đồ|Đồ\s+thị|Bảng)\s*(?:vẽ|bên|minh\s+họa|\d+[.\d]*|[a-z])?\s*[.:)]?\s*$/i.test(
          text
        ));

    if (isStandaloneOrCaptionImagePara) {
      if (currentQuestion) {
        currentQuestion.hasImage = true;
        currentQuestion.images = [...(currentQuestion.images || []), ...para.images];
        if (text && !currentHasCompleteOptions) {
          currentQuestion.stemText += (currentQuestion.stemText ? ' ' : '') + text;
        }
      } else {
        pendingStemParagraphs.push(para);
        if (pendingStemParagraphs.length > 5) {
          pendingStemParagraphs.shift();
        }
      }
      continue;
    }

    // Kiểm tra xem đoạn văn hiện tại có chứa phương án A, B, C, D hoặc ý a), b), c), d) theo đúng thứ tự không
    const optExtraction =
      currentPart === 'PART_1'
        ? extractSequentialOptionsFromLine(text)
        : { leadingStem: '', items: [] };
    const subExtraction =
      currentPart === 'PART_2' || (currentPart === 'PART_1' && optExtraction.items.length === 0)
        ? extractSequentialSubItemsFromLine(text)
        : { leadingStem: '', items: [] };

    // Nếu câu hỏi hiện tại đã đủ 4 phương án A,B,C,D (hoặc 4 ý a,b,c,d) mà gặp đoạn văn có chữ mới không phải là phương án hay lời giải -> tự động mở câu hỏi mới!
    if (
      currentQuestion &&
      currentHasCompleteOptions &&
      Boolean(text) &&
      !inQuestionSolutionBlock &&
      optExtraction.items.length === 0 &&
      subExtraction.items.length === 0 &&
      !/^(?:Đáp\s*án|Đáp\s*số|ĐS|Lời\s*giải|Hướng\s*dẫn|HDG|HDC|Giải\b|Chọn\s+[A-D]\b)/i.test(text) &&
      !isAdministrativeExamHeader(text)
    ) {
      pushCurrentQuestion();
      startNewQuestionFromPara(para, text);
      continue;
    }

    // Nếu chưa có currentQuestion (ví dụ file Word bị mất chữ "Câu 1" do macro/field)
    if (!currentQuestion) {
      if (optExtraction.items.length > 0 || subExtraction.items.length > 0) {
        if (pendingStemParagraphs.length > 0) {
          const firstPending = pendingStemParagraphs[0];
          const combinedPendingText = pendingStemParagraphs
            .map((p) => p.fullText)
            .filter(Boolean)
            .join(' ');
          const combinedPendingRuns = pendingStemParagraphs.flatMap((p) => [
            ...p.runs,
            { text: ' ', isUnderline: false, isRed: false, isBold: false, hasFormula: false },
          ]);
          const combinedPendingImages = pendingStemParagraphs.flatMap((p) => p.images);
          startNewQuestionFromPara(
            {
              ...firstPending,
              fullText: combinedPendingText,
              runs: combinedPendingRuns,
              images: combinedPendingImages,
            },
            combinedPendingText
          );
          pendingStemParagraphs = [];
        } else {
          startNewQuestionFromPara(para, '');
        }
      } else {
        if (!isAdministrativeExamHeader(text)) {
          pendingStemParagraphs.push(para);
          if (pendingStemParagraphs.length > 5) {
            pendingStemParagraphs.shift();
          }
        }
        continue;
      }
    }

    if (!currentQuestion) continue;

    currentQuestionRuns.push({
      text: ' ',
      isUnderline: false,
      isRed: false,
      isBold: false,
      hasFormula: false,
    });
    currentQuestionRuns.push(...para.runs);

    if (para.images.length > 0) {
      currentQuestion.hasImage = true;
      currentQuestion.images = [...(currentQuestion.images || []), ...para.images];
    }

    if (!text) continue;

    // 3. Xử lý nội dung bên trong câu hỏi tùy theo từng Phần
    if (currentQuestion.part === 'PART_1') {
      if (optExtraction.items.length > 0) {
        if (optExtraction.leadingStem) {
          currentQuestion.stemText +=
            (currentQuestion.stemText ? ' ' : '') + optExtraction.leadingStem;
        }
        for (const item of optExtraction.items) {
          const label = item.label as 'A' | 'B' | 'C' | 'D';
          const hl = checkRangeHighlight(
            para.runs,
            rawJoined,
            item.text,
            item.markerStart,
            item.fullSegment
          );
          const isCorrect = item.isStarred || hl.isUnderline || hl.isRed;

          currentQuestion.options = currentQuestion.options || [];
          currentQuestion.options.push({
            id: `${currentQuestion.id}-opt-${label}-${currentQuestion.options.length}`,
            originalLabel: label,
            currentLabel: label,
            text: item.text,
            isUnderline: hl.isUnderline || item.isStarred,
            isRed: hl.isRed || item.isStarred,
            isCorrect,
          });
        }
      } else if (subExtraction.items.length > 0 && (!currentQuestion.options || currentQuestion.options.length === 0)) {
        // Câu hỏi Đúng/Sai (a, b, c, d) nhưng trong đề không có dòng tiêu đề "PHẦN II"
        currentQuestion.part = 'PART_2';
        currentQuestion.options = undefined;
        currentQuestion.subItems = [];
        if (subExtraction.leadingStem) {
          currentQuestion.stemText +=
            (currentQuestion.stemText ? ' ' : '') + subExtraction.leadingStem;
        }
        for (const item of subExtraction.items) {
          const label = item.label as 'a' | 'b' | 'c' | 'd';
          const hl = checkRangeHighlight(
            para.runs,
            rawJoined,
            item.text,
            item.markerStart,
            item.fullSegment
          );
          const isTrue = item.isStarred || hl.isUnderline || hl.isRed;
          currentQuestion.subItems.push({
            id: `${currentQuestion.id}-sub-${label}-${currentQuestion.subItems.length}`,
            originalLabel: label,
            currentLabel: label,
            text: item.text,
            isUnderline: hl.isUnderline || item.isStarred,
            isRed: hl.isRed || item.isStarred,
            isTrue,
          });
        }
      } else {
        currentQuestion.stemText += (currentQuestion.stemText ? ' ' : '') + text;
      }
    } else if (currentQuestion.part === 'PART_2') {
      const p2Extraction = extractSequentialSubItemsFromLine(text);
      if (p2Extraction.items.length > 0) {
        if (p2Extraction.leadingStem) {
          currentQuestion.stemText +=
            (currentQuestion.stemText ? ' ' : '') + p2Extraction.leadingStem;
        }
        for (const item of p2Extraction.items) {
          const label = item.label as 'a' | 'b' | 'c' | 'd';
          const hl = checkRangeHighlight(
            para.runs,
            rawJoined,
            item.text,
            item.markerStart,
            item.fullSegment
          );
          const isTrue = item.isStarred || hl.isUnderline || hl.isRed;

          currentQuestion.subItems = currentQuestion.subItems || [];
          currentQuestion.subItems.push({
            id: `${currentQuestion.id}-sub-${label}-${currentQuestion.subItems.length}`,
            originalLabel: label,
            currentLabel: label,
            text: item.text,
            isUnderline: hl.isUnderline || item.isStarred,
            isRed: hl.isRed || item.isStarred,
            isTrue,
          });
        }
      } else {
        currentQuestion.stemText += (currentQuestion.stemText ? ' ' : '') + text;
      }
    } else if (currentQuestion.part === 'PART_3') {
      const ansKeyword = text.match(/(?:Đáp\s*án|Đáp\s*số|ĐS|Kết\s*quả)\s*[:=]\s*([-\d.,]+)/i);
      if (ansKeyword) {
        currentQuestion.shortAnswer = ansKeyword[1].trim();
        currentQuestion.shortAnswerDetectedBy = 'KEYWORD';
      } else if (/^[*#]?\s*-?\d+(?:[.,]\d+)?\s*$/.test(text) && !currentQuestion.shortAnswer) {
        const numMatch = text.match(/-?\d+(?:[.,]\d+)?/);
        if (numMatch) {
          currentQuestion.shortAnswer = numMatch[0];
          currentQuestion.shortAnswerDetectedBy = 'UNDERLINE_RED';
        }
      } else if ((para.hasUnderline || para.hasRed) && !currentQuestion.shortAnswer) {
        const highlightedOnly = para.runs
          .filter((r) => r.isUnderline || r.isRed)
          .map((r) => r.text)
          .join('')
          .trim();
        if (/^[*#]?\s*-?\d+(?:[.,]\d+)?\s*$/.test(highlightedOnly)) {
          const numMatch = highlightedOnly.match(/-?\d+(?:[.,]\d+)?/);
          if (numMatch) {
            currentQuestion.shortAnswer = numMatch[0];
            currentQuestion.shortAnswerDetectedBy = 'UNDERLINE_RED';
          }
        } else {
          currentQuestion.stemText += (currentQuestion.stemText ? ' ' : '') + text;
        }
      } else {
        currentQuestion.stemText += (currentQuestion.stemText ? ' ' : '') + text;
      }
    } else if (currentQuestion.part === 'PART_4') {
      const essayAnsLine = text.match(
        /^(?:[*#•+\-–—\s])*(?:Đáp\s*án|Đáp\s*số|ĐS|Kết\s*quả|Lời\s*giải|Hướng\s*dẫn(?:\s*chấm|\s*giải)?|HDC|HDG|Giải|Thang\s*điểm|Biểu\s*điểm)(?:\s*[:=.\-–—]\s*(.*))?$/i
      );
      if (essayAnsLine) {
        inQuestionSolutionBlock = true;
        const ansBody = (essayAnsLine[1] || '').trim();
        if (ansBody) {
          currentQuestion.essayAnswer = currentQuestion.essayAnswer
            ? `${currentQuestion.essayAnswer}\n${ansBody}`.trim()
            : ansBody;
          currentQuestion.explanation = currentQuestion.essayAnswer;
        }
      } else if (inQuestionSolutionBlock || (currentQuestion.essayAnswer !== undefined && currentQuestion.essayAnswer.length > 0)) {
        inQuestionSolutionBlock = true;
        currentQuestion.essayAnswer = currentQuestion.essayAnswer
          ? `${currentQuestion.essayAnswer}\n${text}`
          : text;
        currentQuestion.explanation = currentQuestion.essayAnswer;
      } else {
        currentQuestion.stemText += (currentQuestion.stemText ? '\n' : '') + text;
      }
    }
  }

  pushCurrentQuestion();

  // Nếu tệp có BẢNG ĐÁP ÁN ở cuối đề (1.A 2.B 3.C...), áp dụng đáp án chuẩn của giáo viên cho các câu Phần I
  if (trailingAnswerKeyPart1.size > 0) {
    let p1Idx = 0;
    for (const q of questions) {
      if (q.part === 'PART_1' && q.options && q.options.length === 4) {
        p1Idx++;
        const mappedAns = trailingAnswerKeyPart1.get(p1Idx) || trailingAnswerKeyPart1.get(q.originalIndex);
        if (mappedAns && !q.options.some((o) => o.isCorrect)) {
          q.options = q.options.map((o) => ({
            ...o,
            isCorrect: o.originalLabel === mappedAns,
            isUnderline: o.originalLabel === mappedAns,
            isRed: o.originalLabel === mappedAns,
          }));
        }
      }
    }
  }

  // Nếu tệp có BẢNG ĐÁP ÁN PHẦN II (Đúng/Sai) ở cuối đề, áp dụng đáp án chuẩn của giáo viên cho các câu Phần II
  if (trailingAnswerKeyPart2.size > 0) {
    let p2Idx = 0;
    for (const q of questions) {
      if (q.part === 'PART_2' && q.subItems && q.subItems.length === 4) {
        p2Idx++;
        const mappedBools = trailingAnswerKeyPart2.get(p2Idx) || trailingAnswerKeyPart2.get(q.originalIndex);
        if (mappedBools && mappedBools.length === 4) {
          q.subItems = q.subItems.map((s, idx) => ({
            ...s,
            isTrue: mappedBools[idx],
            isUnderline: mappedBools[idx],
            isRed: mappedBools[idx],
          }));
        }
      }
    }
  }

  // Nếu tệp có BẢNG ĐÁP ÁN PHẦN III (Trả lời ngắn) ở cuối đề, áp dụng đáp số chuẩn của giáo viên cho các câu Phần III
  if (trailingAnswerKeyPart3.size > 0) {
    let p3Idx = 0;
    for (const q of questions) {
      if (q.part === 'PART_3') {
        p3Idx++;
        const mappedShortAns = trailingAnswerKeyPart3.get(p3Idx) || trailingAnswerKeyPart3.get(q.originalIndex);
        if (mappedShortAns && !q.shortAnswer?.trim()) {
          q.shortAnswer = mappedShortAns.trim();
          q.shortAnswerDetectedBy = 'KEYWORD';
        }
      }
    }
  }

  // Nếu tệp có HƯỚNG DẪN CHẤM TỰ LUẬN ở cuối đề, tự động gán vào essayAnswer của các câu Phần IV (chỉ dùng cho Bảng đáp án chung)
  if (trailingAnswerKeyPart4.size > 0) {
    let p4Idx = 0;
    for (const q of questions) {
      if (q.part === 'PART_4') {
        p4Idx++;
        const mappedEssayAns = trailingAnswerKeyPart4.get(p4Idx);
        if (mappedEssayAns && !q.essayAnswer?.trim()) {
          q.essayAnswer = mappedEssayAns.trim();
          q.explanation = mappedEssayAns.trim();
        }
      }
    }
  }

  // Cơ chế dự phòng cuối cùng (Zero-Failure Fallback):
  // Nếu tệp Word có nội dung đoạn văn nhưng hoàn toàn không theo chuẩn Câu 1 / A. B. C. D. thông thường,
  // tự động gom các đoạn văn có nội dung thành câu hỏi để giáo viên vẫn xem và chỉnh sửa được trên giao diện!
  if (questions.length === 0 && paragraphs.length > 0) {
    const meaningfulParas = paragraphs.filter(
      (p) =>
        (p.fullText.trim().length > 2 || p.images.length > 0) &&
        !isAdministrativeExamHeader(p.fullText)
    );
    if (meaningfulParas.length > 0) {
      let idx = 1;
      for (let i = 0; i < meaningfulParas.length; i++) {
        const p = meaningfulParas[i];
        const fallbackQ: ExamQuestion = {
          id: `q-fallback-${idx}-${Date.now()}`,
          part: 'PART_1',
          originalIndex: idx,
          displayIndex: idx,
          stemText: p.fullText.trim() || `Câu hỏi hình ảnh ${idx}`,
          hasFormula: p.hasFormula,
          hasImage: p.images.length > 0,
          images: p.images.length > 0 ? p.images : undefined,
          options: [],
        };
        questions.push(enforceStrictFourOptionsPart1(fallbackQ, p.runs));
        idx++;
      }
    }
  }

  return recalculateQuestionNumbering(questions, resetPerPart);
}

/**
 * Phân tích văn bản thô (từ khung Soạn thảo trực tiếp như Word hoặc dán từ Clipboard)
 * Tự động tách câu hỏi dính chùm và ép chuẩn 4 đáp án cho Phần I & Phần II
 */
export function parseRawTextToExamQuestions(
  rawText: string,
  resetPerPart = true
): ExamQuestion[] {
  const normalizedRaw = normalizeVietnameseExamText(rawText);
  const lines = normalizedRaw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const rawParas: ParsedParagraph[] = [];
  for (const line of lines) {
    const p: ParsedParagraph = {
      fullText: line,
      runs: [
        {
          text: line,
          isUnderline: false,
          isRed: false,
          isBold: false,
          hasFormula: /[√∫∑πΔαβλθ±×÷≤≥≠∈∉→∞]/.test(line),
        },
      ],
      hasUnderline: false,
      hasRed: false,
      hasFormula: /[√∫∑πΔαβλθ±×÷≤≥≠∈∉→∞]/.test(line),
      isAutoNumbered: false,
      images: [],
    };
    rawParas.push(...splitClumpedParagraphIntoLogicalParagraphs(p));
  }

  return buildQuestionsFromParsedParagraphs(rawParas, resetPerPart);
}

/**
 * Phân tích dữ liệu HTML khi giáo viên Copy & Paste trực tiếp từ Microsoft Word vào trình duyệt (hoặc từ Mammoth HTML):
 * - Nhận diện chính xác cả thẻ <u>, <ins>, style="text-decoration: underline", "text-underline: single"
 * - Nhận diện chính xác cả màu chữ đỏ (color: red, #ff0000, rgb(255,0,0)...)
 * - Bắt trọn các trường hợp chỉ gạch chân chữ cái <u>a</u>), hoặc <u>a)</u>, hoặc <u>a) </u> ở Phần II và Phần I
 * - Bóc tách đầy đủ các thẻ <img src="data:image/..."> nhúng trong HTML
 */
export function parseClipboardHtmlToExamQuestions(
  htmlString: string,
  fallbackPlainText: string,
  resetPerPart = true
): ExamQuestion[] {
  if (!htmlString || !htmlString.trim()) {
    return parseRawTextToExamQuestions(fallbackPlainText, resetPerPart);
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const rawParas: ParsedParagraph[] = [];

    const isElementUnderlined = (el: Element | null): boolean => {
      let curr: Element | null = el;
      while (curr && curr.tagName !== 'BODY' && curr.tagName !== 'HTML') {
        const tag = curr.tagName.toUpperCase();
        if (tag === 'U' || tag === 'INS') return true;
        const styleAttr = (curr.getAttribute('style') || '').toLowerCase();
        if (
          /text-decoration(?:-line)?\s*:\s*[^;]*underline/.test(styleAttr) ||
          /text-underline\s*:\s*(?!none)[a-z]+/.test(styleAttr)
        ) {
          return true;
        }
        curr = curr.parentElement;
      }
      return false;
    };

    const isElementRed = (el: Element | null): boolean => {
      let curr: Element | null = el;
      while (curr && curr.tagName !== 'BODY' && curr.tagName !== 'HTML') {
        const colorAttr = (curr.getAttribute('color') || '').replace('#', '').toUpperCase().trim();
        if (colorAttr && (RED_COLOR_HEXES.has(colorAttr) || colorAttr === 'RED')) {
          return true;
        }
        const styleAttr = (curr.getAttribute('style') || '').toLowerCase();
        const colorMatch = styleAttr.match(/(?:^|;|\s)color\s*:\s*([^;]+)/);
        if (colorMatch) {
          const val = colorMatch[1].trim();
          if (
            val === 'red' ||
            val === 'crimson' ||
            val === 'darkred' ||
            val === 'firebrick' ||
            /^#(?:ff0000|f00|c00000|e00000|d00000|dc2626|ef4444|b91c1c)/i.test(val) ||
            /^rgb\(\s*(?:1[89]\d|2[0-5]\d)\s*,\s*(?:[0-5]?\d)\s*,\s*(?:[0-5]?\d)\s*\)/i.test(val)
          ) {
            return true;
          }
        }
        curr = curr.parentElement;
      }
      return false;
    };

    const blockNodes = doc.body.querySelectorAll('p, li, div, tr, h1, h2, h3, h4');
    const containers = blockNodes.length > 0 ? Array.from(blockNodes) : [doc.body];
    let imgCounter = 1;

    for (const block of containers) {
      if (
        (block.tagName === 'DIV' || block.tagName === 'TR') &&
        block.querySelector('p, li')
      ) {
        continue;
      }

      const runs: ParsedRun[] = [];
      const blockImages: ExamImageAttachment[] = [];

      const imgElements = block.querySelectorAll('img');
      for (let i = 0; i < imgElements.length; i++) {
        const imgEl = imgElements[i];
        const src = (imgEl.getAttribute('src') || '').trim();
        if (src && (src.startsWith('data:image/') || src.startsWith('blob:') || src.startsWith('http'))) {
          const wAttr = parseInt(imgEl.getAttribute('width') || '0', 10);
          const hAttr = parseInt(imgEl.getAttribute('height') || '0', 10);
          const widthTwips = wAttr > 20 ? Math.min(4800, wAttr * 15) : 2600;
          const heightTwips = hAttr > 20 ? Math.min(3600, hAttr * 15) : 1700;
          blockImages.push({
            id: `img-html-${imgCounter}-${Date.now()}`,
            fileName: `clipboard_image_${imgCounter}.png`,
            dataUrl: src,
            widthTwips,
            heightTwips,
            aspectRatio: Number((widthTwips / Math.max(1, heightTwips)).toFixed(4)),
            dpi: 300,
          });
          imgCounter++;
        }
      }

      const walkTextNodes = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const txt = normalizeVietnameseExamText(node.textContent || '');
          if (txt) {
            const parentEl = node.parentElement;
            let vertAlign: 'subscript' | 'superscript' | undefined;
            let currTag: Element | null = parentEl;
            while (currTag && currTag.tagName !== 'BODY') {
              const tName = currTag.tagName.toUpperCase();
              if (tName === 'SUB') {
                vertAlign = 'subscript';
                break;
              }
              if (tName === 'SUP') {
                vertAlign = 'superscript';
                break;
              }
              currTag = currTag.parentElement;
            }
            const formattedTxt =
              vertAlign === 'subscript' && txt.trim()
                ? `_{${txt.trim()}}`
                : vertAlign === 'superscript' && txt.trim()
                ? `^{${txt.trim()}}`
                : txt;
            runs.push({
              text: formattedTxt,
              isUnderline: isElementUnderlined(parentEl),
              isRed: isElementRed(parentEl),
              isBold: false,
              vertAlign,
              hasFormula: Boolean(vertAlign) || /[√∫∑πΔαβλθ±×÷≤≥≠∈∉→⇌∞]/.test(txt),
            });
          }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as Element;
          if (el.tagName === 'BR') {
            runs.push({
              text: '\n',
              isUnderline: false,
              isRed: false,
              isBold: false,
              hasFormula: false,
            });
          } else {
            for (let i = 0; i < el.childNodes.length; i++) {
              walkTextNodes(el.childNodes[i]);
            }
          }
        }
      };

      walkTextNodes(block);
      const markedRuns = injectFormattingMarkersIntoRuns(runs);
      const fullText = normalizeVietnameseExamText(markedRuns.map((r) => r.text).join('')).trim();
      if (!fullText && blockImages.length === 0) continue;

      const p: ParsedParagraph = {
        fullText,
        runs: markedRuns,
        hasUnderline: markedRuns.some((r) => r.isUnderline && r.text.trim().length > 0),
        hasRed: markedRuns.some((r) => r.isRed && r.text.trim().length > 0),
        hasFormula: markedRuns.some((r) => r.hasFormula),
        isAutoNumbered: block.tagName === 'LI',
        images: blockImages,
      };
      rawParas.push(...splitClumpedParagraphIntoLogicalParagraphs(p));
    }

    if (rawParas.length > 0) {
      return buildQuestionsFromParsedParagraphs(mergeStandaloneTableHeadersAndOptions(rawParas), resetPerPart);
    }
  } catch {
    // Fallback sang plain text nếu HTML không hợp lệ
  }

  return parseRawTextToExamQuestions(fallbackPlainText, resetPerPart);
}

export function serializeQuestionsToWordRawText(questions: ExamQuestion[]): string {
  const p1 = questions.filter((q) => q.part === 'PART_1');
  const p2 = questions.filter((q) => q.part === 'PART_2');
  const p3 = questions.filter((q) => q.part === 'PART_3');
  const p4 = questions.filter((q) => q.part === 'PART_4');

  const sections: string[] = [];

  if (p1.length > 0) {
    sections.push('PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn.');
    for (const q of p1) {
      const optsLine = (q.options || [])
        .map((o) => `${o.isCorrect ? '*' : ''}${o.currentLabel}. ${o.text}`)
        .join('\n');
      sections.push(`Câu ${q.displayIndex}. ${q.stemText}\n${optsLine}`);
    }
  }

  if (p2.length > 0) {
    sections.push('\nPHẦN II. Câu trắc nghiệm đúng sai.');
    for (const q of p2) {
      const subsLine = (q.subItems || [])
        .map((s) => `${s.isTrue ? '*' : ''}${s.currentLabel}) ${s.text} (${s.isTrue ? 'Đ' : 'S'})`)
        .join('\n');
      sections.push(`Câu ${q.displayIndex}. ${q.stemText}\n${subsLine}`);
    }
  }

  if (p3.length > 0) {
    sections.push('\nPHẦN III. Câu trắc nghiệm trả lời ngắn.');
    for (const q of p3) {
      sections.push(
        `Câu ${q.displayIndex}. ${q.stemText}\nĐáp án: ${q.shortAnswer || ''}`
      );
    }
  }

  if (p4.length > 0) {
    const essayRoman =
      p3.length === 0 && p2.length === 0
        ? 'PHẦN II'
        : p3.length === 0
        ? 'PHẦN III'
        : 'PHẦN IV';
    sections.push(`\n${essayRoman}. Tự luận.`);
    for (const q of p4) {
      const ansText = (q.essayAnswer || q.explanation || '').trim();
      sections.push(
        ansText
          ? `Câu ${q.displayIndex}. ${q.stemText}\nĐáp án: ${ansText}`
          : `Câu ${q.displayIndex}. ${q.stemText}`
      );
    }
  }

  return sections.join('\n\n');
}

/**
 * Trích xuất văn bản tiếng Việt từ tệp nhị phân Word 97-2003 (.doc OLE2) hoặc RTF
 */
function extractTextFromLegacyDocBuffer(arrayBuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(arrayBuffer);

  // 1. Kiểm tra định dạng RTF ({\rtf1...)
  const asciiHeader = new TextDecoder('ascii').decode(bytes.slice(0, 64));
  if (asciiHeader.trimStart().startsWith('{\\rtf')) {
    const rawRtf = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    return rawRtf
      .replace(/\\par\b|\\line\b/g, '\n')
      .replace(/\\tab\b/g, '\t')
      .replace(/\\u(-?\d+)\??/g, (_, code) => {
        const num = parseInt(code, 10);
        return String.fromCharCode(num < 0 ? num + 65536 : num);
      })
      .replace(/\\'[0-9a-fA-F]{2}/g, '')
      .replace(/\\[a-zA-Z]+\d*\s?/g, '')
      .replace(/[{}]/g, '');
  }

  // 2. Quét luồng văn bản UTF-16LE (chuẩn lưu trữ tiếng Việt của Word 97-2003 .doc)
  const utf16Chunks: string[] = [];
  let currentChars: number[] = [];

  const isPrintableVnChar = (code: number): boolean => {
    if (code === 0x09 || code === 0x0a || code === 0x0d) return true;
    if (code >= 0x20 && code <= 0x7e) return true;
    if (code >= 0x00c0 && code <= 0x024f) return true;
    if (code >= 0x1e00 && code <= 0x1eff) return true;
    if (code >= 0x2010 && code <= 0x22ff) return true;
    return false;
  };

  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const code = bytes[i] | (bytes[i + 1] << 8);
    if (isPrintableVnChar(code)) {
      currentChars.push(code === 0x0d ? 0x0a : code);
    } else {
      if (currentChars.length >= 16) {
        const chunk = String.fromCharCode(...currentChars);
        if (/(?:Câu|PHẦN|Bài|[A-D]\s*[.:)])/i.test(chunk)) {
          utf16Chunks.push(chunk);
        }
      }
      currentChars = [];
    }
  }
  if (currentChars.length >= 16) {
    const chunk = String.fromCharCode(...currentChars);
    if (/(?:Câu|PHẦN|Bài|[A-D]\s*[.:)])/i.test(chunk)) {
      utf16Chunks.push(chunk);
    }
  }

  if (utf16Chunks.length > 0) {
    return utf16Chunks.join('\n');
  }

  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

/**
 * Phân tích File Word (.docx / .doc / văn bản) theo cấu trúc chuẩn THPT 2025 (Đa tầng chống lỗi 100%):
 * - Tầng 1: OpenXML DOMParser (nhận diện gạch chân <w:u>, tô đỏ <w:color>, auto-numbering, bảng biểu, OMML, hình ảnh)
 * - Tầng 2: Pure-Regex XML Parser (chống lỗi <parsererror> khi tệp Word có namespace lạ từ WPS / PDF2Word)
 * - Tầng 3: Mammoth HTML & RawText Extractor (giữ nguyên thẻ <u> gạch chân và nội dung mọi định dạng .docx)
 * - Tầng 4: Bộ giải mã .doc (Word 97-2003 UTF-16LE), RTF và HTML
 */
export async function parseDocxExamFile(
  file: File,
  resetPerPart = true
): Promise<ExamQuestion[]> {
  const arrayBuffer = await file.arrayBuffer();
  const headerBytes = new Uint8Array(arrayBuffer.slice(0, 4));
  const isZipArchive =
    headerBytes.length >= 4 &&
    headerBytes[0] === 0x50 &&
    headerBytes[1] === 0x4b &&
    headerBytes[2] === 0x03 &&
    headerBytes[3] === 0x04;

  // TẦNG 1 & 2: Đọc cấu trúc OpenXML (.docx) qua JSZip
  try {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const docXmlFile =
      zip.file('word/document.xml') ||
      zip.file(/^word[\\/]document.*\.xml$/i)[0];

    if (docXmlFile) {
      const [mediaMap, numberingCtx, oleEmbeddingsMap, xmlString] = await Promise.all([
        loadMediaRelationships(zip).catch(
          () => new Map<string, { dataUrl: string; fileName: string }>()
        ),
        loadDocxNumberingContext(zip).catch(() => undefined),
        loadOleEmbeddingsMap(zip).catch(() => new Map<string, string>()),
        docXmlFile.async('string'),
      ]);

      const paragraphs = extractParagraphsFromDocxXml(
        xmlString,
        mediaMap,
        numberingCtx,
        oleEmbeddingsMap
      );
      const rawQuestions = buildQuestionsFromParsedParagraphs(paragraphs, resetPerPart);
      const parsedQuestions = normalizeAllQuestionsStrictFourOptions(rawQuestions, resetPerPart);

      const finalizeQuestionsWithEnhancedImages = async (
        qList: ExamQuestion[]
      ): Promise<ExamQuestion[]> => {
        const tagged = assignDeterministicImageTagsToQuestions(qList);
        return Promise.all(
          tagged.map(async (q) => {
            if (!q.images || q.images.length === 0) return q;
            const enhancedImgs = await Promise.all(
              q.images.map(async (img, idx) => {
                const processed = await enhanceAndCropExamImage(
                  img.dataUrl,
                  q.displayIndex,
                  img.fileName
                );
                const suffix = q.images && q.images.length > 1 ? `_${idx + 1}` : '';
                const tagId = `[HINH_ANH_CAU_${q.displayIndex}${suffix}]`;
                // ENGINE 1.1c: Khóa chặt tỉ lệ khung hình gốc (Original Aspect Ratio = processed.aspectRatio)
                // Nếu ảnh bị người dùng kéo dãn méo mó trong Word, tự động reset chiều cao theo đúng tỉ lệ gốc!
                const finalWidthTwips = processed.widthTwips;
                const finalHeightTwips = Math.max(
                  160,
                  Math.round(finalWidthTwips / Math.max(0.1, processed.aspectRatio))
                );
                return {
                  ...img,
                  dataUrl: processed.dataUrl,
                  widthTwips: finalWidthTwips,
                  heightTwips: finalHeightTwips,
                  aspectRatio: processed.aspectRatio,
                  tagId,
                  dpi: 300,
                };
              })
            );
            return {
              ...q,
              hasImage: true,
              images: enhancedImgs,
            };
          })
        );
      };

      if (parsedQuestions.length > 1) {
        return finalizeQuestionsWithEnhancedImages(parsedQuestions);
      }

      const regexParagraphs = extractParagraphsFromDocxXmlRegex(xmlString, mediaMap);
      const regexQuestions = normalizeAllQuestionsStrictFourOptions(
        buildQuestionsFromParsedParagraphs(regexParagraphs, resetPerPart),
        resetPerPart
      );
      if (regexQuestions.length > parsedQuestions.length) {
        return finalizeQuestionsWithEnhancedImages(regexQuestions);
      }
      if (parsedQuestions.length > 0) {
        return finalizeQuestionsWithEnhancedImages(parsedQuestions);
      }
    }
  } catch {
    // Chuyển sang tầng Mammoth / Legacy .doc nếu không phải chuẩn ZIP thông thường
  }

  // TẦNG 3: Sử dụng Mammoth.js (Trích xuất HTML có giữ thẻ <u> gạch chân + ảnh base64 + Raw Text)
  try {
    const [htmlResult, rawTextResult] = await Promise.all([
      mammoth.convertToHtml(
        { arrayBuffer },
        {
          styleMap: ['u => u', 'b => b', 'i => i'],
        }
      ),
      mammoth.extractRawText({ arrayBuffer }),
    ]);

    const htmlStr = htmlResult.value || '';
    const plainStr = rawTextResult.value || '';

    if (htmlStr.trim() || plainStr.trim()) {
      const fromMammoth = parseClipboardHtmlToExamQuestions(
        htmlStr,
        plainStr,
        resetPerPart
      );
      if (fromMammoth.length > 0) {
        return fromMammoth;
      }
    }
  } catch {
    // Chuyển sang tầng 4 nếu Mammoth không đọc được
  }

  // TẦNG 4: Đọc tệp Word 97-2003 (.doc OLE2 UTF-16LE), RTF, HTML hoặc Văn bản thuần (Không áp dụng trên file nén ZIP .docx nhị phân)
  if (!isZipArchive) {
    try {
      const rawText = await file.text();
      if (/<html|<body|<p\b|<div\b|<table\b/i.test(rawText)) {
        const fromHtml = parseClipboardHtmlToExamQuestions(rawText, rawText, resetPerPart);
        if (fromHtml.length > 0) return fromHtml;
      }

      const legacyExtracted = extractTextFromLegacyDocBuffer(arrayBuffer);
      if (legacyExtracted && legacyExtracted.trim().length > 0) {
        const fromLegacy = parseRawTextToExamQuestions(legacyExtracted, resetPerPart);
        if (fromLegacy.length > 0) return fromLegacy;
      }

      if (rawText && rawText.trim().length > 0) {
        const fromPlain = parseRawTextToExamQuestions(rawText, resetPerPart);
        if (fromPlain.length > 0) return fromPlain;
      }
    } catch {
      // Bỏ qua lỗi đọc dự phòng
    }
  }

  throw new Error(
    'Không thể đọc nội dung tệp. Nếu tệp đang ở định dạng Word 97-2003 (.doc) bị mã hóa, vui lòng lưu lại dưới dạng Word (.docx) hoặc Copy & Dán (Ctrl+V) trực tiếp vào khung Trang Word A4.'
  );
}

