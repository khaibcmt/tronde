import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  Key,
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
  PhieuQMSelectionCode,
  QRAppFormat,
  ShuffleConfig,
  ShuffledVariant,
  SubItemPart2,
  TripleGradingQrSet,
  ValidationIssue,
} from './types/exam';
import {
  SAMPLE_2025_EXAM_WITH_ERRORS,
  DYNAMIC_FEATURE_REGISTRY,
} from './utils/sampleExamData';
import {
  computeAutoLayoutForOptions,
  mergeRichMetadataFromExistingQuestions,
  normalizeAllQuestionsStrictFourOptions,
  parseClipboardHtmlToExamQuestions,
  parseDocxExamFile,
  parseRawTextToExamQuestions,
  recalculateQuestionNumbering,
  serializeQuestionsToWordRawText,
  validateExamQuestions,
} from './utils/docxParser';
import { parsePdfExamFile } from './utils/pdfParser';
import { enhanceAndCropExamImage } from './utils/scientificExamProcessor';
import {
  auditShuffledVariants,
  exportGradingExcelXlsx,
  generateMasterMultiQrCode,
  generateSequentialExamCodesFromRoot,
  generateShuffledVariants,
} from './utils/shuffleEngine';
import {
  ALL_PHIEU_QM_2025_TEMPLATES,
  buildStandardExportFileName,
  exportAllVariantsZipBundle,
  exportCleanedMasterDocx,
  exportFourAiClonesZipBundle,
  exportMasterAnswerSheetDocx,
  exportMatrixAndSpecificationDocx,
  exportQrCodesZip,
  exportSingleVariantDocx,
  formatPedagogicalSubject,
  getPhieuQMInfoBySubject,
  renderAnswerSheetAssetToDataUrl,
  resolvePhieuQMInfoForConfig,
  triggerBrowserDownload,
} from './utils/docxExporter';
import { buildCV7991MatrixAndSpecification } from './utils/matrixSpecCv7991';
import {
  AI_CLONE_BATCH_SIZE,
  AiBatchProgressInfo,
  AiClonedExamVariant,
  AiConnectionStatus,
  AiNodeChannel,
  DEFAULT_AI_NODE_CLUSTER,
  GEMINI_MODEL_OPTIONS,
  checkAiPrivacyConnectionStatus,
  generateFourSimultaneousAiExams,
  generateSingleBatchOfFiveAiQuestions,
  sanitizeExamQuestionsForZeroTrace,
  stripForbiddenFluffPhrases,
  triggerZeroTracePurgeOnDownload,
} from './utils/aiExamCloner';
import { UserGuideModal } from './components/UserGuideModal';
import { BuyCoffeeModal, FloatingCoffeeButton } from './components/BuyCoffeeModal';
import { ScientificContentRenderer } from './components/ScientificContentRenderer';
import {
  TeacherAuthGateModal,
  TeacherAuthUser,
} from './components/TeacherAuthGateModal';

export default function App() {
  // 1. State quản lý File & Câu hỏi gốc (Mặc định hiển thị Đề Kiểm Tra Cuối Học Kì 1 — Môn Sinh Học 12 Chuẩn Cấu Trúc 2025)
  const [fileName, setFileName] = useState<string>(
    'De_Kiem_Tra_Cuoi_Hoc_Ki_1_Sinh_Hoc_12_Chuan_2025.docx'
  );
  const [questions, setQuestions] = useState<ExamQuestion[]>(() =>
    recalculateQuestionNumbering(SAMPLE_2025_EXAM_WITH_ERRORS, true)
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [lastSavedAt, setLastSavedAt] = useState<string>('Vừa khởi tạo');
  const [editedQuestionIds, setEditedQuestionIds] = useState<string[]>([]);
  const [unsavedQuestionIds, setUnsavedQuestionIds] = useState<string[]>([]);
  const [savedQuestionTimestamps, setSavedQuestionTimestamps] = useState<
    Record<string, string>
  >({});
  const lastEditSourceRef = useRef<'CARDS_3D' | 'WORD_A4_PAGE'>('CARDS_3D');
  const [isSavedAndReadyState, setIsSavedAndReadyState] = useState<boolean>(false);
  const [highlightedQuestionId, setHighlightedQuestionId] = useState<string | null>(null);
  const [activeRightTab, setActiveRightTab] = useState<
    'LIVE_EDITOR' | 'AI_CLONE_STUDIO' | 'BLOOM_MATRIX' | 'SHUFFLED_PREVIEW'
  >('LIVE_EDITOR');
  const [filterPart, setFilterPart] = useState<'ALL' | PartType>('ALL');
  const [answerSheetViewMode, setAnswerSheetViewMode] = useState<
    'MA_TRAN_DOI_CHIEU' | 'KHAO_THI_A4' | 'THREE_COLUMN_CARDS'
  >('MA_TRAN_DOI_CHIEU');
  const [masterMultiQr, setMasterMultiQr] = useState<{
    qrDataUrl: string;
    qrPayload: string;
    tripleQr: TripleGradingQrSet;
  } | null>(null);
  const [activeQrViewCode, setActiveQrViewCode] = useState<'ALL' | string>('ALL');
  const [statusBanner, setStatusBanner] = useState<{
    type: 'SUCCESS' | 'INFO' | 'ERROR';
    text: string;
  } | null>(null);

  // 2. State cấu hình Trộn đề, Tiêu đề Quốc ngữ, Kỳ kiểm tra mặc định "KIỂM TRA ÔN TẬP", Số phút mặc định (45 phút) & Phiếu trả lời trắc nghiệm
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
    embedPhieuQM2025: true,
    selectedPhieuQMCode: 'AUTO',
    includeSolutionsInExport: false,
    departmentName: 'SỞ GD&ĐT VĨNH LONG',
    schoolName: 'TRƯỜNG THPT MANG THÍT',
    nationalHeader: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',
    nationalMotto: 'Độc lập - Tự do - Hạnh phúc',
    examTitle: 'KIỂM TRA ÔN TẬP',
    examSubtitle: '( Đề chính thức )',
    subjectName: 'SINH HỌC',
    gradeLevel: 'Lớp 12',
    schoolYear: `Năm học ${new Date().getFullYear()} - ${new Date().getFullYear() + 1}`,
    durationMinutes: 45,
    teacherName: (() => {
      try {
        const raw = localStorage.getItem('tronde_current_user');
        if (!raw) return '';
        const parsed = JSON.parse(raw);
        return parsed?.name ? String(parsed.name) : '';
      } catch {
        return '';
      }
    })(),
  });
  const [isConfigCollapsed, setIsConfigCollapsed] = useState<boolean>(false);
  const [showCustomCodeEditor, setShowCustomCodeEditor] = useState<boolean>(false);
  const [isPhieuQmGalleryOpen, setIsPhieuQmGalleryOpen] = useState<boolean>(false);
  const phieuUploadInputRef = useRef<HTMLInputElement | null>(null);

  const activePhieuQMInfo = useMemo(
    () => resolvePhieuQMInfoForConfig(config),
    [config]
  );
  const [resolvedPhieuPreviewUrl, setResolvedPhieuPreviewUrl] = useState<string>(
    () => activePhieuQMInfo.publicUrl
  );
  const [galleryPdfPreviews, setGalleryPdfPreviews] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    if (activePhieuQMInfo.publicUrl.startsWith('data:image/')) {
      setResolvedPhieuPreviewUrl(activePhieuQMInfo.publicUrl);
      return;
    }
    renderAnswerSheetAssetToDataUrl(
      activePhieuQMInfo.publicUrl,
      activePhieuQMInfo.isPdfSource
    ).then((url) => {
      if (!cancelled && url) {
        setResolvedPhieuPreviewUrl(url);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activePhieuQMInfo]);

  useEffect(() => {
    if (!isPhieuQmGalleryOpen) return;
    let cancelled = false;
    ALL_PHIEU_QM_2025_TEMPLATES.forEach((tpl) => {
      if (tpl.isPdfSource && !galleryPdfPreviews[tpl.groupCode]) {
        renderAnswerSheetAssetToDataUrl(tpl.publicUrl, true).then((dataUrl) => {
          if (!cancelled && dataUrl) {
            setGalleryPdfPreviews((prev) => ({
              ...prev,
              [tpl.groupCode]: dataUrl,
            }));
          }
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isPhieuQmGalleryOpen, galleryPdfPreviews]);

  // Tải lên Phiếu trả lời trắc nghiệm tùy chọn (.jpg, .png, .pdf) của giáo viên
  const handleUploadCustomPhieuQM = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    try {
      const isPdf =
        file.name.toLowerCase().endsWith('.pdf') ||
        file.type === 'application/pdf';
      const objectUrl = URL.createObjectURL(file);
      let finalDataUrl = '';
      try {
        finalDataUrl = await renderAnswerSheetAssetToDataUrl(objectUrl, isPdf);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }

      const aspect = await new Promise<number>((resolve) => {
        const img = new Image();
        img.onload = () => {
          const w = img.naturalWidth || 624;
          const h = img.naturalHeight || 310;
          resolve(w / Math.max(1, h));
        };
        img.onerror = () => resolve(2.0129);
        img.src = finalDataUrl;
      });

      setConfig((prev) => ({
        ...prev,
        embedPhieuQM2025: true,
        selectedPhieuQMCode: 'CUSTOM',
        customPhieuQMDataUrl: finalDataUrl,
        customPhieuQMName: file.name,
        customPhieuQMAspectRatio: aspect,
      }));
      setResolvedPhieuPreviewUrl(finalDataUrl);
      setStatusBanner({
        type: 'SUCCESS',
        text: `Đã nạp phiếu trả lời tùy chỉnh "${file.name}"! Phiếu này sẽ được tự động đưa vào tất cả các đề trộn Word (.docx) và bản xem trước.`,
      });
    } catch (err) {
      setStatusBanner({
        type: 'ERROR',
        text: `Không thể đọc file phiếu trả lời: ${
          err instanceof Error ? err.message : 'Lỗi định dạng'
        }`,
      });
    } finally {
      setIsProcessing(false);
      if (phieuUploadInputRef.current) phieuUploadInputRef.current.value = '';
    }
  };

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
    'Thực hiện đúng 3 bước: Bước 1 - Bảo toàn cấu trúc & ma trận (Biết - Hiểu - Vận dụng); Bước 2 - Bảo toàn 100% cơ chế khoa học & dạng toán trong giới hạn đề gốc; Bước 3 - Đổi mới hoàn toàn ngữ cảnh thực tế & số liệu, tính lại đáp số chính xác 100%, không bịa số liệu, không lấy nguyên đề gốc, không thêm từ vô nghĩa hay theo chương trình giáo dục 2018.'
  );
  const [numAiExamsToGenerate, setNumAiExamsToGenerate] = useState<1 | 2 | 3 | 4>(1);
  const [aiTeacherGuidance, setAiTeacherGuidance] = useState<string>(
    'Đổi mới hoàn toàn ngữ cảnh thực tiễn và bộ số liệu chẵn dễ tính toán, tính lại chính xác 100% đáp án, giữ nguyên cơ chế khoa học và mức độ tư duy của từng câu trong đề gốc.'
  );
  const [aiClonedVariants, setAiClonedVariants] = useState<AiClonedExamVariant[]>([]);
  const [selectedAiVariantIdx, setSelectedAiVariantIdx] = useState<number>(0);
  const [clonedQuestions, setClonedQuestions] = useState<ExamQuestion[]>([]);
  const [cloneIteration, setCloneIteration] = useState<number>(1);
  const [lastAiEngineUsed, setLastAiEngineUsed] = useState<string>(
    'Gemini AI · Sinh Tuần Tự 5 Câu/Đợt · Chuẩn 3 Bước Đồng Đẳng'
  );
  const [aiBatchProgress, setAiBatchProgress] = useState<AiBatchProgressInfo | null>(null);
  const [manualBatchCursor, setManualBatchCursor] = useState<number>(0);

  // 4. State kết quả sau khi bấm [Trộn đề]
  const [shuffledVariants, setShuffledVariants] = useState<ShuffledVariant[]>([]);
  const [selectedVariantCode, setSelectedVariantCode] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // 5. State Cẩm nang hướng dẫn tự động điền khi nâng cấp & Xác thực Giáo viên (QuanLy_TronDe)
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [isCoffeeModalOpen, setIsCoffeeModalOpen] = useState<boolean>(false);
  const [currentTeacherUser, setCurrentTeacherUser] =
    useState<TeacherAuthUser | null>(() => {
      try {
        const raw = localStorage.getItem('tronde_current_user');
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed && parsed.gmail && parsed.name) {
          return parsed as TeacherAuthUser;
        }
        return null;
      } catch {
        return null;
      }
    });
  const [isAuthGateModalOpen, setIsAuthGateModalOpen] = useState<boolean>(
    () => {
      try {
        return !localStorage.getItem('tronde_current_user');
      } catch {
        return true;
      }
    }
  );
  const [featureRegistry, setFeatureRegistry] = useState<FeatureReleaseItem[]>(
    DYNAMIC_FEATURE_REGISTRY
  );

  // Refs phục vụ cuộn tự động tới câu bị lỗi
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Chạy Validator tự động trên danh sách câu hỏi hiện tại
  const validationIssues: ValidationIssue[] = validateExamQuestions(questions);
  const errorIssues = validationIssues.filter((i) => i.severity === 'ERROR');
  const canShuffle = errorIssues.length === 0 && !hasUnsavedChanges;

  // Thống kê số lượng câu theo từng phần (Phần I, II, III, IV Tự luận)
  const part1Count = questions.filter((q) => q.part === 'PART_1').length;
  const part2Count = questions.filter((q) => q.part === 'PART_2').length;
  const part3Count = questions.filter((q) => q.part === 'PART_3').length;
  const part4Count = questions.filter((q) => q.part === 'PART_4').length;
  const essayRomanLabel =
    part3Count === 0 && part2Count === 0
      ? 'PHẦN II'
      : part3Count === 0
      ? 'PHẦN III'
      : 'PHẦN IV';

  // Thống kê Ma trận nhận thức Bloom
  const bloomStats = {
    NHAN_BIET: questions.filter((q) => (q.bloomLevel || 'NHAN_BIET') === 'NHAN_BIET').length,
    THONG_HIEU: questions.filter((q) => q.bloomLevel === 'THONG_HIEU').length,
    VAN_DUNG: questions.filter((q) => q.bloomLevel === 'VAN_DUNG').length,
    VAN_DUNG_CAO: questions.filter((q) => q.bloomLevel === 'VAN_DUNG_CAO').length,
  };

  // Ma trận & Bản đặc tả theo đúng Công văn số 7991/BGDĐT-GDTrH
  const matrixCv7991Data = useMemo(
    () => buildCV7991MatrixAndSpecification(questions),
    [questions]
  );

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

  // Thêm ảnh / sơ đồ / đồ thị đính kèm vào câu hỏi (Tự động crop viền thừa, khử nhiễu nền, giữ nguyên tỷ lệ khung hình 300 DPI & gắn thẻ [HINH_ANH_CAU_X])
  const handleAddImageToQuestion = (
    questionId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const rawDataUrl = ev.target?.result as string;
      if (!rawDataUrl) return;

      const targetQ = questions.find((q) => q.id === questionId);
      const qNum = targetQ?.displayIndex || 1;
      const processed = await enhanceAndCropExamImage(rawDataUrl, qNum, file.name);

      setQuestions((prev) =>
        prev.map((q) => {
          if (q.id !== questionId) return q;
          const nextIdx = (q.images?.length || 0) + 1;
          const suffix = nextIdx > 1 ? `_${nextIdx}` : '';
          const tagId = `[HINH_ANH_CAU_${q.displayIndex}${suffix}]`;
          const newImg: ExamImageAttachment = {
            id: `img-man-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            dataUrl: processed.dataUrl,
            fileName: file.name,
            caption: `Hình minh họa Câu ${q.displayIndex} ${tagId}`,
            tagId,
            widthTwips: processed.widthTwips,
            heightTwips: processed.heightTwips,
            aspectRatio: processed.aspectRatio,
            dpi: 300,
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
        text: `Đã tự động cắt viền, khử nhiễu nền (300 DPI) và gắn thẻ ${processed.tagId} (In Line with Text) cho "${file.name}".`,
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

  // ================= HANDLERS: UPLOAD & PARSE WORD (.DOCX/.DOC), PDF, SCAN & ẢNH =================
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const lowerName = file.name.toLowerCase();
      const isImageOrScan =
        /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(lowerName) ||
        file.type.startsWith('image/');

      if (isImageOrScan) {
        const rawDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string) || '');
          reader.onerror = () => reject(new Error('Không thể đọc tệp hình ảnh'));
          reader.readAsDataURL(file);
        });

        const targetId = activeFocusedQuestionId || questions[0]?.id;
        const targetQ = questions.find((q) => q.id === targetId) || questions[0];
        const qNum = targetQ?.displayIndex || 1;
        const processed = await enhanceAndCropExamImage(rawDataUrl, qNum, file.name);

        if (targetQ) {
          setQuestions((prev) =>
            prev.map((q) => {
              if (q.id !== targetQ.id) return q;
              const nextIdx = (q.images?.length || 0) + 1;
              const suffix = nextIdx > 1 ? `_${nextIdx}` : '';
              const tagId = `[HINH_ANH_CAU_${q.displayIndex}${suffix}]`;
              const newImg: ExamImageAttachment = {
                id: `img-scan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                dataUrl: processed.dataUrl,
                fileName: file.name,
                caption: `Sơ đồ / Đồ thị Câu ${q.displayIndex} ${tagId}`,
                tagId,
                widthTwips: processed.widthTwips,
                heightTwips: processed.heightTwips,
                aspectRatio: processed.aspectRatio,
                dpi: 300,
              };
              return {
                ...q,
                hasImage: true,
                images: [...(q.images || []), newImg],
              };
            })
          );
          setHasUnsavedChanges(true);
          setActiveRightTab('LIVE_EDITOR');
          setStatusBanner({
            type: 'SUCCESS',
            text: `Đã xử lý ảnh/sơ đồ "${file.name}" (Khử nhiễu nền, giữ nguyên tỷ lệ 300 DPI, gắn thẻ ${processed.tagId} In Line with Text) vào Câu ${qNum}!`,
          });
        }
        return;
      }

      const isPdf =
        lowerName.endsWith('.pdf') || file.type === 'application/pdf';

      const rawParsed = isPdf
        ? await parsePdfExamFile(file, config.resetNumberingPerPart)
        : await parseDocxExamFile(file, config.resetNumberingPerPart);

      const parsed = normalizeAllQuestionsStrictFourOptions(
        rawParsed,
        config.resetNumberingPerPart
      );

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
        const totalTables = parsed.reduce(
          (acc, q) => acc + (q.stemTables?.length || 0),
          0
        );
        const formulaCount = parsed.filter((q) => q.hasFormula).length;

        const issuesAfterParse = validateExamQuestions(parsed);
        setFileName(file.name);
        setQuestions(parsed);
        setWordRawDocumentText(serializeQuestionsToWordRawText(parsed));
        setHasUnsavedChanges(false);
        setEditedQuestionIds([]);
        setUnsavedQuestionIds([]);
        setSavedQuestionTimestamps({});
        lastEditSourceRef.current = 'CARDS_3D';
        setIsSavedAndReadyState(issuesAfterParse.length === 0);
        setShuffledVariants([]);
        setClonedQuestions([]);
        setAiClonedVariants([]);
        setActiveRightTab('LIVE_EDITOR');
        setFilterPart('ALL');
        setLastSavedAt(new Date().toLocaleTimeString('vi-VN'));

        if (issuesAfterParse.length > 0) {
          setHighlightedQuestionId(issuesAfterParse[0].questionId);
          setStatusBanner({
            type: 'ERROR',
            text: `Đã phân tích tệp "${file.name}" (${parsed.length} câu hỏi). Phát hiện ${issuesAfterParse.length} cảnh báo/thiếu sót đáp án (Hệ thống TUYỆT ĐỐI KHÔNG tự bịa đáp án). Vui lòng kiểm tra và bổ sung/chỉnh sửa các câu được đánh dấu đỏ bên dưới!`,
          });
        } else {
          setStatusBanner({
            type: 'SUCCESS',
            text: `Đã phân tích tệp "${file.name}" (${parsed.length} câu hỏi chuẩn đáp án từ giáo viên${
              totalImages > 0 ? `, ${totalImages} sơ đồ/đồ thị 300 DPI` : ''
            }${totalTables > 0 ? `, ${totalTables} bảng dữ liệu` : ''}${
              formulaCount > 0 ? `, ${formulaCount} câu có công thức OMML/LaTeX` : ''
            }).`,
          });
        }
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
      examTitle: 'KIỂM TRA ÔN TẬP',
      examSubtitle: '( Đề chính thức )',
      subjectName: 'SINH HỌC',
      gradeLevel: 'Lớp 12',
      durationMinutes: 45,
    }));
    setFileName('De_Kiem_Tra_Cuoi_Hoc_Ki_1_Sinh_Hoc_12_Chuan_2025.docx');
    setHasUnsavedChanges(false);
    setEditedQuestionIds([]);
    setUnsavedQuestionIds([]);
    setSavedQuestionTimestamps({});
    lastEditSourceRef.current = 'CARDS_3D';
    setIsSavedAndReadyState(true);
    setLastSavedAt(new Date().toLocaleTimeString('vi-VN'));
    setStatusBanner({
      type: 'SUCCESS',
      text: 'Đã nạp Đề Kiểm Tra Cuối Học Kì 1 — Môn Sinh Học 12 (Tỉ lệ 18 - 4 - 6 = 28 câu, tích hợp sơ đồ DNA, Operon Lac, Sơ đồ Phả hệ, bài tập DNA-RNA-Protein, lai Mendel, liên kết giới tính, di truyền học người & chọn giống, chuẩn 100% không lỗi)!',
    });
  };

  const handleLoadMathSamplePdf = async () => {
    setIsProcessing(true);
    setStatusBanner({
      type: 'INFO',
      text: 'Đang bóc tách Đề Toán Mẫu 12 (22 câu: công thức phân số, căn thức, mũ/logarit, 12 đồ thị hàm số, bảng biến thiên & hình học không gian)...',
    });
    try {
      const response = await fetch(`${import.meta.env.BASE_URL || '/'}assets/aistudio/___To_n_M_u_a0e60074.pdf`);
      if (!response.ok) {
        throw new Error(`Không tải được file mẫu Toán (${response.status})`);
      }
      const blob = await response.blob();
      const sampleFile = new File([blob], 'De_Toan_Mau_12_Chuan_2025.pdf', {
        type: 'application/pdf',
      });
      const parsed = await parsePdfExamFile(
        sampleFile,
        config.resetNumberingPerPart
      );
      if (parsed && parsed.length > 0) {
        const numbered = normalizeAllQuestionsStrictFourOptions(
          parsed,
          config.resetNumberingPerPart
        );
        setQuestions(numbered);
        setShuffledVariants([]);
        setWordRawDocumentText(serializeQuestionsToWordRawText(numbered));
        setConfig((prev) => ({
          ...prev,
          examTitle: 'ĐỀ KIỂM TRA ĐỊNH KÌ',
          examSubtitle: '( Đề chính thức )',
          subjectName: 'TOÁN HỌC',
          gradeLevel: 'Lớp 12',
          durationMinutes: 90,
        }));
        setFileName('De_Toan_Mau_12_Chuan_2025.pdf');
        setHasUnsavedChanges(false);
        setEditedQuestionIds([]);
        setUnsavedQuestionIds([]);
        setSavedQuestionTimestamps({});
        lastEditSourceRef.current = 'CARDS_3D';
        setIsSavedAndReadyState(true);
        setLastSavedAt(new Date().toLocaleTimeString('vi-VN'));
        const imgCount = numbered.reduce(
          (acc, q) => acc + (q.images?.length || 0),
          0
        );
        setStatusBanner({
          type: 'SUCCESS',
          text: `Đã nạp thành công Đề Toán Mẫu 12 (${numbered.length} câu: 12 câu Phần I, 4 câu Phần II, 6 câu Phần III — bảo toàn ${imgCount} hình vẽ/đồ thị/bảng biến thiên & 100% công thức Toán + đáp án gạch chân)!`,
        });
      }
    } catch (err: any) {
      setStatusBanner({
        type: 'ERROR',
        text: `Không thể nạp đề mẫu Toán tự động: ${err?.message || 'Lỗi tải file'}`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Hàm ghép tài sản đồ họa khi đồng bộ từ Trang Word A4 nay dùng bản DÙNG CHUNG
  // mergeRichMetadataFromExistingQuestions trong utils/docxParser (ghép ở cả 3 cấp:
  // thân câu + từng phương án + từng ý con — bản cũ tại đây chỉ ghép thân câu nên
  // mọi ảnh phương án/ý con đều mất sau một vòng đồng bộ).

  // Đồng bộ từ trình soạn thảo trang giấy Word A4 sang danh sách câu hỏi chuẩn 4 đáp án & Tự luận
  const handleSyncFromWordA4Editor = async () => {
    const rawFromWord = parseRawTextToExamQuestions(
      wordRawDocumentText,
      config.resetNumberingPerPart
    );
    const mergedWithRichMedia = mergeRichMetadataFromExistingQuestions(
      rawFromWord,
      questions
    );
    const parsedFromWord = normalizeAllQuestionsStrictFourOptions(
      mergedWithRichMedia,
      config.resetNumberingPerPart
    );
    if (parsedFromWord.length === 0) {
      setStatusBanner({
        type: 'ERROR',
        text: 'Không nhận diện được câu hỏi nào từ trang soạn thảo Word. Hãy đảm bảo có tiêu đề Câu 1., Câu 2...',
      });
      return;
    }
    const savedTime = new Date().toLocaleTimeString('vi-VN');
    const issuesAfterWordSync = validateExamQuestions(parsedFromWord);
    setQuestions(parsedFromWord);
    setWordRawDocumentText(serializeQuestionsToWordRawText(parsedFromWord));
    setHasUnsavedChanges(false);
    setLastSavedAt(savedTime);

    const remainingErrors = issuesAfterWordSync.filter(
      (i) => i.severity === 'ERROR'
    );
    if (remainingErrors.length > 0) {
      setIsSavedAndReadyState(false);
      setEditorViewMode('CARDS_3D');
      handleScrollToQuestion(remainingErrors[0].questionId);
      setStatusBanner({
        type: 'ERROR',
        text: `Đã cập nhật chỉnh sửa (${parsedFromWord.length} câu hỏi từ Word A4 lúc ${savedTime}) nhưng còn ${remainingErrors.length} câu thiếu/chưa chuẩn đáp án (Đã cuộn tới Câu ${remainingErrors[0].questionIndex}). Vui lòng bổ sung và bấm [Lưu & Trộn Đề]!`,
      });
    } else {
      setIsSavedAndReadyState(true);
      await executeShuffleWithQuestions(
        parsedFromWord,
        `Đã lưu chỉnh sửa từ Trang Word A4 (${parsedFromWord.length} câu hợp lệ lúc ${savedTime}) và trộn thành công ${config.numVariants} mã đề kèm Bảng Đáp Án Chung!`
      );
    }
  };

  // Xử lý sự kiện Paste trực tiếp từ Microsoft Word (HTML Clipboard) để nhận diện chính xác cả GẠCH CHÂN (<u> / text-decoration:underline) và TÔ ĐỎ ở Phần I & Phần II (a, b, c, d)
  const handleWordA4ClipboardPaste = (
    e: React.ClipboardEvent<HTMLTextAreaElement>
  ) => {
    const htmlData = e.clipboardData?.getData('text/html') || '';
    const plainData = e.clipboardData?.getData('text/plain') || '';
    if (
      htmlData &&
      (/<u\b/i.test(htmlData) ||
        /underline/i.test(htmlData) ||
        /color\s*:/i.test(htmlData) ||
        /<font\b/i.test(htmlData))
    ) {
      const rawFromHtml = parseClipboardHtmlToExamQuestions(
        htmlData,
        plainData,
        config.resetNumberingPerPart
      );
      const parsedFromHtml = normalizeAllQuestionsStrictFourOptions(
        rawFromHtml,
        config.resetNumberingPerPart
      );
      if (parsedFromHtml.length > 0) {
        e.preventDefault();
        const serialized = serializeQuestionsToWordRawText(parsedFromHtml);
        const issuesFromPaste = validateExamQuestions(parsedFromHtml);
        setQuestions(parsedFromHtml);
        setWordRawDocumentText(serialized);
        setHasUnsavedChanges(false);
        setLastSavedAt(new Date().toLocaleTimeString('vi-VN'));
        const p2TrueCount = parsedFromHtml
          .filter((q) => q.part === 'PART_2')
          .reduce(
            (sum, q) =>
              sum + (q.subItems?.filter((s) => s.isTrue).length || 0),
            0
          );
        if (issuesFromPaste.length > 0) {
          setHighlightedQuestionId(issuesFromPaste[0].questionId);
          setStatusBanner({
            type: 'ERROR',
            text: `Đã nhận diện định dạng Word khi dán (${parsedFromHtml.length} câu hỏi), nhưng có ${issuesFromPaste.length} câu thiếu/chưa chuẩn đáp án. Hệ thống tuyệt đối không tự bịa đáp án — vui lòng kiểm tra và chỉnh sửa!`,
          });
        } else {
          setStatusBanner({
            type: 'SUCCESS',
            text: `Đã nhận diện định dạng Word (Gạch chân <u> & Tô đỏ) khi dán: Tách thành công ${parsedFromHtml.length} câu hỏi${
              p2TrueCount > 0 ? `, nhận diện ${p2TrueCount} ý ĐÚNG ở Phần II` : ''
            }!`,
          });
        }
      }
    }
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

  // ================= HANDLER: AI TẠO ĐỀ TƯƠNG ĐƯƠNG TUẦN TỰ TỪNG ĐỢT 5 CÂU HỎI CHO ĐẾN HẾT ĐỀ GỐC =================
  const handleGenerateAiCloneExam = async () => {
    if (questions.length === 0) return;
    setIsProcessing(true);
    setActiveRightTab('AI_CLONE_STUDIO');
    setManualBatchCursor(0);
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
        aiTeacherGuidance,
        (progress) => {
          setAiBatchProgress(progress);
          if (progress.partialQuestions.length > 0 && progress.variantIndex === 1) {
            setClonedQuestions(progress.partialQuestions);
          }
          setStatusBanner({
            type: 'INFO',
            text: `[Đề AI 0${progress.variantIndex}/${progress.totalVariants}] ${progress.stepDescription} (${progress.completedQuestionsCount}/${progress.totalQuestionsCount} câu)`,
          });
        }
      );

      setAiClonedVariants(result.variants);
      setSelectedAiVariantIdx(0);
      if (result.variants.length > 0) {
        setClonedQuestions(result.variants[0].questions);
        setManualBatchCursor(result.variants[0].questions.length);
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
        text: `Đã sinh hoàn tất ${result.variants.length} Đề AI Tương Đương (${questions.length} câu · Sinh tuần tự từng đợt ${AI_CLONE_BATCH_SIZE} câu) theo chuẩn 3 bước Sư phạm & Khoa học!`,
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

  // Sinh từng đợt 5 câu hỏi theo trình tự (Bấm lần 1: Câu 1->5, Bấm lần 2: Câu 6->10... cho đến hết đề gốc)
  const handleGenerateNextFiveQuestionsStep = async () => {
    if (questions.length === 0) return;
    const totalCount = questions.length;
    const startIdx = manualBatchCursor >= totalCount ? 0 : manualBatchCursor;
    const endIdx = Math.min(startIdx + AI_CLONE_BATCH_SIZE, totalCount);
    const totalBatches = Math.max(1, Math.ceil(totalCount / AI_CLONE_BATCH_SIZE));
    const currentBatchNumber = Math.floor(startIdx / AI_CLONE_BATCH_SIZE) + 1;

    setIsProcessing(true);
    setActiveRightTab('AI_CLONE_STUDIO');
    try {
      const sensitiveList = anonymizeSchoolInfo
        ? [config.schoolName, config.departmentName, config.examTitle]
        : [];
      const { sanitizedQuestions } = sanitizeExamQuestionsForZeroTrace(
        questions,
        sensitiveList
      );
      const batchSlice = sanitizedQuestions.slice(startIdx, endIdx);
      const guidanceClean = stripForbiddenFluffPhrases(aiTeacherGuidance.trim());
      const combinedInstruction = guidanceClean
        ? `${aiCustomPrompt} | CHỈ DẪN RIÊNG CỦA GIÁO VIÊN: ${guidanceClean}`
        : aiCustomPrompt;

      const baseExisting = startIdx === 0 ? [] : clonedQuestions.slice(0, startIdx);

      setAiBatchProgress({
        variantIndex: 1,
        totalVariants: 1,
        batchIndex: currentBatchNumber,
        totalBatches,
        batchStartQuestionNumber: startIdx + 1,
        batchEndQuestionNumber: endIdx,
        completedQuestionsCount: baseExisting.length,
        totalQuestionsCount: totalCount,
        stepStage: 'STEP_1_MATRIX',
        stepDescription: `Đang sinh Đợt ${currentBatchNumber}/${totalBatches} (Câu ${startIdx + 1} → Câu ${endIdx}): Bước 1 Ma trận → Bước 2 Cơ chế → Bước 3 Đổi mới ngữ cảnh & số liệu...`,
        partialQuestions: baseExisting,
      });

      const { clonedBatch, modelUsed } = await generateSingleBatchOfFiveAiQuestions(
        batchSlice,
        startIdx,
        currentBatchNumber,
        totalBatches,
        cloneIteration,
        selectedModelTier,
        config.subjectName,
        combinedInstruction
      );

      const merged = recalculateQuestionNumbering(
        [...baseExisting, ...clonedBatch],
        config.resetNumberingPerPart
      );

      setClonedQuestions(merged);
      setManualBatchCursor(merged.length);
      setLastAiEngineUsed(`Gemini AI (${modelUsed}) · Sinh Từng Đợt 5 Câu (Đợt ${currentBatchNumber}/${totalBatches})`);

      const nextVariant: AiClonedExamVariant = {
        variantIndex: 1,
        examCode: 'AI-01',
        title: 'Đề AI Tương Đương Số 01',
        specialtyLabel: `Đã sinh ${merged.length}/${totalCount} câu (Đợt ${currentBatchNumber}/${totalBatches})`,
        engineUsed: `Gemini AI (${modelUsed})`,
        questions: merged,
      };
      setAiClonedVariants([nextVariant]);
      setSelectedAiVariantIdx(0);

      setAiBatchProgress({
        variantIndex: 1,
        totalVariants: 1,
        batchIndex: currentBatchNumber,
        totalBatches,
        batchStartQuestionNumber: startIdx + 1,
        batchEndQuestionNumber: endIdx,
        completedQuestionsCount: merged.length,
        totalQuestionsCount: totalCount,
        stepStage: merged.length >= totalCount ? 'COMPLETED' : 'STEP_3_CONTEXT_DATA',
        stepDescription:
          merged.length >= totalCount
            ? `Đã hoàn thành toàn bộ ${totalCount}/${totalCount} câu hỏi của đề tương đương!`
            : `Đã sinh xong Đợt ${currentBatchNumber}/${totalBatches} (Câu ${startIdx + 1} → Câu ${endIdx}). Nhấn "Sinh tiếp 5 câu" để tạo Câu ${endIdx + 1} → Câu ${Math.min(endIdx + AI_CLONE_BATCH_SIZE, totalCount)}.`,
        partialQuestions: merged,
      });

      if (merged.length >= totalCount) {
        setCloneIteration((prev) => prev + 1);
      }

      setStatusBanner({
        type: 'SUCCESS',
        text:
          merged.length >= totalCount
            ? `Đã sinh hoàn tất trọn bộ ${totalCount}/${totalCount} câu hỏi (Đợt cuối: Câu ${startIdx + 1} → Câu ${endIdx})!`
            : `Đã sinh xong 5 câu Đợt ${currentBatchNumber}/${totalBatches} (Câu ${startIdx + 1} → Câu ${endIdx})! Hiện đã có ${merged.length}/${totalCount} câu.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi AI';
      setStatusBanner({
        type: 'ERROR',
        text: `Không thể sinh đợt 5 câu tiếp theo: ${msg}`,
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

  const markQuestionEdited = (questionId: string) => {
    lastEditSourceRef.current = 'CARDS_3D';
    setHasUnsavedChanges(true);
    setIsSavedAndReadyState(false);
    setEditedQuestionIds((prev) =>
      prev.includes(questionId) ? prev : [...prev, questionId]
    );
    setUnsavedQuestionIds((prev) =>
      prev.includes(questionId) ? prev : [...prev, questionId]
    );
    setSavedQuestionTimestamps((prev) => {
      if (!(questionId in prev)) return prev;
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
  };

  const handleUpdateStemText = (questionId: string, newStem: string) => {
    setQuestions((prev) => {
      const next = prev.map((q) =>
        q.id === questionId ? { ...q, stemText: newStem } : q
      );
      setWordRawDocumentText(serializeQuestionsToWordRawText(next));
      return next;
    });
    markQuestionEdited(questionId);
  };

  const handleUpdateBloomLevel = (questionId: string, level: BloomLevel) => {
    setQuestions((prev) => {
      const next = prev.map((q) =>
        q.id === questionId ? { ...q, bloomLevel: level } : q
      );
      setWordRawDocumentText(serializeQuestionsToWordRawText(next));
      return next;
    });
    markQuestionEdited(questionId);
  };

  const handleSelectSingleCorrectPart1 = (
    questionId: string,
    optionId: string
  ) => {
    setQuestions((prev) => {
      const next = prev.map((q) => {
        if (q.id !== questionId || !q.options) return q;
        const updatedOpts: OptionPart1[] = q.options.map((opt) => {
          const isTarget = opt.id === optionId;
          const cleanText = (opt.text || '').replace(/^\s*\*\s*/, '');
          return {
            ...opt,
            text: cleanText,
            isUnderline: isTarget,
            isRed: isTarget,
            isCorrect: isTarget,
          };
        });
        return {
          ...q,
          options: updatedOpts,
        };
      });
      setWordRawDocumentText(serializeQuestionsToWordRawText(next));
      return next;
    });
    markQuestionEdited(questionId);
  };

  const handleToggleOptionPropertyPart1 = (
    questionId: string,
    optionId: string,
    prop: 'isUnderline' | 'isRed'
  ) => {
    setQuestions((prev) => {
      const next = prev.map((q) => {
        if (q.id !== questionId || !q.options) return q;
        const updatedOpts: OptionPart1[] = q.options.map((opt) => {
          if (opt.id !== optionId) return opt;
          const nextVal = !opt[prop];
          const nextUnderline = prop === 'isUnderline' ? nextVal : opt.isUnderline;
          const nextRed = prop === 'isRed' ? nextVal : opt.isRed;
          const cleanText = (opt.text || '').replace(/^\s*\*\s*/, '');
          return {
            ...opt,
            text: cleanText,
            isUnderline: nextUnderline,
            isRed: nextRed,
            isCorrect: nextUnderline || nextRed,
          };
        });
        return { ...q, options: updatedOpts };
      });
      setWordRawDocumentText(serializeQuestionsToWordRawText(next));
      return next;
    });
    markQuestionEdited(questionId);
  };

  const handleUpdateOptionTextPart1 = (
    questionId: string,
    optionId: string,
    newText: string
  ) => {
    setQuestions((prev) => {
      const next = prev.map((q) => {
        if (q.id !== questionId || !q.options) return q;
        const updatedOpts = q.options.map((opt) =>
          opt.id === optionId ? { ...opt, text: newText } : opt
        );
        return {
          ...q,
          options: updatedOpts,
          computedLayout: computeAutoLayoutForOptions(updatedOpts),
        };
      });
      setWordRawDocumentText(serializeQuestionsToWordRawText(next));
      return next;
    });
    markQuestionEdited(questionId);
  };

  const handleToggleSubItemPart2 = (
    questionId: string,
    subItemId: string,
    forceValue?: boolean
  ) => {
    setQuestions((prev) => {
      const next = prev.map((q) => {
        if (q.id !== questionId || !q.subItems) return q;
        const updatedSubs: SubItemPart2[] = q.subItems.map((sub) => {
          if (sub.id !== subItemId) return sub;
          const nextTrue =
            typeof forceValue === 'boolean' ? forceValue : !sub.isTrue;
          const cleanText = (sub.text || '')
            .replace(/^\s*\*\s*/, '')
            .replace(/\s*\(\s*(?:Đúng|Sai|Đ|S|True|False|T|F)\s*\)\s*$/i, '')
            .replace(/\s*\[\s*(?:Đúng|Sai|Đ|S|True|False|T|F)\s*\]\s*$/i, '');
          return {
            ...sub,
            text: cleanText,
            isTrue: nextTrue,
            isUnderline: nextTrue,
            isRed: nextTrue,
          };
        });
        return { ...q, subItems: updatedSubs };
      });
      setWordRawDocumentText(serializeQuestionsToWordRawText(next));
      return next;
    });
    markQuestionEdited(questionId);
  };

  const handleUpdateSubItemTextPart2 = (
    questionId: string,
    subItemId: string,
    newText: string
  ) => {
    setQuestions((prev) => {
      const next = prev.map((q) => {
        if (q.id !== questionId || !q.subItems) return q;
        return {
          ...q,
          subItems: q.subItems.map((sub) =>
            sub.id === subItemId ? { ...sub, text: newText } : sub
          ),
        };
      });
      setWordRawDocumentText(serializeQuestionsToWordRawText(next));
      return next;
    });
    markQuestionEdited(questionId);
  };

  const handleUpdateShortAnswerPart3 = (questionId: string, val: string) => {
    setQuestions((prev) => {
      const next: ExamQuestion[] = prev.map((q) =>
        q.id === questionId
          ? {
              ...q,
              shortAnswer: val,
              shortAnswerDetectedBy: val.trim() ? ('MANUAL' as const) : ('NONE' as const),
            }
          : q
      );
      setWordRawDocumentText(serializeQuestionsToWordRawText(next));
      return next;
    });
    markQuestionEdited(questionId);
  };

  const handleUpdateEssayAnswerPart4 = (questionId: string, val: string) => {
    setQuestions((prev) => {
      const next = prev.map((q) =>
        q.id === questionId
          ? {
              ...q,
              essayAnswer: val,
              explanation: val,
            }
          : q
      );
      setWordRawDocumentText(serializeQuestionsToWordRawText(next));
      return next;
    });
    markQuestionEdited(questionId);
  };

  const handleAddEssayQuestionPart4 = () => {
    const newId = `q-part_4-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const nextOriginalIndex = questions.length + 1;
    const newEssayQuestion: ExamQuestion = {
      id: newId,
      part: 'PART_4',
      originalIndex: nextOriginalIndex,
      displayIndex: part4Count + 1,
      stemText: 'Nhập nội dung câu hỏi tự luận tại đây...',
      bloomLevel: 'VAN_DUNG',
      essayAnswer: '',
    };
    const updated = recalculateQuestionNumbering(
      [...questions, newEssayQuestion],
      config.resetNumberingPerPart
    );
    setQuestions(updated);
    setWordRawDocumentText(serializeQuestionsToWordRawText(updated));
    markQuestionEdited(newId);
    setActiveRightTab('LIVE_EDITOR');
    setFilterPart('PART_4');
    setTimeout(() => {
      questionRefs.current[newId]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 80);
  };

  // Lưu cố định riêng từng câu hỏi đang chỉnh sửa (Đảm bảo chuyển sang câu khác không bao giờ bị mất hoặc thay đổi chỉnh sửa)
  const handleSaveSingleQuestion = (
    questionId: string,
    moveToNextQuestion = false
  ) => {
    lastEditSourceRef.current = 'CARDS_3D';
    const recalculated = normalizeAllQuestionsStrictFourOptions(
      questions,
      config.resetNumberingPerPart
    );
    const savedTime = new Date().toLocaleTimeString('vi-VN');
    setQuestions(recalculated);
    setWordRawDocumentText(serializeQuestionsToWordRawText(recalculated));
    setEditedQuestionIds((prev) =>
      prev.includes(questionId) ? prev : [...prev, questionId]
    );
    setSavedQuestionTimestamps((prev) => ({
      ...prev,
      [questionId]: savedTime,
    }));

    const remainingUnsaved = unsavedQuestionIds.filter((id) => id !== questionId);
    setUnsavedQuestionIds(remainingUnsaved);
    if (remainingUnsaved.length === 0) {
      setHasUnsavedChanges(false);
    }
    setLastSavedAt(savedTime);

    const targetQ = recalculated.find((q) => q.id === questionId);
    const allIssues = validateExamQuestions(recalculated);
    const targetQIssues = allIssues.filter((i) => i.questionId === questionId);
    const allErrors = allIssues.filter((i) => i.severity === 'ERROR');
    setIsSavedAndReadyState(allErrors.length === 0);

    if (moveToNextQuestion) {
      const nextErrIssue = allIssues.find((i) => i.questionId !== questionId);
      if (nextErrIssue) {
        handleScrollToQuestion(nextErrIssue.questionId);
        setStatusBanner({
          type: 'SUCCESS',
          text: `Đã lưu cố định Câu ${targetQ?.displayIndex ?? ''} (lúc ${savedTime})! Đã chuyển sang Câu ${nextErrIssue.questionIndex} để tiếp tục chỉnh sửa mà không làm thay đổi Câu ${targetQ?.displayIndex ?? ''}.`,
        });
        return;
      }
      const currentIdx = recalculated.findIndex((q) => q.id === questionId);
      if (currentIdx >= 0 && currentIdx + 1 < recalculated.length) {
        const nextQ = recalculated[currentIdx + 1];
        handleScrollToQuestion(nextQ.id);
        setStatusBanner({
          type: 'SUCCESS',
          text: `Đã lưu cố định Câu ${targetQ?.displayIndex ?? ''} (lúc ${savedTime}) và chuyển sang Câu ${nextQ.displayIndex}!`,
        });
        return;
      }
    }

    if (targetQIssues.length === 0) {
      setStatusBanner({
        type: 'SUCCESS',
        text: `Đã lưu cố định chỉnh sửa Câu ${targetQ?.displayIndex ?? ''} (lúc ${savedTime})! Giáo viên có thể chuyển sang câu khác thoải mái mà không lo bị thay đổi nội dung đã sửa.`,
      });
    } else {
      setStatusBanner({
        type: 'INFO',
        text: `Đã lưu tạm Câu ${targetQ?.displayIndex ?? ''} (lúc ${savedTime}). Lưu ý: Câu này vẫn còn nhắc nhở: ${targetQIssues[0].message}`,
      });
    }
  };

  // Lưu cố định toàn bộ chỉnh sửa của tất cả các câu (Không tự động nhảy tab để giáo viên yên tâm chuyển qua lại giữa các câu)
  const handleSaveAllEditsOnly = () => {
    let baseQuestions = questions;
    if (
      editorViewMode === 'WORD_A4_PAGE' &&
      lastEditSourceRef.current === 'WORD_A4_PAGE' &&
      hasUnsavedChanges
    ) {
      const rawFromWord = parseRawTextToExamQuestions(
        wordRawDocumentText,
        config.resetNumberingPerPart
      );
      if (rawFromWord.length > 0) {
        baseQuestions = mergeRichMetadataFromExistingQuestions(
          rawFromWord,
          questions
        );
      }
    }

    const recalculated = normalizeAllQuestionsStrictFourOptions(
      baseQuestions,
      config.resetNumberingPerPart
    );
    const savedTime = new Date().toLocaleTimeString('vi-VN');
    setQuestions(recalculated);
    setWordRawDocumentText(serializeQuestionsToWordRawText(recalculated));
    setHasUnsavedChanges(false);
    setUnsavedQuestionIds([]);
    setLastSavedAt(savedTime);
    lastEditSourceRef.current = 'CARDS_3D';

    const idsToMark = Array.from(
      new Set([...editedQuestionIds, ...unsavedQuestionIds])
    );
    setSavedQuestionTimestamps((prev) => {
      const next = { ...prev };
      idsToMark.forEach((id) => {
        next[id] = savedTime;
      });
      return next;
    });

    const remainingErrors = validateExamQuestions(recalculated).filter(
      (i) => i.severity === 'ERROR'
    );
    setIsSavedAndReadyState(remainingErrors.length === 0);

    if (remainingErrors.length === 0) {
      setStatusBanner({
        type: 'SUCCESS',
        text: `Đã lưu cố định TOÀN BỘ chỉnh sửa (${
          idsToMark.length > 0 ? `${idsToMark.length} câu đã sửa · ` : ''
        }lúc ${savedTime})! Mọi câu hỏi đều được giữ nguyên 100% khi chuyển qua lại. Giáo viên có thể bấm "Trộn Đề" hoặc "Lưu & Trộn Đề" bất kỳ lúc nào.`,
      });
    } else {
      setStatusBanner({
        type: 'INFO',
        text: `Đã lưu cố định toàn bộ các câu vừa sửa (lúc ${savedTime})! Các câu đã lưu được khóa an toàn không bị thay đổi khi chuyển câu. Hiện còn ${remainingErrors.length} câu cần bổ sung đáp án trước khi trộn đề.`,
      });
    }
  };

  // Hàm thực thi trộn đề trực tiếp từ danh sách câu hỏi đã chuẩn hóa (Tránh lỗi state bất đồng bộ khi vừa bấm Lưu)
  const executeShuffleWithQuestions = async (
    sourceQuestions: ExamQuestion[],
    customSuccessText?: string
  ) => {
    setIsProcessing(true);
    try {
      const variants = await generateShuffledVariants(sourceQuestions, config);
      setShuffledVariants(variants);
      try {
        const multiQr = await generateMasterMultiQrCode(variants, config);
        setMasterMultiQr(multiQr);
      } catch (err) {
        console.warn('Lỗi tạo Master Multi QR:', err);
      }
      if (variants.length > 0) {
        setSelectedVariantCode(variants[0].examCode);
      }
      setActiveRightTab('SHUFFLED_PREVIEW');
      // KIỂM CHỨNG SAU TRỘN: chỉ được báo thành công khi TỪNG mã đề giữ đủ
      // hình/công thức và đáp án so với đề gốc. Có lỗi là báo lỗi nêu rõ
      // mã đề + số câu, tuyệt đối không báo "thành công 100%" như trước.
      const auditFailures = auditShuffledVariants(sourceQuestions, variants);
      if (auditFailures.length > 0) {
        setIsSavedAndReadyState(false);
        const shown = auditFailures.slice(0, 3).map((f) => f.message).join(' ');
        const more =
          auditFailures.length > 3
            ? ` (và ${auditFailures.length - 3} lỗi nữa)`
            : '';
        setStatusBanner({
          type: 'ERROR',
          text: `Đã trộn ${variants.length} mã đề NHƯNG kiểm chứng sau trộn phát hiện ${auditFailures.length} lỗi toàn vẹn: ${shown}${more} Bộ đề CHƯA đạt chuẩn — vui lòng kiểm tra lại các câu trên ở đề gốc trước khi xuất file.`,
        });
        return;
      }
      setStatusBanner({
        type: 'SUCCESS',
        text:
          customSuccessText ||
          `Đã cập nhật trạng thái chỉnh sửa và trộn thành công ${variants.length} mã đề (Times New Roman 12pt) kèm Bảng Đáp Án Chung & Mã QR Tổng Hợp!`,
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

  const handleSaveEdits = async () => {
    let baseQuestions = questions;
    if (
      editorViewMode === 'WORD_A4_PAGE' &&
      lastEditSourceRef.current === 'WORD_A4_PAGE' &&
      hasUnsavedChanges
    ) {
      const rawFromWord = parseRawTextToExamQuestions(
        wordRawDocumentText,
        config.resetNumberingPerPart
      );
      if (rawFromWord.length > 0) {
        baseQuestions = mergeRichMetadataFromExistingQuestions(
          rawFromWord,
          questions
        );
      }
    }

    const recalculated = normalizeAllQuestionsStrictFourOptions(
      baseQuestions,
      config.resetNumberingPerPart
    );
    const savedTime = new Date().toLocaleTimeString('vi-VN');
    setQuestions(recalculated);
    setWordRawDocumentText(serializeQuestionsToWordRawText(recalculated));
    setHasUnsavedChanges(false);
    setUnsavedQuestionIds([]);
    setLastSavedAt(savedTime);
    lastEditSourceRef.current = 'CARDS_3D';

    const idsToMark = Array.from(
      new Set([...editedQuestionIds, ...unsavedQuestionIds])
    );
    setSavedQuestionTimestamps((prev) => {
      const next = { ...prev };
      idsToMark.forEach((id) => {
        next[id] = savedTime;
      });
      return next;
    });

    const remainingErrors = validateExamQuestions(recalculated).filter(
      (i) => i.severity === 'ERROR'
    );
    if (remainingErrors.length === 0) {
      setIsSavedAndReadyState(true);
      await executeShuffleWithQuestions(
        recalculated,
        `Đã lưu toàn bộ chỉnh sửa (${
          idsToMark.length > 0 ? `Cập nhật ${idsToMark.length} câu hỏi · ` : ''
        }lúc ${savedTime}) và tự động trộn thành công ${config.numVariants} mã đề kèm Bảng Đáp Án Chung!`
      );
    } else {
      setIsSavedAndReadyState(false);
      setActiveRightTab('LIVE_EDITOR');
      setEditorViewMode('CARDS_3D');
      handleScrollToQuestion(remainingErrors[0].questionId);
      setStatusBanner({
        type: 'INFO',
        text: `Đã lưu cố định các câu vừa chỉnh sửa lúc ${savedTime}! Hiện còn ${remainingErrors.length} câu cần hoàn thiện đáp án (Đã chuyển tới Câu ${remainingErrors[0].questionIndex}: ${remainingErrors[0].message}) để tự động trộn đề.`,
      });
    }
  };

  const handleQuickFixAllErrors = () => {
    // TUYỆT ĐỐI KHÔNG BỊA ĐÁP ÁN: Chỉ chuẩn hóa đánh số thứ tự & khoảng trắng, sau đó cuộn tới câu đầu tiên đang thiếu/lỗi đáp án để giáo viên trực tiếp bổ sung/chỉnh sửa
    const normalized = normalizeAllQuestionsStrictFourOptions(
      questions,
      config.resetNumberingPerPart
    );
    const savedTime = new Date().toLocaleTimeString('vi-VN');
    setQuestions(normalized);
    setWordRawDocumentText(serializeQuestionsToWordRawText(normalized));
    setHasUnsavedChanges(false);
    setUnsavedQuestionIds([]);
    setLastSavedAt(savedTime);

    const remainingIssues = validateExamQuestions(normalized);
    if (remainingIssues.length > 0) {
      setIsSavedAndReadyState(false);
      setActiveRightTab('LIVE_EDITOR');
      setEditorViewMode('CARDS_3D');
      handleScrollToQuestion(remainingIssues[0].questionId);
      setStatusBanner({
        type: 'ERROR',
        text: `Hệ thống TUYỆT ĐỐI KHÔNG TỰ BỊA ĐÁP ÁN. Hiện có ${remainingIssues.length} lỗi đáp án cần giáo viên trực tiếp bổ sung/chỉnh sửa (Đã cuộn tới Câu ${remainingIssues[0].questionIndex}: ${remainingIssues[0].message}).`,
      });
    } else {
      setIsSavedAndReadyState(true);
      void executeShuffleWithQuestions(
        normalized,
        'Tất cả câu hỏi đã có đáp án chuẩn từ giáo viên! Hệ thống đã tự động trộn đề ngay.'
      );
    }
  };

  const handleToggleResetNumbering = (resetPerPart: boolean) => {
    setConfig((prev) => ({ ...prev, resetNumberingPerPart: resetPerPart }));
    setQuestions((prev) => recalculateQuestionNumbering(prev, resetPerPart));
  };

  // ================= HANDLERS: TRỘN ĐỀ & XUẤT FILE WORD / BẢNG ĐÁP ÁN CHUNG / QR =================
  const handleRunShuffle = async () => {
    let baseQuestions = questions;
    if (
      editorViewMode === 'WORD_A4_PAGE' &&
      lastEditSourceRef.current === 'WORD_A4_PAGE' &&
      hasUnsavedChanges
    ) {
      const rawFromWord = parseRawTextToExamQuestions(
        wordRawDocumentText,
        config.resetNumberingPerPart
      );
      if (rawFromWord.length > 0) {
        baseQuestions = mergeRichMetadataFromExistingQuestions(
          rawFromWord,
          questions
        );
      }
    }

    const normalized = normalizeAllQuestionsStrictFourOptions(
      baseQuestions,
      config.resetNumberingPerPart
    );
    const savedTime = new Date().toLocaleTimeString('vi-VN');
    setQuestions(normalized);
    setWordRawDocumentText(serializeQuestionsToWordRawText(normalized));
    setHasUnsavedChanges(false);
    setUnsavedQuestionIds([]);
    setLastSavedAt(savedTime);
    lastEditSourceRef.current = 'CARDS_3D';

    const idsToMark = Array.from(
      new Set([...editedQuestionIds, ...unsavedQuestionIds])
    );
    setSavedQuestionTimestamps((prev) => {
      const next = { ...prev };
      idsToMark.forEach((id) => {
        next[id] = savedTime;
      });
      return next;
    });

    const currentErrors = validateExamQuestions(normalized).filter(
      (i) => i.severity === 'ERROR'
    );
    if (currentErrors.length > 0) {
      setIsSavedAndReadyState(false);
      setActiveRightTab('LIVE_EDITOR');
      setEditorViewMode('CARDS_3D');
      handleScrollToQuestion(currentErrors[0].questionId);
      setStatusBanner({
        type: 'ERROR',
        text: `Đã lưu cố định các câu vừa sửa! Vui lòng hoàn thiện thêm ${currentErrors.length} lỗi đáp án trước khi trộn đề (Đã cuộn tới Câu ${currentErrors[0].questionIndex}: ${currentErrors[0].message}).`,
      });
      return;
    }

    setIsSavedAndReadyState(true);
    await executeShuffleWithQuestions(
      normalized,
      `Đã cập nhật trạng thái chỉnh sửa (${savedTime}) và trộn thành công ${config.numVariants} mã đề (Times New Roman 12pt) kèm Bảng Đáp Án Chung & Mã QR Tổng Hợp!`
    );
  };

  const syncShuffledVariantsWithCodes = async (updatedCodes: string[]) => {
    if (shuffledVariants.length === 0) return;
    const trimmedCodes = updatedCodes.map((c) => c.trim());
    if (trimmedCodes.some((c) => !c)) return;

    const updatedVariants = shuffledVariants.map((v, idx) => ({
      ...v,
      examCode: trimmedCodes[idx] || v.examCode,
    }));
    setShuffledVariants(updatedVariants);
    setSelectedVariantCode((prevSelected) => {
      const oldIdx = shuffledVariants.findIndex((v) => v.examCode === prevSelected);
      if (oldIdx >= 0 && updatedVariants[oldIdx]) {
        return updatedVariants[oldIdx].examCode;
      }
      return updatedVariants[0]?.examCode || prevSelected;
    });
    try {
      const multiQr = await generateMasterMultiQrCode(updatedVariants, {
        ...config,
        customCodes: updatedCodes,
      });
      setMasterMultiQr(multiQr);
    } catch (err) {
      console.warn('Lỗi cập nhật QR khi đổi mã đề:', err);
    }
  };

  const handleUpdateCustomCode = (index: number, newCode: string) => {
    let nextCodesForSync: string[] | null = null;
    setConfig((prev) => {
      const base = prev.examCodeDigits === 3 ? 101 : 1001;
      const rootFallback = prev.customCodes?.[0]?.trim() || String(base);
      const defaultSeq = generateSequentialExamCodesFromRoot(
        rootFallback,
        prev.numVariants,
        prev.examCodeDigits
      );
      const codes =
        prev.customCodes && prev.customCodes.length >= prev.numVariants
          ? [...prev.customCodes]
          : defaultSeq;

      if (index === 0) {
        // Khi giáo viên sửa trên ô gốc (ô đầu tiên), các mã đề tiếp theo tự động nhảy theo đúng quy cách của ô gốc
        const trimmed = newCode.trim();
        if (!trimmed) {
          codes[0] = newCode;
          return { ...prev, customCodes: codes };
        }
        const autoSeq = generateSequentialExamCodesFromRoot(
          trimmed,
          prev.numVariants,
          prev.examCodeDigits
        );
        autoSeq[0] = newCode;
        nextCodesForSync = autoSeq;
        const onlyDigits = trimmed.match(/^\d+$/)?.[0];
        const nextDigits: 3 | 4 =
          onlyDigits && onlyDigits.length === 4
            ? 4
            : onlyDigits && onlyDigits.length === 3
            ? 3
            : prev.examCodeDigits;
        return {
          ...prev,
          examCodeDigits: nextDigits,
          customCodes: autoSeq,
        };
      } else {
        codes[index] = newCode;
        nextCodesForSync = codes;
        return { ...prev, customCodes: codes };
      }
    });
    if (nextCodesForSync) {
      void syncShuffledVariantsWithCodes(nextCodesForSync);
    }
  };

  const handleResetDefaultCodes = () => {
    let resetCodes: string[] = [];
    setConfig((prev) => {
      resetCodes = Array.from({ length: prev.numVariants }, (_, i) =>
        String(prev.examCodeDigits === 3 ? 101 + i : 1001 + i)
      );
      return {
        ...prev,
        customCodes: resetCodes,
      };
    });
    if (resetCodes.length > 0) {
      void syncShuffledVariantsWithCodes(resetCodes);
    }
  };

  const handleDownloadCleanedMaster = async () => {
    setIsProcessing(true);
    try {
      const blob = await exportCleanedMasterDocx(questions, config, false);
      triggerBrowserDownload(
        blob,
        buildStandardExportFileName(config, 'docx', 'Đề gốc')
      );
      await executePostDownloadZeroTracePurge('Đề Gốc Đối Chiếu (Giữ Nguyên Gạch Chân & Tô Đỏ Đáp Án Đúng)');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportWordEquationOmathDocx = async () => {
    if (questions.length === 0) return;
    setIsProcessing(true);
    try {
      const blob = await exportCleanedMasterDocx(questions, config, false);
      triggerBrowserDownload(
        blob,
        buildStandardExportFileName(config, 'docx', 'Đề gốc')
      );
      setStatusBanner({
        type: 'SUCCESS',
        text: 'Đã xuất file Word (.docx) chuẩn Microsoft Office Equation <m:oMath> (LaTeX → MathML → OMML mml2omml · Font Cambria Math · Chuẩn UTF-8 không lỗi ô vuông)!',
      });
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
        buildStandardExportFileName(config, 'docx', 'Đáp án')
      );
      await executePostDownloadZeroTracePurge(
        `Bảng Đáp Án Ma Trận ${shuffledVariants.length} Mã Đề (.docx)`
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadMatrixSpecDocx = async () => {
    setIsProcessing(true);
    try {
      const blob = await exportMatrixAndSpecificationDocx(questions, config);
      triggerBrowserDownload(
        blob,
        buildStandardExportFileName(config, 'docx', 'Ma trận đặc tả CV 7991')
      );
      await executePostDownloadZeroTracePurge('Khung Ma Trận & Bản Đặc Tả CV 7991 (.docx)');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadZipBundle = async () => {
    if (questions.length === 0) return;
    setIsProcessing(true);
    try {
      let baseQuestions = questions;
      if (
        editorViewMode === 'WORD_A4_PAGE' &&
        lastEditSourceRef.current === 'WORD_A4_PAGE' &&
        hasUnsavedChanges
      ) {
        const rawFromWord = parseRawTextToExamQuestions(
          wordRawDocumentText,
          config.resetNumberingPerPart
        );
        if (rawFromWord.length > 0) {
          baseQuestions = mergeRichMetadataFromExistingQuestions(
            rawFromWord,
            questions
          );
        }
      }

      const normalizedQuestions = normalizeAllQuestionsStrictFourOptions(
        baseQuestions,
        config.resetNumberingPerPart
      );

      let targetVariants = shuffledVariants;
      if (targetVariants.length === 0 || hasUnsavedChanges) {
        targetVariants = await generateShuffledVariants(normalizedQuestions, config);
        setShuffledVariants(targetVariants);
        setQuestions(normalizedQuestions);
        setWordRawDocumentText(serializeQuestionsToWordRawText(normalizedQuestions));
        setHasUnsavedChanges(false);
        setUnsavedQuestionIds([]);
        try {
          const multiQr = await generateMasterMultiQrCode(targetVariants, config);
          setMasterMultiQr(multiQr);
        } catch (err) {
          console.warn('Lỗi tạo Master Multi QR:', err);
        }
        if (targetVariants.length > 0 && !selectedVariantCode) {
          setSelectedVariantCode(targetVariants[0].examCode);
        }
      }

      // CHỐT XUẤT FILE: kiểm chứng lại toàn vẹn của chính các mã đề sắp xuất.
      // Có bất kỳ câu nào mất hình/công thức hoặc lệch đáp án so với đề gốc
      // thì CHẶN xuất và nêu rõ mã đề + số câu (không xuất bộ đề đã vỡ).
      const zipAuditFailures = auditShuffledVariants(
        normalizedQuestions,
        targetVariants
      );
      if (zipAuditFailures.length > 0) {
        const shown = zipAuditFailures
          .slice(0, 3)
          .map((f) => f.message)
          .join(' ');
        const more =
          zipAuditFailures.length > 3
            ? ` (và ${zipAuditFailures.length - 3} lỗi nữa)`
            : '';
        setIsSavedAndReadyState(false);
        setStatusBanner({
          type: 'ERROR',
          text: `ĐÃ CHẶN XUẤT FILE: kiểm chứng phát hiện ${zipAuditFailures.length} lỗi toàn vẹn trong các mã đề: ${shown}${more} Vui lòng trộn lại từ đề gốc đạt chuẩn.`,
        });
        return;
      }

      const blob = await exportAllVariantsZipBundle(
        targetVariants,
        normalizedQuestions,
        config
      );
      triggerBrowserDownload(
        blob,
        buildStandardExportFileName(config, 'zip')
      );
      await executePostDownloadZeroTracePurge(
        `Trọn Bộ ${targetVariants.length} Đề Thi (1. Thư mục đề & 2. Thư mục đáp án) — ${buildStandardExportFileName(config, 'zip')}`
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
        buildStandardExportFileName(config, 'zip', 'Bộ mã QR và Excel')
      );
      await executePostDownloadZeroTracePurge(
        `Bộ 4 Mã QR Chấm Thi (${shuffledVariants.length} mã đề) + 4 File Excel (.zip)`
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadSingleVariantDocx = async (variant: ShuffledVariant) => {
    setIsProcessing(true);
    try {
      const blob = await exportSingleVariantDocx(variant, config);
      triggerBrowserDownload(
        blob,
        buildStandardExportFileName(config, 'docx', `Đề ${variant.examCode}`)
      );
      await executePostDownloadZeroTracePurge(`Đề ${variant.examCode} (.docx)`);
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
            {variant.answerKey.part3.length > 0 ? (
              variant.answerKey.part3.map((item) => (
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
              ))
            ) : (
              <div className="text-xs italic text-slate-500">
                Đề không có câu hỏi trả lời ngắn
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KHUNG TỰ LUẬN DẠNG BẢNG CHUẨN BỘ GD&ĐT + BẢNG RUBRIC CHẤM ĐIỂM */}
      {variant.answerKey.part4 && variant.answerKey.part4.length > 0 && (
        <div
          style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: '12pt' }}
          className="p-4 rounded-3xl bg-white border-2 border-purple-300 shadow-xs space-y-4"
        >
          <div className="pb-2 border-b border-purple-200 flex items-center justify-between flex-wrap gap-2">
            <h4 className="font-bold text-purple-950 text-base uppercase">
              {variant.answerKey.part3.length === 0 ? 'PHẦN III' : 'PHẦN IV'}. TỰ LUẬN — HƯỚNG DẪN CHẤM CHI TIẾT
            </h4>
            <span className="text-xs font-sans font-bold text-purple-800 bg-purple-100 px-2.5 py-0.5 rounded-lg">
              Mẫu Bảng Bộ GD&ĐT &amp; Bảng Rubric chấm điểm
            </span>
          </div>

          {/* Bảng Hướng dẫn chấm chuẩn Bộ GD&ĐT */}
          <div className="overflow-x-auto rounded-xl border border-purple-300">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-sky-900 text-white text-center font-bold">
                  <th className="py-2 px-3 border-r border-sky-700 w-24">Câu</th>
                  <th className="py-2 px-3 border-r border-sky-700">Nội dung / Đáp án - Hướng dẫn chấm</th>
                  <th className="py-2 px-3 w-24">Điểm</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-200">
                {variant.answerKey.part4.map((item) => {
                  const ptMatch = `${item.questionText || ''} ${item.answer || ''}`.match(
                    /\(?\s*(\d+[.,]\d+|\d+)\s*(?:điểm|đ)\s*\)?/i
                  );
                  const ptLabel = ptMatch && ptMatch[1] ? ptMatch[1].replace('.', ',') : '1,00';
                  return (
                    <tr key={`card-p4-${variant.examCode}-${item.questionNumber}`} className="hover:bg-purple-50/40">
                      <td className="py-2.5 px-3 border-r border-purple-200 font-bold text-center text-sky-950 bg-slate-50">
                        Câu {item.questionNumber}
                      </td>
                      <td className="py-2.5 px-3 border-r border-purple-200 space-y-1.5">
                        <div className="text-slate-950 leading-relaxed">
                          <strong className="font-bold">Đề bài: </strong>
                          <ScientificContentRenderer text={item.questionText} inline />
                        </div>
                        {item.hasExplicitAnswer && item.answer ? (
                          <div className="text-rose-700 leading-relaxed pt-1 border-t border-dashed border-purple-200">
                            <strong className="font-bold">Hướng dẫn chấm: </strong>
                            <ScientificContentRenderer text={item.answer} inline />
                          </div>
                        ) : null}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-center text-rose-700">
                        {ptLabel}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Bảng Rubric chấm điểm tự luận */}
          <div className="space-y-1.5">
            <h5 className="font-bold text-purple-900 text-sm uppercase">
              BẢNG RUBRIC ĐÁNH GIÁ VÀ CHẤM ĐIỂM TỰ LUẬN
            </h5>
            <div className="overflow-x-auto rounded-xl border border-purple-300">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="text-white text-center font-bold">
                    <th className="py-2 px-2.5 bg-purple-800 border-r border-purple-600 w-28">Câu / Tiêu chí</th>
                    <th className="py-2 px-2.5 bg-emerald-700 border-r border-emerald-600">Mức Đầy đủ (100%)</th>
                    <th className="py-2 px-2.5 bg-sky-700 border-r border-sky-600">Mức Khá (75%)</th>
                    <th className="py-2 px-2.5 bg-amber-600 border-r border-amber-500">Mức Đạt (50%)</th>
                    <th className="py-2 px-2.5 bg-rose-700">Chưa đạt (0% - 25%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-200">
                  {variant.answerKey.part4.map((item) => {
                    const ptMatch = `${item.questionText || ''} ${item.answer || ''}`.match(
                      /\(?\s*(\d+[.,]\d+|\d+)\s*(?:điểm|đ)\s*\)?/i
                    );
                    const ptLabel = ptMatch && ptMatch[1] ? ptMatch[1].replace('.', ',') : '1,00';
                    return (
                      <tr key={`rubric-card-${variant.examCode}-${item.questionNumber}`} className="hover:bg-purple-50/30">
                        <td className="py-2 px-2.5 border-r border-purple-200 text-center font-bold text-purple-950 bg-purple-50/60">
                          <div>Câu {item.questionNumber}</div>
                          <div className="text-[11px] font-normal italic text-purple-700">({ptLabel} điểm)</div>
                        </td>
                        <td className="py-2 px-2.5 border-r border-purple-200 text-slate-900">
                          Trình bày đầy đủ, chính xác trọn vẹn các ý theo hướng dẫn chấm; lập luận chặt chẽ, công thức/thuật ngữ chuẩn xác.
                        </td>
                        <td className="py-2 px-2.5 border-r border-purple-200 text-slate-800">
                          Đúng bản chất và các ý chính (đạt khoảng 3/4 yêu cầu), còn sai sót nhỏ về diễn đạt hoặc bước biến đổi phụ.
                        </td>
                        <td className="py-2 px-2.5 border-r border-purple-200 text-slate-800">
                          Trình bày đúng được 1/2 số ý hoặc nêu đúng hướng giải/công thức trọng tâm nhưng kết quả chưa hoàn chỉnh.
                        </td>
                        <td className="py-2 px-2.5 text-slate-700">
                          Làm sai hoàn toàn, bỏ trống hoặc chỉ nêu được một ý nhỏ rời rạc không đúng trọng tâm.
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Chữ ký cuối đáp án + Ô điền họ tên Giáo viên ra đề */}
      <div className="flex justify-end pt-3 pr-6 text-center text-slate-900">
        <div
          style={{ fontFamily: "'Times New Roman', Times, serif" }}
          className="min-w-[260px] p-3.5 rounded-2xl bg-sky-50/70 border border-sky-200 space-y-2 shadow-2xs"
        >
          <div className="font-bold text-base text-slate-950">Người ra đề</div>
          <div className="text-xs italic text-slate-600">( Ký và ghi rõ họ và tên)</div>
          <div className="h-8" />
          {config.teacherName?.trim() ? (
            <div className="font-bold text-base text-slate-950 pb-1">
              {config.teacherName}
            </div>
          ) : null}
          <input
            type="text"
            value={config.teacherName || ''}
            onChange={(e) =>
              setConfig((prev) => ({ ...prev, teacherName: e.target.value }))
            }
            placeholder="Nhập họ và tên giáo viên ra đề..."
            className="w-full px-3 py-1.5 text-xs font-sans font-bold text-center text-blue-950 bg-white border-2 border-sky-300 rounded-xl focus:outline-none focus:border-blue-600 shadow-2xs"
            title="Điền họ và tên giáo viên hiển thị ở cuối trang đáp án và trong file Word xuất ra"
          />
        </div>
      </div>
    </div>
  );

  // Helper render Bảng Ma Trận Đối Chiếu Đa Mã Đề gọn nhẹ, khoa học, không tốn diện tích
  const renderCrossReferencingAnswerMatrix = (variants: ShuffledVariant[]) => {
    if (variants.length === 0) return null;
    const part1Max = Math.max(0, ...variants.map((v) => v.answerKey.part1.length));
    const part2Max = Math.max(0, ...variants.map((v) => v.answerKey.part2.length));
    const part3Max = Math.max(0, ...variants.map((v) => v.answerKey.part3.length));

    return (
      <div className="space-y-6">
        {/* PHẦN I: MA TRẬN ĐỐI CHIẾU 4 LỰA CHỌN */}
        {part1Max > 0 && (
          <div className="overflow-x-auto rounded-2xl border-2 border-sky-300 bg-white shadow-xs">
            <div className="bg-sky-900 text-white px-4 py-2.5 flex items-center justify-between">
              <span className="font-extrabold text-xs sm:text-sm uppercase tracking-wide">
                PHẦN I: CÂU TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN ({part1Max} CÂU)
              </span>
              <span className="text-[11px] font-mono text-sky-200">
                Mỗi câu đúng: 0.25 điểm · Đối chiếu nhanh tất cả {variants.length} mã đề
              </span>
            </div>
            <table className="w-full text-center border-collapse text-xs">
              <thead>
                <tr className="bg-sky-100 text-slate-800 font-extrabold border-b-2 border-sky-300">
                  <th className="py-2.5 px-3 border-r border-sky-200 w-24">Câu hỏi</th>
                  {variants.map((v) => (
                    <th
                      key={`th-p1-${v.examCode}`}
                      className="py-2.5 px-3 border-r border-sky-200 font-mono text-sm font-black text-sky-950"
                    >
                      Mã {v.examCode}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-100 font-mono">
                {Array.from({ length: part1Max }, (_, i) => i + 1).map((qNum) => (
                  <tr key={`matrix-p1-q${qNum}`} className="hover:bg-sky-50/70">
                    <td className="py-2 px-3 border-r border-sky-200 font-bold text-slate-900 bg-sky-50/60 font-sans">
                      Câu {qNum}
                    </td>
                    {variants.map((v) => {
                      const item = v.answerKey.part1.find((p) => p.questionNumber === qNum);
                      const ans = item ? item.answer : '—';
                      const bgBadge =
                        ans === 'A'
                          ? 'bg-blue-100 text-blue-900 border-blue-400'
                          : ans === 'B'
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-400'
                          : ans === 'C'
                          ? 'bg-amber-100 text-amber-900 border-amber-400'
                          : ans === 'D'
                          ? 'bg-purple-100 text-purple-900 border-purple-400'
                          : 'bg-slate-100 text-slate-600 border-slate-300';
                      return (
                        <td
                          key={`cell-p1-${v.examCode}-${qNum}`}
                          className="py-2 px-3 border-r border-sky-200"
                        >
                          <span
                            className={`inline-block px-3 py-0.5 rounded-lg font-black text-sm border shadow-2xs ${bgBadge}`}
                          >
                            {ans}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* PHẦN II: MA TRẬN ĐỐI CHIẾU ĐÚNG / SAI */}
        {part2Max > 0 && (
          <div className="overflow-x-auto rounded-2xl border-2 border-emerald-300 bg-white shadow-xs">
            <div className="bg-emerald-900 text-white px-4 py-2.5 flex items-center justify-between">
              <span className="font-extrabold text-xs sm:text-sm uppercase tracking-wide">
                PHẦN II: CÂU TRẮC NGHIỆM ĐÚNG / SAI ({part2Max} CÂU · MỖI CÂU 4 Ý a, b, c, d)
              </span>
              <span className="text-[11px] font-mono text-emerald-200">
                1 ý=0.1đ · 2 ý=0.25đ · 3 ý=0.5đ · 4 ý=1.0đ
              </span>
            </div>
            <table className="w-full text-center border-collapse text-xs">
              <thead>
                <tr className="bg-emerald-100 text-slate-800 font-extrabold border-b-2 border-emerald-300">
                  <th className="py-2.5 px-3 border-r border-emerald-200 w-32">Câu hỏi & Ý</th>
                  {variants.map((v) => (
                    <th
                      key={`th-p2-${v.examCode}`}
                      className="py-2.5 px-3 border-r border-emerald-200 font-mono text-sm font-black text-emerald-950"
                    >
                      Mã {v.examCode}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-100 font-mono">
                {Array.from({ length: part2Max }, (_, i) => i + 1).map((qNum) => {
                  const subLabels = ['a', 'b', 'c', 'd'];
                  return (
                    <React.Fragment key={`matrix-p2-frag-q${qNum}`}>
                      {/* Dòng tổng hợp chuỗi Đ/S của cả câu */}
                      <tr className="bg-emerald-50/90 font-sans border-t-2 border-emerald-300">
                        <td className="py-2 px-3 border-r border-emerald-200 font-black text-emerald-950 text-left">
                          Câu {qNum} (Tổng hợp)
                        </td>
                        {variants.map((v) => {
                          const item = v.answerKey.part2.find((p) => p.questionNumber === qNum);
                          return (
                            <td
                              key={`cell-p2-summary-${v.examCode}-${qNum}`}
                              className="py-2 px-3 border-r border-emerald-200 font-bold text-emerald-800 font-mono"
                            >
                              {item ? `${item.dsString} (${item.tfString})` : '—'}
                            </td>
                          );
                        })}
                      </tr>
                      {/* 4 dòng chi tiết a, b, c, d */}
                      {subLabels.map((subLabel, subIdx) => (
                        <tr
                          key={`matrix-p2-sub-${qNum}-${subLabel}`}
                          className="hover:bg-emerald-50/50"
                        >
                          <td className="py-1.5 px-3 border-r border-emerald-200 text-slate-700 pl-6 text-left font-sans font-semibold">
                            Ý {subLabel})
                          </td>
                          {variants.map((v) => {
                            const item = v.answerKey.part2.find((p) => p.questionNumber === qNum);
                            const ans = item?.answers ? item.answers[subIdx] : undefined;
                            const badgeClass =
                              ans === 'Đ'
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-400 font-black'
                                : ans === 'S'
                                ? 'bg-rose-100 text-rose-900 border-rose-400 font-black'
                                : 'bg-slate-100 text-slate-600 border-slate-200';
                            const text =
                              ans === 'Đ' ? 'Đúng (Đ)' : ans === 'S' ? 'Sai (S)' : '—';
                            return (
                              <td
                                key={`cell-p2-sub-${v.examCode}-${qNum}-${subLabel}`}
                                className="py-1.5 px-3 border-r border-emerald-200"
                              >
                                <span
                                  className={`inline-block px-2.5 py-0.5 rounded text-xs border ${badgeClass}`}
                                >
                                  {text}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* PHẦN III: MA TRẬN ĐỐI CHIẾU TRẢ LỜI NGẮN */}
        {part3Max > 0 && (
          <div className="overflow-x-auto rounded-2xl border-2 border-amber-300 bg-white shadow-xs">
            <div className="bg-amber-900 text-white px-4 py-2.5 flex items-center justify-between">
              <span className="font-extrabold text-xs sm:text-sm uppercase tracking-wide">
                PHẦN III: CÂU TRẮC NGHIỆM TRẢ LỜI NGẮN ({part3Max} CÂU)
              </span>
              <span className="text-[11px] font-mono text-amber-200">
                Mỗi câu đúng: 0.25 điểm · Điền số hoặc giá trị chính xác
              </span>
            </div>
            <table className="w-full text-center border-collapse text-xs">
              <thead>
                <tr className="bg-amber-100 text-slate-800 font-extrabold border-b-2 border-amber-300">
                  <th className="py-2.5 px-3 border-r border-amber-200 w-24">Câu hỏi</th>
                  {variants.map((v) => (
                    <th
                      key={`th-p3-${v.examCode}`}
                      className="py-2.5 px-3 border-r border-amber-200 font-mono text-sm font-black text-amber-950"
                    >
                      Mã {v.examCode}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100 font-mono">
                {Array.from({ length: part3Max }, (_, i) => i + 1).map((qNum) => (
                  <tr key={`matrix-p3-q${qNum}`} className="hover:bg-amber-50/70">
                    <td className="py-2 px-3 border-r border-amber-200 font-bold text-slate-900 bg-amber-50/60 font-sans">
                      Câu {qNum}
                    </td>
                    {variants.map((v) => {
                      const item = v.answerKey.part3.find((p) => p.questionNumber === qNum);
                      return (
                        <td
                          key={`cell-p3-${v.examCode}-${qNum}`}
                          className="py-2 px-3 border-r border-amber-200"
                        >
                          <span className="inline-block px-3 py-1 rounded-lg font-black text-sm bg-amber-100 text-amber-950 border border-amber-300 shadow-2xs">
                            {item ? item.answer : '—'}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* PHẦN TỰ LUẬN DẠNG BẢNG CHUẨN BỘ GD&ĐT + BẢNG RUBRIC CHẤM ĐIỂM */}
        {(variants[0]?.answerKey?.part4?.length || 0) > 0 && (
          <div className="rounded-2xl border-2 border-purple-300 bg-white shadow-xs overflow-hidden space-y-4 pb-4">
            <div className="bg-purple-900 text-white px-4 py-2.5 flex items-center justify-between flex-wrap gap-2">
              <span className="font-extrabold text-xs sm:text-sm uppercase tracking-wide">
                {part3Max === 0 ? 'PHẦN III' : 'PHẦN IV'}: TỰ LUẬN — HƯỚNG DẪN CHẤM &amp; BẢNG RUBRIC ({variants[0].answerKey.part4.length} CÂU)
              </span>
              <span className="text-[11px] font-mono text-purple-200">
                Trình bày dạng bảng chuẩn Bộ Giáo dục và Đào tạo kèm Bảng Rubric chấm điểm
              </span>
            </div>

            <div
              style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: '12pt' }}
              className="px-4 space-y-4"
            >
              {/* 1. Bảng Hướng dẫn chấm Tự luận chuẩn Bộ GD&ĐT */}
              <div className="overflow-x-auto rounded-xl border border-slate-300">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-sky-900 text-white text-center font-bold">
                      <th className="py-2.5 px-3 border-r border-sky-700 w-24">Câu</th>
                      <th className="py-2.5 px-3 border-r border-sky-700">Nội dung / Đáp án - Hướng dẫn chấm</th>
                      <th className="py-2.5 px-3 w-24">Điểm</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {variants[0].answerKey.part4.map((item) => {
                      const ptMatch = `${item.questionText || ''} ${item.answer || ''}`.match(
                        /\(?\s*(\d+[.,]\d+|\d+)\s*(?:điểm|đ)\s*\)?/i
                      );
                      const ptLabel = ptMatch && ptMatch[1] ? ptMatch[1].replace('.', ',') : '1,00';
                      return (
                        <tr key={`matrix-p4-q${item.questionNumber}`} className="hover:bg-purple-50/40">
                          <td className="py-2.5 px-3 border-r border-slate-200 font-bold text-center text-sky-950 bg-slate-50">
                            Câu {item.questionNumber}
                          </td>
                          <td className="py-2.5 px-3 border-r border-slate-200 space-y-1.5">
                            <div className="text-slate-950 leading-relaxed">
                              <strong className="font-bold">Đề bài: </strong>
                              <ScientificContentRenderer text={item.questionText} inline />
                            </div>
                            {item.hasExplicitAnswer && item.answer ? (
                              <div className="pl-3 border-l-4 border-rose-500 text-rose-800 bg-rose-50/60 py-1.5 px-3 rounded-r-xl leading-relaxed">
                                <strong className="font-bold">Hướng dẫn chấm: </strong>
                                <ScientificContentRenderer text={item.answer} inline />
                              </div>
                            ) : null}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-center text-rose-700">
                            {ptLabel}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* 2. Bảng Rubric đánh giá và chấm điểm Tự luận */}
              <div className="space-y-2">
                <div className="font-bold text-purple-950 text-sm uppercase">
                  BẢNG RUBRIC ĐÁNH GIÁ VÀ CHẤM ĐIỂM TỰ LUẬN
                </div>
                <div className="overflow-x-auto rounded-xl border border-purple-300">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="text-white text-center font-bold">
                        <th className="py-2 px-3 bg-purple-800 border-r border-purple-600 w-28">Câu / Tiêu chí</th>
                        <th className="py-2 px-3 bg-emerald-700 border-r border-emerald-600">Mức Đầy đủ (100%)</th>
                        <th className="py-2 px-3 bg-sky-700 border-r border-sky-600">Mức Khá (75%)</th>
                        <th className="py-2 px-3 bg-amber-600 border-r border-amber-500">Mức Đạt (50%)</th>
                        <th className="py-2 px-3 bg-rose-700">Chưa đạt (0% - 25%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-purple-200">
                      {variants[0].answerKey.part4.map((item) => {
                        const ptMatch = `${item.questionText || ''} ${item.answer || ''}`.match(
                          /\(?\s*(\d+[.,]\d+|\d+)\s*(?:điểm|đ)\s*\)?/i
                        );
                        const ptLabel = ptMatch && ptMatch[1] ? ptMatch[1].replace('.', ',') : '1,00';
                        return (
                          <tr key={`matrix-rubric-q${item.questionNumber}`} className="hover:bg-purple-50/30">
                            <td className="py-2.5 px-3 border-r border-purple-200 text-center font-bold text-purple-950 bg-purple-50/60">
                              <div>Câu {item.questionNumber}</div>
                              <div className="text-[11px] font-normal italic text-purple-700">({ptLabel} điểm)</div>
                            </td>
                            <td className="py-2.5 px-3 border-r border-purple-200 text-slate-900">
                              Trình bày đầy đủ, chính xác trọn vẹn các ý theo hướng dẫn chấm; lập luận chặt chẽ, công thức/thuật ngữ chuẩn xác.
                            </td>
                            <td className="py-2.5 px-3 border-r border-purple-200 text-slate-800">
                              Đúng bản chất và các ý chính (đạt khoảng 3/4 yêu cầu), còn sai sót nhỏ về diễn đạt hoặc bước biến đổi phụ.
                            </td>
                            <td className="py-2.5 px-3 border-r border-purple-200 text-slate-800">
                              Trình bày đúng được 1/2 số ý hoặc nêu đúng hướng giải/công thức trọng tâm nhưng kết quả chưa hoàn chỉnh.
                            </td>
                            <td className="py-2.5 px-3 text-slate-700">
                              Làm sai hoàn toàn, bỏ trống hoặc chỉ nêu được một ý nhỏ rời rạc không đúng trọng tâm.
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Phần cuối đáp án ghi: Người ra đề ( Ký và ghi rõ họ và tên) + Ô điền tên Giáo viên */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-2 border-sky-300 rounded-2xl text-slate-800 bg-white shadow-xs px-6">
          <div className="text-xs text-slate-600 font-semibold text-left space-y-1 max-w-md">
            <div className="font-extrabold text-sky-950 uppercase flex items-center gap-1.5">
              <Edit3 className="w-3.5 h-3.5 text-blue-700 shrink-0" />
              <span>Điền tên Giáo viên ra đề vào cuối trang đáp án:</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Họ và tên giáo viên nhập tại đây sẽ tự động hiển thị ở cuối trang Bảng Đáp Án (trên web và khi tải file Word <code>.docx</code> nộp Khảo thí).
            </p>
          </div>
          <div
            style={{ fontFamily: "'Times New Roman', Times, serif" }}
            className="min-w-[270px] sm:min-w-[300px] p-3.5 rounded-2xl bg-sky-50/60 border border-sky-200 text-center space-y-1.5"
          >
            <div className="font-bold text-base text-slate-950">Người ra đề</div>
            <div className="text-xs italic text-slate-600">( Ký và ghi rõ họ và tên)</div>
            <div className="h-8" />
            {config.teacherName?.trim() ? (
              <div className="font-bold text-base text-slate-950 pb-1">
                {config.teacherName}
              </div>
            ) : null}
            <input
              type="text"
              value={config.teacherName || ''}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, teacherName: e.target.value }))
              }
              placeholder="Nhập họ và tên giáo viên ra đề..."
              className="w-full px-3 py-1.5 text-xs font-sans font-bold text-center text-blue-950 bg-white border-2 border-sky-400 rounded-xl focus:outline-none focus:border-blue-600 shadow-2xs"
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col text-slate-900 pb-11">
      {/* ================= KHỐI TIÊU ĐỀ & THANH ĐIỀU HƯỚNG CỐ ĐỊNH TRÊN CÙNG ================= */}
      <div className="sticky top-0 z-30 bg-sky-50/95 backdrop-blur-md border-b-2 border-sky-300 shadow-sm">
        {/* ================= HEADER: DÒNG 1 (LOGO LỚN NỔI BẬT + TÁC GIẢ) & DÒNG 2 (THANH NÚT CHỨC NĂNG NẰM DƯỚI LOGO KHÔNG BỊ VỠ/MẤT KHUNG) ================= */}
        <header className="max-w-[1600px] w-full mx-auto px-3 sm:px-5 pt-1.5 pb-2 bg-white/95 space-y-1.5">
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

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAuthGateModalOpen(true)}
                className="px-3 py-1 rounded-xl text-xs font-black text-white btn-3d-indigo flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Xem hoặc cập nhật thông tin Giáo viên đăng nhập hệ thống (Đồng bộ QuanLy_TronDe)"
              >
                <i className="fa-solid fa-user-check text-emerald-300" />
                <span>
                  {currentTeacherUser
                    ? `GV: ${currentTeacherUser.name} (${currentTeacherUser.school})`
                    : 'Đăng nhập Giáo viên'}
                </span>
              </button>

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
                <span>3. Ma Trận & Đặc Tả (CV 7991)</span>
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

              {shuffledVariants.length > 0 && (
                <button
                  type="button"
                  onClick={handleDownloadZipBundle}
                  disabled={isProcessing || questions.length === 0}
                  className="px-3.5 py-1.5 rounded-xl font-extrabold text-white btn-auto-scale flex items-center gap-1.5 whitespace-nowrap cursor-pointer btn-3d-rose shadow-sm"
                  title="Tải về .ZIP"
                >
                  <FileArchive className="w-4 h-4 shrink-0" />
                  <span>Tải Về .ZIP</span>
                </button>
              )}
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

          {/* DÒNG 3 TRÊN THANH CÔNG CỤ PHÍA TRÊN MÀN HÌNH: KIỂM TRA ĐỀ HỢP LỆ / BÁO LỖI & THAO TÁC NHANH CHO GIÁO VIÊN */}
          <div className="pt-1 border-t border-sky-200/80 flex flex-wrap items-center justify-between gap-2">
            {validationIssues.length === 0 ? (
              <div className="flex-1 min-w-[260px] px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-400 text-emerald-950 text-xs font-black flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Đề hợp lệ 100% (Đáp án chuẩn từ giáo viên · 0 lỗi)</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  { editedQuestionIds.length > 0 && isSavedAndReadyState && !hasUnsavedChanges && (
                    <span className="text-[11px] font-bold text-blue-900 bg-blue-100 px-2.5 py-0.5 rounded-lg border border-blue-300">
                      Đã lưu chỉnh sửa ({editedQuestionIds.length} câu · lúc {lastSavedAt})
                    </span>
                  )}
                  {hasUnsavedChanges && (
                    <span className="text-[10px] font-extrabold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                      Chờ Lưu &amp; Trộn
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 min-w-[280px] px-3 py-1.5 rounded-xl bg-rose-50 border-2 border-rose-500 text-rose-950 flex flex-wrap items-center justify-between gap-2 shadow-xs text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1 font-black text-rose-700">
                    <AlertTriangle className="w-4 h-4 text-rose-600 animate-bounce shrink-0" />
                    <span>
                      Cần giáo viên bổ sung/sửa ({validationIssues.length} lỗi — Không tự bịa đáp án):
                    </span>
                  </div>

                  <div className="flex items-center gap-1 flex-wrap">
                    {validationIssues.slice(0, 10).map((iss, idx) => (
                      <button
                        key={`top-toolbar-iss-${iss.questionId}-${idx}`}
                        type="button"
                        onClick={() => {
                          setActiveRightTab('LIVE_EDITOR');
                          setEditorViewMode('CARDS_3D');
                          handleScrollToQuestion(iss.questionId);
                        }}
                        className="px-2 py-0.5 rounded-lg bg-white hover:bg-rose-600 hover:text-white text-rose-800 border border-rose-300 font-black transition-colors cursor-pointer whitespace-nowrap"
                        title={`${iss.message} — Bấm để nhảy tới sửa ngay`}
                      >
                        Câu {iss.questionIndex}
                      </button>
                    ))}
                    {validationIssues.length > 10 && (
                      <span className="font-bold text-rose-700">
                        +{validationIssues.length - 10} câu
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleQuickFixAllErrors}
                  className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-black flex items-center gap-1 cursor-pointer shadow-2xs whitespace-nowrap"
                  title="Nhảy tới câu đang thiếu hoặc sai quy chuẩn đáp án để giáo viên trực tiếp bổ sung"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Tới câu cần sửa</span>
                </button>
              </div>
            )}

            {hasUnsavedChanges && (
              <div className="px-3 py-1.5 rounded-xl bg-amber-50 border-2 border-amber-500 text-amber-950 text-xs font-black flex flex-wrap items-center gap-2 shadow-2xs">
                <div className="flex items-center gap-1.5">
                  <Edit3 className="w-4 h-4 text-amber-600 shrink-0 animate-pulse" />
                  <span>
                    Đang sửa {unsavedQuestionIds.length || 1} câu:
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleSaveAllEditsOnly}
                    disabled={isProcessing}
                    className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-black flex items-center gap-1 cursor-pointer shadow-xs whitespace-nowrap"
                    title="Lưu cố định toàn bộ các câu vừa chỉnh sửa để chuyển sang câu khác không bị thay đổi"
                  >
                    <Save className="w-3.5 h-3.5 shrink-0" />
                    <span>Lưu Toàn Bộ Chỉnh Sửa</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdits}
                    disabled={isProcessing}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black flex items-center gap-1 cursor-pointer shadow-xs whitespace-nowrap"
                    title="Lưu trạng thái đã chỉnh sửa và tự động bắt đầu trộn đề"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Lưu &amp; Trộn Đề</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Thanh thông báo trạng thái (Status Banner) */}
        {statusBanner && (
          <div
            className={`px-4 py-1.5 border-t text-xs font-bold flex items-center justify-between gap-4 ${
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

      {/* ================= BỐ CỤC CHIA 2 CỘT: BÊN TRÁI (1/3 KHUNG HÌNH - THÔNG TIN & THANH CÔNG CỤ) | BÊN PHẢI (2/3 KHUNG HÌNH - MÀN HÌNH HIỂN THỊ ĐỀ) ================= */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-3 sm:px-5 py-3">
        {/* Input ẩn phục vụ tải tệp Word / PDF / Scan / Ảnh */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".docx,.doc,.pdf,.png,.jpg,.jpeg,.webp,.svg,.txt"
          onChange={handleFileUpload}
          className="hidden"
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* ================= CỘT TRÁI (CHIẾM 1/3 KHUNG HÌNH = 4/12 CỘT): THÔNG TIN ĐỀ & THANH CÔNG CỤ ĐIỀU KHIỂN ================= */}
          <aside className="lg:col-span-4 lg:sticky lg:top-[96px] lg:max-h-[calc(100vh-132px)] lg:overflow-y-auto space-y-2.5 pr-0.5">
            {/* KHỐI 1: THÔNG TIN ĐỀ CẦN TRỘN (1 -> 8) */}
            {!isConfigCollapsed && (
              <div className="p-3 rounded-2xl bg-white/95 border-2 border-sky-300 shadow-xs space-y-2">
                <div className="grid grid-cols-2 gap-2 items-end">
                  {/* 1. Sở / Phòng GD&ĐT */}
                  <div>
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
                      className="w-full px-2.5 py-1.5 text-xs font-bold text-slate-900 bg-sky-50/70 border border-sky-300 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white"
                    />
                  </div>

                  {/* 2. Trường / Đơn vị */}
                  <div>
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
                      className="w-full px-2.5 py-1.5 text-xs font-bold text-slate-900 bg-sky-50/70 border border-sky-300 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white"
                    />
                  </div>

                  {/* 3. Kỳ kiểm tra (Mặc định: KIỂM TRA ÔN TẬP, cho phép chọn nhanh hoặc tự gõ) */}
                  <div>
                    <label className="block text-[11px] font-extrabold text-blue-950 uppercase truncate mb-0.5">
                      3. Kỳ kiểm tra:
                    </label>
                    <select
                      value={config.examTitle}
                      onChange={(e) => {
                        const newTitle = e.target.value;
                        setConfig((prev) => ({
                          ...prev,
                          examTitle: newTitle,
                          durationMinutes:
                            newTitle === 'KIỂM TRA ÔN TẬP'
                              ? 45
                              : prev.durationMinutes,
                        }));
                      }}
                      className="w-full px-2 py-1.5 text-xs font-black text-blue-950 bg-blue-50/80 border border-blue-400 rounded-xl focus:outline-none focus:border-blue-700 cursor-pointer"
                    >
                      <option value="KIỂM TRA ÔN TẬP">KIỂM TRA ÔN TẬP (Mặc định 45p)</option>
                      <option value="KIỂM TRA THƯỜNG XUYÊN">KIỂM TRA THƯỜNG XUYÊN</option>
                      <option value="KIỂM TRA GIỮA KÌ I">KIỂM TRA GIỮA KÌ I</option>
                      <option value="KIỂM TRA GIỮA KÌ II">KIỂM TRA GIỮA KÌ II</option>
                      <option value="KIỂM TRA CUỐI KÌ I">KIỂM TRA CUỐI KÌ I</option>
                      <option value="KIỂM TRA CUỐI KÌ II">KIỂM TRA CUỐI KÌ II</option>
                      <option value="KỲ THI TỐT NGHIỆP THPT">KỲ THI TỐT NGHIỆP THPT</option>
                    </select>
                  </div>

                  {/* 4. Môn thi (12 môn THPT) */}
                  <div>
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
                          'SINH HỌC': 45,
                          'VẬT LÍ': 45,
                          'HÓA HỌC': 45,
                          'TIẾNG ANH': 45,
                          'LỊCH SỬ': 45,
                          'ĐỊA LÍ': 45,
                          'GD KINH TẾ & PHÁP LUẬT': 45,
                          'TIN HỌC': 45,
                          'CÔNG NGHỆ CÔNG NGHIỆP': 45,
                          'CÔNG NGHỆ NÔNG NGHIỆP': 45,
                        };
                        setConfig((prev) => ({
                          ...prev,
                          subjectName: val,
                          durationMinutes:
                            prev.examTitle === 'KIỂM TRA ÔN TẬP'
                              ? 45
                              : minsMap[val] || prev.durationMinutes,
                        }));
                      }}
                      className="w-full px-2 py-1.5 text-xs font-black text-emerald-950 bg-emerald-50/80 border border-emerald-400 rounded-xl focus:outline-none focus:border-emerald-700 cursor-pointer"
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
                </div>

                {/* Hàng 5 - 6 - 7 - 8: Lớp, Phút (Mặc định 45 phút, tùy chỉnh linh hoạt), Số đề, Mã đề */}
                <div className="grid grid-cols-4 gap-1.5 items-end pt-0.5">
                  {/* 5. Lớp */}
                  <div>
                    <label className="block text-[11px] font-extrabold text-purple-950 uppercase truncate mb-0.5">
                      5. Lớp:
                    </label>
                    <select
                      value={config.gradeLevel || 'Lớp 12'}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, gradeLevel: e.target.value }))
                      }
                      className="w-full px-1.5 py-1.5 text-xs font-black text-purple-950 bg-purple-50/80 border border-purple-300 rounded-xl focus:outline-none cursor-pointer"
                    >
                      <option value="Lớp 12">Lớp 12</option>
                      <option value="Lớp 11">Lớp 11</option>
                      <option value="Lớp 10">Lớp 10</option>
                    </select>
                  </div>

                  {/* 6. Số phút làm bài (Mặc định 45 phút, tùy chỉnh trực tiếp hoặc chọn nhanh) */}
                  <div>
                    <label
                      className="block text-[11px] font-extrabold text-rose-950 uppercase truncate mb-0.5"
                      title="Tùy chỉnh số phút làm bài (Mặc định: 45 phút)"
                    >
                      6. Phút (45p):
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        min={5}
                        max={300}
                        step={5}
                        list="duration-presets"
                        value={config.durationMinutes}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            durationMinutes: Math.max(1, Number(e.target.value) || 45),
                          }))
                        }
                        className="w-full px-1.5 py-1.5 text-xs font-mono font-black text-rose-700 bg-rose-50/80 border-2 border-rose-400 rounded-xl text-center focus:outline-none focus:border-rose-600 focus:bg-white"
                      />
                      <datalist id="duration-presets">
                        <option value={15}>15 phút</option>
                        <option value={30}>30 phút</option>
                        <option value={45}>45 phút (Mặc định Kiểm tra ôn tập)</option>
                        <option value={50}>50 phút</option>
                        <option value={60}>60 phút</option>
                        <option value={90}>90 phút</option>
                        <option value={120}>120 phút</option>
                      </datalist>
                    </div>
                  </div>

                  {/* 7. Số đề */}
                  <div>
                    <label className="block text-[11px] font-extrabold text-indigo-950 uppercase truncate mb-0.5">
                      7. Số đề:
                    </label>
                    <select
                      value={config.numVariants}
                      onChange={(e) => {
                        const newCount = Number(e.target.value);
                        setConfig((prev) => {
                          const base = prev.examCodeDigits === 3 ? 101 : 1001;
                          const rootCode =
                            prev.customCodes?.[0]?.trim() || String(base);
                          const updatedCodes =
                            generateSequentialExamCodesFromRoot(
                              rootCode,
                              newCount,
                              prev.examCodeDigits
                            );
                          return {
                            ...prev,
                            numVariants: newCount,
                            customCodes: updatedCodes,
                          };
                        });
                      }}
                      className="w-full px-1.5 py-1.5 text-xs font-mono font-black text-indigo-950 bg-indigo-50/80 border border-indigo-300 rounded-xl focus:outline-none cursor-pointer"
                    >
                      <option value={4}>4 đề (1 QR chung)</option>
                      <option value={6}>6 đề (1 QR chung)</option>
                      <option value={8}>8 đề (Tối đa 1 QR)</option>
                      <option value={12}>12 đề</option>
                      <option value={24}>24 đề</option>
                    </select>
                  </div>

                  {/* 8. Mã đề gốc (Sửa ô gốc này các mã đề khác tự động nhảy theo đúng quy cách) */}
                  <div>
                    <label
                      className="block text-[11px] font-extrabold text-sky-950 uppercase truncate mb-0.5"
                      title="Chỉ cần sửa mã đề gốc ở ô này (VD: 101, 201, 001, 1001, MĐ01...), các mã đề khác tự động nhảy theo đúng quy cách"
                    >
                      8. Mã gốc:
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={
                          config.customCodes?.[0] ??
                          String(config.examCodeDigits === 3 ? 101 : 1001)
                        }
                        onFocus={() => setShowCustomCodeEditor(true)}
                        onChange={(e) => handleUpdateCustomCode(0, e.target.value)}
                        className="w-full min-w-0 px-1.5 py-1.5 text-xs font-mono font-black text-center text-violet-950 bg-violet-50/90 border-2 border-violet-400 rounded-xl focus:outline-none focus:border-violet-700 focus:bg-white"
                        title="Nhập mã đề gốc (VD: 101, 201, 001, 1201, MĐ01...). Các mã đề còn lại sẽ tự động cập nhật theo đúng quy cách của ô này"
                        maxLength={10}
                      />
                      <button
                        type="button"
                        onClick={() => setShowCustomCodeEditor((prev) => !prev)}
                        className="px-2 py-1.5 rounded-xl font-black text-white btn-auto-scale btn-3d-violet flex items-center justify-center shrink-0 cursor-pointer"
                        title="Mở/đóng danh sách toàn bộ các mã đề tự động sinh từ ô gốc"
                      >
                        <Edit3 className="w-3.5 h-3.5 shrink-0" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Thanh chọn nhanh số phút làm bài & tự gõ tên kỳ kiểm tra tùy ý */}
                <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5 px-1">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[10px] font-extrabold text-slate-600">
                      Chọn nhanh phút:
                    </span>
                    {[15, 30, 45, 50, 60, 90].map((m) => (
                      <button
                        key={`preset-min-${m}`}
                        type="button"
                        onClick={() =>
                          setConfig((prev) => ({ ...prev, durationMinutes: m }))
                        }
                        className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-black cursor-pointer transition-all ${
                          config.durationMinutes === m
                            ? 'bg-rose-600 text-white shadow-2xs scale-105'
                            : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
                        }`}
                      >
                        {m}p
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={config.examTitle}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, examTitle: e.target.value }))
                    }
                    placeholder="Gõ tên kỳ kiểm tra tùy ý..."
                    className="px-2 py-0.5 text-[11px] font-bold text-blue-950 bg-blue-50/60 border border-blue-200 rounded-lg focus:outline-none focus:border-blue-500 w-44 sm:w-48"
                    title="Giáo viên có thể tự gõ tên kỳ kiểm tra tùy ý tại đây"
                  />
                </div>

                {/* Ô điền Họ và tên Giáo viên ra đề (Hiển thị cuối trang đáp án) */}
                <div className="pt-1 px-1">
                  <div className="flex items-center gap-2 bg-emerald-50/80 border border-emerald-300 rounded-xl px-2.5 py-1.5">
                    <label className="text-[11px] font-extrabold text-emerald-950 whitespace-nowrap shrink-0">
                      9. GV ra đề (Cuối đáp án):
                    </label>
                    <input
                      type="text"
                      value={config.teacherName || ''}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, teacherName: e.target.value }))
                      }
                      placeholder="Nhập họ tên giáo viên ký cuối trang đáp án..."
                      className="w-full px-2 py-1 text-xs font-bold text-slate-900 bg-white border border-emerald-300 rounded-lg focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>

                {/* Khung mở rộng khi bấm [Sửa mã]: Cho phép sửa từng mã đề 101, 102... và tùy chỉnh Dàn trang / QR */}
                {showCustomCodeEditor && (
                  <div className="pt-2 border-t border-sky-200 space-y-2 bg-sky-50/70 p-2.5 rounded-xl text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-black text-sky-950">
                          Mã đề ({config.numVariants} mã):
                        </span>
                        <div className="flex items-center gap-1.5">
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
                            className="px-1.5 py-0.5 font-bold bg-white border border-sky-300 rounded-md"
                          >
                            <option value={3}>3 số (101...)</option>
                            <option value={4}>4 số (1001...)</option>
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
                      <div className="text-[11px] font-semibold text-violet-900 bg-violet-100/80 border border-violet-200 rounded-lg px-2 py-1">
                        💡 Chỉ cần sửa <strong>Ô gốc (Mã 1)</strong> ở trên, các mã đề còn lại sẽ <strong>tự động nhảy theo đúng quy cách</strong> (VD: <code>101</code> → <code>102, 103...</code>; <code>001</code> → <code>002, 003...</code>; <code>1201</code> → <code>1202, 1203...</code>; <code>MĐ01</code> → <code>MĐ02, MĐ03...</code>).
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {Array.from({ length: config.numVariants }, (_, idx) => {
                          const fallbackList = generateSequentialExamCodesFromRoot(
                            config.customCodes?.[0] || '',
                            config.numVariants,
                            config.examCodeDigits
                          );
                          const val =
                            config.customCodes?.[idx] ?? fallbackList[idx];
                          const isRoot = idx === 0;
                          return (
                            <div key={`code-input-${idx}`} className="relative">
                              <input
                                type="text"
                                value={val}
                                onChange={(e) => handleUpdateCustomCode(idx, e.target.value)}
                                title={
                                  isRoot
                                    ? 'Ô mã đề gốc: Sửa ô này các mã khác tự động nhảy theo đúng quy cách'
                                    : `Mã đề thứ ${idx + 1} (Tự động sinh từ ô gốc, hoặc có thể sửa riêng)`
                                }
                                className={`w-full px-2 py-1 font-black font-mono text-center rounded-md focus:outline-none ${
                                  isRoot
                                    ? 'text-violet-950 bg-amber-50 border-2 border-violet-500 ring-1 ring-violet-300 focus:bg-white'
                                    : 'text-blue-950 bg-white border border-sky-300 focus:border-blue-600'
                                }`}
                                maxLength={10}
                              />
                              {isRoot && (
                                <span className="block text-[9px] font-extrabold text-violet-800 text-center leading-tight mt-0.5">
                                  Ô gốc
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="font-bold text-slate-700 block mb-0.5">Chia cột Phần I:</span>
                        <select
                          value={config.layoutOverride}
                          onChange={(e) =>
                            setConfig((prev) => ({
                              ...prev,
                              layoutOverride: e.target.value as LayoutMode,
                            }))
                          }
                          className="w-full px-1.5 py-1 font-bold bg-white border border-sky-300 rounded-md"
                        >
                          <option value="AUTO">Tự động (Auto)</option>
                          <option value="1_ROW_4_COL">4 cột ngang</option>
                          <option value="2_ROW_2_COL">2 cột × 2 hàng</option>
                          <option value="4_ROW_1_COL">1 cột dọc</option>
                        </select>
                      </div>

                      <div>
                        <span className="font-bold text-slate-700 block mb-0.5">Chuẩn mã QR:</span>
                        <select
                          value={config.qrFormat}
                          onChange={(e) =>
                            setConfig((prev) => ({
                              ...prev,
                              qrFormat: e.target.value as QRAppFormat,
                            }))
                          }
                          className="w-full px-1.5 py-1 font-bold bg-white border border-sky-300 rounded-md"
                        >
                          <option value="QM2025">1. QM2025 (Chuẩn)</option>
                          <option value="TNMAKER">2. TNMaker</option>
                          <option value="AZOTA">3. Azota 2025</option>
                          <option value="UNT">4. UnT Dạy Học (UnT Labs)</option>
                          <option value="STANDARD_2025">Standard 2025</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* ================= Ô TÙY CHỌN PHIẾU TRẢ LỜI TRẮC NGHIỆM NỔI BẬT (MẶC ĐỊNH THEO MÔN + 13 MẪU CHUẨN + TẢI PHIẾU RIÊNG) ================= */}
                <input
                  ref={phieuUploadInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.pdf"
                  onChange={handleUploadCustomPhieuQM}
                  className="hidden"
                />
                <div
                  className="p-3 rounded-2xl border-2 border-amber-400 space-y-2 relative overflow-hidden"
                  style={{
                    background:
                      'linear-gradient(135deg, #fffbeb 0%, #fef3c7 45%, #ecfdf5 100%)',
                    boxShadow:
                      '0 8px 20px -4px rgba(245, 158, 11, 0.28), 0 3px 0 #d97706, inset 0 1px 0 rgba(255,255,255,0.9)',
                  }}
                >
                  {/* Hàng tiêu đề nổi bật */}
                  <div className="flex items-center justify-between gap-1.5">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.embedPhieuQM2025 !== false}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            embedPhieuQM2025: e.target.checked,
                          }))
                        }
                        className="w-4 h-4 accent-emerald-600 rounded cursor-pointer shrink-0"
                      />
                      <span className="text-[11px] font-black text-amber-950 uppercase tracking-tight flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>CHỌN PHIẾU TRẢ LỜI ĐƯA VÀO ĐỀ TRỘN</span>
                      </span>
                    </label>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider shadow-2xs shrink-0">
                      {config.selectedPhieuQMCode === 'AUTO' || !config.selectedPhieuQMCode
                        ? 'Mặc định'
                        : 'Tùy chọn'}
                    </span>
                  </div>

                  {/* Ô Dropdown chọn mẫu phiếu trả lời trắc nghiệm nổi bật */}
                  <div className="space-y-1.5">
                    <select
                      value={config.selectedPhieuQMCode || 'AUTO'}
                      onChange={(e) => {
                        const code = e.target.value as PhieuQMSelectionCode;
                        setConfig((prev) => ({
                          ...prev,
                          embedPhieuQM2025: true,
                          selectedPhieuQMCode: code,
                        }));
                      }}
                      className="w-full px-2.5 py-2 text-xs font-black text-slate-900 bg-white border-2 border-amber-500 rounded-xl shadow-xs focus:outline-none focus:border-emerald-600 cursor-pointer"
                    >
                      <option value="AUTO">
                        ★ Mặc định tự động theo môn ({getPhieuQMInfoBySubject(config.subjectName).groupName})
                      </option>
                      <optgroup label="── 4 Mẫu Phiếu Mặc Định Chuẩn Bộ GD&ĐT ──">
                        <option value="KHTN_DIA">
                          1. Nhóm KHTN &amp; Địa (18 - 4 - 6) · phieu_khtn.jpg
                        </option>
                        <option value="TOAN">
                          2. Môn Toán học (12 - 4 - 6) · phieu_toan.jpg
                        </option>
                        <option value="NGOAI_NGU">
                          3. Môn Ngoại ngữ (40 câu TN) · phieu_ngoaingu.jpg
                        </option>
                        <option value="KHXH_CN_TIN">
                          4. Nhóm KHXH, CN, Tin (24 - 6 - 0) · phieu_khxh.jpg
                        </option>
                      </optgroup>
                      <optgroup label="── 5 Mẫu Phiếu Chuyên Dụng Mới (Ôn Tập / CV 1239 / HSG) ──">
                        <option value="QM_40_0_0">
                          5. Phiếu A4-40-Ngang (40 - 0 - 0 · Có khung Lời phê &amp; Điểm)
                        </option>
                        <option value="QM_0_0_10">
                          6. Phiếu Ôn Tập - Trả lời ngắn (0 - 0 - 10 · 10 câu TL ngắn)
                        </option>
                        <option value="QM_40_8_6">
                          7. Phiếu QM 2025 - CV 1239 (40 - 8 - 6 · Trắc nghiệm + Tự luận)
                        </option>
                        <option value="QM_40_16_12">
                          8. Phiếu QM 2025 - CV 1239 (40 - 16 - 12 · Đa năng mở rộng)
                        </option>
                        <option value="QM_30_20_0">
                          9. Phiếu QM 2025 - HSG / Chuyên đề (30 - 20 - 00 + Tự luận)
                        </option>
                      </optgroup>
                      <optgroup label="── 4 Mẫu Phiếu Mới: UnT Labs (untedu.com / untclass.com) ──">
                        <option value="UNT_18_4_6">
                          10. Phiếu UnT 18.4.6 (KHTN &amp; Địa - 2 phiếu/A4) · UnT_18.4.6_ABCD_2_Forms.pdf
                        </option>
                        <option value="UNT_30_6_8">
                          11. Phiếu UnT 30.6.8 (Đề Đa Năng - 1 phiếu/A4) · UnT_30.6.8_ABCD_1_Form.pdf
                        </option>
                        <option value="UNT_30_8_0">
                          12. Phiếu UnT 30.8.0 (Trắc nghiệm &amp; Đúng Sai - 2 phiếu/A4) · UnT_30.8.0_ABCD_2_Forms.pdf
                        </option>
                        <option value="UNT_40_8_6">
                          13. Phiếu UnT 40.8.6 (THPT 2025 - SBD 4 số) · UnT_40.8.6_ABCD_4_DIGITS_1_Form.pdf
                        </option>
                      </optgroup>
                      {config.customPhieuQMDataUrl && (
                        <optgroup label="── Phiếu Do Giáo Viên Tải Lên ──">
                          <option value="CUSTOM">
                            ★ Phiếu riêng: {config.customPhieuQMName || 'phieu_tuy_chon.png'}
                          </option>
                        </optgroup>
                      )}
                    </select>

                    {/* Cụm nút: Kho 13 Mẫu Phiếu & Tải Phiếu Riêng */}
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setIsPhieuQmGalleryOpen(true)}
                        className="px-2.5 py-1.5 rounded-xl font-black text-white text-[11px] btn-3d-amber flex items-center justify-center gap-1 cursor-pointer"
                        title="Mở kho 13 mẫu phiếu trả lời trắc nghiệm trực quan để xem và bấm chọn"
                      >
                        <ImageIcon className="w-3.5 h-3.5 shrink-0" />
                        <span>Kho 13 Mẫu Phiếu</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => phieuUploadInputRef.current?.click()}
                        className="px-2.5 py-1.5 rounded-xl font-black text-white text-[11px] btn-3d-emerald flex items-center justify-center gap-1 cursor-pointer"
                        title="Tải file ảnh (.jpg, .png) hoặc PDF (.pdf) phiếu trả lời riêng của trường bạn lên để nhúng vào đề trộn"
                      >
                        <Upload className="w-3.5 h-3.5 shrink-0" />
                        <span>Tải Phiếu Riêng</span>
                      </button>
                    </div>
                  </div>

                  {/* Khung xem trước trực quan mẫu phiếu đang được chọn */}
                  <div className="bg-white/95 p-2 rounded-xl border border-amber-300 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <div className="truncate">
                        <span className="font-black text-emerald-800">
                          {activePhieuQMInfo.groupName}
                        </span>
                        <span className="text-slate-600 font-semibold ml-1">
                          ({activePhieuQMInfo.structureDesc})
                        </span>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded shrink-0">
                        {activePhieuQMInfo.sizeLabel || '16.5×8.2cm'}
                      </span>
                    </div>
                    {config.embedPhieuQM2025 !== false && resolvedPhieuPreviewUrl && (
                      <div
                        className="relative group cursor-pointer rounded-lg overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center max-h-28"
                        onClick={() =>
                          setPreviewModalImage({
                            src: resolvedPhieuPreviewUrl,
                            caption: `Phiếu trả lời đang chọn: ${activePhieuQMInfo.groupName} (${activePhieuQMInfo.structureDesc}) — Tự động đưa vào tất cả các đề trộn Word (.docx)`,
                          })
                        }
                        title="Bấm để phóng to xem chi tiết phiếu trả lời đang chọn"
                      >
                        <img
                          src={resolvedPhieuPreviewUrl}
                          alt={activePhieuQMInfo.groupName}
                          className="max-h-24 w-auto object-contain mx-auto transition-transform group-hover:scale-[1.02]"
                        />
                        <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-slate-900/75 text-white text-[9px] font-bold">
                          Phóng to
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* KHỐI 2: THANH CÔNG CỤ TÁC VỤ KHOA HỌC — NHẬP ĐỀ, TRỘN ĐỀ & LỌC PHẦN (NẰM BÊN TRÁI 1/3 KHUNG HÌNH) */}
            <div className="p-3 rounded-2xl toolbar-3d space-y-2.5">
              {/* Nhóm 1: Các nút tác vụ chính được bố trí khoa học theo quy trình (Tải đề lên -> Trộn đề -> Đề mẫu -> Lưu sửa) */}
              <div className="space-y-1.5 pb-2.5 border-b border-sky-200/90">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-black text-sky-950 uppercase tracking-wide">
                    1. Thao tác đề thi &amp; trộn đề:
                  </span>
                  <span className="text-[10px] font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-md border border-orange-300">
                    Word, PDF, Scan, Ảnh
                  </span>
                </div>

                {/* Hàng 1: 2 Nút quan trọng nhất — [Tải đề lên] siêu nổi bật & [Trộn Đề] */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessing}
                    title="Tải đề thi từ máy tính (Word .docx/.doc, PDF, Bản Scan, Ảnh .png/.jpg) lên hệ thống"
                    className="px-3 py-2.5 rounded-xl font-black text-white btn-auto-scale btn-3d-upload-hero flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <Upload className="w-4 h-4 shrink-0 stroke-[2.5]" />
                    <span className="tracking-wide uppercase">Tải đề lên</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRunShuffle}
                    disabled={isProcessing}
                    title="Hoán vị câu hỏi & đáp án để sinh bộ mã đề kèm bảng đáp án khảo thí"
                    className="px-3 py-2.5 rounded-xl font-black text-white btn-auto-scale btn-3d-rose flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <Shuffle className="w-4 h-4 shrink-0" />
                    <span>Trộn Đề ({config.numVariants} Mã)</span>
                  </button>
                </div>

                {/* Hàng 2: 3 Nút tiện ích — [Đề Mẫu Sinh 12] & [Đề Mẫu Toán 12] & [Lưu Toàn Bộ Chỉnh Sửa] */}
                <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => handleLoadSampleExam(true)}
                    disabled={isProcessing}
                    title="Nạp đề mẫu Sinh học 12 chuẩn cấu trúc 2025 (18 câu Phần I, 4 câu Phần II, 6 câu Phần III)"
                    className="px-2 py-2 rounded-xl font-extrabold text-white btn-auto-scale btn-3d-cyan flex items-center justify-center gap-1 whitespace-nowrap cursor-pointer text-xs"
                  >
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span>Mẫu Sinh 12</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleLoadMathSamplePdf}
                    disabled={isProcessing}
                    title="Nạp Đề Toán Mẫu 12 (22 câu: công thức phân số/căn thức phức tạp, 12 đồ thị hàm số, bảng biến thiên & hình không gian)"
                    className="px-2 py-2 rounded-xl font-extrabold text-white btn-auto-scale btn-3d-emerald flex items-center justify-center gap-1 whitespace-nowrap cursor-pointer text-xs"
                  >
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span>Mẫu Toán 12</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveAllEditsOnly}
                    disabled={isProcessing}
                    title="Lưu cố định toàn bộ các câu đã chỉnh sửa để chuyển sang câu khác không bị thay đổi"
                    className={`px-2 py-2 rounded-xl font-extrabold text-white btn-auto-scale flex items-center justify-center gap-1 whitespace-nowrap cursor-pointer text-xs ${
                      hasUnsavedChanges ? 'btn-3d-amber ring-2 ring-amber-300' : 'btn-3d-indigo'
                    }`}
                  >
                    <Save className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {hasUnsavedChanges
                        ? `Lưu (${unsavedQuestionIds.length || 1})*`
                        : 'Lưu Chỉnh Sửa'}
                    </span>
                  </button>
                </div>

                {/* Hàng 2.5: Nút [Lưu Toàn Bộ & Bắt Đầu Trộn Đề Ngay] */}
                <div className="pt-0.5">
                  <button
                    type="button"
                    onClick={handleSaveEdits}
                    disabled={isProcessing}
                    title="Lưu toàn bộ chỉnh sửa hiện tại và tự động bắt đầu trộn đề ngay"
                    className="w-full px-3 py-2 rounded-xl font-black text-white btn-auto-scale btn-3d-emerald flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>
                      {hasUnsavedChanges
                        ? 'Lưu Toàn Bộ & Bắt Đầu Trộn Đề Ngay*'
                        : 'Lưu & Trộn Đề Ngay'}
                    </span>
                  </button>
                </div>

                {/* Hàng 3 (Chỉ hiện sau khi bấm Trộn Đề): Nút Tải Về .ZIP gọn gàng */}
                {shuffledVariants.length > 0 && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={handleDownloadZipBundle}
                      disabled={isProcessing || questions.length === 0}
                      className="w-full px-3 py-2 rounded-xl font-black text-white btn-auto-scale btn-3d-rose flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer shadow-sm"
                      title="Tải về .ZIP"
                    >
                      <FileArchive className="w-4 h-4 shrink-0" />
                      <span>Tải Về .ZIP</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Nhóm 2: Chuyển nhanh các Phần của đề & Chế độ hiển thị */}
              <div className="space-y-1.5 pb-2 border-b border-sky-200/90">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-black text-sky-950 uppercase tracking-wide">
                    2. Lọc phần câu hỏi &amp; chế độ xem:
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveRightTab('LIVE_EDITOR');
                      setFilterPart('ALL');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className={`px-2 py-1.5 rounded-xl font-black text-white btn-auto-scale btn-3d-slate cursor-pointer ${
                      filterPart === 'ALL' ? 'ring-2 ring-slate-400' : 'opacity-90 hover:opacity-100'
                    }`}
                    title="Hiển thị toàn bộ câu hỏi của đề"
                  >
                    Tất cả: {questions.length}
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
                    className={`px-2 py-1.5 rounded-xl font-black text-white btn-auto-scale btn-3d-primary cursor-pointer ${
                      filterPart === 'PART_1' ? 'ring-2 ring-blue-300' : 'opacity-95 hover:opacity-100'
                    }`}
                  >
                    PHẦN I: {part1Count}
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
                    className={`px-2 py-1.5 rounded-xl font-black text-white btn-auto-scale btn-3d-emerald cursor-pointer ${
                      filterPart === 'PART_2' ? 'ring-2 ring-emerald-300' : 'opacity-95 hover:opacity-100'
                    }`}
                  >
                    PHẦN II: {part2Count}
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
                    className={`px-2 py-1.5 rounded-xl font-black text-white btn-auto-scale btn-3d-amber cursor-pointer ${
                      filterPart === 'PART_3' ? 'ring-2 ring-amber-300' : 'opacity-95 hover:opacity-100'
                    }`}
                  >
                    PHẦN III: {part3Count}
                  </button>
                </div>

                {/* Hàng lọc & thêm nhanh Phần Tự Luận (Phần IV hoặc Phần III nếu không có trả lời ngắn) */}
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveRightTab('LIVE_EDITOR');
                      setFilterPart('PART_4');
                      const firstP4 = questions.find((q) => q.part === 'PART_4');
                      if (firstP4) {
                        setTimeout(() => {
                          questionRefs.current[firstP4.id]?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'center',
                          });
                        }, 60);
                      }
                    }}
                    className={`px-2 py-1.5 rounded-xl font-black text-white btn-auto-scale btn-3d-purple cursor-pointer ${
                      filterPart === 'PART_4' ? 'ring-2 ring-purple-300' : 'opacity-95 hover:opacity-100'
                    }`}
                    title="Lọc các câu hỏi Phần Tự luận (Giữ nguyên câu hỏi — Không trộn)"
                  >
                    {essayRomanLabel} (Tự luận): {part4Count}
                  </button>

                  <button
                    type="button"
                    onClick={handleAddEssayQuestionPart4}
                    className="px-2 py-1.5 rounded-xl font-black text-white btn-auto-scale btn-3d-indigo cursor-pointer"
                    title="Thêm nhanh 1 câu hỏi vào Phần Tự luận (Không trộn)"
                  >
                    + Thêm Câu Tự Luận
                  </button>
                </div>

                {/* Chuyển chế độ Thẻ Câu Hỏi 3D / Trang Word A4 */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveRightTab('LIVE_EDITOR');
                      setEditorViewMode('CARDS_3D');
                    }}
                    className={`px-2.5 py-1.5 rounded-xl font-extrabold text-white btn-auto-scale btn-3d-sky flex items-center justify-center gap-1.5 cursor-pointer ${
                      activeRightTab === 'LIVE_EDITOR' && editorViewMode === 'CARDS_3D'
                        ? 'ring-2 ring-sky-300'
                        : 'opacity-85 hover:opacity-100'
                    }`}
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
                    className={`px-2.5 py-1.5 rounded-xl font-extrabold text-white btn-auto-scale btn-3d-violet flex items-center justify-center gap-1.5 cursor-pointer ${
                      activeRightTab === 'LIVE_EDITOR' && editorViewMode === 'WORD_A4_PAGE'
                        ? 'ring-2 ring-violet-300'
                        : 'opacity-85 hover:opacity-100'
                    }`}
                  >
                    <Edit3 className="w-3.5 h-3.5 shrink-0" />
                    <span>Trang Word A4</span>
                  </button>
                </div>
              </div>

              {/* Nhóm 4: Chọn cỡ chữ & Chèn nhanh ký hiệu khoa học */}
              <div className="pt-1 border-t border-sky-200/80 flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5">
                  <select
                    value={wordFontSizePt}
                    onChange={(e) => setWordFontSizePt(Number(e.target.value))}
                    className="px-2 py-1 rounded-xl bg-white border border-sky-300 text-xs font-mono font-bold text-slate-900 cursor-pointer"
                    title="Chọn cỡ chữ hiển thị"
                  >
                    <option value={11}>Times 11pt</option>
                    <option value={12}>Times 12pt</option>
                    <option value={13}>Times 13pt</option>
                    <option value={14}>Times 14pt</option>
                  </select>
                </div>

                <div className="flex items-center gap-1 flex-wrap">
                  {[
                    { label: '→', insert: '→' },
                    { label: '⇌', insert: '⇌' },
                    { label: 'Ω', insert: 'Ω' },
                    { label: 'λ', insert: 'λ' },
                    { label: 'μ', insert: 'μ' },
                    { label: 'α', insert: 'α' },
                    { label: 'Δ', insert: 'Δ' },
                    { label: '∫', insert: '$\\int_{a}^{b}$' },
                    { label: 'a/b', insert: '$\\frac{a}{b}$' },
                    { label: 'vec', insert: '$\\vec{E}$' },
                    { label: 'H₂SO₄', insert: 'H_{2}SO_{4}' },
                    { label: 'Fe³⁺', insert: 'Fe^{3+}' },
                    { label: 'SO₄²⁻', insert: 'SO_{4}^{2-}' },
                    { label: '♂', insert: '♂' },
                    { label: '♀', insert: '♀' },
                    { label: '°C', insert: '°C' },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => handleInsertScientificSymbol(item.insert)}
                      className="px-1.5 h-6 rounded-lg bg-white hover:bg-blue-50 border border-sky-300 text-[11px] font-mono font-black text-blue-950 shadow-2xs transition-transform active:scale-95 cursor-pointer"
                      title={`Chèn nhanh ký hiệu / công thức ${item.label} (Tự động xuất chuẩn Word OMML / Sub-Superscript)`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* ================= CỘT PHẢI (CHIẾM 2/3 KHUNG HÌNH = 8/12 CỘT): MÀN HÌNH HIỂN THỊ & CHỈNH SỬA ĐỀ ================= */}
          <section className="lg:col-span-8 min-w-0 space-y-4">
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
                    onPaste={handleWordA4ClipboardPaste}
                    onChange={(e) => {
                      lastEditSourceRef.current = 'WORD_A4_PAGE';
                      setWordRawDocumentText(e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    style={{
                      fontFamily: "'Times New Roman', Times, serif",
                      fontSize: `${wordFontSizePt}pt`,
                    }}
                    className="w-full p-5 bg-white border-2 border-slate-300 rounded-2xl shadow-inner text-slate-950 leading-relaxed focus:outline-none focus:border-blue-600"
                    placeholder="Nhập hoặc dán (Ctrl+V) trực tiếp đề thi từ Microsoft Word tại đây (Hỗ trợ tự động nhận diện gạch chân và chữ tô đỏ ở cả Phần I, Phần II và Phần IV Tự luận)..."
                  />
                </div>
              )}

              {/* TRANG ĐỀ THI HOÀN CHỈNH ĐÃ CHUẨN HÓA (CHỈ HIỂN THỊ CÂU HỎI CHUẨN, KHÔNG LẶP NỘI DUNG THÔ) */}
              {editorViewMode === 'CARDS_3D' && (
                <div
                  style={{
                    fontFamily: "'Times New Roman', Times, serif",
                    fontSize: `${wordFontSizePt}pt`,
                  }}
                  className="p-6 sm:p-8 bg-white rounded-3xl border-2 border-slate-300 shadow-lg space-y-5 text-slate-950"
                >
                  {/* Quốc hiệu - Tiêu ngữ - Tiêu đề Đề thi chuẩn */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 pb-3 border-b-2 border-slate-800 text-center">
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
                        Môn thi: <strong className="font-bold not-italic">{config.subjectName}</strong> — Thời gian làm bài: {config.durationMinutes} phút
                      </div>
                    </div>
                  </div>

                  {/* Nội dung các phần và câu hỏi đã chuẩn hóa */}
                  <div className="space-y-4">
                    {filteredQuestions.map((q, idx) => {
                      const prevQ = idx > 0 ? filteredQuestions[idx - 1] : null;
                      const showPartHeader = !prevQ || prevQ.part !== q.part;
                      const questionIssues = validationIssues.filter(
                        (iss) => iss.questionId === q.id
                      );
                      const isHighlighted = highlightedQuestionId === q.id;
                      const isEditingThisQuestion = activeFocusedQuestionId === q.id;

                      const effectiveLayout =
                        config.layoutOverride === 'AUTO'
                          ? q.computedLayout || '4_ROW_1_COL'
                          : config.layoutOverride;

                      return (
                        <React.Fragment key={q.id}>
                          {showPartHeader && (
                            <div className="pt-3 pb-1 font-bold text-slate-950 border-b border-slate-300">
                              {q.part === 'PART_1' &&
                                'PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn. Mỗi câu hỏi thí sinh chỉ chọn một phương án.'}
                              {q.part === 'PART_2' &&
                                'PHẦN II. Câu trắc nghiệm đúng sai. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai.'}
                              {q.part === 'PART_3' &&
                                'PHẦN III. Câu trắc nghiệm trả lời ngắn.'}
                              {q.part === 'PART_4' &&
                                `${essayRomanLabel}. Tự luận.`}
                            </div>
                          )}

                          <div
                            ref={(el) => {
                              questionRefs.current[q.id] = el;
                            }}
                            className={`exam-content group relative rounded-xl transition-all ${
                              isHighlighted
                                ? 'p-3 bg-amber-50 border-2 border-amber-500 ring-2 ring-amber-300'
                                : questionIssues.length > 0
                                ? 'p-3 bg-rose-50/90 border border-rose-400'
                                : isEditingThisQuestion
                                ? 'p-4 bg-sky-50/70 border border-sky-300'
                                : 'py-1.5 px-2 hover:bg-slate-50/80'
                            }`}
                          >
                            {/* Cảnh báo nếu câu hỏi thiếu/sai quy chuẩn đáp án */}
                            {questionIssues.length > 0 && (
                              <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-100 px-2.5 py-1 rounded-lg border border-rose-300">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                <span>{questionIssues[0].message}</span>
                              </div>
                            )}

                            {/* Chế độ hiển thị chuẩn hóa (Mặc định) vs Chế độ sửa câu hỏi khi bấm nút Sửa */}
                            {!isEditingThisQuestion ? (
                              <div className="space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="text-left leading-relaxed flex-1">
                                    <strong className="font-bold">
                                      Câu {q.displayIndex}.{' '}
                                    </strong>
                                    <ScientificContentRenderer
                                      text={q.stemText}
                                      formulaLatex={q.formulaLatex}
                                      hasFormula={q.hasFormula}
                                      inline
                                    />
                                  </div>

                                  <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
                                    <select
                                      value={q.bloomLevel || 'NHAN_BIET'}
                                      onChange={(e) =>
                                        handleUpdateBloomLevel(
                                          q.id,
                                          e.target.value as BloomLevel
                                        )
                                      }
                                      className="px-1.5 py-0.5 text-[11px] font-bold bg-white text-slate-700 border border-slate-300 rounded focus:outline-none cursor-pointer"
                                      title="Chọn mức độ nhận thức"
                                    >
                                      <option value="NHAN_BIET">Nhận biết</option>
                                      <option value="THONG_HIEU">Thông hiểu</option>
                                      <option value="VAN_DUNG">Vận dụng</option>
                                      <option value="VAN_DUNG_CAO">Vận dụng cao</option>
                                    </select>
                                    <button
                                      type="button"
                                      onClick={() => setActiveFocusedQuestionId(q.id)}
                                      className="px-2 py-0.5 rounded text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 flex items-center gap-1 cursor-pointer"
                                      title="Chỉnh sửa nội dung câu hỏi này"
                                    >
                                      <Edit3 className="w-3 h-3" />
                                      <span>Sửa</span>
                                    </button>
                                  </div>
                                </div>

                                {/* Bảng dữ liệu trong câu hỏi */}
                                {q.stemTables && q.stemTables.length > 0 && (
                                  <div className="my-2 space-y-2">
                                    {q.stemTables.map((tbl) => (
                                      <div
                                        key={tbl.id}
                                        className="overflow-x-auto rounded-lg border border-slate-300 bg-white"
                                      >
                                        <table
                                          className="w-full border-collapse text-xs text-slate-900"
                                          style={{ fontFamily: "'Times New Roman', Times, serif" }}
                                        >
                                          <tbody>
                                            {tbl.rows.map((row, rIdx) => (
                                              <tr
                                                key={`${tbl.id}-r-${rIdx}`}
                                                className={rIdx === 0 ? 'bg-slate-100 font-bold' : 'bg-white'}
                                              >
                                                {row.map((cell, cIdx) =>
                                                  cell.vMergeContinue ? null : (
                                                    <td
                                                      key={`${tbl.id}-c-${rIdx}-${cIdx}`}
                                                      colSpan={cell.colSpan || 1}
                                                      rowSpan={cell.rowSpan || 1}
                                                      className={`border border-slate-300 px-2.5 py-1.5 ${
                                                        cell.align === 'center'
                                                          ? 'text-center'
                                                          : cell.align === 'right'
                                                          ? 'text-right'
                                                          : 'text-left'
                                                      } ${cell.isBold || rIdx === 0 ? 'font-bold' : ''}`}
                                                    >
                                                      <ScientificContentRenderer text={cell.text} inline />
                                                    </td>
                                                  )
                                                )}
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Hình ảnh đính kèm */}
                                {q.images && q.images.length > 0 && (
                                  <div className="my-2 flex flex-wrap items-center justify-center gap-4">
                                    {q.images.map((img) => (
                                      <div
                                        key={img.id}
                                        className="exam-pedigree-block relative flex flex-col items-center"
                                      >
                                        <img
                                          src={img.dataUrl}
                                          alt={img.caption || `Hình câu ${q.displayIndex}`}
                                          className="max-h-52 object-contain rounded cursor-pointer"
                                          onClick={() =>
                                            setPreviewModalImage({
                                              src: img.dataUrl,
                                              caption: `Câu ${q.displayIndex}`,
                                            })
                                          }
                                        />
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* PHẦN I: 4 phương án A, B, C, D đã chuẩn hóa (Bấm trực tiếp để chọn đáp án đúng) */}
                                {q.part === 'PART_1' && q.options && (
                                  <div
                                    className={`grid gap-x-4 gap-y-1.5 pl-1 pt-0.5 ${
                                      effectiveLayout === '1_ROW_4_COL'
                                        ? 'grid-cols-2 sm:grid-cols-4'
                                        : effectiveLayout === '2_ROW_2_COL'
                                        ? 'grid-cols-1 sm:grid-cols-2'
                                        : 'grid-cols-1'
                                    }`}
                                  >
                                    {q.options.map((opt) => (
                                      <div
                                        key={opt.id}
                                        onClick={() =>
                                          handleSelectSingleCorrectPart1(q.id, opt.id)
                                        }
                                        title={`Bấm để chọn ${opt.currentLabel} làm đáp án đúng`}
                                        className={`text-left leading-relaxed cursor-pointer rounded px-1.5 py-0.5 transition-colors text-slate-950 ${
                                          opt.isCorrect
                                            ? 'bg-rose-50/50 hover:bg-rose-50'
                                            : 'hover:bg-sky-50'
                                        }`}
                                      >
                                        <strong className="font-bold">
                                          <span
                                            className={
                                              opt.isCorrect
                                                ? 'text-red-600 underline decoration-red-600 decoration-2 underline-offset-2 font-extrabold'
                                                : 'text-slate-950'
                                            }
                                          >
                                            {opt.currentLabel}
                                          </span>
                                          <span className="text-slate-950">. </span>
                                        </strong>
                                        <ScientificContentRenderer
                                          text={opt.text}
                                          inline
                                          isCorrect={false}
                                          isUnderline={false}
                                          isRed={false}
                                        />
                                        {opt.images && opt.images.length > 0 && (
                                          <span className="ml-1 inline-flex flex-wrap items-center gap-1 align-middle">
                                            {opt.images.map((img) => (
                                              <img
                                                key={img.id}
                                                src={img.dataUrl}
                                                alt={
                                                  img.caption ||
                                                  `Hình phương án ${opt.currentLabel} — Câu ${q.displayIndex}`
                                                }
                                                className="inline-block max-h-14 object-contain rounded border border-slate-200 bg-white cursor-pointer"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setPreviewModalImage({
                                                    src: img.dataUrl,
                                                    caption: `Câu ${q.displayIndex} — Phương án ${opt.currentLabel}`,
                                                  });
                                                }}
                                              />
                                            ))}
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* PHẦN II: 4 ý a), b), c), d) Đúng / Sai đã chuẩn hóa */}
                                {q.part === 'PART_2' && q.subItems && (
                                  <div className="space-y-1 pl-2 pt-0.5">
                                    {q.subItems.map((sub) => (
                                      <div
                                        key={sub.id}
                                        className="flex items-start justify-between gap-3 py-0.5 px-1.5 rounded hover:bg-sky-50/60"
                                      >
                                        <div className="text-left leading-relaxed flex-1 text-slate-950">
                                          <strong className="font-bold">
                                            <span
                                              className={
                                                sub.isTrue
                                                  ? 'text-red-600 underline decoration-red-600 decoration-2 underline-offset-2 font-extrabold'
                                                  : 'text-slate-950'
                                              }
                                            >
                                              {sub.currentLabel}
                                            </span>
                                            <span className="text-slate-950">) </span>
                                          </strong>
                                          <ScientificContentRenderer text={sub.text} inline />
                                          {sub.images && sub.images.length > 0 && (
                                            <span className="ml-1 inline-flex flex-wrap items-center gap-1 align-middle">
                                              {sub.images.map((img) => (
                                                <img
                                                  key={img.id}
                                                  src={img.dataUrl}
                                                  alt={
                                                    img.caption ||
                                                    `Hình ý ${sub.currentLabel} — Câu ${q.displayIndex}`
                                                  }
                                                  className="inline-block max-h-14 object-contain rounded border border-slate-200 bg-white cursor-pointer"
                                                  onClick={() =>
                                                    setPreviewModalImage({
                                                      src: img.dataUrl,
                                                      caption: `Câu ${q.displayIndex} — Ý ${sub.currentLabel}`,
                                                    })
                                                  }
                                                />
                                              ))}
                                            </span>
                                          )}
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0 pt-0.5">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleToggleSubItemPart2(q.id, sub.id, true)
                                            }
                                            className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer border ${
                                              sub.isTrue
                                                ? 'bg-emerald-600 text-white border-emerald-700'
                                                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                                            }`}
                                          >
                                            Đúng
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleToggleSubItemPart2(q.id, sub.id, false)
                                            }
                                            className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer border ${
                                              !sub.isTrue
                                                ? 'bg-rose-600 text-white border-rose-700'
                                                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                                            }`}
                                          >
                                            Sai
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* PHẦN III: Trả lời ngắn */}
                                {q.part === 'PART_3' && (
                                  <div className="pl-2 pt-1 flex flex-wrap items-center gap-2 text-sm">
                                    <span className="font-bold text-slate-800">
                                      Đáp án:
                                    </span>
                                    <input
                                      type="text"
                                      value={q.shortAnswer || ''}
                                      onChange={(e) =>
                                        handleUpdateShortAnswerPart3(q.id, e.target.value)
                                      }
                                      placeholder="Nhập đáp số (tối đa 4 ký tự)"
                                      className="w-36 px-2.5 py-0.5 text-sm font-bold text-rose-700 bg-amber-50/70 border border-amber-400 rounded focus:outline-none focus:border-blue-600 focus:bg-white"
                                    />
                                  </div>
                                )}

                                {/* PHẦN IV: Tự luận */}
                                {q.part === 'PART_4' &&
                                  (q.essayAnswer || q.explanation || '').trim() && (
                                    <div className="pl-2 pt-1 text-slate-800 italic">
                                      <strong className="font-bold not-italic">
                                        Hướng dẫn chấm:{' '}
                                      </strong>
                                      <ScientificContentRenderer
                                        text={q.essayAnswer || q.explanation || ''}
                                        inline
                                      />
                                    </div>
                                  )}
                              </div>
                            ) : (
                              /* Khung chỉnh sửa khi giáo viên bấm nút "Sửa" trên câu hỏi */
                              <div className="space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-sky-200">
                                  <div className="flex items-center gap-2">
                                    <span className="px-2.5 py-0.5 rounded bg-blue-600 text-white text-xs font-bold">
                                      Đang sửa Câu {q.displayIndex}
                                    </span>
                                    <select
                                      value={q.bloomLevel || 'NHAN_BIET'}
                                      onChange={(e) =>
                                        handleUpdateBloomLevel(
                                          q.id,
                                          e.target.value as BloomLevel
                                        )
                                      }
                                      className="px-2 py-0.5 text-xs font-bold bg-white text-sky-900 border border-sky-300 rounded focus:outline-none"
                                    >
                                      <option value="NHAN_BIET">Mức độ: Nhận biết</option>
                                      <option value="THONG_HIEU">Mức độ: Thông hiểu</option>
                                      <option value="VAN_DUNG">Mức độ: Vận dụng</option>
                                      <option value="VAN_DUNG_CAO">Mức độ: Vận dụng cao</option>
                                    </select>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <input
                                      type="file"
                                      accept="image/*"
                                      id={`upload-img-${q.id}`}
                                      onChange={(e) => handleAddImageToQuestion(q.id, e)}
                                      className="hidden"
                                    />
                                    <label
                                      htmlFor={`upload-img-${q.id}`}
                                      className="px-2.5 py-1 rounded text-xs font-bold text-sky-800 bg-white hover:bg-sky-100 border border-sky-300 flex items-center gap-1 cursor-pointer"
                                    >
                                      <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                                      <span>+ Thêm ảnh</span>
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() => setActiveFocusedQuestionId(null)}
                                      className="px-3 py-1 rounded text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1 cursor-pointer"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Hoàn tất</span>
                                    </button>
                                  </div>
                                </div>

                                <textarea
                                  rows={2}
                                  value={q.stemText}
                                  onChange={(e) =>
                                    handleUpdateStemText(q.id, e.target.value)
                                  }
                                  className="w-full px-3 py-2 text-left text-slate-900 bg-white border border-sky-300 rounded-lg focus:outline-none focus:border-blue-600 leading-relaxed"
                                />

                                {q.images && q.images.length > 0 && (
                                  <div className="flex flex-wrap gap-3">
                                    {q.images.map((img) => (
                                      <div
                                        key={img.id}
                                        className="relative p-2 rounded-lg bg-white border border-sky-200 flex flex-col items-center"
                                      >
                                        <img
                                          src={img.dataUrl}
                                          alt={img.caption || `Hình câu ${q.displayIndex}`}
                                          className="max-h-36 object-contain"
                                        />
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleRemoveImageFromQuestion(q.id, img.id)
                                          }
                                          className="mt-1 text-xs text-rose-600 hover:underline flex items-center gap-1 cursor-pointer"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                          <span>Xóa ảnh</span>
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {q.part === 'PART_1' && q.options && (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {q.options.map((opt) => (
                                      <div
                                        key={opt.id}
                                        className="p-2 rounded-lg bg-white border border-sky-200 flex flex-col gap-1.5"
                                      >
                                        <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleSelectSingleCorrectPart1(q.id, opt.id)
                                          }
                                          className={`w-7 h-7 rounded text-xs font-bold text-white shrink-0 cursor-pointer ${
                                            opt.isCorrect ? 'bg-rose-600' : 'bg-blue-600'
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
                                          className="flex-1 px-2 py-1 text-left bg-transparent border-b border-slate-200 focus:border-blue-600 focus:outline-none"
                                        />
                                        </div>
                                        {opt.images && opt.images.length > 0 && (
                                          <div className="flex flex-wrap items-center gap-2 pl-9">
                                            {opt.images.map((img) => (
                                              <img
                                                key={img.id}
                                                src={img.dataUrl}
                                                alt={
                                                  img.caption ||
                                                  `Hình phương án ${opt.currentLabel} — Câu ${q.displayIndex}`
                                                }
                                                className="max-h-16 object-contain rounded border border-slate-200 bg-white"
                                              />
                                            ))}
                                            <span className="text-[11px] italic text-slate-500">
                                              (Nội dung phương án nằm ở công thức/hình phía trên — ô chữ để trống là đúng, không phải lỗi)
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {q.part === 'PART_2' && q.subItems && (
                                  <div className="space-y-2">
                                    {q.subItems.map((sub) => (
                                      <div
                                        key={sub.id}
                                        className="p-2 rounded-lg bg-white border border-sky-200 flex flex-col gap-1.5"
                                      >
                                        <div className="flex items-center gap-2">
                                        <span className="font-bold w-5 shrink-0">
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
                                          className="flex-1 px-2 py-1 text-left bg-transparent border-b border-slate-200 focus:border-blue-600 focus:outline-none"
                                        />
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleToggleSubItemPart2(q.id, sub.id, true)
                                          }
                                          className={`px-2 py-1 rounded text-xs font-bold cursor-pointer ${
                                            sub.isTrue
                                              ? 'bg-emerald-600 text-white'
                                              : 'bg-slate-100 text-slate-600'
                                          }`}
                                        >
                                          Đúng
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleToggleSubItemPart2(q.id, sub.id, false)
                                          }
                                          className={`px-2 py-1 rounded text-xs font-bold cursor-pointer ${
                                            !sub.isTrue
                                              ? 'bg-rose-600 text-white'
                                              : 'bg-slate-100 text-slate-600'
                                          }`}
                                        >
                                          Sai
                                        </button>
                                        </div>
                                        {sub.images && sub.images.length > 0 && (
                                          <div className="flex flex-wrap items-center gap-2 pl-7">
                                            {sub.images.map((img) => (
                                              <img
                                                key={img.id}
                                                src={img.dataUrl}
                                                alt={
                                                  img.caption ||
                                                  `Hình ý ${sub.currentLabel} — Câu ${q.displayIndex}`
                                                }
                                                className="max-h-16 object-contain rounded border border-slate-200 bg-white"
                                              />
                                            ))}
                                            <span className="text-[11px] italic text-slate-500">
                                              (Nội dung ý nằm ở công thức/hình phía trên — ô chữ để trống là đúng, không phải lỗi)
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {q.part === 'PART_3' && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold">
                                      Đáp số (Tối đa 4 ký tự):
                                    </span>
                                    <input
                                      type="text"
                                      value={q.shortAnswer || ''}
                                      onChange={(e) =>
                                        handleUpdateShortAnswerPart3(q.id, e.target.value)
                                      }
                                      className="w-40 px-2.5 py-1 text-sm font-bold text-rose-700 bg-white border border-amber-400 rounded"
                                    />
                                  </div>
                                )}

                                {q.part === 'PART_4' && (
                                  <div className="space-y-1">
                                    <span className="block text-xs font-bold">
                                      Đáp án / Hướng dẫn chấm tự luận:
                                    </span>
                                    <textarea
                                      rows={2}
                                      value={q.essayAnswer ?? q.explanation ?? ''}
                                      onChange={(e) =>
                                        handleUpdateEssayAnswerPart4(q.id, e.target.value)
                                      }
                                      className="w-full px-3 py-1.5 text-left bg-white border border-purple-300 rounded-lg focus:outline-none"
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>

                  {/* Chân trang đề thi chuẩn */}
                  <div className="pt-4 border-t border-slate-300 text-center space-y-1">
                    <div className="font-bold">
                      -------------------- HẾT --------------------
                    </div>
                    <div className="text-center italic text-[11pt] text-slate-700">
                      (Thí sinh không được sử dụng tài liệu. Cán bộ coi thi không giải thích gì thêm)
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 2 (MỚI): CHẾ ĐỘ BIÊN SOẠN AI TẠO ĐỀ TƯƠNG ĐƯƠNG ĐỀ GỐC (ISOMORPHIC EXAM CLONING) ================= */}
          {activeRightTab === 'AI_CLONE_STUDIO' && (
            <div className="space-y-5">
              {/* Bảng Điều Khiển AI Gemini Studio: Quy trình 3 Bước & Sinh tuần tự 5 câu/đợt */}
              <div className="p-6 rounded-3xl card-3d-panel border-2 border-purple-300 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-purple-200 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <div className="p-2 rounded-xl btn-3d-purple text-white">
                        <Bot className="w-5 h-5" />
                      </div>
                      <h3 className="text-base sm:text-lg font-black text-purple-950 uppercase">
                        AI GEMINI STUDIO — TẠO ĐỀ TƯƠNG ĐƯƠNG CHUẨN 3 BƯỚC SƯ PHẠM (SINH 5 CÂU / ĐỢT)
                      </h3>
                    </div>
                    <p className="text-xs text-slate-700 font-semibold">
                      Sinh tuần tự từng đợt <strong>5 câu hỏi</strong> (hết 5 câu sinh tiếp 5 câu cho đến hết {questions.length} câu của đề gốc) — Không bịa số liệu, không sao chép đề gốc, không thêm từ vô nghĩa và không vượt ngoài giới hạn câu gốc.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-3 py-1.5 rounded-xl bg-purple-100 border-2 border-purple-400 text-purple-950 text-xs font-extrabold flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-purple-700" />
                      <span>
                        Tổng {questions.length} câu ({Math.max(1, Math.ceil(questions.length / AI_CLONE_BATCH_SIZE))} đợt × {AI_CLONE_BATCH_SIZE} câu)
                      </span>
                    </span>
                    <span className="px-3 py-1.5 rounded-xl bg-emerald-100 border-2 border-emerald-400 text-emerald-950 text-xs font-extrabold flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-700" />
                      <span>Chuẩn Khoa Học 100% · Zero-Trace</span>
                    </span>
                  </div>
                </div>

                {/* KHUNG QUY TRÌNH 3 BƯỚC ĐỒNG ĐẲNG SƯ PHẠM & KHOA HỌC */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  <div className="p-3.5 rounded-2xl bg-blue-50/90 border-2 border-blue-300 space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-lg bg-blue-700 text-white text-[11px] font-black uppercase">
                        Bước 1 · Cấu trúc &amp; Ma trận
                      </span>
                      <span className="text-[11px] font-mono font-bold text-blue-900">
                        {questions.length} câu giữ nguyên
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-900">
                      Bảo toàn cấu trúc &amp; ma trận nhận thức
                    </p>
                    <p className="text-[11px] text-slate-700 leading-relaxed">
                      Giữ nguyên số lượng câu từng phần (P.I: {part1Count}, P.II: {part2Count}, P.III: {part3Count}{part4Count > 0 ? `, Tự luận: ${part4Count}` : ''}) và phân bố mức độ tư duy (Biết: {bloomStats.NHAN_BIET} - Hiểu: {bloomStats.THONG_HIEU} - Vận dụng: {bloomStats.VAN_DUNG + bloomStats.VAN_DUNG_CAO}).
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-purple-50/90 border-2 border-purple-300 space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-lg bg-purple-700 text-white text-[11px] font-black uppercase">
                        Bước 2 · Cơ chế Khoa học
                      </span>
                      <span className="text-[11px] font-mono font-bold text-purple-900">
                        Đúng bản chất 100%
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-900">
                      Bảo toàn cơ chế khoa học &amp; dạng bài
                    </p>
                    <p className="text-[11px] text-slate-700 leading-relaxed">
                      Nếu câu gốc kiểm tra hiện tượng, cơ chế hoặc dạng toán nào thì câu mới kiểm tra đúng cơ chế/dạng tương đương bản chất 100%, tuyệt đối không diễn đạt ngoài giới hạn đề gốc.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-emerald-50/90 border-2 border-emerald-300 space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-lg bg-emerald-700 text-white text-[11px] font-black uppercase">
                        Bước 3 · Ngữ cảnh &amp; Số liệu
                      </span>
                      <span className="text-[11px] font-mono font-bold text-emerald-900">
                        Tính toán thật 100%
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-900">
                      Đổi mới hoàn toàn ngữ cảnh &amp; tham số
                    </p>
                    <p className="text-[11px] text-slate-700 leading-relaxed">
                      Toàn bộ tham số, bối cảnh thực tiễn đời sống được sáng tạo mới và giải toán kiểm chứng thực tế; không bịa số liệu, không chép đề gốc, không thêm từ sáo rỗng.
                    </p>
                  </div>
                </div>

                {/* THANH TIẾN TRÌNH SINH TUẦN TỰ TỪNG ĐỢT 5 CÂU HỎI */}
                {aiBatchProgress && (
                  <div className="p-4 rounded-2xl bg-slate-900 text-white border-2 border-purple-400 space-y-2.5 shadow-md">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 font-black text-amber-300 uppercase">
                        <Sparkles className="w-4 h-4 shrink-0" />
                        <span>
                          Tiến trình sinh từng đợt 5 câu — Đợt {aiBatchProgress.batchIndex}/{aiBatchProgress.totalBatches} (Câu {aiBatchProgress.batchStartQuestionNumber} → Câu {aiBatchProgress.batchEndQuestionNumber})
                        </span>
                      </div>
                      <span className="font-mono font-bold text-emerald-400">
                        Đã hoàn thành: {aiBatchProgress.completedQuestionsCount} / {aiBatchProgress.totalQuestionsCount} câu ({Math.round((aiBatchProgress.completedQuestionsCount / Math.max(1, aiBatchProgress.totalQuestionsCount)) * 100)}%)
                      </span>
                    </div>

                    <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden p-0.5">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-purple-500 via-sky-400 to-emerald-400 transition-all duration-300"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(
                              (aiBatchProgress.completedQuestionsCount /
                                Math.max(1, aiBatchProgress.totalQuestionsCount)) *
                                100
                            )
                          )}%`,
                        }}
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-200 font-medium">
                      <span>{aiBatchProgress.stepDescription}</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {Array.from(
                          { length: aiBatchProgress.totalBatches },
                          (_, bIdx) => {
                            const bNum = bIdx + 1;
                            const bStart = bIdx * AI_CLONE_BATCH_SIZE + 1;
                            const bEnd = Math.min(
                              (bIdx + 1) * AI_CLONE_BATCH_SIZE,
                              aiBatchProgress.totalQuestionsCount
                            );
                            const isDone =
                              aiBatchProgress.completedQuestionsCount >= bEnd;
                            const isCurrent = aiBatchProgress.batchIndex === bNum && !isDone;
                            return (
                              <span
                                key={`batch-pill-${bNum}`}
                                className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                                  isDone
                                    ? 'bg-emerald-600 text-white'
                                    : isCurrent
                                    ? 'bg-amber-400 text-slate-950 animate-pulse'
                                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                                }`}
                              >
                                Đợt {bNum} (C.{bStart}-{bEnd})
                              </span>
                            );
                          }
                        )}
                      </div>
                    </div>
                  </div>
                )}

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

                  {/* Khung cấu hình Số lượng Đề AI & Ô Mô Tả Chỉ Dẫn Riêng Của Giáo Viên */}
                  <div className="md:col-span-7 flex flex-col justify-between space-y-4 bg-purple-50/70 p-4 rounded-2xl border-2 border-purple-200">
                    {/* 1. NÚT TÙY CHỌN SỐ LƯỢNG ĐỀ AI CẦN SINH */}
                    <div className="p-3.5 rounded-2xl bg-white border-2 border-purple-300 shadow-xs space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-black text-purple-950 uppercase flex items-center gap-1.5">
                          <Layers className="w-4 h-4 text-purple-700" />
                          <span>1. Chọn Số Lượng Đề AI Cần Sinh (Mỗi Đề Sinh 5 Câu / Lượt):</span>
                        </span>
                        <span className="px-2.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 font-mono text-[11px] font-black">
                          {numAiExamsToGenerate === 1
                            ? '1 Đề · Sinh chuẩn từng 5 câu'
                            : `${numAiExamsToGenerate} Đề · Sinh tuần tự từng 5 câu`}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {([
                          { count: 1, label: '1 Đề AI', sub: 'Khuyên dùng (Nhanh)' },
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
                          2. Mô Tả / Chỉ Dẫn Thêm Của Giáo Viên Cho AI (Trong Phạm Vi Đề Gốc):
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
                        placeholder="Nhập chỉ dẫn để AI sinh đề theo ý Thầy/Cô (VD: Đổi số liệu chẵn dễ tính toán, đổi bối cảnh thực tế đời sống, giữ nguyên 100% cơ chế khoa học và giới hạn của đề gốc...)"
                        className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 bg-white border-2 border-purple-400 rounded-xl focus:outline-none focus:border-blue-600 leading-relaxed shadow-inner"
                      />

                      {/* Các nút gợi ý chỉ dẫn nhanh cho giáo viên bấm chọn */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-extrabold text-purple-900">
                          Gợi ý thêm nhanh:
                        </span>
                        {[
                          'Đổi số liệu chẵn dễ tính nhẩm',
                          'Đảo mệnh đề Đúng thành Sai & ngược lại',
                          'Đổi mới bối cảnh thực tiễn đời sống',
                          'Bảo toàn 100% cơ chế khoa học câu gốc',
                          'Không vượt ngoài giới hạn đề gốc',
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
                        type="button"
                        onClick={handleGenerateAiCloneExam}
                        disabled={isProcessing}
                        className="flex-1 py-3.5 px-4 rounded-xl text-xs sm:text-sm font-black text-white btn-3d-purple flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                        title="Tự động sinh lần lượt từng đợt 5 câu hỏi (hết 5 câu sinh tiếp 5 câu) cho đến hết toàn bộ đề gốc"
                      >
                        <RefreshCw
                          className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`}
                        />
                        <span>
                          {aiClonedVariants.length > 0
                            ? `Sinh Lại Tuần Tự 5 Câu/Đợt Cho Đến Hết Đề (${questions.length} Câu)`
                            : `Sinh Đề Tương Đương (5 Câu/Đợt × ${Math.max(1, Math.ceil(questions.length / AI_CLONE_BATCH_SIZE))} Đợt = ${questions.length} Câu)`}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={handleGenerateNextFiveQuestionsStep}
                        disabled={isProcessing}
                        className="py-3.5 px-4 rounded-xl text-xs sm:text-sm font-black text-white btn-3d-indigo flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                        title="Bấm mỗi lần để sinh đúng 5 câu hỏi tiếp theo theo thứ tự từ đầu đến cuối đề"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>
                          {manualBatchCursor > 0 && manualBatchCursor < questions.length
                            ? `Sinh Tiếp 5 Câu (Câu ${manualBatchCursor + 1} → ${Math.min(manualBatchCursor + AI_CLONE_BATCH_SIZE, questions.length)})`
                            : `Sinh Từng Đợt 5 Câu (Câu 1 → ${Math.min(AI_CLONE_BATCH_SIZE, questions.length)})`}
                        </span>
                      </button>

                      {clonedQuestions.length > 0 && (
                        <>
                          <button
                            type="button"
                            onClick={handleApplyAiCloneAsMaster}
                            className="py-3 px-3.5 rounded-xl text-xs font-black text-white btn-3d-emerald flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                          >
                            <ArrowRightLeft className="w-4 h-4" />
                            <span>Dùng Đề AI Này Làm Đề Gốc</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleDownloadAiCloneDocx}
                            className="py-3 px-3.5 rounded-xl text-xs font-black text-white btn-3d-primary flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                          >
                            <Download className="w-4 h-4" />
                            <span>Tải Đề AI Này (.docx)</span>
                          </button>

                          {aiClonedVariants.length > 1 && (
                            <button
                              type="button"
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
                    Sẵn sàng sinh đề tương đương theo từng đợt 5 câu từ {questions.length} câu hỏi gốc
                  </h4>
                  <p className="text-xs text-slate-600 max-w-lg mx-auto">
                    Nhấn nút <strong>[Sinh Đề Tương Đương (5 Câu/Đợt)]</strong> để AI tự động sinh lần lượt từng 5 câu cho đến hết đề gốc, hoặc nhấn <strong>[Sinh Từng Đợt 5 Câu]</strong> để kiểm duyệt từng lô 5 câu một.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* THANH CHỌN CÁC ĐỀ AI VỪA SINH */}
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
                        Đối Chiếu Song Song: Đề Gốc &amp; {aiClonedVariants[selectedAiVariantIdx]?.title || 'Đề Tương Đương'} ({clonedQuestions.length}/{questions.length} câu đã sinh)
                      </span>
                    </div>
                    <span className="text-xs font-mono text-emerald-400">
                      Engine: {lastAiEngineUsed}
                    </span>
                  </div>

                  {clonedQuestions.map((cq, idx) => {
                    const origQ = questions[idx] || cq;
                    const batchNum = Math.floor(idx / AI_CLONE_BATCH_SIZE) + 1;
                    const partLabel =
                      cq.part === 'PART_1'
                        ? 'Phần I (Trắc nghiệm 4 lựa chọn)'
                        : cq.part === 'PART_2'
                        ? 'Phần II (Đúng / Sai)'
                        : cq.part === 'PART_3'
                        ? 'Phần III (Trả lời ngắn)'
                        : `${essayRomanLabel} (Tự luận)`;
                    const bloomBadgeLabel =
                      cq.bloomLevel === 'NHAN_BIET'
                        ? 'Nhận biết'
                        : cq.bloomLevel === 'VAN_DUNG'
                        ? 'Vận dụng'
                        : cq.bloomLevel === 'VAN_DUNG_CAO'
                        ? 'Vận dụng cao'
                        : 'Thông hiểu';

                    return (
                      <div
                        key={cq.id}
                        className="p-5 rounded-2xl card-3d-panel space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-sky-200">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-3 py-1 rounded-lg text-xs font-black text-white btn-3d-purple font-mono">
                              {partLabel} — Câu {cq.displayIndex}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-sky-100 text-sky-900 border border-sky-300 font-mono">
                              Đợt {batchNum} (Câu {(batchNum - 1) * AI_CLONE_BATCH_SIZE + 1}→{Math.min(batchNum * AI_CLONE_BATCH_SIZE, questions.length)})
                            </span>
                            <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              Mức độ: {bloomBadgeLabel}
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
                              Bản Đề Gốc (Cơ chế &amp; Ma trận gốc):
                            </div>
                            <p className="text-left text-slate-800">
                              <strong>Câu {origQ.displayIndex}. </strong>
                              <ScientificContentRenderer text={origQ.stemText} inline />
                            </p>

                            {origQ.part === 'PART_1' && origQ.options && (
                              <div className="grid grid-cols-2 gap-1.5 pt-1 text-sm text-slate-900">
                                {origQ.options.map((o) => (
                                  <div key={o.id} className="text-left">
                                    <strong className="font-bold">
                                      <span
                                        className={
                                          o.isCorrect
                                            ? 'text-red-600 underline decoration-red-600 decoration-2 underline-offset-2 font-extrabold'
                                            : 'text-slate-950'
                                        }
                                      >
                                        {o.currentLabel}
                                      </span>
                                      <span className="text-slate-950">. </span>
                                    </strong>
                                    <ScientificContentRenderer text={o.text} inline />
                                    {o.images && o.images.length > 0 && (
                                      <span className="ml-1 inline-flex flex-wrap items-center gap-1 align-middle">
                                        {o.images.map((img) => (
                                          <img
                                            key={img.id}
                                            src={img.dataUrl}
                                            alt={img.caption || `Hình phương án ${o.currentLabel} — Câu ${origQ.displayIndex}`}
                                            className="inline-block max-h-14 object-contain rounded border border-slate-200 bg-white"
                                          />
                                        ))}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {origQ.part === 'PART_2' && origQ.subItems && (
                              <div className="space-y-1 pt-1 text-sm text-slate-900">
                                {origQ.subItems.map((s) => (
                                  <div key={s.id} className="text-left">
                                    <strong className="font-bold">
                                      <span
                                        className={
                                          s.isTrue
                                            ? 'text-red-600 underline decoration-red-600 decoration-2 underline-offset-2 font-extrabold'
                                            : 'text-slate-950'
                                        }
                                      >
                                        {s.currentLabel}
                                      </span>
                                      <span className="text-slate-950">) </span>
                                    </strong>
                                    <ScientificContentRenderer text={s.text} inline />{' '}
                                    {s.images && s.images.length > 0 && (
                                      <span className="ml-1 inline-flex flex-wrap items-center gap-1 align-middle">
                                        {s.images.map((img) => (
                                          <img
                                            key={img.id}
                                            src={img.dataUrl}
                                            alt={img.caption || `Hình ý ${s.currentLabel} — Câu ${origQ.displayIndex}`}
                                            className="inline-block max-h-14 object-contain rounded border border-slate-200 bg-white"
                                          />
                                        ))}
                                      </span>
                                    )}
                                    <span className={s.isTrue ? 'text-emerald-700 font-bold' : 'text-slate-600 font-semibold'}>
                                      ({s.isTrue ? 'Đúng' : 'Sai'})
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {origQ.part === 'PART_3' && (
                              <div className="pt-1 text-sm font-bold text-slate-700">
                                Đáp án gốc: {origQ.shortAnswer}
                              </div>
                            )}

                            {origQ.part === 'PART_4' && origQ.essayAnswer && (
                              <div className="pt-1 text-sm text-slate-700">
                                <strong>Hướng dẫn chấm gốc: </strong>
                                <ScientificContentRenderer text={origQ.essayAnswer} inline />
                              </div>
                            )}
                          </div>

                          {/* Cột phải: Câu hỏi tương đương do AI sinh */}
                          <div className="p-3.5 rounded-xl bg-purple-50/70 border-2 border-purple-300 space-y-2">
                            <div className="text-xs font-sans font-extrabold text-purple-900 uppercase flex items-center justify-between">
                              <span>Bản Đề Tương Đương (Đổi mới ngữ cảnh &amp; số liệu thực):</span>
                            </div>
                            <p className="text-left text-slate-950 font-medium">
                              <strong>Câu {cq.displayIndex}. </strong>
                              <ScientificContentRenderer text={cq.stemText} inline />
                            </p>

                            {cq.part === 'PART_1' && cq.options && (
                              <div className="grid grid-cols-2 gap-1.5 pt-1 text-sm text-slate-900">
                                {cq.options.map((o) => (
                                  <div key={o.id} className="text-left">
                                    <strong className="font-bold">
                                      <span
                                        className={
                                          o.isCorrect
                                            ? 'text-red-600 underline decoration-red-600 decoration-2 underline-offset-2 font-extrabold'
                                            : 'text-slate-950'
                                        }
                                      >
                                        {o.currentLabel}
                                      </span>
                                      <span className="text-slate-950">. </span>
                                    </strong>
                                    <ScientificContentRenderer text={o.text} inline />
                                    {o.images && o.images.length > 0 && (
                                      <span className="ml-1 inline-flex flex-wrap items-center gap-1 align-middle">
                                        {o.images.map((img) => (
                                          <img
                                            key={img.id}
                                            src={img.dataUrl}
                                            alt={img.caption || `Hình phương án ${o.currentLabel} — Câu ${cq.displayIndex}`}
                                            className="inline-block max-h-14 object-contain rounded border border-slate-200 bg-white"
                                          />
                                        ))}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {cq.part === 'PART_2' && cq.subItems && (
                              <div className="space-y-1 pt-1 text-sm text-slate-900">
                                {cq.subItems.map((s) => (
                                  <div key={s.id} className="text-left">
                                    <strong className="font-bold">
                                      <span
                                        className={
                                          s.isTrue
                                            ? 'text-red-600 underline decoration-red-600 decoration-2 underline-offset-2 font-extrabold'
                                            : 'text-slate-950'
                                        }
                                      >
                                        {s.currentLabel}
                                      </span>
                                      <span className="text-slate-950">) </span>
                                    </strong>
                                    <ScientificContentRenderer text={s.text} inline />{' '}
                                    {s.images && s.images.length > 0 && (
                                      <span className="ml-1 inline-flex flex-wrap items-center gap-1 align-middle">
                                        {s.images.map((img) => (
                                          <img
                                            key={img.id}
                                            src={img.dataUrl}
                                            alt={img.caption || `Hình ý ${s.currentLabel} — Câu ${cq.displayIndex}`}
                                            className="inline-block max-h-14 object-contain rounded border border-slate-200 bg-white"
                                          />
                                        ))}
                                      </span>
                                    )}
                                    <span className={s.isTrue ? 'text-emerald-700 font-bold' : 'text-slate-600 font-semibold'}>
                                      ({s.isTrue ? 'Đúng' : 'Sai'})
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {cq.part === 'PART_3' && (
                              <div className="pt-1 text-sm font-bold text-rose-600 underline">
                                Đáp án mới: {cq.shortAnswer}
                              </div>
                            )}

                            {cq.part === 'PART_4' && (
                              <div className="pt-1 text-sm text-rose-700">
                                <strong>Hướng dẫn chấm mới: </strong>
                                <ScientificContentRenderer
                                  text={cq.essayAnswer || cq.explanation || ''}
                                  inline
                                />
                              </div>
                            )}

                            {cq.explanation && cq.part !== 'PART_4' && (
                              <div className="pt-1.5 mt-1 border-t border-purple-200 text-xs text-slate-700 italic">
                                <strong>Giải thích / Cơ chế: </strong>
                                <ScientificContentRenderer text={cq.explanation} inline />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {manualBatchCursor > 0 && manualBatchCursor < questions.length && (
                    <div className="p-4 rounded-2xl bg-indigo-50 border-2 border-indigo-300 flex flex-wrap items-center justify-between gap-3">
                      <span className="text-xs font-bold text-indigo-950">
                        Đã sinh {manualBatchCursor}/{questions.length} câu hỏi. Còn {questions.length - manualBatchCursor} câu hỏi tiếp theo đang chờ sinh.
                      </span>
                      <button
                        type="button"
                        onClick={handleGenerateNextFiveQuestionsStep}
                        disabled={isProcessing}
                        className="px-4 py-2 rounded-xl text-xs font-black text-white btn-3d-indigo flex items-center gap-1.5 cursor-pointer"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>
                          Sinh Tiếp 5 Câu Tiếp Theo (Câu {manualBatchCursor + 1} → Câu {Math.min(manualBatchCursor + AI_CLONE_BATCH_SIZE, questions.length)})
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 3: MA TRẬN & BẢN ĐẶC TẢ ĐỀ KIỂM TRA (CÔNG VĂN 7991/BGDĐT-GDTrH) ================= */}
          {activeRightTab === 'BLOOM_MATRIX' && (
            <div className="p-6 rounded-3xl card-3d-panel space-y-6">
              {/* Header Tab 3 với Nút Tải Word CV 7991 */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-sky-200 pb-5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-200 text-sky-900 border border-sky-300">
                      Chuẩn Chương Trình GDPT 2018 · Công văn 7991/BGDĐT-GDTrH
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-sky-950 uppercase">
                    KHUNG MA TRẬN & BẢN ĐẶC TẢ ĐỀ KIỂM TRA ĐỊNH KỲ
                  </h3>
                  <p className="text-xs text-slate-600 font-semibold">
                    Đầy đủ Phụ lục 1 (Khung Ma Trận) & Phụ lục 2 (Bản Đặc Tả) chuẩn Sư phạm kèm bảng chữ ký Ban Giám Hiệu
                  </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  <button
                    type="button"
                    onClick={handleDownloadMatrixSpecDocx}
                    disabled={isProcessing}
                    className="px-4 py-2.5 rounded-xl text-xs font-black text-white btn-3d-emerald flex items-center gap-2 cursor-pointer shadow-md"
                    title="Xuất file Word (.docx) chuẩn cấu trúc Công văn 7991 gồm Phụ lục 1 và Phụ lục 2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Tải Word Ma Trận & Bản Đặc Tả (.docx)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRunShuffle}
                    disabled={isProcessing}
                    className="px-4 py-2.5 rounded-xl text-xs font-black text-white btn-3d-rose flex items-center gap-1.5 cursor-pointer"
                  >
                    <Shuffle className="w-4 h-4" />
                    <span>Trộn Đề ({config.numVariants} Mã)</span>
                  </button>
                </div>
              </div>

              {/* 4 Thẻ Tổng Quan Cấp Độ Nhận Thức Chuẩn CV 7991 (40% - 30% - 30%) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div className="p-4 rounded-2xl guide-card-3d-blue text-center space-y-1">
                  <div className="text-xs font-extrabold text-blue-900 uppercase">
                    1. Nhận biết (40% - 4.0đ)
                  </div>
                  <div className="text-2xl font-black text-blue-700 font-mono tabular-nums">
                    {bloomStats.NHAN_BIET} câu
                  </div>
                  <div className="text-[11px] font-bold text-slate-600 font-mono">
                    Điểm số: {matrixCv7991Data.summary.nhanBietScore.toFixed(1)} / 10.0đ ({matrixCv7991Data.summary.nhanBietPct}%)
                  </div>
                </div>

                <div className="p-4 rounded-2xl guide-card-3d-emerald text-center space-y-1">
                  <div className="text-xs font-extrabold text-emerald-900 uppercase">
                    2. Thông hiểu (30% - 3.0đ)
                  </div>
                  <div className="text-2xl font-black text-emerald-700 font-mono tabular-nums">
                    {bloomStats.THONG_HIEU} câu
                  </div>
                  <div className="text-[11px] font-bold text-slate-600 font-mono">
                    Điểm số: {matrixCv7991Data.summary.thongHieuScore.toFixed(1)} / 10.0đ ({matrixCv7991Data.summary.thongHieuPct}%)
                  </div>
                </div>

                <div className="p-4 rounded-2xl guide-card-3d-amber text-center space-y-1">
                  <div className="text-xs font-extrabold text-amber-900 uppercase">
                    3. Vận dụng (30% - 3.0đ)
                  </div>
                  <div className="text-2xl font-black text-amber-700 font-mono tabular-nums">
                    {bloomStats.VAN_DUNG + bloomStats.VAN_DUNG_CAO} câu
                  </div>
                  <div className="text-[11px] font-bold text-slate-600 font-mono">
                    Điểm số: {matrixCv7991Data.summary.vanDungScore.toFixed(1)} / 10.0đ ({matrixCv7991Data.summary.vanDungPct}%)
                  </div>
                </div>

                <div className="p-4 rounded-2xl guide-card-3d-rose text-center space-y-1">
                  <div className="text-xs font-extrabold text-rose-900 uppercase">
                    Tổng cộng toàn đề
                  </div>
                  <div className="text-2xl font-black text-rose-700 font-mono tabular-nums">
                    {questions.length} câu
                  </div>
                  <div className="text-[11px] font-bold text-slate-600 font-mono">
                    Phần I: {part1Count}c · Phần II: {part2Count}c · Phần III: {part3Count}c{part4Count > 0 ? ` · Phần IV: ${part4Count}c` : ''}
                  </div>
                </div>
              </div>

              {/* PHỤ LỤC 1: KHUNG MA TRẬN ĐỀ KIỂM TRA ĐỊNH KỲ (CÔNG VĂN 7991) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-6 rounded-full bg-blue-700" />
                    <h4 className="text-sm sm:text-base font-black text-slate-900 uppercase">
                      PHỤ LỤC 1: KHUNG MA TRẬN ĐỀ KIỂM TRA ĐỊNH KỲ (CÔNG VĂN 7991)
                    </h4>
                  </div>
                  <span className="text-xs font-mono font-bold text-blue-800 bg-blue-50 px-3 py-1 rounded-lg border border-blue-200">
                    Thời gian: {config.durationMinutes} phút · Thang điểm 10
                  </span>
                </div>

                <div className="overflow-x-auto rounded-2xl border-2 border-sky-300 bg-white shadow-xs">
                  <table className="w-full text-center border-collapse text-xs">
                    <thead>
                      <tr className="bg-sky-900 text-white font-extrabold uppercase">
                        <th rowSpan={3} className="py-2.5 px-2 border border-sky-700 w-10">TT</th>
                        <th rowSpan={3} className="py-2.5 px-3 border border-sky-700 w-36 text-left">Chủ đề</th>
                        <th rowSpan={3} className="py-2.5 px-3 border border-sky-700 w-44 text-left">Đơn vị kiến thức</th>
                        <th colSpan={part4Count > 0 ? 12 : 9} className="py-2 px-2 border border-sky-700">Mức độ đánh giá (Số lượng câu / lệnh)</th>
                        <th rowSpan={3} className="py-2.5 px-2 border border-sky-700 w-16">Tổng số</th>
                        <th rowSpan={3} className="py-2.5 px-2 border border-sky-700 w-16">Tỉ lệ %</th>
                      </tr>
                      <tr className="bg-sky-800 text-white font-bold text-[11px]">
                        <th colSpan={3} className="py-1 px-1 border border-sky-700">Phần I (Nhiều LC)</th>
                        <th colSpan={3} className="py-1 px-1 border border-sky-700">Phần II (Đúng/Sai)</th>
                        <th colSpan={3} className="py-1 px-1 border border-sky-700">Phần III (Trả lời ngắn)</th>
                        {part4Count > 0 && (
                          <th colSpan={3} className="py-1 px-1 border border-sky-700">Phần IV (Tự luận)</th>
                        )}
                      </tr>
                      <tr className="bg-sky-700 text-sky-100 font-bold text-[10px]">
                        <th className="py-1 px-1 border border-sky-600">NB</th>
                        <th className="py-1 px-1 border border-sky-600">TH</th>
                        <th className="py-1 px-1 border border-sky-600">VD</th>
                        <th className="py-1 px-1 border border-sky-600">NB</th>
                        <th className="py-1 px-1 border border-sky-600">TH</th>
                        <th className="py-1 px-1 border border-sky-600">VD</th>
                        <th className="py-1 px-1 border border-sky-600">NB</th>
                        <th className="py-1 px-1 border border-sky-600">TH</th>
                        <th className="py-1 px-1 border border-sky-600">VD</th>
                        {part4Count > 0 && (
                          <>
                            <th className="py-1 px-1 border border-sky-600">NB</th>
                            <th className="py-1 px-1 border border-sky-600">TH</th>
                            <th className="py-1 px-1 border border-sky-600">VD</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sky-100">
                      {matrixCv7991Data.matrixRows.map((row, idx) => (
                        <tr key={`matrix-row-${idx}`} className="hover:bg-sky-50/60 font-medium">
                          <td className="py-2 px-2 border border-sky-200 font-mono font-bold text-slate-800">{row.tt}</td>
                          <td className="py-2 px-3 border border-sky-200 text-left font-bold text-slate-900">{row.topic}</td>
                          <td className="py-2 px-3 border border-sky-200 text-left text-slate-700">{row.unit}</td>
                          <td className="py-2 px-1 border border-sky-200 font-mono font-semibold text-blue-900">{row.p1NhanBiet || '—'}</td>
                          <td className="py-2 px-1 border border-sky-200 font-mono font-semibold text-emerald-900">{row.p1ThongHieu || '—'}</td>
                          <td className="py-2 px-1 border border-sky-200 font-mono font-semibold text-amber-900">{row.p1VanDung || '—'}</td>
                          <td className="py-2 px-1 border border-sky-200 font-mono font-semibold text-blue-900">{row.p2NhanBiet || '—'}</td>
                          <td className="py-2 px-1 border border-sky-200 font-mono font-semibold text-emerald-900">{row.p2ThongHieu || '—'}</td>
                          <td className="py-2 px-1 border border-sky-200 font-mono font-semibold text-amber-900">{row.p2VanDung || '—'}</td>
                          <td className="py-2 px-1 border border-sky-200 font-mono font-semibold text-blue-900">{row.p3NhanBiet || '—'}</td>
                          <td className="py-2 px-1 border border-sky-200 font-mono font-semibold text-emerald-900">{row.p3ThongHieu || '—'}</td>
                          <td className="py-2 px-1 border border-sky-200 font-mono font-semibold text-amber-900">{row.p3VanDung || '—'}</td>
                          {part4Count > 0 && (
                            <>
                              <td className="py-2 px-1 border border-sky-200 font-mono font-semibold text-blue-900">{row.p4NhanBiet || '—'}</td>
                              <td className="py-2 px-1 border border-sky-200 font-mono font-semibold text-emerald-900">{row.p4ThongHieu || '—'}</td>
                              <td className="py-2 px-1 border border-sky-200 font-mono font-semibold text-amber-900">{row.p4VanDung || '—'}</td>
                            </>
                          )}
                          <td className="py-2 px-2 border border-sky-200 font-mono font-black text-rose-700">{row.totalQuestionsOrCommands}</td>
                          <td className="py-2 px-2 border border-sky-200 font-mono font-bold text-sky-950">{row.ratioPct}%</td>
                        </tr>
                      ))}
                      {/* Dòng Tổng cộng */}
                      <tr className="bg-sky-100 font-black text-slate-900">
                        <td colSpan={3} className="py-2.5 px-3 border border-sky-300 uppercase text-center">
                          Tổng số câu hỏi & Tỉ lệ điểm
                        </td>
                        <td className="py-2 px-1 border border-sky-300 font-mono text-blue-900">
                          {matrixCv7991Data.matrixRows.reduce((a, b) => a + b.p1NhanBiet, 0)}
                        </td>
                        <td className="py-2 px-1 border border-sky-300 font-mono text-emerald-900">
                          {matrixCv7991Data.matrixRows.reduce((a, b) => a + b.p1ThongHieu, 0)}
                        </td>
                        <td className="py-2 px-1 border border-sky-300 font-mono text-amber-900">
                          {matrixCv7991Data.matrixRows.reduce((a, b) => a + b.p1VanDung, 0)}
                        </td>
                        <td className="py-2 px-1 border border-sky-300 font-mono text-blue-900">
                          {matrixCv7991Data.matrixRows.reduce((a, b) => a + b.p2NhanBiet, 0)}
                        </td>
                        <td className="py-2 px-1 border border-sky-300 font-mono text-emerald-900">
                          {matrixCv7991Data.matrixRows.reduce((a, b) => a + b.p2ThongHieu, 0)}
                        </td>
                        <td className="py-2 px-1 border border-sky-300 font-mono text-amber-900">
                          {matrixCv7991Data.matrixRows.reduce((a, b) => a + b.p2VanDung, 0)}
                        </td>
                        <td className="py-2 px-1 border border-sky-300 font-mono text-blue-900">
                          {matrixCv7991Data.matrixRows.reduce((a, b) => a + b.p3NhanBiet, 0)}
                        </td>
                        <td className="py-2 px-1 border border-sky-300 font-mono text-emerald-900">
                          {matrixCv7991Data.matrixRows.reduce((a, b) => a + b.p3ThongHieu, 0)}
                        </td>
                        <td className="py-2 px-1 border border-sky-300 font-mono text-amber-900">
                          {matrixCv7991Data.matrixRows.reduce((a, b) => a + b.p3VanDung, 0)}
                        </td>
                        {part4Count > 0 && (
                          <>
                            <td className="py-2 px-1 border border-sky-300 font-mono text-blue-900">
                              {matrixCv7991Data.matrixRows.reduce((a, b) => a + b.p4NhanBiet, 0)}
                            </td>
                            <td className="py-2 px-1 border border-sky-300 font-mono text-emerald-900">
                              {matrixCv7991Data.matrixRows.reduce((a, b) => a + b.p4ThongHieu, 0)}
                            </td>
                            <td className="py-2 px-1 border border-sky-300 font-mono text-amber-900">
                              {matrixCv7991Data.matrixRows.reduce((a, b) => a + b.p4VanDung, 0)}
                            </td>
                          </>
                        )}
                        <td className="py-2 px-2 border border-sky-300 font-mono text-rose-700">
                          {matrixCv7991Data.matrixRows.reduce((a, b) => a + b.totalQuestionsOrCommands, 0)}
                        </td>
                        <td className="py-2 px-2 border border-sky-300 font-mono text-sky-950">
                          100%
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* PHỤ LỤC 2: BẢN ĐẶC TẢ ĐỀ KIỂM TRA ĐỊNH KỲ (CÔNG VĂN 7991) */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-6 rounded-full bg-emerald-700" />
                    <h4 className="text-sm sm:text-base font-black text-slate-900 uppercase">
                      PHỤ LỤC 2: BẢN ĐẶC TẢ ĐỀ KIỂM TRA ĐỊNH KỲ (CÔNG VĂN 7991)
                    </h4>
                  </div>
                  <span className="text-xs font-semibold text-slate-600">
                    Mô tả chi tiết Yêu cầu cần đạt và Vị trí câu hỏi tương ứng trong đề
                  </span>
                </div>

                <div className="overflow-x-auto rounded-2xl border-2 border-emerald-300 bg-white shadow-xs">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-emerald-900 text-white font-extrabold uppercase text-center">
                        <th className="py-2.5 px-2 border border-emerald-800 w-10">TT</th>
                        <th className="py-2.5 px-3 border border-emerald-800 w-36 text-left">Chủ đề</th>
                        <th className="py-2.5 px-3 border border-emerald-800 w-44 text-left">Đơn vị kiến thức</th>
                        <th className="py-2.5 px-4 border border-emerald-800 text-left">
                          Mức độ đánh giá / Yêu cầu cần đạt
                        </th>
                        <th className="py-2.5 px-2 border border-emerald-800 w-32">Số câu / lệnh</th>
                        <th className="py-2.5 px-3 border border-emerald-800 w-28 text-center">Cấp độ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-100">
                      {matrixCv7991Data.specRows.map((spec, idx) => (
                        <tr key={`spec-row-${idx}`} className="hover:bg-emerald-50/60">
                          <td className="py-2.5 px-2 border border-emerald-200 text-center font-mono font-bold text-slate-800 align-top">
                            {spec.tt}
                          </td>
                          <td className="py-2.5 px-3 border border-emerald-200 font-bold text-slate-900 align-top">
                            {spec.topic}
                          </td>
                          <td className="py-2.5 px-3 border border-emerald-200 text-slate-700 align-top font-semibold">
                            {spec.unit}
                          </td>
                          <td className="py-2.5 px-4 border border-emerald-200 text-slate-800 leading-relaxed align-top">
                            <div className="font-bold text-emerald-950 mb-1">
                              Mức độ: <span className="underline decoration-emerald-500">{spec.cognitiveLevel}</span>
                            </div>
                            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-700">
                              {spec.learningOutcomes.map((lo, lIdx) => (
                                <li key={lIdx}>{lo}</li>
                              ))}
                            </ul>
                          </td>
                          <td className="py-2.5 px-2 border border-emerald-200 text-center align-top font-mono font-bold text-emerald-950">
                            {spec.p1Count > 0 && <div>Phần I: {spec.p1Count} câu</div>}
                            {spec.p2CommandCount > 0 && <div>Phần II: {spec.p2CommandCount} lệnh</div>}
                            {spec.p3Count > 0 && <div>Phần III: {spec.p3Count} câu</div>}
                            {spec.p4Count > 0 && <div>Phần IV: {spec.p4Count} câu</div>}
                            {spec.p1Count === 0 && spec.p2CommandCount === 0 && spec.p3Count === 0 && spec.p4Count === 0 && <div>—</div>}
                          </td>
                          <td className="py-2.5 px-3 border border-emerald-200 text-center align-top font-mono font-bold text-rose-700">
                            {spec.cognitiveLevel}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* KHUNG CHỮ KÝ PHÊ DUYỆT CHUẨN SƯ PHẠM */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-5 rounded-2xl bg-white border-2 border-slate-300 text-center shadow-xs">
                <div className="space-y-1">
                  <div className="font-bold text-xs uppercase text-slate-900">
                    BAN GIÁM HIỆU DUYỆT
                  </div>
                  <div className="text-[11px] italic text-slate-500">
                    (Ký, ghi rõ họ tên và đóng dấu)
                  </div>
                  <div className="h-16" />
                </div>
                <div className="space-y-1">
                  <div className="font-bold text-xs uppercase text-slate-900">
                    TỔ TRƯỞNG CHUYÊN MÔN
                  </div>
                  <div className="text-[11px] italic text-slate-500">
                    (Ký và ghi rõ họ tên)
                  </div>
                  <div className="h-16" />
                </div>
                <div className="space-y-1.5">
                  <div className="font-bold text-xs uppercase text-slate-900">
                    GIÁO VIÊN RA ĐỀ
                  </div>
                  <div className="text-[11px] italic text-slate-500">
                    (Ký và ghi rõ họ tên)
                  </div>
                  <div className="h-8" />
                  {config.teacherName?.trim() ? (
                    <div
                      style={{ fontFamily: "'Times New Roman', Times, serif" }}
                      className="font-bold text-sm text-slate-950"
                    >
                      {config.teacherName}
                    </div>
                  ) : null}
                  <input
                    type="text"
                    value={config.teacherName || ''}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, teacherName: e.target.value }))
                    }
                    placeholder="Nhập họ và tên giáo viên ra đề..."
                    className="w-full max-w-[240px] mx-auto px-2.5 py-1 text-xs font-bold text-center text-blue-950 bg-sky-50 border border-sky-300 rounded-lg focus:outline-none focus:border-blue-600 focus:bg-white"
                  />
                </div>
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
                    disabled={isProcessing}
                    className="px-6 py-3 rounded-xl text-xs font-extrabold text-white btn-3d-primary inline-flex items-center gap-2"
                  >
                    <Shuffle className="w-4 h-4" />
                    <span>Trộn Đề & Sinh Bảng Đáp Án Chung Ngay</span>
                  </button>
                </div>
              ) : (
                <>
                  {/* BỘ 4 MÃ QR CHẤM THI TỔNG HỢP CHUẨN QUỐC GIA (1. QM 2025 — 2. TNMAKER — 3. AZOTA — 4. UNT DẠY HỌC) */}
                  {masterMultiQr && masterMultiQr.tripleQr && (
                    <div className="p-5 rounded-3xl guide-card-3d-purple border-2 border-purple-300 space-y-4 shadow-md">
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-purple-200">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <QrCode className="w-5 h-5 text-purple-700" />
                            <h4 className="text-base font-black text-purple-950 uppercase">
                              BỘ 4 MÃ QR CHUNG TÍCH HỢP CÁC MÃ ĐỀ ({shuffledVariants.slice(0, 8).length} MÃ ĐỀ: {shuffledVariants.slice(0, 8).map((v) => v.examCode).join(', ')})
                            </h4>
                            <span className="text-[10px] font-black uppercase bg-emerald-700 text-white px-2.5 py-0.5 rounded-md">
                              Quét 1 Lần Lên Hết Tất Cả Mã Đề (Tối Đa 8 Mã / 1 QR)
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 font-semibold">
                            Toàn bộ các mã đề đã được <strong>tích hợp chung vào 1 Mã QR duy nhất</strong> (tối ưu tối đa <strong>8 mã đề / 1 mã QR</strong> để camera điện thoại lấy nét cực nhạy trong 0.2 giây) cho <strong>1. QM 2025</strong>, <strong>2. TNMaker</strong>, <strong>3. Azota</strong> và <strong>4. UnT Dạy Học (untedu.com)</strong>. Thầy cô chỉ cần quét <strong>1 lần duy nhất</strong> là ứng dụng tự động nạp đầy đủ đáp án của tất cả các mã đề!
                          </p>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={handleDownloadQrZip}
                            className="px-3.5 py-2 rounded-xl text-xs font-black text-white btn-3d-purple flex items-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Tải Trọn Bộ 4 Mã QR + 4 File Excel (.zip)</span>
                          </button>
                        </div>
                      </div>

                      {/* LƯỚI 4 CỘT: 1. QM 2025 | 2. TNMAKER | 3. AZOTA | 4. UNT DẠY HỌC */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                          {
                            item: masterMultiQr.tripleQr.qm2025,
                            badgeText: '1. PHẦN MỀM QM 2025',
                            subTitle: 'Chuẩn App Chấm Thi QM 2025 (YoungMix)',
                            formatDesc: 'JSON 2D Array: [[101,"A",...,"D","S",...,28.125]]',
                            borderClass: 'border-amber-400 bg-amber-50/70',
                            headerBg: 'bg-amber-800 text-white',
                            btnClass: 'btn-3d-amber',
                            excelCode: 'QM2025' as const,
                          },
                          {
                            item: masterMultiQr.tripleQr.tnmaker,
                            badgeText: '2. PHẦN MỀM TNMAKER',
                            subTitle: 'Chuẩn App TNMaker 2025 (TLTN-BGD-2025)',
                            formatDesc: 'JSON Object: {"101":"ABCD...#ĐSĐĐ_...#2700_...","success":true,"type":5}',
                            borderClass: 'border-blue-400 bg-blue-50/70',
                            headerBg: 'bg-blue-800 text-white',
                            btnClass: 'btn-3d-primary',
                            excelCode: 'TNMAKER' as const,
                          },
                          {
                            item: masterMultiQr.tripleQr.azota,
                            badgeText: '3. PHẦN MỀM AZOTA',
                            subTitle: 'Chuẩn Hệ Sinh Thái Azota 2025',
                            formatDesc: 'JSON Azota: [["101","A",...,"Đ","S",...,"28,125"]]',
                            borderClass: 'border-emerald-400 bg-emerald-50/70',
                            headerBg: 'bg-emerald-800 text-white',
                            btnClass: 'btn-3d-emerald',
                            excelCode: 'AZOTA' as const,
                          },
                          {
                            item: masterMultiQr.tripleQr.unt,
                            badgeText: '4. UNT DẠY HỌC',
                            subTitle: 'Chuẩn App UnT Dạy Học (untedu.com)',
                            formatDesc: 'Multi-line: [Mã đề]\\n[P1]\\n[P2]\\n[P3_1|P3_2]',
                            borderClass: 'border-purple-400 bg-purple-50/70',
                            headerBg: 'bg-purple-900 text-white',
                            btnClass: 'btn-3d-purple',
                            excelCode: 'UNT' as const,
                          },
                        ].map((card) => (
                          <div
                            key={card.item.appId}
                            className={`rounded-2xl border-2 ${card.borderClass} overflow-hidden flex flex-col justify-between shadow-sm bg-white`}
                          >
                            <div className={`${card.headerBg} px-3 py-2 flex items-center justify-between`}>
                              <span className="font-black text-xs uppercase tracking-wide truncate">
                                {card.badgeText}
                              </span>
                              <span className="text-[10px] font-mono bg-white/20 px-2 py-0.5 rounded font-bold shrink-0 ml-1">
                                {shuffledVariants.length} mã đề
                              </span>
                            </div>

                            <div className="p-3 space-y-2.5 flex-1 flex flex-col items-center">
                              <div className="text-[11px] font-bold text-slate-700 text-center truncate w-full">
                                {card.subTitle}
                              </div>

                              <div className="p-2 bg-white rounded-xl border-2 border-slate-200 shadow-xs">
                                <img
                                  src={card.item.qrDataUrl}
                                  alt={card.badgeText}
                                  referrerPolicy="no-referrer"
                                  className="w-40 h-40 object-contain mx-auto"
                                />
                              </div>

                              <div className="w-full space-y-1">
                                <div className="flex items-center justify-between text-[10px] font-mono text-slate-600">
                                  <span className="font-bold truncate">{card.formatDesc}</span>
                                  <span className="shrink-0 ml-1 font-bold text-slate-800">
                                    {card.item.qrPayload.length} ký tự
                                  </span>
                                </div>
                                <div className="p-2 rounded-lg bg-slate-900 text-emerald-400 font-mono text-[10px] break-all leading-relaxed max-h-20 overflow-y-auto border border-slate-700 whitespace-pre-line">
                                  {card.item.qrPayload}
                                </div>
                              </div>

                              <div className="w-full grid grid-cols-3 gap-1 pt-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const link = document.createElement('a');
                                    link.href = card.item.qrDataUrl;
                                    link.download = buildStandardExportFileName(
                                      config,
                                      'png',
                                      `Mã QR ${card.excelCode}`
                                    );
                                    link.click();
                                  }}
                                  className={`px-1.5 py-1.5 rounded-lg text-[10px] font-extrabold text-white ${card.btnClass} flex items-center justify-center gap-1 cursor-pointer`}
                                  title="Tải ảnh PNG mã QR này"
                                >
                                  <Download className="w-3 h-3 shrink-0" />
                                  <span>Ảnh QR</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={async () => {
                                    const blob = await exportGradingExcelXlsx(
                                      shuffledVariants,
                                      card.excelCode
                                    );
                                    triggerBrowserDownload(
                                      blob,
                                      buildStandardExportFileName(
                                        config,
                                        'xlsx',
                                        `Excel ${card.excelCode}`
                                      )
                                    );
                                    setStatusBanner({
                                      type: 'SUCCESS',
                                      text: `Đã tải tệp Excel (.xlsx) đáp án chuẩn chính thức của ${card.badgeText}!`,
                                    });
                                  }}
                                  className="px-1.5 py-1.5 rounded-lg text-[10px] font-extrabold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 flex items-center justify-center gap-1 cursor-pointer"
                                  title="Tải file Excel (.xlsx) đáp án chuẩn của phần mềm này"
                                >
                                  <FileText className="w-3 h-3 shrink-0 text-emerald-700" />
                                  <span>.xlsx</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(card.item.qrPayload);
                                    setStatusBanner({
                                      type: 'SUCCESS',
                                      text: `Đã sao chép chuỗi mã hóa QR của ${card.badgeText}!`,
                                    });
                                  }}
                                  className="px-1.5 py-1.5 rounded-lg text-[10px] font-extrabold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 flex items-center justify-center gap-1 cursor-pointer"
                                  title="Sao chép chuỗi payload"
                                >
                                  <Key className="w-3 h-3 shrink-0 text-blue-700" />
                                  <span>Copy</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="text-[11px] text-slate-700 font-semibold bg-white/80 px-3.5 py-2 rounded-xl border border-purple-200">
                        💡 <strong>Cam kết hoạt động 100%:</strong> Cả 4 mã QR trên đều được biên dịch đúng từng ký tự theo thuật toán gốc của <strong>QM 2025</strong> (<code>[[101,"A",...,"D","S",...,28.125]]</code>), <strong>TNMaker</strong> (<code>{`{"101":"ABCD...#ĐSĐĐ_...#2700_...","success":true,"type":5}`}</code>), <strong>Azota</strong> (<code>[["101","A",...,"Đ","S",...,"28,125"]]</code>) và <strong>UnT Dạy Học</strong> (<code>{`[Mã đề]\\n[Phần 1]\\n[Phần 2]\\n[Phần 3_val1|val2...]`}</code>), đồng thời đã được nhúng đầy đủ cả 4 mã vào trang cuối của tệp Word Bảng Đáp Án Khảo Thí A4!
                      </div>
                    </div>
                  )}

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
                          Bảng đối chiếu ngang giúp tiết kiệm 70% diện tích, không rối mắt khi có nhiều mã đề (Times New Roman 12pt).
                        </p>
                      </div>

                      <div className="flex items-center gap-2.5 flex-wrap">
                        {/* Toggle 3 chế độ xem Bảng Ma Trận Đối Chiếu vs Bảng Khảo Thí A4 vs Thẻ 3 Cột Màu */}
                        <div className="flex items-center bg-sky-100 p-1 rounded-xl border border-sky-300">
                          <button
                            type="button"
                            onClick={() => setAnswerSheetViewMode('MA_TRAN_DOI_CHIEU')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                              answerSheetViewMode === 'MA_TRAN_DOI_CHIEU'
                                ? 'bg-blue-700 text-white shadow-xs'
                                : 'text-slate-700 hover:text-blue-900'
                            }`}
                          >
                            Ma Trận Đối Chiếu (Gọn Nhất)
                          </button>
                          <button
                            type="button"
                            onClick={() => setAnswerSheetViewMode('KHAO_THI_A4')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                              answerSheetViewMode === 'KHAO_THI_A4'
                                ? 'bg-blue-700 text-white shadow-xs'
                                : 'text-slate-700 hover:text-blue-900'
                            }`}
                          >
                            Bảng Khảo Thí A4 (Từng Đề)
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
                            Thẻ 3 Cột Màu
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={handleDownloadZipBundle}
                          disabled={isProcessing}
                          className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black text-white btn-3d-rose flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer shadow-sm"
                          title="Tải về .ZIP"
                        >
                          <FileArchive className="w-4 h-4" />
                          <span>Tải Về .ZIP</span>
                        </button>

                        <button
                          onClick={handleDownloadMasterAnswerSheetDocx}
                          className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black text-white btn-3d-purple flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
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

                    {/* NỘI DUNG BẢNG ĐÁP ÁN: MA TRẬN ĐỐI CHIẾU HOẶC KHẢO THÍ A4 HOẶC THẺ 3 CỘT MÀU */}
                    {answerSheetViewMode === 'MA_TRAN_DOI_CHIEU' ? (
                      renderCrossReferencingAnswerMatrix(shuffledVariants)
                    ) : answerSheetViewMode === 'KHAO_THI_A4' ? (
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
                                        PHẦN I ({v.answerKey.part1.length} câu 4 lựa chọn):
                                      </span>
                                      <span className="font-mono font-bold text-rose-600 tracking-wide">
                                        {p1Text}
                                      </span>
                                    </div>
                                    {/* Phần II */}
                                    <div className="leading-relaxed">
                                      <span className="font-bold text-emerald-900 mr-2">
                                        PHẦN II ({v.answerKey.part2.length} câu Đúng / Sai):
                                      </span>
                                      <span className="font-mono font-semibold text-slate-900">
                                        {p2Text}
                                      </span>
                                    </div>
                                    {/* Phần III */}
                                    {v.answerKey.part3.length > 0 && (
                                      <div className="leading-relaxed">
                                        <span className="font-bold text-amber-900 mr-2">
                                          PHẦN III ({v.answerKey.part3.length} câu Trả lời ngắn):
                                        </span>
                                        <span className="font-mono font-bold text-rose-600 tracking-wide">
                                          {p3Text}
                                        </span>
                                      </div>
                                    )}
                                    {/* Phần Tự luận (Phần III nếu không có trả lời ngắn, hoặc Phần IV nếu có trả lời ngắn) */}
                                    {v.answerKey.part4 && v.answerKey.part4.length > 0 && (
                                      <div className="leading-relaxed pt-1 border-t border-dashed border-sky-200 space-y-1">
                                        <div className="font-bold text-purple-900">
                                          {v.answerKey.part3.length === 0 ? 'PHẦN III' : 'PHẦN IV'}. TỰ LUẬN:
                                        </div>
                                        {v.answerKey.part4.map((item) => (
                                          <div
                                            key={`khao-thi-p4-${v.examCode}-${item.questionNumber}`}
                                            className="pl-2 text-slate-900"
                                          >
                                            <div>
                                              <strong className="font-bold">Câu {item.questionNumber}. </strong>
                                              <ScientificContentRenderer text={item.questionText} inline />
                                            </div>
                                            {item.hasExplicitAnswer && item.answer ? (
                                              <div className="text-rose-700 font-semibold pl-3">
                                                → Hướng dẫn chấm: <ScientificContentRenderer text={item.answer} inline />
                                              </div>
                                            ) : null}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>

                        {/* Phần cuối đáp án ghi: Người ra đề ( Ký và ghi rõ họ và tên) + Ô điền tên Giáo viên */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t-2 border-sky-300 text-slate-800 bg-slate-50/70 px-6">
                          <div className="text-xs font-sans text-slate-600 font-semibold text-left space-y-1 max-w-md">
                            <div className="font-extrabold text-sky-950 uppercase flex items-center gap-1.5">
                              <Edit3 className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                              <span>Điền tên Giáo viên ra đề vào cuối trang đáp án:</span>
                            </div>
                            <p className="text-[11px] text-slate-500">
                              Họ và tên giáo viên nhập tại đây sẽ tự động in đậm ở phần chữ ký cuối trang đáp án khi xuất file Word.
                            </p>
                          </div>
                          <div className="min-w-[270px] sm:min-w-[300px] p-3.5 rounded-2xl bg-white border border-sky-200 text-center space-y-1.5 shadow-2xs">
                            <div className="font-bold text-base text-slate-950">
                              Người ra đề
                            </div>
                            <div className="text-xs italic text-slate-600">
                              ( Ký và ghi rõ họ và tên)
                            </div>
                            <div className="h-8" />
                            {config.teacherName?.trim() ? (
                              <div className="font-bold text-base text-slate-950 pb-1">
                                {config.teacherName}
                              </div>
                            ) : null}
                            <input
                              type="text"
                              value={config.teacherName || ''}
                              onChange={(e) =>
                                setConfig((prev) => ({
                                  ...prev,
                                  teacherName: e.target.value,
                                }))
                              }
                              placeholder="Nhập họ và tên giáo viên ra đề..."
                              className="w-full px-3 py-1.5 text-xs font-sans font-bold text-center text-blue-950 bg-sky-50/70 border-2 border-sky-400 rounded-xl focus:outline-none focus:border-blue-600 focus:bg-white"
                            />
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

                  {/* THANH CHỌN MÃ ĐỀ ĐỂ XEM BẢN DÀN TRANG ĐỀ THI WORD */}
                  <div className="p-4 rounded-2xl toolbar-3d flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-xs font-extrabold text-sky-950 mr-1">
                        Xem trước Đề thi của:
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
                      {/* Xem trước nội dung Đề thi đã hoán vị */}
                      <div className="p-6 rounded-2xl card-3d-panel space-y-5">
                        <div className="flex items-center justify-between border-b-2 border-sky-200 pb-3 flex-wrap gap-2">
                          <h3 className="text-sm font-black text-sky-950 uppercase">
                            Xem Trước Đề Thi — Mã Đề {activeVariant.examCode}
                          </h3>
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

                          <div className="flex items-center justify-end gap-3 py-1.5 border-b border-slate-200">
                            <div className="px-3 py-0.5 border-2 border-slate-900 font-bold shrink-0 whitespace-nowrap">
                              MÃ ĐỀ THI: {activeVariant.examCode}
                            </div>
                          </div>

                          {/* HIỂN THỊ TRỰC QUAN ẢNH PHIẾU TRẢ LỜI TRẮC NGHIỆM ĐANG CHỌN NGAY DƯỚI HEADER TRANG 1 */}
                          {config.embedPhieuQM2025 !== false && (
                            <div className="py-2.5 px-2 flex flex-col items-center justify-center border-b-2 border-dashed border-slate-300 bg-slate-50/50 rounded-xl">
                              <img
                                src={resolvedPhieuPreviewUrl}
                                alt={`Phiếu trả lời trắc nghiệm - ${activePhieuQMInfo.groupName}`}
                                className="w-full max-w-[624px] h-auto object-contain border border-slate-300 rounded-lg shadow-xs bg-white cursor-pointer hover:shadow-md transition-shadow"
                                onClick={() =>
                                  setPreviewModalImage({
                                    src: resolvedPhieuPreviewUrl,
                                    caption: `Phiếu trả lời (${activePhieuQMInfo.standardFileName}) — ${activePhieuQMInfo.groupName}`,
                                  })
                                }
                              />
                            </div>
                          )}

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
                                      {vq.part === 'PART_4' &&
                                        `${
                                          activeVariant.questions.some((x) => x.part === 'PART_3')
                                            ? 'PHẦN IV'
                                            : 'PHẦN III'
                                        }. Tự luận.`}
                                    </div>
                                  )}

                                  <div className="space-y-2 leading-relaxed text-left">
                                    <p className="text-left leading-relaxed">
                                      <strong className="font-bold">
                                        Câu {vq.displayIndex}.{' '}
                                      </strong>
                                      <ScientificContentRenderer text={vq.stemText} inline />
                                    </p>

                                    {/* Bảng dữ liệu thuộc phần dẫn câu hỏi */}
                                    {vq.stemTables && vq.stemTables.length > 0 && (
                                      <div className="my-2 space-y-2">
                                        {vq.stemTables.map((tbl) => (
                                          <div
                                            key={tbl.id}
                                            className="overflow-x-auto rounded-lg border border-slate-300"
                                          >
                                            <table
                                              className="w-full border-collapse text-xs text-slate-900"
                                              style={{ fontFamily: "'Times New Roman', Times, serif" }}
                                            >
                                              <tbody>
                                                {tbl.rows.map((row, rIdx) => (
                                                  <tr
                                                    key={`${tbl.id}-r-${rIdx}`}
                                                    className={rIdx === 0 ? 'bg-slate-100 font-bold' : 'bg-white'}
                                                  >
                                                    {row.map((cell, cIdx) =>
                                                      cell.vMergeContinue ? null : (
                                                        <td
                                                          key={`${tbl.id}-c-${rIdx}-${cIdx}`}
                                                          colSpan={cell.colSpan || 1}
                                                          rowSpan={cell.rowSpan || 1}
                                                          className={`border border-slate-300 px-2.5 py-1.5 ${
                                                            cell.align === 'center'
                                                              ? 'text-center'
                                                              : cell.align === 'right'
                                                              ? 'text-right'
                                                              : 'text-left'
                                                          } ${cell.isBold || rIdx === 0 ? 'font-bold' : ''}`}
                                                        >
                                                          <ScientificContentRenderer text={cell.text} inline />
                                                        </td>
                                                      )
                                                    )}
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {/* Hình ảnh đính kèm */}
                                    {vq.images && vq.images.length > 0 && (
                                      <div className="my-3 flex flex-col items-center justify-center gap-2">
                                        {vq.images.map((img, imgIdx) => (
                                          <img
                                            key={img.id || `${vq.id}-img-${imgIdx}`}
                                            src={img.dataUrl}
                                            alt={img.caption || `Hình minh họa câu ${vq.displayIndex}`}
                                            className="max-h-56 max-w-full object-contain rounded-lg cursor-pointer hover:shadow-md transition-shadow bg-white"
                                            onClick={() =>
                                              setPreviewModalImage({
                                                src: img.dataUrl,
                                                caption: `Mã đề ${activeVariant.examCode} — Câu ${vq.displayIndex}`,
                                              })
                                            }
                                          />
                                        ))}
                                      </div>
                                    )}

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
                                            <ScientificContentRenderer
                                              text={o.text}
                                              inline
                                              isCorrect={false}
                                              isUnderline={false}
                                              isRed={false}
                                            />
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
                                            <ScientificContentRenderer
                                              text={s.text}
                                              inline
                                              isCorrect={false}
                                              isUnderline={false}
                                              isRed={false}
                                            />
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
                          <div className="text-center italic text-[11pt] text-slate-700 pb-2">
                            (Thí sinh không được sử dụng tài liệu. Cán bộ coi thi không giải thích gì thêm)
                          </div>

                          <div className="pt-2.5 mt-3 border-t border-slate-500 flex items-center justify-between text-[11pt] italic text-slate-900">
                            <span>
                              Môn: {formatPedagogicalSubject(config.subjectName)} — Lớp: {(config.gradeLevel || '12').replace(/^lớp\s+/i, '').trim() || '12'} — Mã đề: <strong className="font-bold">{activeVariant.examCode}</strong>
                            </span>
                            <span className="shrink-0 ml-4">
                              Trang <strong className="font-bold">1</strong> / <strong className="font-bold">2</strong>
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
        </div>
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

      {/* Modal Kho 13 Mẫu Phiếu Trả Lời Trắc Nghiệm QM 2025, UnT & Tải Phiếu Tùy Chọn */}
      {isPhieuQmGalleryOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setIsPhieuQmGalleryOpen(false)}
        >
          <div
            className="w-full max-w-5xl bg-white rounded-3xl border-4 border-amber-400 p-5 sm:p-6 shadow-2xl space-y-4 my-auto max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b-2 border-amber-200">
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 uppercase">
                  KHO 13 MẪU PHIẾU TRẢ LỜI TRẮC NGHIỆM CHUẨN (BGD &amp; UNT LABS) &amp; TÙY CHỌN NHÚNG VÀO ĐỀ TRỘN (.DOCX)
                </h3>
                <p className="text-xs font-semibold text-slate-600">
                  Mặc định tự động chọn theo môn học hoặc giáo viên bấm chọn bất kỳ mẫu phiếu nào (kể cả 4 mẫu UnT Labs mới) bên dưới để đưa vào tất cả các đề trộn Word (.docx)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setConfig((prev) => ({
                      ...prev,
                      embedPhieuQM2025: true,
                      selectedPhieuQMCode: 'AUTO',
                    }));
                    setStatusBanner({
                      type: 'SUCCESS',
                      text: `Đã đặt về chế độ Mặc định tự động theo môn học (${getPhieuQMInfoBySubject(config.subjectName).groupName}).`,
                    });
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-extrabold text-white btn-3d-primary cursor-pointer"
                >
                  Đặt Mặc Định Theo Môn
                </button>
                <button
                  type="button"
                  onClick={() => phieuUploadInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-xl text-xs font-extrabold text-white btn-3d-emerald cursor-pointer flex items-center gap-1"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Tải Phiếu Riêng (.jpg/.pdf)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPhieuQmGalleryOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-extrabold text-white btn-3d-rose cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border-2 border-amber-300">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-amber-900 text-white font-bold">
                    <th className="py-2.5 px-3 border-r border-amber-700">Tên mẫu phiếu</th>
                    <th className="py-2.5 px-3 border-r border-amber-700">Môn / Kỳ kiểm tra áp dụng</th>
                    <th className="py-2.5 px-3 border-r border-amber-700">Cấu trúc câu hỏi trên phiếu</th>
                    <th className="py-2.5 px-3 text-center">Tác vụ chọn</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-200">
                  {ALL_PHIEU_QM_2025_TEMPLATES.map((tpl) => {
                    const isCurrent =
                      tpl.standardFileName === activePhieuQMInfo.standardFileName &&
                      config.selectedPhieuQMCode !== 'CUSTOM';
                    return (
                      <tr
                        key={tpl.groupCode}
                        className={isCurrent ? 'bg-emerald-50 font-bold' : 'bg-white hover:bg-amber-50/50'}
                      >
                        <td className="py-2 px-3 border-r border-amber-200 font-black text-slate-900">
                          {tpl.groupName}
                          {isCurrent && (
                            <span className="ml-2 px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px]">
                              Đang áp dụng
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 border-r border-amber-200 text-slate-800">
                          {tpl.subjectsLabel}
                        </td>
                        <td className="py-2 px-3 border-r border-amber-200 text-blue-900 font-semibold">
                          {tpl.structureDesc}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setConfig((prev) => ({
                                ...prev,
                                embedPhieuQM2025: true,
                                selectedPhieuQMCode: tpl.groupCode,
                              }));
                              setStatusBanner({
                                type: 'SUCCESS',
                                text: `Đã chọn mẫu phiếu "${tpl.groupName}" (${tpl.structureDesc}) để đưa vào tất cả các mã đề trộn!`,
                              });
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-black cursor-pointer ${
                              isCurrent
                                ? 'bg-emerald-600 text-white'
                                : 'bg-amber-500 hover:bg-amber-600 text-white'
                            }`}
                          >
                            {isCurrent ? '✓ Đang dùng' : 'Chọn phiếu này'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ALL_PHIEU_QM_2025_TEMPLATES.map((tpl) => {
                const isCurrent =
                  tpl.standardFileName === activePhieuQMInfo.standardFileName &&
                  config.selectedPhieuQMCode !== 'CUSTOM';
                const previewSrc = tpl.isPdfSource
                  ? galleryPdfPreviews[tpl.groupCode] || tpl.fallbackUrl
                  : tpl.publicUrl;
                return (
                  <div
                    key={`card-${tpl.groupCode}`}
                    className={`p-3.5 rounded-2xl border-2 space-y-2 flex flex-col justify-between ${
                      isCurrent
                        ? 'border-emerald-500 bg-emerald-50/50 shadow-md'
                        : 'border-slate-200 bg-slate-50/70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-black text-slate-900 uppercase">
                          {tpl.groupName}
                        </div>
                        <div className="text-[11px] font-semibold text-slate-600">
                          {tpl.structureDesc}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setConfig((prev) => ({
                            ...prev,
                            embedPhieuQM2025: true,
                            selectedPhieuQMCode: tpl.groupCode,
                          }));
                          setIsPhieuQmGalleryOpen(false);
                          setStatusBanner({
                            type: 'SUCCESS',
                            text: `Đã áp dụng "${tpl.groupName}" vào đề trộn!`,
                          });
                        }}
                        className={`px-3 py-1 rounded-xl text-[11px] font-black cursor-pointer shrink-0 ${
                          isCurrent
                            ? 'bg-emerald-600 text-white'
                            : 'btn-3d-amber text-white'
                        }`}
                      >
                        {isCurrent ? '✓ Đang Chọn' : 'Chọn Dùng Phiếu Này'}
                      </button>
                    </div>
                    <img
                      src={previewSrc}
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (target.src !== tpl.fallbackUrl) {
                          target.src = tpl.fallbackUrl;
                        }
                      }}
                      alt={tpl.groupName}
                      className="w-full max-h-64 object-contain rounded-xl border border-slate-300 bg-white cursor-pointer hover:shadow-md"
                      onClick={() =>
                        setPreviewModalImage({
                          src: previewSrc,
                          caption: `${tpl.groupName} (${tpl.standardFileName}) — ${tpl.structureDesc}`,
                        })
                      }
                    />
                  </div>
                );
              })}
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

      {/* Modal VietQR Động Mời Thầy Khải Ly Cà Phê */}
      <BuyCoffeeModal
        isOpen={isCoffeeModalOpen}
        onClose={() => setIsCoffeeModalOpen(false)}
      />

      {/* Hộp thoại Xác thực & Đăng nhập Giáo viên 3D (Đồng bộ Google Apps Script QuanLy_TronDe) */}
      <TeacherAuthGateModal
        isOpen={isAuthGateModalOpen}
        currentUser={currentTeacherUser}
        onCloseIfAuthenticated={() => setIsAuthGateModalOpen(false)}
        onAuthenticated={(user) => {
          setCurrentTeacherUser(user);
          setIsAuthGateModalOpen(false);
          setConfig((prev) => ({
            ...prev,
            schoolName: user.school
              ? user.school.toUpperCase().startsWith('TRƯỜNG')
                ? user.school.toUpperCase()
                : `TRƯỜNG ${user.school.toUpperCase()}`
              : prev.schoolName,
            teacherName: prev.teacherName?.trim() ? prev.teacherName : user.name,
          }));
          setStatusBanner({
            type: 'SUCCESS',
            text: `Chào mừng Thầy/Cô ${user.name} (${user.school}) đã đăng nhập hệ thống EduMix Pro2025!`,
          });
        }}
      />

      {/* ================= CHÂN TRANG SIÊU GỌN CHỈ GỒM 1 HÀNG DUY NHẤT (CHIẾM DIỆN TÍCH NHỎ NHẤT CÓ THỂ) ================= */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 footer-fixed-3d px-2.5 py-1 text-white">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-2 overflow-x-auto whitespace-nowrap text-[11px] leading-tight">
          {/* Cụm Trái: Logo 3D + Tên trang web EduMix 2025 */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-5 h-5 rounded-md logo-3d-badge animate-logo-blink flex items-center justify-center text-white shrink-0">
              <GraduationCap className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs sm:text-sm font-black tracking-tight animate-edumix-gradient">
              EduMix 2025
            </span>
          </div>

          {/* Cụm Giữa: Toàn bộ thông tin tác giả & lời cảm ơn nằm gọn trên cùng 1 hàng */}
          <div className="flex items-center justify-center gap-1.5 shrink-0">
            <span className="font-bold text-slate-200 hidden sm:inline">
              Liên hệ &amp; góp ý:
            </span>

            <span className="px-2 py-0.5 rounded-md font-black footer-pill-red inline-flex items-center gap-1">
              <span role="img" aria-label="author">👨‍🏫</span>
              <span>Hồ Tấn Khải</span>
            </span>

            <span className="px-2 py-0.5 rounded-md font-extrabold footer-pill-blue inline-flex items-center gap-1">
              <span role="img" aria-label="school">🏫</span>
              <span>Trường THPT Mang Thít</span>
            </span>

            <a
              href="mailto:khaibcmt@gmail.com"
              className="px-2 py-0.5 rounded-md font-extrabold footer-pill-amber inline-flex items-center gap-1"
              title="Gửi email góp ý tới tác giả Hồ Tấn Khải"
            >
              <span role="img" aria-label="email">✉️</span>
              <span>khaibcmt@gmail.com</span>
            </a>

            <a
              href="https://zalo.me/0939580982"
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 py-0.5 rounded-md font-extrabold footer-pill-emerald inline-flex items-center gap-1"
              title="Nhắn tin qua Zalo 0939580982"
            >
              <span role="img" aria-label="zalo">💬</span>
              <span>Zalo: 0939580982</span>
            </a>

            <span className="font-extrabold footer-thanks-glow hidden 2xl:inline ml-1">
              • Cảm ơn quý đồng nghiệp đã góp ý!
            </span>
          </div>

          {/* Cụm Phải: Nút "☕ Mời Thầy Khải Ly Cà Phê" siêu gọn cùng nằm trên 1 hàng chân trang */}
          <div className="shrink-0 flex items-center">
            <FloatingCoffeeButton onClick={() => setIsCoffeeModalOpen(true)} />
          </div>
        </div>
      </footer>
    </div>
  );
}
