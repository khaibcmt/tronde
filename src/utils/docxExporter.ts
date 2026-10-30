import JSZip from 'jszip';
import {
  ExamImageAttachment,
  ExamQuestion,
  OptionPart1,
  ShuffleConfig,
  ShuffledVariant,
} from '../types/exam';
import {
  buildRichScientificRunsAndMathXml,
  buildStructuredStemTableXml,
} from './scientificExamProcessor';
import {
  enforceStrictFourOptionsPart1,
  enforceStrictFourSubItemsPart2,
  healHollowedContextGaps,
} from './docxParser';
import { buildCV7991MatrixAndSpecification } from './matrixSpecCv7991';
import { generateMasterMultiQrCode } from './shuffleEngine';

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const commaIdx = dataUrl.indexOf(',');
  const header = commaIdx >= 0 ? dataUrl.slice(0, commaIdx) : '';
  const payload = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;

  if (/;base64/i.test(header)) {
    const binary = atob(payload.trim());
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  // Hỗ trợ chuỗi data:image/svg+xml;utf8,<svg...> hoặc URI-encoded
  try {
    return new TextEncoder().encode(decodeURIComponent(payload));
  } catch {
    return new TextEncoder().encode(payload);
  }
}

/**
 * Tạo đoạn văn bản Word chuẩn Typography & Khoa học Tự nhiên:
 * - Bắt buộc Font Times New Roman kích cỡ 12pt (24 half-points)
 * - Tự động nhận diện và chuyển đổi công thức Toán/Lý sang chuẩn Office Math Markup (<m:oMath>)
 * - Tự động nhận diện chỉ số trên/dưới Hóa học (H₂SO₄, Fe³⁺, SO₄²⁻) sang <w:vertAlign w:val="subscript/superscript"/>
 * - Canh trái (left) hoặc theo tùy chọn, tự động co dãn đều đẹp mắt
 * - Giãn dòng chuẩn Line spacing: 1.15 (w:line="276")
 */
function buildStandardParagraphXml(
  boldPrefix: string,
  bodyText: string,
  options?: {
    hangingIndent?: boolean;
    keepNext?: boolean;
    underlinePrefix?: boolean;
    underlineBody?: boolean;
    redBody?: boolean;
    boldBody?: boolean;
    italicBody?: boolean;
    bodyColorHex?: string;
    prefixColorHex?: string;
    align?: 'left' | 'both' | 'center' | 'right';
    spaceBeforeTwips?: number;
    spaceAfterTwips?: number;
    fontSizeHalfPt?: number;
  }
): string {
  const align = options?.align || 'left';
  const spaceBefore = options?.spaceBeforeTwips ?? 0; // 0 pt
  const spaceAfter = options?.spaceAfterTwips ?? 60; // 3 pt = 60 twips
  const fontSize = options?.fontSizeHalfPt ?? 24; // 12pt = 24 half-points
  const indXml = options?.hangingIndent
    ? `<w:ind w:left="360" w:hanging="360"/>`
    : '';
  const keepNextXml = options?.keepNext ? '<w:keepNext/>' : '';

  const prefixColor = options?.prefixColorHex
    ? `<w:color w:val="${options.prefixColorHex}"/>`
    : options?.redBody
    ? '<w:color w:val="FF0000"/>'
    : '';

  const resolvedBodyColorHex = options?.bodyColorHex
    ? options.bodyColorHex
    : options?.redBody
    ? 'FF0000'
    : undefined;

  const prefixRunXml = boldPrefix
    ? `<w:r>
        <w:rPr>
          <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
          <w:b/>
          ${options?.underlinePrefix || options?.underlineBody ? '<w:u w:val="single"/>' : ''}
          ${prefixColor}
          <w:sz w:val="${fontSize}"/><w:szCs w:val="${fontSize}"/>
        </w:rPr>
        <w:t xml:space="preserve">${escapeXml(boldPrefix)}</w:t>
      </w:r>`
    : '';

  // Chuyển đổi nội dung thân đoạn văn qua bộ xử lý Toán - Lý - Hóa (OMML + Subscript/Superscript)
  // Hỗ trợ xuống dòng mềm (\n) bên trong thân câu hỏi (ví dụ câu hỏi có nhiều dòng dữ kiện hoặc bảng ghép đôi Cột A - Cột B)
  let bodyRunXml = '';
  if (bodyText) {
    const lines = bodyText.split(/\r?\n/);
    bodyRunXml = lines
      .map((line, idx) => {
        const lineXml = buildRichScientificRunsAndMathXml(line, {
          bold: options?.boldBody,
          italic: options?.italicBody,
          underline: options?.underlineBody,
          colorHex: resolvedBodyColorHex,
          fontSizeHalfPt: fontSize,
        });
        if (idx === 0) return lineXml;
        return `<w:r><w:br/></w:r>\n${lineXml}`;
      })
      .join('\n');
  }

  return `<w:p>
    <w:pPr>
      ${keepNextXml}
      <w:spacing w:before="${spaceBefore}" w:after="${spaceAfter}" w:line="276" w:lineRule="auto"/>
      ${indXml}
      <w:jc w:val="${align}"/>
    </w:pPr>
    ${prefixRunXml}
    ${bodyRunXml}
  </w:p>`;
}

/**
 * Tạo Khung Tiêu Đề Đề Thi Chuẩn Quốc Ngữ (2 cột: Sở/Trường bên trái - Quốc hiệu/Tiêu ngữ hoặc Kỳ thi/Mã đề bên phải)
 * Tất cả dùng Times New Roman 12pt
 */
function buildExamNationalHeaderTableXml(
  config: ShuffleConfig,
  examCodeLabel?: string
): string {
  const leftCellParagraphs = [
    buildStandardParagraphXml(config.departmentName.toUpperCase(), '', {
      align: 'center',
      spaceAfterTwips: 40,
      fontSizeHalfPt: 24,
    }),
    buildStandardParagraphXml(config.schoolName.toUpperCase(), '', {
      align: 'center',
      underlinePrefix: true,
      spaceAfterTwips: 60,
      fontSizeHalfPt: 24,
    }),
    buildStandardParagraphXml(config.examSubtitle || 'ĐỀ CHÍNH THỨC', '', {
      align: 'center',
      spaceAfterTwips: 40,
      fontSizeHalfPt: 24,
    }),
  ].join('\n');

  const rightCellParagraphs = [
    buildStandardParagraphXml(config.nationalHeader.toUpperCase(), '', {
      align: 'center',
      spaceAfterTwips: 40,
      fontSizeHalfPt: 24,
    }),
    buildStandardParagraphXml(config.nationalMotto, '', {
      align: 'center',
      underlinePrefix: true,
      spaceAfterTwips: 60,
      fontSizeHalfPt: 24,
    }),
    buildStandardParagraphXml(
      `${config.examTitle.toUpperCase()} (${config.schoolYear})`,
      '',
      {
        align: 'center',
        spaceAfterTwips: 40,
        fontSizeHalfPt: 24,
      }
    ),
    buildStandardParagraphXml(
      `Môn thi: ${config.subjectName.toUpperCase()}`,
      ` — Thời gian làm bài: ${config.durationMinutes} phút`,
      {
        align: 'center',
        italicBody: true,
        spaceAfterTwips: 40,
        fontSizeHalfPt: 24,
      }
    ),
  ].join('\n');

  const codeBoxXml = examCodeLabel
    ? `<w:p>
        <w:pPr>
          <w:spacing w:before="80" w:after="120"/>
          <w:jc w:val="center"/>
        </w:pPr>
        <w:r>
          <w:rPr>
            <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
            <w:b/>
            <w:color w:val="1E3A8A"/>
            <w:sz w:val="24"/><w:szCs w:val="24"/>
          </w:rPr>
          <w:t xml:space="preserve">${escapeXml(examCodeLabel)}</w:t>
        </w:r>
      </w:p>`
    : '';

  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="5000" w:type="pct"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="6" w:space="0" w:color="94A3B8"/>
        <w:left w:val="single" w:sz="6" w:space="0" w:color="94A3B8"/>
        <w:bottom w:val="single" w:sz="6" w:space="0" w:color="94A3B8"/>
        <w:right w:val="single" w:sz="6" w:space="0" w:color="94A3B8"/>
        <w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/>
        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
      </w:tblBorders>
      <w:tblCellMar>
        <w:top w:w="80" w:type="dxa"/>
        <w:left w:w="100" w:type="dxa"/>
        <w:bottom w:w="80" w:type="dxa"/>
        <w:right w:w="100" w:type="dxa"/>
      </w:tblCellMar>
    </w:tblPr>
    <w:tr>
      <w:tc>
        <w:tcPr><w:tcW w:w="2100" w:type="pct"/></w:tcPr>
        ${leftCellParagraphs}
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="2900" w:type="pct"/></w:tcPr>
        ${rightCellParagraphs}
      </w:tc>
    </w:tr>
  </w:tbl>
  ${codeBoxXml}
  <w:p>
    <w:pPr><w:spacing w:before="60" w:after="120"/><w:jc w:val="left"/></w:pPr>
    <w:r>
      <w:rPr>
        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
        <w:b/>
        <w:sz w:val="24"/><w:szCs w:val="24"/>
      </w:rPr>
      <w:t xml:space="preserve">Họ và tên thí sinh: ..................................................................... Số báo danh: ...........................</w:t>
    </w:r>
  </w:p>`;
}

/**
 * Tự động dàn dòng phương án Phần I bằng Tab Stops cố định trong Word (<w:tabs>):
 * - Phương án ngắn (< 15 ký tự): Dàn 1 hàng (chia đều 4 cột tab: pos 2340, 4680, 7020 twips).
 * - Phương án trung bình (15 - 35 ký tự): Dàn 2 hàng (mỗi hàng 2 cột tab cân xứng: pos 4680 twips, hàng 1 có w:keepNext).
 * - Phương án dài / chứa phân số cao (> 35 ký tự): Dàn 4 hàng (mỗi phương án 1 dòng riêng với w:hangingIndent).
 * Bắt đầu mỗi phương án bằng **A.**, **B.**, **C.**, **D.** (In đậm, Times New Roman 12pt).
 * Khoảng cách dòng Multiple 1.15 pt (w:line="276"), Spacing After 3 pt (w:after="60"), Before 0 pt.
 */
function buildPart1OptionsWithTabStopsXml(
  options: OptionPart1[],
  layout: '1_ROW_4_COL' | '2_ROW_2_COL' | '4_ROW_1_COL',
  highlightCorrect: boolean
): string {
  if (!options || options.length === 0) return '';

  const renderOptionInlineXml = (opt: OptionPart1) => {
    const isMarked = highlightCorrect && opt.isCorrect;
    const prefixRun = `<w:r>
      <w:rPr>
        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
        <w:b/>
        ${isMarked ? '<w:u w:val="single"/><w:color w:val="FF0000"/>' : ''}
        <w:sz w:val="24"/><w:szCs w:val="24"/>
      </w:rPr>
      <w:t xml:space="preserve">${opt.currentLabel}. </w:t>
    </w:r>`;

    const bodyRuns = buildRichScientificRunsAndMathXml(opt.text, {
      underline: isMarked,
      colorHex: isMarked ? 'FF0000' : undefined,
      fontSizeHalfPt: 24,
    });

    return `${prefixRun}\n${bodyRuns}`;
  };

  if (layout === '1_ROW_4_COL' && options.length === 4) {
    return `<w:p>
      <w:pPr>
        <w:spacing w:before="0" w:after="60" w:line="276" w:lineRule="auto"/>
        <w:tabs>
          <w:tab w:val="left" w:pos="2340"/>
          <w:tab w:val="left" w:pos="4680"/>
          <w:tab w:val="left" w:pos="7020"/>
        </w:tabs>
        <w:jc w:val="left"/>
      </w:pPr>
      ${renderOptionInlineXml(options[0])}
      <w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:tab/></w:r>
      ${renderOptionInlineXml(options[1])}
      <w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:tab/></w:r>
      ${renderOptionInlineXml(options[2])}
      <w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:tab/></w:r>
      ${renderOptionInlineXml(options[3])}
    </w:p>`;
  }

  if (layout === '2_ROW_2_COL' && options.length === 4) {
    const row1Xml = `<w:p>
      <w:pPr>
        <w:keepNext/>
        <w:spacing w:before="0" w:after="60" w:line="276" w:lineRule="auto"/>
        <w:tabs>
          <w:tab w:val="left" w:pos="4680"/>
        </w:tabs>
        <w:jc w:val="left"/>
      </w:pPr>
      ${renderOptionInlineXml(options[0])}
      <w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:tab/></w:r>
      ${renderOptionInlineXml(options[1])}
    </w:p>`;

    const row2Xml = `<w:p>
      <w:pPr>
        <w:spacing w:before="0" w:after="60" w:line="276" w:lineRule="auto"/>
        <w:tabs>
          <w:tab w:val="left" w:pos="4680"/>
        </w:tabs>
        <w:jc w:val="left"/>
      </w:pPr>
      ${renderOptionInlineXml(options[2])}
      <w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:tab/></w:r>
      ${renderOptionInlineXml(options[3])}
    </w:p>`;

    return `${row1Xml}\n${row2Xml}`;
  }

  // Mặc định: 4_ROW_1_COL (mỗi phương án 1 dòng riêng biệt)
  return options
    .map((opt, idx) => {
      const isMarked = highlightCorrect && opt.isCorrect;
      return buildStandardParagraphXml(`${opt.currentLabel}. `, opt.text, {
        hangingIndent: true,
        keepNext: idx < options.length - 1,
        underlineBody: isMarked,
        redBody: isMarked,
        align: 'left',
        spaceBeforeTwips: 0,
        spaceAfterTwips: 60,
        fontSizeHalfPt: 24,
      });
    })
    .join('\n');
}

/**
 * Khâu kiểm duyệt cuối (Final Validation Gate):
 * 1. Quét toàn bộ câu hỏi đề thi, triệt tiêu mọi phương án hoặc mệnh đề rỗng (A. . hoặc a) .)
 * 2. Tự động chạy tầng xử lý thứ hai để vá dứt điểm và phục hồi công thức/nội dung trước khi đóng gói Word
 * 3. Tự động kiểm tra phát hiện câu hỏi có dẫn chiếu hình ảnh ("như hình bên", "như Hình 1", "tham khảo hình vẽ")
 *    nhưng chưa có ảnh gắn kèm -> tự động tạo và gắn khối ảnh vector chuẩn 300 DPI [HINH_ANH_CAU_X]
 */
export function runFinalValidationGateAndRepair(
  questions: ExamQuestion[]
): ExamQuestion[] {
  return questions.map((q) => {
    // 1. Vá các khoảng trống bị đục lỗ trong phần dẫn
    const healedStem = healHollowedContextGaps(q.stemText || '');

    // 2. Kiểm tra nếu câu dẫn có cụm từ "như hình bên", "như Hình 1", "tham khảo hình vẽ" nhưng q.images rỗng
    let images = q.images ? [...q.images] : [];
    const hasImageMention =
      /(?:như\s+hình\s+bên|như\s+Hình\s*\d+|tham\s+khảo\s+hình|nhìn\s+hình|quan\s+sát\s+hình|sơ\s+đồ\s+dưới\s+đây|đồ\s+thị\s+hình\s+bên)/i.test(
        healedStem
      );
    if (hasImageMention && images.length === 0) {
      const tagId = `[HINH_ANH_CAU_${q.displayIndex}]`;
      const placeholderSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="450" height="200" viewBox="0 0 450 200"><rect width="100%" height="100%" fill="%23ffffff" stroke="%233b82f6" stroke-width="2" rx="8"/><rect x="20" y="20" width="410" height="160" fill="%23f8fafc" stroke="%2394a3b8" stroke-dasharray="4 4" rx="6"/><text x="225" y="90" font-family="Times New Roman, serif" font-size="16" font-weight="bold" text-anchor="middle" fill="%231e3a8a">HÌNH MINH HỌA CÂU ${q.displayIndex}</text><text x="225" y="125" font-family="Times New Roman, serif" font-size="13" font-style="italic" text-anchor="middle" fill="%23475569">Sơ đồ / Đồ thị bài tập đạt chuẩn phân giải 300 DPI (${tagId})</text></svg>`;
      images.push({
        id: `auto-img-${q.id}-${q.displayIndex}`,
        dataUrl: placeholderSvg,
        tagId,
        caption: `Hình minh họa Câu ${q.displayIndex} ${tagId}`,
        widthTwips: 4500,
        heightTwips: 2000,
        aspectRatio: 450 / 200,
        dpi: 300,
      });
    }

    // 3. Khóa chống đáp án rỗng ở Phần I
    if (q.part === 'PART_1') {
      const repaired = enforceStrictFourOptionsPart1({
        ...q,
        stemText: healedStem,
        images,
        hasImage: images.length > 0,
      });
      return repaired;
    }

    // 4. Khóa chống mệnh đề rỗng ở Phần II
    if (q.part === 'PART_2') {
      const repaired = enforceStrictFourSubItemsPart2({
        ...q,
        stemText: healedStem,
        images,
        hasImage: images.length > 0,
      });
      return repaired;
    }

    return {
      ...q,
      stemText: healedStem,
      images,
      hasImage: images.length > 0,
    };
  });
}

/**
 * Tạo Khung Đáp Án 3 Cột Mầu (Giống hệt hình mẫu đính kèm):
 * - Cột 1 (Khung Xanh Dương nhạt #F0F6FF, viền #93C5FD): PHẦN I (4 lựa chọn) chia 3 cột con bên trong: 1. B | 2. A | 3. B
 * - Cột 2 (Khung Xanh Lá nhạt #ECFDF5, viền #6EE7B7): PHẦN II (Đúng / Sai) dạng pill: Câu 1: ĐSĐĐ (TFTT)
 * - Cột 3 (Khung Vàng Cam nhạt #FFFBEB, viền #FCD34D): PHẦN III (Trả lời ngắn) dạng pill: Câu 1: 375
 * Tất cả dùng font Times New Roman 12pt!
 */
export function buildVariant3ColumnAnswerCardXml(variant: ShuffledVariant): string {
  // --- CỘT 1: PHẦN I (chia lưới 3 cột con) ---
  const p1Items = variant.answerKey.part1;
  const p1Rows: string[] = [];
  for (let i = 0; i < p1Items.length; i += 3) {
    const rowCells: string[] = [];
    for (let c = 0; c < 3; c++) {
      const item = p1Items[i + c];
      if (item) {
        rowCells.push(`<w:tc>
          <w:tcPr>
            <w:tcW w:w="1666" w:type="pct"/>
            <w:tcBorders>
              <w:top w:val="single" w:sz="6" w:space="0" w:color="BFDBFE"/>
              <w:left w:val="single" w:sz="6" w:space="0" w:color="BFDBFE"/>
              <w:bottom w:val="single" w:sz="6" w:space="0" w:color="BFDBFE"/>
              <w:right w:val="single" w:sz="6" w:space="0" w:color="BFDBFE"/>
            </w:tcBorders>
            <w:shd w:val="clear" w:color="auto" w:fill="FFFFFF"/>
          </w:tcPr>
          <w:p>
            <w:pPr>
              <w:spacing w:before="40" w:after="40"/>
              <w:jc w:val="center"/>
            </w:pPr>
            <w:r>
              <w:rPr>
                <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
                <w:b/>
                <w:color w:val="1E293B"/>
                <w:sz w:val="24"/><w:szCs w:val="24"/>
              </w:rPr>
              <w:t xml:space="preserve">${item.questionNumber}. </w:t>
            </w:r>
            <w:r>
              <w:rPr>
                <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
                <w:b/>
                <w:color w:val="E11D48"/>
                <w:sz w:val="24"/><w:szCs w:val="24"/>
              </w:rPr>
              <w:t xml:space="preserve">${escapeXml(item.answer)}</w:t>
            </w:r>
          </w:p>
        </w:tc>`);
      } else {
        rowCells.push(`<w:tc>
          <w:tcPr>
            <w:tcW w:w="1666" w:type="pct"/>
            <w:tcBorders>
              <w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/>
              <w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/>
              <w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/>
              <w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/>
            </w:tcBorders>
          </w:tcPr>
          <w:p/>
        </w:tc>`);
      }
    }
    p1Rows.push(`<w:tr>${rowCells.join('')}</w:tr>`);
  }

  const p1InnerTableXml =
    p1Rows.length > 0
      ? `<w:tbl>
          <w:tblPr>
            <w:tblW w:w="5000" w:type="pct"/>
            <w:tblCellSpacing w:w="45" w:type="dxa"/>
            <w:tblCellMar>
              <w:top w:w="40" w:type="dxa"/>
              <w:left w:w="60" w:type="dxa"/>
              <w:bottom w:w="40" w:type="dxa"/>
              <w:right w:w="60" w:type="dxa"/>
            </w:tblCellMar>
          </w:tblPr>
          ${p1Rows.join('\n')}
        </w:tbl>`
      : buildStandardParagraphXml('Không có câu hỏi Phần I', '', { fontSizeHalfPt: 24 });

  // --- CỘT 2: PHẦN II (Đúng / Sai) ---
  const p2Rows = variant.answerKey.part2.map(
    (item) => `<w:tr>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="5000" w:type="pct"/>
          <w:tcBorders>
            <w:top w:val="single" w:sz="6" w:space="0" w:color="6EE7B7"/>
            <w:left w:val="single" w:sz="6" w:space="0" w:color="6EE7B7"/>
            <w:bottom w:val="single" w:sz="6" w:space="0" w:color="6EE7B7"/>
            <w:right w:val="single" w:sz="6" w:space="0" w:color="6EE7B7"/>
          </w:tcBorders>
          <w:shd w:val="clear" w:color="auto" w:fill="FFFFFF"/>
        </w:tcPr>
        <w:p>
          <w:pPr>
            <w:spacing w:before="40" w:after="40"/>
            <w:jc w:val="both"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
              <w:b/>
              <w:color w:val="1E293B"/>
              <w:sz w:val="24"/><w:szCs w:val="24"/>
            </w:rPr>
            <w:t xml:space="preserve">Câu ${item.questionNumber}:    </w:t>
          </w:r>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
              <w:b/>
              <w:color w:val="047857"/>
              <w:sz w:val="24"/><w:szCs w:val="24"/>
            </w:rPr>
            <w:t xml:space="preserve">${escapeXml(item.dsString)} (${escapeXml(item.tfString)})</w:t>
          </w:r>
        </w:p>
      </w:tc>
    </w:tr>`
  );

  const p2InnerTableXml =
    p2Rows.length > 0
      ? `<w:tbl>
          <w:tblPr>
            <w:tblW w:w="5000" w:type="pct"/>
            <w:tblCellSpacing w:w="45" w:type="dxa"/>
            <w:tblCellMar>
              <w:top w:w="40" w:type="dxa"/>
              <w:left w:w="100" w:type="dxa"/>
              <w:bottom w:w="40" w:type="dxa"/>
              <w:right w:w="100" w:type="dxa"/>
            </w:tblCellMar>
          </w:tblPr>
          ${p2Rows.join('\n')}
        </w:tbl>`
      : buildStandardParagraphXml('Không có câu hỏi Phần II', '', { fontSizeHalfPt: 24 });

  // --- CỘT 3: PHẦN III (Trả lời ngắn) ---
  const p3Rows = variant.answerKey.part3.map(
    (item) => `<w:tr>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="5000" w:type="pct"/>
          <w:tcBorders>
            <w:top w:val="single" w:sz="6" w:space="0" w:color="FCD34D"/>
            <w:left w:val="single" w:sz="6" w:space="0" w:color="FCD34D"/>
            <w:bottom w:val="single" w:sz="6" w:space="0" w:color="FCD34D"/>
            <w:right w:val="single" w:sz="6" w:space="0" w:color="FCD34D"/>
          </w:tcBorders>
          <w:shd w:val="clear" w:color="auto" w:fill="FFFFFF"/>
        </w:tcPr>
        <w:p>
          <w:pPr>
            <w:spacing w:before="40" w:after="40"/>
            <w:jc w:val="both"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
              <w:b/>
              <w:color w:val="1E293B"/>
              <w:sz w:val="24"/><w:szCs w:val="24"/>
            </w:rPr>
            <w:t xml:space="preserve">Câu ${item.questionNumber}:          </w:t>
          </w:r>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
              <w:b/>
              <w:color w:val="E11D48"/>
              <w:sz w:val="24"/><w:szCs w:val="24"/>
            </w:rPr>
            <w:t xml:space="preserve">${escapeXml(item.answer)}</w:t>
          </w:r>
        </w:p>
      </w:tc>
    </w:tr>`
  );

  const p3InnerTableXml =
    p3Rows.length > 0
      ? `<w:tbl>
          <w:tblPr>
            <w:tblW w:w="5000" w:type="pct"/>
            <w:tblCellSpacing w:w="45" w:type="dxa"/>
            <w:tblCellMar>
              <w:top w:w="40" w:type="dxa"/>
              <w:left w:w="100" w:type="dxa"/>
              <w:bottom w:w="40" w:type="dxa"/>
              <w:right w:w="100" w:type="dxa"/>
            </w:tblCellMar>
          </w:tblPr>
          ${p3Rows.join('\n')}
        </w:tbl>`
      : buildStandardParagraphXml('Không có câu hỏi Phần III', '', { fontSizeHalfPt: 24 });

  // --- BẢNG KHUNG BAO CHUNG CHO MÃ ĐỀ (GỒM TIÊU ĐỀ MÃ ĐỀ + 3 KHUNG MÀU PHẦN I, II, III) ---
  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="5000" w:type="pct"/>
      <w:tblCellSpacing w:w="80" w:type="dxa"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="10" w:space="0" w:color="38BDF8"/>
        <w:left w:val="single" w:sz="10" w:space="0" w:color="38BDF8"/>
        <w:bottom w:val="single" w:sz="10" w:space="0" w:color="38BDF8"/>
        <w:right w:val="single" w:sz="10" w:space="0" w:color="38BDF8"/>
      </w:tblBorders>
      <w:shd w:val="clear" w:color="auto" w:fill="FFFFFF"/>
      <w:tblCellMar>
        <w:top w:w="100" w:type="dxa"/>
        <w:left w:w="100" w:type="dxa"/>
        <w:bottom w:w="100" w:type="dxa"/>
        <w:right w:w="100" w:type="dxa"/>
      </w:tblCellMar>
    </w:tblPr>
    <w:tr>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="5000" w:type="pct"/>
          <w:gridSpan w:val="3"/>
          <w:tcBorders>
            <w:top w:val="single" w:sz="6" w:space="0" w:color="0284C7"/>
            <w:left w:val="single" w:sz="6" w:space="0" w:color="0284C7"/>
            <w:bottom w:val="single" w:sz="6" w:space="0" w:color="0284C7"/>
            <w:right w:val="single" w:sz="6" w:space="0" w:color="0284C7"/>
          </w:tcBorders>
          <w:shd w:val="clear" w:color="auto" w:fill="E0F2FE"/>
        </w:tcPr>
        <w:p>
          <w:pPr>
            <w:spacing w:before="40" w:after="40"/>
            <w:jc w:val="left"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
              <w:b/>
              <w:color w:val="0F172A"/>
              <w:sz w:val="24"/><w:szCs w:val="24"/>
            </w:rPr>
            <w:t xml:space="preserve">BẢNG ĐÁP ÁN MÃ ĐỀ: ${escapeXml(variant.examCode)}</w:t>
          </w:r>
        </w:p>
      </w:tc>
    </w:tr>
    <w:tr>
      <!-- Cột 1: PHẦN I -->
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="1750" w:type="pct"/>
          <w:tcBorders>
            <w:top w:val="single" w:sz="8" w:space="0" w:color="93C5FD"/>
            <w:left w:val="single" w:sz="8" w:space="0" w:color="93C5FD"/>
            <w:bottom w:val="single" w:sz="8" w:space="0" w:color="93C5FD"/>
            <w:right w:val="single" w:sz="8" w:space="0" w:color="93C5FD"/>
          </w:tcBorders>
          <w:shd w:val="clear" w:color="auto" w:fill="F0F6FF"/>
        </w:tcPr>
        ${buildStandardParagraphXml('PHẦN I (4 lựa chọn)', '', {
          prefixColorHex: '1E3A8A',
          underlinePrefix: true,
          spaceAfterTwips: 80,
          fontSizeHalfPt: 24,
        })}
        ${p1InnerTableXml}
        <w:p><w:pPr><w:spacing w:before="0" w:after="20"/></w:pPr></w:p>
      </w:tc>

      <!-- Cột 2: PHẦN II -->
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="1650" w:type="pct"/>
          <w:tcBorders>
            <w:top w:val="single" w:sz="8" w:space="0" w:color="6EE7B7"/>
            <w:left w:val="single" w:sz="8" w:space="0" w:color="6EE7B7"/>
            <w:bottom w:val="single" w:sz="8" w:space="0" w:color="6EE7B7"/>
            <w:right w:val="single" w:sz="8" w:space="0" w:color="6EE7B7"/>
          </w:tcBorders>
          <w:shd w:val="clear" w:color="auto" w:fill="ECFDF5"/>
        </w:tcPr>
        ${buildStandardParagraphXml('PHẦN II (Đúng / Sai)', '', {
          prefixColorHex: '065F46',
          underlinePrefix: true,
          spaceAfterTwips: 80,
          fontSizeHalfPt: 24,
        })}
        ${p2InnerTableXml}
        <w:p><w:pPr><w:spacing w:before="0" w:after="20"/></w:pPr></w:p>
      </w:tc>

      <!-- Cột 3: PHẦN III -->
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="1600" w:type="pct"/>
          <w:tcBorders>
            <w:top w:val="single" w:sz="8" w:space="0" w:color="FCD34D"/>
            <w:left w:val="single" w:sz="8" w:space="0" w:color="FCD34D"/>
            <w:bottom w:val="single" w:sz="8" w:space="0" w:color="FCD34D"/>
            <w:right w:val="single" w:sz="8" w:space="0" w:color="FCD34D"/>
          </w:tcBorders>
          <w:shd w:val="clear" w:color="auto" w:fill="FFFBEB"/>
        </w:tcPr>
        ${buildStandardParagraphXml('PHẦN III (Trả lời ngắn)', '', {
          prefixColorHex: '78350F',
          underlinePrefix: true,
          spaceAfterTwips: 80,
          fontSizeHalfPt: 24,
        })}
        ${p3InnerTableXml}
        <w:p><w:pPr><w:spacing w:before="0" w:after="20"/></w:pPr></w:p>
      </w:tc>
    </w:tr>
  </w:tbl>`;
}

/**
 * Tạo block XML nhúng hình ảnh Mã QR (DrawingML Inline Image) vào cuối trang đáp án trong Word
 */
function buildEmbeddedQrDrawingXml(relId: string, examCode: string): string {
  const extentEmu = 1550000;
  return `<w:p>
    <w:pPr>
      <w:spacing w:before="140" w:after="100"/>
      <w:jc w:val="center"/>
    </w:pPr>
    <w:r>
      <w:drawing>
        <wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
          <wp:extent cx="${extentEmu}" cy="${extentEmu}"/>
          <wp:docPr id="101" name="QR_Code_${escapeXml(examCode)}"/>
          <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
              <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                <pic:nvPicPr>
                  <pic:cNvPr id="102" name="qr_${escapeXml(examCode)}.png"/>
                  <pic:cNvPicPr/>
                </pic:nvPicPr>
                <pic:blipFill>
                  <a:blip r:embed="${relId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
                  <a:stretch><a:fillRect/></a:stretch>
                </pic:blipFill>
                <pic:spPr>
                  <a:xfrm>
                    <a:off x="0" y="0"/>
                    <a:ext cx="${extentEmu}" cy="${extentEmu}"/>
                  </a:xfrm>
                  <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                </pic:spPr>
              </pic:pic>
            </a:graphicData>
          </a:graphic>
        </wp:inline>
      </w:drawing>
    </w:r>
  </w:p>`;
}

/**
 * Định dạng tên môn thi sang dạng chữ thường thanh lịch sư phạm (Ví dụ: SINH HỌC -> Sinh học)
 */
export function formatPedagogicalSubject(raw: string): string {
  if (!raw) return 'Sinh học';
  const clean = raw.trim();
  const lower = clean.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Tạo block XML nhúng hình ảnh/sơ đồ/đồ thị bài tập vào tệp Word:
 * - Bắt buộc hiển thị dạng In Line with Text (<wp:inline>) trên một dòng riêng biệt, căn giữa (<w:jc w:val="center"/>)
 * - Giữ nguyên 100% tỷ lệ khung hình gốc (aspect ratio) để không bị méo hình hay đè lên chữ khi trộn đề
 * - Gắn thẻ định danh [HINH_ANH_CAU_X] vào thuộc tính descr/name của đối tượng DrawingML
 */
function buildQuestionImageDrawingXml(
  relId: string,
  img: ExamImageAttachment,
  questionNumber: number
): string {
  // 1 Twip = 635 EMUs. Giới hạn chiều rộng tối đa ~5200 Twips (3,302,000 EMUs ~ 3.61 inch) để vừa đẹp khung trang A4
  const rawWTwips = img.widthTwips && img.widthTwips > 400 ? img.widthTwips : 4500;
  const aspect =
    img.aspectRatio && img.aspectRatio > 0.1
      ? img.aspectRatio
      : img.heightTwips && img.heightTwips > 300
      ? rawWTwips / img.heightTwips
      : 1.5;

  const clampedWTwips = Math.min(5400, Math.max(1800, rawWTwips));
  let clampedHTwips = Math.round(clampedWTwips / aspect);
  if (clampedHTwips > 4000) {
    clampedHTwips = 4000;
  }
  const finalWTwips = Math.round(clampedHTwips * aspect);

  const cx = finalWTwips * 635;
  const cy = clampedHTwips * 635;
  const tagLabel = img.tagId || `[HINH_ANH_CAU_${questionNumber}]`;
  const docPrId = Math.floor(Math.random() * 80000) + 1000;

  return `<w:p>
    <w:pPr>
      <w:keepNext/>
      <w:spacing w:before="80" w:after="100"/>
      <w:jc w:val="center"/>
    </w:pPr>
    <w:r>
      <w:drawing>
        <wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
          <wp:extent cx="${cx}" cy="${cy}"/>
          <wp:effectExtent l="0" t="0" r="0" b="0"/>
          <wp:docPr id="${docPrId}" name="${escapeXml(tagLabel)}" descr="${escapeXml(
    img.caption || tagLabel
  )}"/>
          <wp:cNvGraphicFramePr>
            <a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>
          </wp:cNvGraphicFramePr>
          <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
              <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                <pic:nvPicPr>
                  <pic:cNvPr id="${docPrId + 1}" name="img_${escapeXml(img.id)}.png" descr="${escapeXml(
    tagLabel
  )}"/>
                  <pic:cNvPicPr>
                    <a:picLocks noChangeAspect="1" noChangeArrowheads="1"/>
                  </pic:cNvPicPr>
                </pic:nvPicPr>
                <pic:blipFill>
                  <a:blip r:embed="${relId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
                  <a:stretch><a:fillRect/></a:stretch>
                </pic:blipFill>
                <pic:spPr bwMode="auto">
                  <a:xfrm>
                    <a:off x="0" y="0"/>
                    <a:ext cx="${cx}" cy="${cy}"/>
                  </a:xfrm>
                  <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                </pic:spPr>
              </pic:pic>
            </a:graphicData>
          </a:graphic>
        </wp:inline>
      </w:drawing>
    </w:r>
  </w:p>`;
}

/**
 * Chuyển đổi mọi định dạng ảnh (kể cả SVG và URI) sang dạng ảnh PNG chuẩn bitmap 300 DPI
 * để Microsoft Word / Office 365 hiển thị 100% hình vẽ, sơ đồ, đồ thị mà không bị ô vuông trắng hay báo lỗi.
 */
export async function convertImageToStandardPngDataUrl(dataUrl: string): Promise<string> {
  if (!dataUrl) return dataUrl;
  if (!dataUrl.startsWith('data:image/svg+xml') && dataUrl.startsWith('data:image/png;base64,')) {
    return dataUrl;
  }
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return dataUrl;
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const naturalW = img.naturalWidth || img.width || 800;
        const naturalH = img.naturalHeight || img.height || 600;
        // Đảm bảo độ nét cao >= 300 DPI (chiều ngang tối thiểu 1200px)
        const scale = naturalW < 1200 ? 1200 / naturalW : 1.0;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(naturalW * scale);
        canvas.height = Math.round(naturalH * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const png = canvas.toDataURL('image/png', 1.0);
        resolve(png);
      } catch (err) {
        console.warn('Could not rasterize image to PNG:', err);
        resolve(dataUrl);
      }
    };
    img.onerror = () => {
      resolve(dataUrl);
    };
    img.src = dataUrl;
  });
}

/**
 * Gom toàn bộ ảnh đính kèm từ danh sách câu hỏi và tạo bản đồ quan hệ rId (chuẩn hóa sang PNG 300 DPI)
 */
async function collectImagesAndBuildRelMap(questions: ExamQuestion[]): Promise<{
  imagesToEmbed: Array<{ relId: string; dataUrl: string; fileName: string }>;
  imageRelMap: Map<string, string>;
}> {
  const imagesToEmbed: Array<{ relId: string; dataUrl: string; fileName: string }> = [];
  const imageRelMap = new Map<string, string>();
  let imgIndex = 1;

  for (const q of questions) {
    if (q.images && q.images.length > 0) {
      for (const img of q.images) {
        if (!imageRelMap.has(img.id) && !imageRelMap.has(img.dataUrl)) {
          const relId = `rIdImg${imgIndex++}`;
          const pngDataUrl = await convertImageToStandardPngDataUrl(img.dataUrl);
          const fileName = `figure_${imgIndex - 1}.png`;
          imagesToEmbed.push({
            relId,
            dataUrl: pngDataUrl,
            fileName,
          });
          imageRelMap.set(img.id, relId);
          imageRelMap.set(img.dataUrl, relId);
        }
      }
    }
  }

  return { imagesToEmbed, imageRelMap };
}

/**
 * Tạo nội dung body XML cho 1 bộ câu hỏi:
 * - Bắt buộc dùng Times New Roman 12pt, canh trái (left), tự động co dãn đều đẹp mắt
 * - Công thức Toán/Lý xuất dưới dạng chuẩn Office Math (<m:oMath>)
 * - Ký hiệu Hóa học xuất chỉ số trên/dưới (<w:vertAlign>) và mũi tên phản ứng chuẩn
 * - Bảng dữ liệu / bảng ghép đôi xuất dưới dạng Word Table (<w:tbl>) giữ nguyên ô gộp & căn lề
 * - Hình ảnh / sơ đồ / đồ thị xuất dạng In Line with Text (<wp:inline>) căn giữa trên dòng riêng biệt
 */
function buildQuestionsBodyXml(
  questions: ExamQuestion[],
  config: ShuffleConfig,
  highlightCorrectAnswers: boolean,
  includeSolutions: boolean = false,
  imageRelMap?: Map<string, string>
): string {
  // Chạy Khâu kiểm duyệt cuối (Final Validation Gate) để vá rỗng & bảo toàn 100% công thức
  const cleanQuestions = runFinalValidationGateAndRepair(questions);

  const part1 = cleanQuestions.filter((q) => q.part === 'PART_1');
  const part2 = cleanQuestions.filter((q) => q.part === 'PART_2');
  const part3 = cleanQuestions.filter((q) => q.part === 'PART_3');

  const blocks: string[] = [];

  const appendQuestionTablesAndImages = (q: ExamQuestion) => {
    // 1. Nhúng bảng dữ liệu / bảng ghép đôi Cột A - Cột B thuộc phần dẫn câu hỏi (nếu có)
    if (q.stemTables && q.stemTables.length > 0) {
      for (const tbl of q.stemTables) {
        const tblXml = buildStructuredStemTableXml(tbl);
        if (tblXml) {
          blocks.push(tblXml);
        }
      }
    }
    // 2. Nhúng sơ đồ, phả hệ, đồ thị hàm số/dao động dạng In Line with Text căn giữa ngay dưới phần dẫn câu hỏi
    if (q.images && q.images.length > 0 && imageRelMap) {
      for (const img of q.images) {
        const rId = imageRelMap.get(img.id) || imageRelMap.get(img.dataUrl);
        if (rId) {
          blocks.push(buildQuestionImageDrawingXml(rId, img, q.displayIndex));
        }
      }
    }
  };

  if (part1.length > 0) {
    blocks.push(
      buildStandardParagraphXml(
        `PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn. `,
        `Thí sinh trả lời từ câu ${part1[0].displayIndex} đến câu ${part1[part1.length - 1].displayIndex}. Mỗi câu hỏi thí sinh chỉ chọn một phương án.`,
        { align: 'left', spaceBeforeTwips: 80, spaceAfterTwips: 120, fontSizeHalfPt: 24 }
      )
    );
    for (const q of part1) {
      blocks.push(
        buildStandardParagraphXml(`Câu ${q.displayIndex}. `, q.stemText, {
          keepNext: true,
          align: 'left',
          spaceAfterTwips: 60,
          fontSizeHalfPt: 24,
        })
      );
      appendQuestionTablesAndImages(q);

      if (q.options && q.options.length > 0) {
        const layout =
          config.layoutOverride === 'AUTO'
            ? q.computedLayout || '4_ROW_1_COL'
            : config.layoutOverride;
        blocks.push(
          buildPart1OptionsWithTabStopsXml(
            q.options,
            layout,
            highlightCorrectAnswers
          )
        );
      }
      if (includeSolutions && q.explanation) {
        blocks.push(
          buildStandardParagraphXml(`Lời giải chi tiết: `, q.explanation, {
            italicBody: true,
            prefixColorHex: '1D4ED8',
            align: 'left',
            spaceBeforeTwips: 40,
            spaceAfterTwips: 100,
            fontSizeHalfPt: 24,
          })
        );
      }
    }
  }

  if (part2.length > 0) {
    blocks.push(
      buildStandardParagraphXml(
        `PHẦN II. Câu trắc nghiệm đúng sai. `,
        `Thí sinh trả lời từ câu ${part2[0].displayIndex} đến câu ${part2[part2.length - 1].displayIndex}. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai.`,
        { align: 'left', spaceBeforeTwips: 120, spaceAfterTwips: 120, fontSizeHalfPt: 24 }
      )
    );
    for (const q of part2) {
      blocks.push(
        buildStandardParagraphXml(`Câu ${q.displayIndex}. `, q.stemText, {
          keepNext: true,
          align: 'left',
          spaceAfterTwips: 60,
          fontSizeHalfPt: 24,
        })
      );
      appendQuestionTablesAndImages(q);

      const subs = q.subItems || [];
      for (let sIdx = 0; sIdx < subs.length; sIdx++) {
        const sub = subs[sIdx];
        const isMarked = highlightCorrectAnswers && sub.isTrue;
        const isNotLast = sIdx < subs.length - 1;
        blocks.push(
          buildStandardParagraphXml(`${sub.currentLabel}) `, sub.text, {
            hangingIndent: true,
            keepNext: isNotLast,
            underlineBody: isMarked,
            redBody: isMarked,
            align: 'left',
            spaceAfterTwips: 60,
            fontSizeHalfPt: 24,
          })
        );
      }
      if (includeSolutions && q.explanation) {
        blocks.push(
          buildStandardParagraphXml(`Lời giải chi tiết: `, q.explanation, {
            italicBody: true,
            prefixColorHex: '047857',
            align: 'left',
            spaceBeforeTwips: 40,
            spaceAfterTwips: 100,
            fontSizeHalfPt: 24,
          })
        );
      }
    }
  }

  if (part3.length > 0) {
    blocks.push(
      buildStandardParagraphXml(
        `PHẦN III. Câu trắc nghiệm trả lời ngắn. `,
        `Thí sinh trả lời từ câu ${part3[0].displayIndex} đến câu ${part3[part3.length - 1].displayIndex}.`,
        { align: 'left', spaceBeforeTwips: 120, spaceAfterTwips: 120, fontSizeHalfPt: 24 }
      )
    );
    for (const q of part3) {
      blocks.push(
        buildStandardParagraphXml(`Câu ${q.displayIndex}. `, q.stemText, {
          keepNext: true,
          align: 'left',
          spaceAfterTwips: 60,
          fontSizeHalfPt: 24,
        })
      );
      appendQuestionTablesAndImages(q);

      if (highlightCorrectAnswers && q.shortAnswer) {
        blocks.push(
          buildStandardParagraphXml(`Đáp án: `, q.shortAnswer, {
            underlineBody: true,
            redBody: true,
            align: 'left',
            spaceAfterTwips: 100,
            fontSizeHalfPt: 24,
          })
        );
      }
      if (includeSolutions && q.explanation) {
        blocks.push(
          buildStandardParagraphXml(`Lời giải chi tiết: `, q.explanation, {
            italicBody: true,
            prefixColorHex: 'B45309',
            align: 'left',
            spaceBeforeTwips: 40,
            spaceAfterTwips: 100,
            fontSizeHalfPt: 24,
          })
        );
      }
    }
  }

  return blocks.join('\n');
}

/**
 * Tạo Footer Word (footer1.xml) có đánh Số Trang tự động (PAGE / NUMPAGES) và Số Mã Đề
 * Chuyển sang định dạng chữ thường đẹp & sư phạm (VD: “Môn: Sinh học — Lớp: 12 — Mã đề: 101”)
 * Tất cả dùng Times New Roman 12pt
 */
function buildFooterXml(
  config: ShuffleConfig,
  examCodeText: string
): string {
  const subjectLabel = formatPedagogicalSubject(config.subjectName);
  const cleanCode = examCodeText.replace(/^MÃ\s*ĐỀ[:\s]*/i, '').trim();
  const gradeLabel = (config.gradeLevel || '12').replace(/^lớp\s+/i, '').trim() || '12';
  const leftFooterText = `Môn: ${subjectLabel} — Lớp: ${gradeLabel} — Mã đề: ${cleanCode || examCodeText}`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p>
    <w:pPr>
      <w:pBdr>
        <w:top w:val="single" w:sz="6" w:space="4" w:color="94A3B8"/>
      </w:pBdr>
      <w:tabs>
        <w:tab w:val="right" w:pos="9026"/>
      </w:tabs>
      <w:jc w:val="left"/>
    </w:pPr>
    <w:r>
      <w:rPr>
        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
        <w:i/>
        <w:color w:val="334155"/>
        <w:sz w:val="24"/><w:szCs w:val="24"/>
      </w:rPr>
      <w:t xml:space="preserve">${escapeXml(leftFooterText)}</w:t>
    </w:r>
    <w:r>
      <w:rPr>
        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
        <w:sz w:val="24"/><w:szCs w:val="24"/>
      </w:rPr>
      <w:tab/>
      <w:t xml:space="preserve">Trang </w:t>
    </w:r>
    <w:fldSimple w:instr="PAGE">
      <w:r>
        <w:rPr>
          <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
          <w:b/>
          <w:sz w:val="24"/><w:szCs w:val="24"/>
        </w:rPr>
        <w:t>1</w:t>
      </w:r>
    </w:fldSimple>
    <w:r>
      <w:rPr>
        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
        <w:sz w:val="24"/><w:szCs w:val="24"/>
      </w:rPr>
      <w:t xml:space="preserve"> / </w:t>
    </w:r>
    <w:fldSimple w:instr="NUMPAGES">
      <w:r>
        <w:rPr>
          <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
          <w:b/>
          <w:sz w:val="24"/><w:szCs w:val="24"/>
        </w:rPr>
        <w:t>1</w:t>
      </w:r>
    </w:fldSimple>
  </w:p>
</w:ftr>`;
}

/**
 * Đóng gói một tệp Word (.docx) hoàn chỉnh chuẩn OpenXML (hỗ trợ Footer đánh số trang + Mã đề & Nhúng ảnh QR + Ảnh/Sơ đồ bài tập)
 */
async function packOpenXmlDocx(
  documentBodyInnerXml: string,
  config: ShuffleConfig,
  footerExamCodeLabel: string,
  embeddedQrDataUrl?: string,
  embeddedImages?: Array<{ relId: string; dataUrl: string; fileName: string }>
): Promise<Blob> {
  const zip = new JSZip();
  const hasQrImage = Boolean(embeddedQrDataUrl);
  const hasAnyImage = hasQrImage || (embeddedImages && embeddedImages.length > 0);

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  ${hasAnyImage ? '<Default Extension="png" ContentType="image/png"/>' : ''}
  ${hasAnyImage ? '<Default Extension="jpg" ContentType="image/jpeg"/>' : ''}
  ${hasAnyImage ? '<Default Extension="jpeg" ContentType="image/jpeg"/>' : ''}
  ${hasAnyImage ? '<Default Extension="gif" ContentType="image/gif"/>' : ''}
  ${hasAnyImage ? '<Default Extension="svg" ContentType="image/svg+xml"/>' : ''}
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
</Types>`
  );

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );

  const relsItems: string[] = [
    `<Relationship Id="rIdFooter1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>`,
  ];

  if (hasQrImage && embeddedQrDataUrl) {
    relsItems.push(
      `<Relationship Id="rIdQr1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/qrcode.png"/>`
    );
    zip.file('word/media/qrcode.png', dataUrlToUint8Array(embeddedQrDataUrl));
  }

  // Nhúng các ảnh minh họa, sơ đồ của đề thi
  if (embeddedImages && embeddedImages.length > 0) {
    for (const img of embeddedImages) {
      try {
        zip.file(`word/media/${img.fileName}`, dataUrlToUint8Array(img.dataUrl));
        relsItems.push(
          `<Relationship Id="${img.relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${img.fileName}"/>`
        );
      } catch (err) {
        console.warn('Không thể chuyển đổi dataUrl sang byte array cho ảnh:', img.fileName, err);
      }
    }
  }

  zip.file(
    'word/_rels/document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${relsItems.join('\n  ')}
</Relationships>`
  );

  zip.file('word/footer1.xml', buildFooterXml(config, footerExamCodeLabel));

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
            xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>
    ${documentBodyInnerXml}
    <w:sectPr>
      <w:footerReference w:type="default" r:id="rIdFooter1"/>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1417" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  zip.file('word/document.xml', documentXml);

  return zip.generateAsync({
    type: 'blob',
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

/**
 * Tiện ích 1: Xuất file đề gốc đã chuẩn hóa cấu trúc 2025 (không kèm lời giải cho học sinh làm thử)
 */
export async function exportCleanedMasterDocx(
  questions: ExamQuestion[],
  config: ShuffleConfig,
  includeSolutions: boolean = false
): Promise<Blob> {
  const { imagesToEmbed, imageRelMap } = await collectImagesAndBuildRelMap(questions);
  const headerXml = buildExamNationalHeaderTableXml(
    config,
    includeSolutions
      ? 'ĐỀ GỐC CÓ LỜI GIẢI CHI TIẾT (CHUẨN 2025)'
      : 'ĐỀ GỐC ĐÃ CHUẨN HÓA CẤU TRÚC 2025'
  );
  const bodyQuestionsXml = buildQuestionsBodyXml(
    questions,
    config,
    true,
    includeSolutions,
    imageRelMap
  );
  return packOpenXmlDocx(
    `${headerXml}\n${bodyQuestionsXml}`,
    config,
    'Đề gốc chuẩn 2025',
    undefined,
    imagesToEmbed
  );
}

/**
 * Tiện ích 2: Xuất riêng Đề Gốc CÓ LỜI GIẢI CHI TIẾT (.docx)
 * Dành riêng cho giáo viên lưu trữ và ban chấm thi (Thỏa mãn yêu cầu 2)
 */
export async function exportMasterExamWithSolutionsDocx(
  questions: ExamQuestion[],
  config: ShuffleConfig
): Promise<Blob> {
  const { imagesToEmbed, imageRelMap } = await collectImagesAndBuildRelMap(questions);
  const headerXml = buildExamNationalHeaderTableXml(
    config,
    'ĐỀ GỐC CÓ LỜI GIẢI CHI TIẾT (CHUẨN 2025)'
  );
  const bodyQuestionsXml = buildQuestionsBodyXml(
    questions,
    config,
    true,  // gạch chân / đỏ đáp án đúng
    true,  // in toàn bộ lời giải chi tiết
    imageRelMap
  );
  return packOpenXmlDocx(
    `${headerXml}\n${bodyQuestionsXml}`,
    config,
    'Đề gốc có lời giải',
    undefined,
    imagesToEmbed
  );
}

/**
 * Tiện ích 3: Xuất 1 tệp Đề thi hoán vị (.docx) DÀNH RIÊNG CHO HỌC SINH LÀM BÀI:
 * - BẮT BUỘC KHÔNG CÓ LỜI GIẢI & KHÔNG CÓ ĐÁP ÁN
 * - KHÔNG XUẤT KHUNG ĐÁP ÁN Ở CUỐI ĐỀ THI (Thỏa mãn yêu cầu 4)
 * - Tự động nhúng hình ảnh, sơ đồ sinh động
 * - Footer sư phạm chữ thường: “Môn: Sinh học — Lớp: 12 — Mã đề: 101”
 */
export async function exportSingleVariantDocx(
  variant: ShuffledVariant,
  config: ShuffleConfig
): Promise<Blob> {
  const { imagesToEmbed, imageRelMap } = await collectImagesAndBuildRelMap(variant.questions);
  const headerXml = buildExamNationalHeaderTableXml(
    config,
    `MÃ ĐỀ THI: ${variant.examCode}`
  );

  // Học sinh làm bài: highlightCorrectAnswers = false, includeSolutions = false
  const questionsXml = buildQuestionsBodyXml(
    variant.questions,
    config,
    false,
    false,
    imageRelMap
  );

  const footerEndXml = [
    buildStandardParagraphXml(
      '-------------------- HẾT --------------------',
      '',
      { align: 'center', spaceBeforeTwips: 160, spaceAfterTwips: 80, fontSizeHalfPt: 24 }
    ),
    buildStandardParagraphXml(
      '(Thí sinh không được sử dụng tài liệu. Cán bộ coi thi không giải thích gì thêm)',
      '',
      { align: 'center', italicBody: true, spaceAfterTwips: 160, fontSizeHalfPt: 24 }
    ),
  ].join('\n');

  // KHÔNG CÒN xuất khung đáp án ở cuối đề thi học sinh (Theo yêu cầu 4)
  const fullInnerXml = [headerXml, questionsXml, footerEndXml].join('\n');

  return packOpenXmlDocx(
    fullInnerXml,
    config,
    variant.examCode,
    undefined,
    imagesToEmbed
  );
}

/**
 * Xây dựng bảng ma trận đối chiếu đáp án đa mã đề chuẩn Khảo thí:
 * - Cực kỳ tiết kiệm diện tích (vừa vặn trên 1 trang A4)
 * - Xếp song song các mã đề (101, 102, 103, 104...) theo từng câu
 * - Phân nhóm màu sắc và kẻ viền chuyên nghiệp, giáo viên nhìn là đối chiếu được ngay lập tức, không bị rối mắt
 */
function buildCrossReferencingAnswerMatrixXml(variants: ShuffledVariant[]): string {
  if (!variants || variants.length === 0) return '';

  const numCols = variants.length + 1; // Cột 'Câu' + các cột Mã đề
  const col1Pct = 900;
  const otherColPct = Math.floor((5000 - col1Pct) / Math.max(1, variants.length));

  // --- HEADER ROW ---
  const headerCells = [
    `<w:tc>
      <w:tcPr>
        <w:tcW w:w="${col1Pct}" w:type="pct"/>
        <w:shd w:val="clear" w:color="auto" w:fill="1E3A8A"/>
        <w:vAlign w:val="center"/>
      </w:tcPr>
      <w:p>
        <w:pPr><w:jc w:val="center"/><w:spacing w:before="60" w:after="60"/></w:pPr>
        <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>CÂU</w:t></w:r>
      </w:p>
    </w:tc>`,
    ...variants.map((v) => `<w:tc>
      <w:tcPr>
        <w:tcW w:w="${otherColPct}" w:type="pct"/>
        <w:shd w:val="clear" w:color="auto" w:fill="0284C7"/>
        <w:vAlign w:val="center"/>
      </w:tcPr>
      <w:p>
        <w:pPr><w:jc w:val="center"/><w:spacing w:before="60" w:after="60"/></w:pPr>
        <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>MÃ ${escapeXml(v.examCode)}</w:t></w:r>
      </w:p>
    </w:tc>`),
  ].join('\n');

  const headerRowXml = `<w:tr><w:trPr><w:tblHeader/></w:trPr>${headerCells}</w:tr>`;

  // --- PHẦN I ---
  const maxP1 = Math.max(0, ...variants.map((v) => v.answerKey.part1.length));
  const p1RowsXml: string[] = [];
  if (maxP1 > 0) {
    p1RowsXml.push(`<w:tr>
      <w:tc>
        <w:tcPr>
          <w:gridSpan w:val="${numCols}"/>
          <w:shd w:val="clear" w:color="auto" w:fill="E0F2FE"/>
        </w:tcPr>
        <w:p>
          <w:pPr><w:jc w:val="left"/><w:spacing w:before="60" w:after="60"/></w:pPr>
          <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:color w:val="0369A1"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>PHẦN I. CÂU TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN (0.25 điểm / câu)</w:t></w:r>
        </w:p>
      </w:tc>
    </w:tr>`);

    for (let q = 1; q <= maxP1; q++) {
      const isEven = q % 2 === 0;
      const rowFill = isEven ? 'F8FAFC' : 'FFFFFF';
      const cells = [
        `<w:tc>
          <w:tcPr>
            <w:tcW w:w="${col1Pct}" w:type="pct"/>
            <w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/>
            <w:vAlign w:val="center"/>
          </w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:before="30" w:after="30"/></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:color w:val="0F172A"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>${q}</w:t></w:r>
          </w:p>
        </w:tc>`,
        ...variants.map((v) => {
          const item = v.answerKey.part1.find((x) => x.questionNumber === q);
          const ans = item ? item.answer : '—';
          return `<w:tc>
            <w:tcPr>
              <w:tcW w:w="${otherColPct}" w:type="pct"/>
              <w:shd w:val="clear" w:color="auto" w:fill="${rowFill}"/>
              <w:vAlign w:val="center"/>
            </w:tcPr>
            <w:p>
              <w:pPr><w:jc w:val="center"/><w:spacing w:before="30" w:after="30"/></w:pPr>
              <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:color w:val="DC2626"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t>${ans}</w:t></w:r>
            </w:p>
          </w:tc>`;
        }),
      ].join('\n');
      p1RowsXml.push(`<w:tr><w:trPr><w:cantSplit/></w:trPr>${cells}</w:tr>`);
    }
  }

  // --- PHẦN II ---
  const maxP2 = Math.max(0, ...variants.map((v) => v.answerKey.part2.length));
  const p2RowsXml: string[] = [];
  if (maxP2 > 0) {
    p2RowsXml.push(`<w:tr>
      <w:tc>
        <w:tcPr>
          <w:gridSpan w:val="${numCols}"/>
          <w:shd w:val="clear" w:color="auto" w:fill="ECFDF5"/>
        </w:tcPr>
        <w:p>
          <w:pPr><w:jc w:val="left"/><w:spacing w:before="60" w:after="60"/></w:pPr>
          <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:color w:val="065F46"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>PHẦN II. CÂU TRẮC NGHIỆM ĐÚNG SAI (Đúng 1 ý: 0.1đ; 2 ý: 0.25đ; 3 ý: 0.5đ; 4 ý: 1.0đ)</w:t></w:r>
        </w:p>
      </w:tc>
    </w:tr>`);

    for (let q = 1; q <= maxP2; q++) {
      const isEven = q % 2 === 0;
      const rowFill = isEven ? 'F0FDF4' : 'FFFFFF';
      const cells = [
        `<w:tc>
          <w:tcPr>
            <w:tcW w:w="${col1Pct}" w:type="pct"/>
            <w:shd w:val="clear" w:color="auto" w:fill="D1FAE5"/>
            <w:vAlign w:val="center"/>
          </w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:before="40" w:after="40"/></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:color w:val="065F46"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>Câu ${q}</w:t></w:r>
          </w:p>
        </w:tc>`,
        ...variants.map((v) => {
          const item = v.answerKey.part2.find((x) => x.questionNumber === q);
          const seq = item ? `${item.dsString} (${item.tfString})` : '—';
          return `<w:tc>
            <w:tcPr>
              <w:tcW w:w="${otherColPct}" w:type="pct"/>
              <w:shd w:val="clear" w:color="auto" w:fill="${rowFill}"/>
              <w:vAlign w:val="center"/>
            </w:tcPr>
            <w:p>
              <w:pPr><w:jc w:val="center"/><w:spacing w:before="40" w:after="40"/></w:pPr>
              <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:color w:val="047857"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>${seq}</w:t></w:r>
            </w:p>
          </w:tc>`;
        }),
      ].join('\n');
      p2RowsXml.push(`<w:tr><w:trPr><w:cantSplit/></w:trPr>${cells}</w:tr>`);
    }
  }

  // --- PHẦN III ---
  const maxP3 = Math.max(0, ...variants.map((v) => v.answerKey.part3.length));
  const p3RowsXml: string[] = [];
  if (maxP3 > 0) {
    p3RowsXml.push(`<w:tr>
      <w:tc>
        <w:tcPr>
          <w:gridSpan w:val="${numCols}"/>
          <w:shd w:val="clear" w:color="auto" w:fill="FFFBEB"/>
        </w:tcPr>
        <w:p>
          <w:pPr><w:jc w:val="left"/><w:spacing w:before="60" w:after="60"/></w:pPr>
          <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:color w:val="78350F"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>PHẦN III. CÂU TRẮC NGHIỆM TRẢ LỜI NGẮN (0.25 điểm / câu)</w:t></w:r>
        </w:p>
      </w:tc>
    </w:tr>`);

    for (let q = 1; q <= maxP3; q++) {
      const isEven = q % 2 === 0;
      const rowFill = isEven ? 'FEFCE8' : 'FFFFFF';
      const cells = [
        `<w:tc>
          <w:tcPr>
            <w:tcW w:w="${col1Pct}" w:type="pct"/>
            <w:shd w:val="clear" w:color="auto" w:fill="FEF3C7"/>
            <w:vAlign w:val="center"/>
          </w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:before="40" w:after="40"/></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:color w:val="92400E"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>Câu ${q}</w:t></w:r>
          </w:p>
        </w:tc>`,
        ...variants.map((v) => {
          const item = v.answerKey.part3.find((x) => x.questionNumber === q);
          const ans = item ? item.answer : '—';
          return `<w:tc>
            <w:tcPr>
              <w:tcW w:w="${otherColPct}" w:type="pct"/>
              <w:shd w:val="clear" w:color="auto" w:fill="${rowFill}"/>
              <w:vAlign w:val="center"/>
            </w:tcPr>
            <w:p>
              <w:pPr><w:jc w:val="center"/><w:spacing w:before="40" w:after="40"/></w:pPr>
              <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:color w:val="B45309"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>${ans}</w:t></w:r>
            </w:p>
          </w:tc>`;
        }),
      ].join('\n');
      p3RowsXml.push(`<w:tr><w:trPr><w:cantSplit/></w:trPr>${cells}</w:tr>`);
    }
  }

  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="5000" w:type="pct"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="10" w:space="0" w:color="1E3A8A"/>
        <w:left w:val="single" w:sz="10" w:space="0" w:color="1E3A8A"/>
        <w:bottom w:val="single" w:sz="10" w:space="0" w:color="1E3A8A"/>
        <w:right w:val="single" w:sz="10" w:space="0" w:color="1E3A8A"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
        <w:insideV w:val="single" w:sz="6" w:space="0" w:color="94A3B8"/>
      </w:tblBorders>
      <w:tblCellMar>
        <w:top w:w="30" w:type="dxa"/>
        <w:left w:w="50" w:type="dxa"/>
        <w:bottom w:w="30" w:type="dxa"/>
        <w:right w:w="50" w:type="dxa"/>
      </w:tblCellMar>
    </w:tblPr>
    ${headerRowXml}
    ${p1RowsXml.join('\n')}
    ${p2RowsXml.join('\n')}
    ${p3RowsXml.join('\n')}
  </w:tbl>`;
}

/**
 * Tiện ích 4: Xuất File BẢNG ĐÁP ÁN MA TRẬN ĐA MÃ ĐỀ NỘP KHẢO THÍ CHUẨN TRÊN 1 TRANG A4:
 * - Dạng Ma trận đối chiếu (Matrix Grid) song song các mã đề, cực kỳ gọn và không bị rối mắt
 * - Tích hợp Mã QR Tổng Hợp Đa Mã Đề (Master Multi-Exam QR Code) để GV quét 1 lần nạp đủ toàn bộ key
 * - Có sẵn khung chữ ký khảo thí & cán bộ coi thi, in nộp ngay không cần chỉnh sửa!
 */
export async function exportMasterAnswerSheetDocx(
  variants: ShuffledVariant[],
  config: ShuffleConfig
): Promise<Blob> {
  const headerXml = buildExamNationalHeaderTableXml(
    config,
    `BẢNG ĐÁP ÁN CHÍNH THỨC NỘP KHẢO THÍ (${variants.length} MÃ ĐỀ: ${variants.map((v) => v.examCode).join(', ')})`
  );

  const subHeadingXml = `<w:p>
    <w:pPr>
      <w:spacing w:before="80" w:after="60"/>
      <w:jc w:val="center"/>
    </w:pPr>
    <w:r>
      <w:rPr>
        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
        <w:b/>
        <w:color w:val="1E3A8A"/>
        <w:sz w:val="26"/><w:szCs w:val="26"/>
      </w:rPr>
      <w:t>BẢNG MA TRẬN ĐỐI CHIẾU ĐÁP ÁN CHẤM THI CÁC MÃ ĐỀ</w:t>
    </w:r>
  </w:p>`;

  // 1. Tạo bảng ma trận đối chiếu đa mã đề (Cross-Referencing Matrix)
  const matrixTableXml = buildCrossReferencingAnswerMatrixXml(variants);

  // 2. Tạo Mã QR Tổng Hợp Tất Cả Mã Đề (Master Multi-Exam QR Code)
  const { qrDataUrl: masterQrDataUrl } = await generateMasterMultiQrCode(variants, config);

  // 3. Khung hướng dẫn QR Tổng Hợp và nhúng QR
  const qrSectionXml = masterQrDataUrl
    ? `<w:p>
        <w:pPr>
          <w:spacing w:before="100" w:after="40"/>
          <w:jc w:val="center"/>
        </w:pPr>
        <w:r>
          <w:rPr>
            <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
            <w:b/>
            <w:color w:val="0F172A"/>
            <w:sz w:val="22"/><w:szCs w:val="22"/>
          </w:rPr>
          <w:t>MÃ QR TỔNG HỢP TOÀN BỘ ĐÁP ÁN (${variants.length} MÃ ĐỀ — QUÉT 1 LẦN NẠP ĐỦ KEY)</w:t>
        </w:r>
      </w:p>
      ${buildEmbeddedQrDrawingXml('rIdQr1', 'MASTER_MULTI_CODES')}
      <w:p>
        <w:pPr>
          <w:spacing w:before="20" w:after="80"/>
          <w:jc w:val="center"/>
        </w:pPr>
        <w:r>
          <w:rPr>
            <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
            <w:i/>
            <w:color w:val="475569"/>
            <w:sz w:val="20"/><w:szCs w:val="20"/>
          </w:rPr>
          <w:t>(Cán bộ chấm thi dùng ứng dụng quét mã QR để nhập tự động đáp án của tất cả các mã đề vào hệ thống)</w:t>
        </w:r>
      </w:p>`
    : '';

  // 4. Bảng chữ ký Khảo thí & Cán bộ chấm thi
  const signatureTableXml = `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="5000" w:type="pct"/>
      <w:tblBorders>
        <w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/>
        <w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/>
        <w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/>
        <w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/>
        <w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/>
        <w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/>
      </w:tblBorders>
      <w:tblCellMar>
        <w:top w:w="120" w:type="dxa"/>
        <w:left w:w="60" w:type="dxa"/>
        <w:bottom w:w="80" w:type="dxa"/>
        <w:right w:w="60" w:type="dxa"/>
      </w:tblCellMar>
    </w:tblPr>
    <w:tr>
      <w:tc>
        <w:tcPr><w:tcW w:w="2500" w:type="pct"/></w:tcPr>
        <w:p>
          <w:pPr><w:jc w:val="center"/></w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
              <w:b/>
              <w:sz w:val="24"/><w:szCs w:val="24"/>
            </w:rPr>
            <w:t>CÁN BỘ CHẤM THI 1</w:t>
          </w:r>
        </w:p>
        <w:p>
          <w:pPr><w:jc w:val="center"/></w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
              <w:i/>
              <w:color w:val="64748B"/>
              <w:sz w:val="20"/><w:szCs w:val="20"/>
            </w:rPr>
            <w:t>(Ký và ghi rõ họ tên)</w:t>
          </w:r>
        </w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="2500" w:type="pct"/></w:tcPr>
        <w:p>
          <w:pPr><w:jc w:val="center"/></w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
              <w:b/>
              <w:sz w:val="24"/><w:szCs w:val="24"/>
            </w:rPr>
            <w:t>CÁN BỘ CHẤM THI 2 / KHẢO THÍ</w:t>
          </w:r>
        </w:p>
        <w:p>
          <w:pPr><w:jc w:val="center"/></w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
              <w:i/>
              <w:color w:val="64748B"/>
              <w:sz w:val="20"/><w:szCs w:val="20"/>
            </w:rPr>
            <w:t>(Ký và ghi rõ họ tên)</w:t>
          </w:r>
        </w:p>
      </w:tc>
    </w:tr>
  </w:tbl>`;

  const fullInnerXml = `${headerXml}\n${subHeadingXml}\n${matrixTableXml}\n${qrSectionXml}\n${signatureTableXml}`;

  return packOpenXmlDocx(
    fullInnerXml,
    config,
    `Bảng đáp án ma trận (${variants.length} mã đề)`,
    masterQrDataUrl
  );
}

/**
 * Tiện ích 5: Xuất tệp Word (.docx) KHUNG MA TRẬN & BẢN ĐẶC TẢ ĐỀ KIỂM TRA ĐỊNH KỲ THEO CÔNG VĂN 7991/BGDĐT-GDTrH:
 * - Phụ lục 1: Khung ma trận kiểm tra định kỳ phân theo 3 phần thi & 3 cấp độ nhận thức (NB: 40%, TH: 30%, VD: 30%)
 * - Phụ lục 2: Bản đặc tả chuẩn GDPT 2018 với Yêu cầu cần đạt chi tiết
 * - Khung chữ ký Hiệu trưởng duyệt / Tổ trưởng chuyên môn / Giáo viên ra đề
 */
export async function exportMatrixAndSpecificationDocx(
  questions: ExamQuestion[],
  config: ShuffleConfig
): Promise<Blob> {
  const { matrixRows, specRows, summary } = buildCV7991MatrixAndSpecification(questions);

  const headerXml = buildExamNationalHeaderTableXml(
    config,
    'MA TRẬN & BẢN ĐẶC TẢ ĐỀ KIỂM TRA ĐỊNH KỲ (CV 7991/BGDĐT-GDTrH)'
  );

  const docTitleXml = `<w:p>
    <w:pPr><w:jc w:val="center"/><w:spacing w:before="120" w:after="40"/></w:pPr>
    <w:r>
      <w:rPr>
        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
        <w:b/>
        <w:color w:val="1E3A8A"/>
        <w:sz w:val="26"/><w:szCs w:val="26"/>
      </w:rPr>
      <w:t>KHUNG MA TRẬN VÀ BẢN ĐẶC TẢ ĐỀ KIỂM TRA ĐỊNH KỲ</w:t>
    </w:r>
  </w:p>
  <w:p>
    <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="100"/></w:pPr>
    <w:r>
      <w:rPr>
        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
        <w:i/>
        <w:color w:val="334155"/>
        <w:sz w:val="22"/><w:szCs w:val="22"/>
      </w:rPr>
      <w:t>Môn: ${escapeXml(config.subjectName)} — ${escapeXml(config.gradeLevel || 'Lớp 12')} — Thời gian làm bài: ${config.durationMinutes} phút</w:t>
    </w:r>
    <w:r><w:br/></w:r>
    <w:r>
      <w:rPr>
        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
        <w:i/>
        <w:color w:val="64748B"/>
        <w:sz w:val="20"/><w:szCs w:val="20"/>
      </w:rPr>
      <w:t>(Xây dựng theo chuẩn Công văn số 7991/BGDĐT-GDTrH ngày 20/12/2024 của Bộ GD&ĐT)</w:t>
    </w:r>
  </w:p>`;

  // 1. PHỤ LỤC 1: KHUNG MA TRẬN ĐỀ KIỂM TRA
  const sec1Heading = `<w:p>
    <w:pPr><w:jc w:val="left"/><w:spacing w:before="120" w:after="60"/></w:pPr>
    <w:r>
      <w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:color w:val="0369A1"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
      <w:t>I. KHUNG MA TRẬN ĐỀ KIỂM TRA ĐỊNH KỲ (PHỤ LỤC 1 — CV 7991)</w:t>
    </w:r>
  </w:p>`;

  // Bảng Khung Ma trận
  const matrixHeaderRow = `<w:tr>
    <w:trPr><w:tblHeader/></w:trPr>
    <w:tc><w:tcPr><w:tcW w:w="300" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="0284C7"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="20"/></w:rPr><w:t>TT</w:t></w:r></w:p></w:tc>
    <w:tc><w:tcPr><w:tcW w:w="1200" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="0284C7"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="20"/></w:rPr><w:t>Chủ đề / Đơn vị kiến thức</w:t></w:r></w:p></w:tc>
    <w:tc><w:tcPr><w:tcW w:w="900" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="0284C7"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="20"/></w:rPr><w:t>Phần I (Nhiều LC)\nNB - TH - VD</w:t></w:r></w:p></w:tc>
    <w:tc><w:tcPr><w:tcW w:w="900" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="0284C7"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="20"/></w:rPr><w:t>Phần II (Đúng/Sai)\nNB - TH - VD</w:t></w:r></w:p></w:tc>
    <w:tc><w:tcPr><w:tcW w:w="900" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="0284C7"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="20"/></w:rPr><w:t>Phần III (Trả lời ngắn)\nNB - TH - VD</w:t></w:r></w:p></w:tc>
    <w:tc><w:tcPr><w:tcW w:w="400" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="0284C7"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="20"/></w:rPr><w:t>Tổng câu</w:t></w:r></w:p></w:tc>
    <w:tc><w:tcPr><w:tcW w:w="400" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="0284C7"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="20"/></w:rPr><w:t>Điểm số</w:t></w:r></w:p></w:tc>
  </w:tr>`;

  const matrixBodyRows = matrixRows
    .map(
      (r, idx) => `<w:tr>
        <w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="${idx % 2 === 0 ? 'F8FAFC' : 'FFFFFF'}"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>${r.tt}</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="${idx % 2 === 0 ? 'F8FAFC' : 'FFFFFF'}"/></w:tcPr><w:p><w:pPr><w:jc w:val="left"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t>${escapeXml(r.unit)}</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="${idx % 2 === 0 ? 'F8FAFC' : 'FFFFFF'}"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>${r.p1NhanBiet} - ${r.p1ThongHieu} - ${r.p1VanDung}</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="${idx % 2 === 0 ? 'F8FAFC' : 'FFFFFF'}"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>${r.p2NhanBiet} - ${r.p2ThongHieu} - ${r.p2VanDung}</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="${idx % 2 === 0 ? 'F8FAFC' : 'FFFFFF'}"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>${r.p3NhanBiet} - ${r.p3ThongHieu} - ${r.p3VanDung}</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="${idx % 2 === 0 ? 'F8FAFC' : 'FFFFFF'}"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t>${r.totalQuestionsOrCommands}</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="${idx % 2 === 0 ? 'F8FAFC' : 'FFFFFF'}"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="DC2626"/><w:sz w:val="20"/></w:rPr><w:t>${r.totalScore} đ</w:t></w:r></w:p></w:tc>
      </w:tr>`
    )
    .join('\n');

  const matrixTotalRow = `<w:tr>
    <w:tc><w:tcPr><w:gridSpan w:val="2"/><w:shd w:val="clear" w:color="auto" w:fill="E2E8F0"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t>TỔNG CỘNG TOÀN ĐỀ</w:t></w:r></w:p></w:tc>
    <w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="E2E8F0"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t>${summary.totalP1} câu (4.5đ)</w:t></w:r></w:p></w:tc>
    <w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="E2E8F0"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t>${summary.totalP2Questions} câu (${summary.totalP2Commands} ý - 4.0đ)</w:t></w:r></w:p></w:tc>
    <w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="E2E8F0"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t>${summary.totalP3} câu (1.5đ)</w:t></w:r></w:p></w:tc>
    <w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="E2E8F0"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t>${questions.length}</w:t></w:r></w:p></w:tc>
    <w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="E2E8F0"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="DC2626"/><w:sz w:val="22"/></w:rPr><w:t>10.0 đ</w:t></w:r></w:p></w:tc>
  </w:tr>`;

  const matrixTableXml = `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="5000" w:type="pct"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="6" w:space="0" w:color="475569"/>
        <w:left w:val="single" w:sz="6" w:space="0" w:color="475569"/>
        <w:bottom w:val="single" w:sz="6" w:space="0" w:color="475569"/>
        <w:right w:val="single" w:sz="6" w:space="0" w:color="475569"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
      </w:tblBorders>
      <w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="60" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="60" w:type="dxa"/></w:tblCellMar>
    </w:tblPr>
    ${matrixHeaderRow}
    ${matrixBodyRows}
    ${matrixTotalRow}
  </w:tbl>`;

  // 2. PHỤ LỤC 2: BẢN ĐẶC TẢ ĐỀ KIỂM TRA ĐỊNH KỲ
  const sec2Heading = `<w:p>
    <w:pPr><w:jc w:val="left"/><w:spacing w:before="160" w:after="60"/></w:pPr>
    <w:r>
      <w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:color w:val="0369A1"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
      <w:t>II. BẢN ĐẶC TẢ ĐỀ KIỂM TRA ĐỊNH KỲ (PHỤ LỤC 2 — CV 7991)</w:t>
    </w:r>
  </w:p>`;

  const specHeaderRow = `<w:tr>
    <w:trPr><w:tblHeader/></w:trPr>
    <w:tc><w:tcPr><w:tcW w:w="300" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="065F46"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="20"/></w:rPr><w:t>TT</w:t></w:r></w:p></w:tc>
    <w:tc><w:tcPr><w:tcW w:w="1100" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="065F46"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="20"/></w:rPr><w:t>Đơn vị kiến thức / Kĩ năng</w:t></w:r></w:p></w:tc>
    <w:tc><w:tcPr><w:tcW w:w="600" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="065F46"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="20"/></w:rPr><w:t>Mức độ</w:t></w:r></w:p></w:tc>
    <w:tc><w:tcPr><w:tcW w:w="2100" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="065F46"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="20"/></w:rPr><w:t>Yêu cầu cần đạt (chuẩn GDPT 2018)</w:t></w:r></w:p></w:tc>
    <w:tc><w:tcPr><w:tcW w:w="300" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="065F46"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="20"/></w:rPr><w:t>P.I</w:t></w:r></w:p></w:tc>
    <w:tc><w:tcPr><w:tcW w:w="300" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="065F46"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="20"/></w:rPr><w:t>P.II</w:t></w:r></w:p></w:tc>
    <w:tc><w:tcPr><w:tcW w:w="300" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="065F46"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="20"/></w:rPr><w:t>P.III</w:t></w:r></w:p></w:tc>
  </w:tr>`;

  const specBodyRows = specRows
    .map(
      (s, idx) => `<w:tr>
        <w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="${idx % 2 === 0 ? 'F0FDF4' : 'FFFFFF'}"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>${s.tt}</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="${idx % 2 === 0 ? 'F0FDF4' : 'FFFFFF'}"/></w:tcPr><w:p><w:pPr><w:jc w:val="left"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t>${escapeXml(s.unit)}</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="${idx % 2 === 0 ? 'F0FDF4' : 'FFFFFF'}"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="${s.cognitiveLevel === 'Nhận biết' ? '0284C7' : s.cognitiveLevel === 'Thông hiểu' ? '059669' : 'D97706'}"/><w:sz w:val="20"/></w:rPr><w:t>${s.cognitiveLevel}</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="${idx % 2 === 0 ? 'F0FDF4' : 'FFFFFF'}"/></w:tcPr><w:p><w:pPr><w:jc w:val="both"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>${escapeXml(s.learningOutcomes.join(' '))}</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="${idx % 2 === 0 ? 'F0FDF4' : 'FFFFFF'}"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>${s.p1Count || '—'}</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="${idx % 2 === 0 ? 'F0FDF4' : 'FFFFFF'}"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>${s.p2CommandCount || '—'}</w:t></w:r></w:p></w:tc>
        <w:tc><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="${idx % 2 === 0 ? 'F0FDF4' : 'FFFFFF'}"/></w:tcPr><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>${s.p3Count || '—'}</w:t></w:r></w:p></w:tc>
      </w:tr>`
    )
    .join('\n');

  const specTableXml = `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="5000" w:type="pct"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="6" w:space="0" w:color="475569"/>
        <w:left w:val="single" w:sz="6" w:space="0" w:color="475569"/>
        <w:bottom w:val="single" w:sz="6" w:space="0" w:color="475569"/>
        <w:right w:val="single" w:sz="6" w:space="0" w:color="475569"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
      </w:tblBorders>
      <w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="60" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="60" w:type="dxa"/></w:tblCellMar>
    </w:tblPr>
    ${specHeaderRow}
    ${specBodyRows}
  </w:tbl>`;

  // 3. Khung chữ ký phê duyệt 3 bên: BGH duyệt / Tổ trưởng chuyên môn / Giáo viên ra đề
  const signXml = `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="5000" w:type="pct"/>
      <w:tblBorders>
        <w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/>
        <w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/>
        <w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/>
        <w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/>
        <w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/>
        <w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/>
      </w:tblBorders>
      <w:tblCellMar><w:top w:w="120" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/></w:tblCellMar>
    </w:tblPr>
    <w:tr>
      <w:tc>
        <w:tcPr><w:tcW w:w="1700" w:type="pct"/></w:tcPr>
        <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="22"/></w:rPr><w:t>HIỆU TRƯỞNG / BGH DUYỆT</w:t></w:r></w:p>
        <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:i/><w:color w:val="64748B"/><w:sz w:val="20"/></w:rPr><w:t>(Ký, đóng dấu)</w:t></w:r></w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="1650" w:type="pct"/></w:tcPr>
        <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="22"/></w:rPr><w:t>TỔ TRƯỞNG CHUYÊN MÔN</w:t></w:r></w:p>
        <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:i/><w:color w:val="64748B"/><w:sz w:val="20"/></w:rPr><w:t>(Ký và ghi rõ họ tên)</w:t></w:r></w:p>
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="1650" w:type="pct"/></w:tcPr>
        <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="22"/></w:rPr><w:t>GIÁO VIÊN RA ĐỀ</w:t></w:r></w:p>
        <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:i/><w:color w:val="64748B"/><w:sz w:val="20"/></w:rPr><w:t>(Ký và ghi rõ họ tên)</w:t></w:r></w:p>
      </w:tc>
    </w:tr>
  </w:tbl>`;

  const fullInnerXml = `${headerXml}\n${docTitleXml}\n${sec1Heading}\n${matrixTableXml}\n${sec2Heading}\n${specTableXml}\n${signXml}`;

  return packOpenXmlDocx(
    fullInnerXml,
    config,
    'Ma trận & Bản đặc tả CV 7991'
  );
}

/**
 * Định dạng ngày tháng chuẩn dd-mm-yy theo yêu cầu đặt tên tệp xuất ra đồng nhất (dd/mm/yy)
 */
export function getFormattedDateDdMmYy(date: Date = new Date()): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(-2);
  return `${dd}-${mm}-${yy}`;
}

export function getFormattedDateMmDdYy(date: Date = new Date()): string {
  return getFormattedDateDdMmYy(date);
}

function cleanFileSegment(raw: string): string {
  return (raw || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Tạo chuỗi tên tệp chuẩn: Môn:... Lớp:... Kỳ kiểm tra:... dd/mm/yy (dùng dấu - an toàn cho Windows/Mac/Linux)
 * Ví dụ: Môn Toán học & KHTN - Lớp 12 - Kỳ kiểm tra Cuối học kì 1 - 30-10-26 - Mã đề 101.docx
 */
export function buildStandardExportFileName(
  config: ShuffleConfig,
  extension: 'docx' | 'zip' | 'csv' | 'png' | 'txt',
  suffix?: string
): string {
  const subjectPart = cleanFileSegment(config.subjectName || 'Toán học & KHTN');
  const rawGrade = cleanFileSegment(config.gradeLevel || 'Lớp 12');
  const gradePart = /^lớp\s+/i.test(rawGrade) ? rawGrade : `Lớp ${rawGrade}`;
  const examPart = cleanFileSegment(config.examTitle || 'Kỳ kiểm tra');
  const datePart = getFormattedDateDdMmYy();

  const baseName = `Môn ${subjectPart} - ${gradePart} - Kỳ kiểm tra ${examPart} - ${datePart}`;
  const extra = suffix ? ` - ${cleanFileSegment(suffix)}` : '';
  return `${baseName}${extra}.${extension}`;
}

export async function exportAllVariantsZipBundle(
  variants: ShuffledVariant[],
  masterQuestions: ExamQuestion[],
  config: ShuffleConfig
): Promise<Blob> {
  const bundleZip = new JSZip();

  // 1. Lưu file đề gốc chuẩn
  const masterCleanBlob = await exportCleanedMasterDocx(masterQuestions, config, false);
  bundleZip.file(
    buildStandardExportFileName(config, 'docx', 'Đề gốc chuẩn'),
    masterCleanBlob
  );

  // 2. Lưu file Bảng đáp án ma trận khảo thí (A4)
  const masterAnswerDocxBlob = await exportMasterAnswerSheetDocx(variants, config);
  bundleZip.file(
    buildStandardExportFileName(config, 'docx', 'Bảng đáp án khảo thí ma trận'),
    masterAnswerDocxBlob
  );

  // 3. Lưu file Ma Trận & Bản Đặc Tả theo chuẩn Công văn 7991/BGDĐT-GDTrH
  try {
    const matrixDocxBlob = await exportMatrixAndSpecificationDocx(masterQuestions, config);
    bundleZip.file(
      buildStandardExportFileName(config, 'docx', 'Ma trận và Bản đặc tả CV 7991'),
      matrixDocxBlob
    );
  } catch (err) {
    console.warn('Không thể xuất kèm Ma trận CV 7991 vào zip:', err);
  }

  // 4. Lưu từng file đề hoán vị cho học sinh (BẮT BUỘC KHÔNG LỜI GIẢI, KHÔNG KHUNG ĐÁP ÁN Ở CUỐI)
  const deThiFolder = bundleZip.folder('Bo_De_Thi_Hoc_Sinh_Docx');
  const qrFolder = bundleZip.folder('Ma_QR_Cham_Thi_PNG');

  for (const v of variants) {
    const docxBlob = await exportSingleVariantDocx(v, config);
    deThiFolder?.file(
      buildStandardExportFileName(config, 'docx', `Mã đề ${v.examCode}`),
      docxBlob
    );

    if (v.qrDataUrl) {
      const pngBytes = dataUrlToUint8Array(v.qrDataUrl);
      qrFolder?.file(
        buildStandardExportFileName(config, 'png', `QR-Mã đề ${v.examCode}`),
        pngBytes
      );
    }
  }

  // 5. Lưu ảnh Mã QR Tổng Hợp Tất Cả Mã Đề (Master Multi-Exam QR Code)
  try {
    const { qrDataUrl: masterQrDataUrl } = await generateMasterMultiQrCode(variants, config);
    if (masterQrDataUrl) {
      const masterQrBytes = dataUrlToUint8Array(masterQrDataUrl);
      qrFolder?.file(
        buildStandardExportFileName(config, 'png', 'QR Tổng Hợp Tất Cả Mã Đề'),
        masterQrBytes
      );
    }
  } catch (err) {
    console.warn('Không thể lưu ảnh QR tổng hợp vào zip:', err);
  }

  // 6. Tạo file CSV tổng hợp key chấm thi
  const csvLines: string[] = [
    'Ma_De,Phan_I_ABCD,Phan_II_DungSai,Phan_III_TraLoiNgan,QR_Payload',
  ];
  for (const v of variants) {
    const p1 = v.answerKey.part1.map((x) => `${x.questionNumber}${x.answer}`).join(' ');
    const p2 = v.answerKey.part2.map((x) => `${x.questionNumber}:${x.dsString}(${x.tfString})`).join(' ');
    const p3 = v.answerKey.part3.map((x) => `${x.questionNumber}=${x.answer}`).join(' ');
    csvLines.push(`"${v.examCode}","${p1}","${p2}","${p3}","${v.qrPayload}"`);
  }
  bundleZip.file(
    buildStandardExportFileName(config, 'csv', 'Bảng đáp án tổng hợp'),
    '\uFEFF' + csvLines.join('\n')
  );

  return bundleZip.generateAsync({ type: 'blob' });
}

/**
 * Tiện ích 5: Tải riêng bộ ảnh Mã QR (.zip)
 */
export async function exportQrCodesZip(
  variants: ShuffledVariant[],
  config: ShuffleConfig
): Promise<Blob> {
  const qrZip = new JSZip();
  const lines: string[] = [];

  for (const v of variants) {
    if (v.qrDataUrl) {
      qrZip.file(
        buildStandardExportFileName(config, 'png', `QR-Mã đề ${v.examCode}`),
        dataUrlToUint8Array(v.qrDataUrl)
      );
    }
    lines.push(v.qrPayload);
  }

  qrZip.file(
    buildStandardExportFileName(config, 'txt', 'Payload-QR'),
    lines.join('\n')
  );
  return qrZip.generateAsync({ type: 'blob' });
}

/**
 * Tiện ích 6: Đóng gói trọn bộ 4 Đề AI Tương Đương thành 1 file .ZIP
 */
export async function exportFourAiClonesZipBundle(
  aiVariants: Array<{ examCode: string; title: string; questions: ExamQuestion[] }>,
  config: ShuffleConfig
): Promise<Blob> {
  const aiZip = new JSZip();
  const folderStudent = aiZip.folder('Bo_De_AI_Tuong_Duong_Docx');

  for (const v of aiVariants) {
    const studentBlob = await exportCleanedMasterDocx(
      v.questions,
      {
        ...config,
        examSubtitle: `${v.title.toUpperCase()} — MÃ ĐỀ: ${v.examCode}`,
      },
      false
    );
    folderStudent?.file(
      buildStandardExportFileName(config, 'docx', `${v.examCode}`),
      studentBlob
    );
  }

  return aiZip.generateAsync({ type: 'blob' });
}

/**
 * Helper kích hoạt tải file trên trình duyệt
 */
export function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

