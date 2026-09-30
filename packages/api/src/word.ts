import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { importDocx, MAX_DOCX_BYTES, DOCX_MIME } from './docx.js';
const run = promisify(execFile);

export async function importWord(buffer: Buffer, fileName: string) {
  if (!/\.doc$/i.test(fileName)) return importDocx(buffer, fileName);
  if (buffer.length > MAX_DOCX_BYTES) throw new Error('Word 文件最大支持 15 MB');
  if (!buffer.subarray(0, 8).equals(Buffer.from('d0cf11e0a1b11ae1', 'hex'))) throw new Error('不是有效的旧版 Word .doc 文件');
  const dir = await mkdtemp(join(tmpdir(), 'activity-word-'));
  try {
    const input = join(dir, 'source.doc'), outputDir = join(dir, 'converted'), output = join(outputDir, 'source.docx');
    await writeFile(input, buffer); await mkdir(outputDir);
    const libreoffice = process.env.LIBREOFFICE_PATH || (process.platform === 'win32' ? 'C:\\Program Files\\LibreOffice\\program\\soffice.exe' : 'soffice');
    if (process.platform !== 'win32' || existsSync(libreoffice)) {
      await run(libreoffice, [`-env:UserInstallation=${pathToFileURL(join(dir, 'profile')).href}`, '--headless', '--convert-to', 'docx:Office Open XML Text', '--outdir', outputDir, input], { timeout: 60_000, windowsHide: true, maxBuffer: 100_000 });
    } else {
      const helper = await readFile(fileURLToPath(new URL('../src/legacy-word.ps1', import.meta.url)), 'utf8');
      const command = '$InputFile=$env:STUDIO_WORD_INPUT; $OutputFile=$env:STUDIO_WORD_OUTPUT;\n' + helper.replace(/^param\([^\n]+\)\r?\n/, '');
      await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { env: { ...process.env, STUDIO_WORD_INPUT: input, STUDIO_WORD_OUTPUT: output }, timeout: 60_000, windowsHide: true, maxBuffer: 100_000 });
    }
    const result = await importDocx(await readFile(output), fileName);
    result.document = { ...result.document, mimeType: 'application/msword', size: buffer.length, originalBase64: buffer.toString('base64'), warnings: ['旧版 .doc 已在本地转换，请核对图文和表格。', ...result.document.warnings] };
    return result;
  } catch { throw new Error('旧版 Word 转换失败。Windows 本地需安装 Word 或 LibreOffice；服务器请配置 LIBREOFFICE_PATH。加密文档请先解密。'); }
  finally { if (dir.startsWith(join(tmpdir(), 'activity-word-'))) await rm(dir, { recursive: true, force: true }); }
}
export { DOCX_MIME };
