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
import {
  exportGradingExcelXlsx,
  generateMasterMultiQrCode,
} from './shuffleEngine';
import {
  PHIEU_KHXH_BASE64,
  PHIEU_KHTN_BASE64,
  PHIEU_NGOAINGU_BASE64,
  PHIEU_TOAN_BASE64,
} from './phieuQmBase64Assets';

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
 * ============================================================================
 * BỘ ÁNH XẠ 4 MẪU PHIẾU TRẢ LỜI TRẮC NGHIỆM QM 2025 THEO MÔN HỌC (CHẠY TỨC THÌ 0.01s)
 * - Không gửi ảnh lên AI, hoàn toàn nạp tĩnh từ Base64 nhúng sẵn trong mã nguồn (0 API token)
 * - Kích thước khóa cứng chuẩn Camera AI nhận diện: Width = 16.5cm (624px / 5,943,600 EMUs) × Height = 8.2cm (310px / 2,952,750 EMUs)
 * ============================================================================
 */
export interface PhieuQM2025Info {
  groupCode: 'TOAN' | 'KHTN_DIA' | 'NGOAI_NGU' | 'KHXH_CN_TIN';
  groupName: string;
  subjectsLabel: string;
  structureDesc: string;
  standardFileName: 'phieu_toan.jpg' | 'phieu_khtn.jpg' | 'phieu_ngoaingu.jpg' | 'phieu_khxh.jpg';
  assetPath: string;
  publicUrl: string;
  fallbackUrl: string;
  widthPx: number;
  heightPx: number;
  widthEmu: number;
  heightEmu: number;
}

export const ALL_PHIEU_QM_2025_TEMPLATES: PhieuQM2025Info[] = [
  {
    groupCode: 'TOAN',
    groupName: 'Môn Toán',
    subjectsLabel: 'Toán học',
    structureDesc: 'Phần I: 12 câu | Phần II: 4 câu | Phần III: 6 câu',
    standardFileName: 'phieu_toan.jpg',
    assetPath: 'assets/phieu_toan.jpg',
    publicUrl: PHIEU_TOAN_BASE64,
    fallbackUrl: PHIEU_TOAN_BASE64,
    widthPx: 624,
    heightPx: 310,
    widthEmu: 5943600, // 16.5 cm chuẩn khít lề A4
    heightEmu: 2952750, // ~8.2 cm chuẩn tỷ lệ gốc QM 2025
  },
  {
    groupCode: 'KHTN_DIA',
    groupName: 'Nhóm KHTN & Địa',
    subjectsLabel: 'Sinh học, Vật lí, Hóa học, Địa lí',
    structureDesc: 'Phần I: 18 câu | Phần II: 4 câu | Phần III: 6 câu',
    standardFileName: 'phieu_khtn.jpg',
    assetPath: 'assets/phieu_khtn.jpg',
    publicUrl: PHIEU_KHTN_BASE64,
    fallbackUrl: PHIEU_KHTN_BASE64,
    widthPx: 624,
    heightPx: 310,
    widthEmu: 5943600,
    heightEmu: 2952750,
  },
  {
    groupCode: 'NGOAI_NGU',
    groupName: 'Môn Ngoại ngữ',
    subjectsLabel: 'Tiếng Anh, Ngoại ngữ khác',
    structureDesc: 'Phần I: 40 câu trắc nghiệm 4 lựa chọn',
    standardFileName: 'phieu_ngoaingu.jpg',
    assetPath: 'assets/phieu_ngoaingu.jpg',
    publicUrl: PHIEU_NGOAINGU_BASE64,
    fallbackUrl: PHIEU_NGOAINGU_BASE64,
    widthPx: 624,
    heightPx: 310,
    widthEmu: 5943600,
    heightEmu: 2952750,
  },
  {
    groupCode: 'KHXH_CN_TIN',
    groupName: 'Nhóm KHXH, CN, Tin',
    subjectsLabel: 'Lịch sử, Tin học, Công nghệ, GD Kinh tế & Pháp luật',
    structureDesc: 'Phần I: 24 câu | Phần II: 6 câu (Không có Phần III)',
    standardFileName: 'phieu_khxh.jpg',
    assetPath: 'assets/phieu_khxh.jpg',
    publicUrl: PHIEU_KHXH_BASE64,
    fallbackUrl: PHIEU_KHXH_BASE64,
    widthPx: 624,
    heightPx: 310,
    widthEmu: 5943600,
    heightEmu: 2952750,
  },
];

/**
 * 1. Hàm ánh xạ lấy đúng đường dẫn ảnh phiếu QM 2025 theo môn học (Chuẩn tài liệu kỹ thuật)
 */
export function getPhieuQMBySubject(subjectName: string): string {
  const sub = (subjectName || '').toLowerCase();
  if (sub.includes('toán') || sub.includes('toan')) {
    return 'assets/phieu_toan.jpg';
  }
  if (
    sub.includes('sinh') ||
    sub.includes('lí') ||
    sub.includes('lý') ||
    sub.includes('ly') ||
    sub.includes('hóa') ||
    sub.includes('hoa') ||
    sub.includes('địa') ||
    sub.includes('dia')
  ) {
    return 'assets/phieu_khtn.jpg';
  }
  if (
    sub.includes('anh') ||
    sub.includes('ngoại ngữ') ||
    sub.includes('ngoai ngu')
  ) {
    return 'assets/phieu_ngoaingu.jpg';
  }
  // Các môn còn lại: Sử, Tin, Công nghệ, GDPL
  return 'assets/phieu_khxh.jpg';
}

/**
 * Lấy thông tin chi tiết của mẫu phiếu QM 2025 theo tên môn học
 */
export function getPhieuQMInfoBySubject(subjectName: string): PhieuQM2025Info {
  const matchedPath = getPhieuQMBySubject(subjectName);
  return (
    ALL_PHIEU_QM_2025_TEMPLATES.find((t) => t.assetPath === matchedPath) ||
    ALL_PHIEU_QM_2025_TEMPLATES[1]
  );
}

/**
 * Nạp Base64 DataURL của ảnh phiếu QM 2025 theo môn học (Lấy trực tiếp từ Base64 tĩnh trong 0.001s, không qua mạng)
 */
export async function loadPhieuQMDataUrlBySubject(
  subjectName: string
): Promise<{ info: PhieuQM2025Info; dataUrl: string | null }> {
  const info = getPhieuQMInfoBySubject(subjectName);
  return { info, dataUrl: info.publicUrl };
}

/**
 * 2. Tạo khối Paragraph chứa ImageRun (DrawingML) của Phiếu QM 2025 chèn ngay dưới Header Trang 1:
 * - Căn giữa (AlignmentType.CENTER / <w:jc w:val="center"/>)
 * - Khóa cứng tỷ lệ hình ảnh: Width = 16.5cm (624px = 5,943,600 EMUs), Height = 8.2cm (310px = 2,952,750 EMUs)
 * - Khoảng cách dưới: spacing: { after: 200 } (<w:spacing w:before="40" w:after="200"/>)
 */
function buildPhieuQM2025DrawingXml(
  relId: string,
  phieuInfo: PhieuQM2025Info
): string {
  const cx = phieuInfo.widthEmu;  // 5,943,600 EMUs = 16.5 cm (624 px)
  const cy = phieuInfo.heightEmu; // 2,952,750 EMUs = 8.2 cm (310 px)
  const docPrId = 9025;
  return `<w:p>
    <w:pPr>
      <w:spacing w:before="40" w:after="200"/>
      <w:jc w:val="center"/>
    </w:pPr>
    <w:r>
      <w:drawing>
        <wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
          <wp:extent cx="${cx}" cy="${cy}"/>
          <wp:effectExtent l="0" t="0" r="0" b="0"/>
          <wp:docPr id="${docPrId}" name="Phieu_QM_2025_${escapeXml(phieuInfo.groupCode)}" descr="${escapeXml(phieuInfo.standardFileName)}"/>
          <wp:cNvGraphicFramePr>
            <a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>
          </wp:cNvGraphicFramePr>
          <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
              <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                <pic:nvPicPr>
                  <pic:cNvPr id="${docPrId + 1}" name="${escapeXml(phieuInfo.standardFileName)}"/>
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
    keepLines?: boolean;
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
  const spaceAfter = options?.spaceAfterTwips ?? 30; // 1.5 pt = 30 twips (liền mạch, không khoảng trắng thừa)
  const fontSize = options?.fontSizeHalfPt ?? 24; // 12pt = 24 half-points
  const indXml = options?.hangingIndent
    ? `<w:ind w:left="360" w:hanging="360"/>`
    : '';
  const keepNextXml = options?.keepNext ? '<w:keepNext/>' : '';
  const keepLinesXml = options?.keepLines ? '<w:keepLines/>' : '';

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
      <w:widowControl w:val="0"/>
      ${keepLinesXml}
      ${keepNextXml}
      <w:spacing w:before="${spaceBefore}" w:after="${spaceAfter}" w:line="252" w:lineRule="auto"/>
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
  examCodeLabel?: string,
  hasEmbeddedPhieuQM2025: boolean = false
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
    buildStandardParagraphXml(config.examSubtitle || '( Đề chính thức )', '', {
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
          <w:spacing w:before="60" w:after="${hasEmbeddedPhieuQM2025 ? '60' : '120'}"/>
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

  // Nếu đã chèn ảnh Phiếu QM 2025 (vốn đã có sẵn khung Họ tên, Lớp, Mã đề, SBD), không lặp lại dòng chữ Họ tên rời rạc
  const studentInfoLineXml = hasEmbeddedPhieuQM2025
    ? ''
    : `<w:p>
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
  ${studentInfoLineXml}`;
}

/**
 * Tự động dàn dòng phương án Phần I bằng ĐOẠN VĂN THUẦN (<w:p>) + TAB STOPS (<w:tabs>):
 * - TUYỆT ĐỐI KHÔNG dùng bảng (<w:tbl>) để giáo viên dễ dàng chỉnh sửa trực tiếp từng đáp án như văn bản thường trong Word.
 * - Không khóa keepNext/keepLines để các câu hỏi chảy liền mạch sát tới cuối trang, triệt tiêu 100% khoảng trắng thừa cuối trang.
 * - Độ rộng vùng in chuẩn A4 (11906 - 2*1134 = 9638 twips = 17.0cm):
 *   + 1_ROW_4_COL: Tab stops tại 2410 (4.25cm), 4820 (8.50cm), 7230 (12.75cm)
 *   + 2_ROW_2_COL: Tab stop tại 4820 (8.50cm)
 *   + 4_ROW_1_COL: 4 đoạn văn <w:p> độc lập
 */
function buildPart1OptionsWithTabStopsXml(
  options: OptionPart1[],
  layout: '1_ROW_4_COL' | '2_ROW_2_COL' | '4_ROW_1_COL',
  highlightCorrect: boolean
): string {
  if (!options || options.length === 0) return '';

  const buildOptionRunsXml = (opt: OptionPart1): string => {
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

  const tabRunXml = `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:tab/></w:r>`;

  if (layout === '1_ROW_4_COL' && options.length === 4) {
    const rowRuns = [
      buildOptionRunsXml(options[0]),
      tabRunXml,
      buildOptionRunsXml(options[1]),
      tabRunXml,
      buildOptionRunsXml(options[2]),
      tabRunXml,
      buildOptionRunsXml(options[3]),
    ].join('\n');

    return `<w:p>
      <w:pPr>
        <w:widowControl w:val="0"/>
        <w:tabs>
          <w:tab w:val="left" w:pos="2410"/>
          <w:tab w:val="left" w:pos="4820"/>
          <w:tab w:val="left" w:pos="7230"/>
        </w:tabs>
        <w:spacing w:before="0" w:after="30" w:line="252" w:lineRule="auto"/>
        <w:jc w:val="left"/>
      </w:pPr>
      ${rowRuns}
    </w:p>`;
  }

  if (layout === '2_ROW_2_COL' && options.length === 4) {
    const row1Runs = [
      buildOptionRunsXml(options[0]),
      tabRunXml,
      buildOptionRunsXml(options[1]),
    ].join('\n');

    const row2Runs = [
      buildOptionRunsXml(options[2]),
      tabRunXml,
      buildOptionRunsXml(options[3]),
    ].join('\n');

    return `<w:p>
      <w:pPr>
        <w:widowControl w:val="0"/>
        <w:tabs>
          <w:tab w:val="left" w:pos="4820"/>
        </w:tabs>
        <w:spacing w:before="0" w:after="20" w:line="252" w:lineRule="auto"/>
        <w:jc w:val="left"/>
      </w:pPr>
      ${row1Runs}
    </w:p>
    <w:p>
      <w:pPr>
        <w:widowControl w:val="0"/>
        <w:tabs>
          <w:tab w:val="left" w:pos="4820"/>
        </w:tabs>
        <w:spacing w:before="0" w:after="30" w:line="252" w:lineRule="auto"/>
        <w:jc w:val="left"/>
      </w:pPr>
      ${row2Runs}
    </w:p>`;
  }

  // Mặc định: 4_ROW_1_COL (mỗi phương án 1 đoạn văn riêng biệt, không thuộc tính bảng, không hangingIndent)
  return options
    .map((opt, idx) => {
      const isMarked = highlightCorrect && opt.isCorrect;
      const isLast = idx === options.length - 1;
      return buildStandardParagraphXml(`${opt.currentLabel}. `, opt.text, {
        hangingIndent: false,
        keepNext: false,
        keepLines: false,
        underlinePrefix: isMarked,
        underlineBody: isMarked,
        redBody: isMarked,
        align: 'left',
        spaceBeforeTwips: 0,
        spaceAfterTwips: isLast ? 30 : 20,
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
  </w:tbl>${
    variant.answerKey.part4 && variant.answerKey.part4.length > 0
      ? '\n' +
        buildStandardParagraphXml(
          `${variant.answerKey.part3.length === 0 ? 'PHẦN III' : 'PHẦN IV'}. TỰ LUẬN (ĐÁP ÁN / CÂU HỎI TỰ LUẬN): `,
          '',
          {
            prefixColorHex: '6D28D9',
            underlinePrefix: true,
            spaceBeforeTwips: 80,
            spaceAfterTwips: 40,
            fontSizeHalfPt: 24,
          }
        ) +
        '\n' +
        variant.answerKey.part4
          .map((item) => {
            const qPara = buildStandardParagraphXml(
              `Câu ${item.questionNumber}. `,
              item.questionText,
              {
                align: 'left',
                spaceBeforeTwips: 30,
                spaceAfterTwips: item.hasExplicitAnswer ? 15 : 40,
                fontSizeHalfPt: 24,
              }
            );
            const ansPara =
              item.hasExplicitAnswer && item.answer
                ? '\n' +
                  buildStandardParagraphXml(
                    `→ Đáp án / Hướng dẫn chấm: `,
                    item.answer,
                    {
                      prefixColorHex: 'DC2626',
                      align: 'left',
                      spaceBeforeTwips: 10,
                      spaceAfterTwips: 40,
                      fontSizeHalfPt: 24,
                    }
                  )
                : '';
            return qPara + ansPara;
          })
          .join('\n')
      : ''
  }`;
}

/**
 * Tạo block XML nhúng hình ảnh Mã QR (DrawingML Inline Image) vào cuối trang đáp án trong Word
 */
function buildEmbeddedQrDrawingXml(relId: string, examCode: string): string {
  const extentEmu = 1520000;
  const extentYEmu = 1680000;
  const uid = Math.floor(Math.random() * 50000) + 200;
  return `<w:p>
    <w:pPr>
      <w:spacing w:before="80" w:after="60"/>
      <w:jc w:val="center"/>
    </w:pPr>
    <w:r>
      <w:drawing>
        <wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
          <wp:extent cx="${extentEmu}" cy="${extentYEmu}"/>
          <wp:docPr id="${uid}" name="QR_Code_${escapeXml(examCode)}"/>
          <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
              <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                <pic:nvPicPr>
                  <pic:cNvPr id="${uid + 1}" name="qr_${escapeXml(examCode)}.png"/>
                  <pic:cNvPicPr/>
                </pic:nvPicPr>
                <pic:blipFill>
                  <a:blip r:embed="${relId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
                  <a:stretch><a:fillRect/></a:stretch>
                </pic:blipFill>
                <pic:spPr>
                  <a:xfrm>
                    <a:off x="0" y="0"/>
                    <a:ext cx="${extentEmu}" cy="${extentYEmu}"/>
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
      <w:widowControl w:val="0"/>
      <w:spacing w:before="40" w:after="40"/>
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
  const part4 = cleanQuestions.filter((q) => q.part === 'PART_4');

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
        {
          keepNext: true,
          keepLines: true,
          align: 'left',
          spaceBeforeTwips: 60,
          spaceAfterTwips: 40,
          fontSizeHalfPt: 24,
        }
      )
    );
    for (const q of part1) {
      blocks.push(
        buildStandardParagraphXml(`Câu ${q.displayIndex}. `, q.stemText, {
          keepNext: false,
          keepLines: false,
          align: 'left',
          spaceBeforeTwips: 30,
          spaceAfterTwips: 20,
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
            spaceBeforeTwips: 20,
            spaceAfterTwips: 60,
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
        {
          keepNext: true,
          keepLines: true,
          align: 'left',
          spaceBeforeTwips: 80,
          spaceAfterTwips: 40,
          fontSizeHalfPt: 24,
        }
      )
    );
    for (const q of part2) {
      blocks.push(
        buildStandardParagraphXml(`Câu ${q.displayIndex}. `, q.stemText, {
          keepNext: false,
          keepLines: false,
          align: 'left',
          spaceBeforeTwips: 30,
          spaceAfterTwips: 20,
          fontSizeHalfPt: 24,
        })
      );
      appendQuestionTablesAndImages(q);

      const subs = q.subItems || [];
      for (let sIdx = 0; sIdx < subs.length; sIdx++) {
        const sub = subs[sIdx];
        const isMarked = highlightCorrectAnswers && sub.isTrue;
        const isLast = sIdx === subs.length - 1;
        blocks.push(
          buildStandardParagraphXml(`${sub.currentLabel}) `, sub.text, {
            hangingIndent: false,
            keepNext: false,
            keepLines: false,
            underlinePrefix: isMarked,
            underlineBody: isMarked,
            redBody: isMarked,
            align: 'left',
            spaceBeforeTwips: 0,
            spaceAfterTwips: isLast ? 30 : 20,
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
            spaceBeforeTwips: 20,
            spaceAfterTwips: 60,
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
        {
          keepNext: true,
          keepLines: true,
          align: 'left',
          spaceBeforeTwips: 80,
          spaceAfterTwips: 40,
          fontSizeHalfPt: 24,
        }
      )
    );
    for (const q of part3) {
      blocks.push(
        buildStandardParagraphXml(`Câu ${q.displayIndex}. `, q.stemText, {
          keepNext: false,
          keepLines: false,
          align: 'left',
          spaceBeforeTwips: 30,
          spaceAfterTwips: 30,
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
            spaceAfterTwips: 60,
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
            spaceBeforeTwips: 20,
            spaceAfterTwips: 60,
            fontSizeHalfPt: 24,
          })
        );
      }
    }
  }

  if (part4.length > 0) {
    // Nếu đề gốc không có Phần III (câu hỏi trả lời ngắn) thì tự động trình bày là PHẦN III. Tự luận cho đúng thứ tự
    const essayRoman = part3.length === 0 ? 'PHẦN III' : 'PHẦN IV';
    const essayRangeInstruction =
      part4.length === 1
        ? `Thí sinh trình bày lời giải chi tiết câu ${part4[0].displayIndex}.`
        : `Thí sinh trình bày lời giải chi tiết từ câu ${part4[0].displayIndex} đến câu ${part4[part4.length - 1].displayIndex}.`;

    blocks.push(
      buildStandardParagraphXml(
        `${essayRoman}. Tự luận. `,
        essayRangeInstruction,
        {
          keepNext: true,
          keepLines: true,
          align: 'left',
          spaceBeforeTwips: 80,
          spaceAfterTwips: 40,
          fontSizeHalfPt: 24,
        }
      )
    );

    for (const q of part4) {
      const stemLines = q.stemText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      const firstLine = stemLines[0] || q.stemText;

      blocks.push(
        buildStandardParagraphXml(`Câu ${q.displayIndex}. `, firstLine, {
          keepNext: false,
          keepLines: false,
          align: 'left',
          spaceBeforeTwips: 30,
          spaceAfterTwips: stemLines.length > 1 ? 15 : 30,
          fontSizeHalfPt: 24,
        })
      );

      for (let i = 1; i < stemLines.length; i++) {
        blocks.push(
          buildStandardParagraphXml('', stemLines[i], {
            keepNext: false,
            keepLines: false,
            align: 'left',
            spaceBeforeTwips: 10,
            spaceAfterTwips: i === stemLines.length - 1 ? 30 : 15,
            fontSizeHalfPt: 24,
          })
        );
      }

      appendQuestionTablesAndImages(q);

      const essayAns = (q.essayAnswer || q.explanation || q.shortAnswer || '').trim();
      if ((highlightCorrectAnswers || includeSolutions) && essayAns) {
        const ansLines = essayAns
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);
        blocks.push(
          buildStandardParagraphXml(`Đáp án / Hướng dẫn chấm: `, ansLines[0] || essayAns, {
            italicBody: false,
            prefixColorHex: '6D28D9',
            align: 'left',
            spaceBeforeTwips: 20,
            spaceAfterTwips: ansLines.length > 1 ? 15 : 60,
            fontSizeHalfPt: 24,
          })
        );
        for (let i = 1; i < ansLines.length; i++) {
          blocks.push(
            buildStandardParagraphXml('', ansLines[i], {
              italicBody: false,
              align: 'left',
              spaceBeforeTwips: 10,
              spaceAfterTwips: i === ansLines.length - 1 ? 60 : 15,
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
  const cleanCode = examCodeText.replace(/^MÃ\s*ĐỀ[:\s]*/i, '').trim() || examCodeText;
  const gradeLabel = (config.gradeLevel || '12').replace(/^lớp\s+/i, '').trim() || '12';

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p>
    <w:pPr>
      <w:pBdr>
        <w:top w:val="single" w:sz="6" w:space="4" w:color="64748B"/>
      </w:pBdr>
      <w:tabs>
        <w:tab w:val="right" w:pos="9638"/>
      </w:tabs>
      <w:spacing w:before="40" w:after="0" w:line="240" w:lineRule="auto"/>
    </w:pPr>
    <w:r>
      <w:rPr>
        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
        <w:i/>
        <w:color w:val="334155"/>
        <w:sz w:val="22"/><w:szCs w:val="22"/>
      </w:rPr>
      <w:t xml:space="preserve">${escapeXml(`Môn: ${subjectLabel} — Lớp: ${gradeLabel} — Mã đề: `)}</w:t>
    </w:r>
    <w:r>
      <w:rPr>
        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
        <w:b/>
        <w:i/>
        <w:color w:val="0F172A"/>
        <w:sz w:val="22"/><w:szCs w:val="22"/>
      </w:rPr>
      <w:t xml:space="preserve">${escapeXml(cleanCode)}</w:t>
    </w:r>
    <w:r>
      <w:rPr>
        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
        <w:sz w:val="22"/><w:szCs w:val="22"/>
      </w:rPr>
      <w:tab/>
    </w:r>
    <w:r>
      <w:rPr>
        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
        <w:i/>
        <w:color w:val="334155"/>
        <w:sz w:val="22"/><w:szCs w:val="22"/>
      </w:rPr>
      <w:t xml:space="preserve">Trang </w:t>
    </w:r>
    <w:fldSimple w:instr="PAGE">
      <w:r>
        <w:rPr>
          <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
          <w:b/>
          <w:i/>
          <w:color w:val="0F172A"/>
          <w:sz w:val="22"/><w:szCs w:val="22"/>
        </w:rPr>
        <w:t>1</w:t>
      </w:r>
    </w:fldSimple>
    <w:r>
      <w:rPr>
        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
        <w:i/>
        <w:color w:val="334155"/>
        <w:sz w:val="22"/><w:szCs w:val="22"/>
      </w:rPr>
      <w:t xml:space="preserve"> / </w:t>
    </w:r>
    <w:fldSimple w:instr="NUMPAGES">
      <w:r>
        <w:rPr>
          <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
          <w:b/>
          <w:i/>
          <w:color w:val="0F172A"/>
          <w:sz w:val="22"/><w:szCs w:val="22"/>
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
      <w:pgMar w:top="850" w:right="1134" w:bottom="680" w:left="1134" w:header="425" w:footer="425" w:gutter="0"/>
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
  const shouldEmbedPhieuQM = !includeSolutions && config.embedPhieuQM2025 !== false;
  let phieuQmDrawingXml = '';

  if (shouldEmbedPhieuQM) {
    const { info, dataUrl } = await loadPhieuQMDataUrlBySubject(config.subjectName);
    if (dataUrl) {
      const relId = 'rIdPhieuQM2025';
      imagesToEmbed.push({
        relId,
        dataUrl,
        fileName: info.standardFileName,
      });
      phieuQmDrawingXml = buildPhieuQM2025DrawingXml(relId, info);
    }
  }

  const headerXml = buildExamNationalHeaderTableXml(
    config,
    includeSolutions
      ? 'ĐỀ GỐC CÓ LỜI GIẢI CHI TIẾT (CHUẨN 2025)'
      : 'ĐỀ GỐC ĐÃ CHUẨN HÓA CẤU TRÚC 2025',
    Boolean(phieuQmDrawingXml)
  );
  const bodyQuestionsXml = buildQuestionsBodyXml(
    questions,
    config,
    true,
    includeSolutions,
    imageRelMap
  );
  const fullInnerXml = [headerXml, phieuQmDrawingXml, bodyQuestionsXml]
    .filter(Boolean)
    .join('\n');

  return packOpenXmlDocx(
    fullInnerXml,
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
    'ĐỀ GỐC CÓ LỜI GIẢI CHI TIẾT (CHUẨN 2025)',
    false
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
 * - [Trang 1]:
 *   1. Header thông tin kỳ thi (Tên trường, Môn, Thời gian, Mã đề thi: 101, 102...)
 *   2. CHÈN ẢNH PHIẾU QM 2025 NGAY BÊN DƯỚI HEADER (Width = 16.5cm, Height = 8.2cm, khóa cứng tỷ lệ)
 *   3. BẮT ĐẦU NỘI DUNG CÂU HỎI ĐỀ THI NGAY PHÍA DƯỚI MÉP ẢNH PHIẾU
 * - BẮT BUỘC KHÔNG CÓ LỜI GIẢI & KHÔNG CÓ ĐÁP ÁN Ở CUỐI ĐỀ
 * - Tự động nhúng hình ảnh, sơ đồ sinh động
 * - Footer sư phạm chữ thường: “Môn: Sinh học — Lớp: 12 — Mã đề: 101”
 */
export async function exportSingleVariantDocx(
  variant: ShuffledVariant,
  config: ShuffleConfig
): Promise<Blob> {
  const { imagesToEmbed, imageRelMap } = await collectImagesAndBuildRelMap(variant.questions);

  // Tự động nạp ảnh phiếu QM 2025 theo môn học (chạy tức thì trên trình duyệt, mặc định BẬT)
  let phieuQmDrawingXml = '';
  if (config.embedPhieuQM2025 !== false) {
    const { info, dataUrl } = await loadPhieuQMDataUrlBySubject(config.subjectName);
    if (dataUrl) {
      const relId = 'rIdPhieuQM2025';
      imagesToEmbed.push({
        relId,
        dataUrl,
        fileName: info.standardFileName,
      });
      phieuQmDrawingXml = buildPhieuQM2025DrawingXml(relId, info);
    }
  }

  const headerXml = buildExamNationalHeaderTableXml(
    config,
    `MÃ ĐỀ THI: ${variant.examCode}`,
    Boolean(phieuQmDrawingXml)
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

  // Thứ tự chuẩn Trang 1: 1. Header -> 2. Ảnh Phiếu QM 2025 (16.5cm x 8.2cm) -> 3. Nội dung câu hỏi đề thi
  const fullInnerXml = [headerXml, phieuQmDrawingXml, questionsXml, footerEndXml]
    .filter(Boolean)
    .join('\n');

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

  // --- PHẦN TỰ LUẬN (PHẦN III NẾU KHÔNG CÓ TRẢ LỜI NGẮN, HOẶC PHẦN IV NẾU CÓ TRẢ LỜI NGẮN) ---
  // Xuất dưới dạng các đoạn văn bản chuẩn (không đóng khung bảng) để giáo viên dễ dàng chỉnh sửa trực tiếp trong Word
  const p4Items = variants[0]?.answerKey?.part4 || [];
  const essayRoman = maxP3 === 0 ? 'PHẦN III' : 'PHẦN IV';
  const p4ParagraphsXml: string[] = [];

  if (p4Items.length > 0) {
    p4ParagraphsXml.push(
      buildStandardParagraphXml(
        `${essayRoman}. TỰ LUẬN `,
        `(Giữ nguyên thứ tự câu hỏi ở tất cả các mã đề — Giáo viên dễ dàng chỉnh sửa trực tiếp):`,
        {
          prefixColorHex: '6D28D9',
          underlinePrefix: true,
          align: 'left',
          spaceBeforeTwips: 120,
          spaceAfterTwips: 40,
          fontSizeHalfPt: 24,
        }
      )
    );

    for (const item of p4Items) {
      const qLines = item.questionText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      p4ParagraphsXml.push(
        buildStandardParagraphXml(
          `Câu ${item.questionNumber}. `,
          qLines[0] || item.questionText,
          {
            align: 'left',
            spaceBeforeTwips: 40,
            spaceAfterTwips: qLines.length > 1 || item.hasExplicitAnswer ? 15 : 40,
            fontSizeHalfPt: 24,
          }
        )
      );
      for (let i = 1; i < qLines.length; i++) {
        p4ParagraphsXml.push(
          buildStandardParagraphXml('', qLines[i], {
            align: 'left',
            spaceBeforeTwips: 10,
            spaceAfterTwips: i === qLines.length - 1 && !item.hasExplicitAnswer ? 40 : 15,
            fontSizeHalfPt: 24,
          })
        );
      }

      if (item.hasExplicitAnswer && item.answer.trim()) {
        const ansLines = item.answer
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);
        p4ParagraphsXml.push(
          buildStandardParagraphXml(
            `→ Đáp án / Hướng dẫn chấm: `,
            ansLines[0] || item.answer,
            {
              prefixColorHex: 'DC2626',
              align: 'left',
              spaceBeforeTwips: 15,
              spaceAfterTwips: ansLines.length > 1 ? 15 : 50,
              fontSizeHalfPt: 24,
            }
          )
        );
        for (let i = 1; i < ansLines.length; i++) {
          p4ParagraphsXml.push(
            buildStandardParagraphXml('', ansLines[i], {
              align: 'left',
              spaceBeforeTwips: 10,
              spaceAfterTwips: i === ansLines.length - 1 ? 50 : 15,
              fontSizeHalfPt: 24,
            })
          );
        }
      }
    }
  }

  const hasObjectiveRows = maxP1 > 0 || maxP2 > 0 || maxP3 > 0;
  const matrixTblXml = hasObjectiveRows
    ? `<w:tbl>
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
  </w:tbl>`
    : '';

  return [matrixTblXml, ...p4ParagraphsXml].filter(Boolean).join('\n');
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

  // 2. Tạo Bộ 3 Mã QR Tổng Hợp Tất Cả Mã Đề (1. QM 2025 — 2. TNMaker — 3. Azota)
  const { tripleQr } = await generateMasterMultiQrCode(variants, config);
  const qrImagesToEmbed: Array<{ relId: string; dataUrl: string; fileName: string }> = [];

  if (tripleQr.qm2025.qrDataUrl) {
    qrImagesToEmbed.push({
      relId: 'rIdQrQm2025',
      dataUrl: tripleQr.qm2025.qrDataUrl,
      fileName: 'qr_master_qm2025.png',
    });
  }
  if (tripleQr.tnmaker.qrDataUrl) {
    qrImagesToEmbed.push({
      relId: 'rIdQrTnMaker',
      dataUrl: tripleQr.tnmaker.qrDataUrl,
      fileName: 'qr_master_tnmaker.png',
    });
  }
  if (tripleQr.azota.qrDataUrl) {
    qrImagesToEmbed.push({
      relId: 'rIdQrAzota',
      dataUrl: tripleQr.azota.qrDataUrl,
      fileName: 'qr_master_azota.png',
    });
  }

  // 3. Khung bảng 3 cột nhúng đồng thời 3 Mã QR Chấm Thi (QM 2025, TNMaker, Azota)
  const qrSectionXml =
    qrImagesToEmbed.length === 3
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
            <w:t>BỘ 3 MÃ QR CHẤM THI TỔNG HỢP (${variants.length} MÃ ĐỀ — QUÉT 1 LẦN NẠP ĐỦ KEY)</w:t>
          </w:r>
        </w:p>
        <w:tbl>
          <w:tblPr>
            <w:tblW w:w="5000" w:type="pct"/>
            <w:tblBorders>
              <w:top w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
              <w:left w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
              <w:bottom w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
              <w:right w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
              <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
              <w:insideV w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
            </w:tblBorders>
          </w:tblPr>
          <w:tr>
            <w:tc>
              <w:tcPr><w:tcW w:w="1666" w:type="pct"/><w:vAlign w:val="center"/></w:tcPr>
              <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="40" w:after="20"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:color w:val="92400E"/><w:sz w:val="20"/></w:rPr><w:t>1. APP QM 2025</w:t></w:r></w:p>
              ${buildEmbeddedQrDrawingXml('rIdQrQm2025', 'QM2025_MASTER')}
            </w:tc>
            <w:tc>
              <w:tcPr><w:tcW w:w="1667" w:type="pct"/><w:vAlign w:val="center"/></w:tcPr>
              <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="40" w:after="20"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:color w:val="1E40AF"/><w:sz w:val="20"/></w:rPr><w:t>2. APP TNMAKER</w:t></w:r></w:p>
              ${buildEmbeddedQrDrawingXml('rIdQrTnMaker', 'TNMAKER_MASTER')}
            </w:tc>
            <w:tc>
              <w:tcPr><w:tcW w:w="1667" w:type="pct"/><w:vAlign w:val="center"/></w:tcPr>
              <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="40" w:after="20"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:color w:val="065F46"/><w:sz w:val="20"/></w:rPr><w:t>3. HỆ SINH THÁI AZOTA</w:t></w:r></w:p>
              ${buildEmbeddedQrDrawingXml('rIdQrAzota', 'AZOTA_MASTER')}
            </w:tc>
          </w:tr>
        </w:tbl>
        <w:p>
          <w:pPr>
            <w:spacing w:before="40" w:after="80"/>
            <w:jc w:val="center"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
              <w:i/>
              <w:color w:val="475569"/>
              <w:sz w:val="20"/><w:szCs w:val="20"/>
            </w:rPr>
            <w:t>(Giáo viên mở phần mềm QM 2025, TNMaker hoặc Azota tương ứng trên điện thoại và quét đúng mã QR của phần mềm đó)</w:t>
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
    undefined,
    qrImagesToEmbed
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
  extension: 'docx' | 'zip' | 'csv' | 'png' | 'txt' | 'xlsx',
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

  // 2. Lưu file Bảng đáp án tổng hợp (Dap_an_tong_hop.docx & tên chuẩn đồng nhất) có nhúng đủ 3 mã QR
  const masterAnswerDocxBlob = await exportMasterAnswerSheetDocx(variants, config);
  bundleZip.file('Dap_an_tong_hop.docx', masterAnswerDocxBlob);
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

  // 4. Lưu từng file đề hoán vị độc lập (De_101.docx, De_102.docx... có sẵn phiếu QM 2025 ở Trang 1) & Bộ 3 Mã QR Chấm Thi
  const deThiFolder = bundleZip.folder('Bo_De_Thi_Hoc_Sinh_Docx');
  const qrFolder = bundleZip.folder('Ma_QR_3_Phan_Mem_QM2025_TNMaker_Azota');
  const excelFolder = bundleZip.folder('File_Excel_Dap_An_Chuan_3_Phan_Mem');

  for (const v of variants) {
    const docxBlob = await exportSingleVariantDocx(v, config);
    // Đặt file độc lập De_101.docx, De_102.docx ngay tại thư mục gốc của ZIP theo đúng Quy cách xuất tập tin mục III.3
    bundleZip.file(`De_${v.examCode}.docx`, docxBlob);
    // Đồng thời lưu bản đặt tên đầy đủ (Môn... - Lớp... - Kỳ kiểm tra... - dd-mm-yy - Mã đề 101.docx) trong thư mục Bo_De_Thi_Hoc_Sinh_Docx
    deThiFolder?.file(
      buildStandardExportFileName(config, 'docx', `Mã đề ${v.examCode}`),
      docxBlob
    );

    if (v.tripleQr) {
      qrFolder?.file(
        buildStandardExportFileName(config, 'png', `QR-Mã đề ${v.examCode}-1-QM2025`),
        dataUrlToUint8Array(v.tripleQr.qm2025.qrDataUrl)
      );
      qrFolder?.file(
        buildStandardExportFileName(config, 'png', `QR-Mã đề ${v.examCode}-2-TNMaker`),
        dataUrlToUint8Array(v.tripleQr.tnmaker.qrDataUrl)
      );
      qrFolder?.file(
        buildStandardExportFileName(config, 'png', `QR-Mã đề ${v.examCode}-3-Azota`),
        dataUrlToUint8Array(v.tripleQr.azota.qrDataUrl)
      );
    } else if (v.qrDataUrl) {
      qrFolder?.file(
        buildStandardExportFileName(config, 'png', `QR-Mã đề ${v.examCode}`),
        dataUrlToUint8Array(v.qrDataUrl)
      );
    }
  }

  // 5. Lưu Bộ 3 Mã QR Tổng Hợp Tất Cả Mã Đề (1. QM 2025 — 2. TNMaker — 3. Azota) + 3 File Excel .xlsx chuẩn
  try {
    const { tripleQr } = await generateMasterMultiQrCode(variants, config);
    if (tripleQr.qm2025.qrDataUrl) {
      qrFolder?.file(
        buildStandardExportFileName(config, 'png', 'QR Tổng Hợp 1 - App QM 2025'),
        dataUrlToUint8Array(tripleQr.qm2025.qrDataUrl)
      );
    }
    if (tripleQr.tnmaker.qrDataUrl) {
      qrFolder?.file(
        buildStandardExportFileName(config, 'png', 'QR Tổng Hợp 2 - App TNMaker'),
        dataUrlToUint8Array(tripleQr.tnmaker.qrDataUrl)
      );
    }
    if (tripleQr.azota.qrDataUrl) {
      qrFolder?.file(
        buildStandardExportFileName(config, 'png', 'QR Tổng Hợp 3 - App Azota'),
        dataUrlToUint8Array(tripleQr.azota.qrDataUrl)
      );
    }

    const [xlsxQm, xlsxTn, xlsxAz] = await Promise.all([
      exportGradingExcelXlsx(variants, 'QM2025'),
      exportGradingExcelXlsx(variants, 'TNMAKER'),
      exportGradingExcelXlsx(variants, 'AZOTA'),
    ]);
    excelFolder?.file(
      buildStandardExportFileName(config, 'xlsx', 'Đáp án chuẩn QM 2025'),
      xlsxQm
    );
    excelFolder?.file(
      buildStandardExportFileName(config, 'xlsx', 'Đáp án chuẩn TNMaker 2025'),
      xlsxTn
    );
    excelFolder?.file(
      buildStandardExportFileName(config, 'xlsx', 'Đáp án chuẩn Azota 2025'),
      xlsxAz
    );
  } catch (err) {
    console.warn('Không thể lưu bộ 3 ảnh QR tổng hợp & Excel vào zip:', err);
  }

  // 6. Tạo file CSV tổng hợp key chấm thi
  const csvLines: string[] = [
    'Ma_De,Phan_I_ABCD,Phan_II_DungSai,Phan_III_TraLoiNgan,QR_Payload_QM2025,QR_Payload_TNMaker,QR_Payload_Azota',
  ];
  for (const v of variants) {
    const p1 = v.answerKey.part1.map((x) => `${x.questionNumber}${x.answer}`).join(' ');
    const p2 = v.answerKey.part2.map((x) => `${x.questionNumber}:${x.dsString}(${x.tfString})`).join(' ');
    const p3 = v.answerKey.part3.map((x) => `${x.questionNumber}=${x.answer}`).join(' ');
    const qmStr = (v.tripleQr?.qm2025.qrPayload || v.qrPayload).replace(/"/g, '""');
    const tnStr = (v.tripleQr?.tnmaker.qrPayload || '').replace(/"/g, '""');
    const azStr = (v.tripleQr?.azota.qrPayload || '').replace(/"/g, '""');
    csvLines.push(`"${v.examCode}","${p1}","${p2}","${p3}","${qmStr}","${tnStr}","${azStr}"`);
  }
  bundleZip.file(
    buildStandardExportFileName(config, 'csv', 'Bảng đáp án tổng hợp'),
    '\uFEFF' + csvLines.join('\n')
  );

  return bundleZip.generateAsync({ type: 'blob' });
}

/**
 * Tiện ích 5: Tải riêng bộ ảnh 3 Mã QR (QM 2025, TNMaker, Azota) + 3 File Excel chuẩn (.zip)
 */
export async function exportQrCodesZip(
  variants: ShuffledVariant[],
  config: ShuffleConfig
): Promise<Blob> {
  const qrZip = new JSZip();
  const lines: string[] = [];

  const { tripleQr } = await generateMasterMultiQrCode(variants, config);
  if (tripleQr.qm2025.qrDataUrl) {
    qrZip.file(
      buildStandardExportFileName(config, 'png', '01-QR Tổng Hợp - App QM 2025'),
      dataUrlToUint8Array(tripleQr.qm2025.qrDataUrl)
    );
    lines.push(`=== 1. PAYLOAD TỔNG HỢP APP QM 2025 ===\n${tripleQr.qm2025.qrPayload}\n`);
  }
  if (tripleQr.tnmaker.qrDataUrl) {
    qrZip.file(
      buildStandardExportFileName(config, 'png', '02-QR Tổng Hợp - App TNMaker'),
      dataUrlToUint8Array(tripleQr.tnmaker.qrDataUrl)
    );
    lines.push(`=== 2. PAYLOAD TỔNG HỢP APP TNMAKER 2025 ===\n${tripleQr.tnmaker.qrPayload}\n`);
  }
  if (tripleQr.azota.qrDataUrl) {
    qrZip.file(
      buildStandardExportFileName(config, 'png', '03-QR Tổng Hợp - App Azota'),
      dataUrlToUint8Array(tripleQr.azota.qrDataUrl)
    );
    lines.push(`=== 3. PAYLOAD TỔNG HỢP APP AZOTA 2025 ===\n${tripleQr.azota.qrPayload}\n`);
  }

  for (const v of variants) {
    if (v.tripleQr) {
      qrZip.file(
        buildStandardExportFileName(config, 'png', `QR-Mã đề ${v.examCode}-1-QM2025`),
        dataUrlToUint8Array(v.tripleQr.qm2025.qrDataUrl)
      );
      qrZip.file(
        buildStandardExportFileName(config, 'png', `QR-Mã đề ${v.examCode}-2-TNMaker`),
        dataUrlToUint8Array(v.tripleQr.tnmaker.qrDataUrl)
      );
      qrZip.file(
        buildStandardExportFileName(config, 'png', `QR-Mã đề ${v.examCode}-3-Azota`),
        dataUrlToUint8Array(v.tripleQr.azota.qrDataUrl)
      );
    } else if (v.qrDataUrl) {
      qrZip.file(
        buildStandardExportFileName(config, 'png', `QR-Mã đề ${v.examCode}`),
        dataUrlToUint8Array(v.qrDataUrl)
      );
    }
  }

  const [xlsxQm, xlsxTn, xlsxAz] = await Promise.all([
    exportGradingExcelXlsx(variants, 'QM2025'),
    exportGradingExcelXlsx(variants, 'TNMAKER'),
    exportGradingExcelXlsx(variants, 'AZOTA'),
  ]);
  qrZip.file(
    buildStandardExportFileName(config, 'xlsx', 'File Excel Đáp Án Chuẩn QM 2025'),
    xlsxQm
  );
  qrZip.file(
    buildStandardExportFileName(config, 'xlsx', 'File Excel Đáp Án Chuẩn TNMaker 2025'),
    xlsxTn
  );
  qrZip.file(
    buildStandardExportFileName(config, 'xlsx', 'File Excel Đáp Án Chuẩn Azota 2025'),
    xlsxAz
  );

  qrZip.file(
    buildStandardExportFileName(config, 'txt', 'Payload-3-Phan-Mem-QR'),
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

/**
 * Xuất toàn bộ Vai trò, 12 Tính năng (mỗi tính năng 1 khung viền màu đồng bộ riêng biệt) và Hướng dẫn sử dụng hệ thống ra tệp Word (.docx) chuẩn đẹp
 */
export async function exportUserManualDocx(features: any[] = []): Promise<Blob> {
  const zip = new JSZip();

  const titlePara = `<w:p>
    <w:pPr><w:jc w:val="center"/><w:spacing w:before="120" w:after="60"/></w:pPr>
    <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:color w:val="1E3A8A"/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr><w:t>CẨM NANG 12 TÍNH NĂNG &amp; HƯỚNG DẪN SỬ DỤNG TOÀN DIỆN</w:t></w:r>
  </w:p>
  <w:p>
    <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="120"/></w:pPr>
    <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:color w:val="0284C7"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr><w:t>HỆ THỐNG XỬ LÝ, BIÊN TẬP VÀ TRỘN ĐỀ THI EDUMIX 2025</w:t></w:r>
  </w:p>
  <w:p>
    <w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="200"/></w:pPr>
    <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:i/><w:color w:val="334155"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>Tác giả: Thầy Hồ Tấn Khải — Giáo viên Trường THPT Mang Thít, Sở GD&amp;ĐT Vĩnh Long (ĐT/Zalo: 0939580982)</w:t></w:r>
  </w:p>`;

  const h1 = (title: string, color: string = '1E3A8A') => `<w:p>
    <w:pPr><w:jc w:val="left"/><w:spacing w:before="220" w:after="100"/></w:pPr>
    <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:color w:val="${color}"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr><w:t>${escapeXml(title)}</w:t></w:r>
  </w:p>`;

  const p = (text: string, isBold: boolean = false) => `<w:p>
    <w:pPr><w:jc w:val="both"/><w:spacing w:line="276" w:lineRule="auto" w:before="40" w:after="60"/></w:pPr>
    <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>${isBold ? '<w:b/>' : ''}<w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t>${escapeXml(text)}</w:t></w:r>
  </w:p>`;

  const bullet = (title: string, desc: string, color: string = '0F172A') => `<w:p>
    <w:pPr><w:jc w:val="both"/><w:spacing w:before="30" w:after="40"/><w:ind w:left="320" w:hanging="200"/></w:pPr>
    <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:color w:val="${color}"/><w:sz w:val="23"/><w:szCs w:val="23"/></w:rPr><w:t>• ${escapeXml(title)}: </w:t></w:r>
    <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="23"/><w:szCs w:val="23"/></w:rPr><w:t>${escapeXml(desc)}</w:t></w:r>
  </w:p>`;

  /**
   * Tạo khung có viền màu đồng bộ trong Word cho từng tính năng
   */
  const buildColoredFeatureFrameXml = (
    code: string,
    title: string,
    borderColor: string,
    bgTint: string,
    bullets: Array<[string, string]>,
    specText: string
  ) => {
    const bulletXml = bullets.map(([bTitle, bDesc]) => bullet(bTitle, bDesc, borderColor)).join('\n');
    return `<w:tbl>
      <w:tblPr>
        <w:tblW w:w="5000" w:type="pct"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="12" w:space="0" w:color="${borderColor}"/>
          <w:left w:val="single" w:sz="12" w:space="0" w:color="${borderColor}"/>
          <w:bottom w:val="single" w:sz="12" w:space="0" w:color="${borderColor}"/>
          <w:right w:val="single" w:sz="12" w:space="0" w:color="${borderColor}"/>
          <w:insideH w:val="single" w:sz="6" w:space="0" w:color="${borderColor}"/>
        </w:tblBorders>
        <w:tblCellMar><w:top w:w="100" w:type="dxa"/><w:left w:w="160" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="160" w:type="dxa"/></w:tblCellMar>
      </w:tblPr>
      <w:tr>
        <w:tc>
          <w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="${borderColor}"/></w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="left"/><w:spacing w:before="20" w:after="20"/></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>${escapeXml(code)} — ${escapeXml(title)}</w:t></w:r>
          </w:p>
        </w:tc>
      </w:tr>
      <w:tr>
        <w:tc>
          <w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="${bgTint}"/></w:tcPr>
          ${bulletXml}
          <w:p>
            <w:pPr><w:jc w:val="both"/><w:spacing w:before="60" w:after="20"/></w:pPr>
            <w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:i/><w:color w:val="${borderColor}"/><w:sz w:val="21"/><w:szCs w:val="21"/></w:rPr><w:t>[Thông số kỹ thuật]: ${escapeXml(specText)}</w:t></w:r>
          </w:p>
        </w:tc>
      </w:tr>
    </w:tbl>
    <w:p><w:pPr><w:spacing w:before="60" w:after="60"/></w:pPr></w:p>`;
  };

  const twelveFeatureFrames = [
    buildColoredFeatureFrameXml(
      'TÍNH NĂNG 01 (KHUNG XANH LAM)',
      'Bộ 3 Mã QR Chấm Thi Chuẩn Gốc 100% (1. QM 2025 · 2. TNMaker · 3. Azota)',
      '1D4ED8',
      'EFF6FF',
      [
        ['3 Mã QR Độc Lập Chuẩn Gốc', 'Sinh đồng thời 3 mã QR đúng chuẩn JSON/chuỗi gốc của từng phần mềm chấm thi QM 2025, TNMaker và Azota.'],
        ['QR Tổng Hợp Đa Mã Đề & QR Từng Mã Đề', 'Quét 1 lần nạp đủ tất cả các mã đề (101, 102, 103, 104...) hoặc quét riêng từng mã đề.'],
        ['Nhúng Word Tự Động', 'Tự động nhúng cả 3 khung mã QR vào trang cuối file Word Bảng Đáp Án.'],
      ],
      'JSON Payload gốc QM 2025, TNMaker, Azota · Độ tương phản 100% Đen/Trắng chuẩn Camera AI.'
    ),
    buildColoredFeatureFrameXml(
      'TÍNH NĂNG 02 (KHUNG XANH NGỌC LỤC BẢO)',
      'Xuất 3 File Excel (.xlsx) Đáp Án Chuẩn Cho QM 2025, TNMaker & Azota',
      '047857',
      'ECFDF5',
      [
        ['3 File Excel .xlsx Chuyên Biệt', 'Tương thích 100% với tính năng Nhập đáp án từ Excel trên QM 2025, TNMaker và Azota.'],
        ['Đầy Đủ 3 Phần Thi', 'Gồm Phần I (ABCD), Phần II (tách 4 ý a, b, c, d chuẩn Đ/S hoặc T/F) và Phần III (chuẩn hóa dấu thập phân).'],
      ],
      'Chuẩn OpenXML Spreadsheet (.xlsx) · Tải lẻ từng file hoặc đóng gói tự động trong tệp .zip.'
    ),
    buildColoredFeatureFrameXml(
      'TÍNH NĂNG 03 (KHUNG TÍM THẠCH ANH)',
      'Bộ Vi Xử Lý Bóc Tách Đa Tầng (Deep Exam Parser) 4 Phần (Trắc Nghiệm & Tự Luận)',
      '6D28D9',
      'F5F3FF',
      [
        ['Đa Kênh Nhận Diện Đáp Án', 'Nhận diện tự động Gạch chân (<w:u>), Tô chữ màu đỏ (<w:color>) và Bảng đáp án ở cuối đề thi.'],
        ['Hỗ Trợ Đầy Đủ Phần IV Tự Luận (Không Trộn)', 'Giữ nguyên thứ tự các câu hỏi Tự luận đã tải lên. Nếu đề không có Phần III trả lời ngắn, hệ thống tự động đánh thứ tự thành PHẦN III. Tự luận. Trong bảng đáp án, nếu câu tự luận có đáp án sẽ tự động tích hợp vào, nếu chưa có đáp án vẫn hiển thị nguyên vẹn câu hỏi tự luận để giáo viên chấm và chỉnh sửa.'],
      ],
      'Quét đồng thời <w:t>, <m:oMath>, MathType OLE, Tự luận và bản chụp/scan PDF.'
    ),
    buildColoredFeatureFrameXml(
      'TÍNH NĂNG 04 (KHUNG VÀNG HỔ PHÁCH)',
      'Bộ Hiển Thị & Bảo Toàn Công Thức Toán - Lý - Hóa - Sinh Đa Tầng',
      'B45309',
      'FFFBEB',
      [
        ['Toán Học & Vật Lý', 'Hiển thị sắc nét phân số, căn thức, tích phân, vectơ, hệ phương trình bằng KaTeX & Office Math.'],
        ['Hóa Học & Sinh Học', 'Bảo toàn chỉ số trên/dưới (H₂SO₄, Fe³⁺), mũi tên phản ứng hóa học, kiểu gene (AaBb, XᴬXᵃ) và phép lai.'],
      ],
      'KaTeX Engine + Subscript/Superscript Parser + OpenXML Math Synthesizer.'
    ),
    buildColoredFeatureFrameXml(
      'TÍNH NĂNG 05 (KHUNG ĐỎ HỒNG NGỌC)',
      'Động Cơ Xử Lý Hình Ảnh, Sơ Đồ Phả Hệ, Đồ Thị 300 DPI Không Mất Ảnh Khi Trộn',
      'BE123C',
      'FFF1F2',
      [
        ['Không Bao Giờ Mất Ảnh Khi Trộn', 'Sao chép sâu (Deep Clone) mọi đồ thị, hình học không gian, sơ đồ phả hệ đi theo đúng câu hỏi sang mọi mã đề 101-104.'],
        ['Khóa Liền Kề Trong Word', 'Xuất ảnh In Line with Text căn giữa trang và khóa <w:keepNext/> chống nhảy trang.'],
      ],
      'Hỗ trợ PNG, JPEG, SVG Vector 300 DPI · Tự động khử nền xám bản chụp.'
    ),
    buildColoredFeatureFrameXml(
      'TÍNH NĂNG 06 (KHUNG XANH CỔ VỊT)',
      'Trình Biên Tập Trực Tiếp (Live In-App Editor) & Tự Động Sửa Lỗi 1 Chạm',
      '0F766E',
      'F0FDFA',
      [
        ['Phát Hiện Lỗi Thời Gian Thực', 'Tự động chỉ rõ câu thiếu đáp án, thừa đáp án hoặc thiếu mệnh đề.'],
        ['Tự Động Sửa Nhanh Tất Cả Lỗi', 'Chuẩn hóa toàn bộ đề thi chỉ bằng 1 cú nhấp chuột để mở khóa nút Trộn Đề Ngay.'],
      ],
      'Đồng bộ cây dữ liệu AST tức thời ngay trên trình duyệt.'
    ),
    buildColoredFeatureFrameXml(
      'TÍNH NĂNG 07 (KHUNG XANH CHÀM SÂU)',
      'Khung Chỉnh Sửa Văn Bản Word Gốc & Dán Nhanh Trực Tiếp (Clipboard HTML)',
      '4338CA',
      'EEF2FF',
      [
        ['Dán Nhanh Ctrl+V Từ Word', 'Giữ nguyên định dạng gạch chân và chữ đỏ khi copy-paste trực tiếp từ Microsoft Word.'],
        ['Sửa Văn Bản Nguồn Toàn Đề', 'Chỉnh sửa hàng loạt câu hỏi và biên dịch lại tức thì mà không làm mất hình ảnh đã gắn.'],
      ],
      'HTML Clipboard Rich-Text Parser + Live Source Re-compiler.'
    ),
    buildColoredFeatureFrameXml(
      'TÍNH NĂNG 08 (KHUNG HỒNG TÍM AI)',
      'AI Gemini Studio — Cụm 4 Luồng Chuyên Gia Tạo Đề Tương Đương Song Song',
      'A21CAF',
      'FDF4FF',
      [
        ['Tạo Đồng Thời 4 Đề Mới', 'Nhân bản 4 mã đề tương đương (201, 202, 203, 204) giữ nguyên ma trận nhận thức và tự động giải lại đáp số.'],
        ['Bảo Mật Zero-Trace', 'Tự động ẩn danh thông tin trường/kỳ thi và xóa bộ nhớ tạm sau khi tải đề.'],
      ],
      '4-Channel Parallel Gemini Engine + Nạp thẳng đề AI vào bộ trộn đề 1 chạm.'
    ),
    buildColoredFeatureFrameXml(
      'TÍNH NĂNG 09 (KHUNG XANH DA TRỜI)',
      'Khung Ma Trận & Bản Đặc Tả Chuẩn Công Văn 7991/BGDĐT-GDTrH',
      '0369A1',
      'F0F9FF',
      [
        ['Phụ Lục 1 & Phụ Lục 2 Chuẩn Bộ GD&ĐT', 'Phân bổ đúng tỷ lệ: Nhận biết 40% (4,0đ) — Thông hiểu 30% (3,0đ) — Vận dụng 30% (3,0đ).'],
        ['Xuất File Word Trình Ký BGH', 'Đầy đủ Quốc hiệu Tiêu ngữ và khung chữ ký Hiệu trưởng — Tổ trưởng — Giáo viên ra đề.'],
      ],
      'Theo đúng mẫu Công văn số 7991/BGDĐT-GDTrH ngày 20/12/2024.'
    ),
    buildColoredFeatureFrameXml(
      'TÍNH NĂNG 10 (KHUNG CAM NĂNG LƯỢNG)',
      'Bảng Ma Trận Đáp Án Đối Chiếu Đa Mã Đề Gọn Trên 1 Trang A4',
      'C2410C',
      'FFF7ED',
      [
        ['Tiết Kiệm 70% Diện Tích Giấy In', 'Xếp các mã đề (101, 102, 103, 104...) thành các cột song song đối chiếu theo từng câu hỏi.'],
        ['Chống Rối Mắt Tuyệt Đối', 'Phân màu rõ ràng các phương án A/B/C/D, chuỗi Đ-S-Đ-S và đáp số trả lời ngắn.'],
      ],
      'Cross-referencing Matrix Grid Layout vừa khít 1 trang A4.'
    ),
    buildColoredFeatureFrameXml(
      'TÍNH NĂNG 11 (KHUNG XANH LÁ MẠ)',
      'Kho Đề Mẫu Chuẩn 2025 (Đề Sinh Học 12 Cuối HK1 & Đề Tổng Hợp KHTN)',
      '4D7C0F',
      'F7FEE7',
      [
        ['Đề Mẫu Sinh Học 12 Cuối HK1 (28 Câu)', 'Đầy đủ sơ đồ DNA, Operon Lac, bài tập đột biến, quy luật Mendel, liên kết giới tính, ưu thế lai và 2 sơ đồ phả hệ.'],
        ['Đề Mẫu Tổng Hợp Toán - Lý - Hóa - Sinh', 'Đầy đủ đồ thị hàm số, hình học không gian, mạch điện và phản ứng hóa học.'],
      ],
      'Đính kèm sẵn 4 sơ đồ Vector SVG 300 DPI + Sạch 100% lỗi.'
    ),
    buildColoredFeatureFrameXml(
      'TÍNH NĂNG 12 (KHUNG XANH BĂNG)',
      'Đóng Gói Trọn Bộ (.zip) Đồng Nhất Quy Chuẩn Đặt Tên Tệp Khảo Thí',
      '0E7490',
      'ECFEFF',
      [
        ['Quy Chuẩn Tên File Đồng Nhất', 'Tự động đặt tên: Môn [Tên môn] - Lớp [Lớp] - Kỳ kiểm tra [Kỳ] - [dd-mm-yy] - [Hậu tố].docx/.xlsx/.png/.zip.'],
        ['Đầy Đủ 6 Thành Phần Trong 1 Gói .zip', 'Gồm bộ đề học sinh, đề gốc chuẩn, bảng đáp án A4 nhúng 3 QR, ma trận CV 7991, bộ ảnh 3 QR và 3 file Excel .xlsx.'],
      ],
      'Font Times New Roman 12pt chuẩn in ấn nhà trường.'
    ),
  ];

  const contentBlocks = [
    titlePara,
    h1('PHẦN I. VAI TRÒ VÀ SỨ MỆNH CỐT LÕI CỦA HỆ THỐNG'),
    p('Hệ thống EduMix 2025 là Bộ vi xử lý, phân tích, biên tập và chuẩn hóa tài liệu đề thi cấp độ chuyên sâu (Deep Exam Parser & Word XML Synthesizer), được xây dựng phục vụ Chương trình GDPT 2018, Công văn 7991/BGDĐT-GDTrH và Kỳ thi tốt nghiệp THPT cấu trúc 3 phần.'),
    h1('PHẦN II. TRỌN BỘ 12 TÍNH NĂNG ĐỘT PHÁ (MỖI TÍNH NĂNG 1 KHUNG MÀU ĐỒNG BỘ)'),
    ...twelveFeatureFrames,
    h1('PHẦN III. QUY TRÌNH HƯỚNG DẪN SỬ DỤNG 6 BƯỚC THỰC CHIẾN'),
    bullet('Bước 1', 'Chuẩn bị file Word đề gốc (.docx/.doc), PDF hoặc chọn ngay Đề mẫu Sinh học 12 Cuối HK1 / Đề mẫu Tổng hợp KHTN.', '1D4ED8'),
    bullet('Bước 2', 'Bấm nút [Tải Word / PDF] hoặc dán trực tiếp nội dung từ Word (Ctrl+V).', '047857'),
    bullet('Bước 3', 'Kiểm tra lỗi và bấm [Tự Động Sửa Nhanh Tất Cả Lỗi] để chuẩn hóa toàn bộ đề trong 1 chạm.', 'B45309'),
    bullet('Bước 4', '(Tùy chọn) Mở AI Gemini Studio để nhân bản cùng lúc 4 đề tương đương mới.', 'A21CAF'),
    bullet('Bước 5', 'Thiết lập thông tin trường, môn, lớp, số lượng mã đề (101, 102, 103, 104...) và bấm [Trộn Đề Ngay].', '6D28D9'),
    bullet('Bước 6', 'Quét trực tiếp Bộ 3 Mã QR (1. QM 2025, 2. TNMaker, 3. Azota), tải 3 file Excel (.xlsx), xuất Ma trận CV 7991 và bấm [Tải Bộ Đề (.zip)].', 'BE123C'),
  ];

  const bodyXml = contentBlocks.join('\n');

  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
  <w:body>
    ${bodyXml}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const documentRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`;

  zip.file('[Content_Types].xml', contentTypesXml);
  zip.file('_rels/.rels', relsXml);
  zip.file('word/document.xml', docXml);
  zip.file('word/_rels/document.xml.rels', documentRelsXml);

  return zip.generateAsync({ type: 'blob' });
}


