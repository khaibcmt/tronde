import katex from 'katex';
import {
  ExamImageAttachment,
  ExamQuestion,
  ExamStemTable,
  ExamTableCell,
} from '../types/exam';

/**
 * Bản đồ giải mã vùng Private Use Area (PUA: U+F020..U+F0FF) từ font Symbol / MT Extra / Wingdings của Microsoft Word cũ
 * sang chuẩn UTF-8 Unicode (Cambria Math) để triệt tiêu hoàn toàn lỗi ô vuông (□) khi mở trên Word.
 */
const PUA_SYMBOL_TO_UNICODE_MAP: Record<number, string> = {
  0xf020: ' ',
  0xf021: '!',
  0xf022: '∀',
  0xf023: '#',
  0xf024: '∃',
  0xf025: '%',
  0xf026: '&',
  0xf027: '∋',
  0xf028: '(',
  0xf029: ')',
  0xf02a: '∗',
  0xf02b: '+',
  0xf02c: ',',
  0xf02d: '−',
  0xf02e: '.',
  0xf02f: '/',
  0xf030: '0',
  0xf031: '1',
  0xf032: '2',
  0xf033: '3',
  0xf034: '4',
  0xf035: '5',
  0xf036: '6',
  0xf037: '7',
  0xf038: '8',
  0xf039: '9',
  0xf03a: ':',
  0xf03b: ';',
  0xf03c: '<',
  0xf03d: '=',
  0xf03e: '>',
  0xf03f: '?',
  0xf040: '≅',
  0xf041: 'Α',
  0xf042: 'Β',
  0xf043: 'Χ',
  0xf044: 'Δ',
  0xf045: 'Ε',
  0xf046: 'Φ',
  0xf047: 'Γ',
  0xf048: 'Η',
  0xf049: 'Ι',
  0xf04a: 'ϑ',
  0xf04b: 'Κ',
  0xf04c: 'Λ',
  0xf04d: 'Μ',
  0xf04e: 'Ν',
  0xf04f: 'Ο',
  0xf050: 'Π',
  0xf051: 'Θ',
  0xf052: 'Ρ',
  0xf053: 'Σ',
  0xf054: 'Τ',
  0xf055: 'Υ',
  0xf056: 'ς',
  0xf057: 'Ω',
  0xf058: 'Ξ',
  0xf059: 'Ψ',
  0xf05a: 'Ζ',
  0xf05b: '[',
  0xf05c: '∴',
  0xf05d: ']',
  0xf05e: '⊥',
  0xf05f: '_',
  0xf060: '‾',
  0xf061: 'α',
  0xf062: 'β',
  0xf063: 'χ',
  0xf064: 'δ',
  0xf065: 'ε',
  0xf066: 'φ',
  0xf067: 'γ',
  0xf068: 'η',
  0xf069: 'ι',
  0xf06a: 'ϕ',
  0xf06b: 'κ',
  0xf06c: 'λ',
  0xf06d: 'μ',
  0xf06e: 'ν',
  0xf06f: 'ο',
  0xf070: 'π',
  0xf071: 'θ',
  0xf072: 'ρ',
  0xf073: 'σ',
  0xf074: 'τ',
  0xf075: 'υ',
  0xf076: 'ϖ',
  0xf077: 'ω',
  0xf078: 'ξ',
  0xf079: 'ψ',
  0xf07a: 'ζ',
  0xf07b: '{',
  0xf07c: '|',
  0xf07d: '}',
  0xf07e: '∼',
  0xf0a0: '€',
  0xf0a1: 'ϒ',
  0xf0a2: '′',
  0xf0a3: '≤',
  0xf0a4: '⁄',
  0xf0a5: '∞',
  0xf0a6: 'ƒ',
  0xf0a7: '♣',
  0xf0a8: '♦',
  0xf0a9: '♥',
  0xf0aa: '♠',
  0xf0ab: '↔',
  0xf0ac: '←',
  0xf0ad: '↑',
  0xf0ae: '→',
  0xf0af: '↓',
  0xf0b0: '°',
  0xf0b1: '±',
  0xf0b2: '″',
  0xf0b3: '≥',
  0xf0b4: '×',
  0xf0b5: '∝',
  0xf0b6: '∂',
  0xf0b7: '•',
  0xf0b8: '÷',
  0xf0b9: '≠',
  0xf0ba: '≡',
  0xf0bb: '≈',
  0xf0bc: '…',
  0xf0bd: '∣',
  0xf0be: '⎯',
  0xf0bf: '↵',
  0xf0c0: 'ℵ',
  0xf0c1: 'ℑ',
  0xf0c2: 'ℜ',
  0xf0c3: '℘',
  0xf0c4: '⊗',
  0xf0c5: '⊕',
  0xf0c6: '∅',
  0xf0c7: '∩',
  0xf0c8: '∪',
  0xf0c9: '⊃',
  0xf0ca: '⊇',
  0xf0cb: '⊄',
  0xf0cc: '⊂',
  0xf0cd: '⊆',
  0xf0ce: '∈',
  0xf0cf: '∉',
  0xf0d0: '∠',
  0xf0d1: '∇',
  0xf0d2: '®',
  0xf0d3: '©',
  0xf0d4: '™',
  0xf0d5: '∏',
  0xf0d6: '√',
  0xf0d7: '⋅',
  0xf0d8: '¬',
  0xf0d9: '∧',
  0xf0da: '∨',
  0xf0db: '⇔',
  0xf0dc: '⇐',
  0xf0dd: '⇑',
  0xf0de: '⇒',
  0xf0df: '⇓',
  0xf0e0: '◊',
  0xf0e1: '⟨',
  0xf0e2: '®',
  0xf0e3: '©',
  0xf0e4: '™',
  0xf0e5: '∑',
  0xf0e6: '(',
  0xf0e7: '(',
  0xf0e8: '(',
  0xf0e9: '⌈',
  0xf0ea: '⌊',
  0xf0eb: '⌊',
  0xf0ec: '{',
  0xf0ed: '{',
  0xf0ee: '{',
  0xf0ef: '|',
  0xf0f1: '⟩',
  0xf0f2: '∫',
  0xf0f3: '∫',
  0xf0f4: '∫',
  0xf0f5: '∫',
  0xf0f6: ')',
  0xf0f7: ')',
  0xf0f8: ')',
  0xf0f9: '⌉',
  0xf0fa: '⌋',
  0xf0fb: '⌋',
  0xf0fc: '}',
  0xf0fd: '}',
  0xf0fe: '}',
};

/**
 * Giải mã thẻ <w:sym w:font="..." w:char="..."/> trong Word XML sang ký tự UTF-8 chuẩn
 */
export function decodeWordSymChar(fontName: string, charHex: string): string {
  const code = parseInt((charHex || '').trim(), 16);
  if (Number.isNaN(code)) return '';
  if (PUA_SYMBOL_TO_UNICODE_MAP[code]) {
    return PUA_SYMBOL_TO_UNICODE_MAP[code];
  }
  const normalizedFont = (fontName || '').toLowerCase();
  if (normalizedFont.includes('mt extra')) {
    if (code === 0xf072 || code === 0x0072) return '\u20D7';
    if (code === 0xf06c || code === 0x006c) return 'ℓ';
    if (code === 0xf068 || code === 0x0068) return 'ℏ';
  }
  if (code >= 0xf020 && code <= 0xf0ff) {
    const lowCode = code - 0xf000;
    const remapped = PUA_SYMBOL_TO_UNICODE_MAP[0xf000 + lowCode];
    if (remapped) return remapped;
    if (lowCode >= 0x20 && lowCode <= 0x7e) {
      return String.fromCharCode(lowCode);
    }
  }
  if (code >= 0x20 && code <= 0xd7ff) {
    return String.fromCharCode(code);
  }
  return '';
}

/**
 * Làm sạch toàn bộ ký tự PUA (U+E000..U+F8FF), variation selectors, ký tự vô hình và thực thể HTML
 * về chuẩn UTF-8 NFC để Word hiển thị đúng với font Cambria Math mà không bao giờ bị ô vuông (□).
 */
export function sanitizeSpecialCharsToUtf8(input: string): string {
  if (!input) return '';
  let out = input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&rarr;/gi, '→')
    .replace(/&larr;/gi, '←')
    .replace(/&harr;/gi, '↔')
    .replace(/&rArr;/gi, '⇒')
    .replace(/&hArr;/gi, '⇔')
    .replace(/&le;/gi, '≤')
    .replace(/&ge;/gi, '≥')
    .replace(/&ne;/gi, '≠')
    .replace(/&plusmn;/gi, '±')
    .replace(/&times;/gi, '×')
    .replace(/&divide;/gi, '÷')
    .replace(/&deg;/gi, '°')
    .replace(/&infin;/gi, '∞')
    .replace(/&radic;/gi, '√')
    .replace(/&sum;/gi, '∑')
    .replace(/&prod;/gi, '∏')
    .replace(/&int;/gi, '∫')
    .replace(/&part;/gi, '∂')
    .replace(/&nabla;/gi, '∇')
    .replace(/&isin;/gi, '∈')
    .replace(/&notin;/gi, '∉')
    .replace(/&sub;/gi, '⊂')
    .replace(/&sube;/gi, '⊆')
    .replace(/&cup;/gi, '∪')
    .replace(/&cap;/gi, '∩')
    .replace(/&empty;/gi, '∅')
    .replace(/&perp;/gi, '⊥')
    .replace(/&ang;/gi, '∠')
    .replace(/&Delta;/g, 'Δ')
    .replace(/&Omega;/g, 'Ω')
    .replace(/&alpha;/g, 'α')
    .replace(/&beta;/g, 'β')
    .replace(/&gamma;/g, 'γ')
    .replace(/&delta;/g, 'δ')
    .replace(/&epsilon;/g, 'ε')
    .replace(/&lambda;/g, 'λ')
    .replace(/&mu;/g, 'μ')
    .replace(/&pi;/g, 'π')
    .replace(/&sigma;/g, 'σ')
    .replace(/&phi;/g, 'φ')
    .replace(/&omega;/g, 'ω');

  // Chuyển đổi từng ký tự nằm trong vùng PUA (U+F000..U+F0FF) hoặc loại bỏ PUA lạ gây ô vuông
  let cleaned = '';
  for (let i = 0; i < out.length; i++) {
    const code = out.charCodeAt(i);
    if (PUA_SYMBOL_TO_UNICODE_MAP[code]) {
      cleaned += PUA_SYMBOL_TO_UNICODE_MAP[code];
    } else if (code >= 0xe000 && code <= 0xf8ff) {
      // Ký tự PUA không xác định -> bỏ qua để tránh hiện ô vuông □ trong Word
      continue;
    } else if (
      (code >= 0xfe00 && code <= 0xfe0f) || // Variation Selectors (gây ô vuông trên Word cũ)
      (code >= 0x2061 && code <= 0x2064) || // Invisible math operators (\u2061 Function Application...)
      (code >= 0x200b && code <= 0x200d) || // Zero-width spaces
      code === 0xfeff ||
      code === 0xfffd ||
      code === 0x25a1 // White square □ lỗi font
    ) {
      continue;
    } else if (code === 0x2212) {
      // Chuẩn hóa dấu trừ toán học
      cleaned += '-';
    } else {
      cleaned += out[i];
    }
  }

  return cleaned.normalize('NFC');
}

/**
 * Bản đồ chuyển đổi ký hiệu LaTeX Toán - Lý - Hóa - Sinh sang ký tự chuẩn Unicode / Toán học
 */
const LATEX_SYMBOL_MAP: Record<string, string> = {
  '\\alpha': 'α',
  '\\beta': 'β',
  '\\gamma': 'γ',
  '\\delta': 'δ',
  '\\epsilon': 'ε',
  '\\varepsilon': 'ε',
  '\\zeta': 'ζ',
  '\\eta': 'η',
  '\\theta': 'θ',
  '\\vartheta': 'ϑ',
  '\\iota': 'ι',
  '\\kappa': 'κ',
  '\\lambda': 'λ',
  '\\mu': 'μ',
  '\\nu': 'ν',
  '\\xi': 'ξ',
  '\\pi': 'π',
  '\\rho': 'ρ',
  '\\sigma': 'σ',
  '\\tau': 'τ',
  '\\upsilon': 'υ',
  '\\phi': 'φ',
  '\\varphi': 'φ',
  '\\chi': 'χ',
  '\\psi': 'ψ',
  '\\omega': 'ω',
  '\\Gamma': 'Γ',
  '\\Delta': 'Δ',
  '\\Theta': 'Θ',
  '\\Lambda': 'Λ',
  '\\Xi': 'Ξ',
  '\\Pi': 'Π',
  '\\Sigma': 'Σ',
  '\\Upsilon': 'Υ',
  '\\Phi': 'Φ',
  '\\Psi': 'Ψ',
  '\\Omega': 'Ω',
  '\\rightarrow': '→',
  '\\to': '→',
  '\\leftarrow': '←',
  '\\leftrightarrow': '↔',
  '\\rightleftharpoons': '⇌',
  '\\leftrightharpoons': '⇌',
  '\\Rightarrow': '⇒',
  '\\Leftarrow': '⇐',
  '\\Leftrightarrow': '⇔',
  '\\iff': '⇔',
  '\\uparrow': '↑',
  '\\downarrow': '↓',
  '\\pm': '±',
  '\\mp': '∓',
  '\\times': '×',
  '\\div': '÷',
  '\\cdot': '·',
  '\\ast': '∗',
  '\\leq': '≤',
  '\\le': '≤',
  '\\geq': '≥',
  '\\ge': '≥',
  '\\neq': '≠',
  '\\ne': '≠',
  '\\approx': '≈',
  '\\equiv': '≡',
  '\\cong': '≅',
  '\\sim': '∼',
  '\\propto': '∝',
  '\\infty': '∞',
  '\\partial': '∂',
  '\\nabla': '∇',
  '\\forall': '∀',
  '\\exists': '∃',
  '\\in': '∈',
  '\\notin': '∉',
  '\\subset': '⊂',
  '\\subseteq': '⊆',
  '\\cup': '∪',
  '\\cap': '∩',
  '\\emptyset': '∅',
  '\\varnothing': '∅',
  '\\angle': '∠',
  '\\measuredangle': '∡',
  '\\sphericalangle': '∢',
  '\\perp': '⊥',
  '\\parallel': '∥',
  '\\triangle': '△',
  '\\square': '□',
  '\\lozenge': '◊',
  '\\odot': '⊙',
  '\\oplus': '⊕',
  '\\otimes': '⊗',
  '\\star': '⋆',
  '\\hbar': 'ℏ',
  '\\ell': 'ℓ',
  '\\supset': '⊃',
  '\\supseteq': '⊇',
  '\\setminus': '∖',
  '\\vee': '∨',
  '\\wedge': '∧',
  '\\neg': '¬',
  '\\implies': '⇒',
  '\\mapsto': '↦',
  '\\updownarrow': '↕',
  '\\nearrow': '↗',
  '\\searrow': '↘',
  '\\prime': '′',
  '\\dots': '…',
  '\\cdots': '⋯',
  '\\ldots': '…',
  '\\male': '♂',
  '\\female': '♀',
  '\\circ': '°',
  '\\degree': '°',
  '\\mathbb{R}': 'ℝ',
  '\\mathbb{N}': 'ℕ',
  '\\mathbb{Z}': 'ℤ',
  '\\mathbb{Q}': 'ℚ',
  '\\mathbb{C}': 'ℂ',
  '\\{': '{',
  '\\}': '}',
};

const UNICODE_SUB_TO_NORMAL: Record<string, string> = {
  '₀': '0',
  '₁': '1',
  '₂': '2',
  '₃': '3',
  '₄': '4',
  '₅': '5',
  '₆': '6',
  '₇': '7',
  '₈': '8',
  '₉': '9',
  '₊': '+',
  '₋': '-',
  '₌': '=',
  '₍': '(',
  '₎': ')',
  'ₐ': 'a',
  'ₑ': 'e',
  'ₒ': 'o',
  'ₓ': 'x',
  'ₕ': 'h',
  'ₖ': 'k',
  'ₗ': 'l',
  'ₘ': 'm',
  'ₙ': 'n',
  'ₚ': 'p',
  'ₛ': 's',
  'ₜ': 't',
};

const UNICODE_SUP_TO_NORMAL: Record<string, string> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '₇': '7',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
  '⁺': '+',
  '⁻': '-',
  '⁼': '=',
  '⁽': '(',
  '⁾': ')',
  'ⁿ': 'n',
  'ⁱ': 'i',
};

function escapeXmlText(str: string): string {
  return sanitizeSpecialCharsToUtf8(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Thay thế các macro ký hiệu LaTeX đơn giản (\alpha, \Omega, \rightarrow, \rightleftharpoons...) sang ký tự Unicode chuẩn
 */
export function replaceLatexSymbolsWithUnicode(input: string): string {
  if (!input) return '';
  let out = sanitizeSpecialCharsToUtf8(input);

  // Chuẩn hóa mũi tên phản ứng hóa học viết tắt
  out = out
    .replace(/<==>|\\rightleftharpoons|\\leftrightharpoons/g, '⇌')
    .replace(/<=>/g, '⇌')
    .replace(/-->/g, '→')
    .replace(/(?<![<=-])->(?![>])/g, '→');

  // Thay thế các lệnh LaTeX dài trước, ngắn sau
  const sortedKeys = Object.keys(LATEX_SYMBOL_MAP).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    const escapedKey = key.replace(/[\\{}]/g, '\\$&');
    const regex = new RegExp(`${escapedKey}(?![a-zA-Z])`, 'g');
    out = out.replace(regex, LATEX_SYMBOL_MAP[key]);
  }

  return out;
}

/**
 * Đọc nhóm ngoặc nhọn { ... } cân bằng trong chuỗi LaTeX bắt đầu từ vị trí idx
 */
function readBalancedBraces(
  str: string,
  startIdx: number,
  openChar = '{',
  closeChar = '}'
): { content: string; nextIdx: number } | null {
  let i = startIdx;
  while (i < str.length && /\s/.test(str[i])) i++;
  if (i >= str.length || str[i] !== openChar) return null;

  let depth = 0;
  const contentStart = i + 1;
  for (; i < str.length; i++) {
    if (str[i] === '\\' && i + 1 < str.length) {
      i++;
      continue;
    }
    if (str[i] === openChar) depth++;
    else if (str[i] === closeChar) {
      depth--;
      if (depth === 0) {
        return {
          content: str.slice(contentStart, i),
          nextIdx: i + 1,
        };
      }
    }
  }
  return {
    content: str.slice(contentStart),
    nextIdx: str.length,
  };
}

export interface WordRunStyleOptions {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  colorHex?: string;
  fontSizeHalfPt?: number;
  vertAlign?: 'subscript' | 'superscript';
  fontFamily?: string;
}

/**
 * Tạo một phần tử <m:r> trong chuẩn Office Math Markup Language (OMML)
 * BẮT BUỘC dùng font Cambria Math để hiển thị toàn bộ ký hiệu toán học, véc-tơ, tích phân, căn thức và ký hiệu đặc biệt mà không bị ô vuông (□).
 */
function buildOmmlRun(
  text: string,
  italic = true,
  style?: WordRunStyleOptions
): string {
  const clean = sanitizeSpecialCharsToUtf8(replaceLatexSymbolsWithUnicode(text));
  if (!clean) return '';
  const sz = style?.fontSizeHalfPt || 24;
  return `<m:r><m:rPr><m:scr m:val="roman"/><m:sty m:val="${
    italic ? 'i' : 'p'
  }"/>${italic ? '' : '<m:nor/>'}</m:rPr><w:rPr><w:rFonts w:ascii="Cambria Math" w:hAnsi="Cambria Math" w:eastAsia="Cambria Math" w:cs="Cambria Math"/>${
    style?.bold ? '<w:b/><w:bCs/>' : ''
  }${
    style?.colorHex ? `<w:color w:val="${style.colorHex}"/>` : ''
  }<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr><m:t xml:space="preserve">${escapeXmlText(
    clean
  )}</m:t></m:r>`;
}

/**
 * Chuẩn hóa chuỗi LaTeX trước khi đưa vào KaTeX để sinh MathML chuẩn W3C
 */
function preprocessLatexForMathMl(latexRaw: string): string {
  let s = sanitizeSpecialCharsToUtf8(latexRaw || '')
    .trim()
    .replace(/^\$\$|\$\$$/g, '')
    .replace(/^\$|\$$/g, '')
    .replace(/^\\\(|\\\)$/g, '')
    .replace(/^\\\[|\\\]$/g, '')
    .trim();

  // Hỗ trợ các macro đặc thù Toán - Lý - Hóa - Sinh Việt Nam mà KaTeX mặc định không có sẵn
  s = s
    .replace(/\\male\b/g, '♂')
    .replace(/\\female\b/g, '♀')
    .replace(/\\degree\b/g, '^\\circ')
    .replace(/\\xrightleftharpoons\s*(\[[^\]]*\])?\s*\{([^{}]*)\}/g, (_, sub, sup) => {
      if (sub) {
        return `\\stackrel{${sup}}{\\underset{${sub.slice(1, -1)}}{\\rightleftharpoons}}`;
      }
      return `\\overset{${sup}}{\\rightleftharpoons}`;
    })
    .replace(/\\xrightarrow\s*(\[[^\]]*\])?\s*\{([^{}]*)\}/g, (_, sub, sup) => {
      if (sub) {
        return `\\stackrel{${sup}}{\\underset{${sub.slice(1, -1)}}{\\longrightarrow}}`;
      }
      return `\\overset{${sup}}{\\longrightarrow}`;
    })
    .replace(/\\xleftarrow\s*(\[[^\]]*\])?\s*\{([^{}]*)\}/g, (_, sub, sup) => {
      if (sub) {
        return `\\stackrel{${sup}}{\\underset{${sub.slice(1, -1)}}{\\longleftarrow}}`;
      }
      return `\\overset{${sup}}{\\longleftarrow}`;
    });

  return s;
}

/**
 * BƯỚC 1: Chuyển đổi mỗi đoạn công thức LaTeX sang chuẩn MathML (sử dụng KaTeX có sẵn trên trang hoặc MathJax fallback)
 */
export function convertLatexToMathMl(latexRaw: string): string {
  const prepared = preprocessLatexForMathMl(latexRaw);
  if (!prepared) return '';

  try {
    const mathmlHtml = katex.renderToString(prepared, {
      output: 'mathml',
      throwOnError: false,
      strict: false,
      trust: true,
    });
    const mathMatch = mathmlHtml.match(/<math[\s\S]*<\/math>/i);
    if (mathMatch) {
      return mathMatch[0];
    }
  } catch {
    // Fallback sang MathJax nếu có trên window
  }

  try {
    const win = typeof window !== 'undefined' ? (window as unknown as Record<string, any>) : null;
    if (win && win.MathJax && typeof win.MathJax.tex2mml === 'function') {
      const mml = win.MathJax.tex2mml(prepared);
      if (typeof mml === 'string' && mml.includes('<math')) {
        return mml;
      }
    }
  } catch {
    // Bỏ qua lỗi MathJax
  }

  return '';
}

const NARY_OPERATORS_SET = new Set(['∫', '∬', '∭', '∮', '∑', '∏', '⋃', '⋂']);

function normalizeAccentCharForOmml(rawAccent: string): {
  type: 'acc' | 'bar';
  chr: string;
  pos?: 'top' | 'bot';
} {
  const t = (rawAccent || '').trim();
  if (
    t === '¯' ||
    t === '‾' ||
    t === '\u00AF' ||
    t === '\u0304' ||
    t === '\u0305' ||
    t === '⎯' ||
    t === '_'
  ) {
    return { type: 'bar', chr: '¯', pos: t === '_' ? 'bot' : 'top' };
  }
  if (
    t === '→' ||
    t === '⟶' ||
    t === '\u2192' ||
    t === '\u27F6' ||
    t === '\u20D7' ||
    t === '⇀' ||
    t === '\u20D1'
  ) {
    // Chuẩn Microsoft Word OMML: dấu véc-tơ trên đỉnh phải là U+20D7 (Combining Right Arrow Above)
    return { type: 'acc', chr: '\u20D7' };
  }
  if (t === 'ˆ' || t === '^' || t === '\u0302' || t === '\u02C6') {
    return { type: 'acc', chr: '\u0302' };
  }
  if (t === '~' || t === '˜' || t === '\u0303' || t === '\u02DC') {
    return { type: 'acc', chr: '\u0303' };
  }
  if (t === '˙' || t === '\u0307') {
    return { type: 'acc', chr: '\u0307' };
  }
  if (t === '¨' || t === '\u0308') {
    return { type: 'acc', chr: '\u0308' };
  }
  if (t === '˘' || t === '\u0306' || t === '⌢' || t === '⌒') {
    return { type: 'acc', chr: '\u0306' };
  }
  return { type: 'acc', chr: t || '\u20D7' };
}

/**
 * BƯỚC 2: Bộ chuyển đổi MathML sang XML OMML chuẩn của Microsoft Word (theo quy tắc mml2omml)
 * Hỗ trợ đầy đủ: <math>, <semantics>, <mrow>, <mi>, <mn>, <mo>, <mtext>, <mfrac>, <msqrt>, <mroot>,
 * <msub>, <msup>, <msubsup>, <mover>, <munder>, <munderover>, <mtable>, <mtr>, <mtd>, <mfenced>, <menclose>.
 */
export function convertMathMlToOmmlInnerXml(
  mathmlString: string,
  style?: WordRunStyleOptions
): string {
  if (!mathmlString || typeof DOMParser === 'undefined') return '';

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(mathmlString, 'text/html');
    const mathEl = doc.querySelector('math');
    if (!mathEl) return '';

    const convertChildrenList = (elements: Element[]): string => {
      const results: string[] = [];
      let idx = 0;

      while (idx < elements.length) {
        const el = elements[idx];
        const tag = el.tagName.toLowerCase();

        // Nhận diện cặp ngoặc co giãn (\left ... \right hoặc hệ phương trình \begin{cases}...\end{cases})
        if (tag === 'mo') {
          const opText = sanitizeSpecialCharsToUtf8(el.textContent || '').trim();
          const isFence =
            el.getAttribute('fence') === 'true' ||
            el.getAttribute('stretchy') === 'true';

          // Trường hợp hệ phương trình: <mo>{</mo> đi kèm <mtable> ngay phía sau
          if (opText === '{' && idx + 1 < elements.length) {
            const nextEl = elements[idx + 1];
            const nextTag = nextEl.tagName.toLowerCase();
            if (nextTag === 'mtable') {
              const nextCloseEl = idx + 2 < elements.length ? elements[idx + 2] : null;
              const nextCloseText = nextCloseEl
                ? sanitizeSpecialCharsToUtf8(nextCloseEl.textContent || '').trim()
                : '';
              const trs = Array.from(nextEl.children).filter(
                (c) => c.tagName.toLowerCase() === 'mtr'
              );
              const eqArrRows = trs
                .map((tr) => {
                  const tds = Array.from(tr.children).filter(
                    (c) => c.tagName.toLowerCase() === 'mtd'
                  );
                  const rowInner = tds
                    .map((td) => convertNode(td))
                    .filter(Boolean)
                    .join(buildOmmlRun('   ', false, style));
                  return `<m:e>${rowInner || buildOmmlRun(' ', false, style)}</m:e>`;
                })
                .join('');

              results.push(
                `<m:d><m:dPr><m:begChr m:val="{"/><m:endChr m:val="${
                  nextCloseText === '}' ? '}' : ''
                }"/></m:dPr><m:e><m:eqArr>${eqArrRows}</m:eqArr></m:e></m:d>`
              );
              idx += nextCloseEl && nextCloseText === '' ? 3 : 2;
              continue;
            }
          }

          // Trường hợp tích phân / tổng / tích (<mo>∫</mo> hoặc <msub>/<msubsup> chứa toán tử n-ary)
          if (NARY_OPERATORS_SET.has(opText) && idx + 1 < elements.length) {
            const bodyXml = convertNode(elements[idx + 1]);
            results.push(
              `<m:nary><m:naryPr><m:chr m:val="${escapeXmlText(
                opText
              )}"/><m:subHide m:val="1"/><m:supHide m:val="1"/></m:naryPr><m:sub/><m:sup/><m:e>${
                bodyXml || buildOmmlRun(' ', false, style)
              }</m:e></m:nary>`
            );
            idx += 2;
            continue;
          }

          void isFence;
        }

        // Trường hợp <msub>, <msup>, <msubsup>, <munder>, <mover>, <munderover> có cơ số là toán tử N-ary (∫, ∑, ∏, ∮)
        if (
          tag === 'msub' ||
          tag === 'msup' ||
          tag === 'msubsup' ||
          tag === 'munder' ||
          tag === 'mover' ||
          tag === 'munderover'
        ) {
          const ch = Array.from(el.children);
          const baseEl = ch[0];
          const baseText = baseEl
            ? sanitizeSpecialCharsToUtf8(baseEl.textContent || '').trim()
            : '';
          if (baseEl && NARY_OPERATORS_SET.has(baseText)) {
            let subXml = '';
            let supXml = '';
            if (tag === 'msub' || tag === 'munder') {
              subXml = ch[1] ? convertNode(ch[1]) : '';
            } else if (tag === 'msup' || tag === 'mover') {
              supXml = ch[1] ? convertNode(ch[1]) : '';
            } else {
              subXml = ch[1] ? convertNode(ch[1]) : '';
              supXml = ch[2] ? convertNode(ch[2]) : '';
            }
            const bodyNode = idx + 1 < elements.length ? elements[idx + 1] : null;
            const bodyXml = bodyNode ? convertNode(bodyNode) : '';
            results.push(
              `<m:nary><m:naryPr><m:chr m:val="${escapeXmlText(
                baseText
              )}"/><m:subHide m:val="${subXml ? '0' : '1'}"/><m:supHide m:val="${
                supXml ? '0' : '1'
              }"/></m:naryPr><m:sub>${subXml}</m:sub><m:sup>${supXml}</m:sup><m:e>${
                bodyXml || buildOmmlRun(' ', false, style)
              }</m:e></m:nary>`
            );
            idx += bodyNode ? 2 : 1;
            continue;
          }
        }

        results.push(convertNode(el));
        idx++;
      }

      return results.join('');
    };

    const convertNode = (node: Element): string => {
      const tag = node.tagName.toLowerCase();
      const children = Array.from(node.children);

      switch (tag) {
        case 'math':
        case 'mrow':
        case 'mstyle':
        case 'mpadded': {
          return convertChildrenList(children);
        }

        case 'semantics': {
          // Chỉ lấy phần tử trình bày đầu tiên (bỏ qua <annotation encoding="application/x-tex">)
          const presentationChildren = children.filter(
            (c) =>
              c.tagName.toLowerCase() !== 'annotation' &&
              c.tagName.toLowerCase() !== 'annotation-xml'
          );
          return convertChildrenList(presentationChildren);
        }

        case 'annotation':
        case 'annotation-xml':
        case 'mphantom':
          return '';

        case 'mi': {
          const text = sanitizeSpecialCharsToUtf8(node.textContent || '');
          if (!text) return '';
          const variant = (node.getAttribute('mathvariant') || '').toLowerCase();
          const isNormal =
            variant === 'normal' ||
            variant === 'bold' ||
            text.length > 1 ||
            /^[\u0391-\u03A9]$/.test(text); // Chữ Hy Lạp hoa (Δ, Ω, Σ...) để đứng thẳng chuẩn SGK Việt Nam
          return buildOmmlRun(text, !isNormal, {
            ...style,
            bold: style?.bold || variant.includes('bold'),
          });
        }

        case 'mn': {
          const text = sanitizeSpecialCharsToUtf8(node.textContent || '');
          return buildOmmlRun(text, false, style);
        }

        case 'mo': {
          const text = sanitizeSpecialCharsToUtf8(node.textContent || '');
          if (!text) return '';
          return buildOmmlRun(text, false, style);
        }

        case 'mtext': {
          const text = sanitizeSpecialCharsToUtf8(node.textContent || '');
          if (!text) return '';
          return buildOmmlRun(text, false, style);
        }

        case 'mspace': {
          return buildOmmlRun(' ', false, style);
        }

        case 'mfrac': {
          const numXml = children[0] ? convertNode(children[0]) : '';
          const denXml = children[1] ? convertNode(children[1]) : '';
          const lineThickness = node.getAttribute('linethickness');
          const noBar = lineThickness === '0' || lineThickness === '0pt' || lineThickness === '0px';
          return `<m:f><m:fPr>${
            noBar ? '<m:type m:val="noBar"/>' : '<m:type m:val="bar"/>'
          }</m:fPr><m:num>${numXml || buildOmmlRun(' ', false, style)}</m:num><m:den>${
            denXml || buildOmmlRun(' ', false, style)
          }</m:den></m:f>`;
        }

        case 'msqrt': {
          const innerXml = convertChildrenList(children);
          return `<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e>${
            innerXml || buildOmmlRun(' ', false, style)
          }</m:e></m:rad>`;
        }

        case 'mroot': {
          const baseXml = children[0] ? convertNode(children[0]) : '';
          const degXml = children[1] ? convertNode(children[1]) : '';
          return `<m:rad><m:radPr><m:degHide m:val="${
            degXml ? '0' : '1'
          }"/></m:radPr><m:deg>${degXml}</m:deg><m:e>${
            baseXml || buildOmmlRun(' ', false, style)
          }</m:e></m:rad>`;
        }

        case 'msub': {
          const baseXml = children[0] ? convertNode(children[0]) : '';
          const subXml = children[1] ? convertNode(children[1]) : '';
          return `<m:sSub><m:e>${baseXml || buildOmmlRun(' ', false, style)}</m:e><m:sub>${
            subXml || buildOmmlRun(' ', false, style)
          }</m:sub></m:sSub>`;
        }

        case 'msup': {
          const baseXml = children[0] ? convertNode(children[0]) : '';
          const supXml = children[1] ? convertNode(children[1]) : '';
          return `<m:sSup><m:e>${baseXml || buildOmmlRun(' ', false, style)}</m:e><m:sup>${
            supXml || buildOmmlRun(' ', false, style)
          }</m:sup></m:sSup>`;
        }

        case 'msubsup': {
          const baseXml = children[0] ? convertNode(children[0]) : '';
          const subXml = children[1] ? convertNode(children[1]) : '';
          const supXml = children[2] ? convertNode(children[2]) : '';
          return `<m:sSubSup><m:e>${baseXml || buildOmmlRun(' ', false, style)}</m:e><m:sub>${
            subXml || buildOmmlRun(' ', false, style)
          }</m:sub><m:sup>${supXml || buildOmmlRun(' ', false, style)}</m:sup></m:sSubSup>`;
        }

        case 'mover': {
          const baseEl = children[0];
          const overEl = children[1];
          const baseXml = baseEl ? convertNode(baseEl) : '';
          const overText = overEl
            ? sanitizeSpecialCharsToUtf8(overEl.textContent || '').trim()
            : '';
          const isAccentAttr =
            node.getAttribute('accent') === 'true' ||
            (overEl && overEl.tagName.toLowerCase() === 'mo' && overText.length <= 2);

          if (
            isAccentAttr &&
            /^[→⟶\u20D7⇀¯‾\u00AF\u0304\u0305⎯ˆ^\u0302\u02C6~˜\u0303˙\u0307¨\u0308˘\u0306⌢⌒]$/.test(
              overText
            )
          ) {
            const accInfo = normalizeAccentCharForOmml(overText);
            if (accInfo.type === 'bar') {
              return `<m:bar><m:barPr><m:pos m:val="top"/></m:barPr><m:e>${baseXml}</m:e></m:bar>`;
            }
            return `<m:acc><m:accPr><m:chr m:val="${escapeXmlText(
              accInfo.chr
            )}"/></m:accPr><m:e>${baseXml}</m:e></m:acc>`;
          }

          const overXml = overEl ? convertNode(overEl) : '';
          return `<m:limUpp><m:e>${baseXml || buildOmmlRun(' ', false, style)}</m:e><m:lim>${
            overXml || buildOmmlRun(' ', false, style)
          }</m:lim></m:limUpp>`;
        }

        case 'munder': {
          const baseEl = children[0];
          const underEl = children[1];
          const baseXml = baseEl ? convertNode(baseEl) : '';
          const underText = underEl
            ? sanitizeSpecialCharsToUtf8(underEl.textContent || '').trim()
            : '';
          if (underText === '_' || underText === '‾' || underText === '¯') {
            return `<m:bar><m:barPr><m:pos m:val="bot"/></m:barPr><m:e>${baseXml}</m:e></m:bar>`;
          }
          const underXml = underEl ? convertNode(underEl) : '';
          return `<m:limLow><m:e>${baseXml || buildOmmlRun(' ', false, style)}</m:e><m:lim>${
            underXml || buildOmmlRun(' ', false, style)
          }</m:lim></m:limLow>`;
        }

        case 'munderover': {
          const baseEl = children[0];
          const underEl = children[1];
          const overEl = children[2];
          const baseText = baseEl
            ? sanitizeSpecialCharsToUtf8(baseEl.textContent || '').trim()
            : '';
          const subXml = underEl ? convertNode(underEl) : '';
          const supXml = overEl ? convertNode(overEl) : '';

          if (NARY_OPERATORS_SET.has(baseText)) {
            return `<m:nary><m:naryPr><m:chr m:val="${escapeXmlText(
              baseText
            )}"/><m:subHide m:val="${subXml ? '0' : '1'}"/><m:supHide m:val="${
              supXml ? '0' : '1'
            }"/></m:naryPr><m:sub>${subXml}</m:sub><m:sup>${supXml}</m:sup><m:e>${buildOmmlRun(
              ' ',
              false,
              style
            )}</m:e></m:nary>`;
          }

          const baseXml = baseEl ? convertNode(baseEl) : '';
          const limUpp = `<m:limUpp><m:e>${
            baseXml || buildOmmlRun(' ', false, style)
          }</m:e><m:lim>${supXml}</m:lim></m:limUpp>`;
          return `<m:limLow><m:e>${limUpp}</m:e><m:lim>${subXml}</m:lim></m:limLow>`;
        }

        case 'mfenced': {
          const openChr = node.getAttribute('open') ?? '(';
          const closeChr = node.getAttribute('close') ?? ')';
          const sepChr = node.getAttribute('separators') ?? ',';
          const innerParts = children.map((c) => convertNode(c)).filter(Boolean);
          const joined = innerParts.join(
            sepChr ? buildOmmlRun(sepChr, false, style) : ''
          );
          return `<m:d><m:dPr><m:begChr m:val="${escapeXmlText(
            openChr
          )}"/><m:endChr m:val="${escapeXmlText(closeChr)}"/></m:dPr><m:e>${
            joined || buildOmmlRun(' ', false, style)
          }</m:e></m:d>`;
        }

        case 'mtable': {
          const trs = children.filter((c) => c.tagName.toLowerCase() === 'mtr');
          const matrixRows = trs
            .map((tr) => {
              const tds = Array.from(tr.children).filter(
                (c) => c.tagName.toLowerCase() === 'mtd'
              );
              return `<m:mr>${tds
                .map(
                  (td) =>
                    `<m:e>${convertNode(td) || buildOmmlRun(' ', false, style)}</m:e>`
                )
                .join('')}</m:mr>`;
            })
            .join('');
          return `<m:m>${matrixRows}</m:m>`;
        }

        case 'mtr':
        case 'mtd': {
          return convertChildrenList(children);
        }

        case 'menclose': {
          const notation = (node.getAttribute('notation') || '').toLowerCase();
          const innerXml = convertChildrenList(children);
          if (notation.includes('top')) {
            return `<m:bar><m:barPr><m:pos m:val="top"/></m:barPr><m:e>${innerXml}</m:e></m:bar>`;
          }
          if (notation.includes('bottom')) {
            return `<m:bar><m:barPr><m:pos m:val="bot"/></m:barPr><m:e>${innerXml}</m:e></m:bar>`;
          }
          return `<m:borderBox><m:e>${innerXml}</m:e></m:borderBox>`;
        }

        default: {
          if (children.length > 0) {
            return convertChildrenList(children);
          }
          const raw = sanitizeSpecialCharsToUtf8(node.textContent || '');
          return raw ? buildOmmlRun(raw, false, style) : '';
        }
      }
    };

    return convertNode(mathEl);
  } catch {
    return '';
  }
}

/**
 * Bộ chuyển đổi trực tiếp LaTeX -> OMML dự phòng (sử dụng khi môi trường không có DOMParser hoặc biểu thức tùy chỉnh)
 * Đảm bảo 100% dùng font Cambria Math và mã dấu chuẩn Unicode (U+20D7 cho véc-tơ, <m:bar> cho gạch ngang trên đầu).
 */
export function convertLatexExpressionToOmmlInnerXml(
  latexRaw: string,
  style?: WordRunStyleOptions
): string {
  const expr = sanitizeSpecialCharsToUtf8(latexRaw || '')
    .trim()
    .replace(/^\$+|\$+$/g, '')
    .trim();
  if (!expr) return '';

  let i = 0;
  const nodes: string[] = [];

  const parseAtomAt = (pos: number): { omml: string; nextPos: number } => {
    let p = pos;
    while (p < expr.length && /\s/.test(expr[p])) p++;
    if (p >= expr.length) return { omml: '', nextPos: p };

    if (expr[p] === '{') {
      const grp = readBalancedBraces(expr, p, '{', '}');
      if (grp) {
        return {
          omml: convertLatexExpressionToOmmlInnerXml(grp.content, style),
          nextPos: grp.nextIdx,
        };
      }
    }

    if (expr[p] === '\\') {
      const cmdMatch = expr.slice(p).match(/^\\([a-zA-Z]+)/);
      if (cmdMatch) {
        const fullCmd = cmdMatch[0];
        const mapped = LATEX_SYMBOL_MAP[fullCmd];
        if (mapped) {
          return {
            omml: buildOmmlRun(mapped, false, style),
            nextPos: p + fullCmd.length,
          };
        }
      }
    }

    return {
      omml: buildOmmlRun(expr[p], /[a-zA-Z]/.test(expr[p]), style),
      nextPos: p + 1,
    };
  };

  while (i < expr.length) {
    if (/\s/.test(expr[i])) {
      i++;
      continue;
    }

    // 1. Môi trường hệ phương trình \begin{cases} ... \end{cases} hoặc ma trận \begin{pmatrix/bmatrix/matrix}
    const envMatch = expr
      .slice(i)
      .match(/^\\begin\{(cases|matrix|pmatrix|bmatrix|vmatrix)\}([\s\S]*?)\\end\{\1\}/);
    if (envMatch) {
      const envType = envMatch[1];
      const body = envMatch[2].trim();
      const rows = body
        .split(/\\\\/)
        .map((r) => r.trim())
        .filter(Boolean);

      if (envType === 'cases') {
        const eqRowsXml = rows
          .map(
            (r) =>
              `<m:e>${convertLatexExpressionToOmmlInnerXml(
                r.replace(/&/g, '  '),
                style
              )}</m:e>`
          )
          .join('');
        nodes.push(
          `<m:d><m:dPr><m:begChr m:val="{"/><m:endChr m:val=""/></m:dPr><m:e><m:eqArr>${eqRowsXml}</m:eqArr></m:e></m:d>`
        );
      } else {
        const begChr =
          envType === 'pmatrix'
            ? '('
            : envType === 'bmatrix'
            ? '['
            : envType === 'vmatrix'
            ? '|'
            : '';
        const endChr =
          envType === 'pmatrix'
            ? ')'
            : envType === 'bmatrix'
            ? ']'
            : envType === 'vmatrix'
            ? '|'
            : '';
        const matrixRowsXml = rows
          .map((r) => {
            const cells = r.split('&').map((c) => c.trim());
            return `<m:mr>${cells
              .map((c) => `<m:e>${convertLatexExpressionToOmmlInnerXml(c, style)}</m:e>`)
              .join('')}</m:mr>`;
          })
          .join('');
        const matrixXml = `<m:m>${matrixRowsXml}</m:m>`;
        nodes.push(
          begChr
            ? `<m:d><m:dPr><m:begChr m:val="${begChr}"/><m:endChr m:val="${endChr}"/></m:dPr><m:e>${matrixXml}</m:e></m:d>`
            : matrixXml
        );
      }
      i += envMatch[0].length;
      continue;
    }

    // 2. Phân số \frac{tử}{mẫu} hoặc \dfrac{tử}{mẫu}
    const fracMatch = expr.slice(i).match(/^\\(?:d|t)?frac\b/);
    if (fracMatch) {
      const afterCmd = i + fracMatch[0].length;
      const numGrp = readBalancedBraces(expr, afterCmd, '{', '}');
      if (numGrp) {
        const denGrp = readBalancedBraces(expr, numGrp.nextIdx, '{', '}');
        if (denGrp) {
          nodes.push(
            `<m:f><m:fPr><m:type m:val="bar"/></m:fPr><m:num>${convertLatexExpressionToOmmlInnerXml(
              numGrp.content,
              style
            )}</m:num><m:den>${convertLatexExpressionToOmmlInnerXml(
              denGrp.content,
              style
            )}</m:den></m:f>`
          );
          i = denGrp.nextIdx;
          continue;
        }
      }
    }

    // 3. Căn thức \sqrt[n]{x} hoặc \sqrt{x}
    const sqrtMatch = expr.slice(i).match(/^\\sqrt\b/);
    if (sqrtMatch) {
      let cursor = i + sqrtMatch[0].length;
      const degGrp = readBalancedBraces(expr, cursor, '[', ']');
      if (degGrp) {
        cursor = degGrp.nextIdx;
      }
      const radGrp = readBalancedBraces(expr, cursor, '{', '}');
      if (radGrp) {
        if (degGrp && degGrp.content.trim()) {
          nodes.push(
            `<m:rad><m:radPr><m:degHide m:val="0"/></m:radPr><m:deg>${convertLatexExpressionToOmmlInnerXml(
              degGrp.content,
              style
            )}</m:deg><m:e>${convertLatexExpressionToOmmlInnerXml(
              radGrp.content,
              style
            )}</m:e></m:rad>`
          );
        } else {
          nodes.push(
            `<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e>${convertLatexExpressionToOmmlInnerXml(
              radGrp.content,
              style
            )}</m:e></m:rad>`
          );
        }
        i = radGrp.nextIdx;
        continue;
      }
    }

    // 4. Véc-tơ \vec{E}, \overrightarrow{AB}, \overline{X}, \hat{A}
    const accMatch = expr
      .slice(i)
      .match(/^\\(vec|overrightarrow|overline|bar|hat|widehat)\b/);
    if (accMatch) {
      const kind = accMatch[1];
      const cursor = i + accMatch[0].length;
      const grp = readBalancedBraces(expr, cursor, '{', '}');
      if (grp) {
        const innerXml = convertLatexExpressionToOmmlInnerXml(grp.content, style);
        if (kind === 'overline' || kind === 'bar') {
          nodes.push(
            `<m:bar><m:barPr><m:pos m:val="top"/></m:barPr><m:e>${innerXml}</m:e></m:bar>`
          );
        } else {
          const chr = kind === 'hat' || kind === 'widehat' ? '\u0302' : '\u20D7';
          nodes.push(
            `<m:acc><m:accPr><m:chr m:val="${chr}"/></m:accPr><m:e>${innerXml}</m:e></m:acc>`
          );
        }
        i = grp.nextIdx;
        continue;
      }
    }

    // 5. Mũi tên phản ứng hóa học kèm điều kiện trên/dưới: \xrightarrow[dưới]{trên} hoặc \xrightleftharpoons{trên}
    const xArrowMatch = expr
      .slice(i)
      .match(/^\\(xrightarrow|xrightleftharpoons|xleftarrow)\b/);
    if (xArrowMatch) {
      const arrowType = xArrowMatch[1];
      const arrowChar =
        arrowType === 'xrightleftharpoons'
          ? '⇌'
          : arrowType === 'xleftarrow'
          ? '←'
          : '→';
      let cursor = i + xArrowMatch[0].length;
      const belowGrp = readBalancedBraces(expr, cursor, '[', ']');
      if (belowGrp) cursor = belowGrp.nextIdx;
      const aboveGrp = readBalancedBraces(expr, cursor, '{', '}');
      if (aboveGrp) {
        cursor = aboveGrp.nextIdx;
        let arrowOmml = `<m:limUpp><m:e>${buildOmmlRun(
          ` ${arrowChar} `,
          false,
          style
        )}</m:e><m:lim>${convertLatexExpressionToOmmlInnerXml(
          aboveGrp.content,
          style
        )}</m:lim></m:limUpp>`;
        if (belowGrp && belowGrp.content.trim()) {
          arrowOmml = `<m:limLow><m:e>${arrowOmml}</m:e><m:lim>${convertLatexExpressionToOmmlInnerXml(
            belowGrp.content,
            style
          )}</m:lim></m:limLow>`;
        }
        nodes.push(arrowOmml);
        i = cursor;
        continue;
      }
    }

    // 6. Tích phân \int, Tổng \sum, Tích \prod kèm cận dưới _ và cận trên ^
    const naryMatch = expr.slice(i).match(/^\\(int|oint|sum|prod)\b/);
    if (naryMatch) {
      const kind = naryMatch[1];
      const chr =
        kind === 'sum' ? '∑' : kind === 'prod' ? '∏' : kind === 'oint' ? '∮' : '∫';
      let cursor = i + naryMatch[0].length;
      let subOmml = '';
      let supOmml = '';

      for (let pass = 0; pass < 2; pass++) {
        while (cursor < expr.length && /\s/.test(expr[cursor])) cursor++;
        if (expr[cursor] === '_') {
          const parsedSub = parseAtomAt(cursor + 1);
          subOmml = parsedSub.omml;
          cursor = parsedSub.nextPos;
        } else if (expr[cursor] === '^') {
          const parsedSup = parseAtomAt(cursor + 1);
          supOmml = parsedSup.omml;
          cursor = parsedSup.nextPos;
        }
      }

      const bodyAtom = parseAtomAt(cursor);
      nodes.push(
        `<m:nary><m:naryPr><m:chr m:val="${chr}"/><m:subHide m:val="${
          subOmml ? '0' : '1'
        }"/><m:supHide m:val="${
          supOmml ? '0' : '1'
        }"/></m:naryPr><m:sub>${subOmml}</m:sub><m:sup>${supOmml}</m:sup><m:e>${
          bodyAtom.omml || buildOmmlRun(' ', false, style)
        }</m:e></m:nary>`
      );
      i = bodyAtom.nextPos;
      continue;
    }

    // 7. Giới hạn \lim_{x \to x_0}
    const limMatch = expr.slice(i).match(/^\\lim\b/);
    if (limMatch) {
      let cursor = i + limMatch[0].length;
      while (cursor < expr.length && /\s/.test(expr[cursor])) cursor++;
      if (expr[cursor] === '_') {
        const subAtom = parseAtomAt(cursor + 1);
        nodes.push(
          `<m:limLow><m:e>${buildOmmlRun('lim', false, style)}</m:e><m:lim>${
            subAtom.omml
          }</m:lim></m:limLow>`
        );
        i = subAtom.nextPos;
        continue;
      }
      nodes.push(buildOmmlRun('lim', false, style));
      i = cursor;
      continue;
    }

    // 8. Nhóm ngoặc nhọn { ... } độc lập
    if (expr[i] === '{') {
      const grp = readBalancedBraces(expr, i, '{', '}');
      if (grp) {
        nodes.push(convertLatexExpressionToOmmlInnerXml(grp.content, style));
        i = grp.nextIdx;
        continue;
      }
    }

    // 9. Lệnh \text{...} hoặc \mathrm{...}
    const textCmdMatch = expr.slice(i).match(/^\\(?:text|mathrm|mathbf)\b/);
    if (textCmdMatch) {
      const grp = readBalancedBraces(expr, i + textCmdMatch[0].length, '{', '}');
      if (grp) {
        nodes.push(buildOmmlRun(grp.content, false, style));
        i = grp.nextIdx;
        continue;
      }
    }

    // 10. Lệnh ký hiệu LaTeX (\alpha, \Omega, \rightarrow...) hoặc hàm toán học (\sin, \cos, \tan, \ln, \log)
    if (expr[i] === '\\') {
      const fnMatch = expr
        .slice(i)
        .match(/^\\(sin|cos|tan|cot|arcsin|arccos|arctan|ln|log|exp|max|min|det)\b/);
      if (fnMatch) {
        nodes.push(buildOmmlRun(fnMatch[1], false, style));
        i += fnMatch[0].length;
        continue;
      }
      const bbMatch = expr.slice(i).match(/^\\mathbb\{([A-Z])\}/);
      if (bbMatch) {
        const sym = LATEX_SYMBOL_MAP[bbMatch[0]] || bbMatch[1];
        nodes.push(buildOmmlRun(sym, false, style));
        i += bbMatch[0].length;
        continue;
      }
      const leftRightMatch = expr.slice(i).match(/^\\(left|right)\s*([()[\]|.]|\\\{|\\\}|\\\||\\langle|\\rangle)/);
      if (leftRightMatch) {
        const rawDelim = leftRightMatch[2];
        const delim =
          rawDelim === '.'
            ? ''
            : rawDelim === '\\{'
            ? '{'
            : rawDelim === '\\}'
            ? '}'
            : rawDelim === '\\|'
            ? '‖'
            : rawDelim === '\\langle'
            ? '⟨'
            : rawDelim === '\\rangle'
            ? '⟩'
            : rawDelim;
        if (delim) {
          nodes.push(buildOmmlRun(delim, false, style));
        }
        i += leftRightMatch[0].length;
        continue;
      }
      const symMatch = expr.slice(i).match(/^\\[a-zA-Z]+/);
      if (symMatch) {
        const sym = LATEX_SYMBOL_MAP[symMatch[0]];
        if (sym) {
          nodes.push(buildOmmlRun(sym, false, style));
        } else {
          nodes.push(buildOmmlRun(symMatch[0].slice(1), true, style));
        }
        i += symMatch[0].length;
        continue;
      }
      if (i + 1 < expr.length) {
        nodes.push(buildOmmlRun(expr[i + 1], false, style));
        i += 2;
        continue;
      }
    }

    // 11. Xử lý chỉ số dưới (_) và chỉ số trên (^) gắn vào phần tử đứng ngay trước
    if ((expr[i] === '_' || expr[i] === '^') && nodes.length > 0) {
      const baseOmml = nodes.pop()!;
      let subOmml = '';
      let supOmml = '';
      let cursor = i;

      for (let pass = 0; pass < 2; pass++) {
        if (cursor < expr.length && expr[cursor] === '_') {
          const parsedSub = parseAtomAt(cursor + 1);
          subOmml = parsedSub.omml;
          cursor = parsedSub.nextPos;
        } else if (cursor < expr.length && expr[cursor] === '^') {
          const parsedSup = parseAtomAt(cursor + 1);
          supOmml = parsedSup.omml;
          cursor = parsedSup.nextPos;
        }
      }

      if (subOmml && supOmml) {
        nodes.push(
          `<m:sSubSup><m:e>${baseOmml}</m:e><m:sub>${subOmml}</m:sub><m:sup>${supOmml}</m:sup></m:sSubSup>`
        );
      } else if (subOmml) {
        nodes.push(`<m:sSub><m:e>${baseOmml}</m:e><m:sub>${subOmml}</m:sub></m:sSub>`);
      } else if (supOmml) {
        nodes.push(`<m:sSup><m:e>${baseOmml}</m:e><m:sup>${supOmml}</m:sup></m:sSup>`);
      } else {
        nodes.push(baseOmml);
      }
      i = cursor;
      continue;
    }

    // 12. Chuỗi ký tự thường hoặc con số liên tiếp
    let token = '';
    while (i < expr.length && !/[\s\\{}^_]/.test(expr[i])) {
      if (
        token.length > 0 &&
        i + 1 < expr.length &&
        (expr[i + 1] === '_' || expr[i + 1] === '^')
      ) {
        break;
      }
      token += expr[i];
      i++;
      if (i < expr.length && (expr[i] === '_' || expr[i] === '^')) {
        break;
      }
    }

    if (token) {
      const isPureNumberOrOp = /^[0-9.,+\-=*/()[\]<>→⇌±×÷°'":;|♂♀]+$/.test(token);
      nodes.push(buildOmmlRun(token, !isPureNumberOrOp, style));
    } else {
      i++;
    }
  }

  return nodes.join('');
}

/**
 * BƯỚC 3: Đóng gói biểu thức LaTeX thành thẻ <m:oMath>...</m:oMath> chuẩn Microsoft Office
 * Quy trình chuẩn:
 *   LaTeX -> MathML (KaTeX) -> XML OMML (mml2omml) -> <m:oMath>...</m:oMath>
 * Nếu có cấu trúc đặc thù như \xrightarrow[dưới]{trên} hoặc khi cần fallback, kết hợp bộ chuyển đổi OMML trực tiếp.
 */
export function buildOmmlElementFromLatex(
  latexRaw: string,
  style?: WordRunStyleOptions
): string {
  const cleanedLatex = sanitizeSpecialCharsToUtf8(latexRaw || '').trim();
  if (!cleanedLatex) return '';

  // Ưu tiên 1: Chuyển LaTeX -> MathML bằng KaTeX, sau đó mml2omml -> OMML
  const hasCustomReactionArrow = /\\(xrightarrow|xrightleftharpoons|xleftarrow)\b/.test(
    cleanedLatex
  );
  let innerOmml = '';

  if (!hasCustomReactionArrow) {
    const mathml = convertLatexToMathMl(cleanedLatex);
    if (mathml) {
      innerOmml = convertMathMlToOmmlInnerXml(mathml, style);
    }
  }

  // Ưu tiên 2 (Fallback): Chuyển trực tiếp LaTeX -> OMML
  if (!innerOmml) {
    innerOmml = convertLatexExpressionToOmmlInnerXml(cleanedLatex, style);
  }

  if (!innerOmml) return '';
  return `<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">${innerOmml}</m:oMath>`;
}

/**
 * Kiểm tra ký tự có phải là ký hiệu Toán - Lý - Hóa - Sinh đặc biệt cần ép font Cambria Math
 * để tránh bị ô vuông (□) khi hiển thị ngoài vùng <m:oMath>
 */
const SPECIAL_MATH_UNICODE_REGEX =
  /([\u0370-\u03FF\u2100-\u2BFF\u2640\u2642±×÷°‰′″‴∞√∛∜∫∬∭∮∑∏∂∇∆∈∉⊂⊃⊆⊇⊄⊅∪∩∅∀∃¬∧∨⇒⇔⇐↦↔↑↓⇌≈≡≠≤≥≪≫∝⊥∥∠∡∢△□◊⊙⊕⊗⋆ℏℓℝℕℤℚℂ]+)/g;

function buildSingleWordTextRunXml(text: string, style: WordRunStyleOptions): string {
  const cleanText = sanitizeSpecialCharsToUtf8(text);
  if (!cleanText) return '';
  const sz = style.fontSizeHalfPt || 24;

  // Tách riêng các cụm ký hiệu toán học/khoa học đặc biệt để gắn font Cambria Math, giúp Word không bao giờ hiển thị ô vuông □
  const parts = cleanText.split(SPECIAL_MATH_UNICODE_REGEX);
  const runs: string[] = [];

  for (let idx = 0; idx < parts.length; idx++) {
    const part = parts[idx];
    if (!part) continue;
    const isMathSymbolChunk = idx % 2 === 1;
    const fontName = isMathSymbolChunk
      ? 'Cambria Math'
      : style.fontFamily || 'Times New Roman';

    runs.push(`<w:r>
    <w:rPr>
      <w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}" w:eastAsia="${fontName}" w:cs="${fontName}"/>
      ${style.bold ? '<w:b/><w:bCs/>' : ''}
      ${style.italic && !isMathSymbolChunk ? '<w:i/><w:iCs/>' : ''}
      ${style.underline ? '<w:u w:val="single"/>' : ''}
      ${style.colorHex ? `<w:color w:val="${style.colorHex}"/>` : ''}
      ${style.vertAlign ? `<w:vertAlign w:val="${style.vertAlign}"/>` : ''}
      <w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>
    </w:rPr>
    <w:t xml:space="preserve">${escapeXmlText(part)}</w:t>
  </w:r>`);
  }

  return runs.join('\n');
}

/**
 * Phân tích một đoạn văn bản thông thường có chứa:
 * - Chỉ số hóa học / vật lý viết dạng H_2SO_4, Fe^{3+}, SO_4^{2-}, x_1, 10^{-6}
 * - Công thức hóa học phổ biến viết liền (VD: H2SO4, HNO3, Al2(SO4)3, Ca(OH)2, Fe3O4, CH3COOH, C6H12O6, SO4^2-, Fe^3+, CO2, H2O, O2, N2...)
 * - Ký tự chỉ số trên/dưới Unicode (₀₁₂₃₄₅₆₇₈₉, ⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻)
 * - Mũi tên phản ứng một chiều (→), hai chiều (⇌)
 * và xuất ra các <m:oMath> hoặc <w:r> chuẩn Microsoft Word!
 */
function buildChemicalAndSubSupRunsXml(
  text: string,
  baseStyle: WordRunStyleOptions
): string {
  if (!text) return '';

  // Bước 1: Chuẩn hóa các ký hiệu mũi tên và các công thức hóa học phổ biến sang dạng tường minh _{...} và ^{...}
  let normalized = replaceLatexSymbolsWithUnicode(sanitizeSpecialCharsToUtf8(text));

  // Chuyển các chuỗi Unicode subscript (₀-₉) và superscript (⁰-⁹⁺⁻) sang _{...} và ^{...}
  normalized = normalized.replace(/[₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₒₓₕₖₗₘₙₚₛₜ]+/g, (match) => {
    const mapped = match
      .split('')
      .map((ch) => UNICODE_SUB_TO_NORMAL[ch] || ch)
      .join('');
    return `_{${mapped}}`;
  });

  normalized = normalized.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱ]+/g, (match) => {
    const mapped = match
      .split('')
      .map((ch) => UNICODE_SUP_TO_NORMAL[ch] || ch)
      .join('');
    return `^{${mapped}}`;
  });

  // Tự động nhận diện công thức phân tử Hóa học chuẩn (H2O, H2SO4, Fe(NO3)3, Al2(SO4)3, Fe2O3, C6H12O6, CH3COOH, KMnO4, Na2CO3...)
  const chemFormulaRegex =
    /\b((?:(?:H|He|Li|Be|B|C|N|O|F|Ne|Na|Mg|Al|Si|P|S|Cl|Ar|K|Ca|Sc|Ti|V|Cr|Mn|Fe|Co|Ni|Cu|Zn|Ga|Ge|As|Se|Br|Kr|Rb|Sr|Y|Zr|Nb|Mo|Tc|Ru|Rh|Pd|Ag|Cd|In|Sn|Sb|Te|I|Xe|Cs|Ba|La|Ce|Pt|Au|Hg|Pb|Bi|Po|Rn|Fr|Ra|Ac|Th|Pa|U|\([A-Za-z0-9]+\))\d*){2,})(?![a-zA-Z0-9_])/g;

  normalized = normalized.replace(chemFormulaRegex, (fullMatch) => {
    if (!/\d/.test(fullMatch)) return fullMatch;
    if (/^(?:[A-Z]\d+|\d+[A-Z])$/.test(fullMatch)) return fullMatch;
    return fullMatch.replace(/([A-Za-z)])(\d+)/g, '$1_{$2}');
  });

  // Nhận diện các phân tử đơn nguyên tố và hợp chất phổ biến: O2, N2, H2, Cl2, Br2, I2, O3, P4, S8, SO4, NO3, CO3, PO4, NH4
  normalized = normalized.replace(
    /\b(O2|O3|N2|H2|Cl2|Br2|I2|F2|P4|S8|CH4|NH3|PH3|H2S|SO2|SO3|SO4|NO2|NO3|N2O|N2O4|N2O5|CO2|CO3|CS2|SiO2|P2O5|PO4|NH4|HCO3|HSO4|HSO3|HS|Al2O3|FeO|Fe2O3|Fe3O4|CuO|ZnO|MgO|CaO|BaO|Na2O|K2O|Ag2O|Cr2O3|CrO3|Cr2O7|CrO4|MnO2|MnO4)\b/g,
    (m) => m.replace(/([A-Za-z])(\d+)/g, '$1_{$2}')
  );

  // Nhận diện tất cả ion hóa học viết kèm dấu ^ (VD: SO4^2-, SO_{4}^2-, Al^3+, Fe^2+, Fe^3+, Cu^2+, CO3^2-, PO4^3-, NH4^+, NO3^-, OH^-)
  normalized = normalized.replace(
    /([A-Za-z0-9_(){}]+)\^\{?([0-9]*[+-])\}?(?![a-zA-Z0-9])/g,
    (_, base, charge) => `${base}^{${charge}}`
  );

  // Nhận diện các ion viết tắt phổ biến không dùng dấu ^ (VD: OH-, NO3-, NH4+, HCO3-, HSO4-, CH3COO-, Cl-, Na+, K+, Ag+, H+)
  normalized = normalized.replace(
    /\b(OH|NO_\{3\}|NO3|HCO_\{3\}|HCO3|HSO_\{4\}|HSO4|CH_\{3\}COO|CH3COO|Cl|Br)\-(?=\s|[,.;:)\]}]|$)/g,
    (_, base) => `${base.replace(/([A-Za-z])(\d+)/g, '$1_{$2}')}^{-}`
  );
  normalized = normalized.replace(
    /\b(NH_\{4\}|NH4|Na|K|Ag|H|Li)\+(?=\s|[,.;:)\]}]|$)/g,
    (_, base) => `${base.replace(/([A-Za-z])(\d+)/g, '$1_{$2}')}^{+}`
  );

  // Bước 2: Tách chuỗi theo các token _{...}, _x, ^{...}, ^x
  const tokenRegex = /(_\{([^{}]+)\}|_([0-9a-zA-Z+-])|\^\{([^{}]+)\}|\^([0-9+-]+))/g;
  const runsXml: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(normalized)) !== null) {
    if (match.index > lastIndex) {
      runsXml.push(
        buildSingleWordTextRunXml(normalized.slice(lastIndex, match.index), baseStyle)
      );
    }
    const subContent = match[2] ?? match[3];
    const supContent = match[4] ?? match[5];

    if (subContent !== undefined) {
      runsXml.push(
        buildSingleWordTextRunXml(subContent, {
          ...baseStyle,
          vertAlign: 'subscript',
        })
      );
    } else if (supContent !== undefined) {
      runsXml.push(
        buildSingleWordTextRunXml(supContent, {
          ...baseStyle,
          vertAlign: 'superscript',
        })
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < normalized.length) {
    runsXml.push(buildSingleWordTextRunXml(normalized.slice(lastIndex), baseStyle));
  }

  return runsXml.join('\n');
}

/**
 * Chuyển đổi văn bản khoa học hỗn hợp (chứa cả công thức LaTeX $...$, lệnh \frac, \sqrt, \int, \lim, \vec, \xrightarrow
 * và các công thức Hóa học H2SO4, Fe(NO3)3, Fe^{3+}, SO4^{2-}, kiểu gen Sinh học AB/ab, X^A X^a)
 * sang chuỗi XML gồm các <w:r> và <m:oMath>...</m:oMath> nhúng trực tiếp vào <w:p> của file .docx!
 */
export function buildRichScientificRunsAndMathXml(
  rawText: string,
  baseStyle: WordRunStyleOptions
): string {
  if (!rawText) return '';

  // Bước 1: Làm sạch UTF-8 (loại bỏ PUA U+F0xx từ font Symbol/MT Extra cũ) và tự động vá lỗi công thức Toán - Lý - Hóa - Sinh
  const utf8Clean = sanitizeSpecialCharsToUtf8(rawText);
  const healedText = autoHealScientificAndStemText(utf8Clean);

  // Bước 2: Chuẩn hóa mũi tên kèm điều kiện phản ứng viết tắt dạng --t°, xt, p--> hoặc --(t°, xt)--> sang \xrightarrow{...}
  const preparedText = healedText.replace(
    /--\(?([^-\n>{}]{1,25})\)?-->/g,
    (_, cond) => `$\\xrightarrow{${cond.trim()}}$`
  );

  // Bước 3: Tách các đoạn LaTeX nằm trong $...$, $$...$$, \(...\), \[...\] hoặc các cụm lệnh toán học độc lập
  const mathSegmentRegex =
    /(\$\$[\s\S]+?\$\$|\$[^$\n]+\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]|\\begin\{(?:cases|matrix|pmatrix|bmatrix|vmatrix)\}[\s\S]+?\\end\{(?:cases|matrix|pmatrix|bmatrix|vmatrix)\}|\\(?:(?:d|t)?frac|sqrt|vec|overrightarrow|overline|bar|hat|widehat|xrightarrow|xrightleftharpoons|xleftarrow|int|oint|sum|prod|lim)(?:\s*\[[^\]]*\])?(?:\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})+)/g;

  const segments: string[] = [];
  let lastIdx = 0;
  let m: RegExpExecArray | null;

  while ((m = mathSegmentRegex.exec(preparedText)) !== null) {
    if (m.index > lastIdx) {
      const plainChunk = preparedText.slice(lastIdx, m.index);
      segments.push(buildChemicalAndSubSupRunsXml(plainChunk, baseStyle));
    }

    const mathRaw = m[0]
      .replace(/^\$\$|\$\$$/g, '')
      .replace(/^\$|\$$/g, '')
      .replace(/^\\\(|\\\)$/g, '')
      .replace(/^\\\[|\\\]$/g, '')
      .trim();

    const ommlXml = buildOmmlElementFromLatex(mathRaw, baseStyle);
    if (ommlXml) {
      segments.push(ommlXml);
    } else {
      segments.push(buildChemicalAndSubSupRunsXml(mathRaw, baseStyle));
    }

    lastIdx = m.index + m[0].length;
  }

  if (lastIdx < preparedText.length) {
    segments.push(buildChemicalAndSubSupRunsXml(preparedText.slice(lastIdx), baseStyle));
  }

  return segments.join('\n');
}

/**
 * Xuất bảng dữ liệu hoặc bảng ghép đôi (Cột A - Cột B) thuộc phần dẫn câu hỏi sang cấu trúc Word Table (<w:tbl>) hoàn chỉnh:
 * - Giữ nguyên căn lề chữ số (left/center/right)
 * - Giữ nguyên viền bảng đơn chuẩn in ấn
 * - Hỗ trợ ô gộp ngang (w:gridSpan) và ô gộp dọc (w:vMerge)
 */
export function buildStructuredStemTableXml(table: ExamStemTable): string {
  if (!table || !table.rows || table.rows.length === 0) return '';

  const maxCols = Math.max(
    1,
    ...table.rows.map((r) =>
      r.reduce((acc, cell) => acc + (cell.colSpan && cell.colSpan > 1 ? cell.colSpan : 1), 0)
    )
  );
  const colWidthPct = Math.floor(5000 / maxCols);

  const rowsXml = table.rows
    .map((row, rowIdx) => {
      const cellsXml = row
        .map((cell) => {
          const span = cell.colSpan && cell.colSpan > 1 ? cell.colSpan : 1;
          const cellWidthPct = colWidthPct * span;
          const align = cell.align || (rowIdx === 0 || cell.isHeader ? 'center' : 'left');
          const isBold = Boolean(cell.isHeader || cell.isBold || rowIdx === 0);
          const shdFill = rowIdx === 0 || cell.isHeader ? 'F1F5F9' : 'FFFFFF';

          return `<w:tc>
            <w:tcPr>
              <w:tcW w:w="${cellWidthPct}" w:type="pct"/>
              ${span > 1 ? `<w:gridSpan w:val="${span}"/>` : ''}
              ${
                cell.vMergeContinue
                  ? '<w:vMerge/>'
                  : cell.rowSpan && cell.rowSpan > 1
                  ? '<w:vMerge w:val="restart"/>'
                  : ''
              }
              <w:tcBorders>
                <w:top w:val="single" w:sz="6" w:space="0" w:color="475569"/>
                <w:left w:val="single" w:sz="6" w:space="0" w:color="475569"/>
                <w:bottom w:val="single" w:sz="6" w:space="0" w:color="475569"/>
                <w:right w:val="single" w:sz="6" w:space="0" w:color="475569"/>
              </w:tcBorders>
              <w:shd w:val="clear" w:color="auto" w:fill="${shdFill}"/>
              <w:vAlign w:val="center"/>
            </w:tcPr>
            <w:p>
              <w:pPr>
                <w:widowControl w:val="0"/>
                <w:spacing w:before="30" w:after="30" w:line="240" w:lineRule="auto"/>
                <w:jc w:val="${align}"/>
              </w:pPr>
              ${buildRichScientificRunsAndMathXml(cell.text, {
                bold: isBold,
                fontSizeHalfPt: 24,
              })}
            </w:p>
          </w:tc>`;
        })
        .join('\n');

      return `<w:tr>
        <w:trPr><w:cantSplit/></w:trPr>
        ${cellsXml}
      </w:tr>`;
    })
    .join('\n');

  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="5000" w:type="pct"/>
      <w:jc w:val="center"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="6" w:space="0" w:color="475569"/>
        <w:left w:val="single" w:sz="6" w:space="0" w:color="475569"/>
        <w:bottom w:val="single" w:sz="6" w:space="0" w:color="475569"/>
        <w:right w:val="single" w:sz="6" w:space="0" w:color="475569"/>
        <w:insideH w:val="single" w:sz="6" w:space="0" w:color="475569"/>
        <w:insideV w:val="single" w:sz="6" w:space="0" w:color="475569"/>
      </w:tblBorders>
      <w:tblCellMar>
        <w:top w:w="60" w:type="dxa"/>
        <w:left w:w="100" w:type="dxa"/>
        <w:bottom w:w="60" w:type="dxa"/>
        <w:right w:w="100" w:type="dxa"/>
      </w:tblCellMar>
    </w:tblPr>
    ${rowsXml}
  </w:tbl>`;
}

/**
 * ENGINE 1.2 + ENGINE 2 + ENGINE 3:
 * BỘ TỰ ĐỘNG HÀN GẮN CÔNG THỨC GÃY & CHUẨN HÓA KÝ HIỆU TOÁN - LÝ - HÓA - SINH (AUTO-HEAL STEM PIPELINE)
 * 1. Hàn gắn công thức bị gãy (Equation Stitcher): nối các thẻ $...$ đứt đoạn và mũi tên vectơ kết hợp Unicode (\u20D7)
 * 2. Nhận diện & tự nâng/hạ chỉ số Hóa học gõ thô: H2SO4 -> $\text{H}_2\text{SO}_4$, Ca(OH)2 -> $\text{Ca(OH)}_2$, Cu2+ -> $\text{Cu}^{2+}$, SO42- -> $\text{SO}_4^{2-}$
 * 3. Sửa ký hiệu Sinh học gõ sai: kiểu gen liên kết gạch chéo thô AB/ab, Ab/aB -> $\frac{AB}{ab}$, $\frac{Ab}{aB}$; NST giới tính XAXa, XAY -> $X^A X^a$, $X^A Y$; phép lai chữ x thường -> ×
 * 4. Thay thế ký tự thô: * / x trong phép toán -> × (\times); -> / => -> → (\rightarrow); <=> -> ⇌ (\rightleftharpoons)
 * 5. Bảo toàn trạng thái Hóa học (dd), (k), (r), (l), mũi tên nhiệt độ \xrightarrow{t^\circ}, kết tủa ↓, bay hơi ↑, giới tính ♂, ♀, ký hiệu Vật lý \vec{v}, \Omega, \mu, \lambda, \perp, \parallel
 */
export function autoHealScientificAndStemText(rawInput: string): string {
  if (!rawInput) return '';
  let text = rawInput;

  // 0. Giải mã HTML entities giới tính và toán học phổ biến nếu có
  text = text
    .replace(/&#9794;|&male;|\\male\b/gi, '♂')
    .replace(/&#9792;|&female;|\\female\b/gi, '♀')
    .replace(/&times;/gi, '×')
    .replace(/&divide;/gi, '÷')
    .replace(/&rarr;/gi, '→')
    .replace(/&harr;/gi, '↔')
    .replace(/&perp;/gi, '⊥')
    .replace(/&parallel;/gi, '∥');

  // 1. Nâng cấp \vec{AB} (2-3 chữ cái in hoa điểm đầu-cuối) thành \overrightarrow{AB} để mũi tên phủ trọn 2 điểm
  text = text.replace(/\\vec\{([A-Z]{2,3})\}/g, '\\overrightarrow{$1}');

  // 2. EQUATION STITCHER (Hàn gắn công thức bị Word cắt đôi thành nhiều cụm $...$ đứt đoạn)
  // 2a. Nối công thức có chỉ số trên/dưới bị tách rời: "$A$ $_{2}$" hoặc "$\vec{F}$ $_{1}$" -> "$A_{2}$", "$\vec{F}_{1}$"
  text = text.replace(/\$\s*\$\s*([_^]\s*\{[^{}]+\})/g, ' $1$');
  text = text.replace(/([A-Za-z0-9)\]}])\$\s*([_^]\{?[0-9a-zA-Z+-]+\}?)/g, '$1$2$');

  // 2b. Nối 2 khối $...$ liền kề bị cắt ngang bởi toán tử =, +, -, \pm, \times, \cdot, /, \rightarrow, \rightleftharpoons
  for (let pass = 0; pass < 3; pass++) {
    text = text.replace(
      /\$([^$\n]{1,80}?)\s*\$\s*([=+\-±×÷]|\\(?:pm|times|cdot|div|rightarrow|rightleftharpoons|to))\s*\$\s*([^$\n]{1,80}?)\$/g,
      '$$$1 $2 $3$$'
    );
    // Nối 2 khối $...$ mà khối trước kết thúc bằng toán tử (=, +, -, /, ^, _) và khối sau bắt đầu ngay
    text = text.replace(
      /\$([^$\n]{1,80}?[=+\-*/^_])\s*\$\s*\$\s*([^$\n]{1,80}?)\$/g,
      '$$$1 $2$$'
    );
  }

  // 3. Tách chuỗi thành các phân đoạn [Trong $...$] và [Ngoài $...$] để tự động chữa lỗi văn bản thô ngoài công thức mà không làm hỏng LaTeX có sẵn
  const mathProtectedRegex = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g;
  const segments = text.split(mathProtectedRegex);

  const healedSegments = segments.map((seg) => {
    if (seg.startsWith('$') && seg.endsWith('$')) {
      // Bên trong $...$: Chuẩn hóa các ký hiệu gõ thô trong công thức toán/lý/hóa/sinh (KHÔNG chèn thêm dấu $ lồng bên trong)
      let inner = seg;
      inner = inner
        .replace(/([A-Za-z]{2,3})[\u20d7\u20d6\u20e1]/g, '\\overrightarrow{$1}')
        .replace(/([A-Za-z0-9])[\u20d7\u20d6\u20e1]/g, '\\vec{$1}')
        .replace(/([A-Za-z]{2,3})[\u0304\u0305]/g, '\\overline{$1}')
        .replace(/([A-Za-z0-9])[\u0304\u0305]/g, '\\bar{$1}')
        .replace(/([A-Za-z]{2,3})\u0302/g, '\\widehat{$1}')
        .replace(/<==>|\\leftrightharpoons/g, '\\rightleftharpoons ')
        .replace(/<=>/g, '\\rightleftharpoons ')
        .replace(/-->/g, '\\rightarrow ')
        .replace(/(?<![<=-])->(?![>])/g, '\\rightarrow ')
        .replace(/\\vec\{([A-Z]{2,3})\}/g, '\\overrightarrow{$1}');
      return inner;
    }

    let plain = seg;

    // 3.0. Hàn gắn dấu mũi tên vectơ / gạch ngang trên / góc kết hợp Unicode ở văn bản ngoài $...$:
    // Ví dụ: AB⃗ -> $\overrightarrow{AB}$, F⃗ -> $\vec{F}$, v⃗ -> $\vec{v}$
    plain = plain
      .replace(/([A-Za-z]{2,3})[\u20d7\u20d6\u20e1]/g, '$\\overrightarrow{$1}$')
      .replace(/([A-Za-z0-9])[\u20d7\u20d6\u20e1]/g, '$\\vec{$1}$')
      .replace(/([A-Za-z]{2,3})[\u0304\u0305]/g, '$\\overline{$1}$')
      .replace(/([A-Za-z]{2,3})\u0302/g, '$\\widehat{$1}$');

    // Tự động bọc dấu $...$ cho các lệnh \vec{...}, \overrightarrow{...}, \widehat{...}, \overline{...} bị gõ trần ngoài công thức
    plain = plain.replace(
      /\\(overrightarrow|vec|widehat|overline)\s*\{([^{}]+)\}(?:\s*[_^]\s*\{?[0-9a-zA-Z+-]+\}?)*/g,
      (match) => `$${match}$`
    );

    // Tự động bọc dấu $...$ cho phân số \frac{...}{...} (hỗ trợ căn thức lồng bên trong tử/mẫu) và căn thức \sqrt{...} đứng ngoài $...$
    plain = plain.replace(
      /\\(?:d|t)?frac\s*\{[^{}]*(?:\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}[^{}]*)*\}\s*\{[^{}]*(?:\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}[^{}]*)*\}(?:\s*[_^]\s*\{?[0-9a-zA-Z+-]+\}?)*/g,
      (match) => `$${match}$`
    );
    plain = plain.replace(
      /(?<!\$[^$]{0,120})\\sqrt(?:\s*\[[^\]]*\])?\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}(?:\s*[_^]\s*\{?[0-9a-zA-Z+-]+\}?)*/g,
      (match) => `$${match}$`
    );

    // 3.1. Chuẩn hóa mũi tên điều kiện nhiệt độ, xúc tác gõ thô:
    // VD: "--t°-->", "--(t°, xt)-->", "-> (t°)", "--> (t°, p, xt)" -> $\xrightarrow{t^\circ}$
    plain = plain.replace(
      /--\(?([^-\n>{}]{1,25})\)?-->/g,
      (_, cond) => {
        const cleanCond = cond
          .trim()
          .replace(/t\s*[°0o]\b/gi, 't^\\circ')
          .replace(/\bxt\b/gi, '\\text{xt}');
        return ` $\\xrightarrow{${cleanCond}}$ `;
      }
    );
    plain = plain.replace(
      /(?:-->|->|→)\s*\(\s*(t\s*[°0o](?:\s*,\s*[^)]{1,20})?)\s*\)/gi,
      (_, cond) => {
        const cleanCond = cond
          .trim()
          .replace(/t\s*[°0o]\b/gi, 't^\\circ')
          .replace(/\bxt\b/gi, '\\text{xt}');
        return ` $\\xrightarrow{${cleanCond}}$ `;
      }
    );

    // 3.2. Sửa ký hiệu Sinh học gõ sai:
    // a) Kiểu gen liên kết gõ bằng gạch chéo thô: AB/ab, Ab/aB, AB/aB, Ab/ab, aB/ab, AB/AB, ab/ab, DE/de, De/dE, ABD/abd, AbD/aBd
    // (Tránh nhầm với đơn vị m/s, km/h, mol/l, g/mol, V/m, N/m)
    plain = plain.replace(
      /(?<![A-Za-z0-9_\\])((?:AB|Ab|aB|ab)\/(?:AB|Ab|aB|ab)|(?:DE|De|dE|de)\/(?:DE|De|dE|de)|(?:ABD|ABd|AbD|Abd|aBD|aBd|abD|abd)\/(?:ABD|ABd|AbD|Abd|aBD|aBd|abD|abd))(?![A-Za-z0-9_])/g,
      (match) => {
        const [num, den] = match.split('/');
        return `$\\frac{${num}}{${den}}$`;
      }
    );

    // b) Kiểu gen nhiễm sắc thể giới tính gõ thô: XAXa, XAY, XaY, XAXA, XaXa, XBXb, XBY, XbY, XABXab, XAbXaB
    plain = plain.replace(
      /\bX([ABDEabde]{1,2})X([ABDEabde]{1,2})\b/g,
      '$X^{$1}X^{$2}$'
    );
    plain = plain.replace(
      /\bX([ABDEabde]{1,2})Y\b/g,
      '$X^{$1}Y$'
    );

    // c) Dấu nhân phép lai Sinh học chữ 'x' thường giữa 2 kiểu gen (VD: "AaBb x Aabb", "Aa x aa", "X^A X^a x X^A Y")
    plain = plain.replace(
      /(\b(?:[A-Ha-h]{2,6}|\$[^$]+\$))\s+[xX]\s+(\b(?:[A-Ha-h]{2,6}|\$[^$]+\$))/g,
      '$1 × $2'
    );

    // 3.3. Nhận diện & Tự nâng/hạ chỉ số Hóa học gõ bằng text thường:
    // a) Các ion đa nguyên tử và đơn nguyên tử gõ thô không có dấu ^ (VD: SO42-, CO32-, SO32-, PO43-, Cr2O72-, CrO42-, NO3-, HCO3-, HSO4-, NH4+, H3O+, Cu2+, Fe2+, Fe3+, Al3+, Zn2+, Mg2+, Ca2+, Ba2+, Ag+)
    plain = plain.replace(
      /\b(SO4|CO3|SO3|CrO4|HPO4)\s*2\s*-\b/g,
      (_, grp) => `$\\text{${grp.slice(0, -1)}}_${grp.slice(-1)}^{2-}$`
    );
    plain = plain.replace(
      /\bCr2O7\s*2\s*-\b/g,
      '$\\text{Cr}_2\\text{O}_7^{2-}$'
    );
    plain = plain.replace(
      /\bPO4\s*3\s*-\b/g,
      '$\\text{PO}_4^{3-}$'
    );
    plain = plain.replace(
      /\b(NO3|HCO3|HSO4|HSO3|MnO4|ClO3|ClO4|AlO2|ZnO2)\s*-(?=\s|[,.;:)\]}]|$)/g,
      (_, grp) => {
        const formatted = grp.replace(/([A-Za-z]+)(\d+)/g, '\\text{$1}_{$2}');
        return `$${formatted}^{-}$`;
      }
    );
    plain = plain.replace(
      /\b(NH4|H3O)\s*\+(?=\s|[,.;:)\]}]|$)/g,
      (_, grp) => {
        const formatted = grp.replace(/([A-Za-z]+)(\d+)/g, '\\text{$1}_{$2}');
        return `$${formatted}^{+}$`;
      }
    );
    plain = plain.replace(
      /\b(Cu|Fe|Zn|Mg|Ca|Ba|Pb|Sn|Ni|Mn|Cr|Hg|Be|Sr)\s*2\s*\+(?=\s|[,.;:)\]}]|$)/g,
      '$\\text{$1}^{2+}$'
    );
    plain = plain.replace(
      /\b(Fe|Al|Cr|Au|Bi)\s*3\s*\+(?=\s|[,.;:)\]}]|$)/g,
      '$\\text{$1}^{3+}$'
    );
    plain = plain.replace(
      /\b(Na|K|Ag|Li|Cu|H)\s*\+(?=\s|[,.;:)\]}]|$)/g,
      '$\\text{$1}^{+}$'
    );
    plain = plain.replace(
      /\b(OH|Cl|Br|I|F|HS|CN)\s*-(?=\s|[,.;:)\]}]|$)/g,
      '$\\text{$1}^{-}$'
    );

    // b) Các công thức Hóa học có dấu ngoặc đơn kèm chỉ số: Ca(OH)2, Ba(OH)2, Cu(OH)2, Fe(OH)2, Fe(OH)3, Al(OH)3, Mg(OH)2, Zn(OH)2, Al2(SO4)3, Fe2(SO4)3, Cr2(SO4)3, Fe(NO3)2, Fe(NO3)3, Cu(NO3)2, AgNO3, (NH4)2SO4, (NH4)2CO3, Ca(HCO3)2, Ba(HCO3)2, Mg(HCO3)2, Ca3(PO4)2
    plain = plain.replace(
      /\b((?:\([A-Za-z0-9]+\)\d*|[A-Z][a-z]?\d*)*\([A-Za-z0-9]+\)\d+(?:[A-Z][a-z]?\d*)*)\b/g,
      (formula) => {
        const latexChem = formula
          .replace(/\(([A-Za-z0-9]+)\)(\d+)/g, (_, inner, sub) => {
            const innerFormatted = inner.replace(
              /([A-Z][a-z]?)(\d*)/g,
              (__: string, el: string, d: string) =>
                d ? `\\text{${el}}_{${d}}` : `\\text{${el}}`
            );
            return `(${innerFormatted})_{${sub}}`;
          })
          .replace(/([A-Z][a-z]?)(\d+)/g, '\\text{$1}_{$2}')
          .replace(/(?<!\\text\{)\b([A-Z][a-z]?)(?=[(_\\]|$)/g, '\\text{$1}');
        return `$${latexChem}$`;
      }
    );

    // c) Các công thức phân tử Hóa học phổ biến không có ngoặc: H2SO4, HNO3, H3PO4, H2CO3, H2SO3, H2S, HClO4, Fe3O4, Fe2O3, Al2O3, Cr2O3, P2O5, N2O5, N2O4, N2O, NO2, SO2, SO3, CO2, SiO2, MnO2, H2O, H2O2, NH3, PH3, CH4, C2H2, C2H4, C2H6, C3H6, C3H8, C4H8, C4H10, C6H6, C6H12O6, C12H22O11, CH3COOH, C2H5OH, CH3OH, CH3CHO, HCHO, HCOOH, CH3COOC2H5, KMnO4, K2Cr2O7, K2CrO4, Na2CO3, NaHCO3, K2CO3, CaCO3, BaCO3, MgCO3, BaSO4, CaSO4, CuSO4, FeSO4, ZnSO4, MgSO4, Na2SO4, K2SO4, Na2SO3, Na2S, KClO3, NH4Cl, NH4NO3, AgCl, AgBr, AgI, O2, O3, N2, H2, Cl2, Br2, I2
    const commonMoleculesRegex =
      /\b(H2SO4|H2SO3|H2CO3|H3PO4|HNO3|HNO2|HClO4|HClO3|HClO|H2S|H2O2|H2O|Fe3O4|Fe2O3|Al2O3|Cr2O3|CrO3|Mn2O7|MnO2|P2O5|N2O5|N2O4|N2O3|N2O|NO2|SO2|SO3|CO2|CS2|SiO2|Ag2O|Cu2O|Na2O|K2O|Li2O|NH3|PH3|CH4|C2H2|C2H4|C2H6|C3H4|C3H6|C3H8|C4H6|C4H8|C4H10|C6H6|C7H8|C8H8|C8H10|C6H12O6|C12H22O11|C6H10O5|CH3COOH|C2H5OH|CH3OH|C3H5\(OH\)3|CH3CHO|HCHO|HCOOH|CH3COOCH3|CH3COOC2H5|HCOOCH3|HCOOC2H5|CH3NH2|C2H5NH2|C6H5NH2|C6H5OH|KMnO4|K2MnO4|K2Cr2O7|K2CrO4|Na2CrO4|Na2CO3|NaHCO3|K2CO3|KHCO3|CaCO3|BaCO3|MgCO3|FeCO3|BaSO4|CaSO4|CuSO4|FeSO4|ZnSO4|MgSO4|Na2SO4|K2SO4|NaHSO4|KHSO4|Na2SO3|NaHSO3|Na2S|K2S|Na2SiO3|KClO3|NaClO|CaOCl2|NH4Cl|NH4NO3|NaNO3|KNO3|AgNO3|CuCl2|FeCl2|FeCl3|AlCl3|MgCl2|CaCl2|BaCl2|ZnCl2|CrCl3|PCl3|PCl5|O2|O3|N2|H2|Cl2|Br2|I2|F2|P4|S8)\b/g;

    plain = plain.replace(commonMoleculesRegex, (mol) => {
      const converted = mol.replace(
        /([A-Z][a-z]?)(\d*)/g,
        (_, el: string, digits: string) =>
          digits ? `\\text{${el}}_{${digits}}` : `\\text{${el}}`
      );
      return `$${converted}$`;
    });

    // 3.4. Thay thế ký tự thô trong phép toán & phương trình:
    // Đổi dấu * giữa 2 số (VD: 2 * 10, 3,5 * 2) thành ×
    plain = plain.replace(/(\d)\s*\*\s*(\d)/g, '$1 × $2');
    // Đổi chữ x giữa 2 số khoa học (VD: 2 x 10^-3, 3 x 4) thành ×
    plain = plain.replace(/(\d)\s+[xX]\s+(?=\d|10\b)/g, '$1 × ');
    // Đổi mũi tên thô <==>, <=>, <-> thành ⇌ và -->, ->, => (khi đi giữa các chất/biểu thức) thành →
    plain = plain
      .replace(/<==>|\\rightleftharpoons|\\leftrightharpoons/g, ' ⇌ ')
      .replace(/<=>|<->/g, ' ⇌ ')
      .replace(/-->|\\rightarrow|\\to\b/g, ' → ')
      .replace(/(?<![<=-])->(?![>])/g, ' → ')
      .replace(/(?<=\$\s*|[A-Za-z0-9)\]}]\s+)=>(?=\s*\$|\s+[A-Za-z0-9(])/g, ' → ');

    // Chuẩn hóa ký hiệu kết tủa / bay hơi và các ký hiệu Toán học đứng ngoài $...$ (\infty, \le, \ge, \mathbb{R}, \setminus, \{, \})
    plain = plain
      .replace(/\\downarrow\b/g, '↓')
      .replace(/\\uparrow\b/g, '↑')
      .replace(/\\perp\b/g, '⊥')
      .replace(/\\parallel\b/g, '∥')
      .replace(/\\mathbb\{R\}/g, 'ℝ')
      .replace(/\\mathbb\{N\}/g, 'ℕ')
      .replace(/\\mathbb\{Z\}/g, 'ℤ')
      .replace(/\\mathbb\{Q\}/g, 'ℚ')
      .replace(/\\mathbb\{C\}/g, 'ℂ')
      .replace(/\\setminus\b/g, '∖')
      .replace(/\\infty\b/g, '∞')
      .replace(/\\(?:le|leq)\b/g, '≤')
      .replace(/\\(?:ge|geq)\b/g, '≥')
      .replace(/\\(?:ne|neq)\b/g, '≠')
      .replace(/\\in\b/g, '∈')
      .replace(/\\notin\b/g, '∉')
      .replace(/\\pm\b/g, '±')
      .replace(/\\cdot\b/g, '·')
      .replace(/\\([{}])/g, '$1');

    return plain;
  });

  return healedSegments.join('');
}

/**
 * ENGINE 1.1b: TỰ ĐỘNG GOM MẢNH SƠ ĐỒ RỜI RẠC (AUTO-GROUPING WORD SHAPES TO FLAT PNG)
 * Quét các shape vẽ rời rạc trong Word (v:group, wpg:wgp, v:rect, v:roundrect, v:oval, v:line, wps:wsp, v:textbox)
 * có tọa độ nằm đè/gần nhau -> tự động gộp (merge) lại thành một khung Canvas 2D duy nhất và xuất ra 1 file ảnh PNG phẳng!
 */
export interface ExtractedShapePrimitive {
  kind: 'rect' | 'roundrect' | 'oval' | 'line' | 'arrow' | 'text';
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string;
  strokeColor?: string;
  fillColor?: string;
}

export function renderGroupedShapesToFlatPngDataUrl(
  primitives: ExtractedShapePrimitive[],
  groupTitle?: string
): string | null {
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    !primitives ||
    primitives.length === 0
  ) {
    return null;
  }

  try {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const p of primitives) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x + p.w > maxX) maxX = p.x + p.w;
      if (p.y + p.h > maxY) maxY = p.y + p.h;
    }

    if (!isFinite(minX) || !isFinite(minY) || maxX <= minX || maxY <= minY) {
      minX = 0;
      minY = 0;
      maxX = 520;
      maxY = Math.max(160, primitives.length * 55);
    }

    const pad = 24;
    const contentW = Math.max(260, Math.min(960, maxX - minX));
    const contentH = Math.max(90, Math.min(720, maxY - minY));
    const dpr = 2; // Chuẩn sắc nét 300 DPI

    const canvas = document.createElement('canvas');
    canvas.width = (contentW + pad * 2) * dpr;
    canvas.height = (contentH + pad * 2) * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, contentW + pad * 2, contentH + pad * 2);

    ctx.lineWidth = 1.8;
    ctx.strokeStyle = '#0F172A';
    ctx.font = '14px "Times New Roman", Times, serif';
    ctx.textBaseline = 'middle';

    for (const item of primitives) {
      const rx = item.x - minX + pad;
      const ry = item.y - minY + pad;
      const rw = Math.max(24, item.w);
      const rh = Math.max(22, item.h);

      ctx.strokeStyle = item.strokeColor || '#1E293B';
      ctx.fillStyle = item.fillColor || '#F8FAFC';

      if (item.kind === 'rect' || item.kind === 'roundrect') {
        ctx.beginPath();
        if (item.kind === 'roundrect' && typeof ctx.roundRect === 'function') {
          ctx.roundRect(rx, ry, rw, rh, 6);
        } else {
          ctx.rect(rx, ry, rw, rh);
        }
        ctx.fill();
        ctx.stroke();
      } else if (item.kind === 'oval') {
        ctx.beginPath();
        ctx.ellipse(rx + rw / 2, ry + rh / 2, rw / 2, rh / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (item.kind === 'line' || item.kind === 'arrow') {
        ctx.beginPath();
        const x1 = rx;
        const y1 = ry + rh / 2;
        const x2 = rx + rw;
        const y2 = ry + rh / 2;
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        if (item.kind === 'arrow') {
          const headLen = 8;
          ctx.beginPath();
          ctx.moveTo(x2, y2);
          ctx.lineTo(x2 - headLen, y2 - 4);
          ctx.lineTo(x2 - headLen, y2 + 4);
          ctx.closePath();
          ctx.fillStyle = '#1E293B';
          ctx.fill();
        }
      }

      if (item.text && item.text.trim()) {
        ctx.fillStyle = '#0F172A';
        ctx.textAlign = 'center';
        const lines = item.text.trim().split(/\r?\n/);
        const lineH = 16;
        const startY = ry + rh / 2 - ((lines.length - 1) * lineH) / 2;
        lines.forEach((ln, idx) => {
          ctx.fillText(ln.trim(), rx + rw / 2, startY + idx * lineH, rw - 8);
        });
      }
    }

    if (groupTitle) {
      ctx.fillStyle = '#475569';
      ctx.font = 'italic 12px "Times New Roman", Times, serif';
      ctx.textAlign = 'right';
      ctx.fillText(groupTitle, contentW + pad, contentH + pad + 14);
    }

    return canvas.toDataURL('image/png', 1.0);
  } catch {
    return null;
  }
}

/**
 * ENGINE 1.1c: CHỐNG BIẾN DẠNG TỈ LỆ & XỬ LÝ ẢNH THÔNG MINH (ASPECT RATIO PRESERVER)
 * 1. Tự động phát hiện ảnh bị người dùng kéo dãn méo mó -> reset về tỉ lệ khung hình gốc (Original Aspect Ratio = naturalWidth / naturalHeight)
 * 2. Ép giới hạn: chiều rộng tối đa 100% khung câu hỏi, không tràn viền
 * 3. Không phóng to vỡ hạt đối với các icon / công thức nhỏ (ảnh nhỏ giữ nguyên độ phân giải gốc 1:1)
 */
export async function enhanceAndCropExamImage(
  rawDataUrl: string,
  questionNumber: number,
  _originalFileName?: string
): Promise<{
  dataUrl: string;
  widthTwips: number;
  heightTwips: number;
  aspectRatio: number;
  tagId: string;
  dpi: number;
}> {
  const tagId = `[HINH_ANH_CAU_${questionNumber}]`;
  const defaultResult = {
    dataUrl: rawDataUrl,
    widthTwips: 4200,
    heightTwips: 2600,
    aspectRatio: 4200 / 2600,
    tagId,
    dpi: 300,
  };

  if (typeof window === 'undefined' || typeof document === 'undefined' || !rawDataUrl) {
    return defaultResult;
  }

  // Không crop nếu là ảnh vector SVG
  if (rawDataUrl.startsWith('data:image/svg+xml')) {
    return defaultResult;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const srcW = img.naturalWidth || img.width;
        const srcH = img.naturalHeight || img.height;
        if (srcW < 8 || srcH < 8) {
          resolve(defaultResult);
          return;
        }

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = srcW;
        tempCanvas.height = srcH;
        const ctx = tempCanvas.getContext('2d');
        if (!ctx) {
          resolve(defaultResult);
          return;
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, srcW, srcH);
        ctx.drawImage(img, 0, 0);

        const imgData = ctx.getImageData(0, 0, srcW, srcH);
        const data = imgData.data;

        let minX = srcW;
        let minY = srcH;
        let maxX = 0;
        let maxY = 0;

        // Quét tìm hộp giới hạn nội dung (Auto-Crop) & Khử nhiễu nền sáng (Background Denoise)
        for (let y = 0; y < srcH; y++) {
          for (let x = 0; x < srcW; x++) {
            const idx = (y * srcW + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const a = data[idx + 3];

            if (a < 25) {
              data[idx] = 255;
              data[idx + 1] = 255;
              data[idx + 2] = 255;
              data[idx + 3] = 255;
              continue;
            }

            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));

            // Khử nhiễu nền xám nhạt của bản scan thành trắng sạch (#FFFFFF)
            if (lum > 238 && maxDiff < 18) {
              data[idx] = 255;
              data[idx + 1] = 255;
              data[idx + 2] = 255;
            } else {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;

              // Tăng độ tương phản cho nét vẽ, trục đồ thị và chữ số bên trong sơ đồ
              if (lum < 155) {
                data[idx] = Math.max(0, Math.round(r * 0.85));
                data[idx + 1] = Math.max(0, Math.round(g * 0.85));
                data[idx + 2] = Math.max(0, Math.round(b * 0.85));
              }
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);

        // Nếu ảnh hoàn toàn trắng hoặc không tìm thấy biên cắt hợp lệ, giữ nguyên kích thước gốc
        if (maxX <= minX || maxY <= minY) {
          minX = 0;
          minY = 0;
          maxX = srcW - 1;
          maxY = srcH - 1;
        }

        // Chừa lề an toàn xung quanh sơ đồ/đồ thị để không phạm vào nét chữ ngoài cùng
        const isSmallIconOrInlineFormula = srcW <= 240 && srcH <= 120;
        const pad = isSmallIconOrInlineFormula ? 4 : 10;
        const cropX = Math.max(0, minX - pad);
        const cropY = Math.max(0, minY - pad);
        const cropW = Math.min(srcW - cropX, maxX - minX + 1 + pad * 2);
        const cropH = Math.min(srcH - cropY, maxY - minY + 1 + pad * 2);

        // BẢO TOÀN 100% TỈ LỆ KHUNG HÌNH GỐC (Original Aspect Ratio) - Chống méo ảnh do người dùng kéo dãn trong Word
        const aspectRatio = cropW / Math.max(1, cropH);

        // CHỐNG PHÓNG TO VỠ HẠT ĐỐI VỚI CÁC ICON NHỎ / CÔNG THỨC NHỎ:
        // Nếu là icon nhỏ hoặc ảnh công thức inline (cropW <= 240 && cropH <= 120), giữ nguyên tỷ lệ 1.0!
        const scaleFactor = isSmallIconOrInlineFormula
          ? 1.0
          : cropW < 900
          ? Math.min(1.75, 1080 / cropW)
          : 1.0;
        const outW = Math.round(cropW * scaleFactor);
        const outH = Math.round(cropH * scaleFactor);

        const outCanvas = document.createElement('canvas');
        outCanvas.width = outW;
        outCanvas.height = outH;
        const outCtx = outCanvas.getContext('2d');
        if (!outCtx) {
          resolve(defaultResult);
          return;
        }

        outCtx.fillStyle = '#FFFFFF';
        outCtx.fillRect(0, 0, outW, outH);
        outCtx.imageSmoothingEnabled = !isSmallIconOrInlineFormula;
        outCtx.imageSmoothingQuality = 'high';
        outCtx.drawImage(tempCanvas, cropX, cropY, cropW, cropH, 0, 0, outW, outH);

        // Tính kích thước chuẩn Twips (1 inch = 1440 Twips):
        // - Với icon nhỏ / công thức nhúng: giữ kích thước thực tế theo pixel (không ép phóng to 2200 Twips)
        // - Với sơ đồ / đồ thị lớn: giới hạn tối đa 5200 Twips (~100% khung câu hỏi chuẩn) và khóa chặt aspectRatio gốc
        const maxWidthTwips = 5200;
        const maxHeightTwips = 3800;
        let widthTwips: number;
        if (isSmallIconOrInlineFormula) {
          widthTwips = Math.min(maxWidthTwips, Math.max(360, Math.round(cropW * 11)));
        } else {
          widthTwips = Math.min(maxWidthTwips, Math.max(2000, Math.round(cropW * 9)));
        }
        let heightTwips = Math.round(widthTwips / aspectRatio);

        if (heightTwips > maxHeightTwips) {
          heightTwips = maxHeightTwips;
          widthTwips = Math.round(heightTwips * aspectRatio);
        }

        const enhancedDataUrl = outCanvas.toDataURL('image/png', 1.0);
        resolve({
          dataUrl: enhancedDataUrl,
          widthTwips,
          heightTwips,
          aspectRatio,
          tagId,
          dpi: 300,
        });
      } catch {
        resolve(defaultResult);
      }
    };
    img.onerror = () => resolve(defaultResult);
    img.src = rawDataUrl;
  });
}

/**
 * Gắn thẻ định danh [HINH_ANH_CAU_X] đồng bộ và khóa lại tỉ lệ gốc (Original Aspect Ratio)
 * cho toàn bộ hình ảnh của danh sách câu hỏi
 */
export function assignDeterministicImageTagsToQuestions(
  questions: ExamQuestion[]
): ExamQuestion[] {
  return questions.map((q) => {
    if (!q.images || q.images.length === 0) return q;
    const taggedImages: ExamImageAttachment[] = q.images.map((img, idx) => {
      const suffix = q.images && q.images.length > 1 ? `_${idx + 1}` : '';
      const tagId = `[HINH_ANH_CAU_${q.displayIndex}${suffix}]`;
      const w = img.widthTwips && img.widthTwips > 240 ? img.widthTwips : 4500;
      const preservedAspect =
        img.aspectRatio && img.aspectRatio > 0.05
          ? img.aspectRatio
          : img.heightTwips && img.heightTwips > 120
          ? w / img.heightTwips
          : 4500 / 2800;
      // Luôn tính lại chiều cao dựa trên Original Aspect Ratio để chống ảnh bị kéo dãn méo mó
      const h = Math.max(160, Math.round(w / preservedAspect));
      return {
        ...img,
        tagId,
        caption: img.caption || `Hình minh họa Câu ${q.displayIndex} ${tagId}`,
        widthTwips: w,
        heightTwips: h,
        aspectRatio: preservedAspect,
        dpi: img.dpi || 300,
      };
    });

    return {
      ...q,
      hasImage: true,
      images: taggedImages,
    };
  });
}

