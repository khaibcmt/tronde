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
  Edit3,
  FileArchive,
  FileCheck,
  FileCode2,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Image as ImageIcon,
  Layers,
  ListRestart,
  Maximize2,
  Palette,
  Plus,
  QrCode,
  RefreshCw,
  Save,
  ShieldCheck,
  Shuffle,
  Sigma,
  Sliders,
  Sparkles,
  Trash2,
  Underline,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import {
  BloomLevel,
  ExamImageAttachment,
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
  normalizeAllQuestionsStrictFourOptions,
  parseDocxExamFile,
  parseRawTextToExamQuestions,
  recalculateQuestionNumbering,
  serializeQuestionsToWordRawText,
  validateExamQuestions,
} from './utils/docxParser';
import { parsePdfExamFile } from './utils/pdfParser';
import { generateShuffledVariants } from './utils/shuffleEngine';
import {
  buildStandardExportFileName,
  exportAllVariantsZipBundle,
  exportCleanedMasterDocx,
  exportFourAiClonesZipBundle,
  exportMasterAnswerSheetDocx,
  exportMasterExamWithSolutionsDocx,
  exportQrCodesZip,
  exportSingleVariantDocx,
  formatPedagogicalSubject,
  triggerBrowserDownload,
} from './utils/docxExporter';
import {
  AiClonedExamVariant,
  AiConnectionStatus,
  AiNodeChannel,
  DEFAULT_AI_NODE_CLUSTER,
  GEMINI_MODEL_OPTIONS,
  checkAiPrivacyConnectionStatus,
  generateFourSimultaneousAiExams,
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
  const [answerSheetViewMode, setAnswerSheetViewMode] = useState<
    'KHAO_THI_A4' | 'THREE_COLUMN_CARDS'
  >('KHAO_THI_A4');
  const [statusBanner, setStatusBanner] = useState<{
    type: 'SUCCESS' | 'INFO' | 'ERROR';
    text: string;
  } | null>(null);

  // 2. State cấu hình Trộn đề, Tiêu đề Quốc ngữ, Môn thi (SINH HỌC), Kỳ thi, Số phút (50 phút) & Mã QR
  const [config, setConfig] = useState<ShuffleConfig>({
    numVariants: 4,
    examCodeDigits: 3,
    customCodes: ['101', '102', '103', '104'],
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
    examTitle: 'KIỂM TRA GIỮA KÌ I',
    examSubtitle: 'ĐỀ THI CHÍNH THỨC',
    subjectName: 'SINH HỌC',
    gradeLevel: 'Lớp 12',
    schoolYear: `Năm học ${new Date().getFullYear()} - ${new Date().getFullYear() + 1}`,
    durationMinutes: 50,
  });
  const [isConfigCollapsed, setIsConfigCollapsed] = useState<boolean>(false);
  const [showCustomCodeEditor, setShowCustomCodeEditor] = useState<boolean>(false);

  // 2b. State Chế độ Soạn thảo Trực tiếp kiểu MS Word (Word Ribbon + Trang A4)
  const [editorViewMode, setEditorViewMode] = useState<'CARDS_3D' | 'WORD_A4_PAGE'>('CARDS_3D');
  const [wordRawDocumentText, setWordRawDocumentText] = useState<string>(() =>
    serializeQuestionsToWordRawText(SAMPLE_2025_EXAM_WITH_ERRORS)
  );
  const [wordFontSizePt, setWordFontSizePt] = useState<number>(12);
  const [activeFocusedQuestionId, setActiveFocusedQuestionId] = useState<string | null>(null);

  // 3. State AI Gemini Studio (Sinh Cùng Lúc 4 Đề AI Tương Đương Khác Nhau) & Bảo mật Zero-Trace
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
        'Đã kích hoạt Cụm 4 Luồng Chuyên Gia AI (Settings > Secrets) + Sinh cùng lúc 4 Đề AI khác nhau + Ẩn danh Trường/Kỳ thi + Tự xóa dấu vết sau khi tải.',
    });

  const [aiCustomPrompt, setAiCustomPrompt] = useState<string>(
    'Sinh cùng lúc 4 Đề AI khác nhau: Đảo chiều câu hỏi Đúng thành Sai (và ngược lại), đổi câu đếm ý đúng sang đếm ý sai, đổi số liệu bài toán di truyền, thay đổi sơ đồ chuỗi thức ăn dài hơn/ngắn hơn và chuyển biểu đồ hình tròn sang biểu đồ dạng cột. Mỗi câu Phần I và Phần II bắt buộc đủ 4 phương án.'
  );
  const [numAiExamsToGenerate, setNumAiExamsToGenerate] = useState<1 | 2 | 3 | 4>(1);
  const [aiTeacherGuidance, setAiTeacherGuidance] = useState<string>(
    'Ưu tiên đổi số liệu chẵn dễ tính toán, đảo câu hỏi Đúng thành Sai (và ngược lại), thay đổi ví dụ sinh vật/hiện tượng thực tiễn nhưng giữ nguyên mức độ nhận thức của đề gốc.'
  );
  const [aiClonedVariants, setAiClonedVariants] = useState<AiClonedExamVariant[]>([]);
  const [selectedAiVariantIdx, setSelectedAiVariantIdx] = useState<number>(0);
  const [clonedQuestions, setClonedQuestions] = useState<ExamQuestion[]>([]);
  const [cloneIteration, setCloneIteration] = useState<number>(1);
  const [lastAiEngineUsed, setLastAiEngineUsed] = useState<string>(
    '3.8 Flash · Cụm 4 Luồng Chuyên Gia (4 Đề Song Song)'
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

  // Modal xem phóng to sơ đồ / hình ảnh
  const [previewModalImage, setPreviewModalImage] = useState<{
    src: string;
    caption?: string;
  } | null>(null);

  // Thêm ảnh / sơ đồ đính kèm vào câu hỏi
  const handleAddImageToQuestion = (
    questionId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (!dataUrl) return;

      setQuestions((prev) =>
        prev.map((q) => {
          if (q.id !== questionId) return q;
          const newImg: ExamImageAttachment = {
            id: `img-man-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            dataUrl,
            fileName: file.name,
            caption: `Hình minh họa Câu ${q.displayIndex}`,
          };
          return {
            ...q,
            hasImage: true,
            images: [...(q.images || []), newImg],
          };
        })
      );
      setHasUnsavedChanges(true);
      setStatusBanner({
        type: 'SUCCESS',
        text: `Đã đính kèm ảnh "${file.name}" vào câu hỏi.`,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Xóa ảnh / sơ đồ khỏi câu hỏi
  const handleRemoveImageFromQuestion = (
    questionId: string,
    imageId: string
  ) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== questionId) return q;
        const filtered = (q.images || []).filter((img) => img.id !== imageId);
        return {
          ...q,
          hasImage: filtered.length > 0,
          images: filtered.length > 0 ? filtered : undefined,
        };
      })
    );
    setHasUnsavedChanges(true);
  };

  // ================= HANDLERS: UPLOAD & PARSE DOCX & PDF =================
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const isPdf =
        file.name.toLowerCase().endsWith('.pdf') ||
        file.type === 'application/pdf';

      const parsed = isPdf
        ? await parsePdfExamFile(file, config.resetNumberingPerPart)
        : await parseDocxExamFile(file, config.resetNumberingPerPart);

      if (parsed.length === 0) {
        setStatusBanner({
          type: 'ERROR',
          text: `Không tìm thấy câu hỏi hợp lệ trong tệp ${isPdf ? 'PDF' : 'Word'}. Vui lòng kiểm tra lại cấu trúc câu hỏi.`,
        });
      } else {
        const totalImages = parsed.reduce(
          (acc, q) => acc + (q.images?.length || 0),
          0
        );
        const formulaCount = parsed.filter((q) => q.hasFormula).length;

        setFileName(file.name);
        setQuestions(parsed);
        setWordRawDocumentText(serializeQuestionsToWordRawText(parsed));
        setHasUnsavedChanges(false);
        setShuffledVariants([]);
        setClonedQuestions([]);
        setAiClonedVariants([]);
        setActiveRightTab('LIVE_EDITOR');
        setLastSavedAt(new Date().toLocaleTimeString('vi-VN'));
        setStatusBanner({
          type: 'SUCCESS',
          text: `Đã phân tích thông minh & tách câu dính chùm tệp "${file.name}" (${parsed.length} câu hỏi chuẩn 4 đáp án${
            totalImages > 0 ? `, nhận diện ${totalImages} sơ đồ/hình ảnh` : ''
          }${formulaCount > 0 ? `, ${formulaCount} câu có công thức` : ''}).`,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi xử lý file';
      setStatusBanner({
        type: 'ERROR',
        text: `Không thể phân tích tệp: ${message}`,
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
    const numbered = normalizeAllQuestionsStrictFourOptions(
      cloned,
      config.resetNumberingPerPart
    );
    setQuestions(numbered);
    setWordRawDocumentText(serializeQuestionsToWordRawText(numbered));
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
      text: 'Đã nạp Đề Thi Chuẩn THPT 2025 — Môn Sinh Học (Tỉ lệ 18 - 4 - 6 = 28 câu, chuẩn 100% 4 đáp án mỗi câu Phần I & II). Giáo viên có thể bấm [Trộn Đề Ngay] hoặc [AI Sinh Cùng Lúc 4 Đề]!',
    });
  };

  // ================= HANDLER: TÁCH CÂU DÍNH CHÙM & ÉP CHUẨN ĐỦ 4 ĐÁP ÁN =================
  const handleNormalizeAndDeClumpAllQuestions = () => {
    const normalized = normalizeAllQuestionsStrictFourOptions(
      questions,
      config.resetNumberingPerPart
    );
    setQuestions(normalized);
    setWordRawDocumentText(serializeQuestionsToWordRawText(normalized));
    setHasUnsavedChanges(false);
    setLastSavedAt(new Date().toLocaleTimeString('vi-VN'));
    setStatusBanner({
      type: 'SUCCESS',
      text: 'Đã tự động tách các câu hỏi/đáp án dính chùm và ép chuẩn bắt buộc đủ 4 phương án cho mọi câu ở Phần I (A, B, C, D) và Phần II (a, b, c, d)!',
    });
  };

  // Đồng bộ từ trình soạn thảo trang giấy Word A4 sang danh sách câu hỏi chuẩn 4 đáp án
  const handleSyncFromWordA4Editor = () => {
    const parsedFromWord = parseRawTextToExamQuestions(
      wordRawDocumentText,
      config.resetNumberingPerPart
    );
    if (parsedFromWord.length === 0) {
      setStatusBanner({
        type: 'ERROR',
        text: 'Không nhận diện được câu hỏi nào từ trang soạn thảo Word. Hãy đảm bảo có tiêu đề Câu 1., Câu 2...',
      });
      return;
    }
    setQuestions(parsedFromWord);
    setWordRawDocumentText(serializeQuestionsToWordRawText(parsedFromWord));
    setHasUnsavedChanges(false);
    setLastSavedAt(new Date().toLocaleTimeString('vi-VN'));
    setStatusBanner({
      type: 'SUCCESS',
      text: `Đã đồng bộ thành công ${parsedFromWord.length} câu hỏi từ Môi trường Word A4 và tự động tách chuẩn 4 đáp án (A, B, C, D / a, b, c, d) cho từng câu!`,
    });
  };

  // Chèn nhanh ký hiệu khoa học / công thức trên thanh Ribbon Word
  const handleInsertScientificSymbol = (symbol: string) => {
    if (editorViewMode === 'WORD_A4_PAGE') {
      setWordRawDocumentText((prev) => `${prev}${symbol}`);
      setHasUnsavedChanges(true);
      return;
    }
    const targetId = activeFocusedQuestionId || questions[0]?.id;
    if (!targetId) return;
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === targetId ? { ...q, stemText: `${q.stemText} ${symbol}` } : q
      )
    );
    setHasUnsavedChanges(true);
    setStatusBanner({
      type: 'INFO',
      text: `Đã chèn ký hiệu "${symbol}" vào câu đang chọn. Bạn có thể chỉnh sửa trực tiếp như trên Word.`,
    });
  };

  // ================= HANDLER: AI TẠO CÙNG LÚC 4 ĐỀ TƯƠNG ĐƯƠNG KHÁC NHAU =================
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

      const result = await generateFourSimultaneousAiExams(
        questions,
        selectedModelTier,
        config.subjectName,
        `${aiCustomPrompt} | Luồng kích hoạt: ${activeNodesSummary}`,
        cloneIteration,
        sensitiveList,
        config.resetNumberingPerPart,
        numAiExamsToGenerate,
        aiTeacherGuidance
      );

      setAiClonedVariants(result.variants);
      setSelectedAiVariantIdx(0);
      if (result.variants.length > 0) {
        setClonedQuestions(result.variants[0].questions);
      }
      setCloneIteration((prev) => prev + numAiExamsToGenerate);
      setLastAiEngineUsed(result.engineUsed);
      setRedactedItemsCount((prev) => prev + result.totalRedactedCount + numAiExamsToGenerate);
      if (zeroRetentionMode) {
        const purgedAt = await triggerZeroTracePurgeOnDownload();
        setLastPurgedTime(purgedAt);
      }
      setStatusBanner({
        type: 'SUCCESS',
        text: `Đã sinh thành công ${result.variants.length} Đề AI Tương Đương theo đúng chỉ dẫn của giáo viên bằng [${result.engineUsed}] (Chế độ chống quá tải dữ liệu)!`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi AI';
      setStatusBanner({
        type: 'ERROR',
        text: `Không thể tạo 4 đề tương đương: ${msg}`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Áp dụng bộ đề tương đương AI đang chọn làm đề gốc chính thức để trộn đề
  const handleApplyAiCloneAsMaster = () => {
    const activeClone =
      aiClonedVariants[selectedAiVariantIdx]?.questions || clonedQuestions;
    if (activeClone.length === 0) return;
    const normalized = normalizeAllQuestionsStrictFourOptions(
      activeClone,
      config.resetNumberingPerPart
    );
    const codeLabel = aiClonedVariants[selectedAiVariantIdx]?.examCode || 'AI-01';
    setQuestions(normalized);
    setWordRawDocumentText(serializeQuestionsToWordRawText(normalized));
    setFileName(
      `De_${codeLabel}_Tuong_Duong_${config.subjectName.replace(/\s+/g, '_')}.docx`
    );
    setHasUnsavedChanges(false);
    setLastSavedAt(new Date().toLocaleTimeString('vi-VN'));
    setActiveRightTab('LIVE_EDITOR');
    setStatusBanner({
      type: 'SUCCESS',
      text: `Đã nạp Bộ Đề ${codeLabel} vào Trình Biên Tập Đề Gốc! Bạn có thể chỉnh sửa trực tiếp hoặc bấm [Trộn Đề Ngay].`,
    });
  };

  // Tải trực tiếp file Word (.docx) của Đề AI đang chọn
  const handleDownloadAiCloneDocx = async () => {
    const activeVariantObj = aiClonedVariants[selectedAiVariantIdx];
    const activeClone = activeVariantObj?.questions || clonedQuestions;
    if (activeClone.length === 0) return;
    setIsProcessing(true);
    try {
      const codeLabel = activeVariantObj?.examCode || 'AI-01';
      const blob = await exportCleanedMasterDocx(activeClone, {
        ...config,
        examSubtitle: `ĐỀ TƯƠNG ĐƯƠNG DO AI BIÊN SOẠN — MÃ ${codeLabel}`,
      });
      triggerBrowserDownload(
        blob,
        `De_Tuong_Duong_${codeLabel}_${config.subjectName.replace(/\s+/g, '_')}.docx`
      );
      await executePostDownloadZeroTracePurge(`Đề Tương Đương ${codeLabel} (.docx)`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Tải trọn bộ 4 Đề AI khác nhau (.zip)
  const handleDownloadAllFourAiClonesZip = async () => {
    if (aiClonedVariants.length === 0) return;
    setIsProcessing(true);
    try {
      const blob = await exportFourAiClonesZipBundle(
        aiClonedVariants.map((v) => ({
          examCode: v.examCode,
          title: v.title,
          questions: v.questions,
        })),
        config
      );
      triggerBrowserDownload(
        blob,
        `Bo_4_De_AI_Tuong_Duong_Khac_Nhau_${config.subjectName.replace(/\s+/g, '_')}.zip`
      );
      await executePostDownloadZeroTracePurge('Trọn Bộ 4 Đề AI Khác Nhau (.zip)');
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
    const recalculated = normalizeAllQuestionsStrictFourOptions(
      questions,
      config.resetNumberingPerPart
    );
    setQuestions(recalculated);
    setWordRawDocumentText(serializeQuestionsToWordRawText(recalculated));
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

  const handleUpdateCustomCode = (index: number, newCode: string) => {
    setConfig((prev) => {
      const base = prev.examCodeDigits === 3 ? 101 : 1001;
      const codes =
        prev.customCodes && prev.customCodes.length >= prev.numVariants
          ? [...prev.customCodes]
          : Array.from({ length: prev.numVariants }, (_, i) => String(base + i));
      codes[index] = newCode;
      return { ...prev, customCodes: codes };
    });
  };

  const handleResetDefaultCodes = () => {
    setConfig((prev) => ({
      ...prev,
      customCodes: Array.from({ length: prev.numVariants }, (_, i) =>
        String(prev.examCodeDigits === 3 ? 101 + i : 1001 + i)
      ),
    }));
  };

  const handleDownloadMasterWithSolutions = async () => {
    setIsProcessing(true);
    try {
      const blob = await exportMasterExamWithSolutionsDocx(questions, config);
      triggerBrowserDownload(
        blob,
        `De_Goc_Co_Loi_Giai_Chi_Tiet_${config.subjectName.replace(/\s+/g, '_')}_2025.docx`
      );
      await executePostDownloadZeroTracePurge('Đề Gốc Kèm Lời Giải Chi Tiết (.docx)');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadCleanedMaster = async () => {
    setIsProcessing(true);
    try {
      const blob = await exportCleanedMasterDocx(questions, config, false);
      triggerBrowserDownload(blob, `De_Goc_Khong_Loi_Giai_Chuan_2025_${Date.now()}.docx`);
      await executePostDownloadZeroTracePurge('Đề Gốc Chuẩn Không Lời Giải (.docx)');
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
    <div className="min-h-screen flex flex-col text-slate-900 pb-20">
      {/* ================= KHỐI ĐIỀU KHIỂN CỐ ĐỊNH TRÊN CÙNG ================= */}
      <div className="sticky top-0 z-30 bg-sky-50/95 backdrop-blur-md border-b-2 border-sky-300 shadow-md">
        {/* ================= HEADER: DÒNG 1 (LOGO LỚN NỔI BẬT + TÁC GIẢ) & DÒNG 2 (THANH NÚT CHỨC NĂNG NẰM DƯỚI LOGO KHÔNG BỊ VỠ/MẤT KHUNG) ================= */}
        <header className="max-w-[1440px] w-full mx-auto px-3 sm:px-6 pt-2 pb-2.5 border-b border-sky-200 bg-white/95 space-y-2">
          {/* DÒNG 1: LOGO TRANG WEB CỠ CHỮ LỚN NỔI BẬT + TÊN TÁC GIẢ + NHÃN TỆP XUẤT */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <a
              href="#top"
              className="flex items-center gap-3 shrink-0 group focus:outline-none"
            >
              <div className="w-11 h-11 rounded-2xl logo-3d-badge flex items-center justify-center text-white shrink-0 transition-transform group-hover:scale-105">
                <GraduationCap className="w-6 h-6 drop-shadow" />
              </div>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <span className="text-2xl sm:text-3xl font-black tracking-tight animate-edumix-gradient leading-none">
                  EduMix 2025
                </span>
                <span className="text-xs sm:text-sm font-extrabold text-sky-900 tracking-wide">
                  Tác giả: Hồ Tấn Khải — Trường THPT Mang Thít
                </span>
              </div>
            </a>

            <div className="flex items-center gap-2">
              <span
                className="text-xs font-mono font-bold text-emerald-950 bg-emerald-100/90 px-3 py-1 rounded-xl border border-emerald-300 truncate max-w-[340px] shadow-2xs"
                title={`Tên tệp xuất ra: ${buildStandardExportFileName(config, 'docx')}`}
              >
                Tệp xuất: {buildStandardExportFileName(config, 'docx')}
              </span>
            </div>
          </div>

          {/* DÒNG 2: NGUYÊN THANH NÚT CHỨC NĂNG NẰM NGAY DƯỚI LOGO VÀ TÊN TÁC GIẢ (CỠ CHỮ TỰ ĐỘNG CO GIÃN, ĐẦY ĐỦ KHUNG 3D KHÔNG BỊ VỠ) */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 pb-1">
            {/* Cụm 4 Chế độ chính */}
            <nav className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveRightTab('LIVE_EDITOR')}
                className={`px-3.5 py-1.5 rounded-xl font-extrabold text-white btn-auto-scale flex items-center gap-1.5 whitespace-nowrap cursor-pointer btn-3d-primary ${
                  activeRightTab === 'LIVE_EDITOR'
                    ? 'ring-2 ring-blue-300 brightness-105'
                    : 'opacity-95 hover:opacity-100'
                }`}
              >
                <FileText className="w-4 h-4 shrink-0" />
                <span>1. Biên Tập Đề Gốc</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveRightTab('AI_CLONE_STUDIO')}
                className={`px-3.5 py-1.5 rounded-xl font-extrabold text-white btn-auto-scale flex items-center gap-1.5 whitespace-nowrap cursor-pointer btn-3d-purple ${
                  activeRightTab === 'AI_CLONE_STUDIO'
                    ? 'ring-2 ring-purple-300 brightness-105'
                    : 'opacity-95 hover:opacity-100'
                }`}
              >
                <Bot className="w-4 h-4 shrink-0" />
                <span>2. AI Tạo Đề Tương Đương</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveRightTab('BLOOM_MATRIX')}
                className={`px-3.5 py-1.5 rounded-xl font-extrabold text-white btn-auto-scale flex items-center gap-1.5 whitespace-nowrap cursor-pointer btn-3d-orange ${
                  activeRightTab === 'BLOOM_MATRIX'
                    ? 'ring-2 ring-amber-300 brightness-105'
                    : 'opacity-95 hover:opacity-100'
                }`}
              >
                <BarChart3 className="w-4 h-4 shrink-0" />
                <span>3. Ma Trận &amp; Đặc Tả</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (shuffledVariants.length > 0) {
                    setActiveRightTab('SHUFFLED_PREVIEW');
                  } else {
                    handleRunShuffle();
                  }
                }}
                className={`px-3.5 py-1.5 rounded-xl font-extrabold text-white btn-auto-scale flex items-center gap-1.5 whitespace-nowrap cursor-pointer btn-3d-emerald ${
                  activeRightTab === 'SHUFFLED_PREVIEW'
                    ? 'ring-2 ring-emerald-300 brightness-105'
                    : 'opacity-95 hover:opacity-100'
                }`}
              >
                <QrCode className="w-4 h-4 shrink-0" />
                <span>4. Đáp Án &amp; Mã QR</span>
              </button>
            </nav>

            {/* Cụm nút Hệ thống (Bảo Mật AI + Chọn Mô hình + Hướng Dẫn + Thu Gọn) */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAiSecurityModalOpen(true)}
                className="px-3.5 py-1.5 rounded-xl font-extrabold text-white btn-auto-scale btn-3d-teal flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                title="Cấu hình bảo mật AI & cô lập dữ liệu đề thi"
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Bảo Mật AI</span>
              </button>

              {/* Dropdown chọn 4 mô hình Gemini */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsModelDropdownOpen((prev) => !prev)}
                  className="px-3.5 py-1.5 rounded-xl font-extrabold text-white btn-auto-scale btn-3d-slate flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <Cpu className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{currentModelInfo.name}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                </button>

                {isModelDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-[#18191C] text-white border border-slate-700 shadow-2xl p-2 z-50 space-y-1">
                    <div className="px-3 py-1.5 text-xs font-bold text-slate-400 border-b border-slate-800 flex items-center justify-between">
                      <span>MÔ HÌNH AI GEMINI</span>
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
                          className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-2.5 transition-all cursor-pointer ${
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
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsGuideOpen(true)}
                className="px-3.5 py-1.5 rounded-xl font-extrabold text-white btn-auto-scale btn-3d-fuchsia flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <BookOpen className="w-4 h-4 shrink-0" />
                <span>Hướng Dẫn</span>
              </button>

              <button
                type="button"
                onClick={() => setIsConfigCollapsed((prev) => !prev)}
                className="px-3.5 py-1.5 rounded-xl font-extrabold text-white btn-auto-scale btn-3d-cyan flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                title="Thu gọn hoặc mở rộng khung thông tin hành chính để ưu tiên diện tích xem và sửa đề"
              >
                <Sliders className="w-4 h-4 shrink-0" />
                <span>{isConfigCollapsed ? 'Mở Thông Tin' : 'Thu Gọn'}</span>
              </button>
            </div>
          </div>
        </header>

        {/* ================= TẦNG 2 & 3: KHỐI THÔNG TIN ĐỀ CẦN TRỘN + THANH CÔNG CỤ SOẠN THẢO HỢP NHẤT ================= */}
        <div className="max-w-[1440px] w-full mx-auto px-3 sm:px-6 py-2 space-y-2">
          {/* Input ẩn phục vụ tải tệp Word / PDF */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,.pdf"
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* KHỐI THÔNG TIN ĐỀ CẦN TRỘN (Gọn gàng 1 hàng 8 ô, có thể thu gọn) */}
          {!isConfigCollapsed && (
            <div className="px-3 py-2 rounded-2xl bg-white/95 border-2 border-sky-300 shadow-xs space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-12 gap-2 items-end">
                {/* 1. Sở / Phòng GD&ĐT */}
                <div className="lg:col-span-2">
                  <label className="block text-[11px] font-extrabold text-sky-950 uppercase truncate mb-0.5">
                    1. Sở / Phòng GD&amp;ĐT:
                  </label>
                  <input
                    type="text"
                    value={config.departmentName}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, departmentName: e.target.value }))
                    }
                    placeholder="SỞ GD&ĐT VĨNH LONG"
                    className="w-full px-2.5 py-1.5 text-xs sm:text-sm font-bold text-slate-900 bg-sky-50/70 border border-sky-300 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white"
                  />
                </div>

                {/* 2. Trường / Đơn vị */}
                <div className="lg:col-span-2">
                  <label className="block text-[11px] font-extrabold text-sky-950 uppercase truncate mb-0.5">
                    2. Trường / Đơn vị:
                  </label>
                  <input
                    type="text"
                    value={config.schoolName}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, schoolName: e.target.value }))
                    }
                    placeholder="TRƯỜNG THPT MANG THÍT"
                    className="w-full px-2.5 py-1.5 text-xs sm:text-sm font-bold text-slate-900 bg-sky-50/70 border border-sky-300 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white"
                  />
                </div>

                {/* 3. Kỳ kiểm tra */}
                <div className="lg:col-span-2">
                  <label className="block text-[11px] font-extrabold text-blue-950 uppercase truncate mb-0.5">
                    3. Kỳ kiểm tra:
                  </label>
                  <select
                    value={config.examTitle}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, examTitle: e.target.value }))
                    }
                    className="w-full px-2 py-1.5 text-xs sm:text-sm font-black text-blue-950 bg-blue-50/80 border border-blue-400 rounded-xl focus:outline-none focus:border-blue-700 cursor-pointer"
                  >
                    <option value="KIỂM TRA GIỮA KÌ I">KIỂM TRA GIỮA KÌ I</option>
                    <option value="KIỂM TRA GIỮA KÌ II">KIỂM TRA GIỮA KÌ II</option>
                    <option value="KIỂM TRA CUỐI KÌ I">KIỂM TRA CUỐI KÌ I</option>
                    <option value="KIỂM TRA CUỐI KÌ II">KIỂM TRA CUỐI KÌ II</option>
                    <option value="KIỂM TRA ÔN TẬP">KIỂM TRA ÔN TẬP</option>
                    <option value="KỲ THI TỐT NGHIỆP THPT">KỲ THI TỐT NGHIỆP THPT</option>
                  </select>
                </div>

                {/* 4. Môn thi (12 môn THPT) */}
                <div className="lg:col-span-2">
                  <label className="block text-[11px] font-extrabold text-emerald-950 uppercase truncate mb-0.5">
                    4. Môn thi (12 môn THPT):
                  </label>
                  <select
                    value={config.subjectName}
                    onChange={(e) => {
                      const val = e.target.value;
                      const minsMap: Record<string, number> = {
                        'TOÁN HỌC': 90,
                        'NGỮ VĂN': 120,
                        'SINH HỌC': 50,
                        'VẬT LÍ': 50,
                        'HÓA HỌC': 50,
                        'TIẾNG ANH': 50,
                        'LỊCH SỬ': 50,
                        'ĐỊA LÍ': 50,
                        'GD KINH TẾ & PHÁP LUẬT': 50,
                        'TIN HỌC': 50,
                        'CÔNG NGHỆ CÔNG NGHIỆP': 50,
                        'CÔNG NGHỆ NÔNG NGHIỆP': 50,
                      };
                      setConfig((prev) => ({
                        ...prev,
                        subjectName: val,
                        durationMinutes: minsMap[val] || prev.durationMinutes,
                      }));
                    }}
                    className="w-full px-2 py-1.5 text-xs sm:text-sm font-black text-emerald-950 bg-emerald-50/80 border border-emerald-400 rounded-xl focus:outline-none focus:border-emerald-700 cursor-pointer"
                  >
                    <option value="SINH HỌC">SINH HỌC</option>
                    <option value="TOÁN HỌC">TOÁN HỌC</option>
                    <option value="VẬT LÍ">VẬT LÍ</option>
                    <option value="HÓA HỌC">HÓA HỌC</option>
                    <option value="NGỮ VĂN">NGỮ VĂN</option>
                    <option value="TIẾNG ANH">TIẾNG ANH</option>
                    <option value="LỊCH SỬ">LỊCH SỬ</option>
                    <option value="ĐỊA LÍ">ĐỊA LÍ</option>
                    <option value="GD KINH TẾ & PHÁP LUẬT">GD KINH TẾ &amp; PHÁP LUẬT</option>
                    <option value="TIN HỌC">TIN HỌC</option>
                    <option value="CÔNG NGHỆ CÔNG NGHIỆP">CÔNG NGHỆ CÔNG NGHIỆP</option>
                    <option value="CÔNG NGHỆ NÔNG NGHIỆP">CÔNG NGHỆ NÔNG NGHIỆP</option>
                  </select>
                </div>

                {/* 5. Lớp */}
                <div className="lg:col-span-1">
                  <label className="block text-[11px] font-extrabold text-purple-950 uppercase truncate mb-0.5">
                    5. Lớp:
                  </label>
                  <select
                    value={config.gradeLevel || 'Lớp 12'}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, gradeLevel: e.target.value }))
                    }
                    className="w-full px-2 py-1.5 text-xs sm:text-sm font-black text-purple-950 bg-purple-50/80 border border-purple-300 rounded-xl focus:outline-none cursor-pointer"
                  >
                    <option value="Lớp 12">Lớp 12</option>
                    <option value="Lớp 11">Lớp 11</option>
                    <option value="Lớp 10">Lớp 10</option>
                  </select>
                </div>

                {/* 6. Phút */}
                <div className="lg:col-span-1">
                  <label className="block text-[11px] font-extrabold text-rose-950 uppercase truncate mb-0.5">
                    6. Phút:
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
                    className="w-full px-2 py-1.5 text-xs sm:text-sm font-mono font-black text-rose-700 bg-rose-50/60 border border-rose-300 rounded-xl text-center focus:outline-none"
                  />
                </div>

                {/* 7. Số đề */}
                <div className="lg:col-span-1">
                  <label className="block text-[11px] font-extrabold text-indigo-950 uppercase truncate mb-0.5">
                    7. Số đề:
                  </label>
                  <select
                    value={config.numVariants}
                    onChange={(e) => {
                      const newCount = Number(e.target.value);
                      setConfig((prev) => {
                        const base = prev.examCodeDigits === 3 ? 101 : 1001;
                        const existing = prev.customCodes || [];
                        const updatedCodes = Array.from({ length: newCount }, (_, i) =>
                          existing[i]?.trim() ? existing[i] : String(base + i)
                        );
                        return {
                          ...prev,
                          numVariants: newCount,
                          customCodes: updatedCodes,
                        };
                      });
                    }}
                    className="w-full px-2 py-1.5 text-xs sm:text-sm font-mono font-black text-indigo-950 bg-indigo-50/80 border border-indigo-300 rounded-xl focus:outline-none cursor-pointer"
                  >
                    <option value={4}>4 đề</option>
                    <option value={8}>8 đề</option>
                    <option value={12}>12 đề</option>
                    <option value={24}>24 đề</option>
                  </select>
                </div>

                {/* 8. Sửa mã */}
                <div className="lg:col-span-1">
                  <label className="block text-[11px] font-extrabold text-sky-950 uppercase truncate mb-0.5">
                    8. Mã đề:
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowCustomCodeEditor((prev) => !prev)}
                    className="w-full px-2 py-1.5 rounded-xl font-black text-white btn-auto-scale btn-3d-violet flex items-center justify-center gap-1 cursor-pointer"
                    title="Điều chỉnh mã đề (101, 102...) và tùy chọn dàn trang, mã QR"
                  >
                    <Edit3 className="w-3.5 h-3.5 shrink-0" />
                    <span>Sửa mã</span>
                  </button>
                </div>
              </div>

              {/* Khung mở rộng khi bấm [Sửa mã]: Cho phép sửa từng mã đề 101, 102... và tùy chỉnh Dàn trang / QR */}
              {showCustomCodeEditor && (
                <div className="pt-2 border-t border-sky-200 grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-center bg-sky-50/70 p-2.5 rounded-xl text-xs">
                  <div className="lg:col-span-7 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-sky-950">
                        Nhập mã đề tùy ý ({config.numVariants} mã đề):
                      </span>
                      <div className="flex items-center gap-2">
                        <select
                          value={config.examCodeDigits}
                          onChange={(e) => {
                            const newDigits = Number(e.target.value) as 3 | 4;
                            setConfig((prev) => {
                              const base = newDigits === 3 ? 101 : 1001;
                              return {
                                ...prev,
                                examCodeDigits: newDigits,
                                customCodes: Array.from(
                                  { length: prev.numVariants },
                                  (_, i) => String(base + i)
                                ),
                              };
                            });
                          }}
                          className="px-2 py-0.5 font-bold bg-white border border-sky-300 rounded-md"
                        >
                          <option value={3}>Hệ 3 số (101...)</option>
                          <option value={4}>Hệ 4 số (1001...)</option>
                        </select>
                        <button
                          type="button"
                          onClick={handleResetDefaultCodes}
                          className="font-bold text-blue-700 hover:underline cursor-pointer"
                        >
                          Mặc định
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                      {Array.from({ length: config.numVariants }, (_, idx) => {
                        const val =
                          config.customCodes?.[idx] ??
                          String(config.examCodeDigits === 3 ? 101 + idx : 1001 + idx);
                        return (
                          <input
                            key={`code-input-${idx}`}
                            type="text"
                            value={val}
                            onChange={(e) => handleUpdateCustomCode(idx, e.target.value)}
                            className="px-2 py-1 font-black font-mono text-center text-blue-950 bg-white border border-sky-300 rounded-md focus:outline-none focus:border-blue-600"
                            maxLength={10}
                          />
                        );
                      })}
                    </div>
                  </div>

                  <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <span className="font-bold text-slate-700 block mb-0.5">Chia cột đáp án Phần I:</span>
                      <select
                        value={config.layoutOverride}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            layoutOverride: e.target.value as LayoutMode,
                          }))
                        }
                        className="w-full px-2 py-1 font-bold bg-white border border-sky-300 rounded-md"
                      >
                        <option value="AUTO">Tự động co dãn (Auto)</option>
                        <option value="1_ROW_4_COL">Luôn chia 4 cột ngang</option>
                        <option value="2_ROW_2_COL">Luôn chia 2 cột × 2 hàng</option>
                        <option value="4_ROW_1_COL">Luôn xếp 1 cột dọc</option>
                      </select>
                    </div>

                    <div>
                      <span className="font-bold text-slate-700 block mb-0.5">Chuẩn mã QR Chấm thi:</span>
                      <select
                        value={config.qrFormat}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            qrFormat: e.target.value as QRAppFormat,
                          }))
                        }
                        className="w-full px-2 py-1 font-bold bg-white border border-sky-300 rounded-md"
                      >
                        <option value="QM2025">QM2025 (Chuẩn 3 Phần)</option>
                        <option value="TNMAKER">TNMaker</option>
                        <option value="AZOTA">Azota 2025</option>
                        <option value="STANDARD_2025">Standard 2025</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= THANH CÔNG CỤ HỢP NHẤT GỌN ĐẸP 2 HÀNG (CỠ CHỮ TỰ ĐỘNG CO GIÃN, KHÔNG BỊ VỠ/MẤT KHUNG NÚT BẤM) ================= */}
          <div className="px-3 py-2 rounded-2xl toolbar-3d space-y-2">
            {/* HÀNG 1: CHUYỂN NHANH 3 PHẦN + CHẾ ĐỘ XEM (THẺ 3D / WORD A4) + CÁC NÚT TÁC VỤ CHÍNH (MỖI NÚT 1 MÀU KHÁC NHAU) */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-sky-200/90">
              {/* Cụm Trái: Chuyển nhanh 3 Phần + Chuyển chế độ Thẻ 3D / Trang Word A4 */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setActiveRightTab('LIVE_EDITOR');
                    setFilterPart('ALL');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`px-3 py-1.5 rounded-xl font-black text-white btn-auto-scale btn-3d-slate cursor-pointer ${
                    filterPart === 'ALL' ? 'ring-2 ring-slate-400' : 'opacity-90 hover:opacity-100'
                  }`}
                  title="Hiển thị toàn bộ câu hỏi của cả 3 phần"
                >
                  Tất cả: {questions.length} câu
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveRightTab('LIVE_EDITOR');
                    setFilterPart('PART_1');
                    const firstP1 = questions.find((q) => q.part === 'PART_1');
                    if (firstP1) {
                      setTimeout(() => {
                        questionRefs.current[firstP1.id]?.scrollIntoView({
                          behavior: 'smooth',
                          block: 'center',
                        });
                      }, 60);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-xl font-black text-white btn-auto-scale btn-3d-primary cursor-pointer ${
                    filterPart === 'PART_1' ? 'ring-2 ring-blue-300' : 'opacity-95 hover:opacity-100'
                  }`}
                  title="Chuyển nhanh tới Phần I (Trắc nghiệm 4 lựa chọn A, B, C, D)"
                >
                  PHẦN I: {part1Count} câu
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveRightTab('LIVE_EDITOR');
                    setFilterPart('PART_2');
                    const firstP2 = questions.find((q) => q.part === 'PART_2');
                    if (firstP2) {
                      setTimeout(() => {
                        questionRefs.current[firstP2.id]?.scrollIntoView({
                          behavior: 'smooth',
                          block: 'center',
                        });
                      }, 60);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-xl font-black text-white btn-auto-scale btn-3d-emerald cursor-pointer ${
                    filterPart === 'PART_2' ? 'ring-2 ring-emerald-300' : 'opacity-95 hover:opacity-100'
                  }`}
                  title="Chuyển nhanh tới Phần II (Đúng / Sai a, b, c, d)"
                >
                  PHẦN II: {part2Count} câu
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveRightTab('LIVE_EDITOR');
                    setFilterPart('PART_3');
                    const firstP3 = questions.find((q) => q.part === 'PART_3');
                    if (firstP3) {
                      setTimeout(() => {
                        questionRefs.current[firstP3.id]?.scrollIntoView({
                          behavior: 'smooth',
                          block: 'center',
                        });
                      }, 60);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-xl font-black text-white btn-auto-scale btn-3d-amber cursor-pointer ${
                    filterPart === 'PART_3' ? 'ring-2 ring-amber-300' : 'opacity-95 hover:opacity-100'
                  }`}
                  title="Chuyển nhanh tới Phần III (Trả lời ngắn)"
                >
                  PHẦN III: {part3Count} câu
                </button>

                <span className="text-slate-300 mx-0.5 hidden sm:inline">|</span>

                <button
                  type="button"
                  onClick={() => {
                    setActiveRightTab('LIVE_EDITOR');
                    setEditorViewMode('CARDS_3D');
                  }}
                  className={`px-3 py-1.5 rounded-xl font-extrabold text-white btn-auto-scale btn-3d-sky flex items-center gap-1.5 cursor-pointer ${
                    activeRightTab === 'LIVE_EDITOR' && editorViewMode === 'CARDS_3D'
                      ? 'ring-2 ring-sky-300'
                      : 'opacity-85 hover:opacity-100'
                  }`}
                  title="Chế độ xem và chỉnh sửa từng thẻ câu hỏi 3D trực quan"
                >
                  <Layers className="w-3.5 h-3.5 shrink-0" />
                  <span>Thẻ Câu Hỏi 3D</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveRightTab('LIVE_EDITOR');
                    setWordRawDocumentText(serializeQuestionsToWordRawText(questions));
                    setEditorViewMode('WORD_A4_PAGE');
                  }}
                  className={`px-3 py-1.5 rounded-xl font-extrabold text-white btn-auto-scale btn-3d-violet flex items-center gap-1.5 cursor-pointer ${
                    activeRightTab === 'LIVE_EDITOR' && editorViewMode === 'WORD_A4_PAGE'
                      ? 'ring-2 ring-violet-300'
                      : 'opacity-85 hover:opacity-100'
                  }`}
                  title="Chế độ soạn thảo trực tiếp trên trang giấy Word A4"
                >
                  <Edit3 className="w-3.5 h-3.5 shrink-0" />
                  <span>Trang Word A4</span>
                </button>
              </div>

              {/* Cụm Phải: Các nút tác vụ chính (Mỗi nút 1 màu riêng biệt, tự động co giãn không bị mất khung) */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                  className="px-3 py-1.5 rounded-xl font-extrabold text-white btn-auto-scale btn-3d-primary flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  title="Tải lên đề thi Word (.docx) hoặc PDF (.pdf)"
                >
                  <Upload className="w-3.5 h-3.5 shrink-0" />
                  <span>Tải Word / PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleLoadSampleExam(true)}
                  className="px-3 py-1.5 rounded-xl font-extrabold text-white btn-auto-scale btn-3d-cyan flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  title="Nạp đề mẫu chuẩn cấu trúc 18-4-6"
                >
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span>Đề Mẫu 18-4-6</span>
                </button>

                <button
                  type="button"
                  onClick={handleNormalizeAndDeClumpAllQuestions}
                  className="px-3 py-1.5 rounded-xl font-extrabold text-white btn-auto-scale btn-3d-orange flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  title="Tự động tách các câu hỏi/đáp án dính chùm và ép chuẩn đủ 4 phương án"
                >
                  <Wand2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Tách Dính Chùm &amp; 4 ĐA</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveEdits}
                  className={`px-3 py-1.5 rounded-xl font-extrabold text-white btn-auto-scale flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    hasUnsavedChanges ? 'btn-3d-amber' : 'btn-3d-emerald'
                  }`}
                  title="Lưu toàn bộ nội dung vừa chỉnh sửa"
                >
                  <Save className="w-3.5 h-3.5 shrink-0" />
                  <span>Lưu Sửa</span>
                </button>

                <button
                  type="button"
                  onClick={handleRunShuffle}
                  disabled={!canShuffle || isProcessing}
                  className="px-3.5 py-1.5 rounded-xl font-black text-white btn-auto-scale btn-3d-rose flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  title="Trộn hoán vị các mã đề thi"
                >
                  <Shuffle className="w-3.5 h-3.5 shrink-0" />
                  <span>Trộn Đề ({config.numVariants} Mã)</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadMasterWithSolutions}
                  disabled={isProcessing}
                  className="px-3 py-1.5 rounded-xl font-extrabold text-white btn-auto-scale btn-3d-indigo flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  title="Tải đề gốc kèm lời giải chi tiết (.docx)"
                >
                  <Download className="w-3.5 h-3.5 shrink-0" />
                  <span>Tải Đề Gốc Có Lời Giải (.docx)</span>
                </button>

                {shuffledVariants.length > 0 && (
                  <button
                    type="button"
                    onClick={handleDownloadZipBundle}
                    disabled={isProcessing}
                    className="px-3 py-1.5 rounded-xl font-black text-white btn-auto-scale btn-3d-purple flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                    title="Tải trọn bộ đề thi đã trộn và bảng đáp án (.zip)"
                  >
                    <FileArchive className="w-3.5 h-3.5 shrink-0" />
                    <span>Tải Bộ Đề (.zip)</span>
                  </button>
                )}
              </div>
            </div>

            {/* HÀNG 2: KHUNG CẢNH BÁO CÂU HỎI CHƯA HỢP LỆ + CÔNG CỤ CỠ CHỮ & KÝ HIỆU KHOA HỌC */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
              {/* Cụm Trái: Khung cảnh báo câu hỏi chưa hợp lệ */}
              <div className="flex items-center gap-2 flex-wrap">
                {validationIssues.length === 0 ? (
                  <div className="px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-400 text-emerald-950 text-xs font-black flex items-center gap-1.5 shadow-2xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Đề hợp lệ 100% (0 câu lỗi · Đủ 4 đáp án)</span>
                  </div>
                ) : (
                  <div className="px-3 py-1 rounded-xl bg-rose-50 border-2 border-rose-500 text-rose-950 flex flex-wrap items-center gap-1.5 shadow-xs text-xs">
                    <div className="flex items-center gap-1 font-black text-rose-700">
                      <AlertTriangle className="w-4 h-4 text-rose-600 animate-bounce shrink-0" />
                      <span>Cảnh báo ({validationIssues.length} câu chưa hợp lệ):</span>
                    </div>

                    <div className="flex items-center gap-1 flex-wrap">
                      {validationIssues.slice(0, 6).map((iss, idx) => (
                        <button
                          key={`sticky-iss-${iss.questionId}-${idx}`}
                          type="button"
                          onClick={() => {
                            setActiveRightTab('LIVE_EDITOR');
                            handleScrollToQuestion(iss.questionId);
                          }}
                          className="px-2 py-0.5 rounded-lg bg-white hover:bg-rose-600 hover:text-white text-rose-800 border border-rose-300 font-black transition-colors cursor-pointer whitespace-nowrap"
                          title={`${iss.message} — Bấm để nhảy tới sửa ngay`}
                        >
                          Câu {iss.questionIndex}
                        </button>
                      ))}
                      {validationIssues.length > 6 && (
                        <span className="font-bold text-rose-700">
                          +{validationIssues.length - 6} câu
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleNormalizeAndDeClumpAllQuestions}
                      className="px-2.5 py-0.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-black flex items-center gap-1 cursor-pointer shadow-2xs whitespace-nowrap"
                      title="Tự động sửa lỗi dính chùm và ép đủ 4 phương án cho toàn bộ câu lỗi"
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      <span>Sửa tất cả</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Cụm Phải: Chọn cỡ chữ + Chèn nhanh ký hiệu khoa học */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <select
                  value={wordFontSizePt}
                  onChange={(e) => setWordFontSizePt(Number(e.target.value))}
                  className="px-2.5 py-1 rounded-xl bg-white border border-sky-300 text-xs font-mono font-bold text-slate-900 cursor-pointer"
                  title="Chọn cỡ chữ hiển thị"
                >
                  <option value={11}>Times 11pt</option>
                  <option value={12}>Times 12pt</option>
                  <option value={13}>Times 13pt</option>
                  <option value={14}>Times 14pt</option>
                </select>

                <div className="flex items-center gap-1 flex-wrap">
                  {['→', '⇄', 'Δ', 'α', 'β', '♂', '♀', '±', '°C', '²', '₁', '₂'].map(
                    (sym) => (
                      <button
                        key={sym}
                        type="button"
                        onClick={() => handleInsertScientificSymbol(sym)}
                        className="w-7 h-7 rounded-lg bg-white hover:bg-blue-50 border border-sky-300 text-xs font-mono font-black text-blue-950 shadow-2xs transition-transform active:scale-95 cursor-pointer"
                        title={`Chèn nhanh ký hiệu ${sym} vào câu hỏi đang chọn`}
                      >
                        {sym}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Thanh thông báo trạng thái (Status Banner) */}
        {statusBanner && (
          <div
            className={`px-6 py-2 border-t text-xs font-bold flex items-center justify-between gap-4 ${
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
              className="px-2.5 py-0.5 rounded-lg bg-white/90 hover:bg-white text-slate-800 text-xs font-bold shadow-2xs shrink-0 cursor-pointer"
            >
              Đóng
            </button>
          </div>
        )}
      </div>

      {/* ================= 4.3. PHẦN THÔNG TIN & NỘI DUNG CỦA ĐỀ CẦN TRỘN (1 KHỐI TỪ TRÊN XUỐNG RỘNG RÃI, ĐẸP MẮT) ================= */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-5 space-y-5">
        <section className="w-full space-y-4">
          {/* ================= TAB 1: CHẾ ĐỘ XEM TRƯỚC & CHỈNH SỬA TRỰC TIẾP NỘI DUNG ĐỀ ================= */}
          {activeRightTab === 'LIVE_EDITOR' && (
            <div className="space-y-4">
              {/* CHẾ ĐỘ SOẠN THẢO TRỰC TIẾP TRÊN TRANG GIẤY WORD A4 */}
              {editorViewMode === 'WORD_A4_PAGE' && (
                <div className="p-6 sm:p-8 rounded-3xl word-a4-sheet space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b-2 border-slate-300">
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-blue-950 uppercase">
                        TRANG GIẤY WORD A4 TRỰC TIẾP (SOẠN THẢO &amp; TÁCH CÂU DÍNH CHÙM)
                      </h3>
                      <p className="text-xs text-slate-600 font-medium">
                        Gõ hoặc dán đề thi dính chùm lên trang giấy rồi nhấn <strong>[Đồng Bộ &amp; Tách Chuẩn 4 Đáp Án]</strong>. Đánh dấu đáp án đúng bằng dấu <code>*</code> trước chữ cái (VD: <code>*A.</code> hoặc <code>*a)</code>).
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleSyncFromWordA4Editor}
                      className="px-4 py-2.5 rounded-xl text-xs font-black text-white btn-3d-emerald flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Đồng Bộ &amp; Tách Chuẩn 4 Đáp Án</span>
                    </button>
                  </div>

                  <textarea
                    rows={24}
                    value={wordRawDocumentText}
                    onChange={(e) => {
                      setWordRawDocumentText(e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    style={{
                      fontFamily: "'Times New Roman', Times, serif",
                      fontSize: `${wordFontSizePt}pt`,
                    }}
                    className="w-full p-5 bg-white border-2 border-slate-300 rounded-2xl shadow-inner text-slate-950 leading-relaxed focus:outline-none focus:border-blue-600"
                    placeholder="Nhập hoặc dán nội dung đề thi tại đây..."
                  />
                </div>
              )}

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
                          <span className="text-xs font-mono font-bold bg-black/20 px-3 py-1 rounded-lg">
                            {q.part === 'PART_1'
                              ? `${part1Count} câu`
                              : q.part === 'PART_2'
                              ? `${part2Count} câu`
                              : `${part3Count} câu`}
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
                            onFocus={() => setActiveFocusedQuestionId(q.id)}
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

                        {/* ================= CÔNG THỨC TOÁN / LÝ / HÓA / SINH NHẬN DIỆN ĐƯỢC ================= */}
                        {q.hasFormula && (
                          <div className="mb-3 px-3 py-2 rounded-xl bg-indigo-50/90 border border-indigo-200 flex flex-wrap items-center justify-between gap-2 text-xs text-indigo-950">
                            <div className="flex items-center gap-1.5 font-medium">
                              <Sigma className="w-4 h-4 text-indigo-600 shrink-0" />
                              <span className="font-bold">Công thức toán / khoa học:</span>
                              <span className="font-mono bg-white px-2 py-0.5 rounded border border-indigo-200 font-bold text-indigo-700">
                                {q.formulaLatex || 'Đã chuẩn hóa biểu thức OMML'}
                              </span>
                            </div>
                            <span className="text-[11px] font-bold text-indigo-600 bg-white/70 px-2 py-0.5 rounded">
                              Tự động xuất Word OMML không lỗi
                            </span>
                          </div>
                        )}

                        {/* ================= HÌNH ẢNH / SƠ ĐỒ ĐÍNH KÈM CỦA CÂU HỎI ================= */}
                        <div className="mb-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <label className="text-[11px] font-bold text-sky-900 flex items-center gap-1.5">
                              <ImageIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span>Hình ảnh, Sơ đồ, Đồ thị câu hỏi ({q.images?.length || 0}):</span>
                            </label>

                            <div>
                              <input
                                type="file"
                                accept="image/*"
                                id={`upload-img-${q.id}`}
                                onChange={(e) => handleAddImageToQuestion(q.id, e)}
                                className="hidden"
                              />
                              <label
                                htmlFor={`upload-img-${q.id}`}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-white btn-3d-cyan flex items-center gap-1 cursor-pointer transition-transform hover:scale-102"
                                title="Thêm sơ đồ / hình ảnh minh họa cho câu hỏi này"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Thêm ảnh / sơ đồ</span>
                              </label>
                            </div>
                          </div>

                          {q.images && q.images.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                              {q.images.map((img) => (
                                <div
                                  key={img.id}
                                  className="relative group p-2 rounded-xl bg-white border-2 border-sky-200 shadow-xs flex flex-col items-center"
                                >
                                  <img
                                    src={img.dataUrl}
                                    alt={img.caption || `Hình câu ${q.displayIndex}`}
                                    className="max-h-36 object-contain rounded-lg border border-slate-100 cursor-pointer transition-transform group-hover:scale-102"
                                    onClick={() =>
                                      setPreviewModalImage({
                                        src: img.dataUrl,
                                        caption: img.caption || `Câu ${q.displayIndex}`,
                                      })
                                    }
                                  />
                                  <div className="mt-1.5 flex items-center justify-between w-full px-1 text-[11px] text-slate-500 font-mono">
                                    <span className="truncate max-w-[120px]" title={img.fileName}>
                                      {img.fileName || 'diagram.png'}
                                    </span>
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setPreviewModalImage({
                                            src: img.dataUrl,
                                            caption: img.caption || `Câu ${q.displayIndex}`,
                                          })
                                        }
                                        className="p-1 hover:text-blue-600 rounded cursor-pointer"
                                        title="Phóng to xem chi tiết"
                                      >
                                        <Maximize2 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveImageFromQuestion(q.id, img.id)}
                                        className="p-1 text-rose-500 hover:text-rose-700 rounded cursor-pointer"
                                        title="Xóa hình ảnh này"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
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

                  {/* Khung cấu hình Số lượng Đề AI (Chống quá tải) & Ô Mô Tả Chỉ Dẫn Riêng Của Giáo Viên */}
                  <div className="md:col-span-7 flex flex-col justify-between space-y-4 bg-purple-50/70 p-4 rounded-2xl border-2 border-purple-200">
                    {/* 1. NÚT TÙY CHỌN SỐ LƯỢNG ĐỀ AI CẦN SINH ĐỂ TRÁNH QUÁ TẢI DỮ LIỆU */}
                    <div className="p-3.5 rounded-2xl bg-white border-2 border-purple-300 shadow-xs space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-black text-purple-950 uppercase flex items-center gap-1.5">
                          <Layers className="w-4 h-4 text-purple-700" />
                          <span>1. Chọn Số Lượng Đề AI Cần Sinh (Tránh Quá Tải Dữ Liệu):</span>
                        </span>
                        <span className="px-2.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 font-mono text-[11px] font-black">
                          {numAiExamsToGenerate === 1
                            ? 'Tải nhẹ 25% · Tốc độ nhanh nhất'
                            : numAiExamsToGenerate === 2
                            ? 'Tải vừa 50% · Ổn định'
                            : numAiExamsToGenerate === 3
                            ? 'Tải 75% · Khá nặng'
                            : 'Tải 100% · Tối đa 4 đề'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {([
                          { count: 1, label: '1 Đề AI', sub: 'Khuyên dùng (Nhẹ)' },
                          { count: 2, label: '2 Đề AI', sub: 'Cân bằng' },
                          { count: 3, label: '3 Đề AI', sub: 'Đa biến thể' },
                          { count: 4, label: '4 Đề AI', sub: 'Trọn bộ 4 đề' },
                        ] as const).map((opt) => {
                          const isSelected = numAiExamsToGenerate === opt.count;
                          return (
                            <button
                              key={opt.count}
                              type="button"
                              onClick={() => setNumAiExamsToGenerate(opt.count)}
                              className={`p-2.5 rounded-xl text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                                isSelected
                                  ? 'btn-3d-purple text-white ring-2 ring-purple-300 scale-[1.02]'
                                  : 'bg-purple-50 hover:bg-purple-100 text-purple-950 border border-purple-300 font-bold'
                              }`}
                            >
                              <span className="text-xs sm:text-sm font-black">
                                {opt.label}
                              </span>
                              <span
                                className={`text-[10px] font-semibold ${
                                  isSelected ? 'text-purple-100' : 'text-slate-600'
                                }`}
                              >
                                {opt.sub}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 2. Ô MÔ TẢ THÊM CHỈ DẪN ĐỂ AI SINH ĐỀ THEO ĐÚNG Ý CỦA GIÁO VIÊN */}
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <label className="block text-xs font-black text-purple-950 uppercase">
                          2. Mô Tả / Chỉ Dẫn Thêm Của Giáo Viên Cho AI:
                        </label>
                        <button
                          type="button"
                          onClick={() => setAiTeacherGuidance('')}
                          className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                        >
                          Xóa trống để nhập mới
                        </button>
                      </div>

                      <textarea
                        rows={3}
                        value={aiTeacherGuidance}
                        onChange={(e) => setAiTeacherGuidance(e.target.value)}
                        placeholder="Nhập mô tả chi tiết để AI sinh đề theo ý Thầy/Cô (VD: Chỉ đổi số liệu chẵn dễ tính, đảo câu đúng thành sai, đổi bối cảnh sang cây lúa/cà chua, giữ nguyên độ khó...)"
                        className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 bg-white border-2 border-purple-400 rounded-xl focus:outline-none focus:border-blue-600 leading-relaxed shadow-inner"
                      />

                      {/* Các nút gợi ý chỉ dẫn nhanh cho giáo viên bấm chọn */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-extrabold text-purple-900">
                          Gợi ý thêm nhanh:
                        </span>
                        {[
                          'Đổi số liệu chẵn dễ tính nhẩm',
                          'Đảo câu Đúng thành Sai & ngược lại',
                          'Đổi sơ đồ chuỗi thức ăn & biểu đồ cột',
                          'Tăng câu hỏi thực tiễn & thí nghiệm',
                          'Giữ nguyên độ khó như đề gốc',
                        ].map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() =>
                              setAiTeacherGuidance((prev) =>
                                prev.includes(chip)
                                  ? prev
                                  : prev.trim()
                                  ? `${prev.trim()}; ${chip}.`
                                  : `${chip}.`
                              )
                            }
                            className="px-2.5 py-1 rounded-lg bg-white hover:bg-purple-100 border border-purple-300 text-[11px] font-bold text-purple-950 transition-colors cursor-pointer"
                          >
                            + {chip}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 pt-1">
                      <button
                        onClick={handleGenerateAiCloneExam}
                        disabled={isProcessing}
                        className="flex-1 py-3.5 px-4 rounded-xl text-xs sm:text-sm font-black text-white btn-3d-purple flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                      >
                        <RefreshCw
                          className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`}
                        />
                        <span>
                          {aiClonedVariants.length > 0
                            ? `Sinh Lại ${numAiExamsToGenerate} Đề AI Theo Chỉ Dẫn Mới`
                            : `Bắt Đầu Sinh ${numAiExamsToGenerate} Đề AI Theo Ý Giáo Viên (${currentModelInfo.name})`}
                        </span>
                      </button>

                      {clonedQuestions.length > 0 && (
                        <>
                          <button
                            onClick={handleApplyAiCloneAsMaster}
                            className="py-3 px-3.5 rounded-xl text-xs font-black text-white btn-3d-emerald flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                          >
                            <ArrowRightLeft className="w-4 h-4" />
                            <span>Dùng Đề AI Này Làm Đề Gốc</span>
                          </button>

                          <button
                            onClick={handleDownloadAiCloneDocx}
                            className="py-3 px-3.5 rounded-xl text-xs font-black text-white btn-3d-primary flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                          >
                            <Download className="w-4 h-4" />
                            <span>Tải Đề AI Này (.docx)</span>
                          </button>

                          {aiClonedVariants.length > 1 && (
                            <button
                              onClick={handleDownloadAllFourAiClonesZip}
                              className="py-3 px-3.5 rounded-xl text-xs font-black text-white btn-3d-rose flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                            >
                              <FileArchive className="w-4 h-4" />
                              <span>Tải Bộ {aiClonedVariants.length} Đề AI (.zip)</span>
                            </button>
                          )}
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
                  {/* THANH CHỌN 4 ĐỀ AI KHÁC NHAU ĐƯỢC SINH CÙNG LÚC */}
                  {aiClonedVariants.length > 0 && (
                    <div className="p-4 rounded-2xl toolbar-3d flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-purple-950 uppercase mr-1">
                          Chọn Đề AI vừa sinh ({aiClonedVariants.length} đề):
                        </span>
                        {aiClonedVariants.map((variant, vIdx) => {
                          const isSelected = selectedAiVariantIdx === vIdx;
                          const btnColors = [
                            'btn-3d-purple',
                            'btn-3d-primary',
                            'btn-3d-emerald',
                            'btn-3d-orange',
                          ];
                          return (
                            <button
                              key={variant.examCode}
                              type="button"
                              onClick={() => {
                                setSelectedAiVariantIdx(vIdx);
                                setClonedQuestions(variant.questions);
                              }}
                              className={`px-4 py-2 rounded-xl text-xs font-black text-white transition-all cursor-pointer ${
                                btnColors[vIdx % btnColors.length]
                              } ${
                                isSelected
                                  ? 'ring-4 ring-purple-300 scale-105'
                                  : 'opacity-85 hover:opacity-100'
                              }`}
                            >
                              {variant.title} ({variant.examCode})
                            </button>
                          );
                        })}
                      </div>
                      <span className="text-xs font-bold text-indigo-950 bg-indigo-100 px-3 py-1.5 rounded-xl border border-indigo-300">
                        Đặc tả biến thể: {aiClonedVariants[selectedAiVariantIdx]?.specialtyLabel}
                      </span>
                    </div>
                  )}

                  <div className="px-5 py-3 rounded-2xl bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-extrabold uppercase">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span>
                        Đối Chiếu Song Song: Đề Gốc &amp; {aiClonedVariants[selectedAiVariantIdx]?.title || 'Đề Tương Đương'} ({clonedQuestions.length} câu — Đủ 4 phương án/câu)
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
                  onClick={handleDownloadMasterWithSolutions}
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
                            BẢNG ĐÁP ÁN CHẤM THI CÁC MÃ ĐỀ ({shuffledVariants.length} MÃ ĐỀ)
                          </h3>
                        </div>
                        <p className="text-xs text-slate-700 font-semibold">
                          Bên trái là các Mã đề, bên phải là đáp án từng câu và từng phần theo thứ tự từ trên xuống: Phần I · Phần II · Phần III (Times New Roman 12pt).
                        </p>
                      </div>

                      <div className="flex items-center gap-2.5 flex-wrap">
                        {/* Toggle chế độ xem Bảng Khảo Thí A4 vs Thẻ 3 Cột Màu */}
                        <div className="flex items-center bg-sky-100 p-1 rounded-xl border border-sky-300">
                          <button
                            type="button"
                            onClick={() => setAnswerSheetViewMode('KHAO_THI_A4')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                              answerSheetViewMode === 'KHAO_THI_A4'
                                ? 'bg-blue-700 text-white shadow-xs'
                                : 'text-slate-700 hover:text-blue-900'
                            }`}
                          >
                            Bảng Khảo Thí A4 (Nộp Khảo Thí)
                          </button>
                          <button
                            type="button"
                            onClick={() => setAnswerSheetViewMode('THREE_COLUMN_CARDS')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                              answerSheetViewMode === 'THREE_COLUMN_CARDS'
                                ? 'bg-blue-700 text-white shadow-xs'
                                : 'text-slate-700 hover:text-blue-900'
                            }`}
                          >
                            Thẻ 3 Cột Màu Trực Quan
                          </button>
                        </div>

                        <button
                          onClick={handleDownloadMasterAnswerSheetDocx}
                          className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black text-white btn-3d-purple flex items-center gap-2 whitespace-nowrap shrink-0"
                          title="Tải về tệp Word bảng đáp án chuẩn trên 1 trang A4 để nộp khảo thí"
                        >
                          <Download className="w-4 h-4" />
                          <span>
                            Tải Bảng Đáp Án Khảo Thí A4 (.docx)
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Tiêu đề Quốc ngữ (giống đề) */}
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
                          BẢNG ĐÁP ÁN CHÍNH THỨC NỘP KHẢO THÍ
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

                    {/* NỘI DUNG BẢNG ĐÁP ÁN: CHẾ ĐỘ KHẢO THÍ A4 HOẶC THẺ 3 CỘT MÀU */}
                    {answerSheetViewMode === 'KHAO_THI_A4' ? (
                      <div
                        style={{ fontFamily: "'Times New Roman', Times, serif" }}
                        className="overflow-x-auto rounded-2xl border-2 border-sky-400 bg-white shadow-xs"
                      >
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-sky-900 text-white font-extrabold uppercase text-xs">
                              <th className="py-2.5 px-4 w-1/5 border-b border-sky-800 text-center">
                                MÃ ĐỀ THI
                              </th>
                              <th className="py-2.5 px-4 w-4/5 border-b border-sky-800">
                                ĐÁP ÁN CHI TIẾT CÁC PHẦN (THEO THỨ TỰ TỪ TRÊN XUỐNG)
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y-2 divide-sky-200 text-[13px]">
                            {shuffledVariants.map((v) => {
                              const p1Text = v.answerKey.part1
                                .map((item) => `${item.questionNumber}.${item.answer}`)
                                .join('   ');
                              const p2Text = v.answerKey.part2
                                .map(
                                  (item) =>
                                    `Câu ${item.questionNumber}: ${item.dsString} (${item.tfString})`
                                )
                                .join('   |   ');
                              const p3Text = v.answerKey.part3
                                .map((item) => `Câu ${item.questionNumber}: ${item.answer}`)
                                .join('   |   ');

                              return (
                                <tr key={`khao-thi-${v.examCode}`} className="hover:bg-sky-50/50">
                                  <td className="py-4 px-3 bg-sky-50/90 text-center border-r-2 border-sky-300 align-middle">
                                    <div className="text-xs font-bold text-sky-800 uppercase tracking-wide">
                                      MÃ ĐỀ
                                    </div>
                                    <div className="text-2xl font-black text-sky-950 font-mono my-0.5">
                                      {v.examCode}
                                    </div>
                                    <div className="text-[11px] text-slate-500 italic">
                                      ({v.questions.length} câu)
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 space-y-2.5 align-middle">
                                    {/* Phần I */}
                                    <div className="leading-relaxed">
                                      <span className="font-bold text-blue-900 mr-2">
                                        PHẦN I (18 câu 4 lựa chọn):
                                      </span>
                                      <span className="font-mono font-bold text-rose-600 tracking-wide">
                                        {p1Text}
                                      </span>
                                    </div>
                                    {/* Phần II */}
                                    <div className="leading-relaxed">
                                      <span className="font-bold text-emerald-900 mr-2">
                                        PHẦN II (4 câu Đúng / Sai):
                                      </span>
                                      <span className="font-mono font-semibold text-slate-900">
                                        {p2Text}
                                      </span>
                                    </div>
                                    {/* Phần III */}
                                    <div className="leading-relaxed">
                                      <span className="font-bold text-amber-900 mr-2">
                                        PHẦN III (6 câu Trả lời ngắn):
                                      </span>
                                      <span className="font-mono font-bold text-rose-600 tracking-wide">
                                        {p3Text}
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>

                        {/* Khung chữ ký khảo thí & cán bộ chấm thi */}
                        <div className="grid grid-cols-2 gap-4 p-4 border-t-2 border-sky-300 text-center text-slate-800 bg-slate-50/70">
                          <div>
                            <div className="font-bold text-xs uppercase">
                              CÁN BỘ CHẤM THI 1
                            </div>
                            <div className="text-[11px] italic text-slate-500 pt-1">
                              (Ký và ghi rõ họ tên)
                            </div>
                          </div>
                          <div>
                            <div className="font-bold text-xs uppercase">
                              CÁN BỘ CHẤM THI 2 / KHẢO THÍ
                            </div>
                            <div className="text-[11px] italic text-slate-500 pt-1">
                              (Ký và ghi rõ họ tên)
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-5">
                        {shuffledVariants.map((variant) =>
                          renderThreeColumnAnswerCard(variant)
                        )}
                      </div>
                    )}
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
                            <span className="italic font-bold">
                              Môn: {formatPedagogicalSubject(config.subjectName)} — Lớp: 12 — Mã đề: {activeVariant.examCode}
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

      {/* Modal Phóng To Sơ Đồ / Hình Ảnh Minh Họa */}
      {previewModalImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewModalImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-white rounded-3xl p-4 shadow-2xl overflow-hidden flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between pb-3 border-b border-slate-200">
              <span className="text-sm font-black text-sky-950 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-blue-600" />
                <span>{previewModalImage.caption || 'Xem Chi Tiết Sơ Đồ / Hình Ảnh'}</span>
              </span>
              <button
                type="button"
                onClick={() => setPreviewModalImage(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[75vh] flex items-center justify-center">
              <img
                src={previewModalImage.src}
                alt={previewModalImage.caption || 'Hình ảnh phóng to'}
                className="max-h-[70vh] max-w-full object-contain rounded-xl shadow-md"
              />
            </div>
            <div className="w-full pt-2 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewModalImage(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white btn-3d-primary"
              >
                Đóng Cửa Sổ
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

      {/* ================= CHÂN TRANG CỐ ĐỊNH: LOGO NHẤP NHÁY + THÔNG TIN LIÊN HỆ & GÓP Ý TÁC GIẢ HỒ TẤN KHẢI ================= */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 footer-fixed-3d px-4 sm:px-6 py-2 text-white">
        <div className="max-w-[1440px] mx-auto flex flex-col lg:flex-row items-center justify-between gap-2">
          {/* Cụm Trái: Logo 3D Nhấp Nháy + Tên trang web EduMix 2025 */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-xl logo-3d-badge animate-logo-blink flex items-center justify-center text-white shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <span className="text-lg sm:text-xl font-black tracking-tight animate-edumix-gradient whitespace-nowrap">
              EduMix 2025
            </span>
          </div>

          {/* Cụm Phải: Dòng chữ liên hệ & góp ý sản phẩm của tác giả Hồ Tấn Khải (Đứng yên, rõ nét) */}
          <div className="text-center lg:text-right">
            <div className="space-y-0.5 leading-snug">
              <p className="text-xs sm:text-[13px] font-bold tracking-wide text-amber-300">
                Mọi chi tiết liên hệ và góp ý sản phẩm xin liên hệ tác giả: <span className="text-white font-black">Hồ Tấn Khải Trường THPT Mang Thít</span>. Email: <a href="mailto:khaibcmt@gmail.com" className="text-sky-300 underline hover:text-white font-mono">khaibcmt@gmail.com</a> và Nhắn tin qua Zalo: <span className="text-emerald-300 font-mono font-black">0939580982</span>.
              </p>
              <p className="text-xs sm:text-[13px] font-extrabold tracking-wide text-cyan-300">
                Xin chân thành cám ơn góp ý của quí đồng nghiệp để sản phẩm ngày càng tốt hơn !!!
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
