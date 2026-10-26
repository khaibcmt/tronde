import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  Bold,
  BookOpen,
  CheckCircle2,
  Download,
  FileArchive,
  FileCode2,
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

  // 2. State cấu hình Trộn đề & Canh hàng & Mã QR
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
    schoolName: 'SỞ GD&ĐT VĨNH LONG - TRƯỜNG THPT MANG THÍT',
    examTitle: 'ĐỀ THI THỬ TỐT NGHIỆP THPT NĂM 2025',
    subjectName: 'TOÁN HỌC',
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
          q.shortAnswer = '2';
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
          shortAnswer: '2',
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

  // ================= HANDLERS: TRỘN ĐỀ & XUẤT FILE WORD / QR =================
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
        text: `Đã hoán vị Fisher-Yates thành công ${variants.length} mã đề chuẩn cấu trúc 2025 kèm mã QR chấm thi!`,
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
        text: 'Đã tải về máy tính tệp "Đề gốc đã sửa (.docx)" kèm bảng ẩn không viền chống xô lệch.',
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
        `Bo_${shuffledVariants.length}_De_Thi_THPT_2025_Kem_QR.zip`
      );
      setStatusBanner({
        type: 'SUCCESS',
        text: `Đã đóng gói và tải xuống bộ ${shuffledVariants.length} đề thi (.docx) + Bảng đáp án CSV + Ảnh QR (.zip).`,
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
            {/* Biểu tượng Logo 3D đa sắc có đổ bóng */}
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
            <span>Ma Trận Đáp Án & Mã QR</span>
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
                XML Parser 2025
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

          {/* 2. Bảng cảnh báo lỗi thông minh (Validator) kèm nút 3D [Sửa ngay] */}
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
                <span>2. Kiểm Tra Lỗi Định Dạng ({validationIssues.length})</span>
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
              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
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

          {/* 3. Khung Tùy Chọn Trộn Đề, Chia Cột Tự Động & Đánh Số Lại */}
          <section className="p-5 rounded-2xl card-3d-panel space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-sky-950 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-purple-600" />
                <span>3. Tùy Chọn Hoán Vị & Dàn Trang</span>
              </h2>
              <span className="text-xs text-purple-700 font-mono font-bold">
                Fisher-Yates
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Số lượng đề */}
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

              {/* Kiểu mã đề */}
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

            {/* Tùy chọn canh chỉnh đáp án Phần I (Auto-Layout) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Canh chỉnh cột đáp án Phần I (Bảng ẩn không viền)
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
                  Tự động thông minh (&lt;15kt: 4 cột · 15-35kt: 2 cột · &gt;35kt: 1 cột)
                </option>
                <option value="1_ROW_4_COL">Luôn chia 4 cột ngang (1 dòng)</option>
                <option value="2_ROW_2_COL">Luôn chia 2 cột × 2 hàng (2 dòng)</option>
                <option value="4_ROW_1_COL">Luôn xếp 1 cột dọc (4 dòng)</option>
              </select>
            </div>

            {/* Định dạng ứng dụng quét mã QR chấm thi */}
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

            {/* Các công tắc bật/tắt */}
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
                  <span>Chèn mã QR vào cuối trang đáp án file Word</span>
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

          {/* 4. Nhóm nút bấm 3D Đa Sắc Màu: [Trộn đề], [Tải bộ đề (.zip)], [Tải mã QR] */}
          <section className="p-5 rounded-2xl card-3d-panel space-y-3.5">
            <h2 className="text-sm font-extrabold text-sky-950">
              4. Thực Thi Trộn Đề & Xuất Bản Bộ Đề 3D
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

            <div className="grid grid-cols-2 gap-3 pt-1">
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
            {/* Chuyển đổi giữa Live Editor và Kết quả trộn + QR */}
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
                  Bảng Đáp Án & Mã QR ({shuffledVariants.length} đề)
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

                {/* Chú thích công cụ nhanh U / A / B */}
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
                    <span>In đậm</span>
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
                                ? 'Đang bật chế độ: Đánh số lại từ Câu 1 ở đầu mỗi phần (Chuẩn 2025)'
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
                        {/* Dòng tiêu đề câu hỏi + Thông tin Layout & Cảnh báo */}
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
                                · Bố cục Word:{' '}
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

                        {/* Ô biên tập trực tiếp thân câu hỏi (Stem Text) */}
                        <div className="mb-4">
                          <label className="block text-[11px] font-bold text-sky-900 mb-1">
                            Nội dung câu dẫn (Biên tập trực tiếp):
                          </label>
                          <textarea
                            rows={2}
                            value={q.stemText}
                            onChange={(e) =>
                              handleUpdateStemText(q.id, e.target.value)
                            }
                            className="w-full px-3.5 py-2 text-sm text-slate-900 bg-white border-2 border-sky-200 rounded-xl focus:outline-none focus:border-blue-600 leading-relaxed shadow-inner"
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
                                Hanging Indent: 0.65cm · Table Border: None
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
                                  {/* Nút tròn 3D 1 chạm chọn đáp án đúng */}
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

                                  {/* Ô nhập nội dung phương án */}
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
                                    className={`flex-1 min-w-0 px-2 py-1 text-sm bg-transparent border-b border-transparent focus:border-blue-600 focus:bg-white focus:outline-none ${
                                      opt.isUnderline ? 'underline decoration-2' : ''
                                    } ${
                                      opt.isRed
                                        ? 'text-rose-600 font-bold'
                                        : 'text-slate-900 font-medium'
                                    }`}
                                  />

                                  {/* Thanh công cụ nhanh 3D: U (Gạch chân) & A (Tô màu đỏ) */}
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
                                  .join(' - ')}
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
                                    className={`flex-1 min-w-0 px-3 py-1.5 text-sm bg-white border border-sky-200 rounded-lg focus:outline-none focus:border-blue-600 ${
                                      sub.isTrue
                                        ? 'underline decoration-emerald-600 text-slate-900 font-bold'
                                        : 'text-slate-700 font-medium'
                                    }`}
                                  />

                                  {/* Nút gạt 3D 1 chạm [Đúng (Đ)] / [Sai (S)] */}
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
                                placeholder="Nhập số (VD: 12.5 hoặc -0.75)"
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

          {/* ================= TAB 2: HIỂN THỊ BẢNG MA TRẬN ĐÁP ÁN & MÃ QR XEM THỬ SAU KHI BẤM TRỘN ================= */}
          {activeRightTab === 'SHUFFLED_PREVIEW' && (
            <div className="space-y-5">
              {shuffledVariants.length === 0 ? (
                <div className="p-12 rounded-2xl card-3d-panel text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl logo-3d-badge text-white flex items-center justify-center mx-auto">
                    <QrCode className="w-7 h-7" />
                  </div>
                  <div className="space-y-1 max-w-md mx-auto">
                    <h3 className="text-base font-extrabold text-slate-900">
                      Chưa có dữ liệu đề thi hoán vị
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Hãy kiểm tra sạch lỗi ở Trình biên tập trực tiếp, bấm{' '}
                      <strong>[Lưu chỉnh sửa]</strong> và nhấn nút{' '}
                      <strong>[Trộn Đề Ngay]</strong> bên cột trái để sinh bảng ma trận đáp án và mã QR.
                    </p>
                  </div>
                  <button
                    onClick={handleRunShuffle}
                    disabled={!canShuffle}
                    className="px-6 py-3 rounded-xl text-xs font-extrabold text-white btn-3d-primary inline-flex items-center gap-2"
                  >
                    <Shuffle className="w-4 h-4" />
                    <span>Trộn Đề & Sinh Mã QR Ngay</span>
                  </button>
                </div>
              ) : (
                <>
                  {/* Thanh công cụ nổi 3D chọn Mã đề hoán vị với nhiều màu sắc */}
                  <div className="p-4 rounded-2xl toolbar-3d flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-xs font-extrabold text-sky-950 mr-1">
                        Chọn Mã đề hoán vị:
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
                            className="w-44 h-44 object-contain rounded-xl border-2 border-sky-200 bg-white p-2 shadow-xs"
                          />
                          <span className="mt-2.5 text-xs font-mono font-black text-sky-950">
                            MÃ ĐỀ: {activeVariant.examCode} ({config.qrFormat})
                          </span>
                          <span className="text-[11px] text-emerald-700 font-bold">
                            Quét nhận diện tức thì &lt; 1 giây
                          </span>
                        </div>

                        <div className="md:col-span-8 space-y-4">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
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
                              Chuỗi dữ liệu đã được tối ưu mật độ hạt, tương thích trực tiếp với ứng dụng chấm thi trên điện thoại giúp giáo viên không phải nhập tay từng câu:
                            </p>
                          </div>

                          <div className="p-3.5 rounded-xl bg-slate-900 text-emerald-400 font-mono text-xs break-all leading-relaxed border-2 border-sky-400 shadow-inner">
                            {activeVariant.qrPayload}
                          </div>

                          {/* Ma trận đáp án 3 phần của Mã đề đang chọn */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                            {/* Phần I */}
                            <div className="p-3 rounded-xl bg-blue-50/90 border-2 border-blue-200 space-y-2">
                              <div className="text-xs font-extrabold text-blue-950 border-b border-blue-200 pb-1">
                                PHẦN I (4 lựa chọn)
                              </div>
                              <div className="grid grid-cols-3 gap-1.5 font-mono text-xs tabular-nums">
                                {activeVariant.answerKey.part1.map((item) => (
                                  <div
                                    key={item.questionNumber}
                                    className="px-2 py-1 bg-white rounded-lg border border-blue-200 flex items-center justify-between shadow-2xs"
                                  >
                                    <span className="text-slate-600 font-bold">
                                      {item.questionNumber}.
                                    </span>
                                    <span className="font-black text-rose-600">
                                      {item.answer}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Phần II */}
                            <div className="p-3 rounded-xl bg-emerald-50/90 border-2 border-emerald-200 space-y-2">
                              <div className="text-xs font-extrabold text-emerald-950 border-b border-emerald-200 pb-1">
                                PHẦN II (Đúng / Sai)
                              </div>
                              <div className="space-y-1.5 font-mono text-xs tabular-nums">
                                {activeVariant.answerKey.part2.map((item) => (
                                  <div
                                    key={item.questionNumber}
                                    className="px-2.5 py-1 bg-white rounded-lg border border-emerald-200 flex items-center justify-between shadow-2xs"
                                  >
                                    <span className="text-slate-700 font-bold">
                                      Câu {item.questionNumber}:
                                    </span>
                                    <span className="font-black text-emerald-700">
                                      {item.dsString} ({item.tfString})
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Phần III */}
                            <div className="p-3 rounded-xl bg-amber-50/90 border-2 border-amber-200 space-y-2">
                              <div className="text-xs font-extrabold text-amber-950 border-b border-amber-200 pb-1">
                                PHẦN III (Trả lời ngắn)
                              </div>
                              <div className="space-y-1.5 font-mono text-xs tabular-nums">
                                {activeVariant.answerKey.part3.map((item) => (
                                  <div
                                    key={item.questionNumber}
                                    className="px-2.5 py-1 bg-white rounded-lg border border-amber-200 flex items-center justify-between shadow-2xs"
                                  >
                                    <span className="text-slate-700 font-bold">
                                      Câu {item.questionNumber}:
                                    </span>
                                    <span className="font-black text-rose-700">
                                      {item.answer}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Xem trước nội dung Đề thi đã hoán vị & dàn trang chống xô lệch */}
                      <div className="p-6 rounded-2xl card-3d-panel space-y-4">
                        <div className="flex items-center justify-between border-b-2 border-sky-200 pb-3">
                          <div>
                            <h3 className="text-sm font-black text-sky-950 uppercase">
                              Bản Xem Trước Dàn Trang Word — Mã Đề {activeVariant.examCode}
                            </h3>
                            <p className="text-xs text-slate-600 font-medium">
                              Áp dụng Bảng ẩn không viền (Invisible Borderless Table), Hanging Indent 0.65cm, Line Spacing 1.15
                            </p>
                          </div>
                          <span className="text-xs font-mono font-bold text-sky-800 bg-sky-100 px-2.5 py-1 rounded-lg">
                            Times New Roman · 12pt · Justify
                          </span>
                        </div>

                        <div className="space-y-4">
                          {activeVariant.questions.map((vq, vIdx) => {
                            const prevVq =
                              vIdx > 0 ? activeVariant.questions[vIdx - 1] : null;
                            const isNewPart = !prevVq || prevVq.part !== vq.part;

                            return (
                              <React.Fragment key={`${activeVariant.examCode}-${vq.id}`}>
                                {isNewPart && (
                                  <div className="pt-2 pb-1 border-b border-sky-200 font-black text-xs text-blue-950 uppercase">
                                    {vq.part === 'PART_1' &&
                                      'PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn'}
                                    {vq.part === 'PART_2' &&
                                      'PHẦN II. Câu trắc nghiệm đúng sai'}
                                    {vq.part === 'PART_3' &&
                                      'PHẦN III. Câu trắc nghiệm trả lời ngắn'}
                                  </div>
                                )}

                                <div className="text-sm text-slate-900 space-y-2 leading-relaxed">
                                  <p className="text-justify">
                                    <strong className="font-bold">
                                      Câu {vq.displayIndex}.{' '}
                                    </strong>
                                    <span>{vq.stemText}</span>
                                  </p>

                                  {vq.part === 'PART_1' && vq.options && (
                                    <div
                                      className={`grid gap-2 pl-2 ${
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
                                          className="text-sm text-slate-800"
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
                                    <div className="space-y-1 pl-4">
                                      {vq.subItems.map((s) => (
                                        <div
                                          key={s.id}
                                          className="text-sm text-slate-800"
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
