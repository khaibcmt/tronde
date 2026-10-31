import React, { useMemo, useRef, useState } from 'react';
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
  exportGradingExcelXlsx,
  generateMasterMultiQrCode,
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
  triggerBrowserDownload,
} from './utils/docxExporter';
import { buildCV7991MatrixAndSpecification } from './utils/matrixSpecCv7991';
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
import { GeminiApiKeyModal } from './components/GeminiApiKeyModal';
import { BuyCoffeeModal, FloatingCoffeeButton } from './components/BuyCoffeeModal';
import { ScientificContentRenderer } from './components/ScientificContentRenderer';

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

  // 2. State cấu hình Trộn đề, Tiêu đề Quốc ngữ, Môn thi (SINH HỌC 12 - KIỂM TRA CUỐI KÌ I), Số phút (50 phút) & Mã QR
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
    includeSolutionsInExport: false,
    departmentName: 'SỞ GD&ĐT VĨNH LONG',
    schoolName: 'TRƯỜNG THPT MANG THÍT',
    nationalHeader: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',
    nationalMotto: 'Độc lập - Tự do - Hạnh phúc',
    examTitle: 'KIỂM TRA CUỐI KÌ I',
    examSubtitle: 'ĐỀ KIỂM TRA ĐỊNH KỲ CHUẨN CẤU TRÚC 2025',
    subjectName: 'SINH HỌC',
    gradeLevel: 'Lớp 12',
    schoolYear: `Năm học ${new Date().getFullYear()} - ${new Date().getFullYear() + 1}`,
    durationMinutes: 50,
  });
  const [isConfigCollapsed, setIsConfigCollapsed] = useState<boolean>(false);
  const [showCustomCodeEditor, setShowCustomCodeEditor] = useState<boolean>(false);
  const [isPhieuQmGalleryOpen, setIsPhieuQmGalleryOpen] = useState<boolean>(false);

  const activePhieuQMInfo = useMemo(
    () => getPhieuQMInfoBySubject(config.subjectName),
    [config.subjectName]
  );

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
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState<boolean>(false);
  const [isCoffeeModalOpen, setIsCoffeeModalOpen] = useState<boolean>(false);
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

  // Thống kê số lượng câu theo từng phần (Phần I, II, III)
  const part1Count = questions.filter((q) => q.part === 'PART_1').length;
  const part2Count = questions.filter((q) => q.part === 'PART_2').length;
  const part3Count = questions.filter((q) => q.part === 'PART_3').length;

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

        setFileName(file.name);
        setQuestions(parsed);
        setWordRawDocumentText(serializeQuestionsToWordRawText(parsed));
        setHasUnsavedChanges(false);
        setShuffledVariants([]);
        setClonedQuestions([]);
        setAiClonedVariants([]);
        setActiveRightTab('LIVE_EDITOR');
        setFilterPart('ALL');
        setLastSavedAt(new Date().toLocaleTimeString('vi-VN'));
        setStatusBanner({
          type: 'SUCCESS',
          text: `Đã phân tích & chuẩn hóa tự động tệp "${file.name}" (${parsed.length} câu hỏi chuẩn 4 đáp án${
            totalImages > 0 ? `, ${totalImages} sơ đồ/đồ thị 300 DPI` : ''
          }${totalTables > 0 ? `, ${totalTables} bảng dữ liệu` : ''}${
            formulaCount > 0 ? `, ${formulaCount} câu có công thức OMML/LaTeX` : ''
          }).`,
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
      examTitle: 'KIỂM TRA CUỐI KÌ I',
      examSubtitle: 'ĐỀ KIỂM TRA ĐỊNH KỲ CHUẨN CẤU TRÚC 2025',
      subjectName: 'SINH HỌC',
      gradeLevel: 'Lớp 12',
      durationMinutes: 50,
    }));
    setFileName('De_Kiem_Tra_Cuoi_Hoc_Ki_1_Sinh_Hoc_12_Chuan_2025.docx');
    setHasUnsavedChanges(false);
    setLastSavedAt(new Date().toLocaleTimeString('vi-VN'));
    setStatusBanner({
      type: 'SUCCESS',
      text: 'Đã nạp Đề Kiểm Tra Cuối Học Kì 1 — Môn Sinh Học 12 (Tỉ lệ 18 - 4 - 6 = 28 câu, tích hợp sơ đồ DNA, Operon Lac, Sơ đồ Phả hệ, bài tập DNA-RNA-Protein, lai Mendel, liên kết giới tính, di truyền học người & chọn giống, chuẩn 100% không lỗi)!',
    });
  };

  // Đồng bộ từ trình soạn thảo trang giấy Word A4 sang danh sách câu hỏi chuẩn 4 đáp án & Tự luận
  const handleSyncFromWordA4Editor = () => {
    const rawFromWord = parseRawTextToExamQuestions(
      wordRawDocumentText,
      config.resetNumberingPerPart
    );
    const parsedFromWord = normalizeAllQuestionsStrictFourOptions(
      rawFromWord,
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
      text: `Đã đồng bộ thành công ${parsedFromWord.length} câu hỏi từ Môi trường Word A4 (Gồm Trắc nghiệm & Tự luận)!`,
    });
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
        setStatusBanner({
          type: 'SUCCESS',
          text: `Đã nhận diện định dạng Word (Gạch chân <u> & Tô đỏ) khi dán: Tách thành công ${parsedFromHtml.length} câu hỏi${
            p2TrueCount > 0 ? `, nhận diện ${p2TrueCount} ý ĐÚNG ở Phần II` : ''
          }!`,
        });
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
      setStatusBanner({
        type: 'SUCCESS',
        text: `Đã trộn thành công ${variants.length} mã đề (Times New Roman 12pt, có đánh số trang & mã đề) kèm Bảng Ma Trận Đáp Án & Mã QR Tổng Hợp!`,
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

  const handleDownloadCleanedMaster = async () => {
    setIsProcessing(true);
    try {
      const blob = await exportCleanedMasterDocx(questions, config, false);
      triggerBrowserDownload(
        blob,
        buildStandardExportFileName(config, 'docx', 'Đề gốc chuẩn')
      );
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
        buildStandardExportFileName(config, 'docx', 'Bảng đáp án khảo thí ma trận')
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
        buildStandardExportFileName(config, 'docx', 'Ma trận và Bản đặc tả CV 7991')
      );
      await executePostDownloadZeroTracePurge('Khung Ma Trận & Bản Đặc Tả CV 7991 (.docx)');
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
        buildStandardExportFileName(config, 'zip')
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
        buildStandardExportFileName(config, 'zip', 'Bộ mã QR chấm thi')
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
      triggerBrowserDownload(
        blob,
        buildStandardExportFileName(config, 'docx', `Mã đề ${variant.examCode}`)
      );
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

        {/* Khung chữ ký Khảo thí */}
        <div className="grid grid-cols-2 gap-4 p-4 border-2 border-slate-300 rounded-2xl text-center text-slate-800 bg-white shadow-xs">
          <div>
            <div className="font-bold text-xs uppercase">CÁN BỘ CHẤM THI 1</div>
            <div className="text-[11px] italic text-slate-500 pt-1">(Ký và ghi rõ họ tên)</div>
            <div className="h-12" />
          </div>
          <div>
            <div className="font-bold text-xs uppercase">CÁN BỘ CHẤM THI 2 / KHẢO THÍ</div>
            <div className="text-[11px] italic text-slate-500 pt-1">(Ký và ghi rõ họ tên)</div>
            <div className="h-12" />
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

              <button
                type="button"
                onClick={() => setIsApiKeyModalOpen(true)}
                className="px-3.5 py-1.5 rounded-xl font-extrabold text-white btn-auto-scale btn-3d-amber flex items-center gap-1.5 whitespace-nowrap cursor-pointer shadow-xs"
                title="Cấu hình Google Gemini API Key để chạy trực tiếp trên GitHub Pages không cần backend"
              >
                <Key className="w-4 h-4 shrink-0" />
                <span>⚙ Cấu Hình API Key</span>
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

                  {/* 3. Kỳ kiểm tra */}
                  <div>
                    <label className="block text-[11px] font-extrabold text-blue-950 uppercase truncate mb-0.5">
                      3. Kỳ kiểm tra:
                    </label>
                    <select
                      value={config.examTitle}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, examTitle: e.target.value }))
                      }
                      className="w-full px-2 py-1.5 text-xs font-black text-blue-950 bg-blue-50/80 border border-blue-400 rounded-xl focus:outline-none focus:border-blue-700 cursor-pointer"
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

                {/* Hàng 5 - 6 - 7 - 8: Lớp, Phút, Số đề, Mã đề */}
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

                  {/* 6. Phút */}
                  <div>
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
                      className="w-full px-1.5 py-1.5 text-xs font-mono font-black text-rose-700 bg-rose-50/60 border border-rose-300 rounded-xl text-center focus:outline-none"
                    />
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
                      className="w-full px-1.5 py-1.5 text-xs font-mono font-black text-indigo-950 bg-indigo-50/80 border border-indigo-300 rounded-xl focus:outline-none cursor-pointer"
                    >
                      <option value={4}>4 đề</option>
                      <option value={8}>8 đề</option>
                      <option value={12}>12 đề</option>
                      <option value={24}>24 đề</option>
                    </select>
                  </div>

                  {/* 8. Sửa mã */}
                  <div>
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
                      <div className="grid grid-cols-4 gap-1.5">
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
                          <option value="QM2025">QM2025 (Chuẩn)</option>
                          <option value="TNMAKER">TNMaker</option>
                          <option value="AZOTA">Azota 2025</option>
                          <option value="STANDARD_2025">Standard 2025</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Khung tự động ánh xạ 4 Mẫu Phiếu QM 2025 theo môn học (Tốc độ 0.01s, khóa cứng 16.5cm x 8.2cm) */}
                <div className="p-2.5 rounded-xl bg-gradient-to-r from-amber-50 via-yellow-50/80 to-emerald-50 border border-amber-300 space-y-1.5">
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
                        className="w-3.5 h-3.5 accent-emerald-600 rounded cursor-pointer shrink-0"
                      />
                      <span className="text-[11px] font-black text-amber-950 uppercase tracking-tight">
                        Chèn Phiếu QM 2025 Trang 1 (.docx)
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsPhieuQmGalleryOpen(true)}
                      className="px-2 py-0.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-extrabold shadow-2xs cursor-pointer shrink-0"
                      title="Xem bảng ánh xạ và hình ảnh 4 mẫu phiếu QM 2025 chuẩn"
                    >
                      Xem 4 Mẫu Phiếu
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-[11px] bg-white/90 px-2.5 py-1 rounded-lg border border-amber-200">
                    <div className="truncate">
                      <span className="font-black text-emerald-800">
                        {activePhieuQMInfo.standardFileName}
                      </span>
                      <span className="text-slate-600 font-semibold ml-1">
                        ({activePhieuQMInfo.structureDesc})
                      </span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded shrink-0">
                      16.5×8.2cm
                    </span>
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
                    disabled={!canShuffle || isProcessing}
                    title="Hoán vị câu hỏi & đáp án để sinh bộ mã đề kèm bảng đáp án khảo thí"
                    className="px-3 py-2.5 rounded-xl font-black text-white btn-auto-scale btn-3d-rose flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <Shuffle className="w-4 h-4 shrink-0" />
                    <span>Trộn Đề ({config.numVariants} Mã)</span>
                  </button>
                </div>

                {/* Hàng 2: 2 Nút tiện ích — [Đề Mẫu 18-4-6] & [Lưu Chỉnh Sửa] */}
                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => handleLoadSampleExam(true)}
                    title="Nạp đề mẫu chuẩn cấu trúc 2025 (18 câu Phần I, 4 câu Phần II, 6 câu Phần III)"
                    className="px-2.5 py-2 rounded-xl font-extrabold text-white btn-auto-scale btn-3d-cyan flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span>Đề Mẫu 18-4-6</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveEdits}
                    title="Lưu mọi chỉnh sửa nội dung câu hỏi và đáp án hiện tại"
                    className={`px-2.5 py-2 rounded-xl font-extrabold text-white btn-auto-scale flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                      hasUnsavedChanges ? 'btn-3d-amber' : 'btn-3d-emerald'
                    }`}
                  >
                    <Save className="w-3.5 h-3.5 shrink-0" />
                    <span>{hasUnsavedChanges ? 'Lưu Chỉnh Sửa*' : 'Lưu Chỉnh Sửa'}</span>
                  </button>
                </div>

                {/* Hàng 3 (Tự động xuất hiện sau khi đã trộn đề): Tải trọn bộ ZIP & Bảng Đáp Án */}
                {shuffledVariants.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleDownloadZipBundle}
                      disabled={isProcessing}
                      className="px-2.5 py-2 rounded-xl font-black text-white btn-auto-scale btn-3d-purple flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                    >
                      <FileArchive className="w-3.5 h-3.5 shrink-0" />
                      <span>Tải Bộ {shuffledVariants.length} Đề (.zip)</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadMasterAnswerSheetDocx}
                      disabled={isProcessing}
                      className="px-2.5 py-2 rounded-xl font-black text-white btn-auto-scale btn-3d-indigo flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 shrink-0" />
                      <span>Bảng Đáp Án (.docx)</span>
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

              {/* Nhóm 3: Khung cảnh báo câu hỏi chưa hợp lệ */}
              <div>
                {validationIssues.length === 0 ? (
                  <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-400 text-emerald-950 text-xs font-black flex items-center gap-1.5 shadow-2xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Đề hợp lệ 100% (0 câu lỗi · Đủ 4 đáp án)</span>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-rose-50 border-2 border-rose-500 text-rose-950 space-y-1.5 shadow-xs text-xs">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1 font-black text-rose-700">
                        <AlertTriangle className="w-4 h-4 text-rose-600 animate-bounce shrink-0" />
                        <span>Cảnh báo ({validationIssues.length} câu lỗi):</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleQuickFixAllErrors}
                        className="px-2 py-0.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-black flex items-center gap-1 cursor-pointer shadow-2xs whitespace-nowrap"
                      >
                        <Wand2 className="w-3 h-3" />
                        <span>Sửa tất cả</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1 flex-wrap">
                      {validationIssues.slice(0, 8).map((iss, idx) => (
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
                      {validationIssues.length > 8 && (
                        <span className="font-bold text-rose-700">
                          +{validationIssues.length - 8} câu
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Nhóm 4: Chọn cỡ chữ & Chèn nhanh ký hiệu khoa học */}
              <div className="pt-1 border-t border-sky-200/80 flex flex-wrap items-center justify-between gap-1.5">
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
                                'PHẦN II. Trắc nghiệm Đúng / Sai (4 ý a, b, c, d mỗi câu — Nhận diện Tô đỏ hoặc Gạch chân)'}
                              {q.part === 'PART_3' &&
                                'PHẦN III. Trắc nghiệm Trả lời ngắn (Điền đáp số)'}
                            </h3>
                            <p className="text-xs text-white/90 font-medium">
                              {config.resetNumberingPerPart
                                ? 'Đang bật chế độ: Đánh số lại từ Câu 1 ở đầu mỗi phần · Times New Roman 12pt · Canh trái tự động co dãn'
                                : 'Đang bật chế độ: Đánh số câu liên tục từ đầu đến cuối đề'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold bg-black/20 px-3 py-1 rounded-lg">
                              {q.part === 'PART_1'
                                ? `${part1Count} câu`
                                : q.part === 'PART_2'
                                ? `${part2Count} câu`
                                : `${part3Count} câu`}
                            </span>
                          </div>
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
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-extrabold text-emerald-700 flex items-center gap-1">
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Đạt chuẩn 2025</span>
                              </span>
                            </div>
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

                          {/* ================= XEM TRƯỚC TRỰC QUAN CÔNG THỨC TOÁN - LÝ - HÓA - SINH ================= */}
                          {(q.stemText.includes('$') ||
                            q.stemText.includes('\\') ||
                            q.hasFormula ||
                            /[A-Z][a-z]?\d/.test(q.stemText) ||
                            q.stemText.includes('→') ||
                            q.stemText.includes('⇌')) && (
                            <div className="mt-2 p-2.5 rounded-xl bg-gradient-to-r from-blue-50/90 via-indigo-50/80 to-sky-50/90 border border-blue-200/90 text-slate-900 shadow-2xs">
                              <div className="flex items-center justify-between mb-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-800">
                                <span className="flex items-center gap-1.5">
                                  <Sigma className="w-3.5 h-3.5 text-blue-600" />
                                  <span>Định dạng công thức trực quan (KaTeX Toán / Lý / Hóa / Sinh):</span>
                                </span>
                                <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                  Xuất Word Equation &lt;m:oMath&gt;
                                </span>
                              </div>
                              <ScientificContentRenderer text={q.stemText} formulaLatex={q.formulaLatex} hasFormula={q.hasFormula} />
                            </div>
                          )}
                        </div>

                        {/* ================= CÔNG THỨC TOÁN / LÝ / HÓA / SINH NHẬN DIỆN ĐƯỢC ================= */}
                        {q.hasFormula && (
                          <div className="mb-3 px-3 py-2 rounded-xl bg-indigo-50/90 border border-indigo-200 flex flex-wrap items-center justify-between gap-2 text-xs text-indigo-950">
                            <div className="flex items-center gap-1.5 font-medium">
                              <Sigma className="w-4 h-4 text-indigo-600 shrink-0" />
                              <span className="font-bold">Công thức Toán / Lý / Hóa:</span>
                              <span className="font-mono bg-white px-2 py-0.5 rounded border border-indigo-200 font-bold text-indigo-700">
                                {q.formulaLatex || 'Chuẩn LaTeX / Office Math Markup (OMML)'}
                              </span>
                            </div>
                            <span className="text-[11px] font-bold text-indigo-600 bg-white/70 px-2 py-0.5 rounded">
                              Xuất trực tiếp Word Equation / Sub-Superscript chuẩn
                            </span>
                          </div>
                        )}

                        {/* ================= BẢNG DỮ LIỆU / BẢNG GHÉP ĐÔI (CỘT A - CỘT B) CỦA CÂU HỎI ================= */}
                        {q.stemTables && q.stemTables.length > 0 && (
                          <div className="mb-3 space-y-2">
                            <div className="text-[11px] font-bold text-sky-900 flex items-center justify-between">
                              <span>
                                Bảng dữ liệu / Bảng ghép đôi trong câu hỏi ({q.stemTables.length} bảng — Bảo toàn cấu trúc Word Table):
                              </span>
                              <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                Giữ nguyên ô gộp &amp; căn lề khi xuất .docx
                              </span>
                            </div>
                            {q.stemTables.map((tbl) => (
                              <div
                                key={tbl.id}
                                className="overflow-x-auto rounded-xl border border-slate-300 bg-white shadow-2xs"
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
                                              {cell.text}
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

                        {/* ================= HÌNH ẢNH / SƠ ĐỒ / PHẢ HỆ / ĐỒ THỊ ĐÍNH KÈM CỦA CÂU HỎI ================= */}
                        <div className="mb-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <label className="text-[11px] font-bold text-sky-900 flex items-center gap-1.5">
                              <ImageIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span>
                                Sơ đồ, Phả hệ, Đồ thị câu hỏi ({q.images?.length || 0} — Chuẩn In Line with Text căn giữa):
                              </span>
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
                                title="Thêm sơ đồ / phả hệ / đồ thị minh họa (Tự động khử nhiễu nền, giữ tỷ lệ gốc 300 DPI & gắn thẻ [HINH_ANH_CAU_X])"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Thêm ảnh / sơ đồ</span>
                              </label>
                            </div>
                          </div>

                          {q.images && q.images.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                              {q.images.map((img, imgIdx) => {
                                const displayTag =
                                  img.tagId ||
                                  `[HINH_ANH_CAU_${q.displayIndex}${
                                    (q.images?.length || 0) > 1 ? `_${imgIdx + 1}` : ''
                                  }]`;
                                return (
                                  <div
                                    key={img.id}
                                    className="relative group p-2 rounded-xl bg-white border-2 border-sky-200 shadow-xs flex flex-col items-center"
                                  >
                                    <div className="w-full flex items-center justify-between gap-1 mb-1 px-1">
                                      <span className="text-[10px] font-mono font-black text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                        {displayTag}
                                      </span>
                                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                        In Line · {img.dpi || 300} DPI
                                      </span>
                                    </div>
                                    <img
                                      src={img.dataUrl}
                                      alt={img.caption || displayTag}
                                      className="max-h-36 object-contain rounded-lg border border-slate-100 cursor-pointer transition-transform group-hover:scale-102"
                                      onClick={() =>
                                        setPreviewModalImage({
                                          src: img.dataUrl,
                                          caption: `${displayTag} — Câu ${q.displayIndex}`,
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
                                              caption: `${displayTag} — Câu ${q.displayIndex}`,
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
                                );
                              })}
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

                                  <div className="flex-1 min-w-0">
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
                                      className={`w-full px-2 py-1 text-left bg-transparent border-b border-transparent focus:border-blue-600 focus:bg-white focus:outline-none ${
                                        opt.isUnderline ? 'underline decoration-2' : ''
                                      } ${
                                        opt.isRed
                                          ? 'text-rose-600 font-bold'
                                          : 'text-slate-900 font-medium'
                                      }`}
                                    />
                                    {(opt.text.includes('$') ||
                                      opt.text.includes('\\') ||
                                      /[A-Z][a-z]?\d/.test(opt.text)) && (
                                      <div className="text-[11px] px-1.5 py-0.5 mt-0.5 text-slate-800 bg-white/70 rounded border border-slate-200/60">
                                        <ScientificContentRenderer
                                          text={opt.text}
                                          inline
                                          isCorrect={opt.isCorrect}
                                          isUnderline={opt.isUnderline}
                                          isRed={opt.isRed}
                                        />
                                      </div>
                                    )}
                                  </div>

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

                                  <div className="flex-1 min-w-0">
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
                                      className={`w-full px-3 py-1.5 text-left bg-white border border-sky-200 rounded-lg focus:outline-none focus:border-blue-600 ${
                                        sub.isTrue
                                          ? 'underline decoration-emerald-600 text-slate-900 font-bold'
                                          : 'text-slate-700 font-medium'
                                      }`}
                                    />
                                    {(sub.text.includes('$') ||
                                      sub.text.includes('\\') ||
                                      /[A-Z][a-z]?\d/.test(sub.text)) && (
                                      <div className="text-[11px] px-2 py-0.5 mt-1 text-slate-800 bg-white/80 rounded border border-slate-200">
                                        <ScientificContentRenderer text={sub.text} inline />
                                      </div>
                                    )}
                                  </div>

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
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={q.shortAnswer || ''}
                                  onChange={(e) =>
                                    handleUpdateShortAnswerPart3(q.id, e.target.value)
                                  }
                                  placeholder="Nhập số (VD: 375 hoặc 0.12)"
                                  className="w-44 px-3 py-1.5 text-sm font-mono font-extrabold text-rose-600 underline bg-white border-2 border-amber-400 rounded-xl focus:outline-none focus:border-blue-600"
                                />
                                {(q.shortAnswer?.includes('$') ||
                                  q.shortAnswer?.includes('\\') ||
                                  /[A-Z][a-z]?\d/.test(q.shortAnswer || '')) && (
                                  <div className="text-[11px] px-2 py-0.5 text-slate-800 bg-white rounded border border-amber-300">
                                    <ScientificContentRenderer text={q.shortAnswer || ''} inline />
                                  </div>
                                )}
                              </div>
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
                      Giữ nguyên 100% ma trận nhận thức và cấu trúc 3 phần (Phần I, Phần II, Phần III) của đề gốc; tự động thay đổi số liệu, hàm số và ngữ cảnh khoa học.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsApiKeyModalOpen(true)}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-sm transition-transform active:scale-95"
                      title="Cấu hình Google Gemini API Key để chạy trực tiếp trên GitHub Pages"
                    >
                      <Key className="w-4 h-4 text-slate-950 shrink-0" />
                      <span>⚙ Cấu Hình Gemini API Key</span>
                    </button>
                    <span className="px-3 py-1.5 rounded-xl bg-emerald-100 border-2 border-emerald-400 text-emerald-950 text-xs font-extrabold flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-700" />
                      <span>Bảo mật tuyệt đối · Tự hành 100%</span>
                    </span>
                  </div>
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
                    Nhấn nút <strong>[Bắt Đầu Sinh Đề AI]</strong> phía trên để hệ thống sinh bộ đề mới giữ nguyên cấu trúc 3 phần và đối chiếu trực quan từng câu với đề gốc.
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
                      </div>
                    );
                  })}
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
                    disabled={!canShuffle || isProcessing}
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
                    Phần I: {part1Count}c · Phần II: {part2Count}c · Phần III: {part3Count}c
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
                        <th colSpan={9} className="py-2 px-2 border border-sky-700">Mức độ đánh giá (Số lượng câu)</th>
                        <th rowSpan={3} className="py-2.5 px-2 border border-sky-700 w-16">Tổng số</th>
                        <th rowSpan={3} className="py-2.5 px-2 border border-sky-700 w-16">Tỉ lệ %</th>
                      </tr>
                      <tr className="bg-sky-800 text-white font-bold text-[11px]">
                        <th colSpan={3} className="py-1 px-1 border border-sky-700">Phần I (Nhiều LC)</th>
                        <th colSpan={3} className="py-1 px-1 border border-sky-700">Phần II (Đúng/Sai)</th>
                        <th colSpan={3} className="py-1 px-1 border border-sky-700">Phần III (Trả lời ngắn)</th>
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
                <div className="space-y-1">
                  <div className="font-bold text-xs uppercase text-slate-900">
                    GIÁO VIÊN RA ĐỀ
                  </div>
                  <div className="text-[11px] italic text-slate-500">
                    (Ký và ghi rõ họ tên)
                  </div>
                  <div className="h-16" />
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
                    disabled={!canShuffle}
                    className="px-6 py-3 rounded-xl text-xs font-extrabold text-white btn-3d-primary inline-flex items-center gap-2"
                  >
                    <Shuffle className="w-4 h-4" />
                    <span>Trộn Đề & Sinh Bảng Đáp Án Chung Ngay</span>
                  </button>
                </div>
              ) : (
                <>
                  {/* BỘ 3 MÃ QR CHẤM THI TỔNG HỢP CHUẨN QUỐC GIA (1. QM 2025 — 2. TNMAKER — 3. AZOTA) */}
                  {masterMultiQr && masterMultiQr.tripleQr && (
                    <div className="p-5 rounded-3xl guide-card-3d-purple border-2 border-purple-300 space-y-4 shadow-md">
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-purple-200">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <QrCode className="w-5 h-5 text-purple-700" />
                            <h4 className="text-base font-black text-purple-950 uppercase">
                              BỘ 3 MÃ QR CHẤM THI TỔNG HỢP ({shuffledVariants.length} MÃ ĐỀ: {shuffledVariants.map((v) => v.examCode).join(', ')})
                            </h4>
                            <span className="text-[10px] font-black uppercase bg-emerald-700 text-white px-2.5 py-0.5 rounded-md">
                              Quét 100% Thành Công Trên Cả 3 App
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 font-semibold">
                            Mỗi phần mềm chấm thi có cấu trúc giải mã JSON riêng. Hệ thống đã đóng gói sẵn <strong>3 Mã QR độc lập chuẩn gốc 100%</strong> cho <strong>1. QM 2025</strong>, <strong>2. TNMaker</strong> và <strong>3. Azota</strong> (kèm 3 file Excel <code>.xlsx</code> chuẩn). Thầy cô dùng phần mềm nào chỉ cần quét đúng mã QR của phần mềm đó!
                          </p>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={handleDownloadQrZip}
                            className="px-3.5 py-2 rounded-xl text-xs font-black text-white btn-3d-purple flex items-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Tải Trọn Bộ 3 Mã QR + 3 File Excel (.zip)</span>
                          </button>
                        </div>
                      </div>

                      {/* LƯỚI 3 CỘT: 1. QM 2025 | 2. TNMAKER | 3. AZOTA */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
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
                        ].map((card) => (
                          <div
                            key={card.item.appId}
                            className={`rounded-2xl border-2 ${card.borderClass} overflow-hidden flex flex-col justify-between shadow-sm bg-white`}
                          >
                            <div className={`${card.headerBg} px-3.5 py-2 flex items-center justify-between`}>
                              <span className="font-black text-xs uppercase tracking-wide">
                                {card.badgeText}
                              </span>
                              <span className="text-[10px] font-mono bg-white/20 px-2 py-0.5 rounded font-bold">
                                {shuffledVariants.length} mã đề
                              </span>
                            </div>

                            <div className="p-3.5 space-y-3 flex-1 flex flex-col items-center">
                              <div className="text-[11px] font-bold text-slate-700 text-center">
                                {card.subTitle}
                              </div>

                              <div className="p-2 bg-white rounded-xl border-2 border-slate-200 shadow-xs">
                                <img
                                  src={card.item.qrDataUrl}
                                  alt={card.badgeText}
                                  referrerPolicy="no-referrer"
                                  className="w-44 h-44 object-contain mx-auto"
                                />
                              </div>

                              <div className="w-full space-y-1">
                                <div className="flex items-center justify-between text-[10px] font-mono text-slate-600">
                                  <span className="font-bold truncate">{card.formatDesc}</span>
                                  <span className="shrink-0 ml-1 font-bold text-slate-800">
                                    {card.item.qrPayload.length} ký tự
                                  </span>
                                </div>
                                <div className="p-2 rounded-lg bg-slate-900 text-emerald-400 font-mono text-[10px] break-all leading-relaxed max-h-20 overflow-y-auto border border-slate-700">
                                  {card.item.qrPayload}
                                </div>
                              </div>

                              <div className="w-full grid grid-cols-3 gap-1.5 pt-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const link = document.createElement('a');
                                    link.href = card.item.qrDataUrl;
                                    link.download = buildStandardExportFileName(
                                      config,
                                      'png',
                                      `QR Tổng Hợp - ${card.item.appId}`
                                    );
                                    link.click();
                                  }}
                                  className={`px-2 py-1.5 rounded-lg text-[11px] font-extrabold text-white ${card.btnClass} flex items-center justify-center gap-1 cursor-pointer`}
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
                                        `Đáp Án Chuẩn ${card.excelCode}`
                                      )
                                    );
                                    setStatusBanner({
                                      type: 'SUCCESS',
                                      text: `Đã tải tệp Excel (.xlsx) đáp án chuẩn chính thức của ${card.badgeText}!`,
                                    });
                                  }}
                                  className="px-2 py-1.5 rounded-lg text-[11px] font-extrabold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 flex items-center justify-center gap-1 cursor-pointer"
                                  title="Tải file Excel (.xlsx) đáp án chuẩn của phần mềm này"
                                >
                                  <FileText className="w-3 h-3 shrink-0 text-emerald-700" />
                                  <span>File .xlsx</span>
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
                                  className="px-2 py-1.5 rounded-lg text-[11px] font-extrabold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 flex items-center justify-center gap-1 cursor-pointer"
                                  title="Sao chép chuỗi JSON payload"
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
                        💡 <strong>Cam kết hoạt động 100%:</strong> Cả 3 mã QR trên đều được biên dịch đúng từng ký tự JSON theo thuật toán gốc của <strong>QM 2025</strong> (<code>[[101,"A",...,"D","S",...,28.125]]</code>), <strong>TNMaker</strong> (<code>{`{"101":"ABCD...#ĐSĐĐ_...#2700_...","success":true,"type":5}`}</code>) và <strong>Azota</strong> (<code>[["101","A",...,"Đ","S",...,"28,125"]]</code>), đồng thời đã được nhúng cả 3 mã vào trang cuối của tệp Word Bảng Đáp Án Khảo Thí A4!
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
                      {/* Khung Bộ 3 Mã QR Chấm Thi Riêng Cho Mã Đề Đang Chọn (1. QM 2025 — 2. TNMaker — 3. Azota) */}
                      <div className="p-5 rounded-2xl card-3d-panel space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-sky-200 pb-3">
                          <div>
                            <h3 className="text-sm sm:text-base font-black text-sky-950 uppercase">
                              BỘ 3 MÃ QR CHẤM THI RIÊNG CHO MÃ ĐỀ {activeVariant.examCode} (1. QM 2025 — 2. TNMAKER — 3. AZOTA)
                            </h3>
                            <p className="text-xs text-slate-600 font-medium">
                              Dành cho giáo viên muốn quét nạp riêng từng mã đề {activeVariant.examCode} trên 1 trong 3 phần mềm chấm thi:
                            </p>
                          </div>
                          <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-lg border border-emerald-300">
                            Mã đề: {activeVariant.examCode} · Chuẩn 100% 3 App
                          </span>
                        </div>

                        {activeVariant.tripleQr ? (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[
                              {
                                item: activeVariant.tripleQr.qm2025,
                                title: `1. QM 2025 (Mã ${activeVariant.examCode})`,
                                border: 'border-amber-300 bg-amber-50/40',
                                badge: 'bg-amber-800 text-white',
                              },
                              {
                                item: activeVariant.tripleQr.tnmaker,
                                title: `2. TNMaker (Mã ${activeVariant.examCode})`,
                                border: 'border-blue-300 bg-blue-50/40',
                                badge: 'bg-blue-800 text-white',
                              },
                              {
                                item: activeVariant.tripleQr.azota,
                                title: `3. Azota (Mã ${activeVariant.examCode})`,
                                border: 'border-emerald-300 bg-emerald-50/40',
                                badge: 'bg-emerald-800 text-white',
                              },
                            ].map((qrCard) => (
                              <div
                                key={`${activeVariant.examCode}-${qrCard.item.appId}`}
                                className={`p-3.5 rounded-2xl border-2 ${qrCard.border} flex flex-col items-center space-y-2.5`}
                              >
                                <div className={`w-full text-center py-1 px-2 rounded-lg text-xs font-black uppercase ${qrCard.badge}`}>
                                  {qrCard.title}
                                </div>
                                <img
                                  src={qrCard.item.qrDataUrl}
                                  alt={qrCard.title}
                                  referrerPolicy="no-referrer"
                                  className="w-36 h-36 object-contain rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xs"
                                />
                                <div className="w-full p-2 rounded-lg bg-slate-900 text-emerald-400 font-mono text-[10px] break-all max-h-16 overflow-y-auto">
                                  {qrCard.item.qrPayload}
                                </div>
                                <div className="w-full flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const link = document.createElement('a');
                                      link.href = qrCard.item.qrDataUrl;
                                      link.download = buildStandardExportFileName(
                                        config,
                                        'png',
                                        `QR-Mã đề ${activeVariant.examCode}-${qrCard.item.appId}`
                                      );
                                      link.click();
                                    }}
                                    className="flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 flex items-center justify-center gap-1 cursor-pointer"
                                  >
                                    <Download className="w-3 h-3" />
                                    <span>Tải QR PNG</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(qrCard.item.qrPayload);
                                      setStatusBanner({
                                        type: 'SUCCESS',
                                        text: `Đã sao chép chuỗi QR ${qrCard.item.appId} của Mã đề ${activeVariant.examCode}!`,
                                      });
                                    }}
                                    className="py-1.5 px-2.5 rounded-lg text-[11px] font-bold bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 cursor-pointer"
                                  >
                                    Copy
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}
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
                            {config.embedPhieuQM2025 === false ? (
                              <div className="font-bold">
                                Họ và tên thí sinh: ......................................................... Số báo danh: ....................
                              </div>
                            ) : (
                              <div className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                <span>
                                  Đã nhúng tự động <strong>{activePhieuQMInfo.standardFileName}</strong> ({activePhieuQMInfo.groupName}: {activePhieuQMInfo.structureDesc}) — Khóa tỷ lệ 16.5cm × 8.2cm
                                </span>
                              </div>
                            )}
                            <div className="px-3 py-0.5 border-2 border-slate-900 font-bold">
                              MÃ ĐỀ THI: {activeVariant.examCode}
                            </div>
                          </div>

                          {/* HIỂN THỊ TRỰC QUAN ẢNH PHIẾU TRẢ LỜI TRẮC NGHIỆM QM 2025 NGAY DƯỚI HEADER TRANG 1 */}
                          {config.embedPhieuQM2025 !== false && (
                            <div className="py-2 flex flex-col items-center justify-center border-b-2 border-dashed border-slate-300 bg-slate-50/50 rounded-xl">
                              <img
                                src={activePhieuQMInfo.publicUrl}
                                onError={(e) => {
                                  const target = e.currentTarget;
                                  if (target.src !== window.location.origin + activePhieuQMInfo.fallbackUrl) {
                                    target.src = activePhieuQMInfo.fallbackUrl;
                                  }
                                }}
                                alt={`Phiếu trả lời trắc nghiệm QM 2025 - ${activePhieuQMInfo.groupName}`}
                                className="w-full max-w-[624px] h-auto object-contain border border-slate-300 rounded-lg shadow-xs bg-white cursor-pointer hover:shadow-md transition-shadow"
                                onClick={() =>
                                  setPreviewModalImage({
                                    src: activePhieuQMInfo.publicUrl,
                                    caption: `Phiếu trả lời QM 2025 (${activePhieuQMInfo.standardFileName}) — ${activePhieuQMInfo.groupName} (${activePhieuQMInfo.structureDesc}) — Kích thước in Word: 16.5cm × 8.2cm`,
                                  })
                                }
                              />
                              <span className="mt-1 text-[11px] font-sans font-semibold text-slate-500">
                                ▲ Ảnh Phiếu QM 2025 ({activePhieuQMInfo.standardFileName} · 16.5cm × 8.2cm) được chèn tự động ngay dưới Header Trang 1 trong file De_{activeVariant.examCode}.docx (Bấm vào ảnh để phóng to)
                              </span>
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
                                    </div>
                                  )}

                                  <div className="space-y-2 leading-relaxed text-left">
                                    <p className="text-left leading-relaxed">
                                      <strong className="font-bold">
                                        Câu {vq.displayIndex}.{' '}
                                      </strong>
                                      <ScientificContentRenderer text={vq.stemText} inline />
                                    </p>

                                    {/* Bảng dữ liệu / bảng ghép đôi thuộc phần dẫn câu hỏi */}
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

                                    {/* Hình ảnh / sơ đồ / phả hệ / đồ thị đính kèm (In Line with Text, căn giữa, có thẻ định danh) */}
                                    {vq.images && vq.images.length > 0 && (
                                      <div className="my-3 flex flex-col items-center justify-center gap-2">
                                        {vq.images.map((img, imgIdx) => {
                                          const displayTag =
                                            img.tagId ||
                                            `[HINH_ANH_CAU_${vq.displayIndex}${
                                              vq.images && vq.images.length > 1 ? `_${imgIdx + 1}` : ''
                                            }]`;
                                          return (
                                            <div
                                              key={img.id || `${vq.id}-img-${imgIdx}`}
                                              className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-50 border border-slate-200 shadow-xs max-w-full"
                                            >
                                              <div className="w-full flex items-center justify-between gap-2 mb-1 px-1">
                                                <span className="text-[10px] font-mono font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                                  {displayTag}
                                                </span>
                                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                                  In Line with Text · {img.dpi || 300} DPI
                                                </span>
                                              </div>
                                              <img
                                                src={img.dataUrl}
                                                alt={img.caption || displayTag}
                                                className="max-h-56 max-w-full object-contain rounded-lg border border-slate-200 cursor-pointer hover:shadow-md transition-shadow bg-white"
                                                onClick={() =>
                                                  setPreviewModalImage({
                                                    src: img.dataUrl,
                                                    caption: `${displayTag} — Mã đề ${activeVariant.examCode} — Câu ${vq.displayIndex}`,
                                                  })
                                                }
                                              />
                                              <div className="mt-1 text-center font-mono text-[11px] text-slate-600 font-semibold">
                                                {img.caption || displayTag}
                                              </div>
                                            </div>
                                          );
                                        })}
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
                                              isCorrect={o.isCorrect}
                                              isUnderline={o.isUnderline}
                                              isRed={o.isRed}
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
                                              isCorrect={s.isTrue}
                                              isUnderline={s.isUnderline}
                                              isRed={s.isRed}
                                            />
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {vq.part === 'PART_3' && (
                                      <div className="pt-1 text-sm text-slate-800 flex items-center gap-2">
                                        <span className="font-bold text-slate-900">Đáp số / Trả lời ngắn:</span>
                                        <span className="inline-block border-b-2 border-dotted border-slate-600 w-44 text-center font-bold text-blue-900">
                                          {vq.shortAnswer ? vq.shortAnswer : '................................................'}
                                        </span>
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
                onClick={() => {
                  setIsAiSecurityModalOpen(false);
                  setIsApiKeyModalOpen(true);
                }}
                className="px-4 py-2.5 rounded-xl text-xs font-black text-slate-900 bg-amber-400 hover:bg-amber-500 flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <Key className="w-4 h-4 text-slate-950" />
                <span>⚙ Cấu Hình Google Gemini API Key</span>
              </button>

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

      {/* Modal Xem Bảng Ánh Xạ & 4 Mẫu Phiếu Trả Lời Trắc Nghiệm QM 2025 */}
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
                  BẢNG ÁNH XẠ 4 MẪU PHIẾU TRẢ LỜI TRẮC NGHIỆM QM 2025 VÀO ĐẦU TRANG 1 ĐỀ THI WORD (.DOCX)
                </h3>
                <p className="text-xs font-semibold text-slate-600">
                  Tự động nhận diện theo môn học trong 0.01s (0 API token) · Khóa cứng tỷ lệ chuẩn Camera QM: Width = 16.5cm (624px) × Height = 8.2cm (310px)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPhieuQmGalleryOpen(false)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-extrabold text-white btn-3d-rose cursor-pointer"
              >
                Đóng
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border-2 border-amber-300">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-amber-900 text-white font-bold">
                    <th className="py-2.5 px-3 border-r border-amber-700">Nhóm môn</th>
                    <th className="py-2.5 px-3 border-r border-amber-700">Tên môn áp dụng</th>
                    <th className="py-2.5 px-3 border-r border-amber-700">Cấu trúc trắc nghiệm trên phiếu</th>
                    <th className="py-2.5 px-3">Tên file ảnh chuẩn</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-200">
                  {ALL_PHIEU_QM_2025_TEMPLATES.map((tpl) => {
                    const isCurrent = tpl.standardFileName === activePhieuQMInfo.standardFileName;
                    return (
                      <tr
                        key={tpl.groupCode}
                        className={isCurrent ? 'bg-emerald-50 font-bold' : 'bg-white hover:bg-amber-50/50'}
                      >
                        <td className="py-2 px-3 border-r border-amber-200 font-black text-slate-900">
                          {tpl.groupName}
                          {isCurrent && (
                            <span className="ml-2 px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px]">
                              Đang chọn
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 border-r border-amber-200 text-slate-800">
                          {tpl.subjectsLabel}
                        </td>
                        <td className="py-2 px-3 border-r border-amber-200 text-blue-900 font-semibold">
                          {tpl.structureDesc}
                        </td>
                        <td className="py-2 px-3 font-mono font-black text-amber-900">
                          {tpl.standardFileName}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ALL_PHIEU_QM_2025_TEMPLATES.map((tpl) => {
                const isCurrent = tpl.standardFileName === activePhieuQMInfo.standardFileName;
                return (
                  <div
                    key={`card-${tpl.groupCode}`}
                    className={`p-3.5 rounded-2xl border-2 space-y-2 ${
                      isCurrent
                        ? 'border-emerald-500 bg-emerald-50/50 shadow-md'
                        : 'border-slate-200 bg-slate-50/70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-black text-slate-900 uppercase">
                          {tpl.groupName} ({tpl.standardFileName})
                        </div>
                        <div className="text-[11px] font-semibold text-slate-600">
                          {tpl.structureDesc}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-lg bg-amber-100 border border-amber-300 font-mono text-[10px] font-bold text-amber-900">
                        16.5cm × 8.2cm
                      </span>
                    </div>
                    <img
                      src={tpl.publicUrl}
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (target.src !== window.location.origin + tpl.fallbackUrl) {
                          target.src = tpl.fallbackUrl;
                        }
                      }}
                      alt={tpl.groupName}
                      className="w-full h-auto object-contain rounded-xl border border-slate-300 bg-white cursor-pointer hover:shadow-md"
                      onClick={() =>
                        setPreviewModalImage({
                          src: tpl.publicUrl,
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
      <GeminiApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        onKeySaved={(newKey) => {
          setStatusBanner({
            type: 'SUCCESS',
            text: newKey
              ? 'Đã cấu hình thành công Google Gemini API Key vào trình duyệt!'
              : 'Đã xóa API Key. Hệ thống chuyển sang chế độ tự hành dự phòng thông minh.',
          });
        }}
      />

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
