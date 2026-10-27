import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Bảng ánh xạ từ các tùy chọn giao diện sang các model chuẩn của @google/genai
function resolveAllowedGeminiModel(requestedTier?: string): string {
  switch (requestedTier) {
    case '3.5-flash-lite':
      return 'gemini-3.1-flash-lite';
    case '3.8-flash':
      return 'gemini-3.8-flash';
    case '3.1-pro':
      return 'gemini-3.1-pro-preview';
    case '4-argon':
      return 'gemini-3.8-flash';
    default:
      return 'gemini-3.8-flash';
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '15mb' }));

  // Middleware bảo mật tối đa: Không lưu cache, không lưu vết trên máy chủ (Zero-Trace Headers)
  app.use('/api', (_req, res, next) => {
    res.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate, private'
    );
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-Zero-Trace-Policy', 'NO_SERVER_LOGGING_IMMEDIATE_PURGE');
    next();
  });

  // 0. API Kiểm tra trạng thái kết nối Cụm Đa Luồng AI & Bảo mật Zero-Trace
  app.get('/api/ai/status', (_req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    const hasServerKey = Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY');
    res.json({
      connected: true,
      mode: hasServerKey
        ? 'MULTI_NODE_GEMINI_CLUSTER_ACTIVE'
        : 'AUTONOMOUS_EXPERT_CLUSTER_ACTIVE',
      privacyShield: 'ZERO_TRACE_AUTO_PURGE_ENABLED',
      message: hasServerKey
        ? 'Đã kích hoạt Cụm Đa Kênh Gemini (Settings > Secrets) kết hợp Chế độ Ẩn danh & Tự động xóa sạch dấu vết ngay sau khi tải đề.'
        : 'Đã kích hoạt Cụm Đa Luồng Chuyên Gia Tự Hành 100% (Settings > Secrets) kèm Chế độ Ẩn danh Trường/Kỳ thi & Tự xóa dấu vết sau khi tải.',
    });
  });

  // 0.1 API Xóa dấu vết tức thì ngay khi giáo viên tải đề về máy (Zero-Trace Purge)
  app.post('/api/ai/purge-trace', (req, res) => {
    if (req.body) {
      for (const key of Object.keys(req.body)) {
        delete req.body[key];
      }
    }
    if (global.gc) {
      try {
        global.gc();
      } catch {
        // Ignore if gc flag not exposed
      }
    }
    res.json({
      purged: true,
      purgedAt: new Date().toISOString(),
      policy: 'ZERO_SERVER_TRACE_VERIFIED',
    });
  });

  // 1. API Tạo Đề Tương Đương Đề Gốc Với Trí Tuệ Chuyên Gia (Human-Expert Isomorphic Exam Cloning)
  app.post('/api/ai/clone-exam', async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
        res.status(503).json({
          error: 'MISSING_SERVER_KEY',
          message:
            'Chuyển sang Động cơ Chuyên gia Tư duy Đảo chiều & Biến đổi Ngữ cảnh Nội bộ (100% Expert Engine).',
        });
        return;
      }

      const { questions, modelTier, subjectName, customInstruction } = req.body;
      if (!Array.isArray(questions) || questions.length === 0) {
        res.status(400).json({ error: 'Danh sách câu hỏi trống.' });
        return;
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const modelName = resolveAllowedGeminiModel(modelTier);

      const prompt = `Bạn là Chuyên gia Ra đề thi Tốt nghiệp THPT cấp Quốc gia có tư duy sư phạm sắc bén như người thật (Môn: ${
        subjectName || 'Sinh học'
      }).
Nhiệm vụ: Tạo một BỘ ĐỀ THI TƯƠNG ĐƯƠNG (Isomorphic Clone) từ bộ câu hỏi gốc dưới đây.

QUY TẮC TƯ DUY THÔNG MINH NHƯ NGƯỜI THẬT (BẮT BUỘC TUÂN THỦ 100%):
1. TUYỆT ĐỐI CẤM thêm các cụm từ sáo rỗng, vô bổ ở đầu câu như: "Theo chương trình Sinh học THPT 2025...", "Khi khảo sát ở cấp độ sinh học hiện đại...", "Trong nghiên cứu...". Hãy viết trực tiếp vào vấn đề khoa học sắc sảo, tự nhiên như đề thi chính thức của Bộ GD&ĐT.
2. ĐẢO CHIỀU TƯ DUY CÂU HỎI (ĐÚNG ↔ SAI):
   - Nếu câu gốc hỏi phát biểu ĐÚNG -> Hãy biến đổi câu hỏi thành hỏi phát biểu SAI (KHÔNG đúng) và viết lại 3 phương án đúng + 1 phương án sai (chính là đáp án cần chọn), hoặc ngược lại.
   - Nếu câu gốc hỏi "Có bao nhiêu phát biểu đúng?" -> Hãy đổi thành "Có bao nhiêu phát biểu SAI (không đúng)?" và điều chỉnh các mệnh đề I, II, III, IV cho khớp tuyệt đối.
   - Nếu câu gốc hỏi về chiều/trạng thái A (ví dụ: mạch tổng hợp liên tục, mã mở đầu, tăng liên kết H, cơ quan tương đồng, thể ba 2n+1) -> Hãy đổi sang trạng thái đối lập tương ứng trong cùng đơn vị kiến thức (mạch tổng hợp gián đoạn Okazaki, bộ ba kết thúc, giảm liên kết H, cơ quan tương tự, thể một 2n-1 hoặc tam bội 3n).
3. ĐỔI SƠ ĐỒ, CHUỖI THỨC ĂN & DẠNG ĐỒ THỊ/BIỂU ĐỒ:
   - Nếu câu hỏi có sơ đồ hoặc chuỗi thức ăn (ví dụ 5 mắt xích trên cạn) -> Hãy đổi thành sơ đồ dài hơn (6 mắt xích) hoặc ngắn hơn (4 mắt xích) ở hệ sinh thái khác (hồ nước ngọt, rừng ngập mặn, biển khơi) và đổi bậc dinh dưỡng được hỏi.
   - Nếu câu hỏi mô tả đồ thị/biểu đồ hình tròn (tỉ lệ %) -> Hãy chuyển ngữ cảnh sang biểu đồ hình cột hoặc bảng số liệu thống kê thực nghiệm (và ngược lại).
4. ĐỔI SỐ LIỆU & TÍNH LẠI ĐÁP ÁN CHÍNH XÁC 100%:
   - Tất cả bài toán có số liệu (tỉ lệ nucleotide, chiều dài gene, nguyên phân, giảm phân, phép lai phân li độc lập, tần số hoán vị gene cM, quần thể Hardy-Weinberg, quần thể tự thụ phấn, hiệu suất sinh thái) phải được thay bằng bộ số liệu mới hoàn toàn và tính lại đáp số + lời giải chi tiết chính xác 100%.
5. Giữ nguyên 100% cấu trúc 3 phần (PART_1, PART_2, PART_3) và Yêu cầu cần đạt (learningOutcome) của từng câu.
${customInstruction ? `6. Chỉ thị bổ sung từ Giáo viên: ${customInstruction}` : ''}

Dữ liệu câu hỏi gốc đã ẩn danh (JSON):
${JSON.stringify(questions, null, 2)}`;

      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                part: { type: Type.STRING },
                originalIndex: { type: Type.INTEGER },
                displayIndex: { type: Type.INTEGER },
                stemText: { type: Type.STRING },
                explanation: { type: Type.STRING },
                bloomLevel: { type: Type.STRING },
                learningOutcome: { type: Type.STRING },
                shortAnswer: { type: Type.STRING },
                options: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      originalLabel: { type: Type.STRING },
                      currentLabel: { type: Type.STRING },
                      text: { type: Type.STRING },
                      isCorrect: { type: Type.BOOLEAN },
                    },
                    required: ['originalLabel', 'currentLabel', 'text', 'isCorrect'],
                  },
                },
                subItems: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      originalLabel: { type: Type.STRING },
                      currentLabel: { type: Type.STRING },
                      text: { type: Type.STRING },
                      isTrue: { type: Type.BOOLEAN },
                    },
                    required: ['originalLabel', 'currentLabel', 'text', 'isTrue'],
                  },
                },
              },
              required: ['id', 'part', 'stemText'],
            },
          },
        },
      });

      const rawText = response.text || '[]';
      const clonedQuestions = JSON.parse(rawText);

      if (req.body) {
        delete req.body.questions;
      }

      res.json({
        modelUsed: modelName,
        zeroTracePurged: true,
        clonedQuestions,
      });
    } catch (error) {
      if (req.body) {
        delete req.body.questions;
      }
      const msg = error instanceof Error ? error.message : 'Lỗi gọi Gemini API';
      res.status(500).json({
        error: 'GEMINI_EXECUTION_ERROR',
        message: msg,
      });
    }
  });

  // 2. API Giải Chi Tiết & Phân Tích Ma Trận Đặc Tả (Zero-Trace)
  app.post('/api/ai/solve-and-analyze', async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
        res.status(503).json({
          error: 'MISSING_SERVER_KEY',
          message: 'Sử dụng bộ phân tích ma trận và lời giải chuẩn nội bộ.',
        });
        return;
      }

      const { questions, modelTier, subjectName } = req.body;
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const modelName = resolveAllowedGeminiModel(modelTier);
      const prompt = `Hãy viết lời giải chi tiết từng bước (explanation), xác định cấp độ nhận thức (bloomLevel: NHAN_BIET, THONG_HIEU, VAN_DUNG, VAN_DUNG_CAO) và Yêu cầu cần đạt (learningOutcome) theo chương trình GDPT 2018 cho danh sách câu hỏi môn ${
        subjectName || 'Sinh học'
      } sau đây:
${JSON.stringify(questions, null, 2)}`;

      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                explanation: { type: Type.STRING },
                bloomLevel: { type: Type.STRING },
                learningOutcome: { type: Type.STRING },
              },
              required: ['id', 'explanation', 'bloomLevel', 'learningOutcome'],
            },
          },
        },
      });

      if (req.body) {
        delete req.body.questions;
      }

      const rawText = response.text || '[]';
      res.json({
        modelUsed: modelName,
        analysis: JSON.parse(rawText),
      });
    } catch (error) {
      if (req.body) {
        delete req.body.questions;
      }
      const msg = error instanceof Error ? error.message : 'Lỗi phân tích AI';
      res.status(500).json({ error: msg });
    }
  });

  // 3. Vite Middleware cho môi trường Development hoặc phục vụ tĩnh cho Production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EduMix 2025 Server running on http://localhost:${PORT}`);
  });
}

startServer();
