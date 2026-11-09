/**
 * Minimal WMF (Windows Metafile) → SVG converter, written for MathType
 * preview images (Equation.DSMT4 OLE previews) found in real teacher .docx
 * files. Browsers cannot render .wmf, so without this the formulas in such
 * files would be invisible.
 *
 * MathType WMFs use a small, regular dialect (verified by decoding every
 * WMF in a real exam file):
 *   - SetWindowOrg / SetWindowExt define the logical coordinate space.
 *   - SetTextAlign is TA_BASELINE | TA_UPDATECP (25): every ExtTextOut is
 *     anchored at the current position set by the preceding MoveTo, and its
 *     per-glyph dx array gives exact glyph advances — runs may even merge
 *     non-contiguous fragments of one font (e.g. "1 ≤ x ≤ 10" stores the
 *     digits "1" and "10" in ONE run, spaced by dx). We therefore emit one
 *     <text> per glyph whenever the dx array is usable.
 *   - Fraction bars / radical signs are MoveTo+LineTo strokes and Polygons.
 *   - Fonts are LOGFONT records (Times New Roman / Symbol); Symbol-charset
 *     bytes are mapped through the Adobe Symbol encoding to Unicode.
 *
 * Anything unexpected (bad header, truncated records, zero visible
 * elements) returns null so the caller can fall back to an honest
 * "unreadable" warning — content is never invented here.
 */

export interface WmfConversion {
  svg: string;
  /** Number of text glyphs emitted. */
  glyphs: number;
  /** Number of drawn shapes (lines, polygons, rects, ellipses). */
  shapes: number;
  /** Text runs in the "MT Extra" font whose glyphs cannot be mapped safely. */
  skippedMtExtraRuns: number;
}

interface LogFont {
  height: number;
  weight: number;
  italic: boolean;
  charset: number;
  face: string;
}

interface Pen {
  width: number;
  color: string;
}

interface Brush {
  solid: boolean;
  color: string;
}

type GdiObject =
  | { kind: 'font'; font: LogFont }
  | { kind: 'pen'; pen: Pen }
  | { kind: 'brush'; brush: Brush }
  | { kind: 'other' };

/** Adobe Symbol encoding → Unicode (only the entries with a safe mapping). */
const SYMBOL_MAP: Record<number, string> = {
  0x22: '∀', 0x24: '∃', 0x27: '∋', 0x2a: '∗', 0x2d: '−',
  0x41: 'Α', 0x42: 'Β', 0x43: 'Χ', 0x44: 'Δ', 0x45: 'Ε', 0x46: 'Φ',
  0x47: 'Γ', 0x48: 'Θ', 0x49: 'Ι', 0x4b: 'Κ', 0x4c: 'Λ', 0x4d: 'Μ',
  0x4e: 'Ν', 0x4f: 'Ο', 0x50: 'Π', 0x51: 'Θ', 0x52: 'Ρ', 0x53: 'Σ',
  0x54: 'Τ', 0x55: 'Υ', 0x56: 'ς', 0x57: 'Ω', 0x58: 'Ξ', 0x59: 'Ψ',
  0x5a: 'Ζ',
  0x61: 'α', 0x62: 'β', 0x63: 'χ', 0x64: 'δ', 0x65: 'ε', 0x66: 'φ',
  0x67: 'γ', 0x68: 'η', 0x69: 'ι', 0x6a: 'ϕ', 0x6b: 'κ', 0x6c: 'λ',
  0x6d: 'μ', 0x6e: 'ν', 0x6f: 'ο', 0x70: 'π', 0x71: 'θ', 0x72: 'ρ',
  0x73: 'σ', 0x74: 'τ', 0x75: 'υ', 0x76: 'ϖ', 0x77: 'ω', 0x78: 'ξ',
  0x79: 'ψ', 0x7a: 'ζ',
  0xa1: 'ϒ', 0xa2: '′', 0xa3: '≤', 0xa4: '⁄', 0xa5: '∞', 0xa6: 'ƒ',
  0xa7: '♣', 0xa8: '♦', 0xa9: '♥', 0xaa: '♠', 0xab: '↔', 0xac: '←',
  0xad: '↑', 0xae: '→', 0xaf: '↓', 0xb0: '°', 0xb1: '±', 0xb2: '″',
  0xb3: '≥', 0xb4: '×', 0xb5: '∝', 0xb6: '∂', 0xb7: '•', 0xb8: '÷',
  0xb9: '≠', 0xba: '≡', 0xbb: '≈', 0xbc: '…', 0xbd: '⏐', 0xbe: '―',
  0xbf: '↵', 0xc0: 'ℵ', 0xc1: 'ℑ', 0xc2: 'ℜ', 0xc3: '℘', 0xc4: '⊗',
  0xc5: '⊕', 0xc6: '∅', 0xc7: '∩', 0xc8: '∪', 0xc9: '⊃', 0xca: '⊇',
  0xcb: '⊄', 0xcc: '⊂', 0xcd: '⊆', 0xce: '∈', 0xcf: '∉', 0xd0: '∠',
  0xd1: '∇', 0xd2: '®', 0xd3: '©', 0xd4: '™', 0xd5: '∏', 0xd6: '√',
  0xd7: '⋅', 0xd8: '¬', 0xd9: '∧', 0xda: '∨', 0xdb: '⇔', 0xdc: '⇐',
  0xdd: '⇑', 0xde: '⇒', 0xdf: '⇓', 0xe0: '◊', 0xe1: '⟨', 0xe3: '⟩',
  0xe5: '∑', 0xe6: '⎛', 0xe7: '⎜', 0xe8: '⎝', 0xe9: '⎡', 0xea: '⎢',
  0xeb: '⎣', 0xec: '⎧', 0xed: '⎨', 0xee: '⎩', 0xef: '⎪',
  0xf1: '⌡', 0xf2: '⌠', 0xf3: '∫',
};

/** Windows-1252 mappings for the 0x80–0x9F range. */
const CP1252_HIGH: Record<number, string> = {
  0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…', 0x86: '†',
  0x87: '‡', 0x88: 'ˆ', 0x89: '‰', 0x8a: 'Š', 0x8b: '‹', 0x8c: 'Œ',
  0x8e: 'Ž', 0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•',
  0x96: '–', 0x97: '—', 0x98: '˜', 0x99: '™', 0x9a: 'š', 0x9b: '›',
  0x9c: 'œ', 0x9e: 'ž', 0x9f: 'Ÿ',
};

function escapeXmlText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtNum(n: number): string {
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? String(r) : String(r);
}

function colorRefToHex(v: number): string {
  const r = v & 0xff;
  const g = (v >> 8) & 0xff;
  const b = (v >> 16) & 0xff;
  const h = (n: number) => n.toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function fontFamilyFor(face: string): string {
  if (/courier/i.test(face)) return "'Courier New', monospace";
  if (/^[A-Za-z0-9 ]+$/.test(face.trim()) && face.trim()) {
    return `'${face.trim()}', 'Times New Roman', serif`;
  }
  return "'Times New Roman', Times, serif";
}

export function convertWmfToSvg(
  bytes: Uint8Array,
  size?: { widthPt?: number; heightPt?: number }
): WmfConversion | null {
  try {
    return convertWmfToSvgInner(bytes, size);
  } catch {
    return null;
  }
}

function convertWmfToSvgInner(
  bytes: Uint8Array,
  size?: { widthPt?: number; heightPt?: number }
): WmfConversion | null {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 18) return null;

  let offset = 0;
  // Aldus placeable header (22 bytes) — optional.
  if (bytes.length >= 22 && dv.getUint32(0, true) === 0x9ac6cdd7) {
    offset = 22;
  }
  if (offset + 18 > bytes.length) return null;
  const headerWords = dv.getUint16(offset + 2, true);
  if (headerWords < 9) return null;
  let pos = offset + headerWords * 2;

  // --- drawing state -------------------------------------------------------
  let winOrg = { x: 0, y: 0 };
  let winExt = { x: 0, y: 0 };
  let curPos = { x: 0, y: 0 };
  let textColor = '#000000';
  let textAlign = 0;
  let bkMode = 1;
  const objects: (GdiObject | null)[] = [];
  let font: LogFont | null = null;
  let pen: Pen = { width: 0, color: '#000000' };
  let brush: Brush = { solid: true, color: '#000000' };
  // MathType habitually CREATES its Symbol font but emits some Symbol runs
  // without ever selecting it (the run's bytes are still Symbol-encoded).
  // When a Symbol font exists in the file, high bytes (≥ 0xA0) that have a
  // Symbol mapping are decoded as Symbol even under a Times selection.
  let sawSymbolFont = false;
  const dcStack: Array<{
    font: LogFont | null; pen: Pen; brush: Brush; textColor: string; textAlign: number; curPos: { x: number; y: number };
  }> = [];

  const elements: string[] = [];
  let glyphs = 0;
  let shapes = 0;
  let skippedMtExtraRuns = 0;

  const defaultFontSize = () => (winExt.y > 0 ? winExt.y / 3 : 100);

  const emitTextRun = (
    raw: Uint8Array,
    anchor: { x: number; y: number },
    dx: number[] | null
  ): void => {
    if (!raw.length) return;
    const fnt = font;
    const isSymbol = !!fnt && (fnt.charset === 2 || /symbol/i.test(fnt.face));
    const isMtExtra = !!fnt && /mt\s*extra/i.test(fnt.face);

    const decoded: string[] = [];
    for (let i = 0; i < raw.length; i++) {
      const b = raw[i];
      if (isSymbol || (sawSymbolFont && b >= 0xa0 && SYMBOL_MAP[b] !== undefined)) {
        decoded.push(SYMBOL_MAP[b] ?? (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : ''));
      } else if (b < 0x80) {
        decoded.push(String.fromCharCode(b));
      } else if (b >= 0xa0) {
        decoded.push(String.fromCharCode(b));
      } else {
        decoded.push(CP1252_HIGH[b] ?? '');
      }
    }

    if (isMtExtra) {
      // MT Extra glyphs are font-private (fence/radical pieces). Rendering
      // them as ordinary characters would fabricate wrong math — skip and
      // let the caller know this formula may be incomplete.
      skippedMtExtraRuns++;
      return;
    }

    const fontSize = fnt && fnt.height !== 0 ? Math.abs(fnt.height) : defaultFontSize();
    // Vertical alignment: TA_BASELINE (24) → y is the baseline (SVG default).
    let y = anchor.y;
    const vAlign = textAlign & 0x18;
    if (vAlign === 0) y += fontSize * 0.82; // TA_TOP
    else if (vAlign === 8) y -= fontSize * 0.22; // TA_BOTTOM (approx.)

    const attrs: string[] = [
      `font-family="${fontFamilyFor(fnt?.face || 'Times New Roman')}"`,
      `font-size="${fmtNum(fontSize)}"`,
      `fill="${textColor}"`,
    ];
    if (fnt?.italic) attrs.push('font-style="italic"');
    if (fnt && fnt.weight >= 600) attrs.push('font-weight="bold"');
    if (bkMode === 2) {
      // Opaque background — MathType uses transparent; ignore (rare).
    }

    const dxUsable =
      dx !== null &&
      dx.length >= decoded.length &&
      dx.slice(0, decoded.length).every((v) => Math.abs(v) <= Math.max(winExt.x, 1) * 2);

    if (dxUsable && dx) {
      let gx = anchor.x;
      for (let i = 0; i < decoded.length; i++) {
        const ch = decoded[i];
        if (ch && ch !== ' ') {
          elements.push(
            `<text x="${fmtNum(gx)}" y="${fmtNum(y)}" ${attrs.join(' ')}>${escapeXmlText(ch)}</text>`
          );
          glyphs++;
        }
        gx += dx[i] || 0;
      }
      curPos = { x: gx, y: anchor.y };
    } else {
      const text = decoded.join('');
      if (!text.trim()) return;
      const hAlign = textAlign & 0x06;
      const anchorAttr = hAlign === 6 ? ' text-anchor="middle"' : hAlign === 2 ? ' text-anchor="end"' : '';
      elements.push(
        `<text x="${fmtNum(anchor.x)}" y="${fmtNum(y)}"${anchorAttr} ${attrs.join(' ')} xml:space="preserve">${escapeXmlText(text)}</text>`
      );
      glyphs += text.replace(/\s/g, '').length;
      curPos = { x: anchor.x, y: anchor.y };
    }
  };

  // --- record loop ---------------------------------------------------------
  let guard = 0;
  while (pos + 6 <= bytes.length && guard++ < 100000) {
    const sizeWords = dv.getUint32(pos, true);
    const func = dv.getUint16(pos + 4, true);
    if (sizeWords < 3) break;
    const paramStart = pos + 6;
    const paramBytes = (sizeWords - 3) * 2;
    if (paramStart + paramBytes > bytes.length) break;
    const P = (i: number) => dv.getInt16(paramStart + i, true);
    const PU = (i: number) => dv.getUint16(paramStart + i, true);
    const PI32 = (i: number) => dv.getInt32(paramStart + i, true);

    switch (func) {
      case 0x0000: // EOF
        pos = bytes.length;
        break;
      case 0x020b: // SetWindowOrg (Y, X)
        winOrg = { x: P(2), y: P(0) };
        break;
      case 0x020c: // SetWindowExt (Y, X)
        winExt = { x: P(2), y: P(0) };
        break;
      case 0x020e: // SetViewportExt — logical space already comes from window ext
      case 0x020d: // SetViewportOrg
      case 0x0103: // SetMapMode
      case 0x0102: // SetBkMode value matters only for text bg; tracked below via case 0x0102
        if (func === 0x0102) bkMode = PU(0);
        break;
      case 0x0209: // SetTextColor (COLORREF)
        textColor = colorRefToHex(PI32(0));
        break;
      case 0x012e: // SetTextAlign
        textAlign = PU(0);
        break;
      case 0x0214: // MoveTo (Y, X)
        curPos = { x: P(2), y: P(0) };
        break;
      case 0x0213: { // LineTo (Y, X)
        const to = { x: P(2), y: P(0) };
        const w = pen.width > 0 ? pen.width : Math.max(1, Math.round(Math.max(winExt.x, 1) / 600));
        elements.push(
          `<line x1="${fmtNum(curPos.x)}" y1="${fmtNum(curPos.y)}" x2="${fmtNum(to.x)}" y2="${fmtNum(to.y)}" stroke="${pen.color}" stroke-width="${fmtNum(w)}"/>`
        );
        shapes++;
        curPos = to;
        break;
      }
      case 0x041b: { // Rectangle (Y2, X2, Y1, X1)
        const y2 = P(0), x2 = P(2), y1 = P(4), x1 = P(6);
        elements.push(
          `<rect x="${fmtNum(Math.min(x1, x2))}" y="${fmtNum(Math.min(y1, y2))}" width="${fmtNum(Math.abs(x2 - x1))}" height="${fmtNum(Math.abs(y2 - y1))}" fill="${brush.solid ? brush.color : 'none'}" stroke="${pen.color}"/>`
        );
        shapes++;
        break;
      }
      case 0x0418: { // Ellipse (Y2, X2, Y1, X1)
        const y2 = P(0), x2 = P(2), y1 = P(4), x1 = P(6);
        elements.push(
          `<ellipse cx="${fmtNum((x1 + x2) / 2)}" cy="${fmtNum((y1 + y2) / 2)}" rx="${fmtNum(Math.abs(x2 - x1) / 2)}" ry="${fmtNum(Math.abs(y2 - y1) / 2)}" fill="${brush.solid ? brush.color : 'none'}" stroke="${pen.color}"/>`
        );
        shapes++;
        break;
      }
      case 0x0324: // Polygon: count, then (X, Y) point pairs
      case 0x0325: { // Polyline
        const count = PU(0);
        const pts: string[] = [];
        for (let i = 0; i < count; i++) {
          const px = P(2 + i * 4);
          const py = P(4 + i * 4);
          pts.push(`${fmtNum(px)},${fmtNum(py)}`);
        }
        if (pts.length > 1) {
          if (func === 0x0324) {
            elements.push(
              `<polygon points="${pts.join(' ')}" fill="${brush.solid ? brush.color : 'none'}" stroke="${pen.color}"/>`
            );
          } else {
            elements.push(
              `<polyline points="${pts.join(' ')}" fill="none" stroke="${pen.color}"/>`
            );
          }
          shapes++;
        }
        break;
      }
      case 0x0521: { // TextOut: count, string (padded), X, Y
        const count = PU(0);
        const strStart = paramStart + 2;
        const raw = bytes.subarray(strStart, Math.min(strStart + count, paramStart + paramBytes));
        const afterStr = 2 + Math.ceil(count / 2) * 2;
        const x = paramStart + afterStr + 2 <= paramStart + paramBytes ? P(afterStr + 2) : curPos.x;
        const y = paramStart + afterStr + 2 <= paramStart + paramBytes ? P(afterStr) : curPos.y;
        emitTextRun(raw, { x, y }, null);
        break;
      }
      case 0x0a32: { // ExtTextOut: Y, X, count, options, [rect], string, dx[]
        const y = P(0);
        const x = P(2);
        const count = P(4);
        const options = PU(6);
        if (count > 0) {
          let strOff = 8;
          if (options & 0x0006) strOff += 8; // ETO_OPAQUE / ETO_CLIPPED rectangle
          const strStart = paramStart + strOff;
          const raw = bytes.subarray(strStart, Math.min(strStart + count, paramStart + paramBytes));
          const dxOff = strOff + Math.ceil(count / 2) * 2;
          let dx: number[] | null = null;
          if (dxOff + count * 2 <= paramBytes) {
            dx = [];
            for (let i = 0; i < count; i++) dx.push(P(dxOff + i * 2));
          }
          const useCurrentPos = (textAlign & 0x0001) !== 0 || (x === 0 && y === 0);
          emitTextRun(raw, useCurrentPos ? { ...curPos } : { x, y }, dx);
        }
        break;
      }
      case 0x02fb: { // CreateFontIndirect (LOGFONT, 50 bytes)
        const faceBytes: number[] = [];
        for (let i = 0; i < 32 && paramStart + 18 + i < paramStart + paramBytes; i++) {
          const b = bytes[paramStart + 18 + i];
          if (b === 0) break;
          faceBytes.push(b);
        }
        const lf: LogFont = {
          height: P(0),
          weight: PU(8),
          italic: bytes[paramStart + 10] !== 0,
          charset: bytes[paramStart + 13] ?? 0,
          face: String.fromCharCode(...faceBytes),
        };
        if (lf.charset === 2 || /symbol/i.test(lf.face)) sawSymbolFont = true;
        objects.push({ kind: 'font', font: lf });
        break;
      }
      case 0x02fa: { // CreatePenIndirect: style, width POINT, color
        objects.push({
          kind: 'pen',
          pen: { width: P(2), color: colorRefToHex(PI32(6)) },
        });
        break;
      }
      case 0x02fc: { // CreateBrushIndirect: style, color, hatch
        objects.push({
          kind: 'brush',
          brush: { solid: PU(0) === 0, color: colorRefToHex(PI32(2)) },
        });
        break;
      }
      case 0x00f7: // CreatePalette
      case 0x01f9: // CreatePatternBrush
      case 0x06ff: // CreateRegion
        objects.push({ kind: 'other' });
        break;
      case 0x012d: { // SelectObject
        const idx = P(0);
        const obj = idx >= 0 && idx < objects.length ? objects[idx] : null;
        if (obj) {
          if (obj.kind === 'font') font = obj.font;
          else if (obj.kind === 'pen') pen = obj.pen;
          else if (obj.kind === 'brush') brush = obj.brush;
        }
        break;
      }
      case 0x01f0: { // DeleteObject
        const idx = P(0);
        if (idx >= 0 && idx < objects.length) objects[idx] = null;
        break;
      }
      case 0x001e: // SaveDC
        dcStack.push({ font, pen, brush, textColor, textAlign, curPos: { ...curPos } });
        break;
      case 0x0127: { // RestoreDC
        const saved = dcStack.pop();
        if (saved) {
          font = saved.font; pen = saved.pen; brush = saved.brush;
          textColor = saved.textColor; textAlign = saved.textAlign; curPos = saved.curPos;
        }
        break;
      }
      default:
        // Escape (0x0626, MathType comments), palette/clip/ROP records, …
        break;
    }

    pos += sizeWords * 2;
  }

  if (elements.length === 0) return null;
  if (winExt.x <= 0 || winExt.y <= 0) return null;

  const sizeAttrs =
    size && size.widthPt && size.heightPt && size.widthPt > 0 && size.heightPt > 0
      ? ` width="${fmtNum(size.widthPt)}pt" height="${fmtNum(size.heightPt)}pt"`
      : '';
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fmtNum(winOrg.x)} ${fmtNum(winOrg.y)} ${fmtNum(winExt.x)} ${fmtNum(winExt.y)}"${sizeAttrs} preserveAspectRatio="xMidYMid meet">` +
    elements.join('') +
    '</svg>';

  return { svg, glyphs, shapes, skippedMtExtraRuns };
}
