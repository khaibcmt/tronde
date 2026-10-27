import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  Bold,
  BookOpen,
  Building2,
  CheckCircle2,
  Download,
  FileArchive,
  FileCheck,
  FileCode2,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  ListRestart,
  Palette,
  QrCode,
  Save,
  Shuffle,
  Sliders,
  Sparkles,
  Underline,
  Upload,
  Wand2,
} from 'lucide-react';
import {
  ExamQuestion,
  FeatureReleaseItem,
  LayoutMode,
  OptionPart1,
  PartType,
  QRAppFormat,
  ShuffleConfig,
  ShuffledVariant,
  SubItemPart2,
  ValidationIssue,
} from './types/exam';
import {
  SAMPLE_2025_EXAM_WITH_ERRORS,
  DYNAMIC_FEATURE_REGISTRY,
} from './utils/sampleExamData';
import {
  computeAutoLayoutForOptions,
  parseDocxExamFile,
  recalculateQuestionNumbering,
  validateExamQuestions,
} from './utils/docxParser';
import { generateShuffledVariants } from './utils/shuffleEngine';
import {
  exportAllVariantsZipBundle,
  exportCleanedMasterDocx,
  exportMasterAnswerSheetDocx,
  exportQrCodesZip,
  exportSingleVariantDocx,
  triggerBrowserDownload,
} from './utils/docxExporter';
import { UserGuideModal } from './components/UserGuideModal';

export default function App() {
  // 1. State quản lý File & Câu hỏi gốc
  const [fileName, setFileName] = useState<string>('De_Mau_THPT_2025_Toan_Hoc.docx');
  const [questions, setQuestions] = useState<ExamQuestion[]>(() =>
    recalculateQuestionNumbering(SAMPLE_2025_EXAM_WITH_ERRORS, true)
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [lastSavedAt, setLastSavedAt] = useState<string>('Vừa khởi tạo');
  const [highlightedQuestionId, setHighlightedQuestionId] = useState<string | null>(null);
  const [activeRightTab, setActiveRightTab] = useState<'LIVE_EDITOR' | 'SHUFFLED_PREVIEW'>('LIVE_EDITOR');
  const [filterPart, setFilterPart] = useState<'ALL' | PartType>('ALL');
  const [statusBanner, setStatusBanner] = useState<{
    type: 'SUCCESS' | 'INFO' | 'ERROR';
    text: string;
  } | null>(null);

  // 2. State cấu hình Trộn đề, Tiêu đề Quốc ngữ, Môn thi, Kỳ thi, Số phút & Mã QR
  const [config, setConfig] = useState<ShuffleConfig>({
    numVariants: 4,
    examCodeDigits: 3,
    layoutOverride: 'AUTO',
    resetNumberingPerPart: true,
    shuffleQuestions: true,
    shuffleOptionsPart1: true,
    shuffleSubItemsPart2: true,
    qrFormat: 'QM2025',
    embedQrInWord: true,
    departmentName: 'SỞ GD&ĐT VĨNH LONG',
    schoolName: 'TRƯỜNG THPT MANG THÍT',
    nationalHeader: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',
    nationalMotto: 'Độc lập - Tự do - Hạnh phúc',
    examTitle: 'KỲ THI TỐT NGHIỆP THPT NĂM 2025',
    examSubtitle: 'ĐỀ THI CHÍNH THỨC',
    subjectName: 'TOÁN HỌC',
    schoolYear: 'Năm học 2024 - 2025',
    durationMinutes: 90,
  });

  // 3. State kết quả sau khi bấm [Trộn đề]
  const [shuffledVariants, setShuffledVariants] = useState<ShuffledVariant[]>([]);
  const [selectedVariantCode, setSelectedVariantCode] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // 4. State Cẩm nang hướng dẫn tự động điền khi nâng cấp
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [featureRegistry, setFeatureRegistry] = useState<FeatureReleaseItem[]>(
    DYNAMIC_FEATURE_REGISTRY
  );

  // Refs phục vụ cuộn tự động tới câu bị lỗi khi bấm [Sửa ngay]
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Chạy Validator tự động trên danh sách câu hỏi hiện tại
  const validationIssues: ValidationIssue[] = validateExamQuestions(questions);
  const errorIssues = validationIssues.filter((i) => i.severity === 'ERROR');
  const canShuffle = errorIssues.length === 0 && !hasUnsavedChanges;

  // Thống kê số lượng câu theo từng phần
  const part1Count = questions.filter((q) => q.part === 'PART_1').length;
  const part2Count = questions.filter((q) => q.part === 'PART_2').length;
  const part3Count = questions.filter((q) => q.part === 'PART_3').length;
  const activePartsCount = [part1Count, part2Count, part3Count].filter((c) => c > 0).length;

  // ================= HANDLERS: UPLOAD & PARSE DOCX =================
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const parsed = await parseDocxExamFile(file, config.resetNumberingPerPart);
      if (parsed.length === 0) {
        setStatusBanner({
          type: 'ERROR',
          text: 'Không tìm thấy câu hỏi dạng "Câu 1." trong file Word. Đã giữ nguyên dữ liệu hiện tại.',
        });
      } else {
        setFileName(file.name);
        setQuestions(parsed);
        setHasUnsavedChanges(false);
        setShuffledVariants([]);
        setActiveRightTab('LIVE_EDITOR');
        setLastSavedAt(new Date().toLocaleTimeString('vi-VN'));
        setStatusBanner({
          type: 'SUCCESS',
          text: `Đã phân tích thành công tệp "${file.name}" (${parsed.length} câu hỏi qua 3 phần).`,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi đọc file .docx';
      setStatusBanner({
        type: 'ERROR',
        text: `Không thể phân tích file Word: ${message}`,
      });
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Nạp lại đề mẫu có lỗi hoặc tự động sửa nhanh toàn bộ lỗi
  const handleLoadSampleExam = (cleanErrors: boolean) => {
    const cloned: ExamQuestion[] = JSON.parse(
      JSON.stringify(SAMPLE_2025_EXAM_WITH_ERRORS)
    );
    if (cleanErrors) {
      cloned.forEach((q) => {
        if (q.id === 'q-p1-3' && q.options) {
          q.options[1].isUnderline = true;
          q.options[1].isCorrect = true;
        }
        if (q.id === 'q-p1-4' && q.options) {
          q.options[1].isRed = false;
          q.options[1].isCorrect = false;
        }
        if (q.id === 'q-p3-3') {
          q.shortAnswer = '150';
          q.shortAnswerDetectedBy = 'MANUAL';
        }
      });
    }
    const numbered = recalculateQuestionNumbering(cloned, config.resetNumberingPerPart);
    setQuestions(numbered);
    setFileName(
      cleanErrors
        ? 'De_Chuan_THPT_2025_Da_Sua_Sach_Loi.docx'
        : 'De_Mau_THPT_2025_Co_Loi_De_Test.docx'
    );
    setHasUnsavedChanges(false);
    setLastSavedAt(new Date().toLocaleTimeString('vi-VN'));
    setStatusBanner({
      type: 'INFO',
      text: cleanErrors
        ? 'Đã nạp bộ đề chuẩn 2025 sạch lỗi (0 cảnh báo). Giáo viên có thể bấm [Trộn đề] ngay!'
        : 'Đã nạp đề mẫu 2025 kèm 3 lỗi giả lập để giáo viên trải nghiệm tính năng [Sửa ngay] 1 chạm.',
    });
  };

  // ================= HANDLERS: CUỘN TỚI CÂU LỖI & SỬA TRỰC TIẾP =================
  const handleScrollToQuestion = (questionId: string) => {
    setActiveRightTab('LIVE_EDITOR');
    setFilterPart('ALL');
    setHighlightedQuestionId(questionId);

    setTimeout(() => {
      const el = questionRefs.current[questionId];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 80);

    setTimeout(() => {
      setHighlightedQuestionId((prev) => (prev === questionId ? null : prev));
    }, 3500);
  };

  // Sửa thân câu dẫn
  const handleUpdateStemText = (questionId: string, newStem: string) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === questionId ? { ...q, stemText: newStem } : q))
    );
    setHasUnsavedChanges(true);
  };

  // Thao tác 1 chạm Phần I: Click nút tròn A, B, C, D để chọn đáp án đúng duy nhất
  const handleSelectSingleCorrectPart1 = (
    questionId: string,
    optionId: string
  ) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== questionId || !q.options) return q;
        const updatedOpts: OptionPart1[] = q.options.map((opt) => {
          const isTarget = opt.id === optionId;
          return {
            ...opt,
            isUnderline: isTarget,
            isRed: isTarget,
            isCorrect: isTarget,
          };
        });
        return {
          ...q,
          options: updatedOpts,
        };
      })
    );
    setHasUnsavedChanges(true);
  };

  // Thanh công cụ nhanh U (Gạch chân) / A (Tô đỏ) trên từng phương án Phần I
  const handleToggleOptionPropertyPart1 = (
    questionId: string,
    optionId: string,
    prop: 'isUnderline' | 'isRed'
  ) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== questionId || !q.options) return q;
        const updatedOpts: OptionPart1[] = q.options.map((opt) => {
          if (opt.id !== optionId) return opt;
          const nextVal = !opt[prop];
          const nextUnderline = prop === 'isUnderline' ? nextVal : opt.isUnderline;
          const nextRed = prop === 'isRed' ? nextVal : opt.isRed;
          return {
            ...opt,
            isUnderline: nextUnderline,
            isRed: nextRed,
            isCorrect: nextUnderline || nextRed,
          };
        });
        return { ...q, options: updatedOpts };
      })
    );
    setHasUnsavedChanges(true);
  };

  // Sửa nội dung phương án Phần I (tự động tính lại Auto-Layout)
  const handleUpdateOptionTextPart1 = (
    questionId: string,
    optionId: string,
    newText: string
  ) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== questionId || !q.options) return q;
        const updatedOpts = q.options.map((opt) =>
          opt.id === optionId ? { ...opt, text: newText } : opt
        );
        return {
          ...q,
          options: updatedOpts,
          computedLayout: computeAutoLayoutForOptions(updatedOpts),
        };
      })
    );
    setHasUnsavedChanges(true);
  };

  // Thao tác 1 chạm Phần II: Click nút gạt [Đ] / [S] cạnh từng ý a, b, c, d
  const handleToggleSubItemPart2 = (
    questionId: string,
    subItemId: string,
    forceValue?: boolean
  ) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== questionId || !q.subItems) return q;
        const updatedSubs: SubItemPart2[] = q.subItems.map((sub) => {
          if (sub.id !== subItemId) return sub;
          const nextTrue =
            typeof forceValue === 'boolean' ? forceValue : !sub.isTrue;
          return {
            ...sub,
            isTrue: nextTrue,
            isUnderline: nextTrue,
            isRed: nextTrue,
          };
        });
        return { ...q, subItems: updatedSubs };
      })
    );
    setHasUnsavedChanges(true);
  };

  // Sửa nội dung ý a, b, c, d ở Phần II
  const handleUpdateSubItemTextPart2 = (
    questionId: string,
    subItemId: string,
    newText: string
  ) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== questionId || !q.subItems) return q;
        return {
          ...q,
          subItems: q.subItems.map((sub) =>
            sub.id === subItemId ? { ...sub, text: newText } : sub
          ),
        };
      })
    );
    setHasUnsavedChanges(true);
  };

  // Sửa đáp số Phần III
  const handleUpdateShortAnswerPart3 = (questionId: string, val: string) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId
          ? {
              ...q,
              shortAnswer: val,
              shortAnswerDetectedBy: val.trim() ? 'MANUAL' : 'NONE',
            }
          : q
      )
    );
    setHasUnsavedChanges(true);
  };

  // Bấm [Lưu chỉnh sửa]: Chạy lại bộ Parser/Numbering, xóa trạng thái unsaved và mở khóa [Trộn đề]
  const handleSaveEdits = () => {
    const recalculated = recalculateQuestionNumbering(
      questions,
      config.resetNumberingPerPart
    );
    setQuestions(recalculated);
    setHasUnsavedChanges(false);
    setLastSavedAt(new Date().toLocaleTimeString('vi-VN'));

    const remainingErrors = validateExamQuestions(recalculated).filter(
      (i) => i.severity === 'ERROR'
    );
    if (remainingErrors.length === 0) {
      setStatusBanner({
        type: 'SUCCESS',
        text: 'Đã lưu chỉnh sửa & cập nhật cây dữ liệu AST! Tất cả lỗi đã được xử lý, nút [Trộn đề] đã mở khóa.',
      });
    } else {
      setStatusBanner({
        type: 'INFO',
        text: `Đã lưu chỉnh sửa! Hiện còn ${remainingErrors.length} lỗi cần hoàn thiện trước khi trộn đề.`,
      });
    }
  };

  // Tự động sửa nhanh toàn bộ lỗi bằng 1 cú click (Quick-Fix All)
  const handleQuickFixAllErrors = () => {
    const fixed = questions.map((q) => {
      if (q.part === 'PART_1' && q.options) {
        const corrects = q.options.filter((o) => o.isCorrect);
        if (corrects.length === 0 || corrects.length > 1) {
          const targetIdx = corrects.length > 1 ? q.options.findIndex((o) => o.isCorrect) : 1;
          return {
            ...q,
            options: q.options.map((o, idx) => ({
              ...o,
              isUnderline: idx === targetIdx,
              isRed: idx === targetIdx,
              isCorrect: idx === targetIdx,
            })),
          };
        }
      }
      if (q.part === 'PART_3' && !(q.shortAnswer || '').trim()) {
        return {
          ...q,
          shortAnswer: '150',
          shortAnswerDetectedBy: 'MANUAL' as const,
        };
      }
      return q;
    });

    const recalculated = recalculateQuestionNumbering(
      fixed,
      config.resetNumberingPerPart
    );
    setQuestions(recalculated);
    setHasUnsavedChanges(false);
    setLastSavedAt(new Date().toLocaleTimeString('vi-VN'));
    setStatusBanner({
      type: 'SUCCESS',
      text: 'Đã tự động chuẩn hóa toàn bộ câu lỗi & Lưu chỉnh sửa! Nút [Trộn đề] đã sẵn sàng.',
    });
  };

  // Thay đổi tùy chọn "Đánh số lại từ Câu 1 ở mỗi phần"
  const handleToggleResetNumbering = (resetPerPart: boolean) => {
    setConfig((prev) => ({ ...prev, resetNumberingPerPart: resetPerPart }));
    setQuestions((prev) => recalculateQuestionNumbering(prev, resetPerPart));
  };

  // ================= HANDLERS: TRỘN ĐỀ & XUẤT FILE WORD / BẢNG ĐÁP ÁN CHUNG / QR =================
  const handleRunShuffle = async () => {
    if (errorIssues.length > 0) {
      setStatusBanner({
        type: 'ERROR',
        text: `Vui lòng sửa ${errorIssues.length} lỗi định dạng bên cột trái trước khi trộn đề.`,
      });
      return;
    }
    if (hasUnsavedChanges) {
      handleSaveEdits();
    }

    setIsProcessing(true);
    try {
      const variants = await generateShuffledVariants(questions, config);
      setShuffledVariants(variants);
      if (variants.length > 0) {
        setSelectedVariantCode(variants[0].examCode);
      }
      setActiveRightTab('SHUFFLED_PREVIEW');
      setStatusBanner({
        type: 'SUCCESS',
        text: `Đã trộn thành công ${variants.length} mã đề (Times New Roman 12pt, có đánh số trang & mã đề) kèm Bảng Đáp Án Chung tất cả mã đề!`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi trộn đề';
      setStatusBanner({
        type: 'ERROR',
        text: `Có lỗi xảy ra khi trộn đề: ${msg}`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Tải về file đề gốc đã sửa sạch (.docx)
  const handleDownloadCleanedMaster = async () => {
    setIsProcessing(true);
    try {
      const blob = await exportCleanedMasterDocx(questions, config);
      triggerBrowserDownload(blob, `De_Goc_Da_Sua_Chuan_2025_${Date.now()}.docx`);
      setStatusBanner({
        type: 'SUCCESS',
        text: 'Đã tải về máy tính tệp "Đề gốc đã sửa (.docx)" chuẩn Times New Roman 12pt, canh trái co dãn đều.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Tải File Bảng Đáp Án Chung Tất Cả Mã Đề (.docx) trong 1 khung theo thứ tự từ trên xuống (nộp ngay không cần chỉnh sửa)
  const handleDownloadMasterAnswerSheetDocx = async () => {
    if (shuffledVariants.length === 0) return;
    setIsProcessing(true);
    try {
      const blob = await exportMasterAnswerSheetDocx(shuffledVariants, config);
      triggerBrowserDownload(
        blob,
        `Bang_Dap_An_Chung_${shuffledVariants.length}_Ma_De_${config.subjectName.replace(/\s+/g, '_')}_2025.docx`
      );
      setStatusBanner({
        type: 'SUCCESS',
        text: `Đã xuất File Word "Bảng Đáp Án Chung (${shuffledVariants.length} mã đề)" trong 1 khung từ trên xuống, chuẩn Times New Roman 12pt để nộp ngay!`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Tải trọn bộ đề hoán vị (.zip)
  const handleDownloadZipBundle = async () => {
    if (shuffledVariants.length === 0) return;
    setIsProcessing(true);
    try {
      const blob = await exportAllVariantsZipBundle(
        shuffledVariants,
        questions,
        config
      );
      triggerBrowserDownload(
        blob,
        `Bo_${shuffledVariants.length}_De_Thi_Va_Dap_An_THPT_2025.zip`
      );
      setStatusBanner({
        type: 'SUCCESS',
        text: `Đã đóng gói và tải xuống bộ ${shuffledVariants.length} đề thi (.docx có số trang + mã đề) + Bảng đáp án chung (.docx) + Ảnh QR (.zip).`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Tải bộ mã QR (.zip)
  const handleDownloadQrZip = async () => {
    if (shuffledVariants.length === 0) return;
    setIsProcessing(true);
    try {
      const blob = await exportQrCodesZip(shuffledVariants, config);
      triggerBrowserDownload(
        blob,
        `Ma_QR_Cham_Thi_${config.qrFormat}_${shuffledVariants.length}_De.zip`
      );
      setStatusBanner({
        type: 'SUCCESS',
        text: `Đã tải xuống bộ mã QR định dạng ${config.qrFormat} cho ${shuffledVariants.length} mã đề.`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Tải 1 mã đề Word cụ thể
  const handleDownloadSingleVariantDocx = async (variant: ShuffledVariant) => {
    setIsProcessing(true);
    try {
      const blob = await exportSingleVariantDocx(variant, config);
      triggerBrowserDownload(blob, `De_Thi_Ma_${variant.examCode}_2025.docx`);
    } finally {
      setIsProcessing(false);
    }
  };

  const activeVariant =
    shuffledVariants.find((v) => v.examCode === selectedVariantCode) ||
    shuffledVariants[0];

  const filteredQuestions =
    filterPart === 'ALL'
      ? questions
      : questions.filter((q) => q.part === filterPart);

  const variantColorClasses = [
    'btn-3d-primary',
    'btn-3d-emerald',
    'btn-3d-purple',
    'btn-3d-rose',
    'btn-3d-orange',
    'btn-3d-cyan',
    'btn-3d-indigo',
    'btn-3d-amber',
  ];

  // Helper render Khung Đáp Án 3 Cột giống hệt hình mẫu đính kèm (dùng chung cho từng mã đề và Bảng đáp án chung)
  const renderThreeColumnAnswerCard = (variant: ShuffledVariant) => (
    <div
      key={`ans-card-${variant.examCode}`}
      className="p-5 rounded-3xl bg-white border-2 border-sky-200 shadow-md space-y-4"
    >
      {/* Thanh tiêu đề Mã đề của khối đáp án */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-sky-100 via-blue-50 to-emerald-50 border border-sky-300">
        <div className="flex items-center gap-2.5">
          <span className="px-3.5 py-1 rounded-xl text-xs font-black text-white btn-3d-primary font-mono">
            MÃ ĐỀ: {variant.examCode}
          </span>
          <span
            style={{ fontFamily: "'Times New Roman', Times, serif" }}
            className="text-base font-bold text-slate-900"
          >
            {config.examTitle} — Môn: {config.subjectName} ({config.durationMinutes} phút)
          </span>
        </div>
        <button
          onClick={() => handleDownloadSingleVariantDocx(variant)}
          className="px-3 py-1.5 rounded-xl text-xs font-extrabold text-white btn-3d-emerald flex items-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Tải Đề {variant.examCode} (.docx)</span>
        </button>
      </div>

      {/* 3 Khung Màu: Phần I (Xanh dương) - Phần II (Xanh lá) - Phần III (Vàng cam) y hệt hình mẫu */}
      <div
        style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: '12pt' }}
        className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch"
      >
        {/* KHUNG 1: PHẦN I (4 lựa chọn) */}
        <div className="p-4 rounded-3xl bg-[#F4F8FF] border-2 border-[#BFDBFE] shadow-xs flex flex-col">
          <div className="pb-2.5 mb-3 border-b-2 border-[#BFDBFE]">
            <h4 className="font-bold text-[#1E293B] text-base tracking-tight">
              PHẦN I (4 lựa chọn)
            </h4>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {variant.answerKey.part1.map((item) => (
              <div
                key={item.questionNumber}
                className="px-3 py-1.5 bg-white rounded-xl border border-[#BFDBFE] shadow-2xs flex items-center justify-between font-mono text-sm"
              >
                <span className="font-bold text-[#1E293B]">
                  {item.questionNumber}.
                </span>
                <span className="font-extrabold text-[#E11D48]">
                  {item.answer}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* KHUNG 2: PHẦN II (Đúng / Sai) */}
        <div className="p-4 rounded-3xl bg-[#F0FDF7] border-2 border-[#86EFAC] shadow-xs flex flex-col">
          <div className="pb-2.5 mb-3 border-b-2 border-[#86EFAC]">
            <h4 className="font-bold text-[#064E3B] text-base tracking-tight">
              PHẦN II (Đúng / Sai)
            </h4>
          </div>
          <div className="space-y-2.5">
            {variant.answerKey.part2.map((item) => (
              <div
                key={item.questionNumber}
                className="px-4 py-2 bg-white rounded-xl border border-[#86EFAC] shadow-2xs flex items-center justify-between font-mono text-sm"
              >
                <span className="font-bold text-[#1E293B]">
                  Câu {item.questionNumber}:
                </span>
                <span className="font-extrabold text-[#047857] tracking-wide">
                  {item.dsString} ({item.tfString})
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* KHUNG 3: PHẦN III (Trả lời ngắn) */}
        <div className="p-4 rounded-3xl bg-[#FFFDF2] border-2 border-[#FDE047] shadow-xs flex flex-col">
          <div className="pb-2.5 mb-3 border-b-2 border-[#FDE047]">
            <h4 className="font-bold text-[#451A03] text-base tracking-tight">
              PHẦN III (Trả lời ngắn)
            </h4>
          </div>
          <div className="space-y-2.5">
            {variant.answerKey.part3.map((item) => (
              <div
                key={item.questionNumber}
                className="px-4 py-2 bg-white rounded-xl border border-[#FDE047] shadow-2xs flex items-center justify-between font-mono text-sm"
              >
                <span className="font-bold text-[#1E293B]">
                  Câu {item.questionNumber}:
                </span>
                <span className="font-extrabold text-[#E11D48]">
                  {item.answer}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col text-slate-900">
      {/* ================= HEADER NỔI 3D: LOGO ĐẸP MẮT + CHỮ EDUMIX 2025 ĐỔI MÀU + TÁC GIẢ DƯỚI LOGO ================= */}
      <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-4 px-6 py-3 bg-white/95 backdrop-blur-md border-b-2 border-sky-300 shadow-lg">
        {/* Zone 1: Logo 3D bắt mắt + Dòng chữ EduMix 2025 chạy đổi màu + Tác giả Hồ Tấn Khải dưới logo */}
        <a
          href="#top"
          className="flex flex-col items-start shrink-0 group focus:outline-none"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl logo-3d-badge flex items-center justify-center text-white shrink-0 transition-transform group-hover:scale-105">
              <GraduationCap className="w-6 h-6 drop-shadow" />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl sm:text-3xl font-black tracking-tight animate-edumix-gradient whitespace-nowrap">
                EduMix 2025
              </span>
              <span className="text-[11px] sm:text-xs font-extrabold text-sky-900 tracking-wide whitespace-nowrap">
                Tác giả: Hồ Tấn Khải — Trường THPT Mang Thít
              </span>
            </div>
          </div>
        </a>

        {/* Zone 2: Thanh công cụ điều hướng 3D nhiều màu sắc khác nhau có đổ bóng */}
        <nav className="hidden xl:flex items-center gap-2.5">
          <button
            onClick={() => setActiveRightTab('LIVE_EDITOR')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeRightTab === 'LIVE_EDITOR'
                ? 'btn-3d-primary ring-2 ring-blue-300'
                : 'btn-3d-cyan'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Trình Biên Tập Đề Gốc</span>
          </button>

          <button
            onClick={() => {
              if (shuffledVariants.length > 0) {
                setActiveRightTab('SHUFFLED_PREVIEW');
              } else {
                handleRunShuffle();
              }
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeRightTab === 'SHUFFLED_PREVIEW'
                ? 'btn-3d-rose ring-2 ring-rose-300'
                : 'btn-3d-orange'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>Bảng Đáp Án Chung & Mã QR</span>
          </button>

          <button
            onClick={handleDownloadCleanedMaster}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-white btn-3d-emerald flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>Tải Đề Gốc Đã Sửa (.docx)</span>
          </button>

          <button
            onClick={() => handleLoadSampleExam(false)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-white btn-3d-indigo flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-4 h-4" />
            <span>Nạp Đề Mẫu 2025</span>
          </button>
        </nav>

        {/* Zone 3: Nút Hướng dẫn sử dụng 3D màu Tím Hoàng Gia đổ bóng nổi bật */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setIsGuideOpen(true)}
            className="px-4 py-2.5 rounded-xl text-xs font-extrabold text-white btn-3d-purple flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <BookOpen className="w-4 h-4" />
            <span>Hướng Dẫn Sử Dụng ({featureRegistry.length})</span>
          </button>
        </div>
      </header>

      {/* Status Notification Bar */}
      {statusBanner && (
        <div
          className={`px-6 py-2.5 border-b-2 text-xs font-bold flex items-center justify-between gap-4 shadow-sm ${
            statusBanner.type === 'SUCCESS'
              ? 'bg-emerald-100/95 border-emerald-400 text-emerald-950'
              : statusBanner.type === 'ERROR'
              ? 'bg-rose-100/95 border-rose-400 text-rose-950'
              : 'bg-sky-100/95 border-sky-400 text-sky-950'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusBanner.type === 'SUCCESS' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            )}
            <span>{statusBanner.text}</span>
          </div>
          <button
            onClick={() => setStatusBanner(null)}
            className="px-2.5 py-1 rounded-lg bg-white/80 hover:bg-white text-slate-800 text-xs font-bold shadow-xs shrink-0"
          >
            Đóng
          </button>
        </div>
      )}

      {/* ================= MAIN WORKSPACE (NỀN XANH NHẠT MÁT MẺ + CÁC PANEL 3D ĐỔ BÓNG) ================= */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ================= CỘT TRÁI: BẢNG ĐIỀU KHIỂN TÁC VỤ 3D (4 CỘT GRID) ================= */}
        <aside className="lg:col-span-4 space-y-5">
          {/* 1. Khung Upload File Gốc (.docx) & Thông tin nhận diện */}
          <section className="p-5 rounded-2xl card-3d-panel space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-sky-950 flex items-center gap-2">
                <FileCode2 className="w-4 h-4 text-blue-600" />
                <span>1. Tiếp Nhận Đề Gốc (.docx)</span>
              </h2>
              <span className="text-xs text-sky-700 font-mono font-bold">
                Times New Roman 12pt
              </span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".docx"
              onChange={handleFileUpload}
              className="hidden"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-extrabold text-white btn-3d-primary flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <Upload className="w-4 h-4 shrink-0" />
                <span>Tải File Gốc (.docx)</span>
              </button>

              <button
                onClick={() => handleLoadSampleExam(true)}
                className="w-full py-2.5 px-3 rounded-xl text-xs font-extrabold text-white btn-3d-cyan flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>Nạp Đề Chuẩn Sạch</span>
              </button>
            </div>

            {/* Khung thông tin: Tên file, Số phần, Số lượng câu hỏi nhận diện được */}
            <div className="p-3.5 rounded-xl bg-sky-50/90 border border-sky-200 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-600 font-semibold">Tệp đang mở:</span>
                <span
                  className="font-mono font-bold text-blue-900 truncate max-w-[200px]"
                  title={fileName}
                >
                  {fileName}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <span className="font-semibold">Cấu trúc nhận diện:</span>
                <span className="font-mono font-extrabold text-emerald-800 tabular-nums">
                  {activePartsCount} phần · Tổng {questions.length} câu
                </span>
              </div>
              <div className="pt-1 border-t border-sky-200/70 flex items-center justify-between text-xs text-sky-900 font-mono font-bold tabular-nums">
                <span>Phần I: {part1Count} câu</span>
                <span>·</span>
                <span>Phần II: {part2Count} câu</span>
                <span>·</span>
                <span>Phần III: {part3Count} câu</span>
              </div>
            </div>
          </section>

          {/* 2. KHUNG MỚI: Ghi Thông Tin Đề Thi, Môn Thi, Kỳ Thi, Tiêu Đề Quốc Ngữ & Số Phút */}
          <section className="p-5 rounded-2xl card-3d-panel space-y-3.5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-sky-950 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-600" />
                <span>2. Thông Tin Đề Thi & Tiêu Đề Quốc Ngữ</span>
              </h2>
              <span className="text-xs font-mono font-bold text-indigo-700">
                Header & Footer
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="space-y-1">
                <label className="block font-bold text-slate-700">
                  Cơ quan chủ quản (Sở/Phòng GD):
                </label>
                <input
                  type="text"
                  value={config.departmentName}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, departmentName: e.target.value }))
                  }
                  className="w-full px-2.5 py-1.5 font-semibold bg-white border-2 border-sky-200 rounded-xl focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-700">
                  Tên Trường / Đơn vị ra đề:
                </label>
                <input
                  type="text"
                  value={config.schoolName}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, schoolName: e.target.value }))
                  }
                  className="w-full px-2.5 py-1.5 font-semibold bg-white border-2 border-sky-200 rounded-xl focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-700">
                  Tiêu đề Quốc hiệu:
                </label>
                <input
                  type="text"
                  value={config.nationalHeader}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, nationalHeader: e.target.value }))
                  }
                  className="w-full px-2.5 py-1.5 font-semibold bg-white border-2 border-sky-200 rounded-xl focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-700">
                  Tiêu ngữ:
                </label>
                <input
                  type="text"
                  value={config.nationalMotto}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, nationalMotto: e.target.value }))
                  }
                  className="w-full px-2.5 py-1.5 font-semibold bg-white border-2 border-sky-200 rounded-xl focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label className="block font-bold text-slate-700">
                  Tên Kỳ thi / Đề kiểm tra:
                </label>
                <input
                  type="text"
                  value={config.examTitle}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, examTitle: e.target.value }))
                  }
                  className="w-full px-2.5 py-1.5 font-bold text-blue-950 bg-white border-2 border-sky-200 rounded-xl focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-700">
                  Môn thi:
                </label>
                <input
                  type="text"
                  value={config.subjectName}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, subjectName: e.target.value }))
                  }
                  className="w-full px-2.5 py-1.5 font-bold text-emerald-900 bg-white border-2 border-sky-200 rounded-xl focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">
                    Số phút:
                  </label>
                  <input
                    type="number"
                    min={15}
                    max={300}
                    value={config.durationMinutes}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        durationMinutes: Number(e.target.value) || 90,
                      }))
                    }
                    className="w-full px-2.5 py-1.5 font-mono font-bold text-rose-700 bg-white border-2 border-sky-200 rounded-xl focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-700">
                    Năm học:
                  </label>
                  <input
                    type="text"
                    value={config.schoolYear}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, schoolYear: e.target.value }))
                    }
                    className="w-full px-2 py-1.5 font-semibold bg-white border-2 border-sky-200 rounded-xl focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* 3. Bảng cảnh báo lỗi thông minh (Validator) kèm nút 3D [Sửa ngay] */}
          <section className="p-5 rounded-2xl card-3d-panel space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-extrabold text-sky-950 flex items-center gap-2">
                <AlertTriangle
                  className={`w-4 h-4 ${
                    validationIssues.length > 0
                      ? 'text-rose-600'
                      : 'text-emerald-600'
                  }`}
                />
                <span>3. Kiểm Tra Lỗi Định Dạng ({validationIssues.length})</span>
              </h2>
              {validationIssues.length > 0 && (
                <button
                  onClick={handleQuickFixAllErrors}
                  className="px-3 py-1.5 rounded-lg text-xs font-extrabold text-white btn-3d-rose flex items-center gap-1 whitespace-nowrap shrink-0"
                  title="Tự động điền đáp án chuẩn cho các câu lỗi để test nhanh"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Sửa tất cả</span>
                </button>
              )}
            </div>

            {validationIssues.length === 0 ? (
              <div className="p-3.5 rounded-xl bg-emerald-50 border-2 border-emerald-300 flex items-start gap-2.5 text-xs text-emerald-950 shadow-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-extrabold">
                    Đề gốc đã đạt chuẩn cấu trúc 2025!
                  </p>
                  <p className="text-emerald-800">
                    Đầy đủ đáp án Phần I, 4 lệnh hỏi Đúng/Sai Phần II và đáp số Phần III.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {validationIssues.map((issue) => (
                  <div
                    key={issue.id}
                    className="p-3 rounded-xl bg-amber-50/90 border-2 border-amber-300 flex flex-col gap-2 shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900 leading-snug">
                        {issue.message}
                      </span>
                      <button
                        onClick={() => handleScrollToQuestion(issue.questionId)}
                        className="px-3 py-1.5 rounded-lg text-xs font-extrabold text-white btn-3d-orange whitespace-nowrap shrink-0"
                      >
                        Sửa ngay
                      </button>
                    </div>
                    <span className="text-[11px] font-medium text-slate-700">
                      Gợi ý: {issue.suggestion}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 4. Khung Tùy Chọn Trộn Đề, Chia Cột Tự Động & Đánh Số Lại */}
          <section className="p-5 rounded-2xl card-3d-panel space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-sky-950 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-purple-600" />
                <span>4. Tùy Chọn Hoán Vị & Dàn Trang</span>
              </h2>
              <span className="text-xs text-purple-700 font-mono font-bold">
                Fisher-Yates
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Số lượng mã đề
                </label>
                <select
                  value={config.numVariants}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      numVariants: Number(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 text-xs font-bold font-mono bg-sky-50/80 border-2 border-sky-300 rounded-xl focus:outline-none focus:border-blue-600"
                >
                  <option value={4}>4 mã đề</option>
                  <option value={8}>8 mã đề</option>
                  <option value={12}>12 mã đề</option>
                  <option value={24}>24 mã đề</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Kiểu mã đề
                </label>
                <select
                  value={config.examCodeDigits}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      examCodeDigits: Number(e.target.value) as 3 | 4,
                    }))
                  }
                  className="w-full px-3 py-2 text-xs font-bold font-mono bg-sky-50/80 border-2 border-sky-300 rounded-xl focus:outline-none focus:border-blue-600"
                >
                  <option value={3}>3 chữ số (101, 102...)</option>
                  <option value={4}>4 chữ số (1001, 1002...)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Canh trái & Co dãn cột đáp án Phần I (Times New Roman 12pt)
              </label>
              <select
                value={config.layoutOverride}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    layoutOverride: e.target.value as LayoutMode,
                  }))
                }
                className="w-full px-3 py-2 text-xs font-bold bg-sky-50/80 border-2 border-sky-300 rounded-xl focus:outline-none focus:border-blue-600"
              >
                <option value="AUTO">
                  Tự động co dãn (&lt;15kt: 4 cột · 15-35kt: 2 cột · &gt;35kt: 1 cột)
                </option>
                <option value="1_ROW_4_COL">Luôn chia 4 cột ngang (1 dòng)</option>
                <option value="2_ROW_2_COL">Luôn chia 2 cột × 2 hàng (2 dòng)</option>
                <option value="4_ROW_1_COL">Luôn xếp 1 cột dọc (4 dòng)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Chuẩn mã hóa QR Chấm thi trên điện thoại
              </label>
              <select
                value={config.qrFormat}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    qrFormat: e.target.value as QRAppFormat,
                  }))
                }
                className="w-full px-3 py-2 text-xs font-bold bg-sky-50/80 border-2 border-sky-300 rounded-xl focus:outline-none focus:border-blue-600"
              >
                <option value="QM2025">QM2025 (Chuẩn THPT 2025 - 3 Phần)</option>
                <option value="TNMAKER">TNMaker (P1, P2: TFTT, P3: Số)</option>
                <option value="AZOTA">Azota 2025 (P1, P2: ĐSĐĐ, P3: Số)</option>
                <option value="STANDARD_2025">Standard Payload 2025</option>
              </select>
            </div>

            <div className="pt-2 border-t border-sky-200 space-y-2.5 text-xs">
              <label className="flex items-center justify-between gap-2 cursor-pointer">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <ListRestart className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Đánh số lại từ Câu 1 ở mỗi phần (Chuẩn 2025)</span>
                </span>
                <input
                  type="checkbox"
                  checked={config.resetNumberingPerPart}
                  onChange={(e) => handleToggleResetNumbering(e.target.checked)}
                  className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between gap-2 cursor-pointer">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <QrCode className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Chèn mã QR & Đánh số trang + Mã đề ở Footer Word</span>
                </span>
                <input
                  type="checkbox"
                  checked={config.embedQrInWord}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      embedQrInWord: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                />
              </label>
            </div>
          </section>

          {/* 5. Nhóm nút bấm 3D Đa Sắc Màu: [Trộn đề], [Tải Bảng Đáp Án Chung (.docx)], [Tải bộ đề (.zip)], [Tải mã QR] */}
          <section className="p-5 rounded-2xl card-3d-panel space-y-3">
            <h2 className="text-sm font-extrabold text-sky-950">
              5. Thực Thi Trộn Đề & Xuất Bản Bộ Đề 3D
            </h2>

            {!canShuffle && (
              <p className="text-xs font-semibold text-amber-950 bg-amber-100/90 border-2 border-amber-300 rounded-xl p-2.5">
                {errorIssues.length > 0
                  ? `Đang khóa nút [Trộn đề]: Còn ${errorIssues.length} lỗi định dạng cần sửa hoặc bấm [Sửa tất cả].`
                  : 'Bạn vừa chỉnh sửa nội dung. Hãy bấm nút [Lưu chỉnh sửa] trên thanh công cụ để mở khóa nút [Trộn đề].'}
              </p>
            )}

            <button
              onClick={handleRunShuffle}
              disabled={!canShuffle || isProcessing}
              className="w-full py-3.5 px-4 rounded-xl text-sm font-black text-white btn-3d-primary flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Shuffle className="w-4 h-4 shrink-0" />
              <span>
                Trộn Đề Ngay ({config.numVariants} Mã Đề Chuẩn 2025)
              </span>
            </button>

            <button
              onClick={handleDownloadMasterAnswerSheetDocx}
              disabled={shuffledVariants.length === 0 || isProcessing}
              className="w-full py-3 px-4 rounded-xl text-xs font-black text-white btn-3d-purple flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              <span>
                Tải Bảng Đáp Án Chung Tất Cả Mã Đề (.docx)
              </span>
            </button>

            <div className="grid grid-cols-2 gap-3 pt-0.5">
              <button
                onClick={handleDownloadZipBundle}
                disabled={shuffledVariants.length === 0 || isProcessing}
                className="py-3 px-3 rounded-xl text-xs font-extrabold text-white btn-3d-emerald flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <FileArchive className="w-4 h-4 shrink-0" />
                <span>Tải Bộ Đề (.zip)</span>
              </button>

              <button
                onClick={handleDownloadQrZip}
                disabled={shuffledVariants.length === 0 || isProcessing}
                className="py-3 px-3 rounded-xl text-xs font-extrabold text-white btn-3d-rose flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <QrCode className="w-4 h-4 shrink-0" />
                <span>Tải Mã QR (.zip)</span>
              </button>
            </div>
          </section>
        </aside>

        {/* ================= CỘT PHẢI: KHUNG TƯƠNG TÁC, THANH CÔNG CỤ NỔI 3D & XEM TRƯỚC (8 CỘT GRID) ================= */}
        <section className="lg:col-span-8 space-y-4">
          {/* Thanh công cụ 3D nổi (3D Floating Toolbar) với các nút bấm nhiều màu sắc khác nhau & đổ bóng */}
          <div className="p-4 rounded-2xl toolbar-3d flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                onClick={() => setActiveRightTab('LIVE_EDITOR')}
                className={`px-4 py-2.5 rounded-xl text-xs font-extrabold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  activeRightTab === 'LIVE_EDITOR'
                    ? 'btn-3d-primary ring-2 ring-blue-300'
                    : 'btn-3d-indigo'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Trình Biên Tập Trực Tiếp ({questions.length} câu)</span>
              </button>

              <button
                onClick={() => setActiveRightTab('SHUFFLED_PREVIEW')}
                className={`px-4 py-2.5 rounded-xl text-xs font-extrabold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  activeRightTab === 'SHUFFLED_PREVIEW'
                    ? 'btn-3d-rose ring-2 ring-rose-300'
                    : 'btn-3d-purple'
                }`}
              >
                <QrCode className="w-4 h-4" />
                <span>
                  Bảng Đáp Án Chung & Mã QR ({shuffledVariants.length} đề)
                </span>
              </button>
            </div>

            {/* Nhóm nút 3D Lưu chỉnh sửa & Tải về file đề đã sửa (.docx) */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="hidden sm:inline-block text-xs text-sky-900 font-mono font-bold bg-sky-100 px-2.5 py-1 rounded-lg border border-sky-300">
                {hasUnsavedChanges
                  ? '● Chưa lưu thay đổi'
                  : `Đã lưu: ${lastSavedAt}`}
              </span>

              <button
                onClick={handleSaveEdits}
                className={`px-4 py-2.5 rounded-xl text-xs font-extrabold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  hasUnsavedChanges ? 'btn-3d-orange' : 'btn-3d-emerald'
                }`}
              >
                <Save className="w-4 h-4" />
                <span>Lưu Chỉnh Sửa</span>
              </button>

              <button
                onClick={handleDownloadCleanedMaster}
                className="px-4 py-2.5 rounded-xl text-xs font-extrabold text-white btn-3d-cyan flex items-center gap-1.5 whitespace-nowrap shrink-0"
                title="Tải về file đề đã sửa (.docx) để lưu bản đề sạch vào máy tính"
              >
                <Download className="w-4 h-4" />
                <span>Tải Đề Đã Sửa (.docx)</span>
              </button>
            </div>
          </div>

          {/* ================= TAB 1: CHẾ ĐỘ XEM TRƯỚC & CHỈNH SỬA TRỰC TIẾP (LIVE IN-APP EDITOR) ================= */}
          {activeRightTab === 'LIVE_EDITOR' && (
            <div className="space-y-4">
              {/* Thanh công cụ lọc Phần I / Phần II / Phần III thiết kế 3D đa sắc màu */}
              <div className="px-4 py-3.5 rounded-2xl toolbar-3d flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <button
                    onClick={() => setFilterPart('ALL')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-extrabold text-white whitespace-nowrap ${
                      filterPart === 'ALL'
                        ? 'btn-3d-indigo ring-2 ring-indigo-300'
                        : 'btn-3d-cyan'
                    }`}
                  >
                    Tất cả ({questions.length})
                  </button>
                  <button
                    onClick={() => setFilterPart('PART_1')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-extrabold text-white whitespace-nowrap ${
                      filterPart === 'PART_1'
                        ? 'btn-3d-primary ring-2 ring-blue-300'
                        : 'btn-3d-primary opacity-90'
                    }`}
                  >
                    Phần I: 4 Lựa Chọn ({part1Count})
                  </button>
                  <button
                    onClick={() => setFilterPart('PART_2')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-extrabold text-white whitespace-nowrap ${
                      filterPart === 'PART_2'
                        ? 'btn-3d-emerald ring-2 ring-emerald-300'
                        : 'btn-3d-emerald opacity-90'
                    }`}
                  >
                    Phần II: Đúng / Sai ({part2Count})
                  </button>
                  <button
                    onClick={() => setFilterPart('PART_3')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-extrabold text-white whitespace-nowrap ${
                      filterPart === 'PART_3'
                        ? 'btn-3d-orange ring-2 ring-orange-300'
                        : 'btn-3d-amber'
                    }`}
                  >
                    Phần III: Trả Lời Ngắn ({part3Count})
                  </button>
                </div>

                <div className="flex items-center gap-2.5 text-xs font-bold text-slate-700">
                  <span className="flex items-center gap-1">
                    <Underline className="w-3.5 h-3.5 text-blue-600" />
                    <span>Gạch chân</span>
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Palette className="w-3.5 h-3.5 text-rose-600" />
                    <span>Tô đỏ</span>
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Bold className="w-3.5 h-3.5 text-purple-700" />
                    <span>Times New Roman 12pt</span>
                  </span>
                </div>
              </div>

              {/* Danh sách câu hỏi trực quan trên các khung thẻ 3D */}
              <div className="space-y-4">
                {filteredQuestions.map((q, idx) => {
                  const prevQ = idx > 0 ? filteredQuestions[idx - 1] : null;
                  const showPartHeader = !prevQ || prevQ.part !== q.part;
                  const questionIssues = validationIssues.filter(
                    (iss) => iss.questionId === q.id
                  );
                  const isHighlighted = highlightedQuestionId === q.id;

                  const effectiveLayout =
                    config.layoutOverride === 'AUTO'
                      ? q.computedLayout || '4_ROW_1_COL'
                      : config.layoutOverride;

                  return (
                    <React.Fragment key={q.id}>
                      {showPartHeader && (
                        <div
                          className={`px-5 py-3.5 text-white rounded-2xl flex items-center justify-between shadow-lg ${
                            q.part === 'PART_1'
                              ? 'bg-gradient-to-r from-blue-700 via-indigo-700 to-cyan-600'
                              : q.part === 'PART_2'
                              ? 'bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-700'
                              : 'bg-gradient-to-r from-orange-600 via-amber-600 to-rose-600'
                          }`}
                        >
                          <div>
                            <h3 className="text-sm font-black tracking-wide uppercase">
                              {q.part === 'PART_1' &&
                                'PHẦN I. Trắc nghiệm nhiều phương án lựa chọn (A, B, C, D)'}
                              {q.part === 'PART_2' &&
                                'PHẦN II. Trắc nghiệm Đúng / Sai (4 ý a, b, c, d mỗi câu)'}
                              {q.part === 'PART_3' &&
                                'PHẦN III. Trắc nghiệm Trả lời ngắn (Điền đáp số)'}
                            </h3>
                            <p className="text-xs text-white/90 font-medium">
                              {config.resetNumberingPerPart
                                ? 'Đang bật chế độ: Đánh số lại từ Câu 1 ở đầu mỗi phần · Times New Roman 12pt · Canh trái tự động co dãn'
                                : 'Đang bật chế độ: Đánh số câu liên tục từ đầu đến cuối đề'}
                            </p>
                          </div>
                          <span className="text-xs font-mono font-bold bg-black/20 px-2.5 py-1 rounded-lg">
                            Reset Index = {config.resetNumberingPerPart ? 'ON' : 'OFF'}
                          </span>
                        </div>
                      )}

                      <div
                        ref={(el) => {
                          questionRefs.current[q.id] = el;
                        }}
                        className={`p-5 rounded-2xl transition-all ${
                          isHighlighted
                            ? 'bg-amber-50 border-2 border-amber-500 ring-4 ring-amber-300 shadow-xl'
                            : questionIssues.length > 0
                            ? 'bg-rose-50/95 border-2 border-rose-400 shadow-md'
                            : 'card-3d-panel'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-sky-200">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-black font-mono shadow-xs">
                              Câu {q.displayIndex}
                            </span>
                            <span className="text-xs font-bold text-slate-600">
                              {q.part === 'PART_1'
                                ? 'Phần I'
                                : q.part === 'PART_2'
                                ? 'Phần II'
                                : 'Phần III'}{' '}
                              · Gốc #{q.originalIndex}
                            </span>
                            {q.part === 'PART_1' && (
                              <span className="text-xs text-sky-800 font-mono font-semibold">
                                · Canh trái co dãn:{' '}
                                {effectiveLayout === '1_ROW_4_COL'
                                  ? '1 dòng (4 cột ngang 25%)'
                                  : effectiveLayout === '2_ROW_2_COL'
                                  ? '2 dòng (2 cột × 2 hàng 50%)'
                                  : '4 dòng (1 cột dọc 100%)'}
                              </span>
                            )}
                          </div>

                          {questionIssues.length > 0 ? (
                            <div className="flex items-center gap-1.5 text-xs font-extrabold text-rose-700">
                              <AlertTriangle className="w-4 h-4 shrink-0" />
                              <span>{questionIssues[0].message}</span>
                            </div>
                          ) : (
                            <span className="text-xs font-extrabold text-emerald-700 flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Đạt chuẩn 2025</span>
                            </span>
                          )}
                        </div>

                        {/* Ô biên tập trực tiếp thân câu hỏi (Times New Roman 12pt, canh trái) */}
                        <div className="mb-4">
                          <label className="block text-[11px] font-bold text-sky-900 mb-1">
                            Nội dung câu dẫn (Times New Roman 12pt — Canh trái tự động co dãn):
                          </label>
                          <textarea
                            rows={2}
                            value={q.stemText}
                            onChange={(e) =>
                              handleUpdateStemText(q.id, e.target.value)
                            }
                            style={{
                              fontFamily: "'Times New Roman', Times, serif",
                              fontSize: '12pt',
                            }}
                            className="w-full px-3.5 py-2 text-left text-slate-900 bg-white border-2 border-sky-200 rounded-xl focus:outline-none focus:border-blue-600 leading-relaxed shadow-inner"
                          />
                        </div>

                        {/* ================= NỘI DUNG PHẦN I: 4 PHƯƠNG ÁN A, B, C, D ================= */}
                        {q.part === 'PART_1' && q.options && (
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
                              <span>
                                Click nút 3D <strong>A, B, C, D</strong> để chọn nhanh 1 chạm hoặc bấm nút{' '}
                                <strong>U</strong> (Gạch chân) / <strong>A</strong> (Tô đỏ):
                              </span>
                              <span className="font-mono text-sky-800 font-bold">
                                Times New Roman 12pt · Canh trái đều
                              </span>
                            </div>

                            <div
                              className={`grid gap-3 ${
                                effectiveLayout === '1_ROW_4_COL'
                                  ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4'
                                  : effectiveLayout === '2_ROW_2_COL'
                                  ? 'grid-cols-1 sm:grid-cols-2'
                                  : 'grid-cols-1'
                              }`}
                            >
                              {q.options.map((opt) => (
                                <div
                                  key={opt.id}
                                  className={`p-2.5 rounded-xl border-2 flex items-center gap-2 transition-all ${
                                    opt.isCorrect
                                      ? 'bg-rose-50/90 border-rose-400 shadow-md'
                                      : 'bg-sky-50/60 border-sky-200'
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleSelectSingleCorrectPart1(q.id, opt.id)
                                    }
                                    title={`Click 1 chạm chọn ${opt.currentLabel} làm đáp án đúng`}
                                    className={`w-8 h-8 rounded-lg text-xs font-black text-white flex items-center justify-center shrink-0 ${
                                      opt.isCorrect
                                        ? 'btn-3d-rose'
                                        : 'btn-3d-primary opacity-80 hover:opacity-100'
                                    }`}
                                  >
                                    {opt.currentLabel}
                                  </button>

                                  <input
                                    type="text"
                                    value={opt.text}
                                    onChange={(e) =>
                                      handleUpdateOptionTextPart1(
                                        q.id,
                                        opt.id,
                                        e.target.value
                                      )
                                    }
                                    style={{
                                      fontFamily: "'Times New Roman', Times, serif",
                                      fontSize: '12pt',
                                    }}
                                    className={`flex-1 min-w-0 px-2 py-1 text-left bg-transparent border-b border-transparent focus:border-blue-600 focus:bg-white focus:outline-none ${
                                      opt.isUnderline ? 'underline decoration-2' : ''
                                    } ${
                                      opt.isRed
                                        ? 'text-rose-600 font-bold'
                                        : 'text-slate-900 font-medium'
                                    }`}
                                  />

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleToggleOptionPropertyPart1(
                                          q.id,
                                          opt.id,
                                          'isUnderline'
                                        )
                                      }
                                      title="Bật/tắt thuộc tính Gạch chân (<w:u>)"
                                      className={`w-7 h-7 rounded-lg text-xs font-serif underline font-black flex items-center justify-center ${
                                        opt.isUnderline
                                          ? 'btn-3d-indigo text-white'
                                          : 'btn-3d-neutral text-slate-700'
                                      }`}
                                    >
                                      U
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleToggleOptionPropertyPart1(
                                          q.id,
                                          opt.id,
                                          'isRed'
                                        )
                                      }
                                      title="Bật/tắt thuộc tính Tô màu đỏ (<w:color val='FF0000'/>)"
                                      className={`w-7 h-7 rounded-lg text-xs font-black flex items-center justify-center ${
                                        opt.isRed
                                          ? 'btn-3d-rose text-white'
                                          : 'btn-3d-neutral text-rose-600'
                                      }`}
                                    >
                                      A
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* ================= NỘI DUNG PHẦN II: 4 Ý CON a), b), c), d) ĐÚNG / SAI ================= */}
                        {q.part === 'PART_2' && q.subItems && (
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
                              <span>
                                Ý có gạch chân hoặc tô đỏ = <strong>Đúng (Đ)</strong> · Ý bình thường ={' '}
                                <strong>Sai (S)</strong>. Click nút 3D 1 chạm để đổi:
                              </span>
                              <span className="font-mono font-extrabold text-emerald-900 bg-emerald-100 px-2.5 py-0.5 rounded-lg border border-emerald-300">
                                Mã khóa:{' '}
                                {q.subItems
                                  .map((s) => (s.isTrue ? 'Đ' : 'S'))
                                  .join('')}
                                {' ('}
                                {q.subItems
                                  .map((s) => (s.isTrue ? 'T' : 'F'))
                                  .join('')}
                                {')'}
                              </span>
                            </div>

                            <div className="space-y-2.5">
                              {q.subItems.map((sub) => (
                                <div
                                  key={sub.id}
                                  className={`p-2.5 rounded-xl border-2 flex items-center gap-3 ${
                                    sub.isTrue
                                      ? 'bg-emerald-50/90 border-emerald-300 shadow-xs'
                                      : 'bg-sky-50/60 border-sky-200'
                                  }`}
                                >
                                  <span className="text-sm font-black text-sky-950 w-6 shrink-0">
                                    {sub.currentLabel})
                                  </span>

                                  <input
                                    type="text"
                                    value={sub.text}
                                    onChange={(e) =>
                                      handleUpdateSubItemTextPart2(
                                        q.id,
                                        sub.id,
                                        e.target.value
                                      )
                                    }
                                    style={{
                                      fontFamily: "'Times New Roman', Times, serif",
                                      fontSize: '12pt',
                                    }}
                                    className={`flex-1 min-w-0 px-3 py-1.5 text-left bg-white border border-sky-200 rounded-lg focus:outline-none focus:border-blue-600 ${
                                      sub.isTrue
                                        ? 'underline decoration-emerald-600 text-slate-900 font-bold'
                                        : 'text-slate-700 font-medium'
                                    }`}
                                  />

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleToggleSubItemPart2(q.id, sub.id, true)
                                      }
                                      className={`px-3 py-1.5 rounded-lg text-xs font-extrabold ${
                                        sub.isTrue
                                          ? 'btn-3d-emerald text-white'
                                          : 'btn-3d-neutral text-slate-600'
                                      }`}
                                    >
                                      Đúng (Đ)
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleToggleSubItemPart2(q.id, sub.id, false)
                                      }
                                      className={`px-3 py-1.5 rounded-lg text-xs font-extrabold ${
                                        !sub.isTrue
                                          ? 'btn-3d-rose text-white'
                                          : 'btn-3d-neutral text-slate-600'
                                      }`}
                                    >
                                      Sai (S)
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* ================= NỘI DUNG PHẦN III: TRẢ LỜI NGẮN (ĐÁP SỐ) ================= */}
                        {q.part === 'PART_3' && (
                          <div className="pt-2 flex flex-wrap items-center justify-between gap-4 bg-amber-50/90 p-3.5 rounded-xl border-2 border-amber-300">
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-black text-amber-950 uppercase">
                                Đáp số chuẩn (Phần III):
                              </span>
                              <input
                                type="text"
                                value={q.shortAnswer || ''}
                                onChange={(e) =>
                                  handleUpdateShortAnswerPart3(q.id, e.target.value)
                                }
                                placeholder="Nhập số (VD: 375 hoặc 0.12)"
                                className="w-44 px-3 py-1.5 text-sm font-mono font-extrabold text-rose-600 underline bg-white border-2 border-amber-400 rounded-xl focus:outline-none focus:border-blue-600"
                              />
                            </div>
                            <span className="text-xs text-amber-900 font-mono font-bold">
                              Nguồn nhận diện:{' '}
                              {q.shortAnswerDetectedBy === 'KEYWORD'
                                ? 'Từ khóa "Đáp án:"'
                                : q.shortAnswerDetectedBy === 'UNDERLINE_RED'
                                ? 'Gạch chân / Tô đỏ cuối câu'
                                : q.shortAnswerDetectedBy === 'MANUAL'
                                ? 'Giáo viên nhập trực tiếp'
                                : 'Chưa có đáp số'}
                            </span>
                          </div>
                        )}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================= TAB 2: BẢNG ĐÁP ÁN CHUNG TẤT CẢ MÃ ĐỀ TRONG 1 KHUNG + XEM TRƯỚC ĐỀ WORD ================= */}
          {activeRightTab === 'SHUFFLED_PREVIEW' && (
            <div className="space-y-5">
              {shuffledVariants.length === 0 ? (
                <div className="p-12 rounded-2xl card-3d-panel text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl logo-3d-badge text-white flex items-center justify-center mx-auto">
                    <QrCode className="w-7 h-7" />
                  </div>
                  <div className="space-y-1 max-w-md mx-auto">
                    <h3 className="text-base font-extrabold text-slate-900">
                      Chưa có dữ liệu đề thi hoán vị & Bảng đáp án chung
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Hãy kiểm tra sạch lỗi ở Trình biên tập trực tiếp, bấm{' '}
                      <strong>[Lưu chỉnh sửa]</strong> và nhấn nút{' '}
                      <strong>[Trộn Đề Ngay]</strong> bên cột trái để sinh Bảng Đáp Án Chung tất cả các mã đề.
                    </p>
                  </div>
                  <button
                    onClick={handleRunShuffle}
                    disabled={!canShuffle}
                    className="px-6 py-3 rounded-xl text-xs font-extrabold text-white btn-3d-primary inline-flex items-center gap-2"
                  >
                    <Shuffle className="w-4 h-4" />
                    <span>Trộn Đề & Sinh Bảng Đáp Án Chung Ngay</span>
                  </button>
                </div>
              ) : (
                <>
                  {/* ================= KHUNG LỚN BAO CHUNG TẤT CẢ CÁC MÃ ĐỀ THEO THỨ TỰ TỪ TRÊN XUỐNG ================= */}
                  <div className="p-6 rounded-3xl card-3d-panel border-4 border-sky-400 space-y-5">
                    {/* Header của Bảng Đáp Án Chung */}
                    <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b-2 border-sky-300">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <FileCheck className="w-5 h-5 text-blue-700" />
                          <h3 className="text-base sm:text-lg font-black text-sky-950 uppercase">
                            BẢNG ĐÁP ÁN CHUNG TẤT CẢ CÁC MÃ ĐỀ ({shuffledVariants.length} MÃ ĐỀ TRONG 1 KHUNG)
                          </h3>
                        </div>
                        <p className="text-xs text-slate-700 font-semibold">
                          Trình bày chuẩn 3 cột màu (Phần I · Phần II · Phần III) từ trên xuống, dùng font{' '}
                          <strong>Times New Roman 12pt</strong> — Tải về nộp ngay không cần chỉnh sửa!
                        </p>
                      </div>

                      <button
                        onClick={handleDownloadMasterAnswerSheetDocx}
                        className="px-5 py-3 rounded-2xl text-xs sm:text-sm font-black text-white btn-3d-purple flex items-center gap-2 whitespace-nowrap shrink-0"
                      >
                        <Download className="w-4 h-4" />
                        <span>
                          Tải Bảng Đáp Án Chung ({shuffledVariants.length} Mã Đề) (.docx)
                        </span>
                      </button>
                    </div>

                    {/* Khung Quốc Hiệu & Tiêu Đề Chung của Bảng Đáp Án (Times New Roman 12pt) */}
                    <div
                      style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: '12pt' }}
                      className="p-4 rounded-2xl bg-white border-2 border-slate-300 grid grid-cols-1 md:grid-cols-2 gap-4 text-center shadow-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="font-bold uppercase text-slate-900">
                          {config.departmentName}
                        </div>
                        <div className="font-bold uppercase underline text-slate-900">
                          {config.schoolName}
                        </div>
                        <div className="text-sm font-bold text-slate-700 pt-1">
                          {config.examSubtitle}
                        </div>
                      </div>
                      <div className="space-y-0.5">
                        <div className="font-bold uppercase text-slate-900">
                          {config.nationalHeader}
                        </div>
                        <div className="font-bold underline text-slate-900">
                          {config.nationalMotto}
                        </div>
                        <div className="font-bold uppercase text-blue-950 pt-1">
                          {config.examTitle} ({config.schoolYear})
                        </div>
                        <div className="italic font-semibold text-slate-800">
                          Môn thi: {config.subjectName} — Thời gian làm bài: {config.durationMinutes} phút
                        </div>
                      </div>
                    </div>

                    {/* Danh sách TẤT CẢ các mã đề xếp theo thứ tự từ trên xuống trong cùng 1 khung */}
                    <div className="space-y-5">
                      {shuffledVariants.map((variant) =>
                        renderThreeColumnAnswerCard(variant)
                      )}
                    </div>
                  </div>

                  {/* ================= THANH CHỌN MÃ ĐỀ ĐỂ XEM CHI TIẾT MÃ QR & BẢN DÀN TRANG ĐỀ THI WORD ================= */}
                  <div className="p-4 rounded-2xl toolbar-3d flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-xs font-extrabold text-sky-950 mr-1">
                        Xem trước Đề thi & Mã QR của:
                      </span>
                      {shuffledVariants.map((v, idx) => {
                        const colorClass =
                          variantColorClasses[idx % variantColorClasses.length];
                        const isSelected = activeVariant?.examCode === v.examCode;
                        return (
                          <button
                            key={v.examCode}
                            onClick={() => setSelectedVariantCode(v.examCode)}
                            className={`px-4 py-2 rounded-xl text-xs font-mono font-extrabold text-white transition-all ${colorClass} ${
                              isSelected
                                ? 'ring-4 ring-sky-300 scale-105'
                                : 'opacity-85 hover:opacity-100'
                            }`}
                          >
                            Mã đề {v.examCode}
                          </button>
                        );
                      })}
                    </div>

                    {activeVariant && (
                      <button
                        onClick={() =>
                          handleDownloadSingleVariantDocx(activeVariant)
                        }
                        className="px-4 py-2.5 rounded-xl text-xs font-extrabold text-white btn-3d-emerald flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      >
                        <Download className="w-4 h-4" />
                        <span>Tải Word Mã Đề {activeVariant.examCode} (.docx)</span>
                      </button>
                    )}
                  </div>

                  {activeVariant && (
                    <>
                      {/* Khung Mã QR Chấm Thi Đa Nền Tảng + Chuỗi Payload */}
                      <div className="p-6 rounded-2xl card-3d-panel grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                        <div className="md:col-span-4 flex flex-col items-center justify-center p-4 bg-sky-50 rounded-2xl border-2 border-sky-300 shadow-md">
                          <img
                            src={activeVariant.qrDataUrl}
                            alt={`QR Code Mã đề ${activeVariant.examCode}`}
                            referrerPolicy="no-referrer"
                            className="w-40 h-40 object-contain rounded-xl border-2 border-sky-200 bg-white p-2 shadow-xs"
                          />
                          <span className="mt-2 text-xs font-mono font-black text-sky-950">
                            MÃ ĐỀ: {activeVariant.examCode} ({config.qrFormat})
                          </span>
                          <span className="text-[11px] text-emerald-700 font-bold">
                            Quét nhận diện tức thì &lt; 1 giây
                          </span>
                        </div>

                        <div className="md:col-span-8 space-y-3">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <h3 className="text-base font-black text-sky-950">
                              Payload Mã Hóa Chấm Thi Tự Động — Mã Đề {activeVariant.examCode}
                            </h3>
                            <span className="text-xs font-mono font-bold text-blue-700 bg-blue-100 px-2.5 py-1 rounded-lg">
                              {config.embedQrInWord
                                ? 'Đã nhúng vào cuối file Word'
                                : 'Xuất file PNG độc lập'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 font-medium">
                            Chuỗi dữ liệu tương thích trực tiếp với ứng dụng chấm thi trên điện thoại:
                          </p>
                          <div className="p-3.5 rounded-xl bg-slate-900 text-emerald-400 font-mono text-xs break-all leading-relaxed border-2 border-sky-400 shadow-inner">
                            {activeVariant.qrPayload}
                          </div>
                        </div>
                      </div>

                      {/* Xem trước nội dung Đề thi đã hoán vị (Times New Roman 12pt, Canh trái đều, có Tiêu đề Quốc ngữ & Footer Số trang + Mã đề) */}
                      <div className="p-6 rounded-2xl card-3d-panel space-y-5">
                        <div className="flex items-center justify-between border-b-2 border-sky-200 pb-3 flex-wrap gap-2">
                          <div>
                            <h3 className="text-sm font-black text-sky-950 uppercase">
                              Bản Xem Trước Trang Giấy Word — Mã Đề {activeVariant.examCode}
                            </h3>
                            <p className="text-xs text-slate-600 font-medium">
                              Font <strong>Times New Roman 12pt</strong> · Canh trái các câu tự động co dãn đều · Có đánh số trang & số mã đề
                            </p>
                          </div>
                          <span className="text-xs font-mono font-bold text-sky-800 bg-sky-100 px-2.5 py-1 rounded-lg">
                            Times New Roman · 12pt · Left Auto-Stretch
                          </span>
                        </div>

                        {/* Trang giấy mô phỏng Word */}
                        <div
                          style={{
                            fontFamily: "'Times New Roman', Times, serif",
                            fontSize: '12pt',
                          }}
                          className="p-6 sm:p-8 bg-white rounded-2xl border-2 border-slate-300 shadow-inner space-y-4 text-slate-950"
                        >
                          {/* Quốc hiệu Tiêu ngữ 2 cột trên đầu đề thi */}
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 pb-3 border-b border-slate-300 text-center">
                            <div className="sm:col-span-5 space-y-0.5">
                              <div className="font-bold uppercase">
                                {config.departmentName}
                              </div>
                              <div className="font-bold uppercase underline">
                                {config.schoolName}
                              </div>
                              <div className="font-bold pt-1">
                                {config.examSubtitle}
                              </div>
                            </div>
                            <div className="sm:col-span-7 space-y-0.5">
                              <div className="font-bold uppercase">
                                {config.nationalHeader}
                              </div>
                              <div className="font-bold underline">
                                {config.nationalMotto}
                              </div>
                              <div className="font-bold uppercase pt-1">
                                {config.examTitle} ({config.schoolYear})
                              </div>
                              <div className="italic">
                                Môn thi: <strong>{config.subjectName}</strong> — Thời gian làm bài: {config.durationMinutes} phút
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 py-1 border-b border-slate-200">
                            <div className="font-bold">
                              Họ và tên thí sinh: ......................................................... Số báo danh: ....................
                            </div>
                            <div className="px-3 py-0.5 border-2 border-slate-900 font-bold">
                              MÃ ĐỀ: {activeVariant.examCode}
                            </div>
                          </div>

                          {/* Nội dung câu hỏi canh trái, tự động co dãn đều */}
                          <div className="space-y-4 text-left">
                            {activeVariant.questions.map((vq, vIdx) => {
                              const prevVq =
                                vIdx > 0 ? activeVariant.questions[vIdx - 1] : null;
                              const isNewPart = !prevVq || prevVq.part !== vq.part;

                              return (
                                <React.Fragment key={`${activeVariant.examCode}-${vq.id}`}>
                                  {isNewPart && (
                                    <div className="pt-2 pb-1 font-bold text-slate-950">
                                      {vq.part === 'PART_1' &&
                                        'PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn. Mỗi câu hỏi thí sinh chỉ chọn một phương án.'}
                                      {vq.part === 'PART_2' &&
                                        'PHẦN II. Câu trắc nghiệm đúng sai. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai.'}
                                      {vq.part === 'PART_3' &&
                                        'PHẦN III. Câu trắc nghiệm trả lời ngắn.'}
                                    </div>
                                  )}

                                  <div className="space-y-1.5 leading-relaxed text-left">
                                    <p className="text-left">
                                      <strong className="font-bold">
                                        Câu {vq.displayIndex}.{' '}
                                      </strong>
                                      <span>{vq.stemText}</span>
                                    </p>

                                    {vq.part === 'PART_1' && vq.options && (
                                      <div
                                        className={`grid gap-2 pl-1 w-full ${
                                          vq.computedLayout === '1_ROW_4_COL'
                                            ? 'grid-cols-2 sm:grid-cols-4'
                                            : vq.computedLayout === '2_ROW_2_COL'
                                            ? 'grid-cols-1 sm:grid-cols-2'
                                            : 'grid-cols-1'
                                        }`}
                                      >
                                        {vq.options.map((o) => (
                                          <div
                                            key={o.id}
                                            className="text-left text-slate-950"
                                          >
                                            <strong className="font-bold">
                                              {o.currentLabel}.{' '}
                                            </strong>
                                            <span>{o.text}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {vq.part === 'PART_2' && vq.subItems && (
                                      <div className="space-y-1 pl-3">
                                        {vq.subItems.map((s) => (
                                          <div
                                            key={s.id}
                                            className="text-left text-slate-950"
                                          >
                                            <strong className="font-bold">
                                              {s.currentLabel}){' '}
                                            </strong>
                                            <span>{s.text}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </React.Fragment>
                              );
                            })}
                          </div>

                          <div className="pt-4 text-center font-bold">
                            -------------------- HẾT --------------------
                          </div>

                          {/* Footer mô phỏng số trang & mã đề giống trong file Word */}
                          <div className="pt-3 mt-4 border-t border-slate-400 flex items-center justify-between text-slate-800">
                            <span className="font-bold">
                              {config.subjectName.toUpperCase()} — MÃ ĐỀ: {activeVariant.examCode}
                            </span>
                            <span>
                              Trang <strong>1</strong> / <strong>2</strong>
                            </span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </section>
      </main>

      {/* Modal Hướng dẫn sử dụng chi tiết & Tự động cập nhật khi nâng cấp tính năng */}
      <UserGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        features={featureRegistry}
        onRegisterNewFeature={(newItem) => {
          setFeatureRegistry((prev) => [newItem, ...prev]);
          setStatusBanner({
            type: 'SUCCESS',
            text: `Đã tự động cập nhật tính năng mới "${newItem.title}" (${newItem.version}) vào Cẩm nang hướng dẫn!`,
          });
        }}
      />
    </div>
  );
}
