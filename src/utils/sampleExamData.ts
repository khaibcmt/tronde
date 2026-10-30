import { ExamQuestion, FeatureReleaseItem } from '../types/exam';

/**
 * HỆ THỐNG HÌNH VẼ VECTOR ĐỘ PHÂN GIẢI CAO (300 DPI, NỀN TRẮNG TINH KHIẾT #FFFFFF)
 * Chuyên dụng cho Đề Kiểm Tra Cuối Học Kì 1 — Môn Sinh Học 12 (Chương trình GDPT 2018)
 */

// 1. Sơ đồ cấu trúc không gian phân tử DNA xoắn kép & liên kết hydrogen (A=T, G≡C) và quá trình tái bản
const SVG_DNA_STRUCTURE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 300" width="520" height="300" style="background:#FFFFFF">
  <rect width="100%" height="100%" fill="#FFFFFF"/>
  <!-- Tiêu đề sơ đồ -->
  <text x="260" y="24" text-anchor="middle" font-family="Times New Roman, serif" font-size="15" font-weight="bold" fill="#0F172A">SƠ ĐỒ CẤU TRÚC PHÂN TỬ DNA MẠCH KÉP NGƯỢC CHIỀU &amp; LIÊN KẾT HYDROGEN</text>
  
  <!-- Khung mạch khuôn 1: Chiều 3' -> 5' -->
  <rect x="45" y="55" width="430" height="32" rx="6" fill="#DBEAFE" stroke="#1D4ED8" stroke-width="2"/>
  <text x="25" y="76" font-family="Times New Roman, serif" font-size="16" font-weight="bold" fill="#1D4ED8">3'</text>
  <text x="485" y="76" font-family="Times New Roman, serif" font-size="16" font-weight="bold" fill="#1D4ED8">5'</text>
  <text x="260" y="76" text-anchor="middle" font-family="Times New Roman, serif" font-size="13" font-weight="bold" fill="#1E3A8A">Mạch полиnucleotide khuôn (Khung Đường Deoxyribose - Phosphate)</text>

  <!-- Khung mạch bổ sung 2: Chiều 5' -> 3' -->
  <rect x="45" y="215" width="430" height="32" rx="6" fill="#DCFCE7" stroke="#15803D" stroke-width="2"/>
  <text x="25" y="236" font-family="Times New Roman, serif" font-size="16" font-weight="bold" fill="#15803D">5'</text>
  <text x="485" y="236" font-family="Times New Roman, serif" font-size="16" font-weight="bold" fill="#15803D">3'</text>
  <text x="260" y="236" text-anchor="middle" font-family="Times New Roman, serif" font-size="13" font-weight="bold" fill="#14532D">Mạch bổ sung ngược chiều (5' → 3')</text>

  <!-- Cặp 1: A = T (2 liên kết H) -->
  <rect x="75" y="87" width="44" height="34" rx="4" fill="#EFF6FF" stroke="#2563EB" stroke-width="2"/>
  <text x="97" y="109" text-anchor="middle" font-family="Times New Roman, serif" font-size="16" font-weight="bold" fill="#1D4ED8">A</text>
  <line x1="90" y1="123" x2="90" y2="177" stroke="#DC2626" stroke-width="2" stroke-dasharray="4,3"/>
  <line x1="104" y1="123" x2="104" y2="177" stroke="#DC2626" stroke-width="2" stroke-dasharray="4,3"/>
  <rect x="75" y="181" width="44" height="34" rx="4" fill="#FEF2F2" stroke="#DC2626" stroke-width="2"/>
  <text x="97" y="203" text-anchor="middle" font-family="Times New Roman, serif" font-size="16" font-weight="bold" fill="#DC2626">T</text>

  <!-- Cặp 2: G ≡ C (3 liên kết H) -->
  <rect x="155" y="87" width="44" height="34" rx="4" fill="#FEF3C7" stroke="#D97706" stroke-width="2"/>
  <text x="177" y="109" text-anchor="middle" font-family="Times New Roman, serif" font-size="16" font-weight="bold" fill="#B45309">G</text>
  <line x1="167" y1="123" x2="167" y2="177" stroke="#059669" stroke-width="2" stroke-dasharray="4,3"/>
  <line x1="177" y1="123" x2="177" y2="177" stroke="#059669" stroke-width="2" stroke-dasharray="4,3"/>
  <line x1="187" y1="123" x2="187" y2="177" stroke="#059669" stroke-width="2" stroke-dasharray="4,3"/>
  <rect x="155" y="181" width="44" height="34" rx="4" fill="#ECFDF5" stroke="#059669" stroke-width="2"/>
  <text x="177" y="203" text-anchor="middle" font-family="Times New Roman, serif" font-size="16" font-weight="bold" fill="#047857">C</text>

  <!-- Cặp 3: T = A (2 liên kết H) -->
  <rect x="235" y="87" width="44" height="34" rx="4" fill="#FEF2F2" stroke="#DC2626" stroke-width="2"/>
  <text x="257" y="109" text-anchor="middle" font-family="Times New Roman, serif" font-size="16" font-weight="bold" fill="#DC2626">T</text>
  <line x1="250" y1="123" x2="250" y2="177" stroke="#DC2626" stroke-width="2" stroke-dasharray="4,3"/>
  <line x1="264" y1="123" x2="264" y2="177" stroke="#DC2626" stroke-width="2" stroke-dasharray="4,3"/>
  <rect x="235" y="181" width="44" height="34" rx="4" fill="#EFF6FF" stroke="#2563EB" stroke-width="2"/>
  <text x="257" y="203" text-anchor="middle" font-family="Times New Roman, serif" font-size="16" font-weight="bold" fill="#1D4ED8">A</text>

  <!-- Cặp 4: C ≡ G (3 liên kết H) -->
  <rect x="315" y="87" width="44" height="34" rx="4" fill="#ECFDF5" stroke="#059669" stroke-width="2"/>
  <text x="337" y="109" text-anchor="middle" font-family="Times New Roman, serif" font-size="16" font-weight="bold" fill="#047857">C</text>
  <line x1="327" y1="123" x2="327" y2="177" stroke="#059669" stroke-width="2" stroke-dasharray="4,3"/>
  <line x1="337" y1="123" x2="337" y2="177" stroke="#059669" stroke-width="2" stroke-dasharray="4,3"/>
  <line x1="347" y1="123" x2="347" y2="177" stroke="#059669" stroke-width="2" stroke-dasharray="4,3"/>
  <rect x="315" y="181" width="44" height="34" rx="4" fill="#FEF3C7" stroke="#D97706" stroke-width="2"/>
  <text x="337" y="203" text-anchor="middle" font-family="Times New Roman, serif" font-size="16" font-weight="bold" fill="#B45309">G</text>

  <!-- Cặp 5: G ≡ C (3 liên kết H) -->
  <rect x="395" y="87" width="44" height="34" rx="4" fill="#FEF3C7" stroke="#D97706" stroke-width="2"/>
  <text x="417" y="109" text-anchor="middle" font-family="Times New Roman, serif" font-size="16" font-weight="bold" fill="#B45309">G</text>
  <line x1="407" y1="123" x2="407" y2="177" stroke="#059669" stroke-width="2" stroke-dasharray="4,3"/>
  <line x1="417" y1="123" x2="417" y2="177" stroke="#059669" stroke-width="2" stroke-dasharray="4,3"/>
  <line x1="427" y1="123" x2="427" y2="177" stroke="#059669" stroke-width="2" stroke-dasharray="4,3"/>
  <rect x="395" y="181" width="44" height="34" rx="4" fill="#ECFDF5" stroke="#059669" stroke-width="2"/>
  <text x="417" y="203" text-anchor="middle" font-family="Times New Roman, serif" font-size="16" font-weight="bold" fill="#047857">C</text>

  <!-- Chú thích cuối hình -->
  <text x="260" y="276" text-anchor="middle" font-family="Times New Roman, serif" font-size="13" font-style="italic" fill="#334155">Nguyên tắc bổ sung: A liên kết với T bằng 2 liên kết hydrogen; G liên kết với C bằng 3 liên kết hydrogen (H = 2A + 3G)</text>
</svg>`;

// 2. Sơ đồ Operon Lac ở vi khuẩn E. coli (Vùng P, O và nhóm gene cấu trúc Z, Y, A)
const SVG_LAC_OPERON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 230" width="520" height="230" style="background:#FFFFFF">
  <rect width="100%" height="100%" fill="#FFFFFF"/>
  <text x="260" y="26" text-anchor="middle" font-family="Times New Roman, serif" font-size="15" font-weight="bold" fill="#0F172A">SƠ ĐỒ CẤU TRÚC OPERON LAC Ở VI KHUẨN E. COLI (JACOB &amp; MONOD)</text>
  
  <!-- Trục DNA -->
  <line x1="25" y1="95" x2="495" y2="95" stroke="#475569" stroke-width="4"/>

  <!-- Gene điều hòa lacI -->
  <rect x="35" y="72" width="75" height="46" rx="5" fill="#F3E8FF" stroke="#7E22CE" stroke-width="2"/>
  <text x="72" y="99" text-anchor="middle" font-family="Times New Roman, serif" font-size="15" font-weight="bold" fill="#6B21A8">lacI (R)</text>
  <text x="72" y="58" text-anchor="middle" font-family="Times New Roman, serif" font-size="12" font-weight="bold" fill="#6B21A8">Gene điều hòa</text>

  <!-- Vùng khởi động P -->
  <rect x="135" y="72" width="60" height="46" rx="5" fill="#FEF3C7" stroke="#D97706" stroke-width="2"/>
  <text x="165" y="99" text-anchor="middle" font-family="Times New Roman, serif" font-size="16" font-weight="bold" fill="#B45309">P</text>
  <text x="165" y="58" text-anchor="middle" font-family="Times New Roman, serif" font-size="12" font-weight="bold" fill="#B45309">Khởi động</text>

  <!-- Vùng vận hành O -->
  <rect x="195" y="72" width="60" height="46" rx="5" fill="#FEE2E2" stroke="#DC2626" stroke-width="2"/>
  <text x="225" y="99" text-anchor="middle" font-family="Times New Roman, serif" font-size="16" font-weight="bold" fill="#B91C1C">O</text>
  <text x="225" y="58" text-anchor="middle" font-family="Times New Roman, serif" font-size="12" font-weight="bold" fill="#B91C1C">Vận hành</text>

  <!-- Các gene cấu trúc lacZ, lacY, lacA -->
  <rect x="255" y="72" width="75" height="46" rx="5" fill="#DBEAFE" stroke="#1D4ED8" stroke-width="2"/>
  <text x="292" y="99" text-anchor="middle" font-family="Times New Roman, serif" font-size="15" font-weight="bold" fill="#1E40AF">lacZ</text>

  <rect x="330" y="72" width="75" height="46" rx="5" fill="#E0F2FE" stroke="#0284C7" stroke-width="2"/>
  <text x="367" y="99" text-anchor="middle" font-family="Times New Roman, serif" font-size="15" font-weight="bold" fill="#0369A1">lacY</text>

  <rect x="405" y="72" width="75" height="46" rx="5" fill="#DCFCE7" stroke="#15803D" stroke-width="2"/>
  <text x="442" y="99" text-anchor="middle" font-family="Times New Roman, serif" font-size="15" font-weight="bold" fill="#166534">lacA</text>

  <!-- Ngoặc nhọn cụm Operon Lac -->
  <line x1="135" y1="135" x2="480" y2="135" stroke="#0F172A" stroke-width="2"/>
  <line x1="135" y1="127" x2="135" y2="135" stroke="#0F172A" stroke-width="2"/>
  <line x1="480" y1="127" x2="480" y2="135" stroke="#0F172A" stroke-width="2"/>
  <text x="307" y="155" text-anchor="middle" font-family="Times New Roman, serif" font-size="14" font-weight="bold" fill="#0F172A">Cấu trúc Operon Lac (P - O - Z - Y - A)</text>

  <!-- Sản phẩm enzyme -->
  <text x="292" y="182" text-anchor="middle" font-family="Times New Roman, serif" font-size="12" font-style="italic" fill="#1E40AF">β-galactosidase</text>
  <text x="367" y="182" text-anchor="middle" font-family="Times New Roman, serif" font-size="12" font-style="italic" fill="#0369A1">Permease</text>
  <text x="442" y="182" text-anchor="middle" font-family="Times New Roman, serif" font-size="12" font-style="italic" fill="#166534">Transacetylase</text>
  <text x="72" y="182" text-anchor="middle" font-family="Times New Roman, serif" font-size="12" font-style="italic" fill="#6B21A8">Protein ức chế</text>
</svg>`;

// 3. Sơ đồ phả hệ 3 thế hệ (Câu 16 Phần I: Bệnh di truyền gene lặn trên NST thường)
const SVG_PEDIGREE_CHART_1 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 280" width="480" height="280" style="background:#FFFFFF">
  <rect width="100%" height="100%" fill="#FFFFFF"/>
  <text x="20" y="55" font-family="Times New Roman, serif" font-size="16" font-weight="bold" fill="#1E293B">I</text>
  <text x="20" y="140" font-family="Times New Roman, serif" font-size="16" font-weight="bold" fill="#1E293B">II</text>
  <text x="20" y="230" font-family="Times New Roman, serif" font-size="16" font-weight="bold" fill="#1E293B">III</text>
  <!-- Chú giải -->
  <rect x="305" y="15" width="18" height="18" fill="#FFFFFF" stroke="#0F172A" stroke-width="2"/>
  <text x="330" y="29" font-family="Times New Roman, serif" font-size="13">: Nam bình thường</text>
  <circle cx="314" cy="48" r="9" fill="#FFFFFF" stroke="#0F172A" stroke-width="2"/>
  <text x="330" y="52" font-family="Times New Roman, serif" font-size="13">: Nữ bình thường</text>
  <rect x="305" y="65" width="18" height="18" fill="#0F172A" stroke="#0F172A" stroke-width="2"/>
  <text x="330" y="79" font-family="Times New Roman, serif" font-size="13">: Nam bị bệnh</text>
  <circle cx="314" cy="98" r="9" fill="#0F172A" stroke="#0F172A" stroke-width="2"/>
  <text x="330" y="102" font-family="Times New Roman, serif" font-size="13">: Nữ bị bệnh</text>

  <!-- Thế hệ I: I-1 x I-2 bình thường -->
  <rect x="90" y="40" width="22" height="22" fill="#FFFFFF" stroke="#0F172A" stroke-width="2"/>
  <text x="96" y="32" font-family="Times New Roman, serif" font-size="13" font-weight="bold">1</text>
  <line x1="112" y1="51" x2="155" y2="51" stroke="#0F172A" stroke-width="2"/>
  <circle cx="166" cy="51" r="11" fill="#FFFFFF" stroke="#0F172A" stroke-width="2"/>
  <text x="162" y="32" font-family="Times New Roman, serif" font-size="13" font-weight="bold">2</text>
  <line x1="133" y1="51" x2="133" y2="85" stroke="#0F172A" stroke-width="2"/>
  <line x1="75" y1="85" x2="200" y2="85" stroke="#0F172A" stroke-width="2"/>

  <!-- Thế hệ II: II-1 (nữ bị bệnh aa), II-2 (nữ bình thường), II-3 (nam bình thường) x II-4 (nữ bình thường) -->
  <line x1="75" y1="85" x2="75" y2="125" stroke="#0F172A" stroke-width="2"/>
  <circle cx="75" cy="136" r="11" fill="#0F172A" stroke="#0F172A" stroke-width="2"/>
  <text x="71" y="164" font-family="Times New Roman, serif" font-size="13" font-weight="bold">1</text>

  <line x1="133" y1="85" x2="133" y2="125" stroke="#0F172A" stroke-width="2"/>
  <circle cx="133" cy="136" r="11" fill="#FFFFFF" stroke="#0F172A" stroke-width="2"/>
  <text x="129" y="164" font-family="Times New Roman, serif" font-size="13" font-weight="bold">2</text>

  <line x1="200" y1="85" x2="200" y2="125" stroke="#0F172A" stroke-width="2"/>
  <rect x="189" y="125" width="22" height="22" fill="#FFFFFF" stroke="#0F172A" stroke-width="2"/>
  <text x="195" y="164" font-family="Times New Roman, serif" font-size="13" font-weight="bold">3</text>
  <line x1="211" y1="136" x2="250" y2="136" stroke="#0F172A" stroke-width="2"/>
  <circle cx="261" cy="136" r="11" fill="#FFFFFF" stroke="#0F172A" stroke-width="2"/>
  <text x="257" y="164" font-family="Times New Roman, serif" font-size="13" font-weight="bold">4</text>

  <!-- Thế hệ III: III-1 (nữ bình thường), III-2 (nam bị bệnh), III-3 (nữ bình thường) -->
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

// 4. Sơ đồ phả hệ 3 thế hệ chuyên sâu (Câu 4 Phần II: Di truyền học người & Tư vấn di truyền)
const SVG_PEDIGREE_CHART_2 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 290" width="500" height="290" style="background:#FFFFFF">
  <rect width="100%" height="100%" fill="#FFFFFF"/>
  <text x="250" y="22" text-anchor="middle" font-family="Times New Roman, serif" font-size="14" font-weight="bold" fill="#0F172A">SƠ ĐỒ PHẢ HỆ BỆNH BẠCH TẠNG QUA 3 THẾ HỆ TRONG MỘT GIA ĐÌNH</text>
  <text x="18" y="65" font-family="Times New Roman, serif" font-size="16" font-weight="bold" fill="#1E293B">I</text>
  <text x="18" y="150" font-family="Times New Roman, serif" font-size="16" font-weight="bold" fill="#1E293B">II</text>
  <text x="18" y="240" font-family="Times New Roman, serif" font-size="16" font-weight="bold" fill="#1E293B">III</text>

  <!-- Cặp I-1 x I-2 (Gia đình 1) -->
  <rect x="65" y="50" width="22" height="22" fill="#FFFFFF" stroke="#0F172A" stroke-width="2"/>
  <text x="71" y="43" font-family="Times New Roman, serif" font-size="13" font-weight="bold">1</text>
  <line x1="87" y1="61" x2="125" y2="61" stroke="#0F172A" stroke-width="2"/>
  <circle cx="136" cy="61" r="11" fill="#FFFFFF" stroke="#0F172A" stroke-width="2"/>
  <text x="132" y="43" font-family="Times New Roman, serif" font-size="13" font-weight="bold">2</text>
  <line x1="106" y1="61" x2="106" y2="95" stroke="#0F172A" stroke-width="2"/>
  <line x1="65" y1="95" x2="155" y2="95" stroke="#0F172A" stroke-width="2"/>

  <!-- Con của I-1 x I-2: II-1 (nữ bệnh aa), II-2 (nam bình thường) -->
  <line x1="65" y1="95" x2="65" y2="135" stroke="#0F172A" stroke-width="2"/>
  <circle cx="65" cy="146" r="11" fill="#DC2626" stroke="#991B1B" stroke-width="2"/>
  <text x="61" y="174" font-family="Times New Roman, serif" font-size="13" font-weight="bold">1</text>

  <line x1="155" y1="95" x2="155" y2="135" stroke="#0F172A" stroke-width="2"/>
  <rect x="144" y="135" width="22" height="22" fill="#FFFFFF" stroke="#0F172A" stroke-width="2"/>
  <text x="150" y="174" font-family="Times New Roman, serif" font-size="13" font-weight="bold">2</text>

  <!-- Cặp I-3 x I-4 (Gia đình 2) -->
  <rect x="265" y="50" width="22" height="22" fill="#FFFFFF" stroke="#0F172A" stroke-width="2"/>
  <text x="271" y="43" font-family="Times New Roman, serif" font-size="13" font-weight="bold">3</text>
  <line x1="287" y1="61" x2="325" y2="61" stroke="#0F172A" stroke-width="2"/>
  <circle cx="336" cy="61" r="11" fill="#FFFFFF" stroke="#0F172A" stroke-width="2"/>
  <text x="332" y="43" font-family="Times New Roman, serif" font-size="13" font-weight="bold">4</text>
  <line x1="306" y1="61" x2="306" y2="95" stroke="#0F172A" stroke-width="2"/>
  <line x1="255" y1="95" x2="355" y2="95" stroke="#0F172A" stroke-width="2"/>

  <!-- Con của I-3 x I-4: II-3 (nữ bình thường), II-4 (nam bệnh aa) -->
  <line x1="255" y1="95" x2="255" y2="135" stroke="#0F172A" stroke-width="2"/>
  <circle cx="255" cy="146" r="11" fill="#FFFFFF" stroke="#0F172A" stroke-width="2"/>
  <text x="251" y="174" font-family="Times New Roman, serif" font-size="13" font-weight="bold">3</text>

  <line x1="355" y1="95" x2="355" y2="135" stroke="#0F172A" stroke-width="2"/>
  <rect x="344" y="135" width="22" height="22" fill="#DC2626" stroke="#991B1B" stroke-width="2"/>
  <text x="350" y="174" font-family="Times New Roman, serif" font-size="13" font-weight="bold">4</text>

  <!-- Kết hôn II-2 x II-3 -->
  <line x1="166" y1="146" x2="244" y2="146" stroke="#0F172A" stroke-width="2"/>
  <line x1="205" y1="146" x2="205" y2="215" stroke="#0F172A" stroke-width="2"/>
  <circle cx="205" cy="228" r="13" fill="#FEF3C7" stroke="#D97706" stroke-width="2.5"/>
  <text x="205" y="233" text-anchor="middle" font-family="Times New Roman, serif" font-size="15" font-weight="bold" fill="#B45309">?</text>
  <text x="205" y="262" text-anchor="middle" font-family="Times New Roman, serif" font-size="13" font-weight="bold" fill="#0F172A">III-1 (Xác suất?)</text>

  <!-- Chú thích bên phải -->
  <rect x="385" y="55" width="16" height="16" fill="#FFFFFF" stroke="#0F172A" stroke-width="2"/>
  <text x="407" y="68" font-family="Times New Roman, serif" font-size="12">: Nam bình thường</text>
  <circle cx="393" cy="88" r="8" fill="#FFFFFF" stroke="#0F172A" stroke-width="2"/>
  <text x="407" y="92" font-family="Times New Roman, serif" font-size="12">: Nữ bình thường</text>
  <rect x="385" y="110" width="16" height="16" fill="#DC2626" stroke="#991B1B" stroke-width="2"/>
  <text x="407" y="123" font-family="Times New Roman, serif" font-size="12">: Nam bị bệnh</text>
  <circle cx="393" cy="143" r="8" fill="#DC2626" stroke="#991B1B" stroke-width="2"/>
  <text x="407" y="147" font-family="Times New Roman, serif" font-size="12">: Nữ bị bệnh</text>
</svg>`;

const toSvgDataUrl = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

/**
 * ĐỀ KIỂM TRA CUỐI HỌC KÌ 1 — MÔN SINH HỌC LỚP 12 (CHƯƠNG TRÌNH GDPT 2018)
 * Cấu trúc chuẩn Bộ GD&ĐT (28 câu = 18 câu Phần I + 4 câu Phần II [16 lệnh hỏi] + 6 câu Phần III):
 * - Bao phủ trọn vẹn kiến thức Học kì 1 Sinh học 12:
 *   + Cơ chế di truyền phân tử: Cấu trúc DNA (hình vẽ), tái bản DNA, phiên mã RNA, dịch mã Protein, điều hòa biểu hiện gene Operon Lac (hình vẽ), đột biến gene.
 *   + Cơ chế di truyền NST: Cấu trúc siêu hiển vi NST, đột biến cấu trúc & số lượng NST.
 *   + Quy luật di truyền: Lai một & hai cặp tính trạng Mendel, tương tác gene, liên kết gene & hoán vị gene (Morgan), di truyền liên kết giới tính (NST X, Y), di truyền ngoài nhân (ti thể, lục lạp).
 *   + Di truyền quần thể & Tạo giống: Cấu trúc di truyền quần thể tự thụ/ngẫu phối (Hardy-Weinberg), ưu thế lai, lai giống thực vật/động vật.
 *   + Di truyền học người: Phân tích sơ đồ phả hệ (2 hình phả hệ chuẩn), xác suất tư vấn di truyền, liệu pháp gene.
 * - Sạch 100% lỗi, công thức LaTeX chuẩn xác, sẵn sàng trộn 4 mã đề ngay lập tức.
 */
export const SAMPLE_2025_EXAM_WITH_ERRORS: ExamQuestion[] = [
  // =========================================================================
  // PHẦN I: TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN (18 CÂU — TỪ CÂU 1 ĐẾN CÂU 18)
  // =========================================================================

  {
    id: 'bio12-p1-1',
    part: 'PART_1',
    originalIndex: 1,
    displayIndex: 1,
    stemText: 'Quan sát sơ đồ cấu trúc phân tử DNA mạch kép ở hình bên. Theo nguyên tắc bổ sung (NTBS) giữa hai mạch đơn đối song song ($3\' \\to 5\'$ và $5\' \\to 3\'$), cặp base nitrogenous nào sau đây luôn liên kết đặc hiệu với nhau bằng 3 liên kết hydrogen?',
    hasFormula: true,
    formulaLatex: 'A = T \\;(2\\text{ liên kết H}); \\quad G \\equiv C \\;(3\\text{ liên kết H})',
    bloomLevel: 'NHAN_BIET',
    learningOutcome: 'Nhận biết được cấu trúc hóa học và nguyên tắc bổ sung trong phân tử DNA xoắn kép.',
    explanation: 'Trong phân tử DNA mạch kép, Adenine ($A$) liên kết với Thymine ($T$) bằng 2 liên kết hydrogen ($A=T$), còn Guanine ($G$) liên kết với Cytosine ($C$) bằng 3 liên kết hydrogen ($G \\equiv C$).',
    images: [
      {
        id: 'img-bio12-dna',
        dataUrl: toSvgDataUrl(SVG_DNA_STRUCTURE),
        fileName: 'so_do_cau_truc_dna.svg',
        tagId: '[HINH_ANH_CAU_1]',
        caption: 'Sơ đồ cấu trúc phân tử DNA mạch kép và các liên kết hydrogen giữa các cặp base',
        dpi: 300,
        aspectRatio: 520 / 300,
        widthTwips: 4500,
        heightTwips: 2600,
      },
    ],
    options: [
      { id: 'bio12-p1-1-a', originalLabel: 'A', currentLabel: 'A', text: 'Guanine ($G$) và Cytosine ($C$).', isUnderline: true, isRed: true, isCorrect: true },
      { id: 'bio12-p1-1-b', originalLabel: 'B', currentLabel: 'B', text: 'Adenine ($A$) và Thymine ($T$).', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'bio12-p1-1-c', originalLabel: 'C', currentLabel: 'C', text: 'Adenine ($A$) và Uracil ($U$).', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'bio12-p1-1-d', originalLabel: 'D', currentLabel: 'D', text: 'Guanine ($G$) và Thymine ($T$).', isUnderline: false, isRed: false, isCorrect: false },
    ],
    computedLayout: '2_ROW_2_COL',
  },
  {
    id: 'bio12-p1-2',
    part: 'PART_1',
    originalIndex: 2,
    displayIndex: 2,
    stemText: 'Trong quá trình tái bản DNA ở sinh vật nhân sơ và nhân thực, enzyme DNA polymerase chỉ tổng hợp mạch polynucleotide mới theo một chiều cố định là:',
    hasFormula: true,
    formulaLatex: '5\' \\to 3\'',
    bloomLevel: 'NHAN_BIET',
    learningOutcome: 'Trình bày được vai trò của enzyme DNA polymerase trong cơ chế tái bản DNA.',
    explanation: 'Enzyme DNA polymerase chỉ có khả năng gắn nucleotide tự do vào đầu $3\'\\text{-OH}$ của mạch đang tổng hợp, do đó mạch mới luôn được kéo dài theo chiều $5\' \\to 3\'$.',
    options: [
      { id: 'bio12-p1-2-a', originalLabel: 'A', currentLabel: 'A', text: 'Chiều $5\' \\to 3\'$.', isUnderline: true, isRed: true, isCorrect: true },
      { id: 'bio12-p1-2-b', originalLabel: 'B', currentLabel: 'B', text: 'Chiều $3\' \\to 5\'$.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'bio12-p1-2-c', originalLabel: 'C', currentLabel: 'C', text: 'Cả hai chiều $5\' \\to 3\'$ và $3\' \\to 5\'$ trên cùng một mạch đơn.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'bio12-p1-2-d', originalLabel: 'D', currentLabel: 'D', text: 'Chiều từ điểm kết thúc về điểm khởi đầu tái bản.', isUnderline: false, isRed: false, isCorrect: false },
    ],
    computedLayout: '2_ROW_2_COL',
  },
  {
    id: 'bio12-p1-3',
    part: 'PART_1',
    originalIndex: 3,
    displayIndex: 3,
    stemText: 'Một đoạn mạch gốc của gene có trình tự các nucleotide là $3\'\\text{-TAC GGA CCT GCA ACT-5\'}$. Trình tự các bộ ba (codon) trên phân tử mRNA được phiên mã từ đoạn mạch gốc này là:',
    hasFormula: true,
    formulaLatex: '3\'\\text{-TAC GGA CCT GCA ACT-5\'} \\xrightarrow{\\text{Phiên mã}} 5\'\\text{-AUG CCU GGA CGU UGA-3\'}',
    bloomLevel: 'THONG_HIEU',
    learningOutcome: 'Xác định được trình tự phân tử mRNA tạo thành từ mạch khuôn của gene qua phiên mã.',
    explanation: 'Theo nguyên tắc bổ sung trong phiên mã ($A_{\\text{gốc}} - U,\\; T_{\\text{gốc}} - A,\\; G_{\\text{gốc}} - C,\\; C_{\\text{gốc}} - G$), mạch gốc $3\'\\text{-TAC GGA CCT GCA ACT-5\'}$ tổng hợp nên mRNA có trình tự $5\'\\text{-AUG CCU GGA CGU UGA-3\'}$.',
    options: [
      { id: 'bio12-p1-3-a', originalLabel: 'A', currentLabel: 'A', text: '$5\'\\text{-AUG CCU GGA CGU UGA-3\'}$.', isUnderline: true, isRed: true, isCorrect: true },
      { id: 'bio12-p1-3-b', originalLabel: 'B', currentLabel: 'B', text: '$5\'\\text{-ATG CCT GGA CGT TGA-3\'}$.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'bio12-p1-3-c', originalLabel: 'C', currentLabel: 'C', text: '$3\'\\text{-AUG CCU GGA CGU UGA-5\'}$.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'bio12-p1-3-d', originalLabel: 'D', currentLabel: 'D', text: '$5\'\\text{-UAC GGA CCU GCA ACU-3\'}$.', isUnderline: false, isRed: false, isCorrect: false },
    ],
    computedLayout: '2_ROW_2_COL',
  },
  {
    id: 'bio12-p1-4',
    part: 'PART_1',
    originalIndex: 4,
    displayIndex: 4,
    stemText: 'Trong quá trình dịch mã tổng hợp chuỗi polypeptide ở tế bào, loại nucleic acid nào đóng vai trò như "người phiên dịch" trực tiếp mang bộ ba đối mã (anticodon) khớp bổ sung với codon trên mRNA?',
    hasFormula: false,
    bloomLevel: 'NHAN_BIET',
    learningOutcome: 'Phân biệt được chức năng của các loại RNA (mRNA, tRNA, rRNA) trong quá trình dịch mã.',
    explanation: 'Phân tử tRNA (RNA vận chuyển) mang một đầu gắn amino acid đặc hiệu và một thùy mang bộ ba đối mã (anticodon) khớp bổ sung với bộ ba mã sao (codon) trên mRNA.',
    options: [
      { id: 'bio12-p1-4-a', originalLabel: 'A', currentLabel: 'A', text: 'tRNA (RNA vận chuyển).', isUnderline: true, isRed: true, isCorrect: true },
      { id: 'bio12-p1-4-b', originalLabel: 'B', currentLabel: 'B', text: 'mRNA (RNA thông tin).', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'bio12-p1-4-c', originalLabel: 'C', currentLabel: 'C', text: 'rRNA (RNA ribosome).', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'bio12-p1-4-d', originalLabel: 'D', currentLabel: 'D', text: 'DNA mạch kép trong nhân.', isUnderline: false, isRed: false, isCorrect: false },
    ],
    computedLayout: '2_ROW_2_COL',
  },
  {
    id: 'bio12-p1-5',
    part: 'PART_1',
    originalIndex: 5,
    displayIndex: 5,
    stemText: 'Một phân tử mRNA trưởng thành ở sinh vật nhân sơ có vùng mã hóa liên tục dài $900$ nucleotide (tính từ bộ ba mở đầu $5\'\\text{-AUG-3\'}$ đến hết bộ ba kết thúc $5\'\\text{-UAA-3\'}$). Số lượng amino acid có trong chuỗi polypeptide hoàn chỉnh sau khi cắt bỏ amino acid mở đầu là:',
    hasFormula: true,
    formulaLatex: 'N_{\\text{codon}} = \\frac{900}{3} = 300 \\implies N_{\\text{aa hoàn chỉnh}} = 300 - 2 = 298',
    bloomLevel: 'VAN_DUNG',
    learningOutcome: 'Vận dụng mối quan hệ giữa số ribonucleotide trên mRNA và số amino acid trong chuỗi polypeptide.',
    explanation: 'Tổng số bộ ba trên vùng mã hóa của mRNA là $900 : 3 = 300$ bộ ba. Trong đó có 1 bộ ba kết thúc không mã hóa amino acid và 1 bộ ba mở đầu được cắt bỏ sau dịch mã, nên số amino acid trong chuỗi polypeptide hoàn chỉnh là $300 - 2 = 298$.',
    options: [
      { id: 'bio12-p1-5-a', originalLabel: 'A', currentLabel: 'A', text: '$298$ amino acid.', isUnderline: true, isRed: true, isCorrect: true },
      { id: 'bio12-p1-5-b', originalLabel: 'B', currentLabel: 'B', text: '$299$ amino acid.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'bio12-p1-5-c', originalLabel: 'C', currentLabel: 'C', text: '$300$ amino acid.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'bio12-p1-5-d', originalLabel: 'D', currentLabel: 'D', text: '$297$ amino acid.', isUnderline: false, isRed: false, isCorrect: false },
    ],
    computedLayout: '1_ROW_4_COL',
  },
  {
    id: 'bio12-p1-6',
    part: 'PART_1',
    originalIndex: 6,
    displayIndex: 6,
    stemText: 'Quan sát sơ đồ cấu trúc Operon Lac ở vi khuẩn $E.\\;coli$ (hình bên). Khi môi trường nuôi cấy hoàn toàn không có đường lactose, protein ức chế (do gene điều hòa $lacI$ tổng hợp) sẽ liên kết vào vùng nào để ngăn cản quá trình phiên mã của nhóm gene cấu trúc $lacZ, lacY, lacA$?',
    hasFormula: false,
    bloomLevel: 'THONG_HIEU',
    learningOutcome: 'Giải thích được cơ chế điều hòa biểu hiện gene của Operon Lac ở vi khuẩn E. coli.',
    explanation: 'Khi môi trường không có lactose, protein ức chế ở trạng thái hoạt động sẽ gắn đặc hiệu vào vùng vận hành ($O$ - Operator), làm enzyme RNA polymerase không thể trượt qua để phiên mã các gene cấu trúc $lacZ, lacY, lacA$.',
    images: [
      {
        id: 'img-bio12-operon',
        dataUrl: toSvgDataUrl(SVG_LAC_OPERON),
        fileName: 'so_do_operon_lac.svg',
        tagId: '[HINH_ANH_CAU_6]',
        caption: 'Sơ đồ cấu trúc Operon Lac ở vi khuẩn E. coli',
        dpi: 300,
        aspectRatio: 520 / 230,
        widthTwips: 4500,
        heightTwips: 2000,
      },
    ],
    options: [
      { id: 'bio12-p1-6-a', originalLabel: 'A', currentLabel: 'A', text: 'Vùng vận hành ($O$ — Operator).', isUnderline: true, isRed: true, isCorrect: true },
      { id: 'bio12-p1-6-b', originalLabel: 'B', currentLabel: 'B', text: 'Vùng khởi động ($P$ — Promoter).', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'bio12-p1-6-c', originalLabel: 'C', currentLabel: 'C', text: 'Gene điều hòa ($lacI$).', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'bio12-p1-6-d', originalLabel: 'D', currentLabel: 'D', text: 'Gene cấu trúc $lacZ$.', isUnderline: false, isRed: false, isCorrect: false },
    ],
    computedLayout: '2_ROW_2_COL',
  },
  {
    id: 'bio12-p1-7',
    part: 'PART_1',
    originalIndex: 7,
    displayIndex: 7,
    stemText: 'Một gene có $480$ cặp base Adenine - Thymine ($A=T$) và $720$ cặp base Guanine - Cytosine ($G \\equiv C$) bị đột biến điểm làm tăng thêm $1$ liên kết hydrogen nhưng chiều dài của gene không thay đổi. Dạng đột biến điểm đã xảy ra ở gene này là:',
    hasFormula: true,
    formulaLatex: '\\Delta L = 0,\\; \\Delta H = +1 \\implies \\text{Thay thế 1 cặp } A-T \\text{ bằng 1 cặp } G-C',
    bloomLevel: 'THONG_HIEU',
    learningOutcome: 'Xác định được dạng đột biến điểm dựa vào sự thay đổi chiều dài và số liên kết hydrogen của gene.',
    explanation: 'Chiều dài của gene không đổi chứng tỏ đây là đột biến thay thế cặp nucleotide. Số liên kết hydrogen tăng thêm $1$ chứng tỏ 1 cặp $A-T$ (2 liên kết H) đã bị thay thế bằng 1 cặp $G-C$ (3 liên kết H).',
    options: [
      { id: 'bio12-p1-7-a', originalLabel: 'A', currentLabel: 'A', text: 'Thay thế 1 cặp $A-T$ bằng 1 cặp $G-C$.', isUnderline: true, isRed: true, isCorrect: true },
      { id: 'bio12-p1-7-b', originalLabel: 'B', currentLabel: 'B', text: 'Thay thế 1 cặp $G-C$ bằng 1 cặp $A-T$.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'bio12-p1-7-c', originalLabel: 'C', currentLabel: 'C', text: 'Thêm 1 cặp nucleotide $A-T$.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'bio12-p1-7-d', originalLabel: 'D', currentLabel: 'D', text: 'Mất 1 cặp nucleotide $G-C$.', isUnderline: false, isRed: false, isCorrect: false },
    ],
    computedLayout: '2_ROW_2_COL',
  },
  {
    id: 'bio12-p1-8',
    part: 'PART_1',
    originalIndex: 8,
    displayIndex: 8,
    stemText: 'Trong cấu trúc siêu hiển vi của nhiễm sắc thể ở sinh vật nhân thực, sợi cơ bản (đường kính $10\\text{ nm}$) được cấu tạo từ các đơn vị cơ sở là nucleosome. Mỗi nucleosome bao gồm:',
    hasFormula: true,
    formulaLatex: '8\\text{ phân tử protein histone} + 1\\frac{3}{4}\\text{ vòng DNA } (146\\text{ cặp nucleotide})',
    bloomLevel: 'NHAN_BIET',
    learningOutcome: 'Mô tả được cấu trúc siêu hiển vi của nhiễm sắc thể ở sinh vật nhân thực.',
    explanation: 'Mỗi đơn vị nucleosome gồm một lõi có $8$ phân tử protein histone được quấn quanh bởi $1\\frac{3}{4}$ vòng xoắn DNA (tương ứng khoảng $146$ cặp nucleotide).',
    options: [
      { id: 'bio12-p1-8-a', originalLabel: 'A', currentLabel: 'A', text: 'Lõi $8$ phân tử protein histone được quấn quanh bởi $1\\frac{3}{4}$ vòng DNA ($146$ cặp nucleotide).', isUnderline: true, isRed: true, isCorrect: true },
      { id: 'bio12-p1-8-b', originalLabel: 'B', currentLabel: 'B', text: 'Lõi $6$ phân tử protein histone được quấn quanh bởi $2$ vòng DNA ($200$ cặp nucleotide).', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'bio12-p1-8-c', originalLabel: 'C', currentLabel: 'C', text: 'Một phân tử DNA mạch đơn liên kết với enzyme RNA polymerase.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'bio12-p1-8-d', originalLabel: 'D', currentLabel: 'D', text: 'Lõi $4$ phân tử protein không phải histone quấn quanh bởi sợi nhiễm sắc $30\\text{ nm}$.', isUnderline: false, isRed: false, isCorrect: false },
    ],
    computedLayout: '4_ROW_1_COL',
  },
  {
    id: 'bio12-p1-9',
    part: 'PART_1',
    originalIndex: 9,
    displayIndex: 9,
    stemText: 'Ở người, hội chứng bệnh lý hoặc tật di truyền nào sau đây là hậu quả của đột biến mất một đoạn trên nhiễm sắc thể số 5?',
    hasFormula: false,
    bloomLevel: 'NHAN_BIET',
    learningOutcome: 'Nhận biết được các hội chứng di truyền ở người liên quan đến đột biến cấu trúc và số lượng nhiễm sắc thể.',
    explanation: 'Mất một đoạn ở cánh ngắn nhiễm sắc thể số 5 ở người gây ra hội chứng tiếng mèo kêu (Cri-du-chat). Hội chứng Down là thể ba NST 21, Klinefelter là $XXY$, Turner là $XO$.',
    options: [
      { id: 'bio12-p1-9-a', originalLabel: 'A', currentLabel: 'A', text: 'Hội chứng tiếng mèo kêu (Cri-du-chat).', isUnderline: true, isRed: true, isCorrect: true },
      { id: 'bio12-p1-9-b', originalLabel: 'B', currentLabel: 'B', text: 'Hội chứng Down (3 nhiễm sắc thể số 21).', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'bio12-p1-9-c', originalLabel: 'C', currentLabel: 'C', text: 'Hội chứng Klinefelter ($47, XXY$).', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'bio12-p1-9-d', originalLabel: 'D', currentLabel: 'D', text: 'Hội chứng Turner ($45, XO$).', isUnderline: false, isRed: false, isCorrect: false },
    ],
    computedLayout: '2_ROW_2_COL',
  },
  {
    id: 'bio12-p1-10',
    part: 'PART_1',
    originalIndex: 10,
    displayIndex: 10,
    stemText: 'Ở cây đậu hà lan ($Pisum\\;sativum$), allele $A$ quy định hạt vàng trội hoàn toàn so với allele $a$ quy định hạt xanh; allele $B$ quy định vỏ hạt trơn trội hoàn toàn so với allele $b$ quy định vỏ hạt nhăn. Hai cặp gene này phân li độc lập. Phép lai phân tích $P: AaBb \\times aabb$ cho đời con $F_a$ có tỉ lệ phân li kiểu hình là:',
    hasFormula: true,
    formulaLatex: 'P: AaBb \\times aabb \\implies F_a: (1Aa:1aa)(1Bb:1bb) = 1:1:1:1',
    bloomLevel: 'THONG_HIEU',
    learningOutcome: 'Vận dụng quy luật phân li độc lập của Mendel để xác định tỉ lệ kiểu hình của phép lai phân tích.',
    explanation: 'Xét riêng từng cặp tính trạng: $Aa \\times aa \\to 1\\text{ vàng} : 1\\text{ xanh}$; $Bb \\times bb \\to 1\\text{ trơn} : 1\\text{ nhăn}$. Do hai cặp gene phân li độc lập nên tỉ lệ kiểu hình chung ở $F_a$ là $(1:1)(1:1) = 1 : 1 : 1 : 1$.',
    options: [
      { id: 'bio12-p1-10-a', originalLabel: 'A', currentLabel: 'A', text: '$1 : 1 : 1 : 1$.', isUnderline: true, isRed: true, isCorrect: true },
      { id: 'bio12-p1-10-b', originalLabel: 'B', currentLabel: 'B', text: '$9 : 3 : 3 : 1$.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'bio12-p1-10-c', originalLabel: 'C', currentLabel: 'C', text: '$3 : 3 : 1 : 1$.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'bio12-p1-10-d', originalLabel: 'D', currentLabel: 'D', text: '$3 : 1$.', isUnderline: false, isRed: false, isCorrect: false },
    ],
    computedLayout: '1_ROW_4_COL',
  },
  {
    id: 'bio12-p1-11',
    part: 'PART_1',
    originalIndex: 11,
    displayIndex: 11,
    stemText: 'Ở một loài thực vật, màu sắc hoa do hai cặp gene không allele ($A, a$ và $B, b$) phân li độc lập cùng quy định theo kiểu tương tác bổ sung. Kiểu gene có mặt đồng thời cả hai allele trội $A$ và $B$ ($A\\text{-}B\\text{-}$) quy định hoa đỏ; các kiểu gene còn lại ($A\\text{-}bb, aaB\\text{-}, aabb$) đều quy định hoa trắng. Cho cây dị hợp hai cặp gene ($AaBb$) tự thụ phấn, tỉ lệ kiểu hình ở đời con $F_1$ là:',
    hasFormula: true,
    formulaLatex: 'P: AaBb \\times AaBb \\implies F_1: 9 A\\text{-}B\\text{-}\\;(\\text{đỏ}) : 7\\;(\\text{trắng})',
    bloomLevel: 'THONG_HIEU',
    learningOutcome: 'Xác định được tỉ lệ phân li kiểu hình trong quy luật tương tác bổ sung giữa các gene không allele.',
    explanation: 'Phép lai $AaBb \\times AaBb$ tạo ra $9/16 A\\text{-}B\\text{-}$ (hoa đỏ) và $(3/16 A\\text{-}bb + 3/16 aaB\\text{-} + 1/16 aabb) = 7/16$ (hoa trắng). Tỉ lệ kiểu hình là $9$ cây hoa đỏ : $7$ cây hoa trắng.',
    options: [
      { id: 'bio12-p1-11-a', originalLabel: 'A', currentLabel: 'A', text: '$9$ cây hoa đỏ : $7$ cây hoa trắng.', isUnderline: true, isRed: true, isCorrect: true },
      { id: 'bio12-p1-11-b', originalLabel: 'B', currentLabel: 'B', text: '$9$ cây hoa đỏ : $6$ cây hoa hồng : $1$ cây hoa trắng.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'bio12-p1-11-c', originalLabel: 'C', currentLabel: 'C', text: '$15$ cây hoa đỏ : $1$ cây hoa trắng.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'bio12-p1-11-d', originalLabel: 'D', currentLabel: 'D', text: '$13$ cây hoa trắng : $3$ cây hoa đỏ.', isUnderline: false, isRed: false, isCorrect: false },
    ],
    computedLayout: '2_ROW_2_COL',
  },
  {
    id: 'bio12-p1-12',
    part: 'PART_1',
    originalIndex: 12,
    displayIndex: 12,
    stemText: 'Trong quá trình giảm phân tạo giao tử của một cơ thể có kiểu gene $\\frac{AB}{ab}$, nếu xảy ra hoán vị gene giữa hai allele $B$ và $b$ với tần số $f = 20\\%$ thì tỉ lệ các loại giao tử được tạo ra là:',
    hasFormula: true,
    formulaLatex: '\\underline{AB} = \\underline{ab} = \\frac{1 - f}{2} = 40\\%; \\quad \\underline{Ab} = \\underline{aB} = \\frac{f}{2} = 10\\%',
    bloomLevel: 'THONG_HIEU',
    learningOutcome: 'Tính được tỉ lệ các loại giao tử liên kết và giao tử hoán vị khi biết tần số hoán vị gene.',
    explanation: 'Với tần số hoán vị gene $f = 20\\%$, giao tử hoán vị chiếm $\\underline{Ab} = \\underline{aB} = \\frac{f}{2} = 10\\%$, còn giao tử liên kết chiếm $\\underline{AB} = \\underline{ab} = 50\\% - 10\\% = 40\\%$.',
    options: [
      { id: 'bio12-p1-12-a', originalLabel: 'A', currentLabel: 'A', text: '$\\underline{AB} = \\underline{ab} = 40\\%;\\; \\underline{Ab} = \\underline{aB} = 10\\%$.', isUnderline: true, isRed: true, isCorrect: true },
      { id: 'bio12-p1-12-b', originalLabel: 'B', currentLabel: 'B', text: '$\\underline{AB} = \\underline{ab} = 30\\%;\\; \\underline{Ab} = \\underline{aB} = 20\\%$.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'bio12-p1-12-c', originalLabel: 'C', currentLabel: 'C', text: '$\\underline{AB} = \\underline{ab} = 10\\%;\\; \\underline{Ab} = \\underline{aB} = 40\\%$.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'bio12-p1-12-d', originalLabel: 'D', currentLabel: 'D', text: '$\\underline{AB} = \\underline{ab} = \\underline{Ab} = \\underline{aB} = 25\\%$.', isUnderline: false, isRed: false, isCorrect: false },
    ],
    computedLayout: '2_ROW_2_COL',
  },
  {
    id: 'bio12-p1-13',
    part: 'PART_1',
    originalIndex: 13,
    displayIndex: 13,
    stemText: 'Ở ruồi giấm ($Drosophila\\;melanogaster$), allele $W$ quy định mắt đỏ là trội hoàn toàn so với allele $w$ quy định mắt trắng; gene nằm trên vùng không tương đồng của nhiễm sắc thể giới tính $X$. Phép lai $P: ♀ X^W X^w \\times ♂ X^W Y$ cho đời con $F_1$ có tỉ lệ kiểu hình là:',
    hasFormula: true,
    formulaLatex: 'P: ♀ X^W X^w \\times ♂ X^W Y \\implies F_1: 1 X^W X^W : 1 X^W X^w : 1 X^W Y : 1 X^w Y',
    bloomLevel: 'THONG_HIEU',
    learningOutcome: 'Vận dụng quy luật di truyền liên kết giới tính của Morgan để xác định tỉ lệ kiểu hình ở đời con.',
    explanation: 'Đời con $F_1$ có $100\\%$ ruồi cái mắt đỏ ($X^W X^W, X^W X^w$), $50\\%$ ruồi đực mắt đỏ ($X^W Y$) và $50\\%$ ruồi đực mắt trắng ($X^w Y$), tức là $3$ mắt đỏ : $1$ mắt trắng (ruồi mắt trắng toàn là con đực).',
    options: [
      { id: 'bio12-p1-13-a', originalLabel: 'A', currentLabel: 'A', text: '$3$ mắt đỏ : $1$ mắt trắng (ruồi mắt trắng đều là ruồi đực).', isUnderline: true, isRed: true, isCorrect: true },
      { id: 'bio12-p1-13-b', originalLabel: 'B', currentLabel: 'B', text: '$3$ mắt đỏ : $1$ mắt trắng (ruồi mắt trắng đều là ruồi cái).', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'bio12-p1-13-c', originalLabel: 'C', currentLabel: 'C', text: '$1$ ruồi cái mắt đỏ : $1$ ruồi đực mắt trắng.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'bio12-p1-13-d', originalLabel: 'D', currentLabel: 'D', text: '$100\\%$ ruồi mắt đỏ ở cả hai giới.', isUnderline: false, isRed: false, isCorrect: false },
    ],
    computedLayout: '2_ROW_2_COL',
  },
  {
    id: 'bio12-p1-14',
    part: 'PART_1',
    originalIndex: 14,
    displayIndex: 14,
    stemText: 'Ở người, bệnh máu khó đông (Hemophilia) do một allele lặn $h$ nằm trên vùng không tương đồng của nhiễm sắc thể giới tính $X$ quy định, allele trội $H$ quy định máu đông bình thường. Một cặp vợ chồng có kiểu hình máu đông bình thường nhưng người vợ mang allele gây bệnh ($X^H X^h$), người chồng bình thường ($X^H Y$). Xác suất cặp vợ chồng này sinh ra một người con bị bệnh máu khó đông là:',
    hasFormula: true,
    formulaLatex: 'P: ♀ X^H X^h \\times ♂ X^H Y \\implies P(X^h Y) = \\frac{1}{2} X^h \\times \\frac{1}{2} Y = \\frac{1}{4} = 25\\%',
    bloomLevel: 'VAN_DUNG',
    learningOutcome: 'Tính được xác suất sinh con mắc bệnh di truyền liên kết với nhiễm sắc thể giới tính X ở người.',
    explanation: 'Người vợ $X^H X^h$ cho giao tử $0,5 X^H : 0,5 X^h$; người chồng $X^H Y$ cho giao tử $0,5 X^H : 0,5 Y$. Chỉ có tổ hợp $X^h Y$ (con trai) mới biểu hiện bệnh, chiếm tỉ lệ $0,5 \\times 0,5 = 0,25 = 25\\%$.',
    options: [
      { id: 'bio12-p1-14-a', originalLabel: 'A', currentLabel: 'A', text: '$25\\%$.', isUnderline: true, isRed: true, isCorrect: true },
      { id: 'bio12-p1-14-b', originalLabel: 'B', currentLabel: 'B', text: '$50\\%$.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'bio12-p1-14-c', originalLabel: 'C', currentLabel: 'C', text: '$12,5\\%$.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'bio12-p1-14-d', originalLabel: 'D', currentLabel: 'D', text: '$75\\%$.', isUnderline: false, isRed: false, isCorrect: false },
    ],
    computedLayout: '1_ROW_4_COL',
  },
  {
    id: 'bio12-p1-15',
    part: 'PART_1',
    originalIndex: 15,
    displayIndex: 15,
    stemText: 'Theo quy luật di truyền ngoài nhân (di truyền qua tế bào chất của Correns) ở cây hoa phấn ($Mirabilis\\;jalapa$), khi lấy hạt phấn của cây lá đốm thụ phấn cho hoa của cây lá xanh (P: ♀ Cây lá xanh $\\times$ ♂ Cây lá đốm) thì toàn bộ đời con $F_1$ sẽ có kiểu hình là:',
    hasFormula: true,
    formulaLatex: 'P: ♀\\;\\text{Lá xanh} \\times ♂\\;\\text{Lá đốm} \\implies F_1: 100\\%\\;\\text{Cây lá xanh}',
    bloomLevel: 'NHAN_BIET',
    learningOutcome: 'Nhận biết đặc điểm di truyền theo dòng mẹ của các gene nằm trong bào quan lục lạp và ti thể.',
    explanation: 'Trong di truyền ngoài nhân (gene trong lục lạp), hợp tử nhận hầu hết tế bào chất từ giao tử cái (noãn), nên kiểu hình của đời con $F_1$ luôn giống 100% kiểu hình của cây mẹ (100% cây lá xanh).',
    options: [
      { id: 'bio12-p1-15-a', originalLabel: 'A', currentLabel: 'A', text: '$100\\%$ cây lá xanh.', isUnderline: true, isRed: true, isCorrect: true },
      { id: 'bio12-p1-15-b', originalLabel: 'B', currentLabel: 'B', text: '$100\\%$ cây lá đốm.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'bio12-p1-15-c', originalLabel: 'C', currentLabel: 'C', text: '$3$ cây lá xanh : $1$ cây lá trắng.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'bio12-p1-15-d', originalLabel: 'D', currentLabel: 'D', text: 'Gồm cả 3 loại cây: lá xanh, lá trắng và lá đốm.', isUnderline: false, isRed: false, isCorrect: false },
    ],
    computedLayout: '2_ROW_2_COL',
  },
  {
    id: 'bio12-p1-16',
    part: 'PART_1',
    originalIndex: 16,
    displayIndex: 16,
    stemText: 'Sơ đồ phả hệ ở hình bên mô tả sự di truyền của một bệnh hiếm gặp ở người qua 3 thế hệ. Biết rằng bệnh do một trong hai allele của một gene quy định và không phát sinh đột biến mới. Quy luật di truyền chi phối tính trạng bệnh này là:',
    hasFormula: false,
    bloomLevel: 'VAN_DUNG',
    learningOutcome: 'Phân tích sơ đồ phả hệ để xác định tính trạng trội/lặn và vị trí của gene quy định bệnh ở người.',
    explanation: 'Cặp bố mẹ bình thường ở thế hệ I (I-1 và I-2) sinh ra con gái II-1 bị bệnh $\\implies$ Bệnh do allele lặn quy định và gene không thể nằm trên NST giới tính $X$ (vì nếu nằm trên $X$ thì bố I-1 bình thường $X^A Y$ không thể sinh con gái $X^a X^a$ bị bệnh). Do đó gene lặn nằm trên nhiễm sắc thể thường.',
    images: [
      {
        id: 'img-bio12-pedigree-1',
        dataUrl: toSvgDataUrl(SVG_PEDIGREE_CHART_1),
        fileName: 'so_do_pha_he_cau_16.svg',
        tagId: '[HINH_ANH_CAU_16]',
        caption: 'Sơ đồ phả hệ di truyền bệnh qua 3 thế hệ ở người',
        dpi: 300,
        aspectRatio: 480 / 280,
        widthTwips: 4400,
        heightTwips: 2600,
      },
    ],
    options: [
      { id: 'bio12-p1-16-a', originalLabel: 'A', currentLabel: 'A', text: 'Do allele lặn nằm trên nhiễm sắc thể thường quy định.', isUnderline: true, isRed: true, isCorrect: true },
      { id: 'bio12-p1-16-b', originalLabel: 'B', currentLabel: 'B', text: 'Do allele trội nằm trên nhiễm sắc thể thường quy định.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'bio12-p1-16-c', originalLabel: 'C', currentLabel: 'C', text: 'Do allele lặn nằm trên vùng không tương đồng của NST giới tính $X$.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'bio12-p1-16-d', originalLabel: 'D', currentLabel: 'D', text: 'Do gene nằm trên vùng không tương đồng của NST giới tính $Y$.', isUnderline: false, isRed: false, isCorrect: false },
    ],
    computedLayout: '4_ROW_1_COL',
  },
  {
    id: 'bio12-p1-17',
    part: 'PART_1',
    originalIndex: 17,
    displayIndex: 17,
    stemText: 'Một quần thể thực vật ngẫu phối đang ở trạng thái cân bằng di truyền Hardy - Weinberg có cấu trúc di truyền là $0,36AA : 0,48Aa : 0,16aa$. Tần số tương đối của allele trội $A$ ($p_A$) và allele lặn $a$ ($q_a$) trong quần thể này lần lượt là:',
    hasFormula: true,
    formulaLatex: 'p^2(AA) + 2pq(Aa) + q^2(aa) = 1 \\implies p_A = \\sqrt{0,36} = 0,60;\\; q_a = \\sqrt{0,16} = 0,40',
    bloomLevel: 'THONG_HIEU',
    learningOutcome: 'Tính được tần số tương đối của các allele trong quần thể cân bằng di truyền Hardy - Weinberg.',
    explanation: 'Tần số allele $A$ là $p_A = 0,36 + \\frac{0,48}{2} = 0,60$; tần số allele $a$ là $q_a = 1 - 0,60 = 0,40$.',
    options: [
      { id: 'bio12-p1-17-a', originalLabel: 'A', currentLabel: 'A', text: '$p_A = 0,60;\\; q_a = 0,40$.', isUnderline: true, isRed: true, isCorrect: true },
      { id: 'bio12-p1-17-b', originalLabel: 'B', currentLabel: 'B', text: '$p_A = 0,36;\\; q_a = 0,64$.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'bio12-p1-17-c', originalLabel: 'C', currentLabel: 'C', text: '$p_A = 0,40;\\; q_a = 0,60$.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'bio12-p1-17-d', originalLabel: 'D', currentLabel: 'D', text: '$p_A = 0,70;\\; q_a = 0,30$.', isUnderline: false, isRed: false, isCorrect: false },
    ],
    computedLayout: '2_ROW_2_COL',
  },
  {
    id: 'bio12-p1-18',
    part: 'PART_1',
    originalIndex: 18,
    displayIndex: 18,
    stemText: 'Trong công tác chọn và tạo giống cây trồng, vật nuôi bằng phương pháp lai giống, phép lai giữa hai dòng thuần chủng khác nhau ($P: AAbbDD \\times aaBBdd$) để tạo ra con lai $F_1$ đồng loạt dị hợp tử ($AaBbDd$) có sức sống, năng suất cao vượt trội so với bố mẹ nhưng không dùng $F_1$ để nhân giống cho đời sau được gọi là:',
    hasFormula: true,
    formulaLatex: 'P: AAbbDD \\times aaBBdd \\implies F_1: AaBbDd \\;(\\text{Ưu thế lai cao nhất ở } F_1)',
    bloomLevel: 'NHAN_BIET',
    learningOutcome: 'Trình bày được khái niệm và cơ sở di truyền của hiện tượng ưu thế lai trong chọn giống.',
    explanation: 'Phép lai khác dòng tạo ưu thế lai cao nhất ở thế hệ $F_1$ (mục đích thương phẩm), nếu lấy $F_1$ làm giống thì sang $F_2$ tỉ lệ dị hợp giảm, xuất hiện các kiểu gene đồng hợp lặn gây thoái hóa.',
    options: [
      { id: 'bio12-p1-18-a', originalLabel: 'A', currentLabel: 'A', text: 'Lai khác dòng tạo ưu thế lai thương phẩm ở thế hệ $F_1$.', isUnderline: true, isRed: true, isCorrect: true },
      { id: 'bio12-p1-18-b', originalLabel: 'B', currentLabel: 'B', text: 'Tự thụ phấn bắt buộc qua nhiều thế hệ liên tiếp.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'bio12-p1-18-c', originalLabel: 'C', currentLabel: 'C', text: 'Giao phối cận huyết nhằm củng cố tính trạng mong muốn.', isUnderline: false, isRed: false, isCorrect: false },
      { id: 'bio12-p1-18-d', originalLabel: 'D', currentLabel: 'D', text: 'Nuôi cấy hạt phấn đơn bội kết hợp lưỡng bội hóa.', isUnderline: false, isRed: false, isCorrect: false },
    ],
    computedLayout: '2_ROW_2_COL',
  },

  // =========================================================================
  // PHẦN II: TRẮC NGHIỆM ĐÚNG / SAI (4 CÂU — TỪ CÂU 1 ĐẾN CÂU 4, MỖI CÂU 4 Ý a, b, c, d)
  // =========================================================================

  // --- CÂU 1 (PHẦN II): CẤU TRÚC DNA, PHIÊN MÃ RNA & DỊCH MÃ PROTEIN ---
  {
    id: 'bio12-p2-1',
    part: 'PART_2',
    originalIndex: 19,
    displayIndex: 1,
    stemText: 'Một gene cấu trúc $B$ ở sinh vật nhân sơ có chiều dài $L = 4080\\;\\text{\\AA}$ và có số nucleotide loại Adenine chiếm $20\\%$ tổng số nucleotide của gene. Gene $B$ thực hiện phiên mã tạo phân tử mRNA và dịch mã tổng hợp chuỗi polypeptide. Xét tính đúng hoặc sai của các nhận định sau đây:',
    hasFormula: true,
    formulaLatex: 'N = \\frac{2L}{3,4} = 2400; \\quad A = T = 480,\\; G = C = 720; \\quad H = 2A + 3G = 3120',
    bloomLevel: 'VAN_DUNG',
    learningOutcome: 'Vận dụng công thức cấu trúc DNA, phiên mã và dịch mã để phân tích thông số của gene.',
    explanation: 'a) Đúng vì $N = \\frac{2 \\times 4080}{3,4} = 2400$ nucleotide. b) Đúng vì $A = T = 20\\% \\times 2400 = 480$, $G = C = 30\\% \\times 2400 = 720 \\implies H = 2A + 3G = 2(480) + 3(720) = 3120$. c) Đúng vì phân tử mRNA có chiều dài bằng chiều dài gene có $\\frac{2400}{2 \\times 3} = 400$ bộ ba (codon). d) Sai vì nếu gene $B$ nhân đôi liên tiếp 3 lần thì số nucleotide loại $A$ môi trường cung cấp là $A_{\\text{mt}} = A \\times (2^3 - 1) = 480 \\times 7 = 3360$ (không phải $3840$).',
    subItems: [
      { id: 'bio12-p2-1-a', originalLabel: 'a', currentLabel: 'a', text: 'Tổng số nucleotide trên cả hai mạch đơn của gene $B$ là $N = 2400$ nucleotide.', isUnderline: true, isRed: true, isTrue: true },
      { id: 'bio12-p2-1-b', originalLabel: 'b', currentLabel: 'b', text: 'Gene $B$ có $A = T = 480$ nucleotide, $G = C = 720$ nucleotide và tổng số liên kết hydrogen là $H = 3120$.', isUnderline: true, isRed: true, isTrue: true },
      { id: 'bio12-p2-1-c', originalLabel: 'c', currentLabel: 'c', text: 'Phân tử mRNA được phiên mã từ gene $B$ có tổng cộng $400$ bộ ba mã sao (codon).', isUnderline: true, isRed: true, isTrue: true },
      { id: 'bio12-p2-1-d', originalLabel: 'd', currentLabel: 'd', text: 'Khi gene $B$ nhân đôi liên tiếp $3$ lần thì số nucleotide tự do loại Adenine ($A$) môi trường nội bào cần cung cấp là $3840$.', isUnderline: false, isRed: false, isTrue: false },
    ],
  },

  // --- CÂU 2 (PHẦN II): QUY LUẬT DI TRUYỀN MENDEL & TƯƠNG TÁC PHÂN LI ĐỘC LẬP ---
  {
    id: 'bio12-p2-2',
    part: 'PART_2',
    originalIndex: 20,
    displayIndex: 2,
    stemText: 'Ở một loài thực vật lưỡng bội, allele $A$ quy định thân cao trội hoàn toàn so với allele $a$ quy định thân thấp; allele $B$ quy định hoa đỏ trội hoàn toàn so với allele $b$ quy định hoa trắng; hai cặp gene nằm trên hai cặp nhiễm sắc thể thường khác nhau. Cho phép lai $P: AaBb \\times Aabb$ thu được đời con $F_1$. Xét tính đúng hoặc sai của các nhận định sau:',
    hasFormula: true,
    formulaLatex: 'P: AaBb \\times Aabb \\implies F_1: (3 A\\text{-} : 1 aa)(1 Bb : 1 bb)',
    bloomLevel: 'THONG_HIEU',
    learningOutcome: 'Phân tích số loại kiểu gene, số loại kiểu hình và tỉ lệ phân li trong phép lai hai cặp tính trạng Mendel.',
    explanation: 'a) Đúng vì $(Aa \\times Aa)$ cho 3 kiểu gene, $(Bb \\times bb)$ cho 2 kiểu gene $\\implies$ Tổng số kiểu gene là $3 \\times 2 = 6$, tổng số kiểu hình là $2 \\times 2 = 4$. b) Đúng vì tỉ lệ thân cao, hoa đỏ ($A\\text{-}Bb$) là $\\frac{3}{4} \\times \\frac{1}{2} = \\frac{3}{8} = 37,5\\%$. c) Đúng vì tỉ lệ cá thể thuần chủng ($AAbb + aabb$) là $\\frac{1}{4} \\times \\frac{1}{2} + \\frac{1}{4} \\times \\frac{1}{2} = \\frac{2}{8} = 25\\%$. d) Sai vì trong số các cây thân cao, hoa đỏ ($A\\text{-}Bb$) ở $F_1$, tất cả đều dị hợp về cặp $Bb$ nên tỉ lệ cây thuần chủng bằng $0\\%$.',
    subItems: [
      { id: 'bio12-p2-2-a', originalLabel: 'a', currentLabel: 'a', text: 'Ở đời con $F_1$, có tối đa $6$ loại kiểu gene và $4$ loại kiểu hình khác nhau.', isUnderline: true, isRed: true, isTrue: true },
      { id: 'bio12-p2-2-b', originalLabel: 'b', currentLabel: 'b', text: 'Tỉ lệ cây có kiểu hình thân cao, hoa đỏ ($A\\text{-}B\\text{-}$) ở đời con $F_1$ chiếm $37,5\\%$ ($3/8$).', isUnderline: true, isRed: true, isTrue: true },
      { id: 'bio12-p2-2-c', originalLabel: 'c', currentLabel: 'c', text: 'Tỉ lệ cây có kiểu gene đồng hợp (thuần chủng về cả hai cặp gene) ở $F_1$ chiếm $25\\%$.', isUnderline: true, isRed: true, isTrue: true },
      { id: 'bio12-p2-2-d', originalLabel: 'd', currentLabel: 'd', text: 'Lấy ngẫu nhiên 1 cây thân cao, hoa đỏ ở $F_1$, xác suất thu được cây thuần chủng là $1/3$.', isUnderline: false, isRed: false, isTrue: false },
    ],
  },

  // --- CÂU 3 (PHẦN II): HOÁN VỊ GENE & DI TRUYỀN LIÊN KẾT GIỚI TÍNH ---
  {
    id: 'bio12-p2-3',
    part: 'PART_2',
    originalIndex: 21,
    displayIndex: 3,
    stemText: 'Ở ruồi giấm ($2n = 8$), xét hai cặp gene quy định kích thước thân ($A$: thân xám, $a$: thân đen) và chiều dài cánh ($B$: cánh dài, $b$: cánh cụt) cùng nằm trên một cặp nhiễm sắc thể thường; cặp gene quy định màu mắt ($D$: mắt đỏ, $d$: mắt trắng) nằm trên vùng không tương đồng của nhiễm sắc thể giới tính $X$. Thực hiện phép lai $P: ♀ \\frac{AB}{ab} X^D X^d \\times ♂ \\frac{AB}{ab} X^D Y$, biết tần số hoán vị gene ở ruồi cái là $f = 20\\%$ (ruồi đực không xảy ra hoán vị gene). Xét tính đúng hoặc sai của các nhận định sau:',
    hasFormula: true,
    formulaLatex: 'P(aabb) = 0,4\\underline{ab}\\;(♀) \\times 0,5\\underline{ab}\\;(♂) = 0,20 \\implies P(A\\text{-}B\\text{-}) = 0,5 + 0,20 = 0,70',
    bloomLevel: 'VAN_DUNG',
    learningOutcome: 'Giải bài toán tích hợp quy luật hoán vị gene trên NST thường và di truyền liên kết giới tính ở ruồi giấm.',
    explanation: 'a) Đúng vì phép lai $\\frac{AB}{ab} \\;(f=20\\%) \\times \\frac{AB}{ab}\\;(f=0)$ tạo ra 7 kiểu gene, còn $X^D X^d \\times X^D Y$ tạo ra 4 kiểu gene $\\implies$ Tổng số kiểu gene ở $F_1$ là $7 \\times 4 = 28$ kiểu gene. b) Đúng vì tỉ lệ kiểu gene đồng hợp lặn $\\frac{ab}{ab}$ là $0,4 \\times 0,5 = 0,20 = 20\\%$, suy ra tỉ lệ thân xám, cánh dài ($A\\text{-}B\\text{-}$) là $50\\% + 20\\% = 70\\%$. c) Đúng vì tỉ lệ mắt đỏ ($X^D\\text{-}$) là $3/4 = 0,75$, nên tỉ lệ ruồi thân xám, cánh dài, mắt đỏ ở $F_1$ là $0,70 \\times 0,75 = 0,525 = 52,5\\%$. d) Sai vì ở $F_1$, ruồi mắt trắng ($X^d Y$) chỉ xuất hiện ở giới đực, hoàn toàn không có ruồi cái mắt trắng.',
    subItems: [
      { id: 'bio12-p2-3-a', originalLabel: 'a', currentLabel: 'a', text: 'Số loại kiểu gene tối đa được tạo ra ở đời con $F_1$ là $28$ loại kiểu gene.', isUnderline: true, isRed: true, isTrue: true },
      { id: 'bio12-p2-3-b', originalLabel: 'b', currentLabel: 'b', text: 'Ở đời con $F_1$, tỉ lệ ruồi có kiểu hình thân đen, cánh cụt ($\\frac{ab}{ab}$) chiếm $20\\%$.', isUnderline: true, isRed: true, isTrue: true },
      { id: 'bio12-p2-3-c', originalLabel: 'c', currentLabel: 'c', text: 'Tỉ lệ ruồi có kiểu hình trội về cả 3 tính trạng (thân xám, cánh dài, mắt đỏ) ở $F_1$ chiếm $52,5\\%$.', isUnderline: true, isRed: true, isTrue: true },
      { id: 'bio12-p2-3-d', originalLabel: 'd', currentLabel: 'd', text: 'Ở đời con $F_1$, tỉ lệ ruồi cái có kiểu hình thân đen, cánh cụt, mắt trắng chiếm $5\\%$.', isUnderline: false, isRed: false, isTrue: false },
    ],
  },

  // --- CÂU 4 (PHẦN II): DI TRUYỀN HỌC NGƯỜI & TƯ VẤN SƠ ĐỒ PHẢ HỆ (CÓ HÌNH PHẢ HỆ 2) ---
  {
    id: 'bio12-p2-4',
    part: 'PART_2',
    originalIndex: 22,
    displayIndex: 4,
    stemText: 'Sơ đồ phả hệ ở hình bên mô tả sự di truyền bệnh bạch tạng ở một gia đình qua 3 thế hệ. Biết rằng bệnh bạch tạng do một gene có hai allele ($A$ và $a$) nằm trên nhiễm sắc thể thường quy định và không xảy ra đột biến mới ở tất cả các cá thể trong phả hệ. Xét tính đúng hoặc sai của các nhận định sau:',
    hasFormula: true,
    formulaLatex: '\\text{II-2 } (\\frac{1}{3}AA : \\frac{2}{3}Aa) \\times \\text{II-3 } (\\frac{1}{3}AA : \\frac{2}{3}Aa) \\implies P(aa) = \\frac{2}{3} \\times \\frac{2}{3} \\times \\frac{1}{4} = \\frac{1}{9}',
    bloomLevel: 'VAN_DUNG_CAO',
    learningOutcome: 'Vận dụng sơ đồ phả hệ để xác định kiểu gene các cá thể và tính xác suất sinh con trong tư vấn di truyền.',
    explanation: 'a) Đúng vì bố mẹ I-1 $\\times$ I-2 bình thường sinh con gái II-1 bị bệnh ($aa$) $\\implies$ Bệnh do allele lặn $a$ trên NST thường quy định. b) Đúng vì bố mẹ I-1, I-2, I-3, I-4 đều bình thường nhưng sinh con bị bệnh ($aa$) nên cả 4 người ở thế hệ I đều có kiểu gene dị hợp $Aa$. c) Đúng vì người II-2 và II-3 có kiểu hình bình thường nên đều có xác suất kiểu gene là $\\frac{1}{3}AA : \\frac{2}{3}Aa$; xác suất họ sinh con đầu lòng III-1 bị bệnh ($aa$) là $\\frac{2}{3} \\times \\frac{2}{3} \\times \\frac{1}{4} = \\frac{1}{9}$. d) Sai vì xác suất sinh con đầu lòng III-1 là con gái và không bị bệnh là $\\frac{1}{2} \\times (1 - \\frac{1}{9}) = \\frac{4}{9}$ (không phải $\\frac{8}{9}$).',
    images: [
      {
        id: 'img-bio12-pedigree-2',
        dataUrl: toSvgDataUrl(SVG_PEDIGREE_CHART_2),
        fileName: 'so_do_pha_he_bach_tang_phan_2.svg',
        tagId: '[HINH_ANH_CAU_22]',
        caption: 'Sơ đồ phả hệ di truyền bệnh bạch tạng qua 3 thế hệ phục vụ tư vấn di truyền',
        dpi: 300,
        aspectRatio: 500 / 290,
        widthTwips: 4500,
        heightTwips: 2600,
      },
    ],
    subItems: [
      { id: 'bio12-p2-4-a', originalLabel: 'a', currentLabel: 'a', text: 'Bệnh bạch tạng trong phả hệ trên do allele lặn $a$ nằm trên nhiễm sắc thể thường quy định.', isUnderline: true, isRed: true, isTrue: true },
      { id: 'bio12-p2-4-b', originalLabel: 'b', currentLabel: 'b', text: 'Cả 4 cá thể ở thế hệ thứ nhất (I-1, I-2, I-3 và I-4) đều chắc chắn có kiểu gene dị hợp tử $Aa$.', isUnderline: true, isRed: true, isTrue: true },
      { id: 'bio12-p2-4-c', originalLabel: 'c', currentLabel: 'c', text: 'Xác suất để cặp vợ chồng II-2 và II-3 sinh người con đầu lòng (III-1) bị mắc bệnh bạch tạng ($aa$) là $1/9$.', isUnderline: true, isRed: true, isTrue: true },
      { id: 'bio12-p2-4-d', originalLabel: 'd', currentLabel: 'd', text: 'Xác suất để cặp vợ chồng II-2 và II-3 sinh con đầu lòng (III-1) là con gái không bị bệnh bằng $8/9$.', isUnderline: false, isRed: false, isTrue: false },
    ],
  },

  // =========================================================================
  // PHẦN III: TRẮC NGHIỆM TRẢ LỜI NGẮN (6 CÂU — TỪ CÂU 1 ĐẾN CÂU 6)
  // =========================================================================

  // --- CÂU 1 (PHẦN III): BÀI TẬP TÁI BẢN DNA ---
  {
    id: 'bio12-p3-1',
    part: 'PART_3',
    originalIndex: 23,
    displayIndex: 1,
    stemText: 'Một phân tử DNA có tổng số $N = 3000$ nucleotide, trong đó số nucleotide loại Adenine ($A$) chiếm $20\\%$ tổng số nucleotide. Khi phân tử DNA này thực hiện tái bản (nhân đôi) liên tiếp $2$ lần trong môi trường nội bào thì tổng số nucleotide tự do loại Guanine ($G$) mà môi trường cần cung cấp là bao nhiêu?',
    hasFormula: true,
    formulaLatex: 'G = 30\\% \\times 3000 = 900 \\implies G_{\\text{mt}} = G \\times (2^2 - 1) = 900 \\times 3 = 2700',
    bloomLevel: 'VAN_DUNG',
    learningOutcome: 'Tính được số lượng từng loại nucleotide môi trường cung cấp cho quá trình tái bản DNA.',
    explanation: 'Trong phân tử DNA, ta có $\%G = 50\\% - \%A = 50\\% - 20\\% = 30\\% \\implies G = 0,3 \\times 3000 = 900$ nucleotide. Khi DNA tái bản 2 lần, số nucleotide loại $G$ môi trường cung cấp là $G_{\\text{mt}} = 900 \\times (2^2 - 1) = 2700$.',
    shortAnswer: '2700',
    shortAnswerDetectedBy: 'UNDERLINE_RED',
  },

  // --- CÂU 2 (PHẦN III): BÀI TẬP PHIÊN MÃ RNA & DỊCH MÃ PROTEIN ---
  {
    id: 'bio12-p3-2',
    part: 'PART_3',
    originalIndex: 24,
    displayIndex: 2,
    stemText: 'Một phân tử mRNA trưởng thành ở sinh vật nhân sơ có chiều dài vùng mã hóa là $L = 3060\\;\\text{\\AA}$ (tính từ bộ ba mở đầu đến hết bộ ba kết thúc). Khi $1$ ribosome trượt qua phân tử mRNA này một lần để tổng hợp một chuỗi polypeptide thì tổng số phân tử tRNA mang amino acid đến ribosome tham gia dịch mã là bao nhiêu?',
    hasFormula: true,
    formulaLatex: 'rN = \\frac{3060}{3,4} = 900 \\implies N_{\\text{codon}} = \\frac{900}{3} = 300 \\implies N_{\\text{tRNA}} = 300 - 1 = 299',
    bloomLevel: 'VAN_DUNG',
    learningOutcome: 'Tính được số phân tử tRNA tham gia dịch mã tổng hợp chuỗi polypeptide từ phân tử mRNA.',
    explanation: 'Số ribonucleotide của vùng mã hóa trên mRNA là $rN = 3060 : 3,4 = 900$. Số bộ ba trên vùng mã hóa là $900 : 3 = 300$ codon. Vì bộ ba kết thúc không có tRNA tương ứng nên tổng số lượt tRNA tham gia dịch mã là $300 - 1 = 299$.',
    shortAnswer: '299',
    shortAnswerDetectedBy: 'UNDERLINE_RED',
  },

  // --- CÂU 3 (PHẦN III): BÀI TẬP LAI MENDEL ĐA TÍNH TRẠNG ---
  {
    id: 'bio12-p3-3',
    part: 'PART_3',
    originalIndex: 25,
    displayIndex: 3,
    stemText: 'Trong phép lai $3$ cặp tính trạng phân li độc lập theo quy luật Mendel: $P: AaBbDd \\times AaBbdd$ (biết các allele trội $A, B, D$ là trội hoàn toàn so với các allele lặn $a, b, d$). Ở đời con $F_1$, kiểu hình mang cả 3 tính trạng trội ($A\\text{-}B\\text{-}D\\text{-}$) chiếm tỉ lệ bao nhiêu phần trăm? (Làm tròn hoặc ghi số thập phân chuẩn xác).',
    hasFormula: true,
    formulaLatex: 'P(A\\text{-}B\\text{-}D\\text{-}) = \\frac{3}{4} \\times \\frac{3}{4} \\times \\frac{1}{2} = \\frac{9}{32} = 28,125\\%',
    bloomLevel: 'VAN_DUNG',
    learningOutcome: 'Vận dụng quy tắc nhân xác suất để tính tỉ lệ kiểu hình trong phép lai nhiều cặp tính trạng phân li độc lập.',
    explanation: 'Xét riêng từng cặp gene: $Aa \\times Aa \\to 3/4 A\\text{-}$; $Bb \\times Bb \\to 3/4 B\\text{-}$; $Dd \\times dd \\to 1/2 D\\text{-}$. Tỉ lệ kiểu hình trội cả 3 tính trạng ($A\\text{-}B\\text{-}D\\text{-}$) là $\\frac{3}{4} \\times \\frac{3}{4} \\times \\frac{1}{2} = \\frac{9}{32} = 28,125\\%$.',
    shortAnswer: '28,125',
    shortAnswerDetectedBy: 'UNDERLINE_RED',
  },

  // --- CÂU 4 (PHẦN III): BÀI TẬP LIÊN KẾT & HOÁN VỊ GENE ---
  {
    id: 'bio12-p3-4',
    part: 'PART_3',
    originalIndex: 26,
    displayIndex: 4,
    stemText: 'Ở một loài thực vật, cho cây dị hợp tử hai cặp gene $\\frac{AB}{ab}$ tự thụ phấn ($P: \\frac{AB}{ab} \\times \\frac{AB}{ab}$). Biết hoán vị gene xảy ra ở cả quá trình phát sinh giao tử đực và giao tử cái với tần số như nhau là $f = 20\\%$. Ở đời con $F_1$, kiểu gene đồng hợp lặn $\\frac{ab}{ab}$ chiếm tỉ lệ bao nhiêu phần trăm?',
    hasFormula: true,
    formulaLatex: '\\underline{ab} = \\frac{1 - 0,2}{2} = 0,40 \\implies P\\left(\\frac{ab}{ab}\\right) = 0,40 \\times 0,40 = 0,16 = 16\\%',
    bloomLevel: 'VAN_DUNG',
    learningOutcome: 'Tính được tỉ lệ kiểu hình đồng hợp lặn ở đời con khi biết tần số hoán vị gene ở hai giới.',
    explanation: 'Với tần số hoán vị $f = 20\\%$, giao tử liên kết $\\underline{ab}$ ở cả bố và mẹ đều bằng $50\\% - 10\\% = 40\\% = 0,4$. Tỉ lệ kiểu gene đồng hợp lặn $\\frac{ab}{ab}$ ở $F_1$ là $0,4 \\times 0,4 = 0,16 = 16\\%$.',
    shortAnswer: '16',
    shortAnswerDetectedBy: 'UNDERLINE_RED',
  },

  // --- CÂU 5 (PHẦN III): BÀI TẬP DI TRUYỀN QUẦN THỂ & LAI GIỐNG TỰ THỤ ---
  {
    id: 'bio12-p3-5',
    part: 'PART_3',
    originalIndex: 27,
    displayIndex: 5,
    stemText: 'Trong kỹ thuật tạo dòng thuần ở cây trồng tự thụ phấn, xuất phát từ một quần thể giống ban đầu ($P$) có cấu trúc di truyền là $0,2AA : 0,8Aa$. Sau $2$ thế hệ tự thụ phấn liên tiếp, tỉ lệ cá thể có kiểu gene dị hợp tử ($Aa$) ở thế hệ $F_2$ là bao nhiêu phần trăm?',
    hasFormula: true,
    formulaLatex: 'H_2 = H_0 \\times \\left(\\frac{1}{2}\\right)^2 = 0,8 \\times \\frac{1}{4} = 0,20 = 20\\%',
    bloomLevel: 'VAN_DUNG',
    learningOutcome: 'Vận dụng công thức di truyền quần thể tự thụ phấn trong chọn giống cây trồng.',
    explanation: 'Sau $n = 2$ thế hệ tự thụ phấn, tỉ lệ thể dị hợp $Aa$ ở $F_2$ giảm đi theo công thức $0,8 \\times (1/2)^2 = 0,8 \\times 0,25 = 0,20 = 20\\%$.',
    shortAnswer: '20',
    shortAnswerDetectedBy: 'UNDERLINE_RED',
  },

  // --- CÂU 6 (PHẦN III): BÀI TẬP DI TRUYỀN HỌC NGƯỜI ---
  {
    id: 'bio12-p3-6',
    part: 'PART_3',
    originalIndex: 28,
    displayIndex: 6,
    stemText: 'Ở người, bệnh фенилкетонурия (phenylketonuria - PKU) do một allele lặn $a$ nằm trên nhiễm sắc thể thường quy định, allele trội $A$ quy định bình thường. Một cặp vợ chồng đều có kiểu hình bình thường nhưng cả bên vợ và bên chồng đều có em gái ruột mắc bệnh PKU ($aa$), bố mẹ hai bên đều bình thường. Xác suất cặp vợ chồng này sinh con đầu lòng không mắc bệnh PKU là bao nhiêu phần trăm? (Làm tròn đến 1 chữ số thập phân sau dấu phẩy).',
    hasFormula: true,
    formulaLatex: 'P(aa) = \\frac{2}{3} \\times \\frac{2}{3} \\times \\frac{1}{4} = \\frac{1}{9} \\implies P(\\text{bình thường}) = 1 - \\frac{1}{9} = \\frac{8}{9} \\approx 88,9\\%',
    bloomLevel: 'VAN_DUNG_CAO',
    learningOutcome: 'Giải bài toán tư vấn di truyền học người và tính xác suất sinh con bình thường.',
    explanation: 'Do cả vợ và chồng đều bình thường nhưng có em gái bị bệnh ($aa$) và bố mẹ bình thường ($Aa \\times Aa$), nên vợ và chồng đều có xác suất kiểu gene là $\\frac{1}{3}AA : \\frac{2}{3}Aa$. Xác suất sinh con đầu lòng bị bệnh ($aa$) là $\\frac{2}{3} \\times \\frac{2}{3} \\times \\frac{1}{4} = \\frac{1}{9}$. Do đó xác suất sinh con đầu lòng không mắc bệnh là $1 - \\frac{1}{9} = \\frac{8}{9} \\approx 88,9\\%$.',
    shortAnswer: '88,9',
    shortAnswerDetectedBy: 'UNDERLINE_RED',
  },
];

/**
 * Đăng ký động các tính năng nâng cao (Dynamic Feature Registry)
 */
export const DYNAMIC_FEATURE_REGISTRY: FeatureReleaseItem[] = [
  {
    id: 'feat-bio12-hk1-sample',
    version: 'v3.9.0',
    releaseDate: '2026-10',
    title: 'Đề Mẫu Kiểm Tra Cuối Học Kì 1 — Môn Sinh Học 12 (28 Câu Chuẩn 18-4-6)',
    category: 'CORE_PARSER',
    description: 'Đề mẫu chuẩn cấu trúc 2025 (18 câu Phần I + 4 câu Phần II + 6 câu Phần III) bao quát toàn bộ chương trình Học kì 1 Sinh học 12: Sơ đồ DNA, Operon Lac, bài tập DNA-RNA-Protein, quy luật Mendel, hoán vị gene, liên kết giới tính, lai giống tạo ưu thế lai và 2 sơ đồ phả hệ di truyền học người.',
    technicalSpec: '4 sơ đồ Vector SVG 300 DPI + Công thức OMML/LaTeX + Sạch 100% lỗi.',
    autoDetected: true,
  },
  {
    id: 'feat-master-multi-qr',
    version: 'v3.8.2',
    releaseDate: '2026-10',
    title: 'Mã QR Tổng Hợp Đa Mã Đề (Quét 1 Lần Nạp Đủ Tất Cả Mã Đề)',
    category: 'QR_ENGINE',
    description: 'Tích hợp toàn bộ key đáp án của tất cả các mã đề (101, 102, 103, 104...) vào 1 mã QR duy nhất. Giáo viên quét 1 lần bằng điện thoại là ứng dụng (QM, Azota, TNMaker) tự động nhận diện đủ các mã đề. Tự động nhúng vào trang cuối Word và tải ảnh PNG.',
    technicalSpec: 'Master Multi-Exam QR Code payload với ECC Level L tối ưu dung lượng ký tự.',
    autoDetected: true,
  },
  {
    id: 'feat-cv7991-matrix-spec',
    version: 'v3.8.0',
    releaseDate: '2026-10',
    title: 'Khung Ma Trận & Bản Đặc Tả Chuẩn Công Văn 7991/BGDĐT-GDTrH',
    category: 'WORD_EXPORT',
    description: 'Tự động phân nhóm chủ đề, đơn vị kiến thức và tính điểm chuẩn Sư phạm theo tỷ lệ: Nhận biết 40% (4.0đ) - Thông hiểu 30% (3.0đ) - Vận dụng 30% (3.0đ). Xuất file Word Phụ lục 1 & Phụ lục 2 kèm khung chữ ký phê duyệt Ban Giám Hiệu.',
    technicalSpec: 'Phụ lục 1 (Khung ma trận 9 cột mức độ) + Phụ lục 2 (Bản đặc tả Yêu cầu cần đạt GDPT 2018).',
    autoDetected: true,
  },
  {
    id: 'feat-cross-referencing-matrix',
    version: 'v3.7.5',
    releaseDate: '2026-10',
    title: 'Bảng Ma Trận Đáp Án Đối Chiếu Đa Mã Đề (Tiết Kiệm 70% Diện Tích)',
    category: 'AUTO_LAYOUT',
    description: 'Xếp các mã đề song song theo cột đối chiếu từng câu hỏi. Hiển thị badge màu nổi bật A/B/C/D, bảng Đúng/Sai và đáp số ngắn, gói gọn toàn bộ đáp án trên 1 trang A4 duy nhất, chống rối mắt khi chấm thi.',
    technicalSpec: 'Cross-referencing Matrix Grid Layout · Badge màu phân biệt 4 phương án · Fit 1 trang A4.',
    autoDetected: true,
  },
  {
    id: 'feat-standard-naming-zip',
    version: 'v3.7.0',
    releaseDate: '2026-10',
    title: 'Quy Chuẩn Đồng Nhất Tên File Xuất (.zip và các file Word bên trong)',
    category: 'WORD_EXPORT',
    description: 'Đồng bộ cấu trúc đặt tên file theo mẫu: Môn [Tên môn] - Lớp [Lớp] - Kỳ kiểm tra [Kỳ] - [dd-mm-yy] [Hậu tố].docx/.zip cho toàn bộ các đề thi, bảng đáp án và bản đặc tả CV 7991.',
    technicalSpec: 'Cú pháp chuẩn hóa: Môn ${subject} - ${grade} - Kỳ kiểm tra ${exam} - ${dd-mm-yy}.',
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
