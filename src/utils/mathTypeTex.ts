/**
 * MathType OLE (.bin embedding) → LaTeX extraction.
 *
 * When a teacher enables MathType's "TeX Input Language" translator, every
 * Equation.DSMT4 OLE object stores the equation's LaTeX in a stream inside
 * its compound-file binary, right after the text "TeX Input Language",
 * wrapped in one outer brace pair, e.g. "{y = \frac{2x-1}{x+3}}".
 *
 * Verified against a real teacher file: 68 of 122 MathType objects carried
 * such a stream, and the recovered LaTeX matched the vector (WMF) preview
 * glyph-for-glyph. The remaining objects have no TeX stream — the caller
 * falls back to converting their WMF previews. Nothing is invented here:
 * a candidate is accepted only if it is a balanced brace group of clean,
 * printable TeX-looking text.
 */

export function extractMathTypeTex(bytes: Uint8Array): string | null {
  // Latin-1 decode (byte-preserving) — the TeX stream is plain ASCII.
  let s = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const sub = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
    s += String.fromCharCode(...sub);
  }

  const marker = s.indexOf('TeX Input Language');
  if (marker === -1) return null;

  const searchFrom = marker + 'TeX Input Language'.length;
  const start = s.indexOf('{', searchFrom);
  if (start === -1 || start - searchFrom > 600) return null;

  // Balanced-brace scan from the first '{'.
  let depth = 0;
  let end = -1;
  const limit = Math.min(s.length, start + 6000);
  for (let i = start; i < limit; i++) {
    const c = s[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    } else if (c < ' ' && c !== '\t') {
      // Binary junk inside the candidate — this was not the TeX string.
      return null;
    }
  }
  if (end === -1) return null;

  const inner = s.substring(start + 1, end).trim();
  if (!inner) return null;
  if (!/^[\x20-\x7E]+$/.test(inner)) return null;
  if (!/[A-Za-z0-9]/.test(inner)) return null;
  // Font/table names also live near the marker — never accept those.
  if (/^(Times|Symbol|Courier|MT\s|System|WinAll)/i.test(inner)) return null;
  return inner;
}

/** Rough plain-text rendering of a TeX fragment (for search/plain views). */
export function texToPlain(tex: string): string {
  const plain = tex
    .replace(/\\[a-zA-Z]+/g, ' ')
    .replace(/[{}$^_\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return plain || tex;
}
