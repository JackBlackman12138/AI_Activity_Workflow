import ExcelJS from 'exceljs';
import { Worker } from 'node:worker_threads';
import type { ActivityConfiguration, ConfigTable } from '@ai-activity-studio/shared';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const MAX_XLSX_BYTES = 15 * 1024 * 1024;
export function sheetName(table: ConfigTable, index: number) { return table.id.length <= 31 ? table.id : `${index + 1}_${table.id}`.slice(0, 31); }

export async function importXlsx(buffer: Buffer, previous?: ActivityConfiguration): Promise<ActivityConfiguration> {
  if (buffer.length > MAX_XLSX_BYTES) throw new Error('XLSX 文件最大支持 15 MB');
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./xlsx-worker.js', import.meta.url), { workerData: { buffer, previous }, resourceLimits: { maxOldGenerationSizeMb: 192 } });
    const timer = setTimeout(() => { void worker.terminate(); reject(new Error('XLSX 读取超时，请拆分过大的工作簿')); }, 30_000);
    worker.once('message', result => { clearTimeout(timer); void worker.terminate(); if (result.error) reject(new Error(result.error)); else resolve(result); });
    worker.once('error', () => { clearTimeout(timer); reject(new Error('XLSX 读取失败，请检查文件是否损坏或内容过大')); });
    worker.once('exit', code => { clearTimeout(timer); if (code !== 0) reject(new Error('XLSX 读取已中止')); });
  });
}

export async function exportXlsx(config: ActivityConfiguration): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const tables = config.tables ?? [{ ...config, id: 'main', name: '主流程表' }];
  tables.forEach((table, index) => {
    const sheet = workbook.addWorksheet(sheetName(table, index));
    sheet.addRow(table.fields.map(field => field.label));
    sheet.addRow(table.fields.map(field => field.key));
    sheet.addRow(table.fields.map(field => field.type));
    for (const row of table.rows) sheet.addRow(table.fields.map(field => row[field.key] ?? null));
    sheet.views = [{ state: 'frozen', ySplit: 3 }];
    table.fields.forEach((field, column) => { sheet.getColumn(column + 1).width = 24; sheet.getCell(2, column + 1).note = field.description || field.label; });
    for (const row of [1, 2, 3]) { sheet.getRow(row).font = { bold: true, color: { argb: 'FF176B55' } }; }
  });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
