import { parentPort, workerData } from 'node:worker_threads';
import { randomUUID } from 'node:crypto';
import mammoth from 'mammoth';
import sanitizeHtml from 'sanitize-html';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import type { SourceDocument, SourceImage } from '@ai-activity-studio/shared';

async function convert() {
  const buffer = Buffer.from(workerData.buffer);
  const images: SourceImage[] = [], warnings: string[] = [];
  let imageBytes = 0;
  const result = await mammoth.convertToHtml({ buffer }, { externalFileAccess: false, includeEmbeddedStyleMap: false, convertImage: mammoth.images.imgElement(async image => {
    if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(image.contentType)) { warnings.push(`图片格式 ${image.contentType} 无法预览，请在 Word 中转为 PNG/JPEG 后重新上传`); return { src: 'unsupported-image' }; }
    const bytes = await image.readAsBuffer(); imageBytes += bytes.length;
    if (images.length >= 20 || imageBytes > 10 * 1024 * 1024) throw new Error('图片最多支持 20 张、合计 10 MB，请压缩或拆分文档');
    const id = randomUUID(); images.push({ id, mimeType: image.contentType, base64: bytes.toString('base64'), name: `原稿图片 ${images.length + 1}` });
    return { src: `attachment:${id}` };
  }) });
  if (result.messages.length) warnings.push('部分 Word 样式或对象可能无法转换；请对照原文件检查图文。');
  const clean = sanitizeHtml(result.value, {
    allowedTags: ['p','h1','h2','h3','h4','h5','h6','strong','em','u','s','del','sub','sup','br','ul','ol','li','table','thead','tbody','tr','td','th','blockquote','pre','code','a','img'],
    allowedAttributes: { img: ['src','alt'], a: ['href'], td: ['colspan','rowspan'], th: ['colspan','rowspan'] },
    allowedSchemes: ['https','http','mailto'], allowedSchemesByTag: { img: ['attachment'] }, allowProtocolRelative: false,
    transformTags: { img: (_tag, attributes) => images.some(image => attributes.src === `attachment:${image.id}`) ? { tagName: 'img', attribs: attributes } : { tagName: 'p', attribs: {}, text: '[此图片无法转换，请查看原 Word 文件]' } }
  });
  const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
  turndown.use(gfm);
  turndown.addRule('wordTables', {
    filter: 'table',
    replacement: (_content, node) => {
      const table = node as HTMLElement;
      const rows: string[][] = [];
      const sourceRows = Array.from(table.querySelectorAll('tr')).filter(row => row.closest('table') === table);
      sourceRows.forEach((row, rowIndex) => {
        const currentRow = rows[rowIndex] ??= [];
        let column = 0;
        Array.from(row.children).filter(cell => ['TD', 'TH'].includes(cell.nodeName)).forEach(cell => {
          while (currentRow[column] !== undefined) column++;
          const width = Math.min(100, Math.max(1, Number(cell.getAttribute('colspan')) || 1));
          const height = Math.min(sourceRows.length - rowIndex, Math.max(1, Number(cell.getAttribute('rowspan')) || 1));
          if (width > 1 || height > 1) warnings.push('合并单元格已展开，内容保留在起始格；请对照原 Word 文件检查表格。');
          const content = turndown.turndown(cell.innerHTML).trim().replace(/\r?\n+/g, ' ').replace(/(?<!\\)\|/g, '\\|');
          for (let y = 0; y < height; y++) {
            const targetRow = rows[rowIndex + y] ??= [];
            for (let x = 0; x < width; x++) targetRow[column + x] = x === 0 && y === 0 ? content : '';
          }
          column += width;
        });
      });
      const columns = Math.max(0, ...rows.map(row => row.length));
      if (!columns) return '';
      const lines = rows.map(row => `| ${Array.from({ length: columns }, (_, index) => row[index] ?? '').join(' | ')} |`);
      lines.splice(1, 0, `| ${Array(columns).fill('---').join(' | ')} |`);
      return `\n\n${lines.join('\n')}\n\n`;
    }
  });
  const markdown = turndown.turndown(clean).trim();
  if (!markdown) throw new Error('Word 中没有可导入的正文或图片');
  const document: SourceDocument = { fileName: workerData.fileName, size: buffer.length, originalBase64: buffer.toString('base64'), images, warnings: [...new Set(warnings)], importedAt: new Date().toISOString() };
  parentPort?.postMessage({ markdown, document });
}
void convert().catch(error => parentPort?.postMessage({ error: error instanceof Error && error.message.startsWith('图片最多') ? error.message : 'Word 解析失败，请检查文件是否损坏、加密或包含不支持的对象' }));
