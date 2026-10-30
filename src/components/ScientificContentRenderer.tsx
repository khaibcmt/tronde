import React, { useMemo } from 'react';
import katex from 'katex';

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

/**
 * Biểu thức chính quy phát hiện công thức hóa học thông dụng và ion
 * Ví dụ: H2SO4, Fe(NO3)3, Al2(SO4)3, SO4^2-, Fe^3+, Cu2+, OH-, Cl-, H+, H3O+, KMnO4
 */
const CHEMICAL_FORMULA_REGEX =
  /\b([A-Z][a-z]?\d*(?:\([A-Za-z0-9]+\)\d*)*(?:[A-Z][a-z]?\d*)*(?:\^?(?:[1-9]?[+-]|[+-][1-9]?))?)\b/g;

/**
 * Hàm hỗ trợ định dạng công thức hóa học sang JSX có sub/sup
 */
function renderChemicalHtml(chemText: string): React.ReactNode {
  // Tách các thành phần nguyên tố, chỉ số dưới, điện tích ion
  const parts: React.ReactNode[] = [];
  const regex = /([A-Z][a-z]?)|(\d+)|(\^?(?:[1-9]?[+-]|[+-][1-9]?))|(\(|\))/g;
  let match: RegExpExecArray | null;
  let lastIdx = 0;
  let keyIdx = 0;

  while ((match = regex.exec(chemText)) !== null) {
    if (match.index > lastIdx) {
      parts.push(chemText.slice(lastIdx, match.index));
    }
    const [full, element, digits, charge, paren] = match;
    if (element) {
      parts.push(<span key={`el-${keyIdx++}`}>{element}</span>);
    } else if (digits) {
      parts.push(
        <sub key={`sub-${keyIdx++}`} className="text-[0.75em] bottom-[-0.2em] relative font-semibold">
          {digits}
        </sub>
      );
    } else if (charge) {
      const cleanCharge = charge.replace('^', '');
      parts.push(
        <sup key={`sup-${keyIdx++}`} className="text-[0.75em] top-[-0.35em] relative font-semibold text-indigo-700">
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
  return <span className="font-mono tracking-tight">{parts}</span>;
}

/**
 * Component hiển thị chuẩn khoa học cho nội dung đề thi (Toán - Lý - Hóa - Sinh)
 * - Tự động nhận diện và render KaTeX cho biểu thức $...$ hoặc \frac, \sqrt, \vec, \int, \sum, \lim
 * - Tự động nhận diện công thức Hóa học (H2SO4, Fe^3+, SO4^2-) và mũi tên phản ứng (→, ⇌)
 * - Tự động định dạng ký hiệu Sinh học (\frac{AB}{ab}, X^A X^a, ♀, ♂)
 * - Giữ nguyên định dạng gạch chân, tô đỏ đáp án
 */
export const ScientificContentRenderer: React.FC<ScientificContentRendererProps> = ({
  text,
  className = '',
  formulaLatex,
  hasFormula,
  inline = false,
  isCorrect,
  isUnderline,
  isRed,
}) => {
  const renderedNodes = useMemo(() => {
    if (!text && !formulaLatex) return null;
    const rawContent = (text || '').trim();

    // 1. Nếu chuỗi chứa các cặp $...$ hoặc $$...$$
    if (/\$[^$]+\$/.test(rawContent)) {
      const segments: React.ReactNode[] = [];
      const mathSplitter = /(\$\$[\s\S]+?\$\$|\$[^\$]+?\$)/g;
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      let segIdx = 0;

      while ((match = mathSplitter.exec(rawContent)) !== null) {
        if (match.index > lastIndex) {
          const plainText = rawContent.slice(lastIndex, match.index);
          segments.push(
            <span key={`plain-${segIdx++}`}>{plainText}</span>
          );
        }

        const mathRaw = match[0];
        const isDisplay = mathRaw.startsWith('$$');
        const mathExpr = isDisplay
          ? mathRaw.slice(2, -2).trim()
          : mathRaw.slice(1, -1).trim();

        try {
          const html = katex.renderToString(mathExpr, {
            displayMode: isDisplay,
            throwOnError: false,
          });
          segments.push(
            <span
              key={`math-${segIdx++}`}
              className="inline-block px-0.5 align-middle font-serif"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          segments.push(
            <span key={`fallback-${segIdx++}`} className="font-mono text-indigo-700 font-bold">
              {mathExpr}
            </span>
          );
        }

        lastIndex = mathSplitter.lastIndex;
      }

      if (lastIndex < rawContent.length) {
        segments.push(
          <span key={`plain-end`}>{rawContent.slice(lastIndex)}</span>
        );
      }

      return segments;
    }

    // 2. Nếu chuỗi bắt đầu hoặc chứa lệnh LaTeX trực tiếp không có dấu $
    if (
      /\\(frac|sqrt|vec|overrightarrow|int|sum|prod|lim|begin|alpha|beta|gamma|Delta|Omega|lambda|mu|rightleftharpoons|rightarrow)/.test(
        rawContent
      )
    ) {
      try {
        const html = katex.renderToString(rawContent, {
          displayMode: false,
          throwOnError: false,
        });
        return (
          <span
            className="inline-block px-0.5 align-middle font-serif"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      } catch {
        // Fallback
      }
    }

    // 3. Nếu là công thức hóa học hoặc ion rõ ràng (như H2SO4, Fe3+, Cu(OH)2, ...)
    if (
      /^[A-Z][a-z]?\d*(?:[A-Z][a-z]?\d*)+(?:\^?[0-9]*[+-])?$/.test(rawContent) ||
      /^[A-Z][a-z]?\^[0-9]*[+-]$/.test(rawContent)
    ) {
      return renderChemicalHtml(rawContent);
    }

    // 4. Văn bản thông thường nhưng có các mũi tên phản ứng hoặc ký hiệu
    // Thay thế ký hiệu mũi tên phản ứng đẹp mắt
    const formattedText = rawContent
      .replace(/<==>|\\rightleftharpoons|\\leftrightharpoons/g, ' ⇌ ')
      .replace(/<=>/g, ' ⇌ ')
      .replace(/-->|\\rightarrow|\\to/g, ' → ')
      .replace(/(?<![<=-])->(?![>])/g, ' → ');

    return <span>{formattedText}</span>;
  }, [text, formulaLatex]);

  const Tag = inline ? 'span' : 'div';

  return (
    <Tag
      className={`scientific-rendered-content ${isUnderline ? 'underline underline-offset-4 decoration-2' : ''} ${
        isRed ? 'text-rose-600 font-bold' : ''
      } ${isCorrect ? 'text-rose-700 font-bold' : ''} ${className}`}
      style={{ fontFamily: "'Times New Roman', Times, serif" }}
    >
      {renderedNodes}
    </Tag>
  );
};
