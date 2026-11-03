import JSZip from 'jszip';

// Khai báo biến toàn cục từ thư viện wmf.js
declare const WMF: any;

export interface ExamImageAttachment {
  rId: string;
  fileName: string;
  dataUrl: string;
  width?: number;
  height?: number;
}

export interface QuestionItem {
  id: string;
  part: 'I' | 'II' | 'III' | 'IV';
  rawNumber: number;
  questionText: string;
  images: ExamImageAttachment[];
  options: {
    label: string;
    text: string;
    isCorrect?: boolean;
    images?: ExamImageAttachment[];
  }[];
  explanation?: string;
}

export interface ParsedExamResult {
  title: string;
  questions: QuestionItem[];
  rawText: string;
}

/**
 * ENGINE CHUYỂN ĐỔI VECTOR WMF SANG PNG THỰC SỰ TRÊN CANVAS
 */
async function convertWmfBufferToPngDataUrl(buffer: Uint8Array): Promise<string> {
  return new Promise((resolve) => {
    try {
      if (typeof WMF !== 'undefined' && WMF.draw) {
        const canvas = document.createElement('canvas');
        canvas.width = 600;
        canvas.height = 300;
        
        // Vẽ trực tiếp vector MathType/WMF lên Canvas
        WMF.draw(buffer, canvas);
        resolve(canvas.toDataURL('image/png'));
        return;
      }
    } catch (e) {
      console.warn("Lỗi khi render vector WMF bằng canvas:", e);
    }

    // Dự phòng an toàn nếu vector WMF bị hỏng cấu trúc
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 60;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, 240, 60);
      ctx.strokeStyle = '#cbd5e1';
      ctx.strokeRect(0, 0, 240, 60);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 12px Arial';
      ctx.fillText('[Hình / Công thức MathType]', 15, 35);
    }
    resolve(canvas.toDataURL('image/png'));
  });
}

/**
 * ENGINE ĐỌC VÀ CHỮA LỖI TẤT CẢ FILE ẢNH/MEDIA TRONG DOCX
 */
async function extractMediaMap(zip: JSZip): Promise> {
  const mediaMap = new Map<string, { dataUrl: string; fileName: string }>();
  
  // 1. Phân tích bảng ánh xạ rId -> tên file trong document.xml.rels
  const relsXmlStr = await zip.file('word/_rels/document.xml.rels')?.async('string');
  const rIdToFilename = new Map<string, string>();
  if (relsXmlStr) {
    const parser = new DOMParser();
    const relsDoc = parser.parseFromString(relsXmlStr, 'application/xml');
    const rels = relsDoc.getElementsByTagName('Relationship');
    for (let i = 0; i < rels.length; i++) {
      const id = rels[i].getAttribute('Id');
      const target = rels[i].getAttribute('Target');
      if (id && target) {
        const fname = target.split('/').pop() || '';
        rIdToFilename.set(id, fname);
      }
    }
  }

  // 2. Đọc nhị phân và chuyển đổi toàn bộ ảnh
  const mediaFiles = Object.keys(zip.files).filter((path) => path.startsWith('word/media/'));
  const filenameToDataUrl = new Map<string, string>();

  for (const filePath of mediaFiles) {
    const fileName = filePath.split('/').pop() || '';
    const ext = fileName.split('.').pop()?.toLowerCase();

    if (ext === 'wmf' || ext === 'emf') {
      const u8 = await zip.files[filePath].async('uint8array');
      const pngUrl = await convertWmfBufferToPngDataUrl(u8);
      filenameToDataUrl.set(fileName, pngUrl);
    } else {
      const base64 = await zip.files[filePath].async('base64');
      const mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
      filenameToDataUrl.set(fileName, `data:${mime};base64,${base64}`);
    }
  }

  // 3. Gán trở lại cho mediaMap theo rId
  for (const [rId, fileName] of rIdToFilename.entries()) {
    const dataUrl = filenameToDataUrl.get(fileName);
    if (dataUrl) {
      mediaMap.set(rId, { dataUrl, fileName });
    }
  }

  return mediaMap;
}

/**
 * ENGINE TRÍCH XUẤT HÌNH ẢNH TRỰC THUỘC TỪNG ĐOẠN (CHỐNG DỒN ẢNH)
 */
function extractImagesFromElement(
  container: Element,
  mediaMap: Map<string, { dataUrl: string; fileName: string }>
): ExamImageAttachment[] {
  const images: ExamImageAttachment[] = [];
  const seenRIds = new Set<string>();

  const blipNodes = container.getElementsByTagName('a:blip');
  for (let i = 0; i < blipNodes.length; i++) {
    // Khống chế tối đa 2 hình/đoạn để chống hiện tượng dồn nhầm ảnh trôi nổi
    if (images.length >= 2) break;

    const blip = blipNodes[i];
    const rId =
      blip.getAttribute('r:embed') ||
      blip.getAttribute('r:link') ||
      blip.getAttribute('embed') ||
      '';

    if (rId && mediaMap.has(rId) && !seenRIds.has(rId)) {
      seenRIds.add(rId);
      const media = mediaMap.get(rId)!;
      images.push({
        rId,
        fileName: media.fileName,
        dataUrl: media.dataUrl
      });
    }
  }

  return images;
}

/**
 * ENGINE CHỮA LỖI CÔNG THỨC HÓA / SINH GÕ THÔ
 */
function autoHealFormulas(text: string): string {
  if (!text) return '';
  let healed = text;

  // Hóa học: Chuyển chỉ số dưới tự động: H2SO4, Ca(OH)2, CO2, H2O, Fe3O4
  healed = healed.replace(/\b([A-Z][a-z]?)([0-9]+)\b/g, '$1_{$2}');
  healed = healed.replace(/\b([A-Z][a-z]?)([0-9]+)([A-Z][a-z]?)([0-9]+)\b/g, '$1_{$2}$3_{$4}');

  // Sinh học: Phân số kiểu gen di truyền AB/ab -> \frac{AB}{ab}
  healed = healed.replace(/\b([A-Z][a-z]?\/[a-z][a-z]?)\b/g, (match) => {
    const parts = match.split('/');
    return `\\frac{${parts[0]}}{${parts[1]}}`;
  });

  return healed;
}

/**
 * HÀM CHÍNH: PHÂN TÍCH FILE WORD (.DOCX) SANG DỮ LIỆU ĐỀ THI
 */
export async function parseDocx(file: File): Promise<ParsedExamResult> {
  const zip = await JSZip.loadAsync(file);
  const mediaMap = await extractMediaMap(zip);

  const documentXmlStr = await zip.file('word/document.xml')?.async('string');
  if (!documentXmlStr) {
    throw new Error('Tệp không đúng định dạng Word chuẩn (.docx)');
  }

  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(documentXmlStr, 'application/xml');
  const paragraphs = xmlDoc.getElementsByTagName('w:p');

  const questions: QuestionItem[] = [];
  let currentQuestion: QuestionItem | null = null;
  let currentPart: 'I' | 'II' | 'III' | 'IV' = 'I';

  // Regex nhận diện tiêu đề phần thi
  const partIRegex = /PHẦN\s+I/i;
  const partIIRegex = /PHẦN\s+II/i;
  const partIIIRegex = /PHẦN\s+III/i;
  const partIVRegex = /PHẦN\s+IV/i;

  // Regex bắt câu hỏi (chấp nhận cả Câu 1, Câu 1., Câu 1:)
  const questionRegex = /^(?:Câu|Bài)\s*(\d+)[\s.:]/i;

  // Regex bắt đáp án trắc nghiệm Phần I: A., B., C., D.
  const optionRegex = /^[A-D][.:\)]\s*(.*)/i;

  // Regex bắt đáp án Đúng/Sai Phần II: a), b), c), d) - Khắc phục hoàn toàn lỗi bỏ sót ý a
  const subOptionRegex = /^[\(\s]*([a-d])[\)\.\:]\s*(.*)/i;

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    
    // Thu thập text của đoạn
    const tNodes = p.getElementsByTagName('w:t');
    let pText = '';
    for (let t = 0; t < tNodes.length; t++) {
      pText += tNodes[t].textContent || '';
    }
    pText = pText.trim();

    // Thu thập ảnh thuộc về đúng đoạn này
    const pImages = extractImagesFromElement(p, mediaMap);

    // Kiểm tra chuyển phần
    if (partIRegex.test(pText)) { currentPart = 'I'; continue; }
    if (partIIRegex.test(pText)) { currentPart = 'II'; continue; }
    if (partIIIRegex.test(pText)) { currentPart = 'III'; continue; }
    if (partIVRegex.test(pText)) { currentPart = 'IV'; continue; }

    const qMatch = pText.match(questionRegex);
    if (qMatch) {
      if (currentQuestion) {
        questions.push(currentQuestion);
      }

      currentQuestion = {
        id: `q_${Date.now()}_${questions.length + 1}`,
        part: currentPart,
        rawNumber: parseInt(qMatch[1], 10),
        questionText: autoHealFormulas(pText),
        images: [...pImages],
        options: []
      };
      continue;
    }

    if (!currentQuestion) continue;

    // Xử lý các ý con Phần II (a, b, c, d)
    if (currentPart === 'II') {
      const subMatch = pText.match(subOptionRegex);
      if (subMatch) {
        const label = subMatch[1].toLowerCase();
        const text = subMatch[2]?.trim() || '';
        currentQuestion.options.push({
          label: `${label})`,
          text: autoHealFormulas(text || `Nội dung mệnh đề ${label}`),
          images: pImages.length > 0 ? [...pImages] : undefined
        });
        continue;
      }
    }

    // Xử lý phương án Phần I (A, B, C, D)
    const optMatch = pText.match(optionRegex);
    if (optMatch) {
      const label = pText.charAt(0).toUpperCase();
      currentQuestion.options.push({
        label,
        text: autoHealFormulas(optMatch[1] || ''),
        images: pImages.length > 0 ? [...pImages] : undefined
      });
      continue;
    }

    // Nếu là đoạn văn bản thường hoặc mô tả tiếp theo của câu hỏi
    if (pText.length > 0) {
      currentQuestion.questionText += '\n' + autoHealFormulas(pText);
    }
    if (pImages.length > 0 && currentQuestion.images.length < 3) {
      currentQuestion.images.push(...pImages);
    }
  }

  if (currentQuestion) {
    questions.push(currentQuestion);
  }

  return {
    title: file.name.replace(/\.[^/.]+$/, ''),
    questions,
    rawText: ''
  };
}
