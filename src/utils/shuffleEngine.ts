import QRCode from 'qrcode';
import {
  ExamQuestion,
  OptionPart1,
  QRAppFormat,
  ShuffleConfig,
  ShuffledVariant,
  SubItemPart2,
} from '../types/exam';
import { computeAutoLayoutForOptions } from './docxParser';

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
  * Xây dựng chuỗi Payload QR tương thích đa nền tảng (Mục V.1)
  * - Phần I: PHAN1: 1A,2C,3B,4D...
  * - Phần II: PHAN2: 1-TFTT,2-FTTF... (hoặc 1-ĐSĐĐ)
  * - Phần III: PHAN3: 1:12.5,2:4,3:-0.75...
  */
export function buildQrPayloadString(
  examCode: string,
  answerKey: ShuffledVariant['answerKey'],
  format: QRAppFormat
): string {
  const p1Str = answerKey.part1
    .map((item) => `${item.questionNumber}${item.answer}`)
    .join(',');

  const p2Str = answerKey.part2
    .map((item) => {
      const codeSeq = format === 'AZOTA' ? item.dsString : item.tfString;
      return `${item.questionNumber}-${codeSeq}`;
    })
    .join(',');

  const p3Str = answerKey.part3
    .map((item) => `${item.questionNumber}:${item.answer.replace(',', '.')}`)
    .join(',');

  if (format === 'QM2025') {
    return `QM2025|MADE:${examCode}|PHAN1:${p1Str}|PHAN2:${p2Str}|PHAN3:${p3Str}`;
  }
  if (format === 'TNMAKER') {
    return `TNMAKER|ID:${examCode}|P1:${p1Str}|P2:${p2Str}|P3:${p3Str}`;
  }
  if (format === 'AZOTA') {
    return `AZOTA2025|CODE:${examCode}|PHAN1:${p1Str}|PHAN2:${p2Str}|PHAN3:${p3Str}`;
  }
  return `MADE:${examCode} | PHAN1: ${p1Str} | PHAN2: ${p2Str} | PHAN3: ${p3Str}`;
}

/**
  * Thực thi trộn bộ đề theo cấu hình (Mục II.2 & IV.1 & V.1)
  * - Phần I, II, III: Trộn theo cấu hình
  * - Phần IV (Tự luận): KHÔNG ĐẢO CÂU HỎI, giữ nguyên hoàn toàn thứ tự các câu hỏi và nội dung ở tất cả các mã đề
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
    // 1. Trộn thứ tự câu trong từng phần trắc nghiệm độc lập
    const p1Questions = config.shuffleQuestions
      ? fisherYatesShuffle(part1Source)
      : [...part1Source];
    const p2Questions = config.shuffleQuestions
      ? fisherYatesShuffle(part2Source)
      : [...part2Source];
    const p3Questions = config.shuffleQuestions
      ? fisherYatesShuffle(part3Source)
      : [...part3Source];
    // Phần IV (Tự luận): KHÔNG ĐẢO CÂU HỎI — Giữ nguyên 100% thứ tự câu hỏi và nội dung ở mọi mã đề
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

    // 5. Xử lý Phần IV (Tự luận): Giữ nguyên hoàn toàn thứ tự câu hỏi và nội dung
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

    const answerKeyP4 = processedP4.map((q) => ({
      questionNumber: q.displayIndex,
      answer: (
        q.explanation?.trim() ||
        'Chấm theo hướng dẫn chấm tự luận của giáo viên.'
      ),
    }));

    const answerKey = {
      part1: answerKeyP1,
      part2: answerKeyP2,
      part3: answerKeyP3,
      part4: answerKeyP4,
    };

    const qrPayload = buildQrPayloadString(examCode, answerKey, config.qrFormat);

    // Sinh ảnh QR với Error Correction Level M
    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 300,
      color: {
        dark: '#0F172A',
        light: '#FFFFFF',
      },
    });

    variants.push({
      examCode,
      createdAt: new Date().toLocaleTimeString('vi-VN'),
      questions: [...processedP1, ...processedP2, ...processedP3, ...processedP4],
      qrPayload,
      qrDataUrl,
      answerKey,
    });
  }

  return variants;
}
