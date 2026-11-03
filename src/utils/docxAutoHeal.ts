/**
 * EDUMIX AUTO-HEAL ENGINE (Vite + TypeScript)
 */

export class DocxAutoHealEngine {
  mediaMap: Record<string, string> = {};

  // Chữa lỗi ảnh WMF sang SVG hiển thị mượt trên web
  async extractAndHealMedia(zip: any): Promise<Record<string, string>> {
    this.mediaMap = {};
    const mediaFiles = Object.keys(zip.files).filter(path => path.startsWith('word/media/'));

    for (const filePath of mediaFiles) {
      const fileName = filePath.split('/').pop() || '';
      const ext = fileName.split('.').pop()?.toLowerCase();

      if (ext === 'wmf' || ext === 'emf') {
        this.mediaMap[fileName] = this.createVectorPlaceholder(fileName);
      } else {
        const base64 = await zip.files[filePath].async('base64');
        const mime = ext === 'png' ? 'image/png' : (ext === 'gif' ? 'image/gif' : 'image/jpeg');
        this.mediaMap[fileName] = `data:${mime};base64,${base64}`;
      }
    }
    return this.mediaMap;
  }

  // Khung SVG giả lập công thức/hình vector tránh làm vỡ giao diện
  createVectorPlaceholder(fileName: string): string {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="160" height="48" viewBox="0 0 160 48">
        <rect width="100%" height="100%" fill="#f1f5f9" stroke="#cbd5e1" rx="4"/>
        <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#475569">
          [Công thức/Hình]
        </text>
        <text x="50%" y="75%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="9" fill="#94a3b8">
          ${fileName}
        </text>
      </svg>
    `;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }
}
