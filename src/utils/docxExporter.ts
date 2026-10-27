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
 * Tạo nội dung body XML cho 1 bộ câu hỏi:
 * - Bắt buộc dùng Times New Roman 12pt, canh trái (left), tự động co dãn đều đẹp mắt
 */
function buildQuestionsBodyXml(
  questions: ExamQuestion[],
  config: ShuffleConfig,
  highlightCorrectAnswers: boolean
): string {
  const part1 = questions.filter((q) => q.part === 'PART_1');
  const part2 = questions.filter((q) => q.part === 'PART_2');
  const part3 = questions.filter((q) => q.part === 'PART_3');

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
      if (config.includeSolutionsInExport && q.explanation) {
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
      if (config.includeSolutionsInExport && q.explanation) {
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
      if (config.includeSolutionsInExport && q.explanation) {
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
 * Tất cả dùng Times New Roman 12pt
 */
function buildFooterXml(
  config: ShuffleConfig,
  examCodeText: string
): string {
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
        <w:b/>
        <w:sz w:val="24"/><w:szCs w:val="24"/>
      </w:rPr>
      <w:t xml:space="preserve">${escapeXml(config.subjectName.toUpperCase())} — ${escapeXml(examCodeText)}</w:t>
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
 * Đóng gói một tệp Word (.docx) hoàn chỉnh chuẩn OpenXML (hỗ trợ Footer đánh số trang + Mã đề & Nhúng ảnh QR)
 */
async function packOpenXmlDocx(
  documentBodyInnerXml: string,
  config: ShuffleConfig,
  footerExamCodeLabel: string,
  embeddedQrDataUrl?: string
): Promise<Blob> {
  const zip = new JSZip();
  const hasImage = Boolean(embeddedQrDataUrl);

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  ${hasImage ? '<Default Extension="png" ContentType="image/png"/>' : ''}
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

  if (hasImage && embeddedQrDataUrl) {
    relsItems.push(
      `<Relationship Id="rIdQr1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/qrcode.png"/>`
    );
    zip.file('word/media/qrcode.png', dataUrlToUint8Array(embeddedQrDataUrl));
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
 * Tiện ích 1: Xuất file đề gốc đã sửa sạch lỗi (.docx)
 */
export async function exportCleanedMasterDocx(
  questions: ExamQuestion[],
  config: ShuffleConfig
): Promise<Blob> {
  const headerXml = buildExamNationalHeaderTableXml(
    config,
    'ĐỀ GỐC ĐÃ CHUẨN HÓA CẤU TRÚC 2025'
  );
  const bodyQuestionsXml = buildQuestionsBodyXml(questions, config, true);
  return packOpenXmlDocx(
    `${headerXml}\n${bodyQuestionsXml}`,
    config,
    'ĐỀ GỐC CHUẨN 2025'
  );
}

/**
 * Tiện ích 2: Xuất 1 tệp Đề thi hoán vị (.docx) kèm Số trang, Số Mã đề & Khung Đáp Án 3 Cột Mầu ở trang cuối
 */
export async function exportSingleVariantDocx(
  variant: ShuffledVariant,
  config: ShuffleConfig
): Promise<Blob> {
  const headerXml = buildExamNationalHeaderTableXml(
    config,
    `MÃ ĐỀ THI: ${variant.examCode}`
  );

  const questionsXml = buildQuestionsBodyXml(variant.questions, config, false);

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

  // Trang đáp án và mã QR ở cuối đề (Ngắt trang <w:br w:type="page"/>)
  const pageBreakXml = `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;

  const answerCardXml = buildVariant3ColumnAnswerCardXml(variant);

  const answerSheetBlocks: string[] = [
    pageBreakXml,
    buildStandardParagraphXml(
      `PHIẾU ĐÁP ÁN & MÃ QR CHẤM THI — MÃ ĐỀ ${variant.examCode}`,
      '',
      { align: 'center', spaceAfterTwips: 120, fontSizeHalfPt: 24 }
    ),
    answerCardXml,
    buildStandardParagraphXml('Chuỗi Payload QR: ', variant.qrPayload, {
      align: 'left',
      spaceBeforeTwips: 100,
      spaceAfterTwips: 80,
      fontSizeHalfPt: 24,
    }),
  ];

  if (config.embedQrInWord && variant.qrDataUrl) {
    answerSheetBlocks.push(buildEmbeddedQrDrawingXml('rIdQr1', variant.examCode));
    answerSheetBlocks.push(
      buildStandardParagraphXml(
        `Quét mã QR bằng ứng dụng ${config.qrFormat} để nạp tự động đáp án Mã đề ${variant.examCode}`,
        '',
        { align: 'center', italicBody: true, spaceAfterTwips: 80, fontSizeHalfPt: 24 }
      )
    );
  }

  const fullInnerXml = [
    headerXml,
    questionsXml,
    footerEndXml,
    ...answerSheetBlocks,
  ].join('\n');

  return packOpenXmlDocx(
    fullInnerXml,
    config,
    `MÃ ĐỀ: ${variant.examCode}`,
    config.embedQrInWord ? variant.qrDataUrl : undefined
  );
}

/**
 * Tiện ích 3 (MỚI): Xuất File Bảng Đáp Án Tổng Hợp (.docx) gồm TẤT CẢ các mã đề chung 1 khung lớn theo thứ tự từ trên xuống,
 * mỗi mã đề trình bày đúng chuẩn 3 khung màu Phần I, Phần II, Phần III như hình mẫu, Times New Roman 12pt để in ấn / nộp ngay không cần chỉnh sửa!
 */
export async function exportMasterAnswerSheetDocx(
  variants: ShuffledVariant[],
  config: ShuffleConfig
): Promise<Blob> {
  const headerXml = buildExamNationalHeaderTableXml(
    config,
    `BẢNG ĐÁP ÁN TỔNG HỢP (${variants.length} MÃ ĐỀ: ${variants.map((v) => v.examCode).join(', ')})`
  );

  // Đặt tất cả các mã đề vào chung 1 Khung Bao Tổng Hợp (Master Frame) xếp theo thứ tự từ trên xuống
  const allVariantRowsXml = variants
    .map(
      (v, idx) => `<w:tr>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="5000" w:type="pct"/>
            <w:tcBorders>
              <w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/>
              <w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/>
              <w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/>
              <w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/>
            </w:tcBorders>
          </w:tcPr>
          ${buildVariant3ColumnAnswerCardXml(v)}
          ${
            idx < variants.length - 1
              ? '<w:p><w:pPr><w:spacing w:before="80" w:after="80"/></w:pPr></w:p>'
              : ''
          }
        </w:tc>
      </w:tr>`
    )
    .join('\n');

  const unifiedMasterFrameXml = `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="5000" w:type="pct"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="12" w:space="0" w:color="1D4ED8"/>
        <w:left w:val="single" w:sz="12" w:space="0" w:color="1D4ED8"/>
        <w:bottom w:val="single" w:sz="12" w:space="0" w:color="1D4ED8"/>
        <w:right w:val="single" w:sz="12" w:space="0" w:color="1D4ED8"/>
      </w:tblBorders>
      <w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/>
      <w:tblCellMar>
        <w:top w:w="140" w:type="dxa"/>
        <w:left w:w="140" w:type="dxa"/>
        <w:bottom w:w="140" w:type="dxa"/>
        <w:right w:w="140" w:type="dxa"/>
      </w:tblCellMar>
    </w:tblPr>
    ${allVariantRowsXml}
  </w:tbl>`;

  const fullInnerXml = `${headerXml}\n${unifiedMasterFrameXml}`;

  return packOpenXmlDocx(
    fullInnerXml,
    config,
    `BẢNG ĐÁP ÁN CHUNG (${variants.length} MÃ ĐỀ)`
  );
}

/**
 * Tiện ích 4: Đóng gói toàn bộ bộ đề (.docx) + File Bảng đáp án tổng hợp (.docx & .csv) + Thư mục ảnh QR (.png) thành 1 file .ZIP
 */
export async function exportAllVariantsZipBundle(
  variants: ShuffledVariant[],
  masterQuestions: ExamQuestion[],
  config: ShuffleConfig
): Promise<Blob> {
  const bundleZip = new JSZip();

  // 1. Lưu file đề gốc đã sửa sạch lỗi
  const masterBlob = await exportCleanedMasterDocx(masterQuestions, config);
  bundleZip.file('00_De_Goc_Da_Chuan_Hoa_2025.docx', masterBlob);

  // 2. Lưu file Bảng đáp án tổng hợp tất cả các mã đề chung 1 khung (.docx) chuẩn đẹp mắt nộp ngay
  const masterAnswerDocxBlob = await exportMasterAnswerSheetDocx(variants, config);
  bundleZip.file('01_Bang_Dap_An_Chung_Tat_Ca_Ma_De_2025.docx', masterAnswerDocxBlob);

  // 3. Lưu từng file đề hoán vị (.docx) và ảnh QR (.png)
  const deThiFolder = bundleZip.folder('Bo_De_Hoan_Vi_Docx');
  const qrFolder = bundleZip.folder('Ma_QR_Cham_Thi_PNG');

  for (const v of variants) {
    const docxBlob = await exportSingleVariantDocx(v, config);
    deThiFolder?.file(`De_Thi_Ma_${v.examCode}.docx`, docxBlob);

    if (v.qrDataUrl) {
      const pngBytes = dataUrlToUint8Array(v.qrDataUrl);
      qrFolder?.file(`QR_Ma_De_${v.examCode}_${config.qrFormat}.png`, pngBytes);
    }
  }

  // 4. Tạo file CSV tổng hợp key chấm thi
  const csvLines: string[] = [
    'Ma_De,Phan_I_ABCD,Phan_II_DungSai,Phan_III_TraLoiNgan,QR_Payload',
  ];
  for (const v of variants) {
    const p1 = v.answerKey.part1.map((x) => `${x.questionNumber}${x.answer}`).join(' ');
    const p2 = v.answerKey.part2.map((x) => `${x.questionNumber}:${x.dsString}(${x.tfString})`).join(' ');
    const p3 = v.answerKey.part3.map((x) => `${x.questionNumber}=${x.answer}`).join(' ');
    csvLines.push(`"${v.examCode}","${p1}","${p2}","${p3}","${v.qrPayload}"`);
  }
  bundleZip.file('Bang_Dap_An_Tong_Hop_2025.csv', '\uFEFF' + csvLines.join('\n'));

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
        `QR_${config.qrFormat}_MaDe_${v.examCode}.png`,
        dataUrlToUint8Array(v.qrDataUrl)
      );
    }
    lines.push(v.qrPayload);
  }

  qrZip.file('Payload_Key_Cham_Thi.txt', lines.join('\n'));
  return qrZip.generateAsync({ type: 'blob' });
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
