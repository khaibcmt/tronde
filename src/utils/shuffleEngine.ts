import QRCode from 'qrcode';
import JSZip from 'jszip';
import {
  ExamQuestion,
  OptionPart1,
  QRAppFormat,
  ShuffleConfig,
  ShuffledVariant,
  SubItemPart2,
  TripleGradingQrSet,
} from '../types/exam';
import { computeAutoLayoutForOptions } from './docxParser';
import { assignDeterministicImageTagsToQuestions } from './scientificExamProcessor';

/**
 * Thuật toán hoán vị Fisher-Yates chuẩn xác (Mục I.2.4)
 */
export function fisherYatesShuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

/**
 * Sinh danh sách mã đề duy nhất (3 chữ số hoặc 4 chữ số)
 */
export function generateExamCodes(count: number, digits: 3 | 4): string[] {
  const codes: string[] = [];
  const startBase = digits === 3 ? 101 : 1001;
  for (let i = 0; i < count; i++) {
    codes.push(String(startBase + i));
  }
  return codes;
}

/**
 * 1. CHUẨN PAYLOAD CHÍNH THỨC CỦA APP CHẤM THI QM 2025 (qrcode2025.youngmix.vn)
 * - Cấu trúc mảng 2 chiều JSON: [[MaDe, ...Phan1(A/B/C/D), ...Phan2(D/S), ...Phan3(Number)], ...]
 * - Đúng chuẩn 100% thuật toán processExcelData() & generateQRCode() của QM 2025
 */
export function buildQm2025OfficialQrPayload(
  variants: Array<{ examCode: string; answerKey: ShuffledVariant['answerKey'] }>
): string {
  const rows = variants.map((v) => {
    const rawCode = String(v.examCode).trim();
    const codeCell: number | string =
      /^\d+$/.test(rawCode) && !/^0\d+/.test(rawCode) ? Number(rawCode) : rawCode;

    const p1Cells = [...v.answerKey.part1]
      .sort((a, b) => a.questionNumber - b.questionNumber)
      .map((item) => item.answer);

    // Trong dapanQM2025.xlsx, mỗi ý con a, b, c, d của Phần II là 1 phần tử "D" (Đúng) hoặc "S" (Sai)
    const p2Cells: string[] = [];
    [...v.answerKey.part2]
      .sort((a, b) => a.questionNumber - b.questionNumber)
      .forEach((item) => {
        item.answers.forEach((ans) => {
          p2Cells.push(ans === 'Đ' ? 'D' : 'S');
        });
      });

    // Trong dapanQM2025.xlsx, mỗi câu Phần III là giá trị số (dùng dấu chấm thập phân)
    const p3Cells: (number | string)[] = [...v.answerKey.part3]
      .sort((a, b) => a.questionNumber - b.questionNumber)
      .map((item) => {
        const cleaned = String(item.answer).trim().replace(',', '.');
        const num = Number(cleaned);
        return !isNaN(num) && cleaned !== '' ? num : cleaned;
      });

    return [codeCell, ...p1Cells, ...p2Cells, ...p3Cells];
  });

  return JSON.stringify(rows);
}

/**
 * 2. CHUẨN PAYLOAD CHÍNH THỨC CỦA APP TNMAKER 2025 (qr-code.tnmaker.net - TLTN-BGD-2025)
 * - Cấu trúc JSON Object:
 *   { "101": "<Phan1>#<P2_Cau1>_<P2_Cau2>_...#<P3_Cau1>_<P3_Cau2>_...", ..., "success": true, "type": 5 }
 * - Trong đó:
 *   + Phần I: Chuỗi liền các đáp án A, B, C, D (VD: "CBAD...")
 *   + Phần II: Ngăn cách bắt đầu bằng "#", mỗi câu gồm 4 ký tự "Đ"/"S" nối với nhau bằng "_" (VD: "#ĐSĐĐ_SĐSĐ_ĐĐSĐ_SĐĐS")
 *   + Phần III: Ngăn cách bắt đầu bằng "#", mỗi đáp số dùng dấu chấm thập phân nối với nhau bằng "_" (VD: "#2700_299_28.125_16_20_88.9")
 */
export function buildTnMaker2025OfficialQrPayload(
  variants: Array<{ examCode: string; answerKey: ShuffledVariant['answerKey'] }>
): string {
  const resultObj: Record<string, any> = {
    success: true,
    type: 5,
  };

  for (const v of variants) {
    const codeKey = String(v.examCode).trim().replace(/['" ]/g, '');

    const p1Seq = [...v.answerKey.part1]
      .sort((a, b) => a.questionNumber - b.questionNumber)
      .map((item) => item.answer)
      .join('');

    const p2Groups = [...v.answerKey.part2]
      .sort((a, b) => a.questionNumber - b.questionNumber)
      .map((item) => item.answers.map((a) => (a === 'Đ' ? 'Đ' : 'S')).join(''));

    const p3Groups = [...v.answerKey.part3]
      .sort((a, b) => a.questionNumber - b.questionNumber)
      .map((item) =>
        String(item.answer)
          .trim()
          .replace(/['" ]/g, '')
          .replace(',', '.')
      );

    let encodedStr = p1Seq;
    if (p2Groups.length > 0) {
      encodedStr += '#' + p2Groups.join('_');
    }
    if (p3Groups.length > 0) {
      encodedStr += '#' + p3Groups.join('_');
    }

    resultObj[codeKey] = encodedStr;
  }

  return JSON.stringify(resultObj);
}

/**
 * 3. CHUẨN PAYLOAD CHÍNH THỨC CỦA AZOTA 2025 (processExcelDataAzota - dapanAzota2025.xlsx)
 * - Cấu trúc mảng 2 chiều JSON: [["101", ...Phan1(A/B/C/D), ...Phan2("Đ"/"S"), ...Phan3("28,125")], ...]
 * - Giữ nguyên mã đề dạng chuỗi, Phần II tách từng ký tự "Đ"/"S" (có gạch ngang chữ Đ), Phần III giữ dấu phẩy thập phân chuẩn Việt Nam
 */
export function buildAzota2025OfficialQrPayload(
  variants: Array<{ examCode: string; answerKey: ShuffledVariant['answerKey'] }>
): string {
  const rows = variants.map((v) => {
    const codeStr = String(v.examCode).trim();

    const p1Cells = [...v.answerKey.part1]
      .sort((a, b) => a.questionNumber - b.questionNumber)
      .map((item) => item.answer);

    const p2Cells: string[] = [];
    [...v.answerKey.part2]
      .sort((a, b) => a.questionNumber - b.questionNumber)
      .forEach((item) => {
        item.answers.forEach((ans) => {
          p2Cells.push(ans === 'Đ' ? 'Đ' : 'S');
        });
      });

    const p3Cells: string[] = [...v.answerKey.part3]
      .sort((a, b) => a.questionNumber - b.questionNumber)
      .map((item) => String(item.answer).trim().replace('.', ','));

    return [codeStr, ...p1Cells, ...p2Cells, ...p3Cells];
  });

  return JSON.stringify(rows);
}

/**
 * Xây dựng chuỗi Payload QR theo định dạng được chọn (dùng cho cả 1 mã đề hoặc nhiều mã đề)
 */
export function buildQrPayloadString(
  examCode: string,
  answerKey: ShuffledVariant['answerKey'],
  format: QRAppFormat
): string {
  const singleList = [{ examCode, answerKey }];
  if (format === 'QM2025') {
    return buildQm2025OfficialQrPayload(singleList);
  }
  if (format === 'TNMAKER') {
    return buildTnMaker2025OfficialQrPayload(singleList);
  }
  if (format === 'AZOTA') {
    return buildAzota2025OfficialQrPayload(singleList);
  }
  return buildQm2025OfficialQrPayload(singleList);
}

/**
 * Vẽ thêm nhãn nhận diện bên dưới vùng trắng (quiet zone) của ảnh QR giống chuẩn Chấm thi QM2025
 * Đảm bảo không chạm vào các điểm ảnh QR nên quét 100% nhạy trên mọi camera điện thoại
 */
async function addBottomCaptionToQrDataUrl(
  baseQrDataUrl: string,
  captionText: string,
  captionColor: string
): Promise<string> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return baseQrDataUrl;
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.width;
        const h = img.height;
        const extraHeight = Math.round(h * 0.11);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h + extraHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(baseQrDataUrl);
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        ctx.fillStyle = captionColor;
        ctx.font = `bold ${Math.max(12, Math.round(h * 0.048))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(captionText, w / 2, h + extraHeight * 0.48);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(baseQrDataUrl);
      }
    };
    img.onerror = () => resolve(baseQrDataUrl);
    img.src = baseQrDataUrl;
  });
}

/**
 * Sinh đồng thời Bộ 3 Mã QR Chấm Thi Chuẩn Quốc Gia (1. QM 2025 — 2. TNMaker — 3. Azota)
 * cho danh sách các mã đề truyền vào (có thể là 1 mã đề hoặc toàn bộ 4+ mã đề)
 */
export async function generateTripleGradingQrSet(
  variants: Array<{ examCode: string; answerKey: ShuffledVariant['answerKey'] }>
): Promise<TripleGradingQrSet> {
  const qm2025Payload = buildQm2025OfficialQrPayload(variants);
  const tnmakerPayload = buildTnMaker2025OfficialQrPayload(variants);
  const azotaPayload = buildAzota2025OfficialQrPayload(variants);

  const [rawQm2025Url, rawTnMakerUrl, rawAzotaUrl] = await Promise.all([
    // 1. QM 2025: errorCorrectionLevel: 'L', margin: 1 giống hệt qrcode2025.youngmix.vn
    QRCode.toDataURL(qm2025Payload, {
      errorCorrectionLevel: 'L',
      margin: 2,
      width: 380,
      color: { dark: '#000000', light: '#FFFFFF' },
    }),
    // 2. TNMaker: errorCorrectionLevel: 'M' (hoặc 'L' nếu nhiều đề), độ tương phản tuyệt đối
    QRCode.toDataURL(tnmakerPayload, {
      errorCorrectionLevel: variants.length <= 4 ? 'M' : 'L',
      margin: 2,
      width: 380,
      color: { dark: '#000000', light: '#FFFFFF' },
    }),
    // 3. Azota 2025: errorCorrectionLevel: 'L', margin: 2
    QRCode.toDataURL(azotaPayload, {
      errorCorrectionLevel: 'L',
      margin: 2,
      width: 380,
      color: { dark: '#000000', light: '#FFFFFF' },
    }),
  ]);

  const codeSuffix =
    variants.length === 1
      ? ` (Mã ${variants[0].examCode})`
      : ` (${variants.length} Mã đề)`;

  const [qm2025DataUrl, tnmakerDataUrl, azotaDataUrl] = await Promise.all([
    addBottomCaptionToQrDataUrl(
      rawQm2025Url,
      `Chấm thi QM2025${codeSuffix}`,
      '#c49054'
    ),
    addBottomCaptionToQrDataUrl(
      rawTnMakerUrl,
      `TNMaker 2025${codeSuffix}`,
      '#1d4ed8'
    ),
    addBottomCaptionToQrDataUrl(
      rawAzotaUrl,
      `Azota 2025${codeSuffix}`,
      '#047857'
    ),
  ]);

  return {
    qm2025: {
      appId: 'QM2025',
      appName: '1. App QM 2025 (Chấm thi QM)',
      qrPayload: qm2025Payload,
      qrDataUrl: qm2025DataUrl,
    },
    tnmaker: {
      appId: 'TNMAKER',
      appName: '2. App TNMaker 2025',
      qrPayload: tnmakerPayload,
      qrDataUrl: tnmakerDataUrl,
    },
    azota: {
      appId: 'AZOTA',
      appName: '3. Hệ sinh thái Azota 2025',
      qrPayload: azotaPayload,
      qrDataUrl: azotaDataUrl,
    },
  };
}

/**
 * Thực thi trộn bộ đề theo cấu hình chuẩn 3 phần (Phần I, II, III)
 * Tự động sinh cả 3 Mã QR (QM 2025, TNMaker, Azota) cho từng mã đề
 */
export async function generateShuffledVariants(
  sourceQuestions: ExamQuestion[],
  config: ShuffleConfig
): Promise<ShuffledVariant[]> {
  const defaultCodes = generateExamCodes(config.numVariants, config.examCodeDigits);
  const codes =
    config.customCodes && config.customCodes.length > 0
      ? Array.from({ length: config.numVariants }, (_, i) => {
          const custom = config.customCodes?.[i]?.trim();
          return custom || defaultCodes[i];
        })
      : defaultCodes;
  const variants: ShuffledVariant[] = [];

  const part1Source = sourceQuestions.filter((q) => q.part === 'PART_1');
  const part2Source = sourceQuestions.filter((q) => q.part === 'PART_2');
  const part3Source = sourceQuestions.filter((q) => q.part === 'PART_3');
  const part4Source = sourceQuestions.filter((q) => q.part === 'PART_4');

  const labelsP1: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];
  const labelsP2: ('a' | 'b' | 'c' | 'd')[] = ['a', 'b', 'c', 'd'];

  for (const examCode of codes) {
    // 1. Trộn thứ tự câu trong từng phần trắc nghiệm độc lập (Phần IV Tự luận giữ nguyên thứ tự gốc, KHÔNG trộn)
    const p1Questions = config.shuffleQuestions
      ? fisherYatesShuffle(part1Source)
      : [...part1Source];
    const p2Questions = config.shuffleQuestions
      ? fisherYatesShuffle(part2Source)
      : [...part2Source];
    const p3Questions = config.shuffleQuestions
      ? fisherYatesShuffle(part3Source)
      : [...part3Source];
    const p4Questions = [...part4Source];

    let continuousCounter = 1;

    // 2. Xử lý Phần I: Đảo phương án A, B, C, D và gán lại nhãn
    const processedP1: ExamQuestion[] = p1Questions.map((q, idx) => {
      const rawOptions = q.options ? [...q.options] : [];
      const shuffledOpts = config.shuffleOptionsPart1
        ? fisherYatesShuffle(rawOptions)
        : rawOptions;

      const relabeledOpts: OptionPart1[] = shuffledOpts.map((opt, optIdx) => ({
        ...opt,
        currentLabel: labelsP1[optIdx] || 'A',
      }));

      const displayIndex = config.resetNumberingPerPart
        ? idx + 1
        : continuousCounter++;

      const autoLayout = computeAutoLayoutForOptions(relabeledOpts);
      const finalLayout =
        config.layoutOverride === 'AUTO' ? autoLayout : config.layoutOverride;

      return {
        ...q,
        displayIndex,
        options: relabeledOpts,
        computedLayout: finalLayout,
      };
    });

    // 3. Xử lý Phần II: Đảo 4 ý con a, b, c, d trong nội bộ câu và gán lại nhãn a, b, c, d
    const processedP2: ExamQuestion[] = p2Questions.map((q, idx) => {
      const rawSubs = q.subItems ? [...q.subItems] : [];
      const shuffledSubs = config.shuffleSubItemsPart2
        ? fisherYatesShuffle(rawSubs)
        : rawSubs;

      const relabeledSubs: SubItemPart2[] = shuffledSubs.map((sub, subIdx) => ({
        ...sub,
        currentLabel: labelsP2[subIdx] || 'a',
      }));

      const displayIndex = config.resetNumberingPerPart
        ? idx + 1
        : continuousCounter++;

      return {
        ...q,
        displayIndex,
        subItems: relabeledSubs,
      };
    });

    // 4. Xử lý Phần III: Chỉ đảo thứ tự câu hỏi, giữ nguyên nội dung câu
    const processedP3: ExamQuestion[] = p3Questions.map((q, idx) => {
      const displayIndex = config.resetNumberingPerPart
        ? idx + 1
        : continuousCounter++;

      return {
        ...q,
        displayIndex,
      };
    });

    // 5. Xử lý Phần IV (Tự luận): Giữ nguyên 100% thứ tự câu hỏi và nội dung gốc, không trộn
    const processedP4: ExamQuestion[] = p4Questions.map((q, idx) => {
      const displayIndex = config.resetNumberingPerPart
        ? idx + 1
        : continuousCounter++;

      return {
        ...q,
        displayIndex,
      };
    });

    // 6. Tổng hợp bảng đáp án cho mã đề này
    const answerKeyP1 = processedP1.map((q) => {
      const correctOpt = (q.options || []).find((o) => o.isCorrect);
      return {
        questionNumber: q.displayIndex,
        answer: (correctOpt ? correctOpt.currentLabel : 'A') as 'A' | 'B' | 'C' | 'D',
      };
    });

    const answerKeyP2 = processedP2.map((q) => {
      const subs = q.subItems || [];
      const answers = subs.map((s) => (s.isTrue ? 'Đ' : 'S')) as ('Đ' | 'S')[];
      const tfString = subs.map((s) => (s.isTrue ? 'T' : 'F')).join('');
      const dsString = answers.join('');
      return {
        questionNumber: q.displayIndex,
        answers,
        tfString,
        dsString,
      };
    });

    const answerKeyP3 = processedP3.map((q) => ({
      questionNumber: q.displayIndex,
      answer: (q.shortAnswer || '0').trim(),
    }));

    const answerKeyP4 = processedP4.map((q) => {
      const explicitAns = (q.essayAnswer || q.explanation || q.shortAnswer || '').trim();
      return {
        questionNumber: q.displayIndex,
        questionText: q.stemText.trim(),
        answer: explicitAns,
        hasExplicitAnswer: Boolean(explicitAns),
      };
    });

    const answerKey = {
      part1: answerKeyP1,
      part2: answerKeyP2,
      part3: answerKeyP3,
      part4: answerKeyP4,
    };

    // Sinh đủ 3 mã QR (QM 2025, TNMaker, Azota) cho mã đề này
    const tripleQr = await generateTripleGradingQrSet([{ examCode, answerKey }]);

    const selectedQr =
      config.qrFormat === 'TNMAKER'
        ? tripleQr.tnmaker
        : config.qrFormat === 'AZOTA'
        ? tripleQr.azota
        : tripleQr.qm2025;

    variants.push({
      examCode,
      createdAt: new Date().toLocaleTimeString('vi-VN'),
      questions: assignDeterministicImageTagsToQuestions([
        ...processedP1,
        ...processedP2,
        ...processedP3,
        ...processedP4,
      ]),
      qrPayload: selectedQr.qrPayload,
      qrDataUrl: selectedQr.qrDataUrl,
      tripleQr,
      answerKey,
    });
  }

  return variants;
}

/**
 * Sinh Bộ 3 Mã QR Tổng Hợp Đa Mã Đề (Master Multi-Exam QR Code) tích hợp toàn bộ các mã đề
 * cho cả 3 phần mềm: 1. QM 2025 — 2. TNMaker — 3. Azota
 */
export async function generateMasterMultiQrCode(
  variants: ShuffledVariant[],
  config: ShuffleConfig
): Promise<{
  qrDataUrl: string;
  qrPayload: string;
  tripleQr: TripleGradingQrSet;
}> {
  if (!variants || variants.length === 0) {
    const emptyItem = {
      appId: 'QM2025' as const,
      appName: '',
      qrPayload: '',
      qrDataUrl: '',
    };
    return {
      qrDataUrl: '',
      qrPayload: '',
      tripleQr: {
        qm2025: { ...emptyItem, appId: 'QM2025' },
        tnmaker: { ...emptyItem, appId: 'TNMAKER' },
        azota: { ...emptyItem, appId: 'AZOTA' },
      },
    };
  }

  const tripleQr = await generateTripleGradingQrSet(variants);
  const primary =
    config.qrFormat === 'TNMAKER'
      ? tripleQr.tnmaker
      : config.qrFormat === 'AZOTA'
      ? tripleQr.azota
      : tripleQr.qm2025;

  return {
    qrDataUrl: primary.qrDataUrl,
    qrPayload: primary.qrPayload,
    tripleQr,
  };
}

/**
 * Helper chuyển số cột (0-indexed) sang tên cột Excel (A, B, ..., Z, AA, AB...)
 */
function encodeExcelCol(colIndex: number): string {
  let n = colIndex + 1;
  let colName = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    colName = String.fromCharCode(65 + rem) + colName;
    n = Math.floor((n - 1) / 26);
  }
  return colName;
}

function escapeXmlCell(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Đóng gói mảng 2 chiều thành tệp Excel (.xlsx) chuẩn OpenXML SpreadsheetML
 * tương thích 100% với SheetJS trên qrcode2025.youngmix.vn, qr-code.tnmaker.net và Azota
 */
async function packRowsToXlsxBlob(
  rows: Array<Array<string | number>>,
  sheetName: string = 'Sheet1'
): Promise<Blob> {
  const zip = new JSZip();

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`
  );

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
  );

  zip.file(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${escapeXmlCell(sheetName)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`
  );

  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`
  );

  const rowXmls = rows.map((row, rIdx) => {
    const rowNum = rIdx + 1;
    const cellXmls = row
      .map((val, cIdx) => {
        if (val === undefined || val === null || val === '') return '';
        const cellRef = `${encodeExcelCol(cIdx)}${rowNum}`;
        if (typeof val === 'number' && !isNaN(val)) {
          return `<c r="${cellRef}"><v>${val}</v></c>`;
        }
        return `<c r="${cellRef}" t="inlineStr"><is><t>${escapeXmlCell(String(val))}</t></is></c>`;
      })
      .filter(Boolean)
      .join('');
    return `<row r="${rowNum}">${cellXmls}</row>`;
  });

  zip.file(
    'xl/worksheets/sheet1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    ${rowXmls.join('\n    ')}
  </sheetData>
</worksheet>`
  );

  return zip.generateAsync({
    type: 'blob',
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Tạo File Excel (.xlsx) Đáp Án Chuẩn Quốc Gia cho từng phần mềm:
 * - QM2025: Chuẩn file dapanQM2025.xlsx (YoungMix 2025)
 * - TNMAKER: Chuẩn file TLTN-BGD-2025-SmartTest.xlsx / YoungMix.xlsx
 * - AZOTA: Chuẩn file dapanAzota2025.xlsx
 */
export async function exportGradingExcelXlsx(
  variants: ShuffledVariant[],
  appFormat: 'QM2025' | 'TNMAKER' | 'AZOTA'
): Promise<Blob> {
  if (!variants || variants.length === 0) {
    return packRowsToXlsxBlob([['Chưa có dữ liệu']]);
  }

  const maxP1 = Math.max(0, ...variants.map((v) => v.answerKey.part1.length));
  const maxP2 = Math.max(0, ...variants.map((v) => v.answerKey.part2.length));
  const maxP3 = Math.max(0, ...variants.map((v) => v.answerKey.part3.length));

  if (appFormat === 'QM2025') {
    // Chuẩn dapanQM2025.xlsx: Dòng 1 là Header ["Đề \ Câu", 1..maxP1, 1a..maxP2_d, 1..maxP3]
    const headerRow: Array<string | number> = ['Đề \\ Câu'];
    for (let i = 1; i <= maxP1; i++) headerRow.push(i);
    for (let i = 1; i <= maxP2; i++) {
      headerRow.push(`${i}a`, `${i}b`, `${i}c`, `${i}d`);
    }
    for (let i = 1; i <= maxP3; i++) headerRow.push(i);

    const dataRows: Array<Array<string | number>> = variants.map((v) => {
      const rawCode = String(v.examCode).trim();
      const codeVal: string | number =
        /^\d+$/.test(rawCode) && !/^0\d+/.test(rawCode) ? Number(rawCode) : rawCode;
      const row: Array<string | number> = [codeVal];

      for (let i = 1; i <= maxP1; i++) {
        const item = v.answerKey.part1.find((x) => x.questionNumber === i);
        row.push(item ? item.answer : 'A');
      }
      for (let i = 1; i <= maxP2; i++) {
        const item = v.answerKey.part2.find((x) => x.questionNumber === i);
        const ans = item ? item.answers : ['Đ', 'S', 'Đ', 'S'];
        ans.forEach((a) => row.push(a === 'Đ' ? 'D' : 'S'));
      }
      for (let i = 1; i <= maxP3; i++) {
        const item = v.answerKey.part3.find((x) => x.questionNumber === i);
        const cleaned = String(item ? item.answer : '0').trim().replace(',', '.');
        const num = Number(cleaned);
        row.push(!isNaN(num) && cleaned !== '' ? num : cleaned);
      }
      return row;
    });

    return packRowsToXlsxBlob([headerRow, ...dataRows], 'QM2025');
  }

  if (appFormat === 'TNMAKER') {
    // Chuẩn TLTN-BGD-2025-SmartTest.xlsx của TNMaker:
    // Dòng 1: ["Câu\Mã đề", "101", "102", "103", "104"]
    // Các dòng tiếp theo: Câu 1 -> hết Phần I (A/B/C/D), tiếp theo Phần II (ĐSĐĐ), tiếp theo Phần III (54,6)
    const headerRow: Array<string | number> = [
      'Câu\\Mã đề',
      ...variants.map((v) => String(v.examCode).trim()),
    ];
    const rows: Array<Array<string | number>> = [headerRow];
    let qCounter = 1;

    for (let i = 1; i <= maxP1; i++) {
      rows.push([
        String(qCounter++),
        ...variants.map((v) => {
          const item = v.answerKey.part1.find((x) => x.questionNumber === i);
          return item ? item.answer : 'A';
        }),
      ]);
    }
    for (let i = 1; i <= maxP2; i++) {
      rows.push([
        String(qCounter++),
        ...variants.map((v) => {
          const item = v.answerKey.part2.find((x) => x.questionNumber === i);
          return item ? item.dsString : 'ĐSĐS';
        }),
      ]);
    }
    for (let i = 1; i <= maxP3; i++) {
      rows.push([
        String(qCounter++),
        ...variants.map((v) => {
          const item = v.answerKey.part3.find((x) => x.questionNumber === i);
          return item ? String(item.answer).trim().replace('.', ',') : '0';
        }),
      ]);
    }

    return packRowsToXlsxBlob(rows, 'TNMaker2025');
  }

  // Chuẩn dapanAzota2025.xlsx của Azota:
  // Dòng 1: ["Câu hỏi", "Mã đề thi"]
  // Dòng 2: ["", "101", "102", "103", "104"]
  // Dòng 3..N: ["1", "A", "B"...], Phần II: ["19", "SĐĐS"...], Phần III: ["23", "28,125"...]
  const row1: Array<string | number> = ['Câu hỏi', 'Mã đề thi'];
  const row2: Array<string | number> = [
    '',
    ...variants.map((v) => String(v.examCode).trim()),
  ];
  const rows: Array<Array<string | number>> = [row1, row2];
  let qCounter = 1;

  for (let i = 1; i <= maxP1; i++) {
    rows.push([
      String(qCounter++),
      ...variants.map((v) => {
        const item = v.answerKey.part1.find((x) => x.questionNumber === i);
        return item ? item.answer : 'A';
      }),
    ]);
  }
  for (let i = 1; i <= maxP2; i++) {
    rows.push([
      String(qCounter++),
      ...variants.map((v) => {
        const item = v.answerKey.part2.find((x) => x.questionNumber === i);
        return item ? item.dsString : 'ĐSĐS';
      }),
    ]);
  }
  for (let i = 1; i <= maxP3; i++) {
    rows.push([
      String(qCounter++),
      ...variants.map((v) => {
        const item = v.answerKey.part3.find((x) => x.questionNumber === i);
        return item ? String(item.answer).trim().replace('.', ',') : '0';
      }),
    ]);
  }

  return packRowsToXlsxBlob(rows, 'Azota2025');
}
