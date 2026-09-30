import { Worker } from 'node:worker_threads';
import type { SourceDocument } from '@ai-activity-studio/shared';

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const MAX_DOCX_BYTES = 15 * 1024 * 1024;

// Check advertised expansion before the parser allocates decompressed entries.
export function checkDocxArchive(buffer: Buffer) {
  if (buffer.length > MAX_DOCX_BYTES) throw new Error('Word 文件最大支持 15 MB');
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65_557); i--) if (buffer.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  if (end < 0) throw new Error('不是有效的 DOCX 文件，请在 Word 中另存为 .docx');
  const count = buffer.readUInt16LE(end + 10), size = buffer.readUInt32LE(end + 12), offset = buffer.readUInt32LE(end + 16);
  if (!count || count > 2000 || offset + size > end) throw new Error('Word 压缩目录无效或过大');
  let cursor = offset, expanded = 0, hasDocument = false;
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > end || buffer.readUInt32LE(cursor) !== 0x02014b50) throw new Error('Word 压缩目录损坏');
    const entrySize = buffer.readUInt32LE(cursor + 24), nameLength = buffer.readUInt16LE(cursor + 28);
    const next = cursor + 46 + nameLength + buffer.readUInt16LE(cursor + 30) + buffer.readUInt16LE(cursor + 32);
    if (next > end || !nameLength || buffer.readUInt16LE(cursor + 8) & 1) throw new Error('不支持加密或损坏的 Word 文件');
    const name = buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
    if (name === 'word/document.xml') hasDocument = true;
    if (name.startsWith('/') || name.includes('..') || name.includes('\\')) throw new Error('Word 包含不安全的资源路径');
    expanded += entrySize;
    if (entrySize > 20 * 1024 * 1024 || expanded > 60 * 1024 * 1024) throw new Error('Word 解压后过大，请压缩图片或拆分文档');
    cursor = next;
  }
  if (!hasDocument || cursor !== offset + size) throw new Error('DOCX 缺少正文或目录不完整');
}

export async function importDocx(buffer: Buffer, fileName: string): Promise<{ markdown: string; document: SourceDocument }> {
  checkDocxArchive(buffer);
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./docx-worker.js', import.meta.url), { workerData: { buffer, fileName }, resourceLimits: { maxOldGenerationSizeMb: 192 } });
    const timer = setTimeout(() => { void worker.terminate(); reject(new Error('Word 解析超时，请压缩图片或拆分文档')); }, 30_000);
    worker.once('message', result => { clearTimeout(timer); void worker.terminate(); if (result.error) reject(new Error(result.error)); else resolve(result); });
    worker.once('error', () => { clearTimeout(timer); reject(new Error('Word 解析失败，请检查文件是否损坏或内容过大')); });
    worker.once('exit', code => { clearTimeout(timer); if (code !== 0) reject(new Error('Word 解析已中止')); });
  });
}
