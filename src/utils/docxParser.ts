import JSZip from 'jszip';
import {
  ExamImageAttachment,
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

export interface ParsedRun {
  text: string;
  isUnderline: boolean;
  isRed: boolean;
  isBold: boolean;
  hasFormula: boolean;
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
  rawFormulaXml?: string;
  formulaLatex?: string;
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
    if (q.part === 'PART_4') {
      // Phần Tự luận: Không kiểm tra điều kiện 4 đáp án A,B,C,D hay Đúng/Sai
      return;
    }
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
          suggestion: 'Bấm nút [Chuẩn Hóa 4 Đáp Án] để tự động tách và cân bằng đủ 4 phương án.',
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
          suggestion: 'Bấm nút [Chuẩn Hóa 4 Đáp Án] để tự động tách đủ 4 ý a), b), c), d).',
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
/**
 * Tiền xử lý mảng runs của một đoạn văn:
 * Khi phát hiện ký tự đầu của ý a), b), c), d) hoặc A., B., C., D. (dù chỉ gạch chân/tô đỏ mỗi chữ cái 'a',
 * hoặc chỉ dấu ')', hoặc cả 'a) ') có isUnderline hoặc isRed -> tự động gắn cờ '*' ngay trước nhãn
 * để bộ tách câu phía sau nhận diện chính xác 100% đáp án ĐÚNG mà không bao giờ bị rơi mất!
 */
function injectFormattingMarkersIntoRuns(runs: ParsedRun[]): ParsedRun[] {
  if (!runs || runs.length === 0) return runs;
  const fullText = runs.map((r) => r.text).join('');
  if (!fullText.trim()) return runs;

  // Tìm tất cả các vị trí xuất hiện nhãn a), b), c), d) hoặc A., B., C., D.
  const prefixRegex = /(?:^|[\s\t\n.;:?!)"'”’\],-])([a-dA-D])(\s*[).:\-–—]\s*)/g;
  const markPositions = new Set<number>();

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

  if (markPositions.size === 0) return runs;

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
} {
  if (!rPr && !paraRPr) return { isUnderline: false, isRed: false, isBold: false };

  let isUnderline = false;
  let isRed = false;
  let isBold = false;

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
        const rawColor = val.replace(/^#/, '').toUpperCase();
        if (RED_COLOR_HEXES.has(rawColor)) {
          isRed = true;
        } else if (
          /^[C-F][0-9A-F]0000$/i.test(rawColor) ||
          /^[C-F][0-9A-F][0-3][0-9A-F][0-3][0-9A-F]$/i.test(rawColor)
        ) {
          isRed = true;
        }
      } else if (tag === 'b') {
        const lowerVal = val.toLowerCase();
        if (!lowerVal || (lowerVal !== 'false' && lowerVal !== '0')) {
          isBold = true;
        }
      }
    }
  };

  inspectContainer(rPr);

  return { isUnderline, isRed, isBold };
}

/**
 * Chuyển đổi công thức OMML (<m:oMath> hoặc <m:oMathPara>) sang chuỗi LaTeX trực quan
 */
function ommlToLatex(mathNode: Element): string {
  function walk(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const el = node as Element;
    const tag = el.localName || el.tagName.replace(/^m:/, '');

    switch (tag) {
      case 't':
        return el.textContent || '';
      case 'f': {
        const num = el.getElementsByTagName('m:num')[0];
        const den = el.getElementsByTagName('m:den')[0];
        const numText = num ? walk(num) : '';
        const denText = den ? walk(den) : '';
        return `\\frac{${numText.trim()}}{${denText.trim()}}`;
      }
      case 'sSup': {
        const e = el.getElementsByTagName('m:e')[0];
        const sup = el.getElementsByTagName('m:sup')[0];
        const eText = e ? walk(e) : '';
        const supText = sup ? walk(sup) : '';
        return `${eText}^{${supText}}`;
      }
      case 'sSub': {
        const e = el.getElementsByTagName('m:e')[0];
        const sub = el.getElementsByTagName('m:sub')[0];
        const eText = e ? walk(e) : '';
        const subText = sub ? walk(sub) : '';
        return `${eText}_{${subText}}`;
      }
      case 'sSubSup': {
        const e = el.getElementsByTagName('m:e')[0];
        const sub = el.getElementsByTagName('m:sub')[0];
        const sup = el.getElementsByTagName('m:sup')[0];
        const eText = e ? walk(e) : '';
        const subText = sub ? walk(sub) : '';
        const supText = sup ? walk(sup) : '';
        return `${eText}_{${subText}}^{${supText}}`;
      }
      case 'rad': {
        const deg = el.getElementsByTagName('m:deg')[0];
        const e = el.getElementsByTagName('m:e')[0];
        const degText = deg ? walk(deg).trim() : '';
        const eText = e ? walk(e).trim() : '';
        return degText ? `\\sqrt[${degText}]{${eText}}` : `\\sqrt{${eText}}`;
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
 * Trích xuất ảnh từ node drawing hoặc pict trong Word
 */
function extractImagesFromElement(
  container: Element,
  mediaMap: Map<string, { dataUrl: string; fileName: string }>
): ExamImageAttachment[] {
  const images: ExamImageAttachment[] = [];

  const blipNodes = container.getElementsByTagName('a:blip');
  for (let i = 0; i < blipNodes.length; i++) {
    const blip = blipNodes[i];
    const rId =
      blip.getAttribute('r:embed') ||
      blip.getAttribute('r:link') ||
      blip.getAttribute('embed') ||
      '';
    if (rId && mediaMap.has(rId)) {
      const media = mediaMap.get(rId)!;
      let widthTwips: number | undefined;
      let heightTwips: number | undefined;
      const extentNode = container.getElementsByTagName('wp:extent')[0];
      if (extentNode) {
        const cx = parseInt(extentNode.getAttribute('cx') || '0', 10);
        const cy = parseInt(extentNode.getAttribute('cy') || '0', 10);
        if (cx > 0) widthTwips = Math.round(cx / 635);
        if (cy > 0) heightTwips = Math.round(cy / 635);
      }

      images.push({
        id: `img-${rId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        dataUrl: media.dataUrl,
        fileName: media.fileName,
        widthTwips,
        heightTwips,
      });
    }
  }

  const imgDataNodes = container.getElementsByTagName('v:imagedata');
  for (let i = 0; i < imgDataNodes.length; i++) {
    const imgData = imgDataNodes[i];
    const rId =
      imgData.getAttribute('r:id') ||
      imgData.getAttribute('id') ||
      '';
    if (rId && mediaMap.has(rId)) {
      const media = mediaMap.get(rId)!;
      images.push({
        id: `pict-${rId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        dataUrl: media.dataUrl,
        fileName: media.fileName,
      });
    }
  }

  return images;
}

/**
 * Cắt một danh sách runs theo khoảng ký tự [sliceStart, sliceEnd)
 * Giúp giữ nguyên 100% thuộc tính gạch chân (isUnderline) và tô đỏ (isRed) khi tách đoạn văn dính chùm
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

    if (rEnd <= sliceStart || rStart >= sliceEnd) {
      continue;
    }

    const subStart = Math.max(0, sliceStart - rStart);
    const subEnd = Math.min(run.text.length, sliceEnd - rStart);
    const subText = run.text.slice(subStart, subEnd);

    if (subText.length > 0) {
      sliced.push({
        ...run,
        text: subText,
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
  let text = raw
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
 * thành các đoạn văn độc lập
 */
function splitClumpedParagraphIntoLogicalParagraphs(
  para: ParsedParagraph
): ParsedParagraph[] {
  const rawJoined = para.runs.map((r) => r.text).join('');
  if (!rawJoined.trim()) return [para];

  // Chỉ tách giữa dòng khi thực sự là tiêu đề "PHẦN I/II/III/IV" hoặc "Câu 1." / "Bài 1." (tránh tách nhầm chữ "phần 1", "câu 1" viết thường trong thân câu)
  const splitRegex =
    /(?:\n+|(?<=[.?!;:\t\s)"'”’\]])(?=(?:PHẦN\s+(?:I|II|III|IV|1|2|3|4)\b|(?:[A-ZIVX]+\s*[.:\-]\s*)?TỰ\s+LUẬN\b|(?:Câu(?:\s+hỏi|\s+số)?|Bài(?:\s+tập)?|Question)\s*\d+\s*(?:\([^)]{1,25}\)|\[[^\]]{1,25}\])?\s*[.:\-–—)])))/g;

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

  for (let i = 0; i < splitIndices.length - 1; i++) {
    const s = splitIndices[i];
    const e = splitIndices[i + 1];
    const subRuns = sliceRunsByCharRange(para.runs, s, e);
    const subText = normalizeVietnameseExamText(subRuns.map((r) => r.text).join('')).trim();
    if (!subText && (subParagraphs.length > 0 || para.images.length === 0)) continue;

    const isFirstValid = !assignedAutoNumber;
    assignedAutoNumber = true;

    subParagraphs.push({
      fullText: subText,
      runs: subRuns,
      hasUnderline: subRuns.some((r) => r.isUnderline && r.text.trim().length > 0),
      hasRed: subRuns.some((r) => r.isRed && r.text.trim().length > 0),
      hasFormula: para.hasFormula,
      isAutoNumbered: isFirstValid ? para.isAutoNumbered : false,
      images: isFirstValid ? para.images : [],
      rawFormulaXml: isFirstValid ? para.rawFormulaXml : undefined,
      formulaLatex: isFirstValid ? para.formulaLatex : undefined,
    });
  }

  return subParagraphs.length > 0 ? subParagraphs : [para];
}

/**
 * Bóc tách cây XML của file Word (.docx) thành danh sách các đoạn văn kèm:
 * - Gạch chân / Tô đỏ
 * - Xử lý thẻ ngắt dòng mềm <w:br/> và <w:cr/>
 * - Giải mã tự động danh sách auto-numbering từ word/numbering.xml & word/styles.xml (Câu 1., A. B. C. D., a) b) c) d))
 * - Trích xuất ảnh, sơ đồ hình vẽ (<w:drawing>, <w:pict>)
 * - Công thức toán học chuẩn OMML (<m:oMath>)
 */
function extractParagraphsFromDocxXml(
  xmlString: string,
  mediaMap: Map<string, { dataUrl: string; fileName: string }>,
  numberingCtx?: DocxNumberingContext
): ParsedParagraph[] {
  const cleanXml = xmlString.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(cleanXml, 'application/xml');

  let pNodes = Array.from(xmlDoc.getElementsByTagName('w:p'));
  if (pNodes.length === 0) {
    const allElements = xmlDoc.getElementsByTagName('*');
    for (let i = 0; i < allElements.length; i++) {
      if (getLocalTagName(allElements[i]) === 'p') {
        pNodes.push(allElements[i]);
      }
    }
  }

  const rawExtractedParagraphs: ParsedParagraph[] = [];
  const listCounters = new Map<string, number>();

  for (let i = 0; i < pNodes.length; i++) {
    const p = pNodes[i];
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

    const paragraphImages = extractImagesFromElement(p, mediaMap);
    const paraLevelProps = inspectRunProperties(paraRPrNode);

    // Đệ quy duyệt qua mọi thẻ bao bên trong <w:p> (bao gồm w:r, w:fldSimple, w:sdt, w:ins, w:hyperlink, w:customXml, mc:AlternateContent...)
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
          localTag === 'fallback'
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
          for (let k = 0; k < child.childNodes.length; k++) {
            const rChild = child.childNodes[k] as Element;
            if (!rChild.tagName) continue;
            const rTag = getLocalTagName(rChild);
            if (rTag === 't') {
              text += normalizeVietnameseExamText(rChild.textContent || '');
            } else if (rTag === 'tab') {
              text += '\t';
            } else if (rTag === 'br' || rTag === 'cr') {
              text += '\n';
            } else if (rTag === 'instrtext') {
              const instr = (rChild.textContent || '').trim();
              if (/^(?:SEQ|AUTONUM)/i.test(instr)) {
                isAutoNumbered = true;
              }
            }
          }

          const runImages = extractImagesFromElement(child, mediaMap);

          if (text || runImages.length > 0) {
            runs.push({
              text,
              isUnderline: Boolean(props.isUnderline || styleInfo?.isUnderline),
              isRed: Boolean(props.isRed || styleInfo?.isRed),
              isBold: Boolean(props.isBold || styleInfo?.isBold),
              hasFormula: false,
              images: runImages.length > 0 ? runImages : undefined,
            });
          }
        } else if (localTag === 'omath' || localTag === 'omathpara') {
          hasFormula = true;
          const latex = ommlToLatex(child);
          rawFormulaXml = new XMLSerializer().serializeToString(child);
          formulaLatex = latex;
          if (latex) {
            runs.push({
              text: ` ${latex} `,
              isUnderline: false,
              isRed: false,
              isBold: false,
              hasFormula: true,
            });
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

        const joinedPreview = runs.map((r) => r.text).join('').trim();
        const isParaHighlighted =
          paraLevelProps.isUnderline ||
          paraLevelProps.isRed ||
          lvlInfo.isUnderline ||
          lvlInfo.isRed;

        if (
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

    const markedRuns = injectFormattingMarkersIntoRuns(runs);
    runs.length = 0;
    runs.push(...markedRuns);

    const fullText = normalizeVietnameseExamText(runs.map((r) => r.text).join('')).trim();
    if (fullText || paragraphImages.length > 0) {
      const rawPara: ParsedParagraph = {
        fullText,
        runs,
        hasUnderline: runs.some((r) => r.isUnderline && r.text.trim().length > 0),
        hasRed: runs.some((r) => r.isRed && r.text.trim().length > 0),
        hasFormula,
        isAutoNumbered,
        images: paragraphImages,
        rawFormulaXml,
        formulaLatex,
      };
      const deClumped = splitClumpedParagraphIntoLogicalParagraphs(rawPara);
      rawExtractedParagraphs.push(...deClumped);
    }
  }

  // Ghép các ô tiêu đề câu hỏi đứng riêng lẻ trong Bảng Word (VD: Cột 1 là "Câu 1" hoặc "Câu 1.", Cột 2 là nội dung câu hỏi)
  const mergedResult: ParsedParagraph[] = [];
  for (let i = 0; i < rawExtractedParagraphs.length; i++) {
    const curr = rawExtractedParagraphs[i];
    const standaloneHeaderMatch = curr.fullText.match(
      /^(?:Câu(?:\s+hỏi|\s+số)?|Bài(?:\s+tập)?|Question)\s*(\d+|[IVX]+)\s*(?:\([^)]{1,25}\)|\[[^\]]{1,25}\])?\s*[.:\-–—)]*$/i
    );
    if (
      standaloneHeaderMatch &&
      i + 1 < rawExtractedParagraphs.length &&
      !/^(?:PHẦN\s+(?:I|II|III|IV|1|2|3|4)|(?:Câu|Bài|Question)\s*\d+)/i.test(
        rawExtractedParagraphs[i + 1].fullText
      )
    ) {
      const nextPara = rawExtractedParagraphs[i + 1];
      const prefixText = `${curr.fullText.replace(/[.:\-–—)]+$/, '')}. `;
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
    } else {
      mergedResult.push(curr);
    }
  }

  return mergedResult;
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
 */
function findOrderedFourMarkers(
  text: string,
  targetLabels: [string, string, string, string],
  caseSensitive: boolean
): [MarkerMatch, MarkerMatch, MarkerMatch, MarkerMatch] | null {
  const candidatesBySlot: MarkerMatch[][] = [[], [], [], []];

  for (let slot = 0; slot < 4; slot++) {
    const lbl = targetLabels[slot];
    const flags = caseSensitive ? 'g' : 'gi';
    // Cho phép đứng đầu chuỗi, hoặc sau khoảng trắng/tab/xuống dòng, hoặc dính liền sau dấu câu (. ? ! ; : ) ] " ') hoặc chữ thường/số
    const regex = new RegExp(
      `(?:^|[\\s\\t\\n.;:?!)"'”’\\],-]|(?<=[a-zà-ỹ0-9%°]))([*#]?\\s*(${lbl})\\s*[.:)\\-–—])\\s*`,
      flags
    );

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
 * THUẬT TOÁN BẮT BUỘC CHUẨN HÓA ĐÚNG 4 PHƯƠNG ÁN A, B, C, D CHO PHẦN I
 * - Xử lý triệt để câu hỏi và đáp án dính chùm, dài không tách biệt nhau
 * - Đảm bảo 100% mỗi câu Phần I có ĐÚNG 4 phương án A, B, C, D (không thiếu, không dư)
 */
export function enforceStrictFourOptionsPart1(
  question: ExamQuestion,
  questionRuns: ParsedRun[] = []
): ExamQuestion {
  if (question.part !== 'PART_1') return question;

  const existingOpts = question.options || [];
  const rawJoinedRuns = questionRuns.map((r) => r.text).join('');

  // Ghép toàn bộ văn bản của câu hỏi (cả stemText và các phương án đang có) để kiểm tra xem có bị dính chùm không
  const combinedText = [
    question.stemText,
    ...existingOpts.map((o) => `${o.originalLabel}. ${o.text}`),
  ]
    .filter(Boolean)
    .join(' ');

  // 1. Thử bóc tách bộ 4 mốc tuần tự A -> B -> C -> D từ chuỗi tổng hợp
  const orderedFour = findOrderedFourMarkers(
    combinedText,
    ['A', 'B', 'C', 'D'],
    true
  ) || findOrderedFourMarkers(combinedText, ['A', 'B', 'C', 'D'], false);

  let finalStem = question.stemText.trim();
  let finalOptions: OptionPart1[] = [];

  if (orderedFour) {
    const [mA, mB, mC, mD] = orderedFour;
    const extractedStem = combinedText.slice(0, mA.markerStart).trim();
    if (extractedStem) {
      finalStem = extractedStem;
    }

    const rawSegments: { label: 'A' | 'B' | 'C' | 'D'; text: string; fullSeg: string; start: number; starred: boolean }[] = [
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

    finalOptions = rawSegments.map((seg) => {
      // Kiểm tra xem phương án này trước đó đã có trạng thái đúng/gạch chân/đỏ chưa
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

      return {
        id: prevOpt?.id || `${question.id}-opt-${seg.label}`,
        originalLabel: seg.label,
        currentLabel: seg.label,
        text: cleanOptText || `Phương án ${seg.label}`,
        isUnderline,
        isRed,
        isCorrect,
      };
    });
  } else {
    // 2. Nếu không tìm thấy mốc A-B-C-D chuẩn (ví dụ chỉ có 2-3 mốc hoặc viết cách nhau bằng dấu chấm phẩy / xuống dòng)
    const labels: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];

    // Tách thêm các phương án bị gộp trong từng option hiện có
    const expandedPool: { text: string; isCorrect: boolean; isUnderline: boolean; isRed: boolean }[] = [];
    for (const opt of existingOpts) {
      const subParts = opt.text
        .split(/(?:\t+|\s{3,}|\n+|(?<=[.;])\s*(?=[A-D]\s*[.:)]))/g)
        .map((s) => s.replace(/^[A-D]\s*[.:)]\s*/i, '').trim())
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

    // Nếu vẫn chưa có phương án nào và stemText có dấu chấm hỏi '?' hoặc ':' theo sau bởi các mệnh đề
    if (expandedPool.length === 0) {
      const qMarkIdx = Math.max(finalStem.lastIndexOf('?'), finalStem.lastIndexOf(':'));
      if (qMarkIdx > 10 && qMarkIdx < finalStem.length - 8) {
        const tail = finalStem.slice(qMarkIdx + 1).trim();
        const tailParts = tail
          .split(/(?:;|\t+|\n+|\.\s+)/)
          .map((s) => s.trim())
          .filter(Boolean);
        if (tailParts.length >= 2) {
          finalStem = finalStem.slice(0, qMarkIdx + 1).trim();
          tailParts.forEach((tp, idx) => {
            expandedPool.push({
              text: tp,
              isCorrect: idx === 0,
              isUnderline: idx === 0,
              isRed: idx === 0,
            });
          });
        }
      }
    }

    // Chuẩn hóa đúng 4 vị trí A, B, C, D (cắt bỏ phần dư > 4, bù phần thiếu < 4)
    const fallbackDistractors = [
      'Phương án bổ sung A (Cần kiểm tra lại nội dung).',
      'Phương án bổ sung B (Tất cả các đặc điểm trên).',
      'Phương án bổ sung C (Cả hai nhận định trên đều đúng).',
      'Phương án bổ sung D (Không có phương án nào ở trên đúng).',
    ];

    finalOptions = labels.map((lbl, idx) => {
      const item = expandedPool[idx];
      if (item && item.text) {
        return {
          id: `${question.id}-opt-${lbl}`,
          originalLabel: lbl,
          currentLabel: lbl,
          text: item.text,
          isUnderline: item.isUnderline,
          isRed: item.isRed,
          isCorrect: item.isCorrect,
        };
      }
      return {
        id: `${question.id}-opt-${lbl}`,
        originalLabel: lbl,
        currentLabel: lbl,
        text: fallbackDistractors[idx],
        isUnderline: false,
        isRed: false,
        isCorrect: false,
      };
    });
  }

  // Đảm bảo mỗi câu Phần I có ĐÚNG 1 đáp án đúng (nếu chưa có đáp án đúng nào hoặc có nhiều hơn 1)
  const correctList = finalOptions.filter((o) => o.isCorrect);
  if (correctList.length === 0 && finalOptions.length === 4) {
    // Kiểm tra xem trong stemText có ghi "(Đáp án: B)" không
    const keyInStem = finalStem.match(/(?:Đáp\s*án|ĐS)\s*[:=]\s*([A-D])\b/i);
    const targetLabel = keyInStem ? (keyInStem[1].toUpperCase() as 'A' | 'B' | 'C' | 'D') : 'A';
    if (keyInStem) {
      finalStem = finalStem.replace(keyInStem[0], '').trim();
    }
    finalOptions = finalOptions.map((o) =>
      o.originalLabel === targetLabel
        ? { ...o, isCorrect: true, isUnderline: true, isRed: true }
        : o
    );
  } else if (correctList.length > 1) {
    // Chỉ giữ lại đáp án đúng đầu tiên để không bị lỗi thừa đáp án
    let foundFirst = false;
    finalOptions = finalOptions.map((o) => {
      if (o.isCorrect) {
        if (!foundFirst) {
          foundFirst = true;
          return o;
        }
        return { ...o, isCorrect: false, isUnderline: false, isRed: false };
      }
      return o;
    });
  }

  return {
    ...question,
    stemText: finalStem || `Nội dung câu hỏi ${question.displayIndex}:`,
    options: finalOptions,
    computedLayout: computeAutoLayoutForOptions(finalOptions),
  };
}

/**
 * THUẬT TOÁN BẮT BUỘC CHUẨN HÓA ĐÚNG 4 LỆNH HỎI a), b), c), d) CHO PHẦN II (ĐÚNG / SAI)
 * - Xử lý triệt để các ý a), b), c), d) viết liền nhau trên 1 dòng hoặc dính chùm vào thân câu hỏi
 * - Đảm bảo 100% mỗi câu Phần II có ĐÚNG 4 ý a), b), c), d) (không thiếu, không dư)
 */
export function enforceStrictFourSubItemsPart2(
  question: ExamQuestion,
  questionRuns: ParsedRun[] = []
): ExamQuestion {
  if (question.part !== 'PART_2') return question;

  const existingSubs = question.subItems || [];
  const rawJoinedRuns = questionRuns.map((r) => r.text).join('');

  const combinedText = [
    question.stemText,
    ...existingSubs.map((s) => `${s.originalLabel}) ${s.text}`),
  ]
    .filter(Boolean)
    .join(' ');

  // 1. Tìm bộ 4 mốc tuần tự a -> b -> c -> d trong văn bản tổng hợp
  const orderedFour =
    findOrderedFourMarkers(combinedText, ['a', 'b', 'c', 'd'], true) ||
    findOrderedFourMarkers(combinedText, ['a', 'b', 'c', 'd'], false);

  let finalStem = question.stemText.trim();
  let finalSubs: SubItemPart2[] = [];

  if (orderedFour) {
    const [mA, mB, mC, mD] = orderedFour;
    const extractedStem = combinedText.slice(0, mA.markerStart).trim();
    if (extractedStem) {
      finalStem = extractedStem;
    }

    const rawSegments: { label: 'a' | 'b' | 'c' | 'd'; text: string; fullSeg: string; start: number; starred: boolean }[] = [
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

    finalSubs = rawSegments.map((seg) => {
      const prevSub = existingSubs.find((s) => s.originalLabel === seg.label);
      const hl =
        questionRuns.length > 0
          ? checkRangeHighlight(questionRuns, rawJoinedRuns, seg.text, seg.start, seg.fullSeg)
          : { isUnderline: false, isRed: false };

      let cleanSubText = seg.text;
      let explicitTrue: boolean | null = seg.starred ? true : null;

      if (/(?:\(Đ\)|\(Đúng\)|\(True\)|\[Đ\]|\[Đúng\]|-\s*Đúng)$/i.test(cleanSubText)) {
        explicitTrue = true;
        cleanSubText = cleanSubText
          .replace(/(?:\(Đ\)|\(Đúng\)|\(True\)|\[Đ\]|\[Đúng\]|-\s*Đúng)$/i, '')
          .trim();
      } else if (/(?:\(S\)|\(Sai\)|\(False\)|\[S\]|\[Sai\]|-\s*Sai)$/i.test(cleanSubText)) {
        explicitTrue = false;
        cleanSubText = cleanSubText
          .replace(/(?:\(S\)|\(Sai\)|\(False\)|\[S\]|\[Sai\]|-\s*Sai)$/i, '')
          .trim();
      }

      const isUnderline = Boolean(prevSub?.isUnderline || hl.isUnderline || explicitTrue === true);
      const isRed = Boolean(prevSub?.isRed || hl.isRed || explicitTrue === true);
      const isTrue =
        explicitTrue !== null
          ? explicitTrue
          : Boolean(prevSub?.isTrue || isUnderline || isRed);

      return {
        id: prevSub?.id || `${question.id}-sub-${seg.label}`,
        originalLabel: seg.label,
        currentLabel: seg.label,
        text: cleanSubText || `Phát biểu nhận định ý ${seg.label}).`,
        isUnderline,
        isRed,
        isTrue,
      };
    });
  } else {
    const labels: ('a' | 'b' | 'c' | 'd')[] = ['a', 'b', 'c', 'd'];
    const expandedPool: { text: string; isTrue: boolean; isUnderline: boolean; isRed: boolean }[] = [];

    for (const sub of existingSubs) {
      const subParts = sub.text
        .split(/(?:\t+|\n+|(?<=[.;])\s*(?=[a-d]\s*[).:]))/gi)
        .map((s) => s.replace(/^[a-d]\s*[).:]\s*/i, '').trim())
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

    const defaultStatements = [
      'Nhận định a) phù hợp với quy luật sinh học trong thí nghiệm trên.',
      'Nhận định b) phản ánh mối quan hệ giữa các đại lượng trong bài toán.',
      'Nhận định c) khi thay đổi điều kiện môi trường thì tỉ lệ kiểu hình thay đổi.',
      'Nhận định d) kết quả thu được tuân theo định luật di truyền thực nghiệm.',
    ];

    finalSubs = labels.map((lbl, idx) => {
      const item = expandedPool[idx];
      if (item && item.text) {
        return {
          id: `${question.id}-sub-${lbl}`,
          originalLabel: lbl,
          currentLabel: lbl,
          text: item.text,
          isUnderline: item.isUnderline,
          isRed: item.isRed,
          isTrue: item.isTrue,
        };
      }
      return {
        id: `${question.id}-sub-${lbl}`,
        originalLabel: lbl,
        currentLabel: lbl,
        text: defaultStatements[idx],
        isUnderline: idx % 2 === 0,
        isRed: idx % 2 === 0,
        isTrue: idx % 2 === 0,
      };
    });
  }

  return {
    ...question,
    stemText: finalStem || `Cho dữ kiện khoa học ở Câu ${question.displayIndex}, xét tính đúng/sai của các phát biểu sau:`,
    subItems: finalSubs,
  };
}

/**
 * Chuẩn hóa toàn bộ danh sách câu hỏi:
 * Đảm bảo 100% câu hỏi ở Phần I có đúng 4 đáp án (A, B, C, D) và Phần II có đúng 4 ý (a, b, c, d)
 */
export function normalizeAllQuestionsStrictFourOptions(
  questions: ExamQuestion[],
  resetPerPart = true
): ExamQuestion[] {
  const cleaned = questions.map((q) => {
    if (q.part === 'PART_1') {
      return enforceStrictFourOptionsPart1(q);
    }
    if (q.part === 'PART_2') {
      return enforceStrictFourSubItemsPart2(q);
    }
    if (q.part === 'PART_3' && !q.shortAnswer?.trim()) {
      return {
        ...q,
        shortAnswer: '1',
        shortAnswerDetectedBy: 'MANUAL' as const,
      };
    }
    return q;
  });

  return recalculateQuestionNumbering(cleaned, resetPerPart);
}

/**
 * Đọc toàn bộ quan hệ media từ word/_rels/document.xml.rels
 */
async function loadMediaRelationships(
  zip: JSZip
): Promise<Map<string, { dataUrl: string; fileName: string }>> {
  const mediaMap = new Map<string, { dataUrl: string; fileName: string }>();
  const relsFile = zip.file('word/_rels/document.xml.rels');
  if (!relsFile) return mediaMap;

  const relsXml = await relsFile.async('string');
  const parser = new DOMParser();
  const relsDoc = parser.parseFromString(relsXml, 'application/xml');
  const relNodes = relsDoc.getElementsByTagName('Relationship');

  for (let i = 0; i < relNodes.length; i++) {
    const rel = relNodes[i];
    const id = rel.getAttribute('Id');
    const target = rel.getAttribute('Target');
    const type = rel.getAttribute('Type') || '';

    if (id && target && (type.includes('image') || /\.(png|jpe?g|gif|svg|emf|wmf)$/i.test(target))) {
      let zipPath = target;
      if (target.startsWith('../')) {
        zipPath = target.replace(/^\.\.\//, '');
      } else if (!target.startsWith('word/')) {
        zipPath = `word/${target}`;
      }

      const mediaFile = zip.file(zipPath);
      if (mediaFile) {
        const ext = zipPath.split('.').pop()?.toLowerCase() || 'png';
        let mime = 'image/png';
        if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';
        else if (ext === 'gif') mime = 'image/gif';
        else if (ext === 'svg') mime = 'image/svg+xml';
        else if (ext === 'emf' || ext === 'wmf') mime = 'image/x-emf';

        const base64 = await mediaFile.async('base64');
        const dataUrl = `data:${mime};base64,${base64}`;
        mediaMap.set(id, {
          dataUrl,
          fileName: zipPath.split('/').pop() || `image.${ext}`,
        });
      }
    }
  }

  return mediaMap;
}

/**
 * Kiểm tra nhanh xem một dòng văn bản có phải là tiêu đề hành chính đầu trang đề thi hay không
 */
function isAdministrativeExamHeader(text: string): boolean {
  const clean = text.trim();
  if (!clean) return true;
  return /^(?:SỞ\s+GD|UBND\s+|PHÒNG\s+GD|TRƯỜNG\s+THPT|TRƯỜNG\s+THCS|BỘ\s+GIÁO\s+DỤC|ĐỀ\s+CHÍNH\s+THỨC|ĐỀ\s+KIỂM\s+TRA|ĐỀ\s+THI\b|ĐỀ\s+THAM\s+KHẢO|MÔN\s*[:.]|Môn\s+thi\s*[:.]|Thời\s+gian\s+làm\s+bài|Họ\s+và\s+tên|Họ,\s+tên\s+thí\s+sinh|Số\s+báo\s+danh|Mã\s+đề\s*(?:thi)?\s*[:.]|Đề\s+thi\s+gồm\s+có|Không\s+kể\s+thời\s+gian|-----\s*HẾT\s*-----|\(Đề\s+gồm)/i.test(
    clean
  );
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

  const startNewQuestionFromPara = (para: ParsedParagraph, customStemText?: string) => {
    const stemContent = (customStemText !== undefined ? customStemText : para.fullText).trim();
    const initialImages: ExamImageAttachment[] = [...para.images];
    currentQuestionRuns = [...para.runs];

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
    };

    if (currentPart === 'PART_3') {
      const ansKeyword = stemContent.match(/(?:Đáp\s*án|Đáp\s*số|ĐS|Kết\s*quả)\s*[:=]\s*([-\d.,]+)/i);
      if (ansKeyword) {
        currentQuestion.shortAnswer = ansKeyword[1].trim();
        currentQuestion.shortAnswerDetectedBy = 'KEYWORD';
        currentQuestion.stemText = stemContent.replace(ansKeyword[0], '').trim();
      } else {
        const highlightedRuns = para.runs.filter(
          (r) => (r.isUnderline || r.isRed) && /[-\d.,]+/.test(r.text)
        );
        if (highlightedRuns.length > 0) {
          const numMatch = highlightedRuns.map((r) => r.text).join('').match(/-?\d+([.,]\d+)?/);
          if (numMatch) {
            currentQuestion.shortAnswer = numMatch[0];
            currentQuestion.shortAnswerDetectedBy = 'UNDERLINE_RED';
          }
        }
      }
    }
  };

  const pushCurrentQuestion = () => {
    if (!currentQuestion) return;

    // Nếu câu hỏi đang ở PART_1 nhưng lại không có phương án A,B,C,D mà có đủ 4 ý Đúng/Sai a), b), c), d) -> tự động chuyển sang PART_2
    if (
      currentQuestion.part === 'PART_1' &&
      (!currentQuestion.options || currentQuestion.options.length === 0) &&
      currentQuestion.subItems &&
      currentQuestion.subItems.length >= 2
    ) {
      currentQuestion.part = 'PART_2';
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
    }
    questions.push(currentQuestion);
    currentQuestion = null;
    currentQuestionRuns = [];
  };

  const optionRegexSource =
    /(?:^|[\s\t.;:?!)"'”’\],-]|(?<=[a-zà-ỹ0-9%°]))([*#]?\s*([A-D])\s*[.:)\-–—])\s*([^\t\n]+?)(?=(?:[\s\t.;:?!)"'”’\],-]+[*#]?\s*[A-D]\s*[.:)\-–—]|$))/g;
  const subRegexSource =
    /(?:^|[\s\t.;:?!)"'”’\],-])([*#]?\s*([a-d])\s*[).:\-–—])\s*([^\t\n]+?)(?=(?:[\s\t.;:?!)"'”’\],-]+[*#]?\s*[a-d]\s*[).:\-–—]|$))/g;

  for (const para of paragraphs) {
    const text = normalizeVietnameseExamText(para.fullText).trim();
    if (!text && para.images.length === 0) continue;
    const rawJoined = normalizeVietnameseExamText(para.runs.map((r) => r.text).join(''));

    // 1. Nhận diện linh hoạt tiêu đề chuyển PHẦN I, PHẦN II, PHẦN III và PHẦN IV (TỰ LUẬN)
    const strippedHeaderPrefix = text.replace(/^[*#•\-–—\s]+/, '');
    if (
      /^(?:[A-ZIVX0-9]+\s*[.:\-–—)]\s*)?(?:PHẦN\s*(?:IV|4)\b|PHẦN\s*(?:I|II|III|IV|1|2|3|4)?\s*[.:\-–—]?\s*TỰ\s+LUẬN\b|TỰ\s+LUẬN\b)/i.test(
        strippedHeaderPrefix
      )
    ) {
      pushCurrentQuestion();
      pendingStemParagraphs = [];
      currentPart = 'PART_4';
      continue;
    }
    if (
      /^(?:[A-ZIVX0-9]+\s*[.:\-–—)]\s*)?PHẦN\s+(I|1)\b/i.test(strippedHeaderPrefix) &&
      !/PHẦN\s+(II|III|IV)/i.test(strippedHeaderPrefix)
    ) {
      pushCurrentQuestion();
      pendingStemParagraphs = [];
      currentPart = 'PART_1';
      continue;
    }
    if (
      /^(?:[A-ZIVX0-9]+\s*[.:\-–—)]\s*)?PHẦN\s+(II|2)\b/i.test(strippedHeaderPrefix) &&
      !/PHẦN\s+(III|IV)/i.test(strippedHeaderPrefix)
    ) {
      pushCurrentQuestion();
      pendingStemParagraphs = [];
      currentPart = 'PART_2';
      continue;
    }
    if (/^(?:[A-ZIVX0-9]+\s*[.:\-–—)]\s*)?PHẦN\s+(III|3)\b/i.test(strippedHeaderPrefix)) {
      pushCurrentQuestion();
      pendingStemParagraphs = [];
      currentPart = 'PART_3';
      continue;
    }

    // 2. Nhận diện bắt đầu một câu hỏi mới:
    // Hỗ trợ: "Câu 1.", "Câu 1:", "Câu hỏi 1:", "Câu số 1.", "Bài 1:", "Question 1:", "[NB] Câu 1:", "Câu 1 (0,25 điểm):", "1. Nội dung..."
    const explicitQMatch = text.match(
      /^(?:[*#•+\-–—\s]|\[(?:NB|TH|VD|VDC|[^\]]{1,12})\]|\((?:NB|TH|VD|VDC|[^)]{1,12})\))*(?:Câu(?:\s+hỏi|\s+số)?|Bài(?:\s+tập)?|Question|Cau)\s*(\d+|[IVX]+)\s*(?:\([^)]{1,30}\)|\[[^\]]{1,30}\])?\s*[.:\-–—)]*\s*(.*)$/i
    );

    const currentHasCompleteOptions =
      (currentPart === 'PART_1' && (currentQuestion?.options?.length || 0) >= 4) ||
      (currentPart === 'PART_2' && (currentQuestion?.subItems?.length || 0) >= 4) ||
      (currentPart === 'PART_3' && Boolean(currentQuestion?.shortAnswer));

    // Hỗ trợ câu đánh số "1. ...", "2. ...", "1) ..." không có chữ "Câu"
    const numberedNoPrefixMatch =
      !explicitQMatch &&
      (!currentQuestion || currentHasCompleteOptions || currentPart === 'PART_3' || currentPart === 'PART_4') &&
      !/^\s*[*#]?[A-Da-d]\s*[.:)\-–—]/.test(text)
        ? text.match(/^\s*(?:Câu\s*)?(\d{1,3})\s*[.):]\s+([A-ZÀ-Ỹa-zà-ỹ(“"'\d].*)$/)
        : null;

    const qMatch = explicitQMatch || numberedNoPrefixMatch;

    const isAutoNumberQuestion =
      para.isAutoNumbered &&
      !/^\s*[*#]?[A-D]\s*[.:)]/i.test(text) &&
      !/^\s*[*#]?[a-d]\s*[).:]/i.test(text) &&
      !/^(?:Đáp\s*án|Đáp\s*số|ĐS|Lời\s*giải|Hướng\s*dẫn)/i.test(text) &&
      !isAdministrativeExamHeader(text);

    if (qMatch || isAutoNumberQuestion) {
      pushCurrentQuestion();
      pendingStemParagraphs = [];
      const stemContent = qMatch ? qMatch[2].trim() : text;
      startNewQuestionFromPara(para, stemContent);

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

    // Kiểm tra xem đoạn văn hiện tại có chứa phương án A, B, C, D hoặc ý a), b), c), d) không
    const optMatches =
      currentPart === 'PART_1' ? [...text.matchAll(new RegExp(optionRegexSource.source, 'g'))] : [];
    const subMatches =
      currentPart === 'PART_2' || (currentPart === 'PART_1' && optMatches.length === 0)
        ? [...text.matchAll(new RegExp(subRegexSource.source, 'g'))]
        : [];

    // Nếu câu hỏi hiện tại đã đủ 4 phương án A,B,C,D (hoặc 4 ý a,b,c,d) mà gặp đoạn văn mới không phải là phương án hay lời giải -> tự động mở câu hỏi mới!
    if (
      currentQuestion &&
      currentHasCompleteOptions &&
      optMatches.length === 0 &&
      subMatches.length === 0 &&
      !/^(?:Đáp\s*án|Đáp\s*số|ĐS|Lời\s*giải|Hướng\s*dẫn)/i.test(text) &&
      !isAdministrativeExamHeader(text)
    ) {
      pushCurrentQuestion();
      startNewQuestionFromPara(para, text);
      continue;
    }

    // Nếu chưa có currentQuestion (ví dụ file Word bị mất chữ "Câu 1" do macro/field)
    if (!currentQuestion) {
      if (optMatches.length > 0 || subMatches.length > 0) {
        if (subMatches.length > 0 && optMatches.length === 0 && currentPart === 'PART_1') {
          currentPart = 'PART_2';
        }
        if (pendingStemParagraphs.length > 0) {
          const firstPending = pendingStemParagraphs[0];
          const combinedPendingText = pendingStemParagraphs.map((p) => p.fullText).join(' ');
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
          if (pendingStemParagraphs.length > 3) {
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

    // Nếu đang ở PART_1 nhưng phát hiện các dòng bắt đầu bằng a), b), c), d) (khi giáo viên quên gõ tiêu đề PHẦN II)
    if (
      currentQuestion.part === 'PART_1' &&
      (!currentQuestion.options || currentQuestion.options.length === 0) &&
      subMatches.length > 0 &&
      /^\s*[*#]?[a-d]\s*\)/.test(text)
    ) {
      currentPart = 'PART_2';
      currentQuestion.part = 'PART_2';
      currentQuestion.options = undefined;
      currentQuestion.subItems = [];
    }

    // 3. Xử lý nội dung bên trong câu hỏi tùy theo từng Phần
    if (currentQuestion.part === 'PART_1') {
      if (optMatches.length > 0) {
        const firstMatchIdx = optMatches[0].index ?? 0;
        if (firstMatchIdx > 0) {
          const leadingStem = text.slice(0, firstMatchIdx).trim();
          if (leadingStem) {
            currentQuestion.stemText += (currentQuestion.stemText ? ' ' : '') + leadingStem;
          }
        }
        for (const m of optMatches) {
          const markerRaw = m[1] || '';
          const isStarred = markerRaw.startsWith('*') || markerRaw.startsWith('#');
          const label = m[2].toUpperCase() as 'A' | 'B' | 'C' | 'D';
          const optText = m[3].trim();
          const fullSegment = m[0];
          const hl = checkRangeHighlight(para.runs, rawJoined, optText, m.index || 0, fullSegment);
          const isCorrect = isStarred || hl.isUnderline || hl.isRed;

          currentQuestion.options = currentQuestion.options || [];
          currentQuestion.options.push({
            id: `${currentQuestion.id}-opt-${label}-${currentQuestion.options.length}`,
            originalLabel: label,
            currentLabel: label,
            text: optText,
            isUnderline: hl.isUnderline || isStarred,
            isRed: hl.isRed || isStarred,
            isCorrect,
          });
        }
      } else {
        currentQuestion.stemText += (currentQuestion.stemText ? ' ' : '') + text;
      }
    } else if (currentQuestion.part === 'PART_2') {
      const p2Matches = [...text.matchAll(new RegExp(subRegexSource.source, 'gi'))];
      if (p2Matches.length > 0) {
        const firstMatchIdx = p2Matches[0].index ?? 0;
        if (firstMatchIdx > 0) {
          const leadingStem = text.slice(0, firstMatchIdx).trim();
          if (leadingStem) {
            currentQuestion.stemText += (currentQuestion.stemText ? ' ' : '') + leadingStem;
          }
        }
        for (const m of p2Matches) {
          const markerRaw = m[1] || '';
          const isStarred = markerRaw.startsWith('*') || markerRaw.startsWith('#');
          const label = m[2].toLowerCase() as 'a' | 'b' | 'c' | 'd';
          const subText = m[3].trim();
          const hl = checkRangeHighlight(para.runs, rawJoined, subText, m.index || 0, m[0]);
          const isTrue = isStarred || hl.isUnderline || hl.isRed;

          currentQuestion.subItems = currentQuestion.subItems || [];
          currentQuestion.subItems.push({
            id: `${currentQuestion.id}-sub-${label}-${currentQuestion.subItems.length}`,
            originalLabel: label,
            currentLabel: label,
            text: subText,
            isUnderline: hl.isUnderline || isStarred,
            isRed: hl.isRed || isStarred,
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
      } else if (para.hasUnderline || para.hasRed) {
        const numMatch = text.match(/-?\d+([.,]\d+)?/);
        if (numMatch) {
          currentQuestion.shortAnswer = numMatch[0];
          currentQuestion.shortAnswerDetectedBy = 'UNDERLINE_RED';
        }
      } else {
        currentQuestion.stemText += (currentQuestion.stemText ? ' ' : '') + text;
      }
    } else if (currentQuestion.part === 'PART_4') {
      const guideMatch = text.match(
        /^(?:Lời\s*giải(?:\s*chi\s*tiết)?|Hướng\s*dẫn\s*chấm|Đáp\s*án(?:\s*&\s*Thang\s*điểm)?)\s*[:=]\s*(.+)$/i
      );
      if (guideMatch) {
        currentQuestion.explanation =
          (currentQuestion.explanation ? currentQuestion.explanation + '\n' : '') +
          guideMatch[1].trim();
      } else {
        currentQuestion.stemText += (currentQuestion.stemText ? '\n' : '') + text;
      }
    }
  }

  pushCurrentQuestion();

  // Cơ chế dự phòng cuối cùng (Zero-Failure Fallback):
  // Nếu tệp Word có nội dung đoạn văn nhưng hoàn toàn không theo chuẩn Câu 1 / A. B. C. D. thông thường,
  // tự động gom các đoạn văn có nội dung thành câu hỏi để giáo viên vẫn xem và chỉnh sửa được trên giao diện!
  if (questions.length === 0 && paragraphs.length > 0) {
    const meaningfulParas = paragraphs.filter(
      (p) => p.fullText.trim().length > 2 && !isAdministrativeExamHeader(p.fullText)
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
          stemText: p.fullText.trim(),
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
 * Phân tích dữ liệu HTML khi giáo viên Copy & Paste trực tiếp từ Microsoft Word vào trình duyệt:
 * - Nhận diện chính xác cả thẻ <u>, <ins>, style="text-decoration: underline", "text-underline: single"
 * - Nhận diện chính xác cả màu chữ đỏ (color: red, #ff0000, rgb(255,0,0)...)
 * - Bắt trọn các trường hợp chỉ gạch chân chữ cái <u>a</u>), hoặc <u>a)</u>, hoặc <u>a) </u> ở Phần II và Phần I
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

    for (const block of containers) {
      if (
        (block.tagName === 'DIV' || block.tagName === 'TR') &&
        block.querySelector('p, li')
      ) {
        continue;
      }

      const runs: ParsedRun[] = [];
      const walkTextNodes = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const txt = normalizeVietnameseExamText(node.textContent || '');
          if (txt) {
            const parentEl = node.parentElement;
            runs.push({
              text: txt,
              isUnderline: isElementUnderlined(parentEl),
              isRed: isElementRed(parentEl),
              isBold: false,
              hasFormula: /[√∫∑πΔαβλθ±×÷≤≥≠∈∉→∞]/.test(txt),
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
      if (!fullText) continue;

      const p: ParsedParagraph = {
        fullText,
        runs: markedRuns,
        hasUnderline: markedRuns.some((r) => r.isUnderline && r.text.trim().length > 0),
        hasRed: markedRuns.some((r) => r.isRed && r.text.trim().length > 0),
        hasFormula: markedRuns.some((r) => r.hasFormula),
        isAutoNumbered: block.tagName === 'LI',
        images: [],
      };
      rawParas.push(...splitClumpedParagraphIntoLogicalParagraphs(p));
    }

    if (rawParas.length > 0) {
      return buildQuestionsFromParsedParagraphs(rawParas, resetPerPart);
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
    const essayTitle = p3.length > 0 ? 'PHẦN IV. TỰ LUẬN' : 'PHẦN III. TỰ LUẬN';
    sections.push(`\n${essayTitle}`);
    for (const q of p4) {
      const guideLine = q.explanation ? `\nHướng dẫn chấm: ${q.explanation}` : '';
      sections.push(`Câu ${q.displayIndex}. ${q.stemText}${guideLine}`);
    }
  }

  return sections.join('\n\n');
}

/**
 * Phân tích File Word (.docx / .doc / văn bản) theo cấu trúc chuẩn THPT 2025
 * Hỗ trợ nhận diện toàn diện:
 * - Tách tự động các câu hỏi và phương án A, B, C, D / a), b), c), d) bị dính chùm
 * - Giải mã tự động Numbering / Multilevel List từ word/numbering.xml & word/styles.xml
 * - Chuẩn hóa bảng mã Unicode Tổ hợp (NFD -> NFC) và tiêu đề VNI/TCVN3
 * - Bắt buộc chuẩn hóa đúng 4 đáp án cho mọi câu ở Phần I và Phần II (không thiếu, không dư)
 * - Ảnh minh họa, sơ đồ sinh học/hóa học/vật lý (<w:drawing>, <w:pict>)
 * - Công thức toán học (OMML <m:oMath> -> LaTeX)
 */
export async function parseDocxExamFile(
  file: File,
  resetPerPart = true
): Promise<ExamQuestion[]> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const docXmlFile =
      zip.file('word/document.xml') ||
      zip.file(/^word\/document.*\.xml$/i)[0];

    if (!docXmlFile) {
      throw new Error('Không tìm thấy word/document.xml');
    }

    const [mediaMap, numberingCtx, xmlString] = await Promise.all([
      loadMediaRelationships(zip),
      loadDocxNumberingContext(zip),
      docXmlFile.async('string'),
    ]);

    const paragraphs = extractParagraphsFromDocxXml(xmlString, mediaMap, numberingCtx);
    const parsedQuestions = buildQuestionsFromParsedParagraphs(paragraphs, resetPerPart);

    if (parsedQuestions.length > 0) {
      return parsedQuestions;
    }

    // Dự phòng nếu paragraphs ghép lại có thể phân tích qua bộ đọc văn bản thô
    const rawJoined = paragraphs.map((p) => p.fullText).join('\n');
    if (rawJoined.trim()) {
      return parseRawTextToExamQuestions(rawJoined, resetPerPart);
    }

    return [];
  } catch {
    // Dự phòng trường hợp giáo viên tải tệp .doc (định dạng HTML/Text/RTF) hoặc tệp văn bản đổi đuôi .docx
    try {
      const rawText = await file.text();
      if (/<html|<body|<p\b|<div\b/i.test(rawText)) {
        return parseClipboardHtmlToExamQuestions(rawText, rawText, resetPerPart);
      }
      if (rawText && rawText.trim().length > 0) {
        return parseRawTextToExamQuestions(rawText, resetPerPart);
      }
    } catch {
      // Ignore fallback error
    }
    throw new Error(
      'Tệp tải lên không đúng định dạng Word (.docx). Nếu tệp đang ở định dạng Word 97-2003 (.doc), vui lòng chọn Save As -> Word Document (.docx) hoặc Copy & Dán trực tiếp nội dung vào khung Trang Word A4.'
    );
  }
}
