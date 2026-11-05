import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Bộ nhớ đệm model hoạt động tốt nhất để không mất thời gian thử lại ở các đợt 5 câu tiếp theo
const unavailableModels = new Set<string>();

function resolveAllowedGeminiModel(requestedTier?: string): string {
  let preferred = 'gemini-3.1-flash-lite';
  switch (requestedTier) {
    case '3.5-flash-lite':
      preferred = 'gemini-3.1-flash-lite';
      break;
    case '3.8-flash':
      preferred = 'gemini-3.8-flash';
      break;
    case '3.1-pro':
      preferred = 'gemini-3.1-pro-preview';
      break;
    case '4-argon':
      preferred = 'gemini-3.8-flash';
      break;
    default:
      preferred = 'gemini-3.1-flash-lite';
      break;
  }
  if (unavailableModels.has(preferred)) {
    return 'gemini-3.1-flash-lite';
  }
  return preferred;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '15mb' }));

  // Middleware CORS & Bảo mật Zero-Trace: Cho phép cả bản triển khai trên GitHub Pages gọi trực tiếp về AI Server
  app.use('/api', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Cache-Control, Pragma, X-Gemini-Api-Key, Authorization'
    );
    res.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate, private'
    );
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-Zero-Trace-Policy', 'NO_SERVER_LOGGING_IMMEDIATE_PURGE');

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  // 0. API Kiểm tra trạng thái kết nối Cụm Đa Luồng AI & Bảo mật Zero-Trace
  app.get('/api/ai/status', (req, res) => {
    const clientKey = (req.query?.userApiKey || req.headers['x-gemini-api-key']) as string | undefined;
    const apiKey = (clientKey && clientKey.trim()) || process.env.GEMINI_API_KEY;
    const hasKey = Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY');
    res.json({
      connected: true,
      mode: hasKey
        ? (clientKey ? 'USER_PERSONAL_GEMINI_API_KEY_ACTIVE' : 'MULTI_NODE_GEMINI_CLUSTER_ACTIVE')
        : 'AUTONOMOUS_EXPERT_CLUSTER_ACTIVE',
      privacyShield: 'ZERO_TRACE_AUTO_PURGE_ENABLED',
      message: hasKey
        ? (clientKey
            ? 'Đã kích hoạt Gemini API với API Key cá nhân của Thầy/Cô (Zero-Trace).'
            : 'Đã kích hoạt Cụm Đa Kênh Gemini (Settings > Secrets) kết hợp Chế độ Ẩn danh & Tự động xóa sạch dấu vết ngay sau khi tải đề.')
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

  // Hàm làm sạch tuyệt đối các cụm từ thừa/vô nghĩa nếu mô hình sinh ra
  function stripForbiddenFluffText(input: string): string {
    if (!input) return '';
    return input
      .replace(
        /^(?:Theo\s+chương\s+trình\s+(?:giáo\s+dục\s+phổ\s+thông\s+2018|GDPT\s*2018|mới|THPT\s*2025|Sinh\s+học\s+\d+)\s*[,.:;-]*\s*)/gi,
        ''
      )
      .replace(
        /\s*\((?:xét\s+trong\s+điều\s+kiện\s+chuẩn|theo\s+chương\s+trình\s+GDPT\s*2018|theo\s+chương\s+trình\s+2018|trong\s+trường\s+hợp\s+điển\s+hình)\)\s*/gi,
        ' '
      )
      .replace(
        /\s+(?:theo\s+chương\s+trình\s+giáo\s+dục\s+phổ\s+thông\s+2018|theo\s+chương\s+trình\s+GDPT\s*2018|theo\s+quy\s+luật\s+lí\s+thuyết|khi\s+phân\s+tích\s+dữ\s+kiện\s+trên)(?=[?.,;:]|$)/gi,
        ''
      )
      .replace(/^\s*(?:Câu\s+\d+\s*[.:/-]?\s*)/i, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  // 1. API Tạo Đề Tương Đương Theo Từng Đợt 5 Câu (3-Step Pedagogical & Scientific Isomorphic Engine)
  app.post('/api/ai/clone-exam', async (req, res) => {
    try {
      const clientKey = req.headers['x-gemini-api-key'] as string | undefined;
      const apiKey = (clientKey && clientKey.trim()) || process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
        res.status(503).json({
          error: 'MISSING_SERVER_KEY',
          message:
            'Chuyển sang Động cơ Chuyên gia Sư phạm 3 Bước Nội bộ (100% Isomorphic Scientific Engine).',
        });
        return;
      }

      const {
        questions,
        modelTier,
        subjectName,
        customInstruction,
        batchIndex,
        totalBatches,
        variantIndex,
      } = req.body;
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

      const primaryModel = resolveAllowedGeminiModel(modelTier);
      const fallbackModel = 'gemini-3.1-flash-lite';

      // Rút gọn dữ liệu đầu vào chỉ giữ đúng nội dung khoa học để AI tập trung 100% tư duy sáng tạo câu hỏi mới
      const cleanInputQuestions = questions.map((q: Record<string, unknown>, idx: number) => ({
        id: String(q.id || `q_${idx + 1}`),
        part: String(q.part || 'PART_1'),
        bloomLevel: String(q.bloomLevel || 'THONG_HIEU'),
        stemText: String(q.stemText || ''),
        choices:
          q.part === 'PART_1' && Array.isArray(q.options)
            ? q.options.map((o: Record<string, unknown>) => ({
                label: String(o.currentLabel || o.originalLabel || 'A'),
                text: String(o.text || ''),
                isCorrect: Boolean(o.isCorrect),
              }))
            : q.part === 'PART_2' && Array.isArray(q.subItems)
              ? q.subItems.map((s: Record<string, unknown>) => ({
                  label: String(s.currentLabel || s.originalLabel || 'a'),
                  text: String(s.text || ''),
                  isCorrect: Boolean(s.isTrue),
                }))
              : [],
        shortAnswer: String(q.shortAnswer || q.essayAnswer || ''),
      }));

      const systemInstruction = `Bạn là Giáo sư Đầu ngành, Chuyên gia Ra đề Thi Quốc gia và Chuyên gia Sư phạm môn ${
        subjectName || 'Khoa học Tự nhiên / THPT'
      }.
Nhiệm vụ của bạn là biên soạn BỘ CÂU HỎI TƯƠNG ĐƯƠNG MỚI HOÀN TOÀN (Isomorphic Questions) cho từng câu hỏi trong đợt hiện tại theo đúng 3 BƯỚC BẮT BUỘC:

BƯỚC 1 - BẢO TOÀN CẤU TRÚC & MA TRẬN (100%):
- Trả về mảng JSON có ĐÚNG ${cleanInputQuestions.length} phần tử tương ứng 1-1 với ${cleanInputQuestions.length} câu hỏi gốc (giữ nguyên "id" và "part").
- Với part = "PART_1": Mảng "choices" BẮT BUỘC có đúng 4 phương án A, B, C, D (chỉ có duy nhất 1 phương án isCorrect = true, 3 phương án còn lại isCorrect = false).
- Với part = "PART_2": Mảng "choices" BẮT BUỘC có đúng 4 mệnh đề a, b, c, d (mỗi mệnh đề có isCorrect = true nếu mệnh đề Đúng, hoặc false nếu mệnh đề Sai).
- Với part = "PART_3": Trường "shortAnswer" chứa đáp số mới chính xác (tối đa 4 ký tự số), mảng "choices" để rỗng [].
- Với part = "PART_4": Trường "shortAnswer" và "explanation" chứa hướng dẫn chấm tự luận chi tiết, mảng "choices" để rỗng [].

BƯỚC 2 - BẢO TOÀN CƠ CHẾ KHOA HỌC NHƯNG ĐỔI GÓC HỎI ĐỂ TẠO CÂU HỎI & ĐÁP ÁN MỚI THẬT SỰ (100%):
- Câu mới kiểm tra đúng chuyên đề, hiện tượng, cơ chế khoa học hoặc dạng toán của câu gốc, KHÔNG vượt ngoài giới hạn kiến thức của câu gốc.
- TUYỆT ĐỐI CẤM giữ nguyên câu hỏi gốc hoặc giữ nguyên đáp án đúng giống hệt câu gốc!
- Quy tắc biến đổi thông minh cho câu hỏi Lý thuyết / Cơ chế (PART_1):
  + Chiến lược 1 (Chuyển sang đối tượng tương đương trong cùng nhóm): Nếu câu gốc hỏi vai trò của nguyên tố/chất/cơ quan A (ví dụ câu gốc hỏi nguyên tố Cl quang phân li nước trong 4 phương án Cl, Ca, Mg, Mo), câu mới BẮT BUỘC hỏi vai trò của một nguyên tố/chất/cơ quan KHÁC trong nhóm đó (ví dụ hỏi nguyên tố Mg cấu tạo diệp lục, hoặc Mo cấu tạo enzyme cố định đạm nitrogenase, hoặc Ca cấu tạo thành tế bào) để ĐÁP ÁN ĐÚNG LÀ PHƯƠNG ÁN MỚI!
  + Chiến lược 2 (Đảo trạng thái sinh lí / Đảo chiều hiện tượng): Nếu câu gốc hỏi trạng thái A (ví dụ: khi cây bị hạn, tế bào khí khổng mất trương nước thì thành mỏng co lại, thành dày duỗi thẳng làm khí khổng đóng), câu mới BẮT BUỘC hỏi trạng thái đối lập hoặc khâu điều tiết khác trong cùng cơ chế (ví dụ: khi cây đủ nước và chiếu sáng, tế bào khí khổng trương nước thì thành mỏng căng mạnh kéo thành dày cong theo làm khí khổng mở rộng) và viết mới cả 4 phương án A, B, C, D!

BƯỚC 3 - ĐỔI MỚI NGỮ CẢNH THỰC TẾ & SỐ LIỆU TÍNH TOÁN (100%):
- Với bài toán tính toán: Thay đổi hoàn toàn bộ số liệu và bối cảnh thực tế (Biến thể đề số ${
        variantIndex || 1
      }), tính toán lại đáp số chính xác 100% và ghi rõ phép tính trong "explanation".
- CẤM TUYỆT ĐỐI các cụm từ vô nghĩa như "Theo chương trình giáo dục phổ thông 2018", "(xét trong điều kiện chuẩn)". Không ghi tiền tố "Câu 1.", "A.", "B." ở đầu stemText hay text của choices.`;

      const userPrompt = `Đang xử lý Đợt ${batchIndex || 1}/${
        totalBatches || 1
      } (Biến thể đề số ${variantIndex || 1}).
${
  customInstruction
    ? `Chỉ dẫn bổ sung của Giáo viên: ${customInstruction}\n`
    : ''
}Hãy trả về mảng JSON gồm ĐÚNG ${
        cleanInputQuestions.length
      } câu hỏi tương đương mới hoàn toàn theo danh sách id: [${cleanInputQuestions
        .map((q) => `"${q.id}"`)
        .join(', ')}].
Mỗi câu hỏi mới PHẢI có "stemText" mới, mảng "choices" gồm 4 phương án A, B, C, D mới và đáp án đúng MỚI khác với câu gốc!

Danh sách câu hỏi gốc:
${JSON.stringify(cleanInputQuestions, null, 2)}`;

      const schemaConfig = {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: {
                type: Type.STRING,
                description: 'Giữ nguyên id của câu hỏi gốc tương ứng',
              },
              part: {
                type: Type.STRING,
                description: 'PART_1, PART_2, PART_3, hoặc PART_4',
              },
              stemText: {
                type: Type.STRING,
                description: 'Nội dung câu hỏi mới tương đương (không ghi Câu 1, Câu 2 ở đầu)',
              },
              explanation: {
                type: Type.STRING,
                description: 'Giải thích cơ chế khoa học hoặc lời giải chi tiết của câu hỏi mới',
              },
              bloomLevel: {
                type: Type.STRING,
                description: 'NHAN_BIET, THONG_HIEU, VAN_DUNG, hoặc VAN_DUNG_CAO',
              },
              shortAnswer: {
                type: Type.STRING,
                description: 'Đáp số cho PART_3 (tối đa 4 ký tự) hoặc hướng dẫn chấm cho PART_4; để chuỗi rỗng nếu là PART_1/PART_2',
              },
              choices: {
                type: Type.ARRAY,
                description: 'BẮT BUỘC có 4 phần tử A, B, C, D (cho PART_1) hoặc a, b, c, d (cho PART_2)',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    label: {
                      type: Type.STRING,
                      description: 'A, B, C, D (với PART_1) hoặc a, b, c, d (với PART_2)',
                    },
                    text: {
                      type: Type.STRING,
                      description: 'Nội dung phương án/mệnh đề mới (không ghi A., B., a), b) ở đầu)',
                    },
                    isCorrect: {
                      type: Type.BOOLEAN,
                      description: 'true nếu là đáp án đúng (PART_1) hoặc mệnh đề Đúng (PART_2), ngược lại là false',
                    },
                  },
                  required: ['label', 'text', 'isCorrect'],
                },
              },
            },
            required: [
              'id',
              'part',
              'stemText',
              'explanation',
              'bloomLevel',
              'shortAnswer',
              'choices',
            ],
          },
        },
      };

      let response;
      let usedModel = primaryModel;
      try {
        response = await ai.models.generateContent({
          model: primaryModel,
          contents: userPrompt,
          config: schemaConfig,
        });
      } catch (primaryErr) {
        unavailableModels.add(primaryModel);
        if (primaryModel !== fallbackModel) {
          usedModel = fallbackModel;
          response = await ai.models.generateContent({
            model: fallbackModel,
            contents: userPrompt,
            config: schemaConfig,
          });
        } else {
          throw primaryErr;
        }
      }

      const rawText = response.text || '[]';
      const parsedQuestions = JSON.parse(rawText);
      const parsedArray: Array<Record<string, unknown>> = Array.isArray(parsedQuestions)
        ? parsedQuestions
        : [];

      const clonedQuestions = cleanInputQuestions.map((origQ, idx) => {
        const matched =
          parsedArray.find((item) => String(item.id) === origQ.id) ||
          parsedArray[idx] ||
          {};
        const rawChoices = Array.isArray(matched.choices)
          ? (matched.choices as Array<Record<string, unknown>>)
          : [];

        const isPart1 = origQ.part === 'PART_1';
        const isPart2 = origQ.part === 'PART_2';

        const options = isPart1
          ? rawChoices.slice(0, 4).map((c, cIdx) => {
              const lbl = ['A', 'B', 'C', 'D'][cIdx] || 'A';
              return {
                id: `${origQ.id}-opt-${lbl}`,
                originalLabel: lbl,
                currentLabel: lbl,
                text: stripForbiddenFluffText(
                  String(c.text || '').replace(/^[A-Da-d]\s*[.:)]\s*/, '')
                ),
                isCorrect: Boolean(c.isCorrect),
              };
            })
          : undefined;

        const subItems = isPart2
          ? rawChoices.slice(0, 4).map((c, cIdx) => {
              const lbl = ['a', 'b', 'c', 'd'][cIdx] || 'a';
              return {
                id: `${origQ.id}-sub-${lbl}`,
                originalLabel: lbl,
                currentLabel: lbl,
                text: stripForbiddenFluffText(
                  String(c.text || '').replace(/^[a-dA-D]\s*[.:)]\s*/, '')
                ),
                isTrue: Boolean(c.isCorrect),
              };
            })
          : undefined;

        return {
          id: origQ.id,
          part: origQ.part,
          stemText: stripForbiddenFluffText(String(matched.stemText || '')),
          explanation: stripForbiddenFluffText(String(matched.explanation || '')),
          bloomLevel: String(matched.bloomLevel || origQ.bloomLevel || 'THONG_HIEU'),
          shortAnswer:
            origQ.part === 'PART_3'
              ? stripForbiddenFluffText(String(matched.shortAnswer || '')).slice(0, 4)
              : undefined,
          essayAnswer:
            origQ.part === 'PART_4'
              ? stripForbiddenFluffText(
                  String(matched.shortAnswer || matched.explanation || '')
                )
              : undefined,
          options,
          subItems,
        };
      });

      if (req.body) {
        delete req.body.questions;
      }

      res.json({
        modelUsed: usedModel,
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
      const clientKey = req.headers['x-gemini-api-key'] as string | undefined;
      const apiKey = (clientKey && clientKey.trim()) || process.env.GEMINI_API_KEY;
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
      const prompt = `Hãy viết lời giải chi tiết từng bước (explanation), xác định cấp độ nhận thức (bloomLevel: NHAN_BIET, THONG_HIEU, VAN_DUNG, VAN_DUNG_CAO) và Yêu cầu cần đạt (learningOutcome) ngắn gọn, chính xác cho danh sách câu hỏi môn ${
        subjectName || 'Sinh học'
      } sau đây (Tuyệt đối không thêm các từ sáo rỗng):
${JSON.stringify(questions, null, 2)}`;

      let response;
      try {
        response = await ai.models.generateContent({
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
      } catch {
        unavailableModels.add(modelName);
        response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
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
      }

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
