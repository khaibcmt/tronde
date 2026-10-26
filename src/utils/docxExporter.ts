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
 * Tạo đoạn văn bản Word chuẩn Typography (Mục IV.2):
 * - Căn đều 2 bên (Justify)
 * - Giãn dòng chuẩn Line spacing: 1.15 (w:line="276")
 * - Khoảng cách câu Spacing After: 6pt (w:after="120")
 * - Hanging Indent 0.65cm (w:left="368" w:hanging="368")
 */
function buildStandardParagraphXml(
  boldPrefix: string,
  bodyText: string,
  options?: {
    hangingIndent?: boolean;
    underlineBody?: boolean;
    redBody?: boolean;
    align?: 'both' | 'center' | 'left' | 'right';
    spaceAfterTwips?: number;
    fontSizeHalfPt?: number;
  }
): string {
  const align = options?.align || 'both';
  const spaceAfter = options?.spaceAfterTwips ?? 120; // 6pt = 120 twips
  const fontSize = options?.fontSizeHalfPt ?? 24; // 12pt = 24 half-points
  const indXml = options?.hangingIndent
    ? `<w:ind w:left="360" w:hanging="360"/>`
    : '';

  const bodyRPrParts: string[] = [
    `<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>`,
    `<w:sz w:val="${fontSize}"/><w:szCs w:val="${fontSize}"/>`,
  ];
  if (options?.underlineBody) {
    bodyRPrParts.push(`<w:u w:val="single"/>`);
  }
  if (options?.redBody) {
    bodyRPrParts.push(`<w:color w:val="FF0000"/>`);
  }

  const prefixRunXml = boldPrefix
    ? `<w:r>
        <w:rPr>
          <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
          <w:b/>
          ${options?.underlineBody ? '<w:u w:val="single"/>' : ''}
          ${options?.redBody ? '<w:color w:val="FF0000"/>' : ''}
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
      <w:spacing w:after="${spaceAfter}" w:line="276" w:lineRule="auto"/>
      ${indXml}
      <w:jc w:val="${align}"/>
    </w:pPr>
    ${prefixRunXml}
    ${bodyRunXml}
  </w:p>`;
}

/**
 * Tạo Bảng ẩn không viền (Invisible Borderless Table - Mục IV.2) cho các phương án Phần I
 * - 1_ROW_4_COL: 1 hàng x 4 cột (mỗi cột rộng 25% = 1250 pct)
 * - 2_ROW_2_COL: 2 hàng x 2 cột (mỗi cột rộng 50% = 2500 pct)
 * - 4_ROW_1_COL: 4 hàng x 1 cột (rộng 100% = 5000 pct)
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
        align: 'both',
        spaceAfterTwips: 80,
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
 * Tạo block XML nhúng hình ảnh Mã QR (DrawingML Inline Image) vào cuối trang đáp án trong Word
 */
function buildEmbeddedQrDrawingXml(relId: string, examCode: string): string {
  // 160px ~ 1524000 EMUs (1 inch = 914400 EMUs)
  const extentEmu = 1650000;
  return `<w:p>
    <w:pPr>
      <w:spacing w:before="160" w:after="120"/>
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
 * Tạo nội dung body XML cho 1 bộ câu hỏi (dùng chung cho Đề đã sửa và Đề hoán vị)
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
        { spaceAfterTwips: 160 }
      )
    );
    for (const q of part1) {
      blocks.push(
        buildStandardParagraphXml(`Câu ${q.displayIndex}. `, q.stemText, {
          spaceAfterTwips: 80,
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
    }
  }

  if (part2.length > 0) {
    blocks.push(
      buildStandardParagraphXml(
        `PHẦN II. Câu trắc nghiệm đúng sai. `,
        `Thí sinh trả lời từ câu ${part2[0].displayIndex} đến câu ${part2[part2.length - 1].displayIndex}. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai.`,
        { spaceAfterTwips: 160 }
      )
    );
    for (const q of part2) {
      blocks.push(
        buildStandardParagraphXml(`Câu ${q.displayIndex}. `, q.stemText, {
          spaceAfterTwips: 80,
        })
      );
      for (const sub of q.subItems || []) {
        const isMarked = highlightCorrectAnswers && sub.isTrue;
        blocks.push(
          buildStandardParagraphXml(`${sub.currentLabel}) `, sub.text, {
            hangingIndent: true,
            underlineBody: isMarked,
            redBody: isMarked,
            spaceAfterTwips: 80,
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
        { spaceAfterTwips: 160 }
      )
    );
    for (const q of part3) {
      blocks.push(
        buildStandardParagraphXml(`Câu ${q.displayIndex}. `, q.stemText, {
          spaceAfterTwips: 80,
        })
      );
      if (highlightCorrectAnswers && q.shortAnswer) {
        blocks.push(
          buildStandardParagraphXml(`Đáp án: `, q.shortAnswer, {
            underlineBody: true,
            redBody: true,
            spaceAfterTwips: 120,
          })
        );
      }
    }
  }

  return blocks.join('\n');
}

/**
 * Đóng gói một tệp Word (.docx) hoàn chỉnh chuẩn OpenXML (có hỗ trợ nhúng ảnh QR)
 */
async function packOpenXmlDocx(
  documentBodyInnerXml: string,
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
</Types>`
  );

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );

  if (hasImage && embeddedQrDataUrl) {
    zip.file(
      'word/_rels/document.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdQr1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/qrcode.png"/>
</Relationships>`
    );
    zip.file('word/media/qrcode.png', dataUrlToUint8Array(embeddedQrDataUrl));
  } else {
    zip.file(
      'word/_rels/document.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`
    );
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${documentBodyInnerXml}
    <w:sectPr>
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
 * Tiện ích 1: Xuất file đề gốc đã sửa sạch lỗi (.docx) - Mục III.2
 * Giữ lại định dạng gạch chân & tô màu đỏ ở đáp án đúng để giáo viên lưu trữ hoặc tái sử dụng
 */
export async function exportCleanedMasterDocx(
  questions: ExamQuestion[],
  config: ShuffleConfig
): Promise<Blob> {
  const headerXml = [
    buildStandardParagraphXml(
      `${config.schoolName.toUpperCase()}`,
      ` — ĐỀ GỐC ĐÃ CHUẨN HÓA CẤU TRÚC 2025`,
      { align: 'center', spaceAfterTwips: 80, fontSizeHalfPt: 26 }
    ),
    buildStandardParagraphXml(
      `${config.examTitle.toUpperCase()} - MÔN: ${config.subjectName.toUpperCase()}`,
      ` (Thời gian: ${config.durationMinutes} phút)`,
      { align: 'center', spaceAfterTwips: 200, fontSizeHalfPt: 24 }
    ),
  ].join('\n');

  const bodyQuestionsXml = buildQuestionsBodyXml(questions, config, true);
  return packOpenXmlDocx(`${headerXml}\n${bodyQuestionsXml}`);
}

/**
 * Tiện ích 2: Xuất 1 tệp Đề thi hoán vị (.docx) kèm Bảng đáp án & Mã QR nhúng trực tiếp ở trang cuối
 */
export async function exportSingleVariantDocx(
  variant: ShuffledVariant,
  config: ShuffleConfig
): Promise<Blob> {
  const headerXml = [
    buildStandardParagraphXml(
      `${config.schoolName.toUpperCase()}`,
      ` | ${config.examTitle.toUpperCase()}`,
      { align: 'center', spaceAfterTwips: 60, fontSizeHalfPt: 24 }
    ),
    buildStandardParagraphXml(
      `MÔN THI: ${config.subjectName.toUpperCase()} — MÃ ĐỀ: ${variant.examCode}`,
      ` (Thời gian làm bài: ${config.durationMinutes} phút)`,
      { align: 'center', spaceAfterTwips: 200, fontSizeHalfPt: 26 }
    ),
  ].join('\n');

  const questionsXml = buildQuestionsBodyXml(variant.questions, config, false);

  const footerEndXml = buildStandardParagraphXml(
    '-------------------- HẾT --------------------',
    '',
    { align: 'center', spaceAfterTwips: 240 }
  );

  // Trang đáp án và mã QR ở cuối đề (Ngắt trang <w:br w:type="page"/>)
  const pageBreakXml = `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;

  const p1AnsText = variant.answerKey.part1
    .map((a) => `${a.questionNumber}.${a.answer}`)
    .join('   |   ');
  const p2AnsText = variant.answerKey.part2
    .map(
      (a) =>
        `Câu ${a.questionNumber}: a-${a.answers[0]} / b-${a.answers[1]} / c-${a.answers[2]} / d-${a.answers[3]} (${a.tfString})`
    )
    .join('   ;   ');
  const p3AnsText = variant.answerKey.part3
    .map((a) => `Câu ${a.questionNumber}: ${a.answer}`)
    .join('   |   ');

  const answerSheetBlocks: string[] = [
    pageBreakXml,
    buildStandardParagraphXml(
      `BẢNG ĐÁP ÁN & MÃ QR CHẤM THI TỰ ĐỘNG — MÃ ĐỀ ${variant.examCode}`,
      '',
      { align: 'center', spaceAfterTwips: 160, fontSizeHalfPt: 26 }
    ),
    buildStandardParagraphXml('1. Đáp án Phần I (4 lựa chọn): ', p1AnsText, {
      spaceAfterTwips: 120,
    }),
    buildStandardParagraphXml('2. Đáp án Phần II (Đúng/Sai): ', p2AnsText, {
      spaceAfterTwips: 120,
    }),
    buildStandardParagraphXml(
      '3. Đáp án Phần III (Trả lời ngắn): ',
      p3AnsText,
      { spaceAfterTwips: 160 }
    ),
    buildStandardParagraphXml('Chuỗi Payload QR chuẩn: ', variant.qrPayload, {
      spaceAfterTwips: 120,
      fontSizeHalfPt: 20,
    }),
  ];

  if (config.embedQrInWord && variant.qrDataUrl) {
    answerSheetBlocks.push(buildEmbeddedQrDrawingXml('rIdQr1', variant.examCode));
    answerSheetBlocks.push(
      buildStandardParagraphXml(
        `Quét mã QR trên bằng ứng dụng ${config.qrFormat} để nạp tự động đáp án Mã đề ${variant.examCode}`,
        '',
        { align: 'center', spaceAfterTwips: 120, fontSizeHalfPt: 22 }
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
    config.embedQrInWord ? variant.qrDataUrl : undefined
  );
}

/**
 * Tiện ích 3: Đóng gói toàn bộ bộ đề (.docx) + Bảng đáp án tổng hợp + Thư mục ảnh QR (.png) thành 1 file .ZIP
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

  // 2. Lưu từng file đề hoán vị (.docx) và ảnh QR (.png)
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

  // 3. Tạo file CSV / TXT tổng hợp key chấm thi cho Excel và phần mềm chấm
  const csvLines: string[] = [
    'Ma_De,Phan_I_ABCD,Phan_II_DungSai,Phan_III_TraLoiNgan,QR_Payload',
  ];
  for (const v of variants) {
    const p1 = v.answerKey.part1.map((x) => `${x.questionNumber}${x.answer}`).join(' ');
    const p2 = v.answerKey.part2.map((x) => `${x.questionNumber}:${x.tfString}`).join(' ');
    const p3 = v.answerKey.part3.map((x) => `${x.questionNumber}=${x.answer}`).join(' ');
    csvLines.push(`"${v.examCode}","${p1}","${p2}","${p3}","${v.qrPayload}"`);
  }
  bundleZip.file('Bang_Dap_An_Tong_Hop_2025.csv', '\uFEFF' + csvLines.join('\n'));

  return bundleZip.generateAsync({ type: 'blob' });
}

/**
 * Tiện ích 4: Tải riêng bộ ảnh Mã QR (.zip)
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
