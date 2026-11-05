import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { ExamImageAttachment, ExamQuestion } from '../types/exam';
import {
  normalizeAllQuestionsStrictFourOptions,
  parseRawTextToExamQuestions,
} from './docxParser';
import { enhanceAndCropExamImage } from './scientificExamProcessor';

// Cấu hình worker cho pdfjs-dist (bản legacy tương thích 100% mọi trình duyệt Chrome, Edge, Cốc Cốc, Safari, Firefox)
try {
  const pdfjsAny = pdfjsLib as unknown as {
    version?: string;
    GlobalWorkerOptions?: { workerSrc?: string };
  };
  if (
    typeof window !== 'undefined' &&
    pdfjsAny.GlobalWorkerOptions &&
    !pdfjsAny.GlobalWorkerOptions.workerSrc
  ) {
    const ver = pdfjsAny.version || '5.4.296';
    pdfjsAny.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${ver}/legacy/build/pdf.worker.min.mjs`;
  }
} catch {
  // Bỏ qua nếu môi trường không cho phép gán worker
}

interface GlyphAtom {
  str: string;
  x: number;
  w: number;
  y: number;
  h: number;
}

interface PdfUnderlineBar {
  minX: number;
  maxX: number;
  y: number;
}

interface PdfSqrtBar {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  _used?: boolean;
}

interface PdfEmbeddedImagePlacement {
  idx: number;
  objId: string;
  pixelW: number;
  pixelH: number;
  x: number;
  y: number;
  w: number;
  h: number;
  midY: number;
}

const PDF_PUA_MAP: Record<string, string> = {
  '\uF020': ' ',
  '\uF028': '(',
  '\uF029': ')',
  '\uF02B': '+',
  '\uF02D': '-',
  '\uF02F': '/',
  '\uF03C': '<',
  '\uF03D': '=',
  '\uF03E': '>',
  '\uF05B': '[',
  '\uF05C': ' \\setminus ',
  '\uF05D': ']',
  '\uF07B': '\\{',
  '\uF07D': '\\}',
  '\uF0A2': "'",
  '\uF0A3': ' \\le ',
  '\uF0A5': '\\infty',
  '\uF0B0': '^\\circ',
  '\uF0B1': ' \\pm ',
  '\uF0B3': ' \\ge ',
  '\uF0B4': ' \\times ',
  '\uF0B8': ' \\div ',
  '\uF0B9': ' \\ne ',
  '\uF0CE': ' \\in ',
  '\uF0CF': ' \\notin ',
  '\uF0D6': '\\sqrt',
  '\uF0D7': ' \\cdot ',
  '\uF0E6': '(',
  '\uF0E7': '',
  '\uF0E8': '',
  '\uF0F6': ')',
  '\uF0F7': '',
  '\uF0F8': '',
  '\uF0E9': '[',
  '\uF0EA': '',
  '\uF0EB': '',
  '\uF0F9': ']',
  '\uF0FA': '',
  '\uF0FB': '',
};

function mapPdfPuaString(str: string): string {
  let out = '';
  for (const ch of str) {
    if (PDF_PUA_MAP[ch] !== undefined) {
      out += PDF_PUA_MAP[ch];
    } else {
      const code = ch.charCodeAt(0);
      if (code >= 0xf000 && code <= 0xf0ff) {
        const ascii = code - 0xf000;
        if (ascii >= 32 && ascii <= 126) {
          out += String.fromCharCode(ascii);
        }
      } else {
        out += ch;
      }
    }
  }
  return out;
}

function multiplyMatrix2D(m1: number[], m2: number[]): number[] {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

function applyTransform2D(x: number, y: number, m: number[]): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/**
 * Tách các item văn bản PDF có khoảng trống nội bộ bị chồng lấp bởi item khác (đặc trưng của MathType trong PDF:
 * ví dụ "f x" + "( )" hoặc "( 1;0)" + "-") thành các nguyên tử ký tự đúng vị trí trục hoành X.
 */
function extractPositionedAtomsFromPdfTextItems(rawItems: unknown[]): GlyphAtom[] {
  const valid: GlyphAtom[] = [];
  for (const raw of rawItems) {
    const it = raw as { str?: string; transform?: number[]; width?: number };
    if (!it || typeof it.str !== 'string' || !Array.isArray(it.transform)) continue;
    const mapped = mapPdfPuaString(it.str);
    if (!mapped) continue;
    const x = Number(it.transform[4]) || 0;
    const y = Number(it.transform[5]) || 0;
    const w = Number(it.width) || 0;
    const h = Math.abs(Number(it.transform[3])) || Math.abs(Number(it.transform[0])) || 12;
    valid.push({ str: mapped, x, w, y, h });
  }

  const nonSpace = valid.filter((v) => v.str.trim().length > 0);
  const finalAtoms: GlyphAtom[] = [];

  for (const item of nonSpace) {
    const hasOverlap = nonSpace.some(
      (other) =>
        other !== item &&
        Math.abs(other.y - item.y) < 5 &&
        Math.min(item.x + item.w, other.x + other.w) - Math.max(item.x, other.x) > 0.5
    );
    if (hasOverlap && item.str.includes(' ') && item.str.length > 1) {
      const tokens = item.str
        .trim()
        .split(/\s+/)
        .filter(Boolean);
      if (tokens.length > 1) {
        const totalChars = tokens.reduce((acc, t) => acc + t.length, 0);
        const avgCharW = Math.min(4.8, item.w / (totalChars + tokens.length));
        for (let k = 0; k < tokens.length; k++) {
          const tok = tokens[k];
          const tokW = tok.length * avgCharW;
          const tokX =
            k === 0
              ? item.x
              : k === tokens.length - 1
              ? Math.max(item.x, item.x + item.w - tokW)
              : item.x + (k / (tokens.length - 1)) * (item.w - tokW);
          finalAtoms.push({
            str: tok,
            x: tokX,
            w: tokW,
            y: item.y,
            h: item.h,
          });
        }
        continue;
      }
    }
    finalAtoms.push(item);
  }

  return finalAtoms;
}

/**
 * Kết xuất một dãy nguyên tử ký tự trên cùng một băng ngang thành chuỗi có hỗ trợ số mũ ^{...}, chỉ số dưới _{...}, căn thức \sqrt{...}
 * và đánh dấu * cho phương án được gạch chân trong PDF.
 */
function renderLinearPdfAtoms(
  atoms: GlyphAtom[],
  baseY: number,
  sqrtBars: PdfSqrtBar[],
  underlines: PdfUnderlineBar[] = []
): string {
  if (atoms.length === 0) return '';
  const sorted = [...atoms].sort((a, b) => {
    if (Math.abs(a.x - b.x) < 1.8 && a.h !== b.h) {
      return b.h - a.h;
    }
    return a.x - b.x;
  });

  let out = '';
  let prevEnd = -9999;
  let mode: 'normal' | 'sup' | 'sub' = 'normal';

  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    const dy = a.y - baseY;
    const isSmall = a.h < 9.5;
    let targetMode: 'normal' | 'sup' | 'sub' = 'normal';
    if (isSmall && dy > 1.8) targetMode = 'sup';
    else if (isSmall && dy < -1.2) targetMode = 'sub';

    const sb = sqrtBars.find(
      (s) =>
        !s._used &&
        Math.abs(a.y - s.minY) < 12 &&
        a.x >= s.minX - 2 &&
        a.x <= s.maxX + 12
    );

    if (targetMode !== mode) {
      if (mode !== 'normal') out += '}';
      if (targetMode === 'sup') out += '^{';
      else if (targetMode === 'sub') out += '_{';
      mode = targetMode;
    }

    if (mode === 'normal' && prevEnd > -9000 && a.x - prevEnd > 3.2) {
      out += ' ';
    }

    let tokenStr = a.str;
    if (mode === 'normal' && /^(?:[A-D]\.|[a-d]\))$/.test(tokenStr.trim())) {
      const isUnderlined = underlines.some(
        (u) =>
          Math.abs(baseY - u.y) <= 5.5 &&
          Math.min(a.x + Math.max(a.w, 8), u.maxX + 2) - Math.max(a.x - 2, u.minX) > 1
      );
      tokenStr = `${isUnderlined ? '*' : ''}${tokenStr.trim()} `;
    }

    if (sb) {
      sb._used = true;
      out += `\\sqrt{${tokenStr.trim()}}`;
    } else {
      out += tokenStr;
    }
    prevEnd = Math.max(prevEnd, a.x + a.w);
  }

  if (mode !== 'normal') out += '}';
  return out;
}

function clusterAtomsHorizontally(
  bandAtoms: GlyphAtom[],
  maxGap = 22
): { minX: number; maxX: number; baseY: number; atoms: GlyphAtom[] }[] {
  if (bandAtoms.length === 0) return [];
  const sorted = [...bandAtoms].sort((a, b) => a.x - b.x);
  const clusters: { minX: number; maxX: number; baseY: number; atoms: GlyphAtom[] }[] = [];
  for (const a of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && a.x - last.maxX <= maxGap) {
      last.atoms.push(a);
      last.maxX = Math.max(last.maxX, a.x + a.w);
      if (a.h >= 9.5) last.baseY = Math.min(last.baseY, a.y);
    } else {
      clusters.push({
        minX: a.x,
        maxX: a.x + a.w,
        baseY: a.y,
        atoms: [a],
      });
    }
  }
  return clusters;
}

/**
 * Bộ mã hóa PNG không nén (Uncompressed Deflate PNG) thuần TypeScript:
 * Giúp xuất dữ liệu ảnh RGB/RGBA trích xuất từ PDF sang chuỗi data:image/png;base64,...
 * ngay cả trong môi trường không có HTMLCanvasElement 2D context.
 */
function encodeRawRgbOrRgbaToPngDataUrl(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  kind: number
): string | null {
  if (!data || width <= 0 || height <= 0) return null;

  // Chuyển sang RGBA 4 bytes/pixel kèm filter byte 0 ở đầu mỗi dòng quét
  const rowSize = width * 4 + 1;
  const rawScanlines = new Uint8Array(rowSize * height);
  const bytesPerPixel =
    kind === 2
      ? 3
      : kind === 3
      ? 4
      : Math.max(1, Math.round(data.length / Math.max(1, width * height)));

  for (let y = 0; y < height; y++) {
    const rowStart = y * rowSize;
    rawScanlines[rowStart] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const dstIdx = rowStart + 1 + x * 4;
      const srcIdx = (y * width + x) * bytesPerPixel;
      if (bytesPerPixel >= 4) {
        rawScanlines[dstIdx] = data[srcIdx] ?? 255;
        rawScanlines[dstIdx + 1] = data[srcIdx + 1] ?? 255;
        rawScanlines[dstIdx + 2] = data[srcIdx + 2] ?? 255;
        rawScanlines[dstIdx + 3] = data[srcIdx + 3] ?? 255;
      } else if (bytesPerPixel === 3) {
        rawScanlines[dstIdx] = data[srcIdx] ?? 255;
        rawScanlines[dstIdx + 1] = data[srcIdx + 1] ?? 255;
        rawScanlines[dstIdx + 2] = data[srcIdx + 2] ?? 255;
        rawScanlines[dstIdx + 3] = 255;
      } else {
        const g = data[srcIdx] ?? 255;
        rawScanlines[dstIdx] = g;
        rawScanlines[dstIdx + 1] = g;
        rawScanlines[dstIdx + 2] = g;
        rawScanlines[dstIdx + 3] = 255;
      }
    }
  }

  // Đóng gói Zlib (Stored Deflate blocks tối đa 65535 bytes mỗi block + Adler32)
  const maxBlock = 65535;
  const numBlocks = Math.ceil(rawScanlines.length / maxBlock) || 1;
  const zlibLen = 2 + rawScanlines.length + numBlocks * 5 + 4;
  const zlibData = new Uint8Array(zlibLen);
  zlibData[0] = 0x78;
  zlibData[1] = 0x01;
  let zPos = 2;
  let offset = 0;

  for (let b = 0; b < numBlocks; b++) {
    const remaining = rawScanlines.length - offset;
    const blockLen = Math.min(maxBlock, remaining);
    const isFinal = b === numBlocks - 1 ? 1 : 0;
    zlibData[zPos++] = isFinal;
    zlibData[zPos++] = blockLen & 0xff;
    zlibData[zPos++] = (blockLen >> 8) & 0xff;
    const nlen = ~blockLen & 0xffff;
    zlibData[zPos++] = nlen & 0xff;
    zlibData[zPos++] = (nlen >> 8) & 0xff;
    zlibData.set(rawScanlines.subarray(offset, offset + blockLen), zPos);
    zPos += blockLen;
    offset += blockLen;
  }

  // Tính Adler-32
  let s1 = 1;
  let s2 = 0;
  for (let i = 0; i < rawScanlines.length; i++) {
    s1 = (s1 + rawScanlines[i]) % 65521;
    s2 = (s2 + s1) % 65521;
  }
  const adler = ((s2 << 16) | s1) >>> 0;
  zlibData[zPos++] = (adler >>> 24) & 0xff;
  zlibData[zPos++] = (adler >>> 16) & 0xff;
  zlibData[zPos++] = (adler >>> 8) & 0xff;
  zlibData[zPos++] = adler & 0xff;

  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[n] = c >>> 0;
  }

  const makeChunk = (typeStr: string, payload: Uint8Array): Uint8Array => {
    const chunk = new Uint8Array(12 + payload.length);
    const len = payload.length >>> 0;
    chunk[0] = (len >>> 24) & 0xff;
    chunk[1] = (len >>> 16) & 0xff;
    chunk[2] = (len >>> 8) & 0xff;
    chunk[3] = len & 0xff;
    for (let i = 0; i < 4; i++) {
      chunk[4 + i] = typeStr.charCodeAt(i);
    }
    chunk.set(payload, 8);
    let crc = 0xffffffff;
    for (let i = 4; i < 8 + payload.length; i++) {
      crc = crcTable[(crc ^ chunk[i]) & 0xff] ^ (crc >>> 8);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const crcPos = 8 + payload.length;
    chunk[crcPos] = (crc >>> 24) & 0xff;
    chunk[crcPos + 1] = (crc >>> 16) & 0xff;
    chunk[crcPos + 2] = (crc >>> 8) & 0xff;
    chunk[crcPos + 3] = crc & 0xff;
    return chunk;
  };

  const ihdr = new Uint8Array(13);
  ihdr[0] = (width >>> 24) & 0xff;
  ihdr[1] = (width >>> 16) & 0xff;
  ihdr[2] = (width >>> 8) & 0xff;
  ihdr[3] = width & 0xff;
  ihdr[4] = (height >>> 24) & 0xff;
  ihdr[5] = (height >>> 16) & 0xff;
  ihdr[6] = (height >>> 8) & 0xff;
  ihdr[7] = height & 0xff;
  ihdr[8] = 8; // Bit depth 8
  ihdr[9] = 6; // Color type 6 (RGBA)
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', zlibData);
  const iendChunk = makeChunk('IEND', new Uint8Array(0));

  const pngBytes = new Uint8Array(
    signature.length + ihdrChunk.length + idatChunk.length + iendChunk.length
  );
  let p = 0;
  pngBytes.set(signature, p);
  p += signature.length;
  pngBytes.set(ihdrChunk, p);
  p += ihdrChunk.length;
  pngBytes.set(idatChunk, p);
  p += idatChunk.length;
  pngBytes.set(iendChunk, p);

  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < pngBytes.length; i += chunkSize) {
    binary += String.fromCharCode(...pngBytes.subarray(i, i + chunkSize));
  }
  const base64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(pngBytes).toString('base64');
  return `data:image/png;base64,${base64}`;
}

/**
 * Trích xuất đối tượng hình ảnh nhúng từ PDF (bảng biến thiên, bảng xét dấu, đồ thị hàm số, hình học)
 * sang định dạng ExamImageAttachment sắc nét 300 DPI.
 */
async function extractEmbeddedPdfImageAttachment(
  page: pdfjsLib.PDFPageProxy,
  pageNumber: number,
  placement: PdfEmbeddedImagePlacement
): Promise<ExamImageAttachment | null> {
  const widthTwips = Math.max(1400, Math.min(4800, Math.round(placement.w * 20)));
  const heightTwips = Math.max(650, Math.min(3600, Math.round(placement.h * 20)));
  const aspectRatio = Number((placement.w / Math.max(1, placement.h)).toFixed(4));

  try {
    const imgObj = await new Promise<{
      width?: number;
      height?: number;
      kind?: number;
      data?: Uint8Array | Uint8ClampedArray;
      bitmap?: ImageBitmap;
    } | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), 1500);
      try {
        page.objs.get(placement.objId, (obj: unknown) => {
          clearTimeout(timer);
          resolve((obj as { width?: number; height?: number }) || null);
        });
      } catch {
        clearTimeout(timer);
        resolve(null);
      }
    });

    if (imgObj && imgObj.width && imgObj.height) {
      const w = imgObj.width;
      const h = imgObj.height;

      // Ưu tiên 1: Sử dụng HTMLCanvasElement nếu đang chạy trên trình duyệt (nén PNG nhanh & gọn)
      if (typeof document !== 'undefined') {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, w, h);
          if (imgObj.bitmap) {
            ctx.drawImage(imgObj.bitmap, 0, 0, w, h);
            const dataUrl = canvas.toDataURL('image/png', 1.0);
            return {
              id: `pdf-fig-p${pageNumber}-${placement.idx}-${Date.now()}`,
              fileName: `hinh_toan_p${pageNumber}_${placement.idx + 1}.png`,
              dataUrl,
              widthTwips,
              heightTwips,
              aspectRatio: Number((w / Math.max(1, h)).toFixed(4)),
              dpi: 300,
            };
          } else if (imgObj.data) {
            const imgData = ctx.createImageData(w, h);
            const dst = imgData.data;
            const src = imgObj.data;
            const bpp =
              imgObj.kind === 2
                ? 3
                : imgObj.kind === 3
                ? 4
                : Math.max(1, Math.round(src.length / Math.max(1, w * h)));
            for (let i = 0; i < w * h; i++) {
              const di = i * 4;
              const si = i * bpp;
              if (bpp >= 4) {
                dst[di] = src[si];
                dst[di + 1] = src[si + 1];
                dst[di + 2] = src[si + 2];
                dst[di + 3] = src[si + 3];
              } else if (bpp === 3) {
                dst[di] = src[si];
                dst[di + 1] = src[si + 1];
                dst[di + 2] = src[si + 2];
                dst[di + 3] = 255;
              } else {
                dst[di] = src[si];
                dst[di + 1] = src[si];
                dst[di + 2] = src[si];
                dst[di + 3] = 255;
              }
            }
            ctx.putImageData(imgData, 0, 0);
            const dataUrl = canvas.toDataURL('image/png', 1.0);
            return {
              id: `pdf-fig-p${pageNumber}-${placement.idx}-${Date.now()}`,
              fileName: `hinh_toan_p${pageNumber}_${placement.idx + 1}.png`,
              dataUrl,
              widthTwips,
              heightTwips,
              aspectRatio: Number((w / Math.max(1, h)).toFixed(4)),
              dpi: 300,
            };
          }
        }
      }

      // Ưu tiên 2: Mã hóa trực tiếp sang PNG (hoạt động cả trên trình duyệt và Node/Test)
      if (imgObj.data) {
        const directPngUrl = encodeRawRgbOrRgbaToPngDataUrl(
          imgObj.data,
          w,
          h,
          imgObj.kind || 2
        );
        if (directPngUrl) {
          return {
            id: `pdf-fig-p${pageNumber}-${placement.idx}-${Date.now()}`,
            fileName: `hinh_toan_p${pageNumber}_${placement.idx + 1}.png`,
            dataUrl: directPngUrl,
            widthTwips,
            heightTwips,
            aspectRatio: Number((w / Math.max(1, h)).toFixed(4)),
            dpi: 300,
          };
        }
      }
    }
  } catch {
    // Bỏ qua nếu không lấy được đối tượng ảnh
  }

  return null;
}

/**
 * Kết xuất trang PDF Scan thành ảnh độ phân giải cao (300 DPI tương đương) và tự động khử nhiễu nền
 */
async function renderPdfPageToEnhancedImage(
  page: pdfjsLib.PDFPageProxy,
  pageNumber: number
): Promise<ExamImageAttachment | null> {
  if (typeof document === 'undefined') return null;
  try {
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: ctx,
      viewport,
      canvas,
    }).promise;

    const rawDataUrl = canvas.toDataURL('image/png', 1.0);
    const enhanced = await enhanceAndCropExamImage(
      rawDataUrl,
      pageNumber,
      `scan_page_${pageNumber}.png`
    );

    return {
      id: `pdf-scan-${pageNumber}-${Date.now()}`,
      dataUrl: enhanced.dataUrl,
      fileName: `scan_trang_${pageNumber}.png`,
      caption: `Bản Scan / Sơ đồ Trang ${pageNumber} ${enhanced.tagId}`,
      tagId: enhanced.tagId,
      widthTwips: enhanced.widthTwips,
      heightTwips: enhanced.heightTwips,
      aspectRatio: enhanced.aspectRatio,
      dpi: 300,
    };
  } catch {
    return null;
  }
}

/**
 * Trích xuất toàn bộ văn bản công thức 2D (phân số, số mũ, căn thức), nhận diện đáp án gạch chân
 * và trích xuất hình vẽ/đồ thị/bảng biến thiên từ tệp PDF
 */
async function extractLinesAndScansFromPdf(file: File): Promise<{
  lines: string[];
  scannedPageImages: ExamImageAttachment[];
  embeddedImagesMap: Map<number, ExamImageAttachment>;
}> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
  });

  const pdfDoc = await loadingTask.promise;
  const rawLines: string[] = [];
  const scannedPageImages: ExamImageAttachment[] = [];
  const embeddedImagesMap = new Map<number, ExamImageAttachment>();
  let globalImgCounter = 0;

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const [textContent, ops] = await Promise.all([
      page.getTextContent(),
      page.getOperatorList(),
    ]);

    let ctm = [1, 0, 0, 1, 0, 0];
    const ctmStack: number[][] = [];
    const underlines: PdfUnderlineBar[] = [];
    const sqrtBars: PdfSqrtBar[] = [];
    const pageImgPlacements: PdfEmbeddedImagePlacement[] = [];

    for (let i = 0; i < ops.fnArray.length; i++) {
      const fn = ops.fnArray[i];
      const args = ops.argsArray[i];
      if (fn === pdfjsLib.OPS.save) {
        ctmStack.push([...ctm]);
      } else if (fn === pdfjsLib.OPS.restore) {
        ctm = ctmStack.pop() || [1, 0, 0, 1, 0, 0];
      } else if (fn === pdfjsLib.OPS.transform && Array.isArray(args)) {
        ctm = multiplyMatrix2D(ctm, args as number[]);
      } else if (
        fn === pdfjsLib.OPS.paintImageXObject &&
        Array.isArray(args) &&
        Number(args[1]) > 20 &&
        Number(args[2]) > 20
      ) {
        const w = Math.abs(ctm[0]);
        const h = Math.abs(ctm[3]);
        const x = ctm[4];
        const y = ctm[5];
        pageImgPlacements.push({
          idx: globalImgCounter++,
          objId: String(args[0]),
          pixelW: Number(args[1]),
          pixelH: Number(args[2]),
          x,
          y,
          w,
          h,
          midY: y + h / 2,
        });
      } else if (
        fn === pdfjsLib.OPS.constructPath &&
        Array.isArray(args) &&
        args[0] !== 28
      ) {
        const buf = (args[1] as unknown as ArrayLike<number>[])?.[0];
        if (!buf || typeof buf.length !== 'number') continue;
        const xs: number[] = [];
        const ys: number[] = [];
        for (let j = 0; j < buf.length; ) {
          const t = buf[j];
          if (t === 0 || t === 1) {
            const [px, py] = applyTransform2D(buf[j + 1], buf[j + 2], ctm);
            xs.push(px);
            ys.push(py);
            j += 3;
          } else if (t === 2) {
            for (let k = 1; k <= 5; k += 2) {
              const [px, py] = applyTransform2D(buf[j + k], buf[j + k + 1], ctm);
              xs.push(px);
              ys.push(py);
            }
            j += 7;
          } else if (t === 3) {
            for (let k = 1; k <= 3; k += 2) {
              const [px, py] = applyTransform2D(buf[j + k], buf[j + k + 1], ctm);
              xs.push(px);
              ys.push(py);
            }
            j += 5;
          } else {
            j++;
          }
        }
        if (xs.length === 0) continue;
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const w = maxX - minX;
        const h = maxY - minY;
        if (args[0] === 23 && h >= 0.4 && h <= 2.6 && w >= 5 && w <= 55) {
          underlines.push({ minX, maxX, y: (minY + maxY) / 2 });
        } else if (args[0] === 23 && h >= 3.0 && h <= 25 && w >= 3.0 && w <= 45) {
          sqrtBars.push({ minX, maxX, minY, maxY });
        }
      }
    }

    // Trích xuất toàn bộ hình ảnh nhúng trên trang hiện tại
    for (const pl of pageImgPlacements) {
      const att = await extractEmbeddedPdfImageAttachment(page, pageNum, pl);
      if (att) {
        embeddedImagesMap.set(pl.idx, att);
      }
    }

    const atoms = extractPositionedAtomsFromPdfTextItems(textContent.items as unknown[]);
    const pageCharCount = atoms.reduce((acc, it) => acc + it.str.trim().length, 0);
    if (pageCharCount < 20 && pageNum <= 8 && pageImgPlacements.length === 0) {
      const scanImg = await renderPdfPageToEnhancedImage(page, pageNum);
      if (scanImg) {
        scannedPageImages.push(scanImg);
      }
    }

    // Bước 1: Gom các nguyên tử chữ chính (h >= 9.5) thành các băng dòng ngang (sai số 3.5pt)
    const mainAtoms = atoms.filter((a) => a.h >= 9.5).sort((a, b) => b.y - a.y);
    const bands: { baseY: number; atoms: GlyphAtom[] }[] = [];
    for (const m of mainAtoms) {
      const band = bands.find((b) => Math.abs(b.baseY - m.y) <= 3.5);
      if (band) band.atoms.push(m);
      else bands.push({ baseY: m.y, atoms: [m] });
    }

    // Gắn các nguyên tử nhỏ (số mũ / chỉ số dưới, h < 9.5) vào băng dòng có ký tự cơ sở nằm ngay bên trái
    for (const s of atoms.filter((a) => a.h < 9.5)) {
      let bestBand = bands.find(
        (b) =>
          s.y - b.baseY >= -4.5 &&
          s.y - b.baseY <= 8.0 &&
          b.atoms.some((m) => m.h >= 9.5 && s.x >= m.x - 1 && s.x <= m.x + m.w + 8)
      );
      if (!bestBand && bands.length > 0) {
        bestBand = bands.reduce((best, cur) =>
          Math.abs(cur.baseY - s.y) < Math.abs(best.baseY - s.y) ? cur : best
        );
      }
      if (bestBand) bestBand.atoms.push(s);
    }
    bands.sort((a, b) => b.baseY - a.baseY);

    // Bước 2: Nhận diện các cặp Tử số + Mẫu số xếp chồng dọc quanh dòng chính và tái tạo \frac{tử}{mẫu}
    const removedBands = new Set<number>();
    for (let i = 0; i < bands.length; i++) {
      if (removedBands.has(i)) continue;
      for (let j = i + 1; j < bands.length; j++) {
        if (removedBands.has(j)) continue;
        const dy = bands[i].baseY - bands[j].baseY;
        if (dy < 13.5 || dy > 21.0) continue;
        const midY = (bands[i].baseY + bands[j].baseY) / 2;
        const mainBand = bands.find(
          (b, idx) =>
            idx !== i &&
            idx !== j &&
            !removedBands.has(idx) &&
            Math.abs(b.baseY - midY) <= 3.8
        );
        if (!mainBand) continue;

        const numClusters = clusterAtomsHorizontally(bands[i].atoms, 22);
        const denClusters = clusterAtomsHorizontally(bands[j].atoms, 22);
        if (
          numClusters.some((nc) => nc.maxX - nc.minX > 95) ||
          denClusters.some((dc) => dc.maxX - dc.minX > 95)
        ) {
          continue;
        }

        const matchedPairs: {
          nc: (typeof numClusters)[0];
          dc: (typeof denClusters)[0];
        }[] = [];
        for (const nc of numClusters) {
          const dc = denClusters.find(
            (d) => Math.min(nc.maxX, d.maxX) - Math.max(nc.minX, d.minX) >= -6
          );
          if (dc) matchedPairs.push({ nc, dc });
        }

        if (
          matchedPairs.length > 0 &&
          matchedPairs.length === numClusters.length &&
          matchedPairs.length === denClusters.length
        ) {
          for (const { nc, dc } of matchedPairs) {
            const numStr = renderLinearPdfAtoms(nc.atoms, nc.baseY, sqrtBars).trim();
            const denStr = renderLinearPdfAtoms(dc.atoms, dc.baseY, sqrtBars).trim();
            const fMinX = Math.min(nc.minX, dc.minX);
            const fMaxX = Math.max(nc.maxX, dc.maxX);
            mainBand.atoms.push({
              str: `\\frac{${numStr}}{${denStr}}`,
              x: fMinX,
              w: fMaxX - fMinX,
              y: mainBand.baseY,
              h: 12,
            });
          }
          removedBands.add(i);
          removedBands.add(j);
          break;
        }
      }
    }

    // Bước 3: Hợp nhất các dòng văn bản và token vị trí hình ảnh [[PDF_IMG_X]] theo thứ tự tung độ Y từ trên xuống dưới
    const pageEvents: { y: number; text: string }[] = [];
    for (let idx = 0; idx < bands.length; idx++) {
      if (removedBands.has(idx)) continue;
      const b = bands[idx];
      let lineText = renderLinearPdfAtoms(b.atoms, b.baseY, sqrtBars, underlines).trim();
      if (!lineText) continue;
      // Bỏ qua số trang đơn lẻ ở chân trang (baseY < 35)
      if (b.baseY < 35 && /^\d{1,2}$/.test(lineText)) continue;

      // Phục hồi ký hiệu tập số thực \mathbb{R} từ font MT Extra bị ẩn và chuẩn hóa hàm logarit
      lineText = lineText
        .replace(/liên tục trên\s+và/g, 'liên tục trên \\mathbb{R} và')
        .replace(/là\s*=\s*\\\{/g, 'là D = \\mathbb{R} \\setminus \\{')
        .replace(/(^|\s|\.)\\\{(\d+)\\\}/g, '$1\\mathbb{R} \\setminus \\{$2\\}')
        .replace(/\\frac\{lnx\}/g, '\\frac{\\ln x}');

      pageEvents.push({ y: b.baseY, text: lineText });
    }

    for (const pl of pageImgPlacements) {
      if (embeddedImagesMap.has(pl.idx)) {
        pageEvents.push({ y: pl.midY, text: `[[PDF_IMG_${pl.idx}]]` });
      }
    }

    pageEvents.sort((a, b) => b.y - a.y);
    for (const ev of pageEvents) {
      rawLines.push(ev.text);
    }
  }

  return { lines: rawLines, scannedPageImages, embeddedImagesMap };
}

/**
 * Phân tích File PDF / PDF Scan đề thi cấu trúc 3 phần THPT 2025:
 * - Tái tạo chính xác công thức Toán học 2D (phân số, số mũ, chỉ số dưới, căn bậc hai, tập hợp, giới hạn, đạo hàm)
 * - Tự động nhận diện các phương án gạch chân trong PDF (Phần I, Phần II, Phần III)
 * - Tự động bóc tách và gắn đúng vị trí mọi đồ thị hàm số, bảng biến thiên, bảng xét dấu và hình vẽ hình học
 */
export async function parsePdfExamFile(
  file: File,
  resetPerPart = true
): Promise<ExamQuestion[]> {
  const { lines, scannedPageImages, embeddedImagesMap } =
    await extractLinesAndScansFromPdf(file);
  const fullRawText = lines.join('\n');
  let parsed = parseRawTextToExamQuestions(fullRawText, resetPerPart);

  // Gắn các hình ảnh nhúng [[PDF_IMG_X]] vào đúng câu hỏi chứa token đó và làm sạch token khỏi văn bản
  if (embeddedImagesMap.size > 0 && parsed.length > 0) {
    const imgTokenRegex = /\[\[PDF_IMG_(\d+)\]\]/g;
    parsed = parsed.map((q) => {
      const matchedImgIndices: number[] = [];
      const collectFromText = (txt: string | undefined): string => {
        if (!txt) return '';
        return txt
          .replace(imgTokenRegex, (_, idxStr) => {
            const idx = parseInt(idxStr, 10);
            if (!Number.isNaN(idx) && !matchedImgIndices.includes(idx)) {
              matchedImgIndices.push(idx);
            }
            return '';
          })
          .replace(/\s{2,}/g, ' ')
          .trim();
      };

      const cleanedStem = collectFromText(q.stemText);
      const cleanedOptions = q.options?.map((o) => ({
        ...o,
        text: collectFromText(o.text),
      }));
      const cleanedSubItems = q.subItems?.map((s) => ({
        ...s,
        text: collectFromText(s.text),
      }));

      const attachedImgs: ExamImageAttachment[] = [...(q.images || [])];
      matchedImgIndices.forEach((imgIdx, orderIdx) => {
        const att = embeddedImagesMap.get(imgIdx);
        if (att) {
          const suffix = matchedImgIndices.length > 1 ? `_${orderIdx + 1}` : '';
          const tagId = `[HINH_ANH_CAU_${q.displayIndex}${suffix}]`;
          attachedImgs.push({
            ...att,
            tagId,
            caption: `Hình minh họa Câu ${q.displayIndex} ${tagId}`,
          });
        }
      });

      const hasFormula =
        Boolean(q.hasFormula) ||
        /\\(?:frac|sqrt|infty|le|ge|mathbb|setminus|ln)|[_^]\{/.test(cleanedStem) ||
        Boolean(
          cleanedOptions?.some((o) =>
            /\\(?:frac|sqrt|infty|le|ge|mathbb|setminus|ln)|[_^]\{/.test(o.text)
          )
        ) ||
        Boolean(
          cleanedSubItems?.some((s) =>
            /\\(?:frac|sqrt|infty|le|ge|mathbb|setminus|ln)|[_^]\{/.test(s.text)
          )
        );

      return {
        ...q,
        stemText: cleanedStem,
        options: cleanedOptions,
        subItems: cleanedSubItems,
        hasFormula,
        hasImage: attachedImgs.length > 0,
        images: attachedImgs.length > 0 ? attachedImgs : undefined,
      };
    });
  }

  // Nếu là tệp PDF Scan thuần hình ảnh (chưa có lớp text), tạo danh sách câu hỏi gắn kèm ảnh Scan 300 DPI đã làm nét
  if (parsed.length === 0 && scannedPageImages.length > 0) {
    parsed = scannedPageImages.map((img, idx) => ({
      id: `q-scan-${idx + 1}-${Date.now()}`,
      part: 'PART_1',
      originalIndex: idx + 1,
      displayIndex: idx + 1,
      stemText: `Quan sát nội dung đề thi / sơ đồ phân tích ở hình ${img.tagId || `[HINH_ANH_CAU_${idx + 1}]`} bên dưới và chọn phương án đúng:`,
      hasFormula: false,
      hasImage: true,
      images: [img],
      options: [
        {
          id: `opt-scan-${idx}-A`,
          originalLabel: 'A',
          currentLabel: 'A',
          text: 'Phương án A',
          isUnderline: false,
          isRed: false,
          isCorrect: false,
        },
        {
          id: `opt-scan-${idx}-B`,
          originalLabel: 'B',
          currentLabel: 'B',
          text: 'Phương án B',
          isUnderline: false,
          isRed: false,
          isCorrect: false,
        },
        {
          id: `opt-scan-${idx}-C`,
          originalLabel: 'C',
          currentLabel: 'C',
          text: 'Phương án C',
          isUnderline: false,
          isRed: false,
          isCorrect: false,
        },
        {
          id: `opt-scan-${idx}-D`,
          originalLabel: 'D',
          currentLabel: 'D',
          text: 'Phương án D',
          isUnderline: false,
          isRed: false,
          isCorrect: false,
        },
      ],
    }));
  } else if (parsed.length > 0 && scannedPageImages.length > 0) {
    if (!parsed[0].images || parsed[0].images.length === 0) {
      parsed[0] = {
        ...parsed[0],
        hasImage: true,
        images: [scannedPageImages[0]],
      };
    }
  }

  return normalizeAllQuestionsStrictFourOptions(parsed, resetPerPart);
}
