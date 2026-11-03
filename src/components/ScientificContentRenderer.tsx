import React, { useEffect, useMemo, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { autoHealScientificAndStemText } from '../utils/scientificExamProcessor';

declare global {
  interface Window {
    MathJax?: {
      typesetPromise?: (elements?: HTMLElement[]) => Promise<void>;
      tex2chtml?: (tex: string, options?: { display?: boolean }) => HTMLElement;
    };
  }
}

interface ScientificContentRendererProps {
  text: string;
  className?: string;
  formulaLatex?: string;
  hasFormula?: boolean;
  inline?: boolean;
  isCorrect?: boolean;
  isUnderline?: boolean;
  isRed?: boolean;
}

let mathJaxScriptLoading = false;

/**
 * Tự động nạp MathJax 3 (Fallback) khi gặp công thức nâng cao vượt quá phạm vi macro của KaTeX
 */
function ensureMathJaxFallbackLoaded(onReady: () => void): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
    onReady();
    return;
  }
  if (!mathJaxScriptLoading) {
    mathJaxScriptLoading = true;
    (window as unknown as Record<string, unknown>).MathJax = {
      tex: {
        inlineMath: [
          ['$', '$'],
          ['\\(', '\\)'],
        ],
        displayMath: [
          ['$$', '$$'],
          ['\\[', '\\]'],
        ],
      },
      options: {
        skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
      },
    };
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js';
    script.async = true;
    script.onload = () => {
      onReady();
    };
    document.head.appendChild(script);
  }
}

/**
 * Chuẩn hóa chuỗi LaTeX trước khi đưa vào KaTeX để tương thích 100% với các lệnh Toán - Lý - Hóa - Sinh:
 * - Hỗ trợ \xrightarrow{t^\circ}, \xrightleftharpoons{...}, \vec{v}, \overrightarrow{AB}, \male, \female, \degree
 */
function normalizeLatexForKatex(rawExpr: string): string {
  return (rawExpr || '')
    .trim()
    .replace(/\\male\b/g, '♂')
    .replace(/\\female\b/g, '♀')
    .replace(/\\degree\b/g, '^\\circ')
    .replace(/\\vec\{([A-Z]{2})\}/g, '\\overrightarrow{$1}')
    .replace(/\\xrightleftharpoons\s*\{([^{}]*)\}/g, '\\stackrel{#1}{\\rightleftharpoons}')
    .replace(/\\xrightarrow\s*\[([^\[\]]*)\]\s*\{([^{}]*)\}/g, '\\underset{#1}{\\overset{#2}{\\longrightarrow}}')
    .replace(/\\xrightarrow\s*\{([^{}]*)\}/g, '\\overset{#1}{\\longrightarrow}');
}

/**
 * Hàm hỗ trợ định dạng trực tiếp chuỗi Hóa học / Sinh học đơn lẻ sang JSX có sub/sup
 */
function renderChemicalHtml(chemText: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /([A-Z][a-z]?)|(\d+)|(\^?(?:[1-9]?[+-]|[+-][1-9]?))|(\(|\))/g;
  let match: RegExpExecArray | null;
  let lastIdx = 0;
  let keyIdx = 0;

  while ((match = regex.exec(chemText)) !== null) {
    if (match.index > lastIdx) {
      parts.push(chemText.slice(lastIdx, match.index));
    }
    const [, element, digits, charge, paren] = match;
    if (element) {
      parts.push(<span key={`el-${keyIdx++}`}>{element}</span>);
    } else if (digits) {
      parts.push(
        <sub key={`sub-${keyIdx++}`} className="text-[0.76em] bottom-[-0.18em] relative font-semibold">
          {digits}
        </sub>
      );
    } else if (charge) {
      const cleanCharge = charge.replace('^', '');
      parts.push(
        <sup key={`sup-${keyIdx++}`} className="text-[0.76em] top-[-0.35em] relative font-semibold">
          {cleanCharge}
        </sup>
      );
    } else if (paren) {
      parts.push(<span key={`paren-${keyIdx++}`}>{paren}</span>);
    }
    lastIdx = regex.lastIndex;
  }
  if (lastIdx < chemText.length) {
    parts.push(chemText.slice(lastIdx));
  }
  return <span className="tracking-normal">{parts}</span>;
}

/**
 * Hiển thị văn bản thường nhưng có chứa chỉ số trên/dưới (^{...}, _{...}, ^2, _1) từ Word <w:vertAlign>
 * giúp không bao giờ bị lộ ký tự thô ^{2} hoặc _{1} ngoài công thức
 */
function renderPlainSegmentWithSubSup(plainText: string, keyPrefix: string): React.ReactNode {
  if (!plainText) return null;
  if (!/[_^]/.test(plainText)) {
    return <span key={keyPrefix}>{plainText}</span>;
  }

  const tokenRegex = /(_\{([^{}]+)\}|_([0-9a-zA-Z+-])|\^\{([^{}]+)\}|\^([0-9+-]+))/g;
  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  let idx = 0;

  while ((m = tokenRegex.exec(plainText)) !== null) {
    if (m.index > lastIdx) {
      parts.push(plainText.slice(lastIdx, m.index));
    }
    const subVal = m[2] ?? m[3];
    const supVal = m[4] ?? m[5];
    if (subVal !== undefined) {
      parts.push(
        <sub
          key={`${keyPrefix}-sub-${idx++}`}
          className="text-[0.76em] bottom-[-0.18em] relative font-semibold"
        >
          {subVal}
        </sub>
      );
    } else if (supVal !== undefined) {
      parts.push(
        <sup
          key={`${keyPrefix}-sup-${idx++}`}
          className="text-[0.76em] top-[-0.35em] relative font-semibold"
        >
          {supVal}
        </sup>
      );
    }
    lastIdx = m.index + m[0].length;
  }

  if (lastIdx < plainText.length) {
    parts.push(plainText.slice(lastIdx));
  }

  return <span key={keyPrefix}>{parts}</span>;
}

/**
 * ENGINE 4: COMPONENT KẾT XUẤT NỘI DUNG KHOA HỌC (KATEX + FALLBACK MATHJAX 3 + AUTO-HEALING STEM)
 * - Tự động chạy Auto-Heal (hàn gắn công thức gãy, chuẩn hóa Hóa học H2SO4/Ca(OH)2/Cu2+/SO42-, Sinh học AB/ab -> \frac{AB}{ab}, X^A X^a, ×, ♂, ♀, Vật lý \vec{v}, \Omega, \mu, \lambda, \perp, \parallel)
 * - Ưu tiên kết xuất tốc độ cao bằng KaTeX, tự động kích hoạt MathJax 3 fallback nếu có biểu thức đặc biệt
 */
export const ScientificContentRenderer: React.FC<ScientificContentRendererProps> = ({
  text,
  className = '',
  formulaLatex,
  inline = false,
  isCorrect,
  isUnderline,
  isRed,
}) => {
  const containerRef = useRef<HTMLElement | null>(null);

  const { renderedNodes, needsMathJaxFallback } = useMemo(() => {
    if (!text && !formulaLatex) {
      return { renderedNodes: null, needsMathJaxFallback: false };
    }

    const baseContent = (text || formulaLatex || '').trim();
    const healedContent = autoHealScientificAndStemText(baseContent);
    let fallbackRequired = false;

    // 1. Nếu chuỗi chứa các cặp $...$ hoặc $$...$$ hoặc \(...\) hoặc \[...\]
    if (/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\])/.test(healedContent)) {
      const segments: React.ReactNode[] = [];
      const mathSplitter = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\])/g;
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      let segIdx = 0;

      while ((match = mathSplitter.exec(healedContent)) !== null) {
        if (match.index > lastIndex) {
          const plainText = healedContent.slice(lastIndex, match.index);
          segments.push(renderPlainSegmentWithSubSup(plainText, `plain-${segIdx++}`));
        }

        const mathRaw = match[0];
        const isDisplay = mathRaw.startsWith('$$') || mathRaw.startsWith('\\[');
        const mathExpr = isDisplay
          ? mathRaw.slice(2, -2).trim()
          : mathRaw.startsWith('\\(')
          ? mathRaw.slice(2, -2).trim()
          : mathRaw.slice(1, -1).trim();

        const normalizedExpr = normalizeLatexForKatex(mathExpr);

        try {
          const html = katex.renderToString(normalizedExpr, {
            displayMode: isDisplay,
            throwOnError: true,
            strict: false,
            trust: true,
            output: 'html',
          });
          segments.push(
            <span
              key={`math-${segIdx++}`}
              className="inline-block px-0.5 align-middle font-serif"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          // Thử lần 2 với throwOnError: false của KaTeX, đồng thời đánh dấu cho MathJax 3 fallback nếu cần
          try {
            const lenientHtml = katex.renderToString(normalizedExpr, {
              displayMode: isDisplay,
              throwOnError: false,
              strict: false,
              trust: true,
              output: 'html',
            });
            segments.push(
              <span
                key={`math-lenient-${segIdx++}`}
                className="inline-block px-0.5 align-middle font-serif"
                dangerouslySetInnerHTML={{ __html: lenientHtml }}
              />
            );
          } catch {
            fallbackRequired = true;
            segments.push(
              <span
                key={`mathjax-fb-${segIdx++}`}
                className="mathjax-fallback-node inline-block px-0.5 font-serif"
              >
                {isDisplay ? `$$${mathExpr}$$` : `$${mathExpr}$`}
              </span>
            );
          }
        }

        lastIndex = mathSplitter.lastIndex;
      }

      if (lastIndex < healedContent.length) {
        segments.push(
          renderPlainSegmentWithSubSup(healedContent.slice(lastIndex), 'plain-end')
        );
      }

      return { renderedNodes: segments, needsMathJaxFallback: fallbackRequired };
    }

    // 2. Nếu chuỗi bắt đầu hoặc chứa lệnh LaTeX trực tiếp không có dấu $
    if (
      /\\(frac|dfrac|sqrt|vec|overrightarrow|int|oint|sum|prod|lim|begin|alpha|beta|gamma|Delta|Omega|lambda|mu|perp|parallel|rightleftharpoons|rightarrow|xrightarrow|times)/.test(
        healedContent
      )
    ) {
      const normalizedExpr = normalizeLatexForKatex(healedContent);
      try {
        const html = katex.renderToString(normalizedExpr, {
          displayMode: false,
          throwOnError: false,
          strict: false,
          trust: true,
          output: 'html',
        });
        return {
          renderedNodes: (
            <span
              className="inline-block px-0.5 align-middle font-serif"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ),
          needsMathJaxFallback: false,
        };
      } catch {
        fallbackRequired = true;
      }
    }

    // 3. Nếu là một công thức hóa học hoặc ion đơn lẻ
    if (
      /^[A-Z][a-z]?\d*(?:[A-Z][a-z]?\d*)+(?:\^?[0-9]*[+-])?$/.test(healedContent) ||
      /^[A-Z][a-z]?\^[0-9]*[+-]$/.test(healedContent)
    ) {
      return {
        renderedNodes: renderChemicalHtml(healedContent),
        needsMathJaxFallback: false,
      };
    }

    return {
      renderedNodes: renderPlainSegmentWithSubSup(healedContent, 'root-plain'),
      needsMathJaxFallback: fallbackRequired,
    };
  }, [text, formulaLatex]);

  useEffect(() => {
    if (needsMathJaxFallback && containerRef.current) {
      const el = containerRef.current;
      ensureMathJaxFallbackLoaded(() => {
        if (window.MathJax?.typesetPromise) {
          void window.MathJax.typesetPromise([el]);
        }
      });
    }
  }, [needsMathJaxFallback, renderedNodes]);

  const Tag = inline ? 'span' : 'div';

  return (
    <Tag
      ref={(node: HTMLElement | null) => {
        containerRef.current = node;
      }}
      className={`scientific-rendered-content exam-content ${
        isUnderline ? 'underline underline-offset-4 decoration-2' : ''
      } ${isRed ? 'text-rose-600 font-bold' : ''} ${
        isCorrect ? 'text-rose-700 font-bold' : ''
      } ${className}`}
      style={{ fontFamily: "'Times New Roman', Times, serif" }}
    >
      {renderedNodes}
    </Tag>
  );
};
