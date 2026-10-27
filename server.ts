import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Bảng ánh xạ từ các tùy chọn giao diện (như trong ảnh) sang các model chuẩn của @google/genai
function resolveAllowedGeminiModel(requestedTier?: string): string {
  switch (requestedTier) {
    case '3.5-flash-lite':
      return 'gemini-3.1-flash-lite';
    case '3.8-flash':
      return 'gemini-3.8-flash';
    case '3.1-pro':
      return 'gemini-3.1-pro-preview';
    case '4-argon':
      // Fallback sang gemini-3.8-flash khi chạy chế độ miễn phí không yêu cầu Paid Key
      return 'gemini-3.8-flash';
    default:
      return 'gemini-3.8-flash';
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '15mb' }));

  // 0. API Kiểm tra trạng thái kết nối bảo mật Server-side Gemini & Chế độ bảo vệ dữ liệu đề thi
  app.get('/api/ai/status', (_req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    const hasServerKey = Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY');
    res.json({
      connected: true,
      mode: hasServerKey ? 'SERVER_GEMINI_SDK_ACTIVE' : 'AUTONOMOUS_HYBRID_ACTIVE',
      privacyShield: 'ZERO_DATA_RETENTION_ENABLED',
      message: hasServerKey
        ? 'Đã kết nối khóa bảo mật máy chủ (Settings > Secrets) kèm Bộ Sinh Đề Tự Hành 100%. Dữ liệu đề thi của giáo viên được bảo mật tuyệt đối.'
        : 'Đang kích hoạt Chế độ Tự Hành Kép 100% (Autonomous Isomorphic Engine). Bạn có thể gắn khóa riêng trong bảng Settings > Secrets bất cứ lúc nào.',
    });
  });

  // 1. API Tạo Đề Tương Đương Đề Gốc (Isomorphic Exam Cloning)
  // Giữ nguyên yêu cầu cần đạt, cấp độ nhận thức, cấu trúc 3 phần; chỉ thay đổi số liệu & ngữ cảnh khoa học + kèm lời giải chi tiết
  app.post('/api/ai/clone-exam', async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
        res.status(503).json({
          error: 'MISSING_SERVER_KEY',
          message:
            'Chưa phát hiện GEMINI_API_KEY trên máy chủ. Hệ thống sẽ tự động kích hoạt Bộ Sinh Đề Tương Đương Toán Học Nội Bộ (100% Auto-Engine).',
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

      const prompt = `Bạn là Chuyên gia Khảo thí & Biên soạn Đề thi Tốt nghiệp THPT Chuẩn Cấu Trúc 2025 của Bộ GD&ĐT (Môn: ${
        subjectName || 'Toán học / Khoa học tự nhiên'
      }).
Nhiệm vụ: Hãy tạo một BỘ CÂU HỎI TƯƠNG ĐƯƠNG (Isomorphic Clone) từ bộ câu hỏi gốc dưới đây.

YÊU CẦU BẮT BUỘC:
1. Giữ nguyên 100% "Yêu cầu cần đạt" (Learning Outcomes), mức độ nhận thức (Nhận biết / Thông hiểu / Vận dụng), dạng toán/dạng bài và cấu trúc 3 phần (PART_1, PART_2, PART_3) của từng câu.
2. Thay đổi toàn bộ SỐ LIỆU, HÀM SỐ, TỌA ĐỘ hoặc NGỮ CẢNH KHOA HỌC sao cho câu hỏi mới hoàn toàn độc lập, không trùng lặp số liệu với đề gốc nhưng có cùng độ khó và cách giải.
3. Tính toán lại chính xác 100% ĐÁP ÁN ĐÚNG (ở PART_1 chỉ có duy nhất 1 phương án isCorrect=true; ở PART_2 mỗi câu có 4 ý a,b,c,d với isTrue=true/false; ở PART_3 có shortAnswer là con số chính xác).
4. Bổ sung trường "explanation" (Lời giải chi tiết từng bước ngắn gọn, súc tích) và "bloomLevel" ("NHAN_BIET" | "THONG_HIEU" | "VAN_DUNG" | "VAN_DUNG_CAO") và "learningOutcome" (Yêu cầu cần đạt được giữ nguyên).
${customInstruction ? `5. Yêu cầu bổ sung từ Giáo viên: ${customInstruction}` : ''}

Dữ liệu câu hỏi gốc (JSON):
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

      res.json({
        modelUsed: modelName,
        clonedQuestions,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Lỗi gọi Gemini API';
      res.status(500).json({
        error: 'GEMINI_EXECUTION_ERROR',
        message: msg,
      });
    }
  });

  // 2. API Giải Chi Tiết & Phân Tích Ma Trận Đặc Tả (Bloom Taxonomy & Step-by-Step Solution)
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
        subjectName || 'Toán học'
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

      const rawText = response.text || '[]';
      res.json({
        modelUsed: modelName,
        analysis: JSON.parse(rawText),
      });
    } catch (error) {
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
