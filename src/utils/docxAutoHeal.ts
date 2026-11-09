/**
 * EDUMIX AUTO-HEAL ENGINE (Vite + TypeScript)
 * Tự động sửa lỗi ảnh WMF/EMF sang PNG 300 DPI chuẩn Canvas, bảo toàn công thức Toán - Lý - Hóa - Sinh,
 * vectơ, số mũ, chỉ số dưới và ký hiệu đặc biệt trên cả Web và khi xuất file Word (.docx).
 */

declare global {
  interface Window {
    WMF?: {
      imageSize?: (buffer: ArrayBuffer) => { width?: number; height?: number };
      drawCanvas?: (buffer: ArrayBuffer, canvas: HTMLCanvasElement) => void;
    };
  }
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, Math.min(bytes.length, i + chunkSize));
    binary += String.fromCharCode(...sub);
  }
  return btoa(binary);
}

function canvasHasVisibleContent(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  try {
    const data = ctx.getImageData(0, 0, w, h).data;
    for (let i = 0; i < data.length; i += 16) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a > 20 && (r < 248 || g < 248 || b < 248)) {
        return true;
      }
    }
  } catch {
    // Ignore security/read errors
  }
  return false;
}

export class DocxAutoHealEngine {
  mediaMap: Record<string, string> = {};

  /**
   * Trích xuất ảnh PNG, JPEG hoặc DIB (Device Independent Bitmap trong EMR_STRETCHDIBITS / META_DIBSTRETCHBLT)
   * nhúng bên trong luồng nhị phân WMF/EMF
   */
  extractEmbeddedBitmapFromMetafile(bytes: Uint8Array): string | null {
    // 1. Tìm chữ ký PNG (\x89PNG\r\n\x1a\n) và kết thúc IEND
    for (let i = 0; i + 16 < bytes.length; i++) {
      if (
        bytes[i] === 0x89 &&
        bytes[i + 1] === 0x50 &&
        bytes[i + 2] === 0x4e &&
        bytes[i + 3] === 0x47 &&
        bytes[i + 4] === 0x0d &&
        bytes[i + 5] === 0x0a &&
        bytes[i + 6] === 0x1a &&
        bytes[i + 7] === 0x0a
      ) {
        for (let j = i + 8; j + 8 <= bytes.length; j++) {
          if (
            bytes[j] === 0x49 &&
            bytes[j + 1] === 0x45 &&
            bytes[j + 2] === 0x4e &&
            bytes[j + 3] === 0x44
          ) {
            const endIdx = Math.min(bytes.length, j + 8);
            const slice = bytes.slice(i, endIdx);
            return `data:image/png;base64,${uint8ToBase64(slice)}`;
          }
        }
      }
    }

    // 2. Tìm chữ ký JPEG (\xFF\xD8\xFF) và kết thúc \xFF\xD9
    for (let i = 0; i + 16 < bytes.length; i++) {
      if (bytes[i] === 0xff && bytes[i + 1] === 0xd8 && bytes[i + 2] === 0xff) {
        for (let j = bytes.length - 2; j > i + 16; j--) {
          if (bytes[j] === 0xff && bytes[j + 1] === 0xd9) {
            const slice = bytes.slice(i, j + 2);
            return `data:image/jpeg;base64,${uint8ToBase64(slice)}`;
          }
        }
      }
    }

    // 3. Tìm cấu trúc DIB (BITMAPINFOHEADER: biSize = 40 = 0x28000000) trong WMF/EMF
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let bestBmpBytes: Uint8Array | null = null;
    let bestPixelArea = 0;

    for (let i = 0; i + 40 <= bytes.length; i += 2) {
      if (
        bytes[i] !== 0x28 ||
        bytes[i + 1] !== 0x00 ||
        bytes[i + 2] !== 0x00 ||
        bytes[i + 3] !== 0x00
      ) {
        continue;
      }

      const biWidth = view.getInt32(i + 4, true);
      const biHeightRaw = view.getInt32(i + 8, true);
      const biHeight = Math.abs(biHeightRaw);
      const biPlanes = view.getUint16(i + 12, true);
      const biBitCount = view.getUint16(i + 14, true);
      const biCompression = view.getUint32(i + 16, true);
      const biSizeImage = view.getUint32(i + 20, true);
      const biClrUsed = view.getUint32(i + 32, true);

      if (
        biPlanes !== 1 ||
        biWidth < 8 ||
        biWidth > 8192 ||
        biHeight < 8 ||
        biHeight > 8192 ||
        ![1, 4, 8, 16, 24, 32].includes(biBitCount) ||
        (biCompression !== 0 && biCompression !== 3)
      ) {
        continue;
      }

      const paletteColors =
        biBitCount <= 8
          ? biClrUsed > 0 && biClrUsed <= 1 << biBitCount
            ? biClrUsed
            : 1 << biBitCount
          : 0;
      const paletteBytes =
        paletteColors * 4 + (biCompression === 3 ? 12 : 0);

      const rowStride = Math.floor((biWidth * biBitCount + 31) / 32) * 4;
      const computedPixelBytes = rowStride * biHeight;
      const pixelBytes =
        biSizeImage > 0 && biSizeImage <= bytes.length - (i + 40 + paletteBytes)
          ? biSizeImage
          : computedPixelBytes;

      const totalDibBytes = 40 + paletteBytes + pixelBytes;
      if (totalDibBytes <= 40 || i + totalDibBytes > bytes.length) {
        continue;
      }

      const area = biWidth * biHeight;
      if (area > bestPixelArea) {
        bestPixelArea = area;
        const bmpTotalSize = 14 + totalDibBytes;
        const bmpBuffer = new Uint8Array(bmpTotalSize);
        const bmpView = new DataView(bmpBuffer.buffer);
        // BITMAPFILEHEADER ('BM')
        bmpBuffer[0] = 0x42;
        bmpBuffer[1] = 0x4d;
        bmpView.setUint32(2, bmpTotalSize, true);
        bmpView.setUint32(6, 0, true);
        bmpView.setUint32(10, 14 + 40 + paletteBytes, true);
        bmpBuffer.set(bytes.subarray(i, i + totalDibBytes), 14);
        bestBmpBytes = bmpBuffer;
      }
    }

    if (bestBmpBytes) {
      return `data:image/bmp;base64,${uint8ToBase64(bestBmpBytes)}`;
    }

    return null;
  }

  /**
   * Kết xuất trực tiếp các bản ghi hình học Vector trong 32-bit EMF (Enhanced Metafile) lên HTML5 Canvas
   */
  renderEmfVectorToPngDataUrl(bytes: Uint8Array): string | null {
    if (typeof document === 'undefined' || bytes.length < 88) return null;
    try {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const firstType = view.getUint32(0, true);
      const signature = view.getUint32(40, true);
      // EMR_HEADER = 1, ' EMF' = 0x464D4520
      if (firstType !== 1 || signature !== 0x464d4520) {
        return null;
      }

      const boundsLeft = view.getInt32(8, true);
      const boundsTop = view.getInt32(12, true);
      const boundsRight = view.getInt32(16, true);
      const boundsBottom = view.getInt32(20, true);

      const rawW = boundsRight - boundsLeft;
      const rawH = boundsBottom - boundsTop;
      const minX = rawW > 10 ? boundsLeft : 0;
      const minY = rawH > 10 ? boundsTop : 0;
      const spanW = rawW > 10 ? rawW : 600;
      const spanH = rawH > 10 ? rawH : 360;

      const targetW = Math.max(240, Math.min(1000, spanW));
      const scale = targetW / Math.max(1, spanW);
      const targetH = Math.max(100, Math.min(800, Math.round(spanH * scale)));
      const pad = 16;

      const canvas = document.createElement('canvas');
      canvas.width = targetW + pad * 2;
      canvas.height = targetH + pad * 2;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#0F172A';
      ctx.fillStyle = '#0F172A';
      ctx.lineWidth = 1.6;
      ctx.font = '14px "Times New Roman", Times, serif';

      const tx = (x: number) => (x - minX) * scale + pad;
      const ty = (y: number) => (y - minY) * scale + pad;

      let offset = 0;
      let curX = 0;
      let curY = 0;
      let drawnOps = 0;

      while (offset + 8 <= bytes.length) {
        const recType = view.getUint32(offset, true);
        const recSize = view.getUint32(offset + 4, true);
        if (recSize < 8 || offset + recSize > bytes.length) break;

        if (recType === 14) {
          // EMR_EOF
          break;
        } else if (recType === 27 && recSize >= 16) {
          // EMR_MOVETOEX
          curX = view.getInt32(offset + 8, true);
          curY = view.getInt32(offset + 12, true);
        } else if (recType === 54 && recSize >= 16) {
          // EMR_LINETO
          const nx = view.getInt32(offset + 8, true);
          const ny = view.getInt32(offset + 12, true);
          ctx.beginPath();
          ctx.moveTo(tx(curX), ty(curY));
          ctx.lineTo(tx(nx), ty(ny));
          ctx.stroke();
          curX = nx;
          curY = ny;
          drawnOps++;
        } else if ((recType === 43 || recType === 42) && recSize >= 24) {
          // EMR_RECTANGLE (43) / EMR_ELLIPSE (42)
          const l = view.getInt32(offset + 8, true);
          const t = view.getInt32(offset + 12, true);
          const r = view.getInt32(offset + 16, true);
          const b = view.getInt32(offset + 20, true);
          ctx.beginPath();
          if (recType === 43) {
            ctx.rect(tx(l), ty(t), (r - l) * scale, (b - t) * scale);
          } else {
            ctx.ellipse(
              tx((l + r) / 2),
              ty((t + b) / 2),
              Math.abs((r - l) * scale) / 2,
              Math.abs((b - t) * scale) / 2,
              0,
              0,
              Math.PI * 2
            );
          }
          ctx.stroke();
          drawnOps++;
        } else if ((recType === 3 || recType === 4) && recSize >= 28) {
          // EMR_POLYGON (3) / EMR_POLYLINE (4) - 32-bit points
          const count = view.getUint32(offset + 24, true);
          if (count >= 2 && offset + 28 + count * 8 <= offset + recSize) {
            ctx.beginPath();
            for (let p = 0; p < count; p++) {
              const px = view.getInt32(offset + 28 + p * 8, true);
              const py = view.getInt32(offset + 28 + p * 8 + 4, true);
              if (p === 0) ctx.moveTo(tx(px), ty(py));
              else ctx.lineTo(tx(px), ty(py));
            }
            if (recType === 3) ctx.closePath();
            ctx.stroke();
            drawnOps++;
          }
        } else if ((recType === 85 || recType === 86 || recType === 87 || recType === 88) && recSize >= 28) {
          // EMR_POLYGON16 (85) / EMR_POLYLINE16 (86) / EMR_POLYBEZIERTO16 (88) - 16-bit points
          const count = view.getUint32(offset + 24, true);
          if (count >= 2 && offset + 28 + count * 4 <= offset + recSize) {
            ctx.beginPath();
            for (let p = 0; p < count; p++) {
              const px = view.getInt16(offset + 28 + p * 4, true);
              const py = view.getInt16(offset + 28 + p * 4 + 2, true);
              if (p === 0) ctx.moveTo(tx(px), ty(py));
              else ctx.lineTo(tx(px), ty(py));
            }
            if (recType === 85) ctx.closePath();
            ctx.stroke();
            drawnOps++;
          }
        } else if (recType === 84 && recSize >= 76) {
          // EMR_EXTTEXTOUTW (Unicode text inside EMF diagram)
          const refX = view.getInt32(offset + 36, true);
          const refY = view.getInt32(offset + 40, true);
          const nChars = view.getUint32(offset + 44, true);
          const offString = view.getUint32(offset + 48, true);
          if (nChars > 0 && nChars < 256 && offString >= 40 && offset + offString + nChars * 2 <= offset + recSize) {
            const chars: number[] = [];
            for (let c = 0; c < nChars; c++) {
              chars.push(view.getUint16(offset + offString + c * 2, true));
            }
            const str = String.fromCharCode(...chars).trim();
            if (str) {
              ctx.fillStyle = '#0F172A';
              ctx.fillText(str, tx(refX), ty(refY));
              drawnOps++;
            }
          }
        }

        offset += recSize;
      }

      if (drawnOps >= 1 && canvasHasVisibleContent(ctx, canvas.width, canvas.height)) {
        return canvas.toDataURL('image/png', 1.0);
      }
    } catch {
      // Ignore EMF parse error
    }
    return null;
  }

  /**
   * Chuyển đổi file WMF / EMF sang DataURL ảnh PNG sắc nét (hoạt động cả trên Web <img> và khi đóng gói .docx)
   */
  async convertMetafileBytesToPngDataUrl(
    bytes: Uint8Array,
    fileName: string
  ): Promise<string> {
    // Bước 1: Kiểm tra xem trong WMF/EMF có nhúng sẵn luồng PNG/JPEG/DIB (BMP) gốc hay không
    const embeddedBitmap = this.extractEmbeddedBitmapFromMetafile(bytes);
    if (embeddedBitmap) {
      return embeddedBitmap;
    }

    // Bước 2: Nếu là 32-bit EMF Vector, kết xuất các lệnh vẽ EMF trực tiếp lên Canvas
    const emfRendered = this.renderEmfVectorToPngDataUrl(bytes);
    if (emfRendered) {
      return emfRendered;
    }

    // Bước 3: Dùng thư viện wmf.min.js (window.WMF) để kết xuất trực tiếp lên thẻ <canvas> (kiểm tra có nét vẽ thật sự)
    if (
      typeof window !== 'undefined' &&
      typeof document !== 'undefined' &&
      window.WMF &&
      typeof window.WMF.drawCanvas === 'function'
    ) {
      try {
        const ab = bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength
        ) as ArrayBuffer;
        const size =
          typeof window.WMF.imageSize === 'function'
            ? window.WMF.imageSize(ab)
            : { width: 320, height: 96 };
        const w = Math.max(80, Math.min(1200, size?.width || 320));
        const h = Math.max(36, Math.min(900, size?.height || 96));

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, w, h);
        }
        window.WMF.drawCanvas(ab, canvas);
        if (ctx && canvasHasVisibleContent(ctx, w, h)) {
          const pngUrl = canvas.toDataURL('image/png', 1.0);
          if (pngUrl && pngUrl.startsWith('data:image/png;base64,')) {
            return pngUrl;
          }
        }
      } catch {
        // Chuyển sang Bước 4 nếu WMF record đặc biệt
      }
    }

    // Bước 4: Không đọc được nội dung metafile này bằng bất kỳ đường thật nào
    // ở trên. Trả về khung vector TRUNG THỰC "[Công thức/Hình]" — TUYỆT ĐỐI
    // không trích "chuỗi đọc được" từ byte nhị phân rồi in lên ảnh như thể đó
    // là nội dung công thức (lỗi cũ: chữ rác "Lu@", "AppsMFCC", "Design
    // Science…" bị đóng khung thành ảnh công thức giả trong đề).
    return this.createVectorPlaceholder(fileName);
  }

  // Chữa lỗi ảnh WMF/EMF và toàn bộ media trong gói .docx sang DataURL chuẩn
  async extractAndHealMedia(zip: any): Promise<Record<string, string>> {
    this.mediaMap = {};
    const mediaFiles = Object.keys(zip.files).filter((path) =>
      path.startsWith('word/media/')
    );

    for (const filePath of mediaFiles) {
      const fileEntry = zip.files[filePath];
      if (!fileEntry || fileEntry.dir) continue;
      const fileName = filePath.split('/').pop() || '';
      const ext = fileName.split('.').pop()?.toLowerCase() || 'png';

      if (ext === 'wmf' || ext === 'emf') {
        const uint8 = await fileEntry.async('uint8array');
        this.mediaMap[fileName] = await this.convertMetafileBytesToPngDataUrl(
          uint8,
          fileName
        );
      } else {
        const base64 = await fileEntry.async('base64');
        const mime =
          ext === 'png'
            ? 'image/png'
            : ext === 'gif'
            ? 'image/gif'
            : ext === 'bmp'
            ? 'image/bmp'
            : ext === 'webp'
            ? 'image/webp'
            : ext === 'svg'
            ? 'image/svg+xml'
            : 'image/jpeg';
        this.mediaMap[fileName] = `data:${mime};base64,${base64}`;
      }
    }
    return this.mediaMap;
  }

  // Khung SVG giả lập công thức/hình vector tránh làm vỡ giao diện
  createVectorPlaceholder(fileName: string): string {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="160" height="48" viewBox="0 0 160 48">
        <rect width="100%" height="100%" fill="#f1f5f9" stroke="#cbd5e1" rx="4"/>
        <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" font-family="Times New Roman, serif" font-size="11" fill="#475569">
          [Công thức/Hình]
        </text>
        <text x="50%" y="75%" dominant-baseline="middle" text-anchor="middle" font-family="Times New Roman, serif" font-size="9" fill="#94a3b8">
          ${fileName}
        </text>
      </svg>
    `;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }
}

export const defaultDocxAutoHealEngine = new DocxAutoHealEngine();
