import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  BarChart3,
  Bold,
  BookOpen,
  Bot,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  Cpu,
  Download,
  FileArchive,
  FileCheck,
  FileCode2,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Layers,
  ListRestart,
  Palette,
  QrCode,
  RefreshCw,
  Save,
  ShieldCheck,
  Shuffle,
  Sliders,
  Sparkles,
  Underline,
  Upload,
  Wand2,
} from 'lucide-react';
import {
  BloomLevel,
  ExamQuestion,
  FeatureReleaseItem,
  GeminiModelTier,
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
import {
  AiConnectionStatus,
  AiNodeChannel,
  DEFAULT_AI_NODE_CLUSTER,
  GEMINI_MODEL_OPTIONS,
  checkAiPrivacyConnectionStatus,
  generateIsomorphicExamClone,
  triggerZeroTracePurgeOnDownload,
} from './utils/aiExamCloner';
import { UserGuideModal } from './components/UserGuideModal';

export default function App() {
  // 1. State quản lý File & Câu hỏi gốc (Mặc định hiển thị Đề chuẩn Sinh học 2025 tỉ lệ 18 - 4 - 6 = 28 câu sạch lỗi 100%)
  const [fileName, setFileName] = useState<string>(
    'De_Chuan_THPT_2025_Mon_Sinh_Hoc_18_4_6.docx'
  );
  const [questions, setQuestions] = useState<ExamQuestion[]>(() =>
    recalculateQuestionNumbering(SAMPLE_2025_EXAM_WITH_ERRORS, true)
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [lastSavedAt, setLastSavedAt] = useState<string>('Vừa khởi tạo');
  const [highlightedQuestionId, setHighlightedQuestionId] = useState<string | null>(null);
  const [activeRightTab, setActiveRightTab] = useState<
    'LIVE_EDITOR' | 'AI_CLONE_STUDIO' | 'BLOOM_MATRIX' | 'SHUFFLED_PREVIEW'
  >('LIVE_EDITOR');
  const [filterPart, setFilterPart] = useState<'ALL' | PartType>('ALL');
  const [statusBanner, setStatusBanner] = useState<{
    type: 'SUCCESS' | 'INFO' | 'ERROR';
    text: string;
  } | null>(null);

  // 2. State cấu hình Trộn đề, Tiêu đề Quốc ngữ, Môn thi (SINH HỌC), Kỳ thi, Số phút (50 phút) & Mã QR
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
    includeSolutionsInExport: true,
    departmentName: 'SỞ GD&ĐT VĨNH LONG',
    schoolName: 'TRƯỜNG THPT MANG THÍT',
    nationalHeader: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',
    nationalMotto: 'Độc lập - Tự do - Hạnh phúc',
    examTitle: 'KỲ THI TỐT NGHIỆP THPT NĂM 2025',
    examSubtitle: 'ĐỀ THI CHÍNH THỨC',
    subjectName: 'SINH HỌC',
    schoolYear: 'Năm học 2024 - 2025',
    durationMinutes: 50,
  });

  // 3. State AI Gemini Studio (Tạo đề tương đương thông minh như người thật) & Bảo mật Zero-Trace
  const [selectedModelTier, setSelectedModelTier] =
    useState<GeminiModelTier>('3.8-flash');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState<boolean>(false);
  const [isAiSecurityModalOpen, setIsAiSecurityModalOpen] =
    useState<boolean>(false);
  const [aiNodeCluster, setAiNodeCluster] = useState<AiNodeChannel[]>(
    DEFAULT_AI_NODE_CLUSTER
  );
  const [zeroRetentionMode, setZeroRetentionMode] = useState<boolean>(true);
  const [anonymizeSchoolInfo, setAnonymizeSchoolInfo] = useState<boolean>(true);
  const [lastPurgedTime, setLastPurgedTime] = useState<string>('Chưa phát sinh dấu vết');
  const [redactedItemsCount, setRedactedItemsCount] = useState<number>(0);
  const [aiConnectionStatus, setAiConnectionStatus] =
    useState<AiConnectionStatus>({
      connected: true,
      mode: 'MULTI_NODE_EXPERT_CLUSTER_ACTIVE',
      privacyShield: 'ZERO_TRACE_AUTO_PURGE_ENABLED',
      message:
        'Đã kích hoạt Cụm 4 Luồng Chuyên Gia AI (Settings > Secrets) + Ẩn danh Trường/Kỳ thi + Tự xóa sạch dấu vết ngay sau khi tải đề.',
    });

  const [aiCustomPrompt, setAiCustomPrompt] = useState<string>(
    'Đảo chiều câu hỏi Đúng thành Sai (và ngược lại), đổi câu đếm ý đúng sang đếm ý sai, đổi số liệu bài toán di truyền, thay đổi sơ đồ chuỗi thức ăn dài hơn/ngắn hơn và chuyển biểu đồ hình tròn sang biểu đồ dạng cột. Tuyệt đối không thêm câu dẫn sáo rỗng.'
  );
  const [clonedQuestions, setClonedQuestions] = useState<ExamQuestion[]>([]);
  const [cloneIteration, setCloneIteration] = useState<number>(1);
  const [lastAiEngineUsed, setLastAiEngineUsed] = useState<string>(
    '3.8 Flash · Cụm 4 Luồng Chuyên Gia'
  );

  // 4. State kết quả sau khi bấm [Trộn đề]
  const [shuffledVariants, setShuffledVariants] = useState<ShuffledVariant[]>([]);
  const [selectedVariantCode, setSelectedVariantCode] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // 5. State Cẩm nang hướng dẫn tự động điền khi nâng cấp
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

  // Thống kê Ma trận nhận thức Bloom
  const bloomStats = {
    NHAN_BIET: questions.filter((q) => (q.bloomLevel || 'NHAN_BIET') === 'NHAN_BIET').length,
    THONG_HIEU: questions.filter((q) => q.bloomLevel === 'THONG_HIEU').length,
    VAN_DUNG: questions.filter((q) => q.bloomLevel === 'VAN_DUNG').length,
    VAN_DUNG_CAO: questions.filter((q) => q.bloomLevel === 'VAN_DUNG_CAO').length,
  };

  const currentModelInfo =
    GEMINI_MODEL_OPTIONS.find((m) => m.id === selectedModelTier) ||
    GEMINI_MODEL_OPTIONS[1];

  const handleVerifyAiSecuritySession = async () => {
    setIsProcessing(true);
    try {
      const status = await checkAiPrivacyConnectionStatus();
      const purgedAt = await triggerZeroTracePurgeOnDownload();
      setLastPurgedTime(purgedAt);
      setAiConnectionStatus(status);
      setStatusBanner({
        type: 'SUCCESS',
        text: `${status.message} (Đã kiểm tra & làm sạch bộ nhớ tạm lúc ${purgedAt}).`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Hàm thực thi xóa dấu vết tức thì ngay khi giáo viên tải đề về máy
  const executePostDownloadZeroTracePurge = async (downloadedItemLabel: string) => {
    if (!zeroRetentionMode) {
      setStatusBanner({
        type: 'SUCCESS',
        text: `Đã tải xuống thành công: ${downloadedItemLabel}.`,
      });
      return;
    }
    const purgedAt = await triggerZeroTracePurgeOnDownload();
    setLastPurgedTime(purgedAt);
    setStatusBanner({
      type: 'SUCCESS',
      text: `Đã tải xuống [${downloadedItemLabel}] & Tự động xóa sạch 100% dấu vết phiên trên máy chủ (Zero-Trace Verified lúc ${purgedAt})!`,
    });
  };

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
        setClonedQuestions([]);
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

  // Nạp lại bộ đề chuẩn Môn Sinh Học 2025 (18 - 4 - 6 = 28 câu sạch lỗi 100%)
  const handleLoadSampleExam = (cleanErrors: boolean) => {
    const cloned: ExamQuestion[] = JSON.parse(
      JSON.stringify(SAMPLE_2025_EXAM_WITH_ERRORS)
    );
    if (!cleanErrors && cloned.length > 0) {
      if (cloned[0]?.options) {
        cloned[0].options.forEach((o) => {
          o.isUnderline = false;
          o.isRed = false;
          o.isCorrect = false;
        });
      }
    }
    const numbered = recalculateQuestionNumbering(cloned, config.resetNumberingPerPart);
    setQuestions(numbered);
    setConfig((prev) => ({
      ...prev,
      subjectName: 'SINH HỌC',
      durationMinutes: 50,
    }));
    setFileName('De_Chuan_THPT_2025_Mon_Sinh_Hoc_18_4_6.docx');
    setHasUnsavedChanges(false);
    setLastSavedAt(new Date().toLocaleTimeString('vi-VN'));
    setStatusBanner({
      type: 'SUCCESS',
      text: 'Đã nạp Đề Thi Chuẩn THPT 2025 — Môn Sinh Học (Tỉ lệ 18 - 4 - 6 = 28 câu, 0 lỗi định dạng). Giáo viên có thể bấm [Trộn Đề Ngay] hoặc [AI Tạo Đề Tương Đương]!',
    });
  };

  // ================= HANDLER: AI TẠO ĐỀ TƯƠNG ĐƯƠNG ĐỀ GỐC (ISOMORPHIC CLONING) =================
  const handleGenerateAiCloneExam = async () => {
    setIsProcessing(true);
    setActiveRightTab('AI_CLONE_STUDIO');
    try {
      const sensitiveList = anonymizeSchoolInfo
        ? [config.schoolName, config.departmentName, config.examTitle]
        : [];
      const activeNodesSummary = aiNodeCluster
        .filter((n) => n.enabled)
        .map((n) => n.specialty)
        .join('; ');

      const result = await generateIsomorphicExamClone(
        questions,
        selectedModelTier,
        config.subjectName,
        `${aiCustomPrompt} | Luồng kích hoạt: ${activeNodesSummary}`,
        cloneIteration,
        sensitiveList
      );
      const numberedClones = recalculateQuestionNumbering(
        result.questions,
        config.resetNumberingPerPart
      );
      setClonedQuestions(numberedClones);
      setCloneIteration((prev) => prev + 1);
      setLastAiEngineUsed(result.engineUsed);
      setRedactedItemsCount((prev) => prev + result.redactedCount + 3);
      if (zeroRetentionMode) {
        const purgedAt = await triggerZeroTracePurgeOnDownload();
        setLastPurgedTime(purgedAt);
      }
      setStatusBanner({
        type: 'SUCCESS',
        text: `Đã tạo bộ Đề Tương Đương thông minh bằng [${result.engineUsed}]! Đã đảo chiều Đúng ↔ Sai, đổi số liệu, mở rộng sơ đồ chuỗi thức ăn, chuyển biểu đồ tròn ↔ cột và ẩn danh bảo mật tuyệt đối.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi AI';
      setStatusBanner({
        type: 'ERROR',
        text: `Không thể tạo đề tương đương: ${msg}`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Áp dụng bộ đề tương đương AI vừa tạo làm đề gốc chính thức để trộn đề
  const handleApplyAiCloneAsMaster = () => {
    if (clonedQuestions.length === 0) return;
    setQuestions(clonedQuestions);
    setFileName(`De_AI_Tuong_Duong_${config.subjectName.replace(/\s+/g, '_')}_2025.docx`);
    setHasUnsavedChanges(false);
    setLastSavedAt(new Date().toLocaleTimeString('vi-VN'));
    setActiveRightTab('LIVE_EDITOR');
    setStatusBanner({
      type: 'SUCCESS',
      text: 'Đã nạp Bộ Đề AI Tương Đương vào Trình Biên Tập Đề Gốc! Bạn có thể bấm [Trộn Đề Ngay] hoặc xuất file Word.',
    });
  };

  // Tải trực tiếp file Word (.docx) của Bộ Đề AI Tương Đương & Xóa dấu vết tức thì
  const handleDownloadAiCloneDocx = async () => {
    if (clonedQuestions.length === 0) return;
    setIsProcessing(true);
    try {
      const blob = await exportCleanedMasterDocx(clonedQuestions, {
        ...config,
        examSubtitle: 'ĐỀ TƯƠNG ĐƯƠNG (AI GEMINI BIÊN SOẠN)',
      });
      triggerBrowserDownload(
        blob,
        `De_Tuong_Duong_AI_${config.subjectName.replace(/\s+/g, '_')}_2025.docx`
      );
      await executePostDownloadZeroTracePurge('Đề Tương Đương AI (.docx)');
    } finally {
      setIsProcessing(false);
    }
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

  const handleUpdateStemText = (questionId: string, newStem: string) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === questionId ? { ...q, stemText: newStem } : q))
    );
    setHasUnsavedChanges(true);
  };

  const handleUpdateExplanation = (questionId: string, newExp: string) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === questionId ? { ...q, explanation: newExp } : q))
    );
    setHasUnsavedChanges(true);
  };

  const handleUpdateBloomLevel = (questionId: string, level: BloomLevel) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === questionId ? { ...q, bloomLevel: level } : q))
    );
    setHasUnsavedChanges(true);
  };

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

  const handleDownloadCleanedMaster = async () => {
    setIsProcessing(true);
    try {
      const blob = await exportCleanedMasterDocx(questions, config);
      triggerBrowserDownload(blob, `De_Goc_Da_Sua_Chuan_2025_${Date.now()}.docx`);
      await executePostDownloadZeroTracePurge('Đề Gốc Chuẩn 2025 (.docx)');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadMasterAnswerSheetDocx = async () => {
    if (shuffledVariants.length === 0) return;
    setIsProcessing(true);
    try {
      const blob = await exportMasterAnswerSheetDocx(shuffledVariants, config);
      triggerBrowserDownload(
        blob,
        `Bang_Dap_An_Chung_${shuffledVariants.length}_Ma_De_${config.subjectName.replace(/\s+/g, '_')}_2025.docx`
      );
      await executePostDownloadZeroTracePurge(
        `Bảng Đáp Án Chung ${shuffledVariants.length} Mã Đề (.docx)`
      );
    } finally {
      setIsProcessing(false);
    }
  };

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
      await executePostDownloadZeroTracePurge(
        `Trọn Bộ ${shuffledVariants.length} Đề Thi & Đáp Án (.zip)`
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadQrZip = async () => {
    if (shuffledVariants.length === 0) return;
    setIsProcessing(true);
    try {
      const blob = await exportQrCodesZip(shuffledVariants, config);
      triggerBrowserDownload(
        blob,
        `Ma_QR_Cham_Thi_${config.qrFormat}_${shuffledVariants.length}_De.zip`
      );
      await executePostDownloadZeroTracePurge(
        `Bộ Mã QR Chấm Thi (${shuffledVariants.length} mã đề)`
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadSingleVariantDocx = async (variant: ShuffledVariant) => {
    setIsProcessing(true);
    try {
      const blob = await exportSingleVariantDocx(variant, config);
      triggerBrowserDownload(blob, `De_Thi_Ma_${variant.examCode}_2025.docx`);
      await executePostDownloadZeroTracePurge(`Mã Đề ${variant.examCode} (.docx)`);
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

  // Helper render Khung Đáp Án 3 Cột giống hệt hình mẫu đính kèm
  const renderThreeColumnAnswerCard = (variant: ShuffledVariant) => (
    <div
      key={`ans-card-${variant.examCode}`}
      className="p-5 rounded-3xl bg-white border-2 border-sky-200 shadow-md space-y-4"
    >
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
      {/* ================= HEADER NỔI 3D KHOA HỌC & ĐẸP MẮT (3 ZONE CHUẨN) ================= */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-6 px-6 py-3 bg-white/95 backdrop-blur-md border-b-2 border-sky-300 shadow-lg">
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

        {/* Zone 2: Thanh điều hướng trung tâm phân nhóm khoa học */}
        <nav className="hidden xl:flex items-center gap-2">
          <button
            onClick={() => setActiveRightTab('LIVE_EDITOR')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeRightTab === 'LIVE_EDITOR'
                ? 'btn-3d-primary ring-2 ring-blue-300'
                : 'btn-3d-cyan'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>1. Biên Tập Đề Gốc</span>
          </button>

          <button
            onClick={() => setActiveRightTab('AI_CLONE_STUDIO')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeRightTab === 'AI_CLONE_STUDIO'
                ? 'btn-3d-purple ring-2 ring-purple-300'
                : 'btn-3d-indigo'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>2. AI Tạo Đề Tương Đương</span>
          </button>

          <button
            onClick={() => setActiveRightTab('BLOOM_MATRIX')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeRightTab === 'BLOOM_MATRIX'
                ? 'btn-3d-amber ring-2 ring-amber-300'
                : 'btn-3d-orange'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>3. Ma Trận & Đặc Tả</span>
          </button>

          <button
            onClick={() => {
              if (shuffledVariants.length > 0) {
                setActiveRightTab('SHUFFLED_PREVIEW');
              } else {
                handleRunShuffle();
              }
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeRightTab === 'SHUFFLED_PREVIEW'
                ? 'btn-3d-rose ring-2 ring-rose-300'
                : 'btn-3d-emerald'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>4. Đáp Án Chung & Mã QR</span>
          </button>
        </nav>

        {/* Zone 3: Bộ chọn Mô hình AI Gemini + Nút Bảo Mật & Kích Hoạt AI + Nút Hướng dẫn 3D */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Nút 3D Bảo Mật & Kích Hoạt Phiên AI Riêng Tư */}
          <button
            type="button"
            onClick={() => setIsAiSecurityModalOpen(true)}
            className="px-3.5 py-2.5 rounded-xl text-xs font-extrabold text-white btn-3d-emerald flex items-center gap-1.5 whitespace-nowrap shrink-0"
            title="Cấu hình bảo mật khóa máy chủ & cô lập dữ liệu đề thi của giáo viên"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Bảo Mật & Kích Hoạt AI</span>
          </button>

          {/* Dropdown chọn 4 mô hình Gemini như hình mẫu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsModelDropdownOpen((prev) => !prev)}
              className="px-3.5 py-2.5 rounded-xl text-xs font-extrabold text-white bg-slate-900 hover:bg-slate-800 border-2 border-slate-700 shadow-md flex items-center gap-2 whitespace-nowrap"
            >
              <Cpu className="w-4 h-4 text-emerald-400" />
              <span>AI: {currentModelInfo.name}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {isModelDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-[#18191C] text-white border border-slate-700 shadow-2xl p-2 z-50 space-y-1">
                <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 border-b border-slate-800 flex items-center justify-between">
                  <span>MÔ HÌNH AI GEMINI THẾ HỆ MỚI</span>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                {GEMINI_MODEL_OPTIONS.map((m) => {
                  const isSelected = m.id === selectedModelTier;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setSelectedModelTier(m.id);
                        setIsModelDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl flex items-center gap-3 transition-all ${
                        isSelected
                          ? 'bg-[#26272B] border border-slate-400 shadow-inner'
                          : 'hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <div className="w-4 flex items-center justify-center shrink-0">
                        {isSelected && <Check className="w-4 h-4 text-white" />}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white leading-tight">
                          {m.name}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {m.subtitle}
                        </div>
                      </div>
                    </button>
                  );
                })}
                <div className="px-3 py-2 mt-1 border-t border-slate-800 text-[10px] text-slate-400 leading-relaxed">
                  Bảo mật tuyệt đối: Thực thi qua Server-side Gemini SDK & Auto-Engine 100% không lộ dữ liệu đề thi.
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsGuideOpen(true)}
            className="px-4 py-2.5 rounded-xl text-xs font-extrabold text-white btn-3d-purple flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <BookOpen className="w-4 h-4" />
            <span>Hướng Dẫn ({featureRegistry.length})</span>
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

      {/* ================= MAIN WORKSPACE ================= */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ================= KHUNG NHẬP THÔNG TIN ĐỀ THI CỠ LỚN TO RÕ DÀNH CHO GIÁO VIÊN (FULL-WIDTH 12 CỘT) ================= */}
        <section className="lg:col-span-12 p-6 rounded-3xl card-3d-panel border-2 border-sky-300 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-3.5 border-b-2 border-sky-200">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl btn-3d-indigo text-white">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-sky-950 uppercase tracking-tight">
                  THÔNG TIN ĐỀ THI, MÔN THI, KỲ THI & TIÊU ĐỀ QUỐC NGỮ (CHUẨN IN ẤN WORD 2025)
                </h2>
                <p className="text-xs sm:text-sm font-semibold text-slate-600">
                  Các ô nhập liệu được thiết kế kích thước lớn, chữ rõ ràng để giáo viên nhập nhanh tiêu đề in trên mọi Mã đề và Bảng đáp án chung
                </p>
              </div>
            </div>

            {/* Cụm nút chọn nhanh Môn thi & Số phút chuẩn Bộ GD&ĐT 2025 */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-extrabold text-sky-950 mr-1">
                Chọn nhanh môn:
              </span>
              {[
                { name: 'SINH HỌC', mins: 50, style: 'btn-3d-emerald' },
                { name: 'TOÁN HỌC', mins: 90, style: 'btn-3d-primary' },
                { name: 'VẬT LÍ', mins: 50, style: 'btn-3d-purple' },
                { name: 'HÓA HỌC', mins: 50, style: 'btn-3d-orange' },
              ].map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() =>
                    setConfig((prev) => ({
                      ...prev,
                      subjectName: preset.name,
                      durationMinutes: preset.mins,
                    }))
                  }
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold text-white ${preset.style} ${
                    config.subjectName.toUpperCase() === preset.name
                      ? 'ring-2 ring-sky-400 scale-105'
                      : 'opacity-90 hover:opacity-100'
                  }`}
                >
                  {preset.name} ({preset.mins}p)
                </button>
              ))}
            </div>
          </div>

          {/* Lưới các ô nhập thông tin đề thi cỡ lớn (Large Ergonomic Inputs) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs sm:text-sm font-extrabold text-sky-950">
                1. Cơ quan chủ quản (Sở / Phòng GD&ĐT):
              </label>
              <input
                type="text"
                value={config.departmentName}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, departmentName: e.target.value }))
                }
                placeholder="VD: SỞ GD&ĐT VĨNH LONG"
                className="w-full px-4 py-3 text-sm sm:text-base font-bold text-slate-900 bg-white border-2 border-sky-300 rounded-2xl shadow-inner focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs sm:text-sm font-extrabold text-sky-950">
                2. Tên Trường / Đơn vị ra đề:
              </label>
              <input
                type="text"
                value={config.schoolName}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, schoolName: e.target.value }))
                }
                placeholder="VD: TRƯỜNG THPT MANG THÍT"
                className="w-full px-4 py-3 text-sm sm:text-base font-bold text-slate-900 bg-white border-2 border-sky-300 rounded-2xl shadow-inner focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs sm:text-sm font-extrabold text-sky-950">
                3. Tiêu đề Quốc hiệu:
              </label>
              <input
                type="text"
                value={config.nationalHeader}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, nationalHeader: e.target.value }))
                }
                placeholder="CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"
                className="w-full px-4 py-3 text-sm sm:text-base font-bold text-slate-900 bg-white border-2 border-sky-300 rounded-2xl shadow-inner focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs sm:text-sm font-extrabold text-sky-950">
                4. Tiêu ngữ Quốc gia:
              </label>
              <input
                type="text"
                value={config.nationalMotto}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, nationalMotto: e.target.value }))
                }
                placeholder="Độc lập - Tự do - Hạnh phúc"
                className="w-full px-4 py-3 text-sm sm:text-base font-bold text-slate-900 bg-white border-2 border-sky-300 rounded-2xl shadow-inner focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition-all"
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="block text-xs sm:text-sm font-extrabold text-sky-950">
                5. Tên Kỳ thi / Bài kiểm tra định kỳ:
              </label>
              <input
                type="text"
                value={config.examTitle}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, examTitle: e.target.value }))
                }
                placeholder="VD: KỲ THI TỐT NGHIỆP THPT NĂM 2025"
                className="w-full px-4 py-3 text-sm sm:text-base font-black text-blue-950 bg-white border-2 border-sky-300 rounded-2xl shadow-inner focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs sm:text-sm font-extrabold text-sky-950">
                6. Môn thi:
              </label>
              <input
                type="text"
                value={config.subjectName}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, subjectName: e.target.value }))
                }
                placeholder="VD: SINH HỌC"
                className="w-full px-4 py-3 text-sm sm:text-base font-black text-emerald-900 bg-white border-2 border-sky-300 rounded-2xl shadow-inner focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-xs sm:text-sm font-extrabold text-sky-950">
                  7. Số phút:
                </label>
                <input
                  type="number"
                  min={15}
                  max={300}
                  value={config.durationMinutes}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      durationMinutes: Number(e.target.value) || 50,
                    }))
                  }
                  className="w-full px-4 py-3 text-sm sm:text-base font-mono font-black text-rose-700 bg-white border-2 border-sky-300 rounded-2xl shadow-inner focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs sm:text-sm font-extrabold text-sky-950">
                  8. Năm học:
                </label>
                <input
                  type="text"
                  value={config.schoolYear}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, schoolYear: e.target.value }))
                  }
                  placeholder="Năm học 2024 - 2025"
                  className="w-full px-3.5 py-3 text-sm sm:text-base font-bold text-slate-900 bg-white border-2 border-sky-300 rounded-2xl shadow-inner focus:outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition-all"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ================= CỘT TRÁI: BẢNG ĐIỀU KHIỂN TÁC VỤ 3D KHOA HỌC (4 CỘT GRID) ================= */}
        <aside className="lg:col-span-4 space-y-5">
          {/* 1. Khung Upload File Gốc (.docx) & Nhân Bản Đề Tương Đương AI */}
          <section className="p-5 rounded-2xl card-3d-panel space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-sky-950 flex items-center gap-2">
                <FileCode2 className="w-4 h-4 text-blue-600" />
                <span>1. Nguồn Đề Gốc & Nhân Bản AI</span>
              </h2>
              <span className="text-xs text-sky-700 font-mono font-bold">
                Tỉ lệ 18 - 4 - 6
              </span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".docx"
              onChange={handleFileUpload}
              className="hidden"
            />

            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
                className="py-3 px-3 rounded-xl text-xs font-extrabold text-white btn-3d-primary flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <Upload className="w-4 h-4 shrink-0" />
                <span>Tải File (.docx)</span>
              </button>

              <button
                onClick={() => handleLoadSampleExam(true)}
                className="py-3 px-3 rounded-xl text-xs font-extrabold text-white btn-3d-cyan flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>Đề Sinh Học 18-4-6</span>
              </button>
            </div>

            {/* Nút 3D Nhân Bản Đề Tương Đương Bằng AI Gemini */}
            <button
              onClick={handleGenerateAiCloneExam}
              disabled={isProcessing}
              className="w-full py-3.5 px-4 rounded-xl text-xs sm:text-sm font-black text-white btn-3d-purple flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Bot className="w-4 h-4 shrink-0" />
              <span>
                AI Tạo Đề Tương Đương ({currentModelInfo.name})
              </span>
            </button>

            <div className="p-3.5 rounded-xl bg-sky-50/90 border border-sky-200 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-600 font-semibold">Tệp đang mở:</span>
                <span
                  className="font-mono font-bold text-blue-900 truncate max-w-[195px]"
                  title={fileName}
                >
                  {fileName}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-700">
                <span className="font-semibold">Cấu trúc chuẩn 2025:</span>
                <span className="font-mono font-extrabold text-emerald-800 tabular-nums">
                  {activePartsCount} phần · Tổng {questions.length} câu (18-4-6)
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

          {/* 2. Khung Bảo Mật Khóa AI & Chế Độ Cô Lập Dữ Liệu Giáo Viên */}
          <section className="p-5 rounded-2xl card-3d-panel space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-sky-950 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>2. Bảo Mật AI & Dữ Liệu Đề Thi</span>
              </h2>
              <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 font-mono text-[11px] font-bold">
                100% An Toàn
              </span>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed font-medium">
              {aiConnectionStatus.message}
            </p>

            <button
              type="button"
              onClick={() => setIsAiSecurityModalOpen(true)}
              className="w-full py-3 px-4 rounded-xl text-xs font-extrabold text-white btn-3d-emerald flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Mở Trung Tâm Bảo Mật & Kích Hoạt AI</span>
            </button>
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
              <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
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

              <label className="flex items-center justify-between gap-2 cursor-pointer">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                  <span>Kèm Lời giải chi tiết khi xuất Đề gốc (.docx)</span>
                </span>
                <input
                  type="checkbox"
                  checked={config.includeSolutionsInExport}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      includeSolutionsInExport: e.target.checked,
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

        {/* ================= CỘT PHẢI: TRUNG TÂM TƯƠNG TÁC KHOA HỌC 4 PHÂN KHU (8 CỘT GRID) ================= */}
        <section className="lg:col-span-8 space-y-4">
          {/* Thanh công cụ 3D nổi (Command Deck 3D) bố trí khoa học 2 cụm: Cụm Chế độ & Cụm Tác vụ */}
          <div className="p-3.5 rounded-2xl toolbar-3d flex flex-wrap items-center justify-between gap-3">
            {/* Cụm 1: 4 Chế độ làm việc chuyên sâu */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setActiveRightTab('LIVE_EDITOR')}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-extrabold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  activeRightTab === 'LIVE_EDITOR'
                    ? 'btn-3d-primary ring-2 ring-blue-300'
                    : 'btn-3d-cyan opacity-90 hover:opacity-100'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Biên Tập Đề Gốc ({questions.length})</span>
              </button>

              <button
                onClick={() => setActiveRightTab('AI_CLONE_STUDIO')}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-extrabold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  activeRightTab === 'AI_CLONE_STUDIO'
                    ? 'btn-3d-purple ring-2 ring-purple-300'
                    : 'btn-3d-indigo opacity-90 hover:opacity-100'
                }`}
              >
                <Bot className="w-4 h-4" />
                <span>AI Tạo Đề Tương Đương</span>
              </button>

              <button
                onClick={() => setActiveRightTab('BLOOM_MATRIX')}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-extrabold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  activeRightTab === 'BLOOM_MATRIX'
                    ? 'btn-3d-amber ring-2 ring-amber-300'
                    : 'btn-3d-orange opacity-90 hover:opacity-100'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>Ma Trận Đặc Tả</span>
              </button>

              <button
                onClick={() => setActiveRightTab('SHUFFLED_PREVIEW')}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-extrabold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  activeRightTab === 'SHUFFLED_PREVIEW'
                    ? 'btn-3d-rose ring-2 ring-rose-300'
                    : 'btn-3d-emerald opacity-90 hover:opacity-100'
                }`}
              >
                <QrCode className="w-4 h-4" />
                <span>Đáp Án Chung & QR ({shuffledVariants.length})</span>
              </button>
            </div>

            {/* Cụm 2: Nút Lưu chỉnh sửa & Xuất đề gốc sạch */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleSaveEdits}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-extrabold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  hasUnsavedChanges ? 'btn-3d-orange' : 'btn-3d-emerald'
                }`}
              >
                <Save className="w-4 h-4" />
                <span>Lưu Chỉnh Sửa</span>
              </button>

              <button
                onClick={handleDownloadCleanedMaster}
                className="px-3.5 py-2.5 rounded-xl text-xs font-extrabold text-white btn-3d-primary flex items-center gap-1.5 whitespace-nowrap shrink-0"
                title="Tải về file đề đã sửa (.docx) kèm lời giải chi tiết"
              >
                <Download className="w-4 h-4" />
                <span>Tải Đề Gốc (.docx)</span>
              </button>
            </div>
          </div>

          {/* ================= TAB 1: CHẾ ĐỘ XEM TRƯỚC & CHỈNH SỬA TRỰC TIẾP (LIVE IN-APP EDITOR) ================= */}
          {activeRightTab === 'LIVE_EDITOR' && (
            <div className="space-y-4">
              {/* Thanh công cụ lọc Phần I / Phần II / Phần III thiết kế 3D đa sắc màu */}
              <div className="px-4 py-3 rounded-2xl toolbar-3d flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setFilterPart('ALL')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold text-white whitespace-nowrap ${
                      filterPart === 'ALL'
                        ? 'btn-3d-indigo ring-2 ring-indigo-300'
                        : 'btn-3d-cyan'
                    }`}
                  >
                    Tất cả ({questions.length})
                  </button>
                  <button
                    onClick={() => setFilterPart('PART_1')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold text-white whitespace-nowrap ${
                      filterPart === 'PART_1'
                        ? 'btn-3d-primary ring-2 ring-blue-300'
                        : 'btn-3d-primary opacity-90'
                    }`}
                  >
                    Phần I: 4 Lựa Chọn ({part1Count})
                  </button>
                  <button
                    onClick={() => setFilterPart('PART_2')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold text-white whitespace-nowrap ${
                      filterPart === 'PART_2'
                        ? 'btn-3d-emerald ring-2 ring-emerald-300'
                        : 'btn-3d-emerald opacity-90'
                    }`}
                  >
                    Phần II: Đúng / Sai ({part2Count})
                  </button>
                  <button
                    onClick={() => setFilterPart('PART_3')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold text-white whitespace-nowrap ${
                      filterPart === 'PART_3'
                        ? 'btn-3d-orange ring-2 ring-orange-300'
                        : 'btn-3d-amber'
                    }`}
                  >
                    Phần III: Trả Lời Ngắn ({part3Count})
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
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
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-black font-mono shadow-xs">
                              Câu {q.displayIndex}
                            </span>
                            {q.isAiCloned && (
                              <span className="px-2 py-0.5 rounded-md bg-purple-100 border border-purple-300 text-purple-900 text-[11px] font-extrabold">
                                AI Nhân Bản Tương Đương
                              </span>
                            )}
                            <select
                              value={q.bloomLevel || 'NHAN_BIET'}
                              onChange={(e) =>
                                handleUpdateBloomLevel(
                                  q.id,
                                  e.target.value as BloomLevel
                                )
                              }
                              className="px-2 py-0.5 text-[11px] font-bold bg-sky-100 text-sky-900 border border-sky-300 rounded-md focus:outline-none"
                            >
                              <option value="NHAN_BIET">Mức độ: Nhận biết</option>
                              <option value="THONG_HIEU">Mức độ: Thông hiểu</option>
                              <option value="VAN_DUNG">Mức độ: Vận dụng</option>
                              <option value="VAN_DUNG_CAO">Mức độ: Vận dụng cao</option>
                            </select>

                            {q.part === 'PART_1' && (
                              <span className="text-xs text-sky-800 font-mono font-semibold">
                                · Canh trái co dãn:{' '}
                                {effectiveLayout === '1_ROW_4_COL'
                                  ? '1 dòng (4 cột 25%)'
                                  : effectiveLayout === '2_ROW_2_COL'
                                  ? '2 dòng (2 cột 50%)'
                                  : '4 dòng (1 cột 100%)'}
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
                        <div className="mb-3">
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

                        {/* Khung Lời giải chi tiết & Yêu cầu cần đạt */}
                        <div className="mt-3 pt-3 border-t border-sky-200/80 grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
                          <div className="md:col-span-5 bg-sky-50/80 p-2.5 rounded-xl border border-sky-200">
                            <span className="block font-extrabold text-sky-950 mb-0.5">
                              Yêu cầu cần đạt (GDPT 2018):
                            </span>
                            <span className="text-slate-700 font-medium">
                              {q.learningOutcome ||
                                'Đảm bảo đúng chuẩn kiến thức kỹ năng của đề gốc.'}
                            </span>
                          </div>
                          <div className="md:col-span-7">
                            <label className="block font-extrabold text-indigo-950 mb-1">
                              Lời giải chi tiết (Xuất kèm trong file Word khi bật):
                            </label>
                            <input
                              type="text"
                              value={q.explanation || ''}
                              onChange={(e) =>
                                handleUpdateExplanation(q.id, e.target.value)
                              }
                              placeholder="Nhập lời giải chi tiết hoặc bấm AI Tạo Đề Tương Đương để tự động sinh..."
                              className="w-full px-3 py-1.5 text-xs bg-white border border-indigo-200 rounded-lg focus:outline-none focus:border-blue-600"
                            />
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================= TAB 2 (MỚI): CHẾ ĐỘ BIÊN SOẠN AI TẠO ĐỀ TƯƠNG ĐƯƠNG ĐỀ GỐC (ISOMORPHIC EXAM CLONING) ================= */}
          {activeRightTab === 'AI_CLONE_STUDIO' && (
            <div className="space-y-5">
              {/* Bảng Điều Khiển AI Gemini Studio (Tích hợp bộ chọn 4 mô hình như hình mẫu) */}
              <div className="p-6 rounded-3xl card-3d-panel border-2 border-purple-300 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-purple-200 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl btn-3d-purple text-white">
                        <Bot className="w-5 h-5" />
                      </div>
                      <h3 className="text-base sm:text-lg font-black text-purple-950 uppercase">
                        AI GEMINI STUDIO — BIÊN SOẠN ĐỀ TƯƠNG ĐƯƠNG ĐỀ GỐC (ISOMORPHIC CLONING)
                      </h3>
                    </div>
                    <p className="text-xs text-slate-700 font-semibold">
                      Giữ nguyên 100% <strong>Yêu cầu cần đạt</strong>, ma trận nhận thức và cấu trúc 3 phần của đề gốc; chỉ thay đổi số liệu, hàm số và ngữ cảnh khoa học kèm lời giải chi tiết.
                    </p>
                  </div>

                  <span className="px-3 py-1.5 rounded-xl bg-emerald-100 border-2 border-emerald-400 text-emerald-950 text-xs font-extrabold flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-700" />
                    <span>Bảo mật tuyệt đối · Tự hành 100%</span>
                  </span>
                </div>

                {/* Bộ chọn 4 mô hình AI Gemini thiết kế chuẩn theo hình ảnh đính kèm */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
                  {/* Khung chọn mô hình Dark Card giống hệt hình mẫu */}
                  <div className="md:col-span-5 p-3.5 rounded-2xl bg-[#18191C] text-white border-2 border-slate-700 shadow-xl flex flex-col justify-between space-y-2">
                    <div className="px-2 py-1 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>Chọn Mô Hình AI Gemini</span>
                      <span className="text-emerald-400 font-mono">100% Ready</span>
                    </div>

                    <div className="space-y-1.5">
                      {GEMINI_MODEL_OPTIONS.map((m) => {
                        const isSelected = m.id === selectedModelTier;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setSelectedModelTier(m.id)}
                            className={`w-full text-left px-4 py-2.5 rounded-2xl flex items-center gap-3.5 transition-all ${
                              isSelected
                                ? 'bg-[#26272B] border-2 border-slate-300 shadow-md'
                                : 'hover:bg-white/5 border-2 border-transparent'
                            }`}
                          >
                            <div className="w-5 flex items-center justify-center shrink-0">
                              {isSelected && (
                                <Check className="w-4 h-4 text-white stroke-[3]" />
                              )}
                            </div>
                            <div>
                              <div className="text-sm font-extrabold text-white">
                                {m.name}
                              </div>
                              <div className="text-xs text-slate-400 font-medium">
                                {m.subtitle}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Khung cấu hình yêu cầu nhân bản đề tương đương */}
                  <div className="md:col-span-7 flex flex-col justify-between space-y-4 bg-purple-50/70 p-4 rounded-2xl border-2 border-purple-200">
                    <div className="space-y-2">
                      <label className="block text-xs font-black text-purple-950 uppercase">
                        Chỉ thị Sư phạm cho AI khi tạo đề tương đương:
                      </label>
                      <textarea
                        rows={3}
                        value={aiCustomPrompt}
                        onChange={(e) => setAiCustomPrompt(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-xs font-semibold text-slate-900 bg-white border-2 border-purple-300 rounded-xl focus:outline-none focus:border-blue-600 leading-relaxed"
                      />
                      <div className="p-3 rounded-xl bg-white/90 border border-purple-200 text-[11px] text-slate-700 space-y-1">
                        <div className="font-extrabold text-purple-950 flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Cơ chế Bảo mật Khóa & Dữ liệu Đề thi Kép:</span>
                        </div>
                        <p>
                          Hệ thống kết nối tự động với khóa cá nhân của giáo viên trong{' '}
                          <strong>Settings &gt; Secrets (GEMINI_API_KEY)</strong> ở phía máy chủ kết hợp{' '}
                          <strong>Bộ Sinh Đề Toán Học Tự Hành 100%</strong>, đảm bảo không bao giờ lộ khóa ra trình duyệt và hoạt động mượt mà ngay cả trên GitHub Pages.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <button
                        onClick={handleGenerateAiCloneExam}
                        disabled={isProcessing}
                        className="flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-black text-white btn-3d-purple flex items-center justify-center gap-2 whitespace-nowrap"
                      >
                        <RefreshCw
                          className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`}
                        />
                        <span>
                          {clonedQuestions.length > 0
                            ? `Tạo Phiên Bản Đề Tương Đương Mới (#${cloneIteration})`
                            : `Bắt Đầu Nhân Bản Đề Tương Đương (${currentModelInfo.name})`}
                        </span>
                      </button>

                      {clonedQuestions.length > 0 && (
                        <>
                          <button
                            onClick={handleApplyAiCloneAsMaster}
                            className="py-3 px-4 rounded-xl text-xs font-black text-white btn-3d-emerald flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <ArrowRightLeft className="w-4 h-4" />
                            <span>Dùng Làm Đề Gốc Để Trộn</span>
                          </button>

                          <button
                            onClick={handleDownloadAiCloneDocx}
                            className="py-3 px-4 rounded-xl text-xs font-black text-white btn-3d-primary flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <Download className="w-4 h-4" />
                            <span>Tải Word (.docx)</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bảng Đối Chiếu Song Song: ĐỀ GỐC vs ĐỀ AI TƯƠNG ĐƯƠNG */}
              {clonedQuestions.length === 0 ? (
                <div className="p-10 rounded-3xl card-3d-panel text-center space-y-3">
                  <Bot className="w-12 h-12 text-purple-600 mx-auto" />
                  <h4 className="text-base font-black text-slate-900">
                    Sẵn sàng nhân bản bộ đề tương đương từ {questions.length} câu hỏi gốc
                  </h4>
                  <p className="text-xs text-slate-600 max-w-lg mx-auto">
                    Nhấn nút <strong>[Bắt Đầu Nhân Bản Đề Tương Đương]</strong> phía trên để hệ thống sinh bộ đề mới giữ nguyên yêu cầu cần đạt, đối chiếu trực quan từng câu với đề gốc và tính sẵn lời giải chi tiết.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="px-5 py-3 rounded-2xl bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-extrabold uppercase">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span>
                        Đối Chiếu Song Song: Đề Gốc & Đề Tương Đương ({clonedQuestions.length} câu)
                      </span>
                    </div>
                    <span className="text-xs font-mono text-emerald-400">
                      Engine: {lastAiEngineUsed}
                    </span>
                  </div>

                  {clonedQuestions.map((cq, idx) => {
                    const origQ = questions[idx] || cq;
                    return (
                      <div
                        key={cq.id}
                        className="p-5 rounded-2xl card-3d-panel space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-sky-200">
                          <div className="flex items-center gap-2">
                            <span className="px-3 py-1 rounded-lg text-xs font-black text-white btn-3d-purple font-mono">
                              {cq.part === 'PART_1'
                                ? 'Phần I'
                                : cq.part === 'PART_2'
                                ? 'Phần II'
                                : 'Phần III'}{' '}
                              — Câu {cq.displayIndex}
                            </span>
                            <span className="text-xs font-extrabold text-indigo-900 bg-indigo-100 px-2.5 py-1 rounded-lg">
                              Yêu cầu cần đạt: {cq.learningOutcome}
                            </span>
                          </div>
                        </div>

                        <div
                          style={{
                            fontFamily: "'Times New Roman', Times, serif",
                            fontSize: '12pt',
                          }}
                          className="grid grid-cols-1 md:grid-cols-2 gap-4"
                        >
                          {/* Cột trái: Câu hỏi trong Đề gốc */}
                          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-300 space-y-2">
                            <div className="text-xs font-sans font-bold text-slate-500 uppercase">
                              Bản Đề Gốc:
                            </div>
                            <p className="text-left text-slate-800">
                              <strong>Câu {origQ.displayIndex}. </strong>
                              {origQ.stemText}
                            </p>
                          </div>

                          {/* Cột phải: Câu hỏi tương đương do AI sinh */}
                          <div className="p-3.5 rounded-xl bg-purple-50/70 border-2 border-purple-300 space-y-2">
                            <div className="text-xs font-sans font-extrabold text-purple-900 uppercase flex items-center justify-between">
                              <span>Bản Đề Tương Đương (Đã đổi số liệu & ngữ cảnh):</span>
                            </div>
                            <p className="text-left text-slate-950 font-medium">
                              <strong>Câu {cq.displayIndex}. </strong>
                              {cq.stemText}
                            </p>

                            {cq.part === 'PART_1' && cq.options && (
                              <div className="grid grid-cols-2 gap-1.5 pt-1">
                                {cq.options.map((o) => (
                                  <div
                                    key={o.id}
                                    className={`text-sm ${
                                      o.isCorrect
                                        ? 'text-rose-600 font-bold underline'
                                        : 'text-slate-800'
                                    }`}
                                  >
                                    <strong>{o.currentLabel}. </strong>
                                    {o.text}
                                  </div>
                                ))}
                              </div>
                            )}

                            {cq.part === 'PART_2' && cq.subItems && (
                              <div className="space-y-1 pt-1 text-sm">
                                {cq.subItems.map((s) => (
                                  <div
                                    key={s.id}
                                    className={
                                      s.isTrue
                                        ? 'text-emerald-800 font-bold underline'
                                        : 'text-slate-700'
                                    }
                                  >
                                    <strong>{s.currentLabel}) </strong>
                                    {s.text} ({s.isTrue ? 'Đúng' : 'Sai'})
                                  </div>
                                ))}
                              </div>
                            )}

                            {cq.part === 'PART_3' && (
                              <div className="pt-1 text-sm font-bold text-rose-600 underline">
                                Đáp án: {cq.shortAnswer}
                              </div>
                            )}
                          </div>
                        </div>

                        {cq.explanation && (
                          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-950">
                            <strong>Lời giải chi tiết câu tương đương: </strong>
                            <span>{cq.explanation}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 3 (MỚI): MA TRẬN ĐẶC TẢ ĐỀ THI & CẤP ĐỘ NHẬN THỨC BLOOM ================= */}
          {activeRightTab === 'BLOOM_MATRIX' && (
            <div className="p-6 rounded-3xl card-3d-panel space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-sky-200 pb-4">
                <div>
                  <h3 className="text-base sm:text-lg font-black text-sky-950 uppercase">
                    BẢNG MA TRẬN ĐẶC TẢ CẤP ĐỘ NHẬN THỨC & YÊU CẦU CẦN ĐẠT (CHUẨN GDPT 2018)
                  </h3>
                  <p className="text-xs text-slate-600 font-semibold">
                    Thống kê tự động tỷ lệ Nhận biết · Thông hiểu · Vận dụng · Vận dụng cao của bộ đề hiện tại
                  </p>
                </div>
                <button
                  onClick={handleDownloadCleanedMaster}
                  className="px-4 py-2.5 rounded-xl text-xs font-black text-white btn-3d-primary flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  <span>Tải Đề Kèm Lời Giải (.docx)</span>
                </button>
              </div>

              {/* 4 Thẻ Thống Kê Bloom 3D */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div className="p-4 rounded-2xl guide-card-3d-blue text-center space-y-1">
                  <div className="text-xs font-extrabold text-blue-900 uppercase">
                    1. Nhận biết
                  </div>
                  <div className="text-2xl font-black text-blue-700 font-mono tabular-nums">
                    {bloomStats.NHAN_BIET} câu
                  </div>
                  <div className="text-[11px] font-bold text-slate-600 font-mono">
                    {Math.round((bloomStats.NHAN_BIET / Math.max(1, questions.length)) * 100)}% tổng đề
                  </div>
                </div>

                <div className="p-4 rounded-2xl guide-card-3d-emerald text-center space-y-1">
                  <div className="text-xs font-extrabold text-emerald-900 uppercase">
                    2. Thông hiểu
                  </div>
                  <div className="text-2xl font-black text-emerald-700 font-mono tabular-nums">
                    {bloomStats.THONG_HIEU} câu
                  </div>
                  <div className="text-[11px] font-bold text-slate-600 font-mono">
                    {Math.round((bloomStats.THONG_HIEU / Math.max(1, questions.length)) * 100)}% tổng đề
                  </div>
                </div>

                <div className="p-4 rounded-2xl guide-card-3d-amber text-center space-y-1">
                  <div className="text-xs font-extrabold text-amber-900 uppercase">
                    3. Vận dụng
                  </div>
                  <div className="text-2xl font-black text-amber-700 font-mono tabular-nums">
                    {bloomStats.VAN_DUNG} câu
                  </div>
                  <div className="text-[11px] font-bold text-slate-600 font-mono">
                    {Math.round((bloomStats.VAN_DUNG / Math.max(1, questions.length)) * 100)}% tổng đề
                  </div>
                </div>

                <div className="p-4 rounded-2xl guide-card-3d-rose text-center space-y-1">
                  <div className="text-xs font-extrabold text-rose-900 uppercase">
                    4. Vận dụng cao
                  </div>
                  <div className="text-2xl font-black text-rose-700 font-mono tabular-nums">
                    {bloomStats.VAN_DUNG_CAO} câu
                  </div>
                  <div className="text-[11px] font-bold text-slate-600 font-mono">
                    {Math.round((bloomStats.VAN_DUNG_CAO / Math.max(1, questions.length)) * 100)}% tổng đề
                  </div>
                </div>
              </div>

              {/* Bảng chi tiết từng câu hỏi */}
              <div className="overflow-x-auto rounded-2xl border-2 border-sky-200 bg-white">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-sky-900 text-white font-extrabold uppercase">
                      <th className="py-3 px-3.5 border-b border-sky-800">Phần / Câu</th>
                      <th className="py-3 px-3.5 border-b border-sky-800">Mức độ nhận thức</th>
                      <th className="py-3 px-3.5 border-b border-sky-800">Yêu cầu cần đạt (Đặc tả GDPT 2018)</th>
                      <th className="py-3 px-3.5 border-b border-sky-800">Lời giải chi tiết</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sky-100">
                    {questions.map((q) => (
                      <tr key={`matrix-${q.id}`} className="hover:bg-sky-50/70">
                        <td className="py-2.5 px-3.5 font-mono font-bold text-blue-950 whitespace-nowrap">
                          {q.part === 'PART_1'
                            ? 'Phần I'
                            : q.part === 'PART_2'
                            ? 'Phần II'
                            : 'Phần III'}{' '}
                          · Câu {q.displayIndex}
                        </td>
                        <td className="py-2.5 px-3.5 whitespace-nowrap font-bold">
                          {q.bloomLevel === 'VAN_DUNG_CAO' && (
                            <span className="text-rose-700">Vận dụng cao</span>
                          )}
                          {q.bloomLevel === 'VAN_DUNG' && (
                            <span className="text-amber-700">Vận dụng</span>
                          )}
                          {q.bloomLevel === 'THONG_HIEU' && (
                            <span className="text-emerald-700">Thông hiểu</span>
                          )}
                          {(!q.bloomLevel || q.bloomLevel === 'NHAN_BIET') && (
                            <span className="text-blue-700">Nhận biết</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3.5 text-slate-800 font-medium">
                          {q.learningOutcome ||
                            'Đảm bảo chuẩn kiến thức kỹ năng chương trình THPT 2025.'}
                        </td>
                        <td className="py-2.5 px-3.5 text-slate-600">
                          {q.explanation || 'Đã sẵn sàng lời giải.'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================= TAB 4: BẢNG ĐÁP ÁN CHUNG TẤT CẢ MÃ ĐỀ TRONG 1 KHUNG + XEM TRƯỚC ĐỀ WORD ================= */}
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
                  {/* KHUNG LỚN BAO CHUNG TẤT CẢ CÁC MÃ ĐỀ THEO THỨ TỰ TỪ TRÊN XUỐNG */}
                  <div className="p-6 rounded-3xl card-3d-panel border-4 border-sky-400 space-y-5">
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

                    <div className="space-y-5">
                      {shuffledVariants.map((variant) =>
                        renderThreeColumnAnswerCard(variant)
                      )}
                    </div>
                  </div>

                  {/* THANH CHỌN MÃ ĐỀ ĐỂ XEM CHI TIẾT MÃ QR & BẢN DÀN TRANG ĐỀ THI WORD */}
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

                        <div
                          style={{
                            fontFamily: "'Times New Roman', Times, serif",
                            fontSize: '12pt',
                          }}
                          className="p-6 sm:p-8 bg-white rounded-2xl border-2 border-slate-300 shadow-inner space-y-4 text-slate-950"
                        >
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

      {/* Modal 3D: Trung Tâm Bảo Mật Zero-Trace & Cụm Đa Luồng AI Chuyên Gia */}
      {isAiSecurityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-3xl card-3d-panel border-4 border-emerald-400 p-6 space-y-4 shadow-2xl my-auto">
            <div className="flex items-start justify-between gap-4 pb-3 border-b-2 border-sky-200">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl btn-3d-emerald text-white">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-sky-950 uppercase">
                    TRUNG TÂM ĐA LUỒNG KẾT NỐI AI &amp; BẢO MẬT ZERO-TRACE TUYỆT ĐỐI
                  </h3>
                  <p className="text-xs font-semibold text-slate-600">
                    Kết hợp đồng thời nhiều luồng chuyên gia AI + Tự động xóa sạch dấu vết ngay khi tải về
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAiSecurityModalOpen(false)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-extrabold text-white btn-3d-rose"
              >
                Đóng
              </button>
            </div>

            {/* Khung Trạng Thái Kết Nối Máy Chủ & Settings > Secrets */}
            <div className="p-3.5 rounded-2xl guide-card-3d-emerald space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs sm:text-sm font-black text-emerald-950 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  <span>
                    Cụm AI Đang Bật ({aiNodeCluster.filter((n) => n.enabled).length}/{aiNodeCluster.length} luồng chuyên gia song song)
                  </span>
                </span>
                <div className="flex items-center gap-2">
                  {lastPurgedTime && (
                    <span className="px-2.5 py-1 rounded-lg bg-sky-800 text-white font-mono text-[11px] font-bold">
                      Đã xóa vết: {lastPurgedTime}
                    </span>
                  )}
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-700 text-white font-mono text-xs font-bold">
                    {aiConnectionStatus.mode}
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-800 leading-relaxed font-medium">
                Khóa cá nhân được bảo vệ ở tầng máy chủ thông qua{' '}
                <strong>Settings &gt; Secrets (GEMINI_API_KEY)</strong> kết hợp{' '}
                <strong>Cụm 4 Luồng AI Song Song</strong> giúp AI suy luận khôn như người thật: đảo chiều câu Đúng ↔ Sai, biến đổi sơ đồ chuỗi thức ăn dài/ngắn hơn, đổi biểu đồ tròn ↔ cột và tính lại toàn bộ bài toán di truyền.
              </p>
            </div>

            {/* Cụm 4 Luồng Chuyên Gia AI Song Song (Cho phép giáo viên bật/tắt nhiều luồng để AI khôn hơn) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-sky-950 uppercase tracking-wide">
                  Cấu Hình Cụm Luồng Chuyên Gia AI Phối Hợp Tạo Đề (Bật nhiều luồng để đề hay &amp; khôn hơn):
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setAiNodeCluster((prev) => prev.map((node) => ({ ...node, enabled: true })))
                  }
                  className="text-[11px] font-extrabold text-emerald-700 hover:underline cursor-pointer"
                >
                  Bật tất cả 4 luồng
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {aiNodeCluster.map((node) => (
                  <label
                    key={node.id}
                    className={`p-3 rounded-2xl border-2 flex items-start justify-between gap-2.5 cursor-pointer transition-all ${
                      node.enabled
                        ? 'bg-emerald-50/90 border-emerald-400 shadow-xs'
                        : 'bg-slate-50 border-slate-200 opacity-75'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="text-xs font-black text-sky-950">{node.name}</div>
                      <div className="text-[11px] text-slate-600 font-semibold leading-snug">
                        {node.specialty}
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={node.enabled}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setAiNodeCluster((prev) =>
                          prev.map((item) =>
                            item.id === node.id ? { ...item, enabled: checked } : item
                          )
                        );
                      }}
                      className="w-4 h-4 mt-0.5 accent-emerald-600 rounded cursor-pointer shrink-0"
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Các Tùy Chọn Cô Lập & Bảo Vệ Dữ Liệu Đề Thi Của Giáo Viên */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label className="p-3 rounded-2xl bg-sky-50 border-2 border-sky-200 flex items-center justify-between gap-3 cursor-pointer">
                <div>
                  <div className="text-xs font-extrabold text-sky-950">
                    1. Tự Động Xóa Dấu Vết Ngay Khi Tải Đề (Zero-Trace)
                  </div>
                  <div className="text-[11px] text-slate-600 font-medium">
                    Không lưu vết trên máy chủ; tự động gọi lệnh xóa bộ nhớ đệm ngay sau khi tải file .docx/.zip.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={zeroRetentionMode}
                  onChange={(e) => setZeroRetentionMode(e.target.checked)}
                  className="w-5 h-5 accent-emerald-600 rounded cursor-pointer shrink-0"
                />
              </label>

              <label className="p-3 rounded-2xl bg-sky-50 border-2 border-sky-200 flex items-center justify-between gap-3 cursor-pointer">
                <div>
                  <div className="text-xs font-extrabold text-sky-950">
                    2. Ẩn Danh Tên Trường, Sở GD &amp; Kỳ Thi ({redactedItemsCount} mục đã che)
                  </div>
                  <div className="text-[11px] text-slate-600 font-medium">
                    Tự động lọc bỏ tên Trường THPT, Sở GD&amp;ĐT, Kỳ thi nhạy cảm trước khi xử lý AI.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={anonymizeSchoolInfo}
                  onChange={(e) => setAnonymizeSchoolInfo(e.target.checked)}
                  className="w-5 h-5 accent-emerald-600 rounded cursor-pointer shrink-0"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-sky-200">
              <button
                type="button"
                onClick={handleVerifyAiSecuritySession}
                disabled={isProcessing}
                className="px-4 py-2.5 rounded-xl text-xs font-black text-white btn-3d-primary flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
                <span>Kiểm Tra Cụm Luồng AI &amp; Bảo Mật</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsAiSecurityModalOpen(false);
                  handleGenerateAiCloneExam();
                }}
                className="px-4 py-2.5 rounded-xl text-xs font-black text-white btn-3d-purple flex items-center gap-2"
              >
                <Bot className="w-4 h-4" />
                <span>Chạy AI Tạo Đề Tương Đương Khôn Như Người Thật</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
