import { ExamQuestion, ShuffleConfig } from '../types/exam';

export interface MatrixRowCV7991 {
  tt: number;
  topic: string; // Chủ đề / Mạch nội dung
  unit: string;  // Đơn vị kiến thức / Kĩ năng
  // Phần I: Trắc nghiệm 4 lựa chọn (Số câu)
  p1NhanBiet: number;
  p1ThongHieu: number;
  p1VanDung: number;
  // Phần II: Trắc nghiệm Đúng / Sai (Số lệnh hỏi a, b, c, d)
  p2NhanBiet: number;
  p2ThongHieu: number;
  p2VanDung: number;
  // Phần III: Trắc nghiệm trả lời ngắn (Số câu)
  p3NhanBiet: number;
  p3ThongHieu: number;
  p3VanDung: number;
  totalQuestionsOrCommands: number;
  totalScore: number;
  ratioPct: number;
}

export interface SpecificationRowCV7991 {
  tt: number;
  topic: string;
  unit: string;
  cognitiveLevel: 'Nhận biết' | 'Thông hiểu' | 'Vận dụng';
  learningOutcomes: string[]; // Yêu cầu cần đạt chuẩn GDPT 2018
  p1Count: number; // Số câu trắc nghiệm nhiều lựa chọn
  p2CommandCount: number; // Số lệnh hỏi trắc nghiệm đúng sai
  p3Count: number; // Số câu trắc nghiệm trả lời ngắn
}

export interface ExamMatrixSpecBundle {
  matrixRows: MatrixRowCV7991[];
  specRows: SpecificationRowCV7991[];
  summary: {
    totalP1: number;
    totalP2Questions: number;
    totalP2Commands: number;
    totalP3: number;
    nhanBietScore: number;
    thongHieuScore: number;
    vanDungScore: number;
    totalScore: number;
    nhanBietPct: number;
    thongHieuPct: number;
    vanDungPct: number;
  };
}

/**
 * Trích xuất chủ đề môn học và đơn vị kiến thức dựa vào nội dung câu hỏi
 */
export function detectQuestionTopicAndUnit(q: ExamQuestion): {
  topic: string;
  unit: string;
  defaultOutcomes: string[];
} {
  const text = (q.stemText || '').toLowerCase();

  // 1. TOÁN HỌC
  if (
    text.includes('hàm số') ||
    text.includes('đạo hàm') ||
    text.includes('đồng biến') ||
    text.includes('nghịch biến') ||
    text.includes('cực trị') ||
    text.includes('tiệm cận')
  ) {
    return {
      topic: 'Toán học: Giải tích',
      unit: 'Ứng dụng đạo hàm để khảo sát và vẽ đồ thị hàm số',
      defaultOutcomes: [
        'Nhận biết tính đơn điệu, cực trị, giá trị lớn nhất, nhỏ nhất của hàm số dựa vào bảng biến thiên hoặc đồ thị.',
        'Hiểu và xác định được các đường tiệm cận đứng, tiệm cận ngang của đồ thị hàm số phân thức.',
        'Vận dụng đạo hàm giải quyết bài toán tối ưu hóa trong thực tiễn.',
      ],
    };
  }
  if (
    text.includes('nguyên hàm') ||
    text.includes('tích phân') ||
    text.includes('\\int') ||
    text.includes('diện tích hình phẳng')
  ) {
    return {
      topic: 'Toán học: Giải tích',
      unit: 'Nguyên hàm, tích phân và ứng dụng hình học',
      defaultOutcomes: [
        'Nhận biết khái niệm và các tính chất cơ bản của nguyên hàm, tích phân.',
        'Tính được tích phân của các hàm số cơ bản bằng phương pháp đổi biến hoặc từng phần.',
        'Vận dụng tích phân để tính diện tích hình phẳng và thể tích khối tròn xoay.',
      ],
    };
  }
  if (
    text.includes('khối lập phương') ||
    text.includes('lăng trụ') ||
    text.includes('hình chóp') ||
    text.includes('góc giữa hai đường') ||
    text.includes('thể tích khối') ||
    text.includes('khoảng cách')
  ) {
    return {
      topic: 'Toán học: Hình học không gian',
      unit: 'Quan hệ vuông góc và thể tích khối đa diện',
      defaultOutcomes: [
        'Nhận biết quan hệ vuông góc giữa đường thẳng và mặt phẳng, giữa hai mặt phẳng.',
        'Tính được góc và khoảng cách giữa hai đường thẳng chéo nhau hoặc giữa điểm và mặt phẳng.',
        'Vận dụng công thức tính thể tích khối lăng trụ, hình chóp để giải quyết bài toán không gian.',
      ],
    };
  }
  if (text.includes('tọa độ') || text.includes('mặt phẳng (p)') || text.includes('oxyz') || text.includes('vectơ')) {
    return {
      topic: 'Toán học: Phương pháp tọa độ',
      unit: 'Hệ tọa độ trong không gian Oxyz',
      defaultOutcomes: [
        'Nhận biết tọa độ của điểm, vectơ, tích vô hướng trong không gian Oxyz.',
        'Viết được phương trình mặt cầu, mặt phẳng và đường thẳng trong không gian.',
        'Vận dụng phương pháp tọa độ để xác định vị trí tương đối và khoảng cách.',
      ],
    };
  }

  // 2. VẬT LÝ
  if (
    text.includes('dao động') ||
    text.includes('con lắc') ||
    text.includes('sóng cơ') ||
    text.includes('bước sóng') ||
    text.includes('sóng dừng') ||
    text.includes('chu kì') ||
    text.includes('tần số')
  ) {
    return {
      topic: 'Vật lí: Dao động và Sóng',
      unit: 'Dao động điều hòa và hiện tượng sóng dừng',
      defaultOutcomes: [
        'Nhận biết các đại lượng đặc trưng của dao động điều hòa (biên độ, tần số, chu kì, pha ban đầu).',
        'Giải thích được điều kiện tạo thành sóng dừng trên dây với hai đầu cố định.',
        'Vận dụng công thức xác định vận tốc truyền sóng, vị trí các nút và bụng sóng.',
      ],
    };
  }
  if (
    text.includes('điện xoay chiều') ||
    text.includes('mạch rlc') ||
    text.includes('hệ số công suất') ||
    text.includes('hiệu điện thế') ||
    text.includes('cường độ dòng điện')
  ) {
    return {
      topic: 'Vật lí: Dòng điện xoay chiều',
      unit: 'Mạch điện xoay chiều RLC mắc nối tiếp',
      defaultOutcomes: [
        'Nhận biết biểu thức của dòng điện và điện áp xoay chiều, hiện tượng cộng hưởng điện.',
        'Hiểu và vẽ được giản đồ vectơ Frenen cho mạch điện xoay chiều nối tiếp.',
        'Vận dụng tính công suất tiêu thụ và hệ số công suất của đoạn mạch.',
      ],
    };
  }

  // 3. HÓA HỌC
  if (
    text.includes('este') ||
    text.includes('xà phòng') ||
    text.includes('lipit') ||
    text.includes('glucozơ') ||
    text.includes('amin') ||
    text.includes('peptit') ||
    text.includes('thủy phân')
  ) {
    return {
      topic: 'Hóa học: Hợp chất hữu cơ có nhóm chức',
      unit: 'Este - Lipit và Carbohydrate',
      defaultOutcomes: [
        'Nhận biết khái niệm, công thức cấu tạo, tính chất vật lí và hóa học cơ bản của este, lipit.',
        'Viết phương trình hóa học phản ứng thủy phân este trong môi trường axit và môi trường kiềm.',
        'Vận dụng định luật bảo toàn khối lượng để giải toán phản ứng xà phòng hóa este đa chức.',
      ],
    };
  }
  if (
    text.includes('phản ứng') ||
    text.includes('thu khí') ||
    text.includes('h2so4') ||
    text.includes('kim loại') ||
    text.includes('oxi hóa - khử') ||
    text.includes('dd naoh')
  ) {
    return {
      topic: 'Hóa học: Vô cơ và Thí nghiệm thực hành',
      unit: 'Kim loại và phương pháp điều chế, thu khí phòng thí nghiệm',
      defaultOutcomes: [
        'Nhận biết các phương pháp thu khí trong phòng thí nghiệm (đẩy nước, đẩy không khí).',
        'Phân biệt được nguyên tắc hoạt động của các dụng cụ thí nghiệm hóa học cơ bản.',
        'Vận dụng phương pháp bảo toàn electron để giải quyết bài toán hỗn hợp kim loại tác dụng với axit.',
      ],
    };
  }

  // 4. SINH HỌC 12 (CHƯƠNG TRÌNH GDPT 2018 - HỌC KÌ I)
  if (
    text.includes('phả hệ') ||
    text.includes('phenylketone') ||
    text.includes('pku') ||
    text.includes('bạch tạng') ||
    text.includes('tư vấn di truyền') ||
    text.includes('di truyền học người')
  ) {
    return {
      topic: 'Chủ đề 4: Di truyền học người và Y học tư vấn',
      unit: 'Phân tích sơ đồ phả hệ và xác suất tư vấn di truyền ở người',
      defaultOutcomes: [
        'Nhận biết quy ước các kí hiệu trong sơ đồ phả hệ và các bệnh, tật di truyền phổ biến ở người.',
        'Xác định được quy luật di truyền của tính trạng bệnh (trội/lặn, trên NST thường hay NST giới tính) từ sơ đồ phả hệ.',
        'Vận dụng quy tắc nhân và cộng xác suất để tư vấn di truyền, tính xác suất sinh con bình thường hoặc mắc bệnh.',
      ],
    };
  }
  if (
    text.includes('quần thể') ||
    text.includes('ngẫu phối') ||
    text.includes('tự thụ phấn') ||
    text.includes('ưu thế lai') ||
    text.includes('lai khác dòng') ||
    text.includes('chọn giống') ||
    text.includes('hardy')
  ) {
    return {
      topic: 'Chủ đề 3: Di truyền học quần thể và Tạo giống',
      unit: 'Cấu trúc di truyền quần thể và Ứng dụng tạo giống ưu thế lai',
      defaultOutcomes: [
        'Nhận biết đặc điểm cấu trúc di truyền của quần thể tự thụ phấn và quần thể giao phối ngẫu nhiên.',
        'Giải thích được cơ sở di truyền của hiện tượng ưu thế lai và quy trình lai khác dòng kép.',
        'Vận dụng định luật Hardy-Weinberg và công thức quần thể tự thụ phấn để tính tần số allele, thành phần kiểu gene qua các thế hệ.',
      ],
    };
  }
  if (
    text.includes('nhiễm sắc thể') ||
    text.includes('nst') ||
    text.includes('nucleosome') ||
    text.includes('thể ba') ||
    text.includes('đa bội') ||
    text.includes('chuyển đoạn') ||
    text.includes('mất đoạn') ||
    text.includes('lặp đoạn') ||
    text.includes('đảo đoạn')
  ) {
    // Kiểm tra nếu là quy luật liên kết giới tính hoặc hoán vị thì ưu tiên sang Chủ đề 2
    if (
      !text.includes('ruồi giấm') &&
      !text.includes('tần số hoán vị') &&
      !text.includes('mắt đỏ') &&
      !text.includes('mắt trắng')
    ) {
      return {
        topic: 'Chủ đề 1: Di truyền phân tử và Di truyền nhiễm sắc thể',
        unit: 'Cấu trúc siêu hiển vi của NST và Đột biến nhiễm sắc thể',
        defaultOutcomes: [
          'Nhận biết cấu trúc siêu hiển vi của nhiễm sắc thể qua các mức xoắn (nucleosome, sợi cơ bản, sợi nhiễm sắc, chromatid).',
          'Phân biệt được các dạng đột biến cấu trúc NST (mất đoạn, lặp đoạn, đảo đoạn, chuyển đoạn) và đột biến lệch bội, đa bội.',
          'Vận dụng xác định số lượng NST và cơ chế không phân li của NST trong giảm phân.',
        ],
      };
    }
  }
  if (
    text.includes('mendel') ||
    text.includes('phân li độc lập') ||
    text.includes('tương tác') ||
    text.includes('hoán vị') ||
    text.includes('liên kết hoàn toàn') ||
    text.includes('liên kết giới tính') ||
    text.includes('ruồi giấm') ||
    text.includes('mắt đỏ') ||
    text.includes('ngoài nhân') ||
    text.includes('ti thể') ||
    text.includes('lục lạp') ||
    text.includes('phép lai') ||
    text.includes('kiểu hình')
  ) {
    return {
      topic: 'Chủ đề 2: Tính quy luật của hiện tượng di truyền',
      unit: 'Quy luật Mendel, Tương tác gene, Hoán vị gene, Liên kết giới tính & Di truyền ngoài nhân',
      defaultOutcomes: [
        'Nhận biết thí nghiệm của Mendel, Morgan, Correns và các quy luật phân li, phân li độc lập, liên kết gene, di truyền ngoài nhân.',
        'Giải thích được cơ sở tế bào học của quy luật phân li độc lập, hoán vị gene và sự di truyền chéo/thẳng của gene trên NST giới tính X, Y.',
        'Vận dụng giải các bài toán phép lai 2-3 cặp tính trạng, tính tần số hoán vị gene và xác định tỉ lệ kiểu gene, kiểu hình ở đời con.',
      ],
    };
  }
  if (
    text.includes('dna') ||
    text.includes('adn') ||
    text.includes('rna') ||
    text.includes('mrna') ||
    text.includes('trna') ||
    text.includes('phiên mã') ||
    text.includes('dịch mã') ||
    text.includes('amino acid') ||
    text.includes('operon') ||
    text.includes('đột biến điểm') ||
    text.includes('liên kết hydrogen') ||
    text.includes('nucleotide') ||
    text.includes('gene') ||
    text.includes('gen')
  ) {
    return {
      topic: 'Chủ đề 1: Di truyền phân tử và Di truyền nhiễm sắc thể',
      unit: 'Cấu trúc & Tái bản DNA, Phiên mã RNA, Dịch mã Protein, Điều hòa Operon Lac & Đột biến gene',
      defaultOutcomes: [
        'Nhận biết cấu trúc hóa học của DNA, các loại RNA, mã di truyền và các thành phần của Operon Lac ở vi khuẩn E. coli.',
        'Phân tích được cơ chế tái bản DNA, phiên mã, dịch mã và ảnh hưởng của các dạng đột biến điểm đến chuỗi polypeptide.',
        'Vận dụng các công thức liên hệ giữa chiều dài gene, số lượng nucleotide, số liên kết hydrogen và số phân tử tRNA/amino acid trong dịch mã.',
      ],
    };
  }

  // Mặc định tổng quát
  return {
    topic: 'Kiến thức cốt lõi Chương trình GDPT 2018',
    unit: 'Các chuyên đề trọng tâm theo định dạng đánh giá năng lực',
    defaultOutcomes: [
      'Nhận biết các khái niệm, quy tắc, định lí và công thức cơ bản.',
      'Hiểu và vận dụng trực tiếp các phương pháp giải bài tập vào tình huống cụ thể.',
      'Vận dụng linh hoạt kiến thức giải quyết vấn đề thực tiễn liên môn.',
    ],
  };
}

/**
 * Xây dựng toàn bộ Ma Trận (Phụ lục 1) và Bản Đặc Tả (Phụ lục 2) chuẩn theo Công văn 7991/BGDĐT-GDTrH
 */
export function buildCV7991MatrixAndSpecification(
  questions: ExamQuestion[]
): ExamMatrixSpecBundle {
  // Nhóm câu hỏi theo Chủ đề & Đơn vị kiến thức
  const groups = new Map<
    string,
    {
      topic: string;
      unit: string;
      questions: ExamQuestion[];
      defaultOutcomes: string[];
    }
  >();

  questions.forEach((q) => {
    const { topic, unit, defaultOutcomes } = detectQuestionTopicAndUnit(q);
    const key = `${topic}__${unit}`;
    if (!groups.has(key)) {
      groups.set(key, { topic, unit, questions: [], defaultOutcomes });
    }
    groups.get(key)!.questions.push(q);
  });

  const matrixRows: MatrixRowCV7991[] = [];
  const specRows: SpecificationRowCV7991[] = [];

  let rowCounter = 1;

  groups.forEach((group) => {
    let p1NB = 0;
    let p1TH = 0;
    let p1VD = 0;

    let p2NB = 0;
    let p2TH = 0;
    let p2VD = 0;

    let p3NB = 0;
    let p3TH = 0;
    let p3VD = 0;

    group.questions.forEach((q) => {
      const level = q.bloomLevel || 'NHAN_BIET';
      if (q.part === 'PART_1') {
        if (level === 'NHAN_BIET') p1NB++;
        else if (level === 'THONG_HIEU') p1TH++;
        else p1VD++;
      } else if (q.part === 'PART_2') {
        // Trong Phần II: Mỗi câu gồm 4 lệnh hỏi a, b, c, d
        // Theo chuẩn CV 7991: Đếm số lệnh hỏi tương ứng từng mức độ
        if (level === 'NHAN_BIET') {
          p2NB += 2;
          p2TH += 2;
        } else if (level === 'THONG_HIEU') {
          p2NB += 1;
          p2TH += 2;
          p2VD += 1;
        } else {
          p2TH += 2;
          p2VD += 2;
        }
      } else if (q.part === 'PART_3') {
        if (level === 'NHAN_BIET') p3NB++;
        else if (level === 'THONG_HIEU') p3TH++;
        else p3VD++;
      }
    });

    const totalP1InGroup = p1NB + p1TH + p1VD;
    const totalP2CommandsInGroup = p2NB + p2TH + p2VD;
    const totalP3InGroup = p3NB + p3TH + p3VD;
    const totalItems = totalP1InGroup + totalP2CommandsInGroup / 4 + totalP3InGroup;

    // Điểm số theo chuẩn đề thi 2025: Phần I: 0.25đ/câu; Phần II: 1đ/câu; Phần III: 0.25đ/câu
    const scoreP1 = totalP1InGroup * 0.25;
    const scoreP2 = (totalP2CommandsInGroup / 4) * 1.0;
    const scoreP3 = totalP3InGroup * 0.25;
    const totalScore = Math.round((scoreP1 + scoreP2 + scoreP3) * 100) / 100;
    const ratioPct = Math.round((totalScore / 10) * 100);

    matrixRows.push({
      tt: rowCounter,
      topic: group.topic,
      unit: group.unit,
      p1NhanBiet: p1NB,
      p1ThongHieu: p1TH,
      p1VanDung: p1VD,
      p2NhanBiet: p2NB,
      p2ThongHieu: p2TH,
      p2VanDung: p2VD,
      p3NhanBiet: p3NB,
      p3ThongHieu: p3TH,
      p3VanDung: p3VD,
      totalQuestionsOrCommands: Math.round(totalItems),
      totalScore,
      ratioPct,
    });

    // Tạo các dòng cho Bản Đặc Tả (Phụ lục 2)
    const levels: ('Nhận biết' | 'Thông hiểu' | 'Vận dụng')[] = [
      'Nhận biết',
      'Thông hiểu',
      'Vận dụng',
    ];

    levels.forEach((lvl, lvlIdx) => {
      const p1C = lvl === 'Nhận biết' ? p1NB : lvl === 'Thông hiểu' ? p1TH : p1VD;
      const p2CmdC = lvl === 'Nhận biết' ? p2NB : lvl === 'Thông hiểu' ? p2TH : p2VD;
      const p3C = lvl === 'Nhận biết' ? p3NB : lvl === 'Thông hiểu' ? p3TH : p3VD;

      if (p1C > 0 || p2CmdC > 0 || p3C > 0) {
        specRows.push({
          tt: rowCounter,
          topic: group.topic,
          unit: group.unit,
          cognitiveLevel: lvl,
          learningOutcomes: [
            group.defaultOutcomes[lvlIdx] ||
              `${lvl} kiến thức trọng tâm của chuyên đề ${group.unit}.`,
          ],
          p1Count: p1C,
          p2CommandCount: p2CmdC,
          p3Count: p3C,
        });
      }
    });

    rowCounter++;
  });

  // Tính tổng điểm và tỉ lệ toàn đề
  let totalP1 = 0;
  let totalP2Commands = 0;
  let totalP3 = 0;

  let nhanBietScore = 0;
  let thongHieuScore = 0;
  let vanDungScore = 0;

  matrixRows.forEach((r) => {
    totalP1 += r.p1NhanBiet + r.p1ThongHieu + r.p1VanDung;
    totalP2Commands += r.p2NhanBiet + r.p2ThongHieu + r.p2VanDung;
    totalP3 += r.p3NhanBiet + r.p3ThongHieu + r.p3VanDung;

    nhanBietScore += r.p1NhanBiet * 0.25 + (r.p2NhanBiet / 4) * 1.0 + r.p3NhanBiet * 0.25;
    thongHieuScore += r.p1ThongHieu * 0.25 + (r.p2ThongHieu / 4) * 1.0 + r.p3ThongHieu * 0.25;
    vanDungScore += r.p1VanDung * 0.25 + (r.p2VanDung / 4) * 1.0 + r.p3VanDung * 0.25;
  });

  const totalScore = Math.round((nhanBietScore + thongHieuScore + vanDungScore) * 10) / 10 || 10;
  const nhanBietPct = Math.round((nhanBietScore / totalScore) * 100);
  const thongHieuPct = Math.round((thongHieuScore / totalScore) * 100);
  const vanDungPct = 100 - nhanBietPct - thongHieuPct;

  return {
    matrixRows,
    specRows,
    summary: {
      totalP1,
      totalP2Questions: Math.round(totalP2Commands / 4),
      totalP2Commands,
      totalP3,
      nhanBietScore: Math.round(nhanBietScore * 10) / 10,
      thongHieuScore: Math.round(thongHieuScore * 10) / 10,
      vanDungScore: Math.round(vanDungScore * 10) / 10,
      totalScore,
      nhanBietPct,
      thongHieuPct,
      vanDungPct,
    },
  };
}
