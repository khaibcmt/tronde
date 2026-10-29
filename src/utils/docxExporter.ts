import JSZip from 'jszip';
import {
  ExamQuestion,
  OptionPart1,
  ShuffleConfig,
  ShuffledVariant,
} from '../types/exam';

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] || '';
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Tạo đoạn văn bản Word chuẩn Typography:
 * - Bắt buộc Font Times New Roman kích cỡ 12pt (24 half-points)
 * - Canh trái (left) hoặc theo tùy chọn, tự động co dãn đều đẹp mắt
 * - Giãn dòng chuẩn Line spacing: 1.15 (w:line="276")
 * - Khoảng cách câu Spacing After: 6pt (w:after="120")
 */
function buildStandardParagraphXml(
  boldPrefix: string,
  bodyText: string,
  options?: {
    hangingIndent?: boolean;
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
  const spaceBefore = options?.spaceBeforeTwips ?? 0;
  const spaceAfter = options?.spaceAfterTwips ?? 100; // 5pt
  const fontSize = options?.fontSizeHalfPt ?? 24; // 12pt = 24 half-points
  const indXml = options?.hangingIndent
    ? `<w:ind w:left="360" w:hanging="360"/>`
    : '';

  const prefixColor = options?.prefixColorHex
    ? `<w:color w:val="${options.prefixColorHex}"/>`
    : options?.redBody
    ? '<w:color w:val="FF0000"/>'
    : '';

  const bodyColor = options?.bodyColorHex
    ? `<w:color w:val="${options.bodyColorHex}"/>`
    : options?.redBody
    ? '<w:color w:val="FF0000"/>'
    : '';

  const bodyRPrParts: string[] = [
    `<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>`,
    `<w:sz w:val="${fontSize}"/><w:szCs w:val="${fontSize}"/>`,
  ];
  if (options?.boldBody) {
    bodyRPrParts.push(`<w:b/>`);
  }
  if (options?.italicBody) {
    bodyRPrParts.push(`<w:i/>`);
  }
  if (options?.underlineBody) {
    bodyRPrParts.push(`<w:u w:val="single"/>`);
  }
  if (bodyColor) {
    bodyRPrParts.push(bodyColor);
  }

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

  const bodyRunXml = bodyText
    ? `<w:r>
        <w:rPr>${bodyRPrParts.join('')}</w:rPr>
        <w:t xml:space="preserve">${escapeXml(bodyText)}</w:t>
      </w:r>`
    : '';

  return `<w:p>
    <w:pPr>
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
 * Tạo Bảng ẩn không viền (Invisible Borderless Table) cho các phương án Phần I
 * - Bắt buộc: Times New Roman 12pt, canh trái (left), tự động co dãn đều cột (25% cho 4 cột, 50% cho 2 cột, 100% cho 1 cột)
 */
function buildInvisibleOptionsTableXml(
  options: OptionPart1[],
  layout: '1_ROW_4_COL' | '2_ROW_2_COL' | '4_ROW_1_COL',
  highlightCorrect: boolean
): string {
  const renderCell = (opt: OptionPart1, widthPct: number) => {
    const isMarked = highlightCorrect && opt.isCorrect;
    const pXml = buildStandardParagraphXml(
      `${opt.currentLabel}. `,
      opt.text,
      {
        hangingIndent: true,
        underlineBody: isMarked,
        redBody: isMarked,
        align: 'left',
        spaceAfterTwips: 60,
        fontSizeHalfPt: 24,
      }
    );
    return `<w:tc>
      <w:tcPr>
        <w:tcW w:w="${widthPct}" w:type="pct"/>
        <w:tcBorders>
          <w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/>
          <w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/>
        </w:tcBorders>
      </w:tcPr>
      ${pXml}
    </w:tc>`;
  };

  let rowsXml = '';
  if (layout === '1_ROW_4_COL') {
    const cells = options.map((opt) => renderCell(opt, 1250)).join('');
    rowsXml = `<w:tr>${cells}</w:tr>`;
  } else if (layout === '2_ROW_2_COL') {
    const row1 = options.slice(0, 2).map((opt) => renderCell(opt, 2500)).join('');
    const row2 = options.slice(2, 4).map((opt) => renderCell(opt, 2500)).join('');
    rowsXml = `<w:tr>${row1}</w:tr><w:tr>${row2}</w:tr>`;
  } else {
    rowsXml = options
      .map((opt) => `<w:tr>${renderCell(opt, 5000)}</w:tr>`)
      .join('');
  }

  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="5000" w:type="pct"/>
      <w:tblLayout w:type="autofit"/>
      <w:tblBorders>
        <w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/>
        <w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/>
        <w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/>
        <w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/>
        <w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/>
        <w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/>
      </w:tblBorders>
      <w:tblCellMar>
        <w:top w:w="20" w:type="dxa"/>
        <w:left w:w="60" w:type="dxa"/>
        <w:bottom w:w="20" w:type="dxa"/>
        <w:right w:w="60" w:type="dxa"/>
      </w:tblCellMar>
    </w:tblPr>
    ${rowsXml}
  </w:tbl>`;
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
 * Tạo block XML nhúng hình ảnh/sơ đồ bài tập vào tệp Word
 */
function buildQuestionImageDrawingXml(relId: string, imgId: string): string {
  const cx = 3600000; // ~3.93 inches
  const cy = 2400000; // ~2.62 inches
  return `<w:p>
    <w:pPr>
      <w:spacing w:before="80" w:after="100"/>
      <w:jc w:val="center"/>
    </w:pPr>
    <w:r>
      <w:drawing>
        <wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
          <wp:extent cx="${cx}" cy="${cy}"/>
          <wp:docPr id="${Math.floor(Math.random() * 80000) + 1000}" name="Diagram_${escapeXml(imgId)}"/>
          <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
              <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                <pic:nvPicPr>
                  <pic:cNvPr id="${Math.floor(Math.random() * 80000) + 1000}" name="img_${escapeXml(imgId)}.png"/>
                  <pic:cNvPicPr/>
                </pic:nvPicPr>
                <pic:blipFill>
                  <a:blip r:embed="${relId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
                  <a:stretch><a:fillRect/></a:stretch>
                </pic:blipFill>
                <pic:spPr>
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
 * Gom toàn bộ ảnh đính kèm từ danh sách câu hỏi và tạo bản đồ quan hệ rId
 */
function collectImagesAndBuildRelMap(questions: ExamQuestion[]): {
  imagesToEmbed: Array<{ relId: string; dataUrl: string; fileName: string }>;
  imageRelMap: Map<string, string>;
} {
  const imagesToEmbed: Array<{ relId: string; dataUrl: string; fileName: string }> = [];
  const imageRelMap = new Map<string, string>();
  let imgIndex = 1;

  for (const q of questions) {
    if (q.images && q.images.length > 0) {
      for (const img of q.images) {
        if (!imageRelMap.has(img.id) && !imageRelMap.has(img.dataUrl)) {
          const relId = `rIdImg${imgIndex++}`;
          const ext = img.fileName?.split('.').pop()?.toLowerCase() || 'png';
          const safeExt = ['jpg', 'jpeg', 'gif', 'png', 'svg'].includes(ext) ? ext : 'png';
          const fileName = `figure_${imgIndex - 1}.${safeExt}`;
          imagesToEmbed.push({
            relId,
            dataUrl: img.dataUrl,
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
 * - Cho phép bật/tắt hiển thị Lời giải chi tiết độc lập
 * - Tự động nhúng hình ảnh, sơ đồ minh họa đi kèm câu hỏi
 */
function buildQuestionsBodyXml(
  questions: ExamQuestion[],
  config: ShuffleConfig,
  highlightCorrectAnswers: boolean,
  includeSolutions: boolean = false,
  imageRelMap?: Map<string, string>
): string {
  const part1 = questions.filter((q) => q.part === 'PART_1');
  const part2 = questions.filter((q) => q.part === 'PART_2');
  const part3 = questions.filter((q) => q.part === 'PART_3');
  const part4 = questions.filter((q) => q.part === 'PART_4');

  const blocks: string[] = [];

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
          align: 'left',
          spaceAfterTwips: 60,
          fontSizeHalfPt: 24,
        })
      );
      // Nhúng ảnh / sơ đồ câu hỏi nếu có
      if (q.images && q.images.length > 0 && imageRelMap) {
        for (const img of q.images) {
          const rId = imageRelMap.get(img.id) || imageRelMap.get(img.dataUrl);
          if (rId) {
            blocks.push(buildQuestionImageDrawingXml(rId, img.id));
          }
        }
      }
      if (q.options && q.options.length > 0) {
        const layout =
          config.layoutOverride === 'AUTO'
            ? q.computedLayout || '4_ROW_1_COL'
            : config.layoutOverride;
        blocks.push(
          buildInvisibleOptionsTableXml(
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
          align: 'left',
          spaceAfterTwips: 60,
          fontSizeHalfPt: 24,
        })
      );
      // Nhúng ảnh / sơ đồ câu hỏi nếu có
      if (q.images && q.images.length > 0 && imageRelMap) {
        for (const img of q.images) {
          const rId = imageRelMap.get(img.id) || imageRelMap.get(img.dataUrl);
          if (rId) {
            blocks.push(buildQuestionImageDrawingXml(rId, img.id));
          }
        }
      }
      for (const sub of q.subItems || []) {
        const isMarked = highlightCorrectAnswers && sub.isTrue;
        blocks.push(
          buildStandardParagraphXml(`${sub.currentLabel}) `, sub.text, {
            hangingIndent: true,
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
          align: 'left',
          spaceAfterTwips: 60,
          fontSizeHalfPt: 24,
        })
      );
      // Nhúng ảnh / sơ đồ câu hỏi nếu có
      if (q.images && q.images.length > 0 && imageRelMap) {
        for (const img of q.images) {
          const rId = imageRelMap.get(img.id) || imageRelMap.get(img.dataUrl);
          if (rId) {
            blocks.push(buildQuestionImageDrawingXml(rId, img.id));
          }
        }
      }
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

  if (part4.length > 0) {
    // Tự động đánh số tiêu đề phần Tự luận:
    // - Nếu có Phần III -> "PHẦN IV. TỰ LUẬN"
    // - Nếu khuyết Phần III (nhưng có Phần II) -> "PHẦN III. TỰ LUẬN"
    // - Nếu chỉ có Phần I + Tự luận -> "PHẦN II. TỰ LUẬN"
    const essayRoman =
      part3.length > 0 ? 'IV' : part2.length > 0 ? 'III' : part1.length > 0 ? 'II' : 'I';
    const essayHeaderPrefix = `PHẦN ${essayRoman}. TỰ LUẬN. `;
    const essayRangeDesc =
      part4.length === 1
        ? `Thí sinh trình bày lời giải chi tiết câu ${part4[0].displayIndex}.`
        : `Thí sinh trình bày lời giải chi tiết từ câu ${part4[0].displayIndex} đến câu ${part4[part4.length - 1].displayIndex}.`;

    blocks.push(
      buildStandardParagraphXml(essayHeaderPrefix, essayRangeDesc, {
        align: 'left',
        spaceBeforeTwips: 120,
        spaceAfterTwips: 120,
        fontSizeHalfPt: 24,
      })
    );

    for (const q of part4) {
      const stemLines = (q.stemText || '').split(/\r?\n/).filter((l) => l.trim().length > 0);
      const firstLine = stemLines[0] || '';
      blocks.push(
        buildStandardParagraphXml(`Câu ${q.displayIndex}. `, firstLine, {
          align: 'left',
          spaceAfterTwips: stemLines.length > 1 ? 40 : 80,
          fontSizeHalfPt: 24,
        })
      );

      for (let i = 1; i < stemLines.length; i++) {
        blocks.push(
          buildStandardParagraphXml('', stemLines[i], {
            align: 'left',
            spaceAfterTwips: i === stemLines.length - 1 ? 80 : 40,
            fontSizeHalfPt: 24,
          })
        );
      }

      if (q.images && q.images.length > 0 && imageRelMap) {
        for (const img of q.images) {
          const rId = imageRelMap.get(img.id) || imageRelMap.get(img.dataUrl);
          if (rId) {
            blocks.push(buildQuestionImageDrawingXml(rId, img.id));
          }
        }
      }

      if ((includeSolutions || highlightCorrectAnswers) && q.explanation) {
        const expLines = q.explanation.split(/\r?\n/).filter((l) => l.trim().length > 0);
        blocks.push(
          buildStandardParagraphXml(
            `Hướng dẫn chấm / Lời giải: `,
            expLines[0] || '',
            {
              italicBody: true,
              prefixColorHex: '9333EA',
              align: 'left',
              spaceBeforeTwips: 40,
              spaceAfterTwips: expLines.length > 1 ? 40 : 100,
              fontSizeHalfPt: 24,
            }
          )
        );
        for (let i = 1; i < expLines.length; i++) {
          blocks.push(
            buildStandardParagraphXml('', expLines[i], {
              italicBody: true,
              align: 'left',
              spaceAfterTwips: i === expLines.length - 1 ? 100 : 40,
              fontSizeHalfPt: 24,
            })
          );
        }
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
      relsItems.push(
        `<Relationship Id="${img.relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${img.fileName}"/>`
      );
      try {
        zip.file(`word/media/${img.fileName}`, dataUrlToUint8Array(img.dataUrl));
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
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
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
  const { imagesToEmbed, imageRelMap } = collectImagesAndBuildRelMap(questions);
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
  const { imagesToEmbed, imageRelMap } = collectImagesAndBuildRelMap(questions);
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
  const { imagesToEmbed, imageRelMap } = collectImagesAndBuildRelMap(variant.questions);
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
 * Tạo hàng XML cho 1 mã đề trong Bảng Khảo Thí A4:
 * - Khung bên trái: MÃ ĐỀ (Nền xanh nhạt, chữ đậm to rõ ràng)
 * - Khung bên phải: Đáp án từng câu và từng phần theo thứ tự từ trên xuống:
 *   + PHẦN I (18 câu 4 lựa chọn)
 *   + PHẦN II (4 câu Đúng / Sai)
 *   + PHẦN III (6 câu Trả lời ngắn)
 * Dùng font Times New Roman, canh trái tự động co dãn, vừa vặn trên 1 trang A4 nộp khảo thí!
 */
function buildKhaoThiVariantRowXml(variant: ShuffledVariant): string {
  // 1. Chuỗi đáp án Phần I
  const p1Items = variant.answerKey.part1;
  const p1Text = p1Items.map((item) => `${item.questionNumber}.${item.answer}`).join('   ');

  // 2. Chuỗi đáp án Phần II
  const p2Items = variant.answerKey.part2;
  const p2Text = p2Items
    .map((item) => `Câu ${item.questionNumber}: ${item.dsString} (${item.tfString})`)
    .join('    |    ');

  // 3. Chuỗi đáp án Phần III
  const p3Items = variant.answerKey.part3;
  const p3Text = p3Items
    .map((item) => `Câu ${item.questionNumber}: ${item.answer}`)
    .join('    |    ');

  // 4. Chuỗi Hướng dẫn chấm Phần Tự luận (nếu đề có Phần Tự luận)
  const p4Items = variant.answerKey.part4 || [];
  const p4TitleLabel = p3Items.length > 0 ? 'PHẦN IV (Tự luận)' : 'PHẦN III (Tự luận)';
  const p4Xml =
    p4Items.length > 0
      ? `<w:p>
        <w:pPr>
          <w:spacing w:before="30" w:after="60" w:line="240" w:lineRule="auto"/>
          <w:jc w:val="left"/>
        </w:pPr>
        <w:r>
          <w:rPr>
            <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
            <w:b/>
            <w:color w:val="7E22CE"/>
            <w:sz w:val="23"/><w:szCs w:val="23"/>
          </w:rPr>
          <w:t xml:space="preserve">${escapeXml(p4TitleLabel)} (${p4Items.length} câu — Giữ nguyên thứ tự): </w:t>
        </w:r>
        <w:r>
          <w:rPr>
            <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
            <w:color w:val="0F172A"/>
            <w:sz w:val="23"/><w:szCs w:val="23"/>
          </w:rPr>
          <w:t xml:space="preserve">${escapeXml(
            p4Items.map((item) => `Câu ${item.questionNumber}: ${item.answer}`).join('   |   ')
          )}</w:t>
        </w:r>
      </w:p>`
      : '';

  return `<w:tr>
    <!-- Cột bên trái: Mã đề -->
    <w:tc>
      <w:tcPr>
        <w:tcW w:w="1200" w:type="pct"/>
        <w:tcBorders>
          <w:top w:val="single" w:sz="8" w:space="0" w:color="0284C7"/>
          <w:left w:val="single" w:sz="8" w:space="0" w:color="0284C7"/>
          <w:bottom w:val="single" w:sz="8" w:space="0" w:color="0284C7"/>
          <w:right w:val="single" w:sz="8" w:space="0" w:color="0284C7"/>
        </w:tcBorders>
        <w:shd w:val="clear" w:color="auto" w:fill="E0F2FE"/>
      </w:tcPr>
      <w:p>
        <w:pPr>
          <w:spacing w:before="60" w:after="20"/>
          <w:jc w:val="center"/>
        </w:pPr>
        <w:r>
          <w:rPr>
            <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
            <w:b/>
            <w:color w:val="0369A1"/>
            <w:sz w:val="20"/><w:szCs w:val="20"/>
          </w:rPr>
          <w:t>MÃ ĐỀ</w:t>
        </w:r>
      </w:p>
      <w:p>
        <w:pPr>
          <w:spacing w:before="0" w:after="40"/>
          <w:jc w:val="center"/>
        </w:pPr>
        <w:r>
          <w:rPr>
            <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
            <w:b/>
            <w:color w:val="1E3A8A"/>
            <w:sz w:val="32"/><w:szCs w:val="32"/>
          </w:rPr>
          <w:t>${escapeXml(variant.examCode)}</w:t>
        </w:r>
      </w:p>
    </w:tc>

    <!-- Cột bên phải: Đáp án từng phần từ trên xuống -->
    <w:tc>
      <w:tcPr>
        <w:tcW w:w="3800" w:type="pct"/>
        <w:tcBorders>
          <w:top w:val="single" w:sz="8" w:space="0" w:color="94A3B8"/>
          <w:left w:val="single" w:sz="8" w:space="0" w:color="94A3B8"/>
          <w:bottom w:val="single" w:sz="8" w:space="0" w:color="94A3B8"/>
          <w:right w:val="single" w:sz="8" w:space="0" w:color="94A3B8"/>
        </w:tcBorders>
        <w:shd w:val="clear" w:color="auto" w:fill="FFFFFF"/>
      </w:tcPr>
      <!-- PHẦN I -->
      <w:p>
        <w:pPr>
          <w:spacing w:before="60" w:after="30" w:line="240" w:lineRule="auto"/>
          <w:jc w:val="left"/>
        </w:pPr>
        <w:r>
          <w:rPr>
            <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
            <w:b/>
            <w:color w:val="1E40AF"/>
            <w:sz w:val="23"/><w:szCs w:val="23"/>
          </w:rPr>
          <w:t>PHẦN I (18 câu 4 lựa chọn): </w:t>
        </w:r>
        <w:r>
          <w:rPr>
            <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
            <w:b/>
            <w:color w:val="DC2626"/>
            <w:sz w:val="23"/><w:szCs w:val="23"/>
          </w:rPr>
          <w:t xml:space="preserve">${escapeXml(p1Text)}</w:t>
        </w:r>
      </w:p>
      <!-- PHẦN II -->
      <w:p>
        <w:pPr>
          <w:spacing w:before="30" w:after="30" w:line="240" w:lineRule="auto"/>
          <w:jc w:val="left"/>
        </w:pPr>
        <w:r>
          <w:rPr>
            <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
            <w:b/>
            <w:color w:val="065F46"/>
            <w:sz w:val="23"/><w:szCs w:val="23"/>
          </w:rPr>
          <w:t>PHẦN II (4 câu Đúng / Sai): </w:t>
        </w:r>
        <w:r>
          <w:rPr>
            <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
            <w:color w:val="0F172A"/>
            <w:sz w:val="23"/><w:szCs w:val="23"/>
          </w:rPr>
          <w:t xml:space="preserve">${escapeXml(p2Text)}</w:t>
        </w:r>
      </w:p>
      <!-- PHẦN III -->
      <w:p>
        <w:pPr>
          <w:spacing w:before="30" w:after="60" w:line="240" w:lineRule="auto"/>
          <w:jc w:val="left"/>
        </w:pPr>
        <w:r>
          <w:rPr>
            <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
            <w:b/>
            <w:color w:val="92400E"/>
            <w:sz w:val="23"/><w:szCs w:val="23"/>
          </w:rPr>
          <w:t>PHẦN III (6 câu Trả lời ngắn): </w:t>
        </w:r>
        <w:r>
          <w:rPr>
            <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
            <w:b/>
            <w:color w:val="DC2626"/>
            <w:sz w:val="23"/><w:szCs w:val="23"/>
          </w:rPr>
          <w:t xml:space="preserve">${escapeXml(p3Text || 'Không có')}</w:t>
        </w:r>
      </w:p>
      ${p4Xml}
    </w:tc>
  </w:tr>`;
}

/**
 * Tiện ích 4: Xuất File BẢNG ĐÁP ÁN TỔNG HỢP NỘP KHẢO THÍ CHUẨN TRÊN 1 TRANG A4:
 * - Có tiêu đề Quốc ngữ giống như đề (Sở/Trường/Kỳ thi/Môn thi/Thời gian)
 * - Gom chung tất cả các mã đề vào 1 khung A4 chuẩn
 * - Khung bên trái: Các mã đề
 * - Khung bên phải: Đáp án từng câu và từng phần theo thứ tự từ trên xuống: Phần I, Phần II, Phần III
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
      <w:spacing w:before="100" w:after="80"/>
      <w:jc w:val="center"/>
    </w:pPr>
    <w:r>
      <w:rPr>
        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
        <w:b/>
        <w:color w:val="1E3A8A"/>
        <w:sz w:val="26"/><w:szCs w:val="26"/>
      </w:rPr>
      <w:t>BẢNG TỔNG HỢP ĐÁP ÁN CHẤM THI CÁC MÃ ĐỀ</w:t>
    </w:r>
  </w:p>`;

  // Các dòng trong bảng Khảo Thí (Mỗi dòng: bên trái là Mã đề, bên phải là Phần I, II, III từ trên xuống)
  const rowsXml = variants.map((v) => buildKhaoThiVariantRowXml(v)).join('\n');

  const unifiedMasterFrameXml = `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="5000" w:type="pct"/>
      <w:tblLayout w:type="autofit"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="12" w:space="0" w:color="0284C7"/>
        <w:left w:val="single" w:sz="12" w:space="0" w:color="0284C7"/>
        <w:bottom w:val="single" w:sz="12" w:space="0" w:color="0284C7"/>
        <w:right w:val="single" w:sz="12" w:space="0" w:color="0284C7"/>
        <w:insideH w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
        <w:insideV w:val="single" w:sz="8" w:space="0" w:color="0284C7"/>
      </w:tblBorders>
      <w:tblCellMar>
        <w:top w:w="80" w:type="dxa"/>
        <w:left w:w="100" w:type="dxa"/>
        <w:bottom w:w="80" w:type="dxa"/>
        <w:right w:w="100" w:type="dxa"/>
      </w:tblCellMar>
    </w:tblPr>
    ${rowsXml}
  </w:tbl>`;

  // Bảng chữ ký Khảo thí & Cán bộ chấm thi
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
        <w:top w:w="160" w:type="dxa"/>
        <w:left w:w="60" w:type="dxa"/>
        <w:bottom w:w="100" w:type="dxa"/>
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

  const fullInnerXml = `${headerXml}\n${subHeadingXml}\n${unifiedMasterFrameXml}\n${signatureTableXml}`;

  return packOpenXmlDocx(
    fullInnerXml,
    config,
    `Bảng đáp án khảo thí (${variants.length} mã đề)`
  );
}

/**
 * Tiện ích 5: Đóng gói toàn bộ bộ đề (.docx) + Đề gốc có lời giải + Bảng đáp án khảo thí + QR (.png) thành 1 file .ZIP:
 * - 00_De_Goc_Co_Loi_Giai_Chi_Tiet_2025.docx (Cho giáo viên)
 * - 00_De_Goc_Chuan_Khong_Loi_Giai_2025.docx (Cho học sinh)
 * - 01_Bang_Dap_An_Chung_Khao_Thi_2025.docx (1 trang A4 chuẩn nộp khảo thí)
 * - Thư mục Bo_De_Thi_Hoc_Sinh_Docx/: Tất cả các mã đề hoán vị BẮT BUỘC KHÔNG CÓ LỜI GIẢI / ĐÁP ÁN
 * - Thư mục Ma_QR_Cham_Thi_PNG/: Mã QR từng mã đề
 * - Bang_Dap_An_Tong_Hop_2025.csv
 */
/**
 * Định dạng ngày tháng chuẩn mm-dd-yy theo yêu cầu đặt tên tệp xuất ra
 */
export function getFormattedDateMmDdYy(date: Date = new Date()): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(-2);
  return `${mm}-${dd}-${yy}`;
}

function cleanFileSegment(raw: string): string {
  return (raw || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Tạo chuỗi tên tệp chuẩn: tên môn-lớp-kỳ kiểm tra-mm-dd-yy
 * Ví dụ: SINH HỌC-Lớp 12-KỲ THI TỐT NGHIỆP THPT NĂM 2025-10-27-26.docx
 */
export function buildStandardExportFileName(
  config: ShuffleConfig,
  extension: 'docx' | 'zip' | 'csv' | 'png' | 'txt',
  suffix?: string
): string {
  const subjectPart = cleanFileSegment(config.subjectName || 'SINH HỌC');
  const rawGrade = cleanFileSegment(config.gradeLevel || 'Lớp 12');
  const gradePart = /^lớp\s+/i.test(rawGrade) ? rawGrade : `Lớp ${rawGrade}`;
  const examPart = cleanFileSegment(config.examTitle || 'Kỳ kiểm tra');
  const datePart = getFormattedDateMmDdYy();
  const baseName = `${subjectPart}-${gradePart}-${examPart}-${datePart}`;
  const extra = suffix ? `-${cleanFileSegment(suffix)}` : '';
  return `${baseName}${extra}.${extension}`;
}

export async function exportAllVariantsZipBundle(
  variants: ShuffledVariant[],
  masterQuestions: ExamQuestion[],
  config: ShuffleConfig
): Promise<Blob> {
  const bundleZip = new JSZip();

  // 1. Lưu file đề gốc CÓ LỜI GIẢI CHI TIẾT
  const masterSolutionsBlob = await exportMasterExamWithSolutionsDocx(masterQuestions, config);
  bundleZip.file(
    buildStandardExportFileName(config, 'docx', 'Đề gốc có lời giải'),
    masterSolutionsBlob
  );

  // 2. Lưu file đề gốc chuẩn KHÔNG LỜI GIẢI (Học sinh làm thử)
  const masterCleanBlob = await exportCleanedMasterDocx(masterQuestions, config, false);
  bundleZip.file(
    buildStandardExportFileName(config, 'docx', 'Đề gốc không lời giải'),
    masterCleanBlob
  );

  // 3. Lưu file Bảng đáp án tổng hợp nộp khảo thí (1 trang A4)
  const masterAnswerDocxBlob = await exportMasterAnswerSheetDocx(variants, config);
  bundleZip.file(
    buildStandardExportFileName(config, 'docx', 'Bảng đáp án khảo thí'),
    masterAnswerDocxBlob
  );

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

  // 5. Tạo file CSV tổng hợp key chấm thi
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
 * Tiện ích 6: Đóng gói trọn bộ 4 Đề AI Tương Đương (kèm cả bản Đề Học Sinh & bản Đề Có Lời Giải Chi Tiết) thành 1 file .ZIP
 */
export async function exportFourAiClonesZipBundle(
  aiVariants: Array<{ examCode: string; title: string; questions: ExamQuestion[] }>,
  config: ShuffleConfig
): Promise<Blob> {
  const aiZip = new JSZip();
  const folderStudent = aiZip.folder('01_De_AI_Cho_Hoc_Sinh_Khong_Loi_Giai');
  const folderTeacher = aiZip.folder('02_De_AI_Kem_Loi_Giai_Chi_Tiet_Cho_Giao_Vien');

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

    const teacherBlob = await exportMasterExamWithSolutionsDocx(v.questions, {
      ...config,
      examSubtitle: `${v.title.toUpperCase()} (CÓ LỜI GIẢI) — MÃ: ${v.examCode}`,
    });
    folderTeacher?.file(
      buildStandardExportFileName(config, 'docx', `${v.examCode}-Có lời giải`),
      teacherBlob
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

