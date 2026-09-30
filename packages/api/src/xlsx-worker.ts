import { parentPort, workerData } from 'node:worker_threads';
import ExcelJS from 'exceljs';
import type { ActivityConfiguration, ConfigField, ConfigTable } from '@ai-activity-studio/shared';
import { fromGrid, configType, validateConfiguration } from './configuration.js';
import { sheetName } from './xlsx.js';

function cellText(cell: ExcelJS.Cell): string {
  let value = cell.value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && ('formula' in value || 'sharedFormula' in value)) {
    if (value.result === undefined) throw new Error(`${cell.address} 公式没有计算结果，请先用 Excel 重算并保存`);
    value = value.result;
  }
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object') {
    if ('error' in value) throw new Error(`${cell.address} 含 Excel 错误：${value.error}`);
    if ('richText' in value) return value.richText.map(part => part.text).join('');
    if ('text' in value) return value.text;
    throw new Error(`${cell.address} 的单元格格式不支持`);
  }
  // IDs displayed with leading zeroes must remain text.
  if (typeof value === 'number' && /^0{2,}$/.test(cell.numFmt)) return String(value).padStart(cell.numFmt.length, '0');
  return String(value ?? '');
}

try {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Uint8Array.from(workerData.buffer).buffer);
  const previous = workerData.previous as ActivityConfiguration | undefined;
  const oldTables = previous?.tables ?? (previous ? [{ ...previous, id: 'main', name: '主流程表' }] : []);
  const tables: ConfigTable[] = [];
  for (const sheet of workbook.worksheets) {
    if (!sheet.actualRowCount) continue;
    if (tables.length >= 20 || sheet.rowCount > 1003 || sheet.columnCount > 50) throw new Error('最多支持 20 张表，每表 50 列、1000 行数据及 3 行表头');
    try {
      const grid: string[][] = [], sourceRows: number[] = [];
      sheet.eachRow(row => { const cells = Array.from({ length: sheet.columnCount }, (_, i) => cellText(row.getCell(i + 1))); if (cells.some(Boolean)) { grid.push(cells); sourceRows.push(row.number); } });
      const existing = oldTables.find((table, index) => table.id === sheet.name || table.name === sheet.name || sheetName(table, index) === sheet.name);
      const config = fromGrid(grid, existing ? { ...existing, revision: 0, updatedAt: '' } : undefined);
      // Without declared types or a previous schema, Excel text cells stay text (including numeric-looking IDs).
      const typed = grid.slice(1, 3).some(row => row.every(value => configType(value)));
      if (!typed && !existing && grid[0]?.every((key, i) => key === config.fields[i]?.key)) {
        config.fields.forEach((field: ConfigField, i: number) => {
          if (field.type === 'number' && grid.slice(1).some((_, row) => typeof sheet.getCell(sourceRows[row + 1]!, i + 1).value === 'string')) {
            field.type = 'string'; config.rows.forEach((row, index) => { if (grid[index + 1]![i] !== '') row[field.key] = grid[index + 1]![i]!; });
            for (const role of ['duration', 'actions', 'cost', 'reward'] as const) if (config.pacing[role] === field.key) delete config.pacing[role];
          }
        });
      }
      let id = existing?.id ?? (/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(sheet.name) ? sheet.name : 'table_' + (tables.length + 1));
      while (tables.some(table => table.id.toLowerCase() === id.toLowerCase())) id = 'table_' + (tables.length + 1) + '_' + id.slice(0, 48);
      tables.push({ id, name: existing?.name ?? sheet.name, fields: config.fields, rows: config.rows, pacing: config.pacing });
    } catch (error) { throw new Error(`工作表「${sheet.name}」：${(error as Error).message}`); }
  }
  if (!tables.length) throw new Error('工作簿为空，请填写字段表头');
  parentPort?.postMessage(validateConfiguration({ tables, primaryTableId: tables.some(table => table.id === previous?.primaryTableId) ? previous!.primaryTableId : tables[0]!.id }));
} catch (error) { parentPort?.postMessage({ error: (error as Error).message }); }

