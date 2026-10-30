import { ExamQuestion, FeatureReleaseItem } from '../types/exam';

/**
 * Các chuỗi SVG vector độ phân giải cao (300 DPI, nền trắng tinh khiết #FFFFFF)
 * Dùng làm hình minh họa chuẩn cho đề thi mẫu tổng hợp Đánh Giá Năng Lực (Toán - Lý - Hóa - Sinh)
 */

// 1. Hình khối lập phương ABCD.A'B'C'D' (Toán học không gian)
const SVG_CUBE_3D = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 340" width="460" height="340" style="background:#FFFFFF">
  <rect width="100%" height="100%" fill="#FFFFFF"/>
  <line x1="80" y1="250" x2="180" y2="180" stroke="#0F172A" stroke-width="2" stroke-dasharray="6,5"/>
  <line x1="180" y1="180" x2="350" y2="180" stroke="#0F172A" stroke-width="2" stroke-dasharray="6,5"/>
  <line x1="180" y1="180" x2="180" y2="40" stroke="#0F172A" stroke-width="2" stroke-dasharray="6,5"/>
  <polygon points="80,250 250,250 250,110 80,110" fill="#F8FAFC" fill-opacity="0.3" stroke="#0F172A" stroke-width="2.5"/>
  <polygon points="80,110 250,110 350,40 180,40" fill="#F1F5F9" fill-opacity="0.6" stroke="#0F172A" stroke-width="2.5"/>
  <polygon points="250,250 350,180 350,40 250,110" fill="#E2E8F0" fill-opacity="0.5" stroke="#0F172A" stroke-width="2.5"/>
  <line x1="80" y1="250" x2="348" y2="42" stroke="#DC2626" stroke-width="2.5" stroke-dasharray="5,4"/>
  <circle cx="80" cy="250" r="4" fill="#0F172A"/>
  <circle cx="250" cy="250" r="4" fill="#0F172A"/>
  <circle cx="350" cy="180" r="4" fill="#0F172A"/>
  <circle cx="180" cy="180" r="4" fill="#0F172A"/>
  <circle cx="80" cy="110" r="4" fill="#0F172A"/>
  <circle cx="250" cy="110" r="4" fill="#0F172A"/>
  <circle cx="350" cy="40" r="4" fill="#0F172A"/>
  <circle cx="180" cy="40" r="4" fill="#0F172A"/>
  <text x="58" y="265" font-family="Times New Roman, serif" font-size="18" font-weight="bold" fill="#0F172A">A</text>
  <text x="255" y="268" font-family="Times New Roman, serif" font-size="18" font-weight="bold" fill="#0F172A">B</text>
  <text x="358" y="190" font-family="Times New Roman, serif" font-size="18" font-weight="bold" fill="#0F172A">C</text>
  <text x="185" y="195" font-family="Times New Roman, serif" font-size="18" font-weight="bold" fill="#0F172A">D</text>
  <text x="58" y="105" font-family="Times New Roman, serif" font-size="18" font-weight="bold" fill="#0F172A">A'</text>
  <text x="255" y="105" font-family="Times New Roman, serif" font-size="18" font-weight="bold" fill="#0F172A">B'</text>
  <text x="358" y="38" font-family="Times New Roman, serif" font-size="18" font-weight="bold" fill="#0F172A">C'</text>
  <text x="170" y="35" font-family="Times New Roman, serif" font-size="18" font-weight="bold" fill="#0F172A">D'</text>
  <text x="210" y="145" font-family="Times New Roman, serif" font-size="15" font-style="italic" font-weight="bold" fill="#DC2626">u = AC'</text>
  <text x="160" y="270" font-family="Times New Roman, serif" font-size="14" font-style="italic" fill="#334155">cạnh = a</text>
</svg>`;

// 2. Đồ thị hàm số bậc ba y = x^3 - 3x^2 + 2 (Toán học giải tích)
const SVG_CUBIC_GRAPH = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 340" width="460" height="340" style="background:#FFFFFF">
  <rect width="100%" height="100%" fill="#FFFFFF"/>
  <line x1="30" y1="170" x2="430" y2="170" stroke="#334155" stroke-width="2"/>
  <polygon points="430,170 422,165 422,175" fill="#334155"/>
  <text x="434" y="174" font-family="Times New Roman, serif" font-size="16" font-style="italic" font-weight="bold">x</text>
  <line x1="160" y1="320" x2="160" y2="25" stroke="#334155" stroke-width="2"/>
  <polygon points="160,25 155,33 165,33" fill="#334155"/>
  <text x="154" y="18" font-family="Times New Roman, serif" font-size="16" font-style="italic" font-weight="bold">y</text>
  <text x="145" y="186" font-family="Times New Roman, serif" font-size="15" font-weight="bold">O</text>
  <circle cx="160" cy="50" r="4.5" fill="#DC2626"/>
  <text x="138" y="55" font-family="Times New Roman, serif" font-size="15" font-weight="bold">2</text>
  <text x="75" y="45" font-family="Times New Roman, serif" font-size="13" font-weight="bold" fill="#DC2626">Cực đại (0; 2)</text>
  <circle cx="280" cy="290" r="4.5" fill="#2563EB"/>
  <line x1="280" y1="170" x2="280" y2="290" stroke="#94A3B8" stroke-width="1.5" stroke-dasharray="4,4"/>
  <line x1="160" y1="290" x2="280" y2="290" stroke="#94A3B8" stroke-width="1.5" stroke-dasharray="4,4"/>
  <text x="276" y="188" font-family="Times New Roman, serif" font-size="15" font-weight="bold">2</text>
  <text x="138" y="295" font-family="Times New Roman, serif" font-size="15" font-weight="bold">-2</text>
  <text x="290" y="305" font-family="Times New Roman, serif" font-size="13" font-weight="bold" fill="#2563EB">Cực tiểu (2; -2)</text>
  <circle cx="220" cy="170" r="3.5" fill="#0F172A"/>
  <text x="216" y="188" font-family="Times New Roman, serif" font-size="15" font-weight="bold">1</text>
  <path d="M 85,320 C 130,110 140,50 160,50 C 190,50 210,130 220,170 C 230,210 260,290 280,290 C 300,290 320,170 345,35" fill="none" stroke="#2563EB" stroke-width="3"/>
  <text x="325" y="28" font-family="Times New Roman, serif" font-size="15" font-style="italic" font-weight="bold" fill="#2563EB">y = f(x)</text>
</svg>`;

// 3. Đồ thị dao động điều hòa li độ - thời gian x - t (Vật lý học)
const SVG_OSCILLATION_GRAPH = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 280" width="480" height="280" style="background:#FFFFFF">
  <rect width="100%" height="100%" fill="#FFFFFF"/>
  <line x1="40" y1="140" x2="445" y2="140" stroke="#334155" stroke-width="2"/>
  <polygon points="445,140 437,135 437,145" fill="#334155"/>
  <text x="448" y="144" font-family="Times New Roman, serif" font-size="16" font-style="italic" font-weight="bold">t (s)</text>
  <line x1="70" y1="260" x2="70" y2="25" stroke="#334155" stroke-width="2"/>
  <polygon points="70,25 65,33 75,33" fill="#334155"/>
  <text x="50" y="20" font-family="Times New Roman, serif" font-size="16" font-style="italic" font-weight="bold">x (cm)</text>
  <text x="55" y="155" font-family="Times New Roman, serif" font-size="15" font-weight="bold">O</text>
  <text x="46" y="55" font-family="Times New Roman, serif" font-size="15" font-weight="bold">+4</text>
  <line x1="66" y1="50" x2="74" y2="50" stroke="#334155" stroke-width="1.5"/>
  <line x1="70" y1="50" x2="420" y2="50" stroke="#E2E8F0" stroke-width="1.5" stroke-dasharray="3,3"/>
  <text x="48" y="235" font-family="Times New Roman, serif" font-size="15" font-weight="bold">-4</text>
  <line x1="66" y1="230" x2="74" y2="230" stroke="#334155" stroke-width="1.5"/>
  <line x1="70" y1="230" x2="420" y2="230" stroke="#E2E8F0" stroke-width="1.5" stroke-dasharray="3,3"/>
  <path d="M 70,50 C 115,50 125,140 155,140 C 185,140 205,230 240,230 C 275,230 295,140 325,140 C 355,140 380,50 410,50" fill="none" stroke="#059669" stroke-width="3"/>
  <circle cx="70" cy="50" r="4" fill="#059669"/>
  <circle cx="155" cy="140" r="3.5" fill="#0F172A"/>
  <circle cx="240" cy="230" r="4" fill="#059669"/>
  <circle cx="325" cy="140" r="3.5" fill="#0F172A"/>
  <circle cx="410" cy="50" r="4" fill="#059669"/>
  <text x="145" y="162" font-family="Times New Roman, serif" font-size="14" font-weight="bold">0,1</text>
  <text x="230" y="162" font-family="Times New Roman, serif" font-size="14" font-weight="bold">0,2</text>
  <text x="315" y="162" font-family="Times New Roman, serif" font-size="14" font-weight="bold">0,3</text>
  <text x="400" y="162" font-family="Times New Roman, serif" font-size="14" font-weight="bold">0,4</text>
  <line x1="70" y1="36" x2="410" y2="36" stroke="#4F46E5" stroke-width="1.5"/>
  <polygon points="70,36 78,33 78,39" fill="#4F46E5"/>
  <polygon points="410,36 402,33 402,39" fill="#4F46E5"/>
  <text x="205" y="30" font-family="Times New Roman, serif" font-size="14" font-weight="bold" fill="#4F46E5">Chu kì T = 0,4 s</text>
</svg>`;

// 4. Sơ đồ thí nghiệm điều chế khí O2 đẩy nước (Hóa học thực nghiệm)
const SVG_CHEM_APPARATUS = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 300" width="460" height="300" style="background:#FFFFFF">
  <rect width="100%" height="100%" fill="#FFFFFF"/>
  <rect x="50" y="70" width="160" height="36" rx="10" transform="rotate(-15, 130, 88)" fill="#F8FAFC" stroke="#334155" stroke-width="2"/>
  <rect x="50" y="76" width="40" height="24" transform="rotate(-15, 70, 88)" fill="#7C3AED" opacity="0.85"/>
  <text x="35" y="52" font-family="Times New Roman, serif" font-size="14" font-weight="bold" fill="#7C3AED">Thuốc tím KMnO₄</text>
  <path d="M 75,170 Q 85,130 90,110 Q 100,130 105,170 Z" fill="#EA580C" opacity="0.85"/>
  <rect x="70" y="170" width="40" height="25" fill="#64748B" rx="3"/>
  <text x="50" y="215" font-family="Times New Roman, serif" font-size="13" font-weight="bold">Đèn cồn (t°)</text>
  <path d="M 200,68 L 245,68 L 285,160 L 330,160 L 330,100" fill="none" stroke="#0284C7" stroke-width="4"/>
  <rect x="270" y="130" width="160" height="85" rx="6" fill="#BAE6FD" fill-opacity="0.45" stroke="#0284C7" stroke-width="2"/>
  <text x="300" y="235" font-family="Times New Roman, serif" font-size="13" font-weight="bold" fill="#0369A1">Chậu chứa nước H₂O</text>
  <rect x="315" y="55" width="34" height="95" rx="5" fill="#FFFFFF" fill-opacity="0.9" stroke="#334155" stroke-width="2"/>
  <circle cx="332" cy="125" r="4" fill="#38BDF8"/>
  <circle cx="330" cy="105" r="5" fill="#38BDF8"/>
  <circle cx="332" cy="85" r="5.5" fill="#38BDF8"/>
  <text x="360" y="75" font-family="Times New Roman, serif" font-size="15" font-weight="bold" fill="#DC2626">Khí O₂ thu được</text>
  <text x="360" y="95" font-family="Times New Roman, serif" font-size="12" font-style="italic">(bằng cách đẩy nước)</text>
</svg>`;

// 5. Sơ đồ phả hệ di truyền 3 thế hệ (Sinh học di truyền)
const SVG_PEDIGREE_CHART = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 280" width="460" height="280" style="background:#FFFFFF">
  <rect width="100%" height="100%" fill="#FFFFFF"/>
  <text x="20" y="55" font-family="Times New Roman, serif" font-size="16" font-weight="bold" fill="#1E293B">I</text>
  <text x="20" y="140" font-family="Times New Roman, serif" font-size="16" font-weight="bold" fill="#1E293B">II</text>
  <text x="20" y="230" font-family="Times New Roman, serif" font-size="16" font-weight="bold" fill="#1E293B">III</text>
  <rect x="290" y="15" width="18" height="18" fill="#FFFFFF" stroke="#0F172A" stroke-width="2"/>
  <text x="316" y="29" font-family="Times New Roman, serif" font-size="13">: Nam bình thường</text>
  <circle cx="299" cy="48" r="9" fill="#FFFFFF" stroke="#0F172A" stroke-width="2"/>
  <text x="316" y="52" font-family="Times New Roman, serif" font-size="13">: Nữ bình thường</text>
  <rect x="290" y="65" width="18" height="18" fill="#0F172A" stroke="#0F172A" stroke-width="2"/>
  <text x="316" y="79" font-family="Times New Roman, serif" font-size="13">: Nam bị bệnh</text>
  <!-- I-1 x I-2 -->
  <rect x="90" y="40" width="22" height="22" fill="#FFFFFF" stroke="#0F172A" stroke-width="2"/>
  <text x="96" y="32" font-family="Times New Roman, serif" font-size="13" font-weight="bold">1</text>
  <line x1="112" y1="51" x2="155" y2="51" stroke="#0F172A" stroke-width="2"/>
  <circle cx="166" cy="51" r="11" fill="#FFFFFF" stroke="#0F172A" stroke-width="2"/>
  <text x="162" y="32" font-family="Times New Roman, serif" font-size="13" font-weight="bold">2</text>
  <line x1="133" y1="51" x2="133" y2="85" stroke="#0F172A" stroke-width="2"/>
  <line x1="75" y1="85" x2="200" y2="85" stroke="#0F172A" stroke-width="2"/>
  <!-- II-1 (bệnh), II-2 (bình thường), II-3 (bình thường) x II-4 -->
  <line x1="75" y1="85" x2="75" y2="125" stroke="#0F172A" stroke-width="2"/>
  <rect x="64" y="125" width="22" height="22" fill="#0F172A" stroke="#0F172A" stroke-width="2"/>
  <text x="70" y="162" font-family="Times New Roman, serif" font-size="13" font-weight="bold">1</text>
  <line x1="133" y1="85" x2="133" y2="125" stroke="#0F172A" stroke-width="2"/>
  <circle cx="133" cy="136" r="11" fill="#FFFFFF" stroke="#0F172A" stroke-width="2"/>
  <text x="129" y="162" font-family="Times New Roman, serif" font-size="13" font-weight="bold">2</text>
  <line x1="200" y1="85" x2="200" y2="125" stroke="#0F172A" stroke-width="2"/>
  <rect x="189" y="125" width="22" height="22" fill="#FFFFFF" stroke="#0F172A" stroke-width="2"/>
  <text x="195" y="162" font-family="Times New Roman, serif" font-size="13" font-weight="bold">3</text>
  <line x1="211" y1="136" x2="250" y2="136" stroke="#0F172A" stroke-width="2"/>
  <circle cx="261" cy="136" r="11" fill="#FFFFFF" stroke="#0F172A" stroke-width="2"/>
  <text x="257" y="162" font-family="Times New Roman, serif" font-size="13" font-weight="bold">4</text>
  <!-- Gen III -->
  <line x1="230" y1="136" x2="230" y2="190" stroke="#0F172A" stroke-width="2"/>
  <line x1="180" y1="190" x2="280" y2="190" stroke="#0F172A" stroke-width="2"/>
  <line x1="180" y1="190" x2="180" y2="215" stroke="#0F172A" stroke-width="2"/>
  <circle cx="180" cy="226" r="11" fill="#FFFFFF" stroke="#0F172A" stroke-width="2"/>
  <text x="176" y="252" font-family="Times New Roman, serif" font-size="13" font-weight="bold">1</text>
  <line x1="230" y1="190" x2="230" y2="215" stroke="#0F172A" stroke-width="2"/>
  <rect x="219" y="215" width="22" height="22" fill="#0F172A" stroke="#0F172A" stroke-width="2"/>
  <text x="225" y="252" font-family="Times New Roman, serif" font-size="13" font-weight="bold">2</text>
  <line x1="280" y1="190" x2="280" y2="215" stroke="#0F172A" stroke-width="2"/>
  <circle cx="280" cy="226" r="11" fill="#FFFFFF" stroke="#0F172A" stroke-width="2"/>
  <text x="276" y="252" font-family="Times New Roman, serif" font-size="13" font-weight="bold">3</text>
</svg>`;

const toSvgDataUrl = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

/**
 * ĐỀ THI MẪU ĐÁNH GIÁ NĂNG LỰC TỔNG HỢP (TOÁN - LÝ - HÓA - SINH) NĂM 2025
 * Cấu trúc chuẩn 3 phần (28 câu = 16 Phần I + 4 Phần II + 8 Phần III):
 * - Mỗi môn chia đều đúng 7 câu (4 Phần I, 1 Phần II [4 ý a, b, c, d], 2 Phần III).
 * - Tích hợp đầy đủ: Công thức phân số, căn bậc n, tích phân, ma trận, véc-tơ, góc, tam giác,
 *   khối lập phương, đồ thị hàm số, đồ thị sóng cơ/dao động, ký hiệu vật lý, phương trình hóa học,
 *   chỉ số trên/dưới, mũi tên phản ứng có điều kiện, bảng ghép đôi Cột A - Cột B, sơ đồ phả hệ, phép lai.
 * - Sạch 100% lỗi, sẵn sàng trộn đề 4 mã đề chuẩn xác.
 */
export const SAMPLE_2025_EXAM_WITH_ERRORS: ExamQuestion[] = [
  // =========================================================================
  // PHẦN I: TRẮC NGHIỆM 4 PHƯƠNG ÁN LỰA CHỌN (16 CÂU — TỪ CÂU 1 ĐẾN CÂU 16)
  // Chia đều 4 môn: Toán (Câu 1-4), Vật lý (Câu 5-8), Hóa học (Câu 9-12), Sinh học (Câu 13-16)
  // =========================================================================

  // --- MÔN TOÁN HỌC (CÂU 1 -> CÂU 4) ---
  {
    id: 'math-p1-1',
    part: 'PART_1',
    originalIndex: 1,
    displayIndex: 1,
    stemText: 'Cho hình khối lập phương $ABCD.A\'B\'C\'D\'$ có cạnh bằng $a$ (như hình vẽ bên). Trong không gian, độ dài của véc-tơ tổng $\\vec{u} = \\overrightarrow{AB} + \\overrightarrow{AD} + \\overrightarrow{AA\'}$ bằng bao nhiêu?',
    hasFormula: true,
    formulaLatex: '\\vec{u} = \\overrightarrow{AB} + \\overrightarrow{AD} + \\overrightarrow{AA\'} = \\overrightarrow{AC\'} \\implies |\\vec{u}| = a\\sqrt{3}',
    bloomLevel: 'THONG_HIEU',
    learningOutcome: 'Vận dụng quy tắc hình hộp để tính độ dài véc-tơ trong không gian ba chiều.',
    explanation: 'Theo quy tắc hình hộp trong không gian, ta có $\\overrightarrow{AB} + \\overrightarrow{AD} + \\overrightarrow{AA\'} = \\overrightarrow{AC\'}$. Do $AC\'$ là đường chéo của khối lập phương cạnh $a$ nên $|\\vec{u}| = AC\' = a\\sqrt{3}$.',
    images: [
      {
        id: 'img-math-cube',
        dataUrl: toSvgDataUrl(SVG_CUBE_3D),
        fileName: 'hinh_khoi_lap_phuong.svg',
        tagId: '[HINH_ANH_CAU_1]',
        caption: 'Hình khối lập phương ABCD.A\'B\'C\'D\' cạnh a',
        dpi: 300,
        aspectRatio: 460 / 340,
        widthTwips: 4200,
        heightTwips: 3100,
      },
    ],
    options: [
      { id: 'math-p1-1-a', originalLabel: 'A', currentLabel: 'A', text: '$a\\sqrt{3}$.', isUnderline: true, isRed: true, isCorrect: true },
      { id: 'math-p1-1-b', originalLabel: 'B', currentLabel: 'B', text: '$a\\sqrt{2}$.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'math-p1-1-c', originalLabel: 'C', currentLabel: 'C', text: '$2a$.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'math-p1-1-d', originalLabel: 'D', currentLabel: 'D', text: '$3a$.', isUnderline: false, isRed: false, isCorrect: false },
    ],
    computedLayout: '1_ROW_4_COL',
  },
  {
    id: 'math-p1-2',
    part: 'PART_1',
    originalIndex: 2,
    displayIndex: 2,
    stemText: 'Cho hàm số bậc ba $y = f(x) = ax^3 + bx^2 + cx + d$ có đồ thị như hình vẽ bên. Tọa độ điểm cực đại của đồ thị hàm số đã cho là:',
    hasFormula: true,
    formulaLatex: 'y = f(x) \\implies y\' = 0 \\implies x_{CD} = 0, y_{CD} = 2',
    bloomLevel: 'NHAN_BIET',
    learningOutcome: 'Nhận biết điểm cực trị của hàm số thông qua đồ thị.',
    explanation: 'Quan sát đồ thị hàm số bậc ba, ta thấy điểm uốn cực đại nằm trên trục tung tại vị trí có hoành độ $x = 0$ và tung độ $y = 2$. Do đó tọa độ điểm cực đại là $(0; 2)$.',
    images: [
      {
        id: 'img-math-graph',
        dataUrl: toSvgDataUrl(SVG_CUBIC_GRAPH),
        fileName: 'do_thi_ham_bac_ba.svg',
        tagId: '[HINH_ANH_CAU_2]',
        caption: 'Đồ thị hàm số bậc ba y = f(x)',
        dpi: 300,
        aspectRatio: 460 / 340,
        widthTwips: 4200,
        heightTwips: 3100,
      },
    ],
    options: [
      { id: 'math-p1-2-a', originalLabel: 'A', currentLabel: 'A', text: '$(0; 2)$.', isUnderline: true, isRed: true, isCorrect: true },
      { id: 'math-p1-2-b', originalLabel: 'B', currentLabel: 'B', text: '$(2; -2)$.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'math-p1-2-c', originalLabel: 'C', currentLabel: 'C', text: '$(-2; 2)$.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'math-p1-2-d', originalLabel: 'D', currentLabel: 'D', text: '$(1; 0)$.', isUnderline: false, isRed: false, isCorrect: false },
    ],
    computedLayout: '1_ROW_4_COL',
  },
  {
    id: 'math-p1-3',
    part: 'PART_1',
    originalIndex: 3,
    displayIndex: 3,
    stemText: 'Biết tích phân $I = \\int_{0}^{1} \\frac{2x + 3}{x + 1} \\, dx = a + b \\ln 2$ với $a, b$ là các số nguyên. Giá trị của biểu thức $P = a^2 + b^2$ bằng:',
    hasFormula: true,
    formulaLatex: 'I = \\int_{0}^{1} \\left(2 + \\frac{1}{x+1}\\right) dx = [2x + \\ln(x+1)]_{0}^{1} = 2 + \\ln 2 \\implies a = 2, b = 1 \\implies P = 5',
    bloomLevel: 'THONG_HIEU',
    learningOutcome: 'Tính tích phân của hàm phân thức hữu tỉ bằng phương pháp tách đa thức.',
    explanation: 'Ta có $\\frac{2x+3}{x+1} = 2 + \\frac{1}{x+1}$. Khi đó $I = [2x + \\ln|x+1|]_{0}^{1} = (2 + \\ln 2) - 0 = 2 + \\ln 2$. Suy ra $a = 2, b = 1 \\implies P = 2^2 + 1^2 = 5$.',
    options: [
      { id: 'math-p1-3-a', originalLabel: 'A', currentLabel: 'A', text: '$5$.', isUnderline: true, isRed: true, isCorrect: true },
      { id: 'math-p1-3-b', originalLabel: 'B', currentLabel: 'B', text: '$13$.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'math-p1-3-c', originalLabel: 'C', currentLabel: 'C', text: '$10$.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'math-p1-3-d', originalLabel: 'D', currentLabel: 'D', text: '$8$.', isUnderline: false, isRed: false, isCorrect: false },
    ],
    computedLayout: '1_ROW_4_COL',
  },
  {
    id: 'math-p1-4',
    part: 'PART_1',
    originalIndex: 4,
    displayIndex: 4,
    stemText: 'Cho tam giác $\\triangle ABC$ vuông tại đỉnh $A$ có góc $\\widehat{BAC} = 90^\\circ$, độ dài các cạnh $AB = 3$ và $AC = 4$. Tích vô hướng của hai véc-tơ $\\overrightarrow{BA} \\cdot \\overrightarrow{BC}$ có giá trị bằng:',
    hasFormula: true,
    formulaLatex: '\\overrightarrow{BA} \\cdot \\overrightarrow{BC} = \\overrightarrow{BA} \\cdot (\\overrightarrow{BA} + \\overrightarrow{AC}) = |\\overrightarrow{BA}|^2 + \\overrightarrow{BA} \\cdot \\overrightarrow{AC} = 3^2 + 0 = 9',
    bloomLevel: 'THONG_HIEU',
    learningOutcome: 'Vận dụng định nghĩa và tính chất tích vô hướng của hai véc-tơ trong hình học phẳng.',
    explanation: 'Ta phân tích $\\overrightarrow{BC} = \\overrightarrow{BA} + \\overrightarrow{AC}$. Khi đó $\\overrightarrow{BA} \\cdot \\overrightarrow{BC} = \\overrightarrow{BA} \\cdot (\\overrightarrow{BA} + \\overrightarrow{AC}) = |\\overrightarrow{BA}|^2 + \\overrightarrow{BA} \\cdot \\overrightarrow{AC} = 3^2 + 0 = 9$ (vì $AB \\perp AC$).',
    options: [
      { id: 'math-p1-4-a', originalLabel: 'A', currentLabel: 'A', text: '$9$.', isUnderline: true, isRed: true, isCorrect: true },
      { id: 'math-p1-4-b', originalLabel: 'B', currentLabel: 'B', text: '$12$.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'math-p1-4-c', originalLabel: 'C', currentLabel: 'C', text: '$15$.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'math-p1-4-d', originalLabel: 'D', currentLabel: 'D', text: '$0$.', isUnderline: false, isRed: false, isCorrect: false },
    ],
    computedLayout: '1_ROW_4_COL',
  },

  // --- MÔN VẬT LÝ (CÂU 5 -> CÂU 8) ---
  {
    id: 'phys-p1-5',
    part: 'PART_1',
    originalIndex: 5,
    displayIndex: 5,
    stemText: 'Một vật nhỏ dao động điều hòa dọc theo trục $Ox$. Đồ thị biểu diễn sự phụ thuộc của li độ $x\\text{ (cm)}$ vào thời gian $t\\text{ (s)}$ được cho như hình vẽ bên. Biên độ dao động $A$ và chu kì dao động $T$ của vật lần lượt là:',
    hasFormula: true,
    formulaLatex: 'x = A\\cos(\\omega t + \\varphi) \\implies A = 4\\text{ cm},\\; T = 0,4\\text{ s}',
    bloomLevel: 'NHAN_BIET',
    learningOutcome: 'Đọc và xác định được biên độ, chu kì dao động điều hòa từ đồ thị li độ - thời gian.',
    explanation: 'Từ đồ thị dao động, điểm cao nhất của li độ là $x_{max} = A = 4\\text{ cm}$. Khoảng thời gian để vật thực hiện trọn vẹn 1 chu kì dao động (từ đỉnh $t = 0$ đến đỉnh kế tiếp) là $T = 0,4\\text{ s}$.',
    images: [
      {
        id: 'img-phys-wave',
        dataUrl: toSvgDataUrl(SVG_OSCILLATION_GRAPH),
        fileName: 'do_thi_dao_dong_dieu_hoa.svg',
        tagId: '[HINH_ANH_CAU_5]',
        caption: 'Đồ thị dao động điều hòa li độ x theo thời gian t',
        dpi: 300,
        aspectRatio: 480 / 280,
        widthTwips: 4400,
        heightTwips: 2600,
      },
    ],
    options: [
      { id: 'phys-p1-5-a', originalLabel: 'A', currentLabel: 'A', text: '$A = 4\\text{ cm};\\; T = 0,4\\text{ s}$.', isUnderline: true, isRed: true, isCorrect: true },
      { id: 'phys-p1-5-b', originalLabel: 'B', currentLabel: 'B', text: '$A = 8\\text{ cm};\\; T = 0,2\\text{ s}$.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'phys-p1-5-c', originalLabel: 'C', currentLabel: 'C', text: '$A = 4\\text{ cm};\\; T = 0,8\\text{ s}$.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'phys-p1-5-d', originalLabel: 'D', currentLabel: 'D', text: '$A = 2\\text{ cm};\\; T = 0,4\\text{ s}$.', isUnderline: false, isRed: false, isCorrect: false },
    ],
    computedLayout: '2_ROW_2_COL',
  },
  {
    id: 'phys-p1-6',
    part: 'PART_1',
    originalIndex: 6,
    displayIndex: 6,
    stemText: 'Một sóng cơ hình sin truyền trong môi trường đàn hồi với bước sóng $\\lambda = 20\\text{ cm}$. Hai điểm $M$ và $N$ nằm trên cùng một phương truyền sóng cách nhau một khoảng cách $d = 5\\text{ cm}$. Độ lệch pha dao động $\\Delta \\varphi$ giữa hai điểm $M$ và $N$ bằng:',
    hasFormula: true,
    formulaLatex: '\\Delta \\varphi = \\frac{2\\pi d}{\\lambda} = \\frac{2\\pi \\times 5}{20} = \\frac{\\pi}{2}\\text{ rad}',
    bloomLevel: 'THONG_HIEU',
    learningOutcome: 'Vận dụng công thức tính độ lệch pha giữa hai điểm trên cùng một phương truyền sóng.',
    explanation: 'Độ lệch pha dao động giữa hai điểm cách nhau khoảng $d$ trên phương truyền sóng là $\\Delta \\varphi = \\frac{2\\pi d}{\\lambda} = \\frac{2\\pi \\cdot 5}{20} = \\frac{\\pi}{2}\\text{ rad}$ (hai dao động vuông pha).',
    options: [
      { id: 'phys-p1-6-a', originalLabel: 'A', currentLabel: 'A', text: '$\\frac{\\pi}{2}\\text{ rad}$.', isUnderline: true, isRed: true, isCorrect: true },
      { id: 'phys-p1-6-b', originalLabel: 'B', currentLabel: 'B', text: '$\\pi\\text{ rad}$.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'phys-p1-6-c', originalLabel: 'C', currentLabel: 'C', text: '$\\frac{\\pi}{4}\\text{ rad}$.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'phys-p1-6-d', originalLabel: 'D', currentLabel: 'D', text: '$2\\pi\\text{ rad}$.', isUnderline: false, isRed: false, isCorrect: false },
    ],
    computedLayout: '1_ROW_4_COL',
  },
  {
    id: 'phys-p1-7',
    part: 'PART_1',
    originalIndex: 7,
    displayIndex: 7,
    stemText: 'Đặt điện áp xoay chiều $u = 220\\sqrt{2}\\cos(100\\pi t)\\text{ (V)}$ vào hai đầu đoạn mạch gồm điện trở thuần $R = 50\\,\\Omega$ mắc nối tiếp với cuộn cảm thuần có độ tự cảm $L = \\frac{0,5}{\\pi}\\text{ H}$. Tổng trở $Z$ của đoạn mạch này bằng:',
    hasFormula: true,
    formulaLatex: 'Z_L = \\omega L = 100\\pi \\times \\frac{0,5}{\\pi} = 50\\,\\Omega \\implies Z = \\sqrt{R^2 + Z_L^2} = 50\\sqrt{2}\\,\\Omega',
    bloomLevel: 'THONG_HIEU',
    learningOutcome: 'Tính tổng trở của đoạn mạch xoay chiều R - L nối tiếp.',
    explanation: 'Cảm kháng $Z_L = \\omega L = 100\\pi \\cdot \\frac{0,5}{\\pi} = 50\\,\\Omega$. Tổng trở đoạn mạch là $Z = \\sqrt{R^2 + Z_L^2} = \\sqrt{50^2 + 50^2} = 50\\sqrt{2}\\,\\Omega$.',
    options: [
      { id: 'phys-p1-7-a', originalLabel: 'A', currentLabel: 'A', text: '$50\\sqrt{2}\\,\\Omega$.', isUnderline: true, isRed: true, isCorrect: true },
      { id: 'phys-p1-7-b', originalLabel: 'B', currentLabel: 'B', text: '$100\\,\\Omega$.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'phys-p1-7-c', originalLabel: 'C', currentLabel: 'C', text: '$50\\,\\Omega$.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'phys-p1-7-d', originalLabel: 'D', currentLabel: 'D', text: '$25\\sqrt{2}\\,\\Omega$.', isUnderline: false, isRed: false, isCorrect: false },
    ],
    computedLayout: '1_ROW_4_COL',
  },
  {
    id: 'phys-p1-8',
    part: 'PART_1',
    originalIndex: 8,
    displayIndex: 8,
    stemText: 'Một hạt mang điện tích $q = 3,2 \\times 10^{-19}\\text{ C}$ bay với vận tốc $\\vec{v}$ có độ lớn $v = 10^6\\text{ m/s}$ vào trong từ trường đều $\\vec{B}$ có độ lớn $B = 0,5\\text{ T}$ theo phương vuông góc với đường sức từ (góc $\\alpha = 90^\\circ$). Độ lớn lực Lorentz $f$ tác dụng lên hạt điện tích là:',
    hasFormula: true,
    formulaLatex: 'f = |q| v B \\sin \\alpha = 3,2 \\times 10^{-19} \\times 10^6 \\times 0,5 \\times \\sin(90^\\circ) = 1,6 \\times 10^{-13}\\text{ N}',
    bloomLevel: 'THONG_HIEU',
    learningOutcome: 'Vận dụng định luật Lorentz để tính độ lớn lực từ tác dụng lên hạt mang điện chuyển động trong từ trường.',
    explanation: 'Độ lớn lực Lorentz tác dụng lên điện tích chuyển động trong từ trường là $f = |q|vB\\sin\\alpha = (3,2 \\cdot 10^{-19}) \\cdot 10^6 \\cdot 0,5 \\cdot \\sin(90^\\circ) = 1,6 \\times 10^{-13}\\text{ N}$.',
    options: [
      { id: 'phys-p1-8-a', originalLabel: 'A', currentLabel: 'A', text: '$1,6 \\times 10^{-13}\\text{ N}$.', isUnderline: true, isRed: true, isCorrect: true },
      { id: 'phys-p1-8-b', originalLabel: 'B', currentLabel: 'B', text: '$3,2 \\times 10^{-13}\\text{ N}$.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'phys-p1-8-c', originalLabel: 'C', currentLabel: 'C', text: '$0,8 \\times 10^{-13}\\text{ N}$.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'phys-p1-8-d', originalLabel: 'D', currentLabel: 'D', text: '$6,4 \\times 10^{-13}\\text{ N}$.', isUnderline: false, isRed: false, isCorrect: false },
    ],
    computedLayout: '2_ROW_2_COL',
  },

  // --- MÔN HÓA HỌC (CÂU 9 -> CÂU 12) ---
  {
    id: 'chem-p1-9',
    part: 'PART_1',
    originalIndex: 9,
    displayIndex: 9,
    stemText: 'Cho kim loại sắt ($Fe$) tác dụng hoàn toàn với dung dịch axit sunfuric đặc, nóng: $2Fe + 6H_2SO_4 \\xrightarrow{t^\\circ} Fe_2(SO_4)_3 + 3SO_2\\uparrow + 6H_2O$. Trong phản ứng trên, tỉ lệ giữa số phân tử $H_2SO_4$ đóng vai trò chất oxi hóa so với số phân tử $H_2SO_4$ tham gia tạo môi trường muối sunfat $SO_4^{2-}$ là:',
    hasFormula: true,
    formulaLatex: '2Fe + 6H_{2}SO_{4} \\xrightarrow{t^{\\circ}} Fe_{2}(SO_{4})_{3} + 3SO_{2} + 6H_{2}O',
    bloomLevel: 'THONG_HIEU',
    learningOutcome: 'Phân tích vai trò chất oxi hóa và chất tạo môi trường của axit sunfuric đặc trong phản ứng oxi hóa - khử.',
    explanation: 'Trong 6 phân tử $H_2SO_4$ tham gia phản ứng, có 3 phân tử bị khử thành $SO_2$ (đóng vai trò chất oxi hóa) và 3 phân tử tạo gốc sunfat $SO_4^{2-}$ trong muối $Fe_2(SO_4)_3$ (đóng vai trò môi trường). Tỉ lệ là $3 : 3 = 1 : 1$.',
    options: [
      { id: 'chem-p1-9-a', originalLabel: 'A', currentLabel: 'A', text: '$1 : 1$.', isUnderline: true, isRed: true, isCorrect: true },
      { id: 'chem-p1-9-b', originalLabel: 'B', currentLabel: 'B', text: '$1 : 2$.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'chem-p1-9-c', originalLabel: 'C', currentLabel: 'C', text: '$2 : 1$.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'chem-p1-9-d', originalLabel: 'D', currentLabel: 'D', text: '$1 : 3$.', isUnderline: false, isRed: false, isCorrect: false },
    ],
    computedLayout: '1_ROW_4_COL',
  },
  {
    id: 'chem-p1-10',
    part: 'PART_1',
    originalIndex: 10,
    displayIndex: 10,
    stemText: 'Cho cân bằng hóa học sau trong bình kín: $N_2\\text{(k)} + 3H_2\\text{(k)} \\xrightleftharpoons{xt, t^\\circ, p} 2NH_3\\text{(k)}$ (phản ứng tỏa nhiệt có $\\Delta_r H_{298}^0 = -92\\text{ kJ} < 0$). Để cân bằng chuyển dịch theo chiều thuận (tăng hiệu suất tổng hợp khí $NH_3$), biện pháp kĩ thuật nào sau đây là phù hợp?',
    hasFormula: true,
    formulaLatex: 'N_{2(k)} + 3H_{2(k)} \\xrightleftharpoons{xt, t^{\\circ}, p} 2NH_{3(k)},\\; \\Delta_r H_{298}^{0} = -92\\text{ kJ}',
    bloomLevel: 'THONG_HIEU',
    learningOutcome: 'Vận dụng nguyên lí chuyển dịch cân bằng Le Chatelier để đề xuất biện pháp nâng cao hiệu suất phản ứng tổng hợp hóa học.',
    explanation: 'Phản ứng thuận tỏa nhiệt ($\\Delta H < 0$) và làm giảm số mol khí ($4\\text{ mol} \\to 2\\text{ mol}$). Theo nguyên lí Le Chatelier, để cân bằng chuyển dịch theo chiều thuận cần tăng áp suất chung và hạ nhiệt độ thích hợp của hệ.',
    options: [
      { id: 'chem-p1-10-a', originalLabel: 'A', currentLabel: 'A', text: 'Tăng áp suất chung của hệ và hạ nhiệt độ thích hợp.', isUnderline: true, isRed: true, isCorrect: true },
      { id: 'chem-p1-10-b', originalLabel: 'B', currentLabel: 'B', text: 'Giảm áp suất và tăng nhiệt độ của hệ phản ứng.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'chem-p1-10-c', originalLabel: 'C', currentLabel: 'C', text: 'Chỉ thêm chất xúc tác bột sắt ($Fe$) vào bình kín.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'chem-p1-10-d', originalLabel: 'D', currentLabel: 'D', text: 'Liên tục giảm nồng độ khí $N_2$ và $H_2$ trong bình.', isUnderline: false, isRed: false, isCorrect: false },
    ],
    computedLayout: '4_ROW_1_COL',
  },
  {
    id: 'chem-p1-11',
    part: 'PART_1',
    originalIndex: 11,
    displayIndex: 11,
    stemText: 'Cho bảng ghép đôi giữa các dung dịch muối vô cơ (Cột A) và hiện tượng phản ứng khi nhỏ từ từ dung dịch barium hydroxide $Ba(OH)_2$ đến dư vào (Cột B) dưới đây. Hiện tượng nhận biết đúng nhất đối với dung dịch muối ở vị trí (I) nhôm sunfat $Al_2(SO_4)_3$ là:',
    hasFormula: false,
    stemTables: [
      {
        id: 'tbl-chem-match',
        isMatchingColumns: true,
        caption: 'Bảng đối chiếu phản ứng nhận biết muối vô cơ với dung dịch Ba(OH)2',
        rows: [
          [
            { text: 'Cột A (Dung dịch muối vô cơ)', align: 'center', isHeader: true, isBold: true },
            { text: 'Cột B (Hiện tượng khi nhỏ dung dịch Ba(OH)2 đến dư)', align: 'center', isHeader: true, isBold: true },
          ],
          [
            { text: 'I. Nhôm sunfat Al2(SO4)3', align: 'left', isBold: true },
            { text: 'Xuất hiện đồng thời kết tủa trắng không tan BaSO4 và kết tủa keo Al(OH)3, sau đó kết tủa keo Al(OH)3 tan dần do tính lưỡng tính.', align: 'left' },
          ],
          [
            { text: 'II. Sắt(III) clorua FeCl3', align: 'left', isBold: true },
            { text: 'Xuất hiện kết tủa màu nâu đỏ của Fe(OH)3 không tan trong dung dịch kiềm dư.', align: 'left' },
          ],
        ],
      },
    ],
    bloomLevel: 'THONG_HIEU',
    learningOutcome: 'Nhận biết hiện tượng tạo kết tủa và tính chất lưỡng tính của hiđroxit nhôm.',
    explanation: 'Khi cho $Ba(OH)_2$ vào $Al_2(SO_4)_3$, tạo kết tủa trắng $BaSO_4$ và kết tủa keo $Al(OH)_3$. Do $Ba(OH)_2$ dư nên kết tủa lưỡng tính $Al(OH)_3$ tan tạo phức aluminat $Ba[Al(OH)_4]_2$, để lại kết tủa trắng $BaSO_4$ không tan.',
    options: [
      { id: 'chem-p1-11-a', originalLabel: 'A', currentLabel: 'A', text: 'Có kết tủa trắng và kết tủa keo, sau đó kết tủa keo tan bớt khi kiềm dư.', isUnderline: true, isRed: true, isCorrect: true },
      { id: 'chem-p1-11-b', originalLabel: 'B', currentLabel: 'B', text: 'Chỉ xuất hiện kết tủa màu nâu đỏ không tan trong kiềm.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'chem-p1-11-c', originalLabel: 'C', currentLabel: 'C', text: 'Chỉ xuất hiện bọt khí không màu thoát ra mãnh liệt.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'chem-p1-11-d', originalLabel: 'D', currentLabel: 'D', text: 'Không xuất hiện bất kì hiện tượng kết tủa hay đổi màu nào.', isUnderline: false, isRed: false, isCorrect: false },
    ],
    computedLayout: '4_ROW_1_COL',
  },
  {
    id: 'chem-p1-12',
    part: 'PART_1',
    originalIndex: 12,
    displayIndex: 12,
    stemText: 'Hình vẽ bên mô tả bộ dụng cụ thí nghiệm điều chế và thu khí trong phòng thí nghiệm bằng phương pháp đẩy nước. Với hóa chất ban đầu là potassium permanganate $KMnO_4$, phản ứng xảy ra khi đun nóng: $2KMnO_4 \\xrightarrow{t^\\circ} K_2MnO_4 + MnO_2 + O_2\\uparrow$. Khí thu được trong ống nghiệm úp ngược là:',
    hasFormula: true,
    formulaLatex: '2KMnO_{4} \\xrightarrow{t^{\\circ}} K_{2}MnO_{4} + MnO_{2} + O_{2}\\uparrow',
    bloomLevel: 'NHAN_BIET',
    learningOutcome: 'Nhận biết phương pháp điều chế và thu khí oxi trong phòng thí nghiệm.',
    explanation: 'Phản ứng nhiệt phân thuốc tím $KMnO_4$ sinh ra khí oxi ($O_2$). Vì khí $O_2$ ít tan trong nước nên được thu bằng phương pháp đẩy nước như trong hình vẽ.',
    images: [
      {
        id: 'img-chem-o2',
        dataUrl: toSvgDataUrl(SVG_CHEM_APPARATUS),
        fileName: 'thi_nghiem_thu_khi_oxi.svg',
        tagId: '[HINH_ANH_CAU_12]',
        caption: 'Bộ dụng cụ điều chế và thu khí oxi bằng phương pháp đẩy nước',
        dpi: 300,
        aspectRatio: 460 / 300,
        widthTwips: 4400,
        heightTwips: 2800,
      },
    ],
    options: [
      { id: 'chem-p1-12-a', originalLabel: 'A', currentLabel: 'A', text: 'Khí oxi ($O_2$).', isUnderline: true, isRed: true, isCorrect: true },
      { id: 'chem-p1-12-b', originalLabel: 'B', currentLabel: 'B', text: 'Khí hiđro clorua ($HCl$).', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'chem-p1-12-c', originalLabel: 'C', currentLabel: 'C', text: 'Khí amoniac ($NH_3$).', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'chem-p1-12-d', originalLabel: 'D', currentLabel: 'D', text: 'Khí lưu huỳnh đioxit ($SO_2$).', isUnderline: false, isRed: false, isCorrect: false },
    ],
    computedLayout: '2_ROW_2_COL',
  },

  // --- MÔN SINH HỌC (CÂU 13 -> CÂU 16) ---
  {
    id: 'bio-p1-13',
    part: 'PART_1',
    originalIndex: 13,
    displayIndex: 13,
    stemText: 'Ở một loài thực vật, hai cặp gene $(A, a)$ và $(B, b)$ cùng nằm trên một cặp nhiễm sắc thể thường. Cho cây dị hợp tử đều có kiểu gene $\\frac{AB}{ab}$ lai phân tích với cây có kiểu gene $\\frac{ab}{ab}$. Biết tần số hoán vị gene $f = 20\\%$. Tỉ lệ kiểu hình mang hai tính trạng trội ($A-B-$) ở đời con $F_a$ là:',
    hasFormula: true,
    formulaLatex: 'P: \\frac{AB}{ab} \\times \\frac{ab}{ab},\\; f = 20\\% \\implies AB = \\frac{1-f}{2} = 40\\% \\implies A\\text{-}B\\text{-} = 40\\%',
    bloomLevel: 'THONG_HIEU',
    learningOutcome: 'Tính tỉ lệ kiểu hình đời con trong phép lai phân tích có hoán vị gene.',
    explanation: 'Cây dị hợp tử đều $\\frac{AB}{ab}$ giảm phân có hoán vị gene với $f = 20\\%$ sẽ tạo ra giao tử liên kết $AB = ab = \\frac{1 - 0,2}{2} = 40\\%$. Khi thụ tinh với giao tử $ab$, tỉ lệ cá thể mang kiểu hình trội cả 2 tính trạng ($A-B-$) là $40\\%$.',
    options: [
      { id: 'bio-p1-13-a', originalLabel: 'A', currentLabel: 'A', text: '$40\\%$.', isUnderline: true, isRed: true, isCorrect: true },
      { id: 'bio-p1-13-b', originalLabel: 'B', currentLabel: 'B', text: '$10\\%$.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'bio-p1-13-c', originalLabel: 'C', currentLabel: 'C', text: '$25\\%$.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'bio-p1-13-d', originalLabel: 'D', currentLabel: 'D', text: '$50\\%$.', isUnderline: false, isRed: false, isCorrect: false },
    ],
    computedLayout: '1_ROW_4_COL',
  },
  {
    id: 'bio-p1-14',
    part: 'PART_1',
    originalIndex: 14,
    displayIndex: 14,
    stemText: 'Ở người, bệnh mù màu đỏ - xanh lục do một allele lặn $a$ nằm trên vùng không tương đồng của nhiễm sắc thể giới tính $X$ quy định, allele trội $A$ quy định mắt nhìn màu bình thường. Một cặp vợ chồng có kiểu hình bình thường, người vợ mang gene gây bệnh ($X^A X^a$), người chồng bình thường ($X^A Y$). Xác suất họ sinh ra con trai bị mù màu ($X^a Y$) là:',
    hasFormula: true,
    formulaLatex: 'P: ♀ X^A X^a \\times ♂ X^A Y \\implies P(X^a Y) = \\frac{1}{2} X^a \\times \\frac{1}{2} Y = \\frac{1}{4} = 25\\%',
    bloomLevel: 'THONG_HIEU',
    learningOutcome: 'Vận dụng quy luật di truyền liên kết giới tính để tính xác suất sinh con mang tính trạng bệnh.',
    explanation: 'Phép lai: $P: ♀ X^A X^a \\times ♂ X^A Y$. Giao tử của mẹ: $0,5 X^A : 0,5 X^a$; giao tử của bố: $0,5 X^A : 0,5 Y$. Xác suất sinh con trai bị mù màu ($X^a Y$) là $0,5 X^a \\times 0,5 Y = 0,25 = 25\\%$.',
    options: [
      { id: 'bio-p1-14-a', originalLabel: 'A', currentLabel: 'A', text: '$25\\%$.', isUnderline: true, isRed: true, isCorrect: true },
      { id: 'bio-p1-14-b', originalLabel: 'B', currentLabel: 'B', text: '$50\\%$.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'bio-p1-14-c', originalLabel: 'C', currentLabel: 'C', text: '$12,5\\%$.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'bio-p1-14-d', originalLabel: 'D', currentLabel: 'D', text: '$0\\%$.', isUnderline: false, isRed: false, isCorrect: false },
    ],
    computedLayout: '1_ROW_4_COL',
  },
  {
    id: 'bio-p1-15',
    part: 'PART_1',
    originalIndex: 15,
    displayIndex: 15,
    stemText: 'Sơ đồ phả hệ ở hình bên mô tả sự di truyền của một bệnh hiếm gặp ở người qua 3 thế hệ. Biết rằng bệnh do một trong hai allele của một gene quy định và không xảy ra đột biến mới. Dựa vào phả hệ, quy luật di truyền chi phối tính trạng bệnh này là:',
    hasFormula: false,
    bloomLevel: 'VAN_DUNG',
    learningOutcome: 'Phân tích sơ đồ phả hệ để xác định tính trạng trội/lặn và vị trí của gene trên nhiễm sắc thể.',
    explanation: 'Cặp bố mẹ bình thường (I-1 và I-2) sinh ra con trai bị bệnh (II-1) $\\implies$ Bệnh do allele lặn quy định. Ở thế hệ II, cặp vợ chồng II-3 và II-4 đều bình thường sinh con trai III-2 bị bệnh $\\implies$ Gene lặn nằm trên nhiễm sắc thể thường quy định.',
    images: [
      {
        id: 'img-bio-pedigree',
        dataUrl: toSvgDataUrl(SVG_PEDIGREE_CHART),
        fileName: 'so_do_pha_he_3_the_he.svg',
        tagId: '[HINH_ANH_CAU_15]',
        caption: 'Sơ đồ phả hệ di truyền bệnh qua 3 thế hệ ở người',
        dpi: 300,
        aspectRatio: 460 / 280,
        widthTwips: 4400,
        heightTwips: 2600,
      },
    ],
    options: [
      { id: 'bio-p1-15-a', originalLabel: 'A', currentLabel: 'A', text: 'Gene lặn nằm trên nhiễm sắc thể thường quy định.', isUnderline: true, isRed: true, isCorrect: true },
      { id: 'bio-p1-15-b', originalLabel: 'B', currentLabel: 'B', text: 'Gene trội nằm trên nhiễm sắc thể thường quy định.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'bio-p1-15-c', originalLabel: 'C', currentLabel: 'C', text: 'Gene lặn nằm trên vùng không tương đồng của NST X.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'bio-p1-15-d', originalLabel: 'D', currentLabel: 'D', text: 'Gene nằm trên vùng không tương đồng của NST Y.', isUnderline: false, isRed: false, isCorrect: false },
    ],
    computedLayout: '4_ROW_1_COL',
  },
  {
    id: 'bio-p1-16',
    part: 'PART_1',
    originalIndex: 16,
    displayIndex: 16,
    stemText: 'Một quần thể động vật ngẫu phối đang ở trạng thái cân bằng di truyền có cấu trúc $0,49AA : 0,42Aa : 0,09aa$ (thỏa mãn đẳng thức Hardy - Weinberg $p^2 + 2pq + q^2 = 1$). Tần số tương đối của allele $A$ và allele $a$ trong quần thể này lần lượt là:',
    hasFormula: true,
    formulaLatex: 'p^2(AA) + 2pq(Aa) + q^2(aa) = 1 \\implies q(a) = \\sqrt{0,09} = 0,30;\\; p(A) = 1 - 0,30 = 0,70',
    bloomLevel: 'THONG_HIEU',
    learningOutcome: 'Tính tần số tương đối của các allele trong quần thể cân bằng di truyền.',
    explanation: 'Quần thể cân bằng di truyền có $q^2(aa) = 0,09 \\implies q(a) = \\sqrt{0,09} = 0,30$. Do $p + q = 1 \\implies p(A) = 1 - 0,30 = 0,70$.',
    options: [
      { id: 'bio-p1-16-a', originalLabel: 'A', currentLabel: 'A', text: '$p(A) = 0,70;\\; q(a) = 0,30$.', isUnderline: true, isRed: true, isCorrect: true },
      { id: 'bio-p1-16-b', originalLabel: 'B', currentLabel: 'B', text: '$p(A) = 0,49;\\; q(a) = 0,51$.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'bio-p1-16-c', originalLabel: 'C', currentLabel: 'C', text: '$p(A) = 0,30;\\; q(a) = 0,70$.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'bio-p1-16-d', originalLabel: 'D', currentLabel: 'D', text: '$p(A) = 0,60;\\; q(a) = 0,40$.', isUnderline: false, isRed: false, isCorrect: false },
    ],
    computedLayout: '2_ROW_2_COL',
  },

  // =========================================================================
  // PHẦN II: TRẮC NGHIỆM ĐÚNG / SAI (4 CÂU — TỪ CÂU 1 ĐẾN CÂU 4, MỖI CÂU 4 Ý a, b, c, d)
  // Chia đều 4 môn: Câu 1 (Toán), Câu 2 (Vật lý), Câu 3 (Hóa học), Câu 4 (Sinh học)
  // =========================================================================

  // --- CÂU 1 (MÔN TOÁN HỌC): KHẢO SÁT HÀM SỐ, TIỆM CẬN VÀ BẤT ĐẲNG THỨC ---
  {
    id: 'math-p2-1',
    part: 'PART_2',
    originalIndex: 17,
    displayIndex: 1,
    stemText: 'Cho hàm số phân thức bậc nhất trên bậc nhất $y = f(x) = \\frac{2x - 1}{x + 1}$ có đồ thị là $(C)$. Xét tính đúng hoặc sai của các mệnh đề sau đây:',
    hasFormula: true,
    formulaLatex: 'y = \\frac{2x-1}{x+1} \\implies y\' = \\frac{3}{(x+1)^2} > 0',
    bloomLevel: 'THONG_HIEU',
    learningOutcome: 'Khảo sát sự biến thiên, cực trị và đường tiệm cận của đồ thị hàm phân thức hữu tỉ.',
    explanation: 'a) Đúng vì tập xác định là $D = \\mathbb{R} \\setminus \\{-1\\}$. b) Đúng vì $y\' = \\frac{2(1) - (-1)(1)}{(x+1)^2} = \\frac{3}{(x+1)^2} > 0,\\; \\forall x \\neq -1$. c) Đúng vì $\\lim_{x \\to \\pm\\infty} f(x) = 2$ nên đường thẳng $y = 2$ là tiệm cận ngang. d) Sai vì $\\lim_{x \\to -1^+} f(x) = -\\infty$ nên đường tiệm cận đứng là $x = -1$ (không phải $x = 1$).',
    subItems: [
      { id: 'math-p2-1-a', originalLabel: 'a', currentLabel: 'a', text: 'Tập xác định của hàm số đã cho là $D = \\mathbb{R} \\setminus \\{-1\\}$.', isUnderline: true, isRed: true, isTrue: true },
      { id: 'math-p2-1-b', originalLabel: 'b', currentLabel: 'b', text: 'Đạo hàm $y\' = \\frac{3}{(x+1)^2} > 0$ với mọi $x \\in D$, do đó hàm số đồng biến trên từng khoảng xác định.', isUnderline: true, isRed: true, isTrue: true },
      { id: 'math-p2-1-c', originalLabel: 'c', currentLabel: 'c', text: 'Đồ thị $(C)$ của hàm số có đường tiệm cận ngang là đường thẳng $y = 2$.', isUnderline: true, isRed: true, isTrue: true },
      { id: 'math-p2-1-d', originalLabel: 'd', currentLabel: 'd', text: 'Đồ thị $(C)$ của hàm số có đường tiệm cận đứng là đường thẳng $x = 1$.', isUnderline: false, isRed: false, isTrue: false },
    ],
  },

  // --- CÂU 2 (MÔN VẬT LÝ): CON LẮC LÒ XO, CƠ NĂNG VÀ VẬN TỐC BIÊN ---
  {
    id: 'phys-p2-2',
    part: 'PART_2',
    originalIndex: 18,
    displayIndex: 2,
    stemText: 'Một con lắc lò xo gồm vật nhỏ có khối lượng $m = 200\\text{ g}$ gắn vào lò xo nhẹ có độ cứng $k = 50\\,\\text{N/m}$ dao động điều hòa trên mặt phẳng nằm ngang với biên độ $A = 4\\text{ cm} = 0,04\\text{ m}$. Bỏ qua mọi ma sát. Xét tính đúng hoặc sai của các phát biểu sau:',
    hasFormula: true,
    formulaLatex: '\\omega = \\sqrt{\\frac{k}{m}} = \\sqrt{\\frac{50}{0,2}} = 5\\sqrt{10} \\approx 5\\pi\\text{ rad/s},\\; W = \\frac{1}{2}kA^2 = 0,04\\text{ J}',
    bloomLevel: 'THONG_HIEU',
    learningOutcome: 'Tính toán tần số góc, chu kì, vận tốc cực đại và cơ năng của con lắc lò xo dao động điều hòa.',
    explanation: 'a) Đúng vì $\\omega = \\sqrt{k/m} = \\sqrt{50/0,2} = \\sqrt{250} \\approx 15,8\\text{ rad/s} = 5\\pi\\text{ rad/s}$. b) Sai vì cơ năng $W = \\frac{1}{2}kA^2 = \\frac{1}{2} \\cdot 50 \\cdot (0,04)^2 = 0,04\\text{ J} = 40\\text{ mJ}$ (không phải $400\\text{ mJ}$). c) Đúng vì khi qua vị trí cân bằng vận tốc có độ lớn cực đại $v_{max} = \\omega A$. d) Đúng vì tại hai vị trí biên lực kéo về đạt độ lớn cực đại $F_{max} = kA = 50 \\cdot 0,04 = 2\\text{ N}$.',
    subItems: [
      { id: 'phys-p2-2-a', originalLabel: 'a', currentLabel: 'a', text: 'Tần số góc dao động của con lắc lò xo được tính theo công thức $\\omega = \\sqrt{\\frac{k}{m}}$ và có giá trị xấp xỉ $5\\pi\\text{ rad/s}$.', isUnderline: true, isRed: true, isTrue: true },
      { id: 'phys-p2-2-b', originalLabel: 'b', currentLabel: 'b', text: 'Cơ năng dao động toàn phần của con lắc lò xo có giá trị bằng $400\\text{ mJ}$.', isUnderline: false, isRed: false, isTrue: false },
      { id: 'phys-p2-2-c', originalLabel: 'c', currentLabel: 'c', text: 'Khi vật nhỏ đi qua vị trí cân bằng ($x = 0$), tốc độ của vật đạt giá trị cực đại và gia tốc bằng $0$.', isUnderline: true, isRed: true, isTrue: true },
      { id: 'phys-p2-2-d', originalLabel: 'd', currentLabel: 'd', text: 'Độ lớn lực kéo về cực đại tác dụng lên vật tại hai biên là $F_{max} = kA = 2\\text{ N}$.', isUnderline: true, isRed: true, isTrue: true },
    ],
  },

  // --- CÂU 3 (MÔN HÓA HỌC): PHẢN ỨNG ESTE HÓA VÀ HỢP CHẤT HỮU CƠ ---
  {
    id: 'chem-p2-3',
    part: 'PART_2',
    originalIndex: 19,
    displayIndex: 3,
    stemText: 'Thực hiện phản ứng este hóa giữa axit axetic ($CH_3COOH$) và ancol etylic ($C_2H_5OH$) trong điều kiện đun hồi lưu có mặt axit sunfuric đặc xúc tác: $CH_3COOH + C_2H_5OH \\xrightleftharpoons{H_2SO_4\\,\\text{đặc},\\, t^\\circ} CH_3COOC_2H_5 + H_2O$. Xét tính đúng hoặc sai của các nhận định dưới đây:',
    hasFormula: true,
    formulaLatex: 'CH_{3}COOH + C_{2}H_{5}OH \\xrightleftharpoons{H_{2}SO_{4}\\,\\text{đặc},\\, t^{\\circ}} CH_{3}COOC_{2}H_{5} + H_{2}O',
    bloomLevel: 'THONG_HIEU',
    learningOutcome: 'Phân tích cơ chế phản ứng este hóa, vai trò của chất xúc tác H2SO4 đặc và đặc điểm tính chất este.',
    explanation: 'a) Đúng vì đây là phản ứng thuận nghịch, hiệu suất không đạt $100\\%$. b) Đúng vì axit $H_2SO_4$ đặc đóng vai trò vừa là chất xúc tác vừa hút nước để chuyển dịch cân bằng theo chiều thuận. c) Sai vì este etyl axetat có nhiệt độ sôi thấp hơn ancol etylic và axit axetic (do không có liên kết hiđro liên phân tử). d) Đúng vì etyl axetat nhẹ hơn nước và ít tan trong nước nên tách lớp khi làm lạnh.',
    subItems: [
      { id: 'chem-p2-3-a', originalLabel: 'a', currentLabel: 'a', text: 'Phản ứng este hóa giữa axit axetic và ancol etylic là phản ứng thuận nghịch hai chiều và tỏa nhiệt nhẹ.', isUnderline: true, isRed: true, isTrue: true },
      { id: 'chem-p2-3-b', originalLabel: 'b', currentLabel: 'b', text: 'Axit sunfuric đặc ($H_2SO_4$) vừa đóng vai trò là chất xúc tác, vừa có tính háo nước làm cân bằng chuyển dịch theo chiều tạo este.', isUnderline: true, isRed: true, isTrue: true },
      { id: 'chem-p2-3-c', originalLabel: 'c', currentLabel: 'c', text: 'Este etyl axetat ($CH_3COOC_2H_5$) có nhiệt độ sôi cao hơn axit axetic ($CH_3COOH$) do có liên kết hiđro liên phân tử bền hơn.', isUnderline: false, isRed: false, isTrue: false },
      { id: 'chem-p2-3-d', originalLabel: 'd', currentLabel: 'd', text: 'Sau khi kết thúc phản ứng este hóa, este $CH_3COOC_2H_5$ nhẹ hơn nước, ít tan trong nước và nổi lên thành một lớp chất lỏng không màu ở phía trên.', isUnderline: true, isRed: true, isTrue: true },
    ],
  },

  // --- CÂU 4 (MÔN SINH HỌC): PHIÊN MÃ mRNA VÀ ĐIỀU HÒA HOẠT ĐỘNG GENE ---
  {
    id: 'bio-p2-4',
    part: 'PART_2',
    originalIndex: 20,
    displayIndex: 4,
    stemText: 'Trong tế bào sinh vật nhân thực, quá trình truyền đạt thông tin di truyền từ phân tử DNA trong nhân ra tế bào chất diễn ra thông qua quá trình phiên mã tạo phân tử tiền mRNA, sau đó cắt bỏ intron nối exon để tạo mRNA trưởng thành. Xét tính đúng hoặc sai của các phát biểu sau:',
    hasFormula: false,
    bloomLevel: 'THONG_HIEU',
    learningOutcome: 'Trình bày cơ chế phiên mã, chế bản mRNA và dịch mã ở sinh vật nhân thực.',
    explanation: 'a) Đúng vì enzyme RNA polymerase chỉ tổng hợp mạch mới theo chiều 5\' → 3\' bằng cách trượt trên mạch khuôn theo chiều 3\' → 5\'. b) Sai vì quá trình cắt bỏ intron và nối các exon chỉ diễn ra ở sinh vật nhân thực, sinh vật nhân sơ không có intron trong vùng mã hóa. c) Đúng vì các exon có thể được nối theo nhiều trật tự khác nhau (alternative splicing) giúp 1 gene tạo ra nhiều chuỗi polypeptide khác nhau. d) Đúng vì codon kết thúc (UAA, UAG, UGA) là tín hiệu dừng dịch mã.',
    subItems: [
      { id: 'bio-p2-4-a', originalLabel: 'a', currentLabel: 'a', text: 'Enzyme RNA polymerase trượt trên mạch khuôn của gene theo chiều $3\' \\to 5\'$ để tổng hợp phân tử RNA theo chiều $5\' \\to 3\'$.', isUnderline: true, isRed: true, isTrue: true },
      { id: 'bio-p2-4-b', originalLabel: 'b', currentLabel: 'b', text: 'Quá trình cắt bỏ đoạn không mã hóa (intron) và nối các đoạn mã hóa (exon) diễn ra phổ biến ở cả tế bào vi khuẩn (nhân sơ) và sinh vật nhân thực.', isUnderline: false, isRed: false, isTrue: false },
      { id: 'bio-p2-4-c', originalLabel: 'c', currentLabel: 'c', text: 'Hiện tượng ghép nối các exon theo các trật tự khác nhau từ một tiền mRNA giúp một gene có thể mã hóa cho nhiều loại chuỗi polypeptide khác nhau.', isUnderline: true, isRed: true, isTrue: true },
      { id: 'bio-p2-4-d', originalLabel: 'd', currentLabel: 'd', text: 'Trên phân tử mRNA trưởng thành, các bộ ba kết thúc (5\'UAA3\', 5\'UAG3\', 5\'UGA3\') không mã hóa cho amino acid nào mà đóng vai trò phát tín hiệu dừng dịch mã.', isUnderline: true, isRed: true, isTrue: true },
    ],
  },

  // =========================================================================
  // PHẦN III: TRẮC NGHIỆM TRẢ LỜI NGẮN (8 CÂU — TỪ CÂU 1 ĐẾN CÂU 8)
  // Chia đều 4 môn: Toán (Câu 1-2), Vật lý (Câu 3-4), Hóa học (Câu 5-6), Sinh học (Câu 7-8)
  // =========================================================================

  // --- MÔN TOÁN HỌC (CÂU 1 -> CÂU 2) ---
  {
    id: 'math-p3-1',
    part: 'PART_3',
    originalIndex: 21,
    displayIndex: 1,
    stemText: 'Cho hình chóp tam giác $S.ABC$ có đáy $ABC$ là tam giác vuông tại $B$ với $AB = 3$, $BC = 4$. Cạnh bên $SA$ vuông góc với mặt phẳng đáy $(ABC)$ và $SA = 12$. Tính thể tích $V$ của khối chóp $S.ABC$.',
    hasFormula: true,
    formulaLatex: 'S_{\\triangle ABC} = \\frac{1}{2} \\times 3 \\times 4 = 6 \\implies V = \\frac{1}{3} S_{\\triangle ABC} \\cdot SA = \\frac{1}{3} \\times 6 \\times 12 = 24',
    bloomLevel: 'THONG_HIEU',
    learningOutcome: 'Tính thể tích của khối chóp có cạnh bên vuông góc với mặt phẳng đáy.',
    explanation: 'Diện tích đáy tam giác vuông là $S = \\frac{1}{2} \\cdot 3 \\cdot 4 = 6$. Thể tích khối chóp là $V = \\frac{1}{3} \\cdot S \\cdot h = \\frac{1}{3} \\cdot 6 \\cdot 12 = 24$.',
    shortAnswer: '24',
    shortAnswerDetectedBy: 'UNDERLINE_RED',
  },
  {
    id: 'math-p3-2',
    part: 'PART_3',
    originalIndex: 22,
    displayIndex: 2,
    stemText: 'Tìm giá trị lớn nhất ($M = \\max f(x)$) của hàm số $f(x) = x^3 - 3x + 13$ trên đoạn $[-1; 2]$.',
    hasFormula: true,
    formulaLatex: 'f\'(x) = 3x^2 - 3 = 0 \\implies x = \\pm 1;\\; f(-1) = 15,\\; f(1) = 11,\\; f(2) = 15 \\implies M = 15',
    bloomLevel: 'THONG_HIEU',
    learningOutcome: 'Tìm giá trị lớn nhất và nhỏ nhất của hàm số bậc ba trên một đoạn đóng.',
    explanation: 'Ta có $f\'(x) = 3x^2 - 3 = 0 \\implies x = \\pm 1 \\in [-1; 2]$. Tính các giá trị: $f(-1) = 15$, $f(1) = 11$, $f(2) = 15$. Giá trị lớn nhất trên đoạn là $M = 15$.',
    shortAnswer: '15',
    shortAnswerDetectedBy: 'UNDERLINE_RED',
  },

  // --- MÔN VẬT LÝ (CÂU 3 -> CÂU 4) ---
  {
    id: 'phys-p3-3',
    part: 'PART_3',
    originalIndex: 23,
    displayIndex: 3,
    stemText: 'Một con lắc đơn có chiều dài dây treo $l = 1\\text{ m}$ dao động điều hòa tại nơi có gia tốc trọng trường $g = \\pi^2 = 9,87\\text{ m/s}^2$. Hãy tính chu kì dao động riêng $T$ của con lắc đơn này (tính theo đơn vị giây, làm tròn kết quả đến số nguyên gần nhất).',
    hasFormula: true,
    formulaLatex: 'T = 2\\pi \\sqrt{\\frac{l}{g}} = 2\\pi \\sqrt{\\frac{1}{\\pi^2}} = 2\\text{ s}',
    bloomLevel: 'THONG_HIEU',
    learningOutcome: 'Tính chu kì dao động điều hòa của con lắc đơn.',
    explanation: 'Chu kì con lắc đơn là $T = 2\\pi \\sqrt{\\frac{l}{g}} = 2\\pi \\sqrt{\\frac{1}{\\pi^2}} = 2\\text{ s}$.',
    shortAnswer: '2',
    shortAnswerDetectedBy: 'UNDERLINE_RED',
  },
  {
    id: 'phys-p3-4',
    part: 'PART_3',
    originalIndex: 24,
    displayIndex: 4,
    stemText: 'Một khung dây phẳng kín có diện tích $S = 200\\text{ cm}^2 = 0,02\\text{ m}^2$ gồm $N = 100$ vòng dây được đặt trong từ trường đều có cảm ứng từ $B = 0,4\\text{ T}$. Vectơ pháp tuyến $\\vec{n}$ của mặt phẳng khung hợp với $\\vec{B}$ một góc $\\alpha = 0^\\circ$. Hãy tính độ lớn của từ thông cực đại $\\Phi$ xuyên qua khung dây (tính theo đơn vị Weber - Wb, kết quả viết dạng số thập phân).',
    hasFormula: true,
    formulaLatex: '\\Phi = N B S \\cos \\alpha = 100 \\times 0,4 \\times 0,02 \\times \\cos(0^\\circ) = 0,8\\text{ Wb}',
    bloomLevel: 'THONG_HIEU',
    learningOutcome: 'Tính từ thông qua khung dây dẫn đặt trong từ trường đều.',
    explanation: 'Từ thông qua khung dây là $\\Phi = NBS\\cos\\alpha = 100 \\cdot 0,4 \\cdot 0,02 \\cdot \\cos(0^\\circ) = 0,8\\text{ Wb}$.',
    shortAnswer: '0,8',
    shortAnswerDetectedBy: 'UNDERLINE_RED',
  },

  // --- MÔN HÓA HỌC (CÂU 5 -> CÂU 6) ---
  {
    id: 'chem-p3-5',
    part: 'PART_3',
    originalIndex: 25,
    displayIndex: 5,
    stemText: 'Dẫn toàn bộ $4,958\\text{ lít}$ khí $CO_2$ (ở điều kiện chuẩn $25^\\circ\\text{C},\\; 1\\text{ bar}$, tương ứng số mol $n = 0,2\\text{ mol}$) vào lượng dư dung dịch nước vôi trong $Ca(OH)_2$: $CO_2 + Ca(OH)_2 \\to CaCO_3\\downarrow + H_2O$. Tính khối lượng kết tủa canxi cacbonat ($CaCO_3$, khối lượng mol $M = 100\\text{ g/mol}$) thu được sau phản ứng (tính theo đơn vị gam).',
    hasFormula: true,
    formulaLatex: 'n_{CaCO_3} = n_{CO_2} = 0,2\\text{ mol} \\implies m_{CaCO_3} = 0,2 \\times 100 = 20\\text{ g}',
    bloomLevel: 'THONG_HIEU',
    learningOutcome: 'Tính khối lượng kết tủa thu được trong phản ứng giữa khí CO2 và dung dịch kiềm dư.',
    explanation: 'Vì dung dịch $Ca(OH)_2$ dư nên phản ứng chỉ tạo muối trung hòa kết tủa: $n_{CaCO_3} = n_{CO_2} = 0,2\\text{ mol}$. Khối lượng kết tủa thu được là $m = 0,2 \\cdot 100 = 20\\text{ g}$.',
    shortAnswer: '20',
    shortAnswerDetectedBy: 'UNDERLINE_RED',
  },
  {
    id: 'chem-p3-6',
    part: 'PART_3',
    originalIndex: 26,
    displayIndex: 6,
    stemText: 'Đun nóng hỗn hợp gồm $60\\text{ g}$ axit axetic ($CH_3COOH$, tương ứng $1\\text{ mol}$) và $92\\text{ g}$ ancol etylic ($C_2H_5OH$, tương ứng $2\\text{ mol}$) với xúc tác axit $H_2SO_4$ đặc. Kết thúc phản ứng thu được $66\\text{ g}$ este etyl axetat ($CH_3COOC_2H_5$, khối lượng mol $M = 88\\text{ g/mol}$, tương ứng $0,75\\text{ mol}$). Hãy tính hiệu suất $H$ của phản ứng este hóa này (tính theo đơn vị phần trăm - %).',
    hasFormula: true,
    formulaLatex: 'H = \\frac{n_{este\\;thuc\\;te}}{n_{axit\\;ly\\;thuyet}} \\times 100\\% = \\frac{0,75}{1,0} \\times 100\\% = 75\\%',
    bloomLevel: 'VAN_DUNG',
    learningOutcome: 'Tính hiệu suất phản ứng este hóa theo chất phản ứng hết.',
    explanation: 'Tỉ lệ mol $CH_3COOH : C_2H_5OH = 1 : 2$ nên hiệu suất tính theo axit axetic ($1\\text{ mol}$). Số mol este thực tế thu được là $n = 66 / 88 = 0,75\\text{ mol}$. Hiệu suất phản ứng là $H = (0,75 / 1,0) \\cdot 100\\% = 75\\%$.',
    shortAnswer: '75',
    shortAnswerDetectedBy: 'UNDERLINE_RED',
  },

  // --- MÔN SINH HỌC (CÂU 7 -> CÂU 8) ---
  {
    id: 'bio-p3-7',
    part: 'PART_3',
    originalIndex: 27,
    displayIndex: 7,
    stemText: 'Một phân tử DNA mạch kép ở sinh vật nhân thực có tổng số $2400$ nucleotide, trong đó số nucleotide loại Adenine chiếm $20\\%$ tổng số nucleotide của phân tử. Hãy tính tổng số liên kết hydrogen giữa hai mạch đơn của phân tử DNA này.',
    hasFormula: true,
    formulaLatex: 'A = T = 480,\\; G = C = 720 \\implies H = 2A + 3G = 2(480) + 3(720) = 3120',
    bloomLevel: 'THONG_HIEU',
    learningOutcome: 'Vận dụng nguyên tắc bổ sung để tính số lượng nucleotide và số liên kết hydrogen của phân tử DNA.',
    explanation: 'Số nucleotide loại $A = T = 2400 \\times 20\\% = 480$. Số nucleotide loại $G = C = \\frac{2400 - 2 \\times 480}{2} = 720$. Tổng số liên kết hydrogen là $H = 2A + 3G = 2 \\times 480 + 3 \\times 720 = 960 + 2160 = 3120$.',
    shortAnswer: '3120',
    shortAnswerDetectedBy: 'UNDERLINE_RED',
  },
  {
    id: 'bio-p3-8',
    part: 'PART_3',
    originalIndex: 28,
    displayIndex: 8,
    stemText: 'Cho phép lai phân tích cây đậu Hà Lan dị hợp tử 3 cặp gene phân li độc lập: $P: AaBbDd \\times aabbdd$. Biết mỗi gene quy định một tính trạng và trội là trội hoàn toàn. Theo lí thuyết, đời con $F_a$ có tối đa bao nhiêu loại kiểu gene khác nhau?',
    hasFormula: true,
    formulaLatex: '(Aa \\times aa) \\to 2;\\; (Bb \\times bb) \\to 2;\\; (Dd \\times dd) \\to 2 \\implies 2 \\times 2 \\times 2 = 8',
    bloomLevel: 'THONG_HIEU',
    learningOutcome: 'Tính số loại kiểu gene tạo ra ở đời con trong phép lai phân li độc lập.',
    explanation: 'Xét từng cặp gene riêng rẽ: $(Aa \\times aa) \\to 2$ kiểu gene ($Aa, aa$); $(Bb \\times bb) \\to 2$ kiểu gene ($Bb, bb$); $(Dd \\times dd) \\to 2$ kiểu gene ($Dd, dd$). Số loại kiểu gene tối đa ở đời con là $2 \\times 2 \\times 2 = 8$.',
    shortAnswer: '8',
    shortAnswerDetectedBy: 'UNDERLINE_RED',
  },
];

/**
 * Đăng ký động các tính năng nâng cao (Dynamic Feature Registry)
 */
export const DYNAMIC_FEATURE_REGISTRY: FeatureReleaseItem[] = [
  {
    id: 'feat-multi-subject-master',
    version: 'v3.5.0',
    releaseDate: '2025-10',
    title: 'Đề Mẫu Đánh Giá Năng Lực Tích Hợp 4 Môn: Toán - Lý - Hóa - Sinh',
    category: 'CORE_PARSER',
    description: 'Chia đều 4 môn học theo tỉ lệ chuẩn ĐGNL hiện hành gồm 3 phần độc lập: 16 câu trắc nghiệm 4 lựa chọn, 4 câu đúng/sai (16 mệnh đề) và 8 câu trả lời ngắn. Tích hợp 100% công thức phức tạp, khối lập phương 3D, đồ thị hàm số, đồ thị dao động, sơ đồ phản ứng và phả hệ.',
    technicalSpec: 'Khớp 100% tiêu chuẩn Office Math Markup (<m:oMath>), Word Table (<w:tbl>) và In Line with Text Image (<wp:inline>).',
    autoDetected: true,
  },
  {
    id: 'feat-ai-privacy-sandbox',
    version: 'v3.2.0',
    releaseDate: '2025-10',
    title: 'Môi Trường Cô Lập Bảo Mật AI Đề Thi & Tự Hủy Dữ Liệu (Zero-Trace Purge)',
    category: 'AI_ENGINE',
    description: 'Chạy suy luận cục bộ bảo vệ bản quyền đề thi độc quyền. Tự động che dấu dữ liệu định danh (PII) và xóa sạch bộ nhớ tạm sau khi tải tệp.',
    technicalSpec: 'No-Store Ephemeral Memory + Regex PII Redaction + Auto-Purge Hook on .docx/.zip Download.',
    autoDetected: true,
  },
  {
    id: 'feat-master-answer-sheet-2025',
    version: 'v2.8.0',
    releaseDate: '2025-10',
    title: 'Bảng Đáp Án Chung Tất Cả Mã Đề Trong 1 Khung & Quốc Hiệu Tiêu Ngữ',
    category: 'WORD_EXPORT',
    description: 'Xuất file Bảng đáp án chung (.docx) gồm tất cả các mã đề xếp từ trên xuống trong 1 khung lớn với 3 cột màu (Phần I · Phần II · Phần III). Toàn bộ đề thi dùng font Times New Roman 12pt, canh trái tự động co dãn đều và đánh số trang + mã đề ở Footer.',
    technicalSpec: 'Times New Roman 12pt · w:tblLayout autofit · Footer PAGE/NUMPAGES.',
    autoDetected: true,
  },
  {
    id: 'feat-parser-2025',
    version: 'v2.5.0',
    releaseDate: '2025-10',
    title: 'Bộ Phân Tích Cú Pháp XML (.docx) 3 Phần Độc Lập',
    category: 'CORE_PARSER',
    description: 'Bóc tách cây XML trực tiếp từ file Word (.docx) trên trình duyệt: nhận diện tự động Gạch chân (<w:u>) và Tô màu đỏ (<w:color> #FF0000, #C00000, #ED1C24) cho cả Phần I, Phần II và Phần III.',
    technicalSpec: 'isCorrect = (isUnderline == true) || (isRed == true). Tự động reset đánh số từ Câu 1 ở mỗi phần.',
    autoDetected: true,
  },
  {
    id: 'feat-live-editor',
    version: 'v2.5.0',
    releaseDate: '2025-10',
    title: 'Trình Biên Tập Trực Tiếp (Live In-App Editor) & Validator 1 Chạm',
    category: 'LIVE_EDITOR',
    description: 'Quét tự động câu thiếu đáp án, câu thừa đáp án hoặc thiếu dữ kiện. Bấm [Sửa ngay] tự động cuộn và tô sáng câu lỗi. Hỗ trợ thanh công cụ nhanh U / A / B và gạt Đúng/Sai 1 chạm.',
    technicalSpec: 'Đồng bộ cây dữ liệu AST thời gian thực, mở khóa nút [Trộn đề] ngay sau khi bấm [Lưu chỉnh sửa].',
    autoDetected: true,
  },
  {
    id: 'feat-qr-multiplatform',
    version: 'v2.5.2',
    releaseDate: '2025-10',
    title: 'Sinh Mã QR Chấm Thi Đa Nền Tảng (QM2025, TNMaker, Azota)',
    category: 'QR_ENGINE',
    description: 'Mã hóa chuỗi đáp án 3 phần thành mã QR mật độ hạt tối ưu, quét nhận diện trong 1 giây và tự động nhúng hình ảnh QR vào cuối trang đáp án trong file Word (.docx).',
    technicalSpec: 'Chuẩn Payload: PHAN1: 1A,2C... | PHAN2: 1-TFTT,2-FTTF... | PHAN3: 1:12.5,2:4...',
    autoDetected: true,
  },
];
