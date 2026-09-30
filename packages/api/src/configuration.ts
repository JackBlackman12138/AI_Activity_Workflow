import type { Activity, ActivityConfiguration, ConfigTable, ConfigField, ConfigRow, PacingMapping, PlayEvent } from '@ai-activity-studio/shared';

export function validateConfiguration(input: unknown): ActivityConfiguration {
  const value = input as ActivityConfiguration;
  if (value?.tables) {
    if (!Array.isArray(value.tables) || !value.tables.length || value.tables.length > 20) throw new Error('每个活动支持 1–20 张配置表');
    const ids = new Set<string>();
    const tables: ConfigTable[] = value.tables.map(table => {
      if (!table || !/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(table.id) || ids.has(table.id) || !table.name?.trim()) throw new Error('配置表 ID 必须唯一且以字母开头，表名必填');
      ids.add(table.id);
      const parsed = validateConfiguration({ fields: table.fields, rows: table.rows, pacing: table.pacing });
      return { id: table.id, name: table.name.trim().slice(0,100), fields: parsed.fields, rows: parsed.rows, pacing: parsed.pacing };
    });
    const primary = tables.find(table => table.id === value.primaryTableId);
    if (!primary) throw new Error('请选择一张主流程表，用于游玩节奏分析');
    return { ...validateConfiguration(primary), tables, primaryTableId: primary.id };
  }
  if (!value || !Array.isArray(value.fields) || !value.fields.length || value.fields.length > 50) throw new Error('配置表需要 1–50 个字段');
  if (!Array.isArray(value.rows) || value.rows.length > 1000) throw new Error('配置表最多支持 1000 行；仅有字段定义时可保留空表');
  const keys = new Set<string>();
  const fields = value.fields.map((field): ConfigField => {
    if (!field || typeof field.key !== 'string' || !/^[\p{L}_][\p{L}\p{N}_]{0,63}$/u.test(field.key) || ['__proto__', 'prototype', 'constructor'].includes(field.key) || keys.has(field.key)) throw new Error('字段名必须唯一，以字母、中文或下划线开头，最多 64 字');
    if (!['string', 'number', 'boolean'].includes(field.type) || typeof field.label !== 'string' || !field.label.trim()) throw new Error(`字段 ${field.key} 的名称或类型无效`);
    keys.add(field.key);
    return { key: field.key, label: field.label.trim().slice(0, 100), type: field.type, required: Boolean(field.required), description: String(field.description ?? '').slice(0, 500) };
  });
  const rows = value.rows.map((row, index): ConfigRow => {
    if (!row || Array.isArray(row) || typeof row !== 'object') throw new Error(`第 ${index + 1} 行格式无效`);
    if (Object.keys(row).some(key => !keys.has(key))) throw new Error(`第 ${index + 1} 行含未定义字段，请先添加字段定义`);
    const result: ConfigRow = {};
    for (const field of fields) {
      const cell = row[field.key];
      if (cell === undefined || cell === '') { if (field.required) throw new Error(`第 ${index + 1} 行「${field.label}」必填`); continue; }
      if (typeof cell !== field.type || (typeof cell === 'number' && !Number.isFinite(cell)) || (typeof cell === 'string' && cell.length > 2000)) throw new Error(`第 ${index + 1} 行「${field.label}」必须为 ${field.type}`);
      result[field.key] = cell;
    }
    return result;
  });
  const pacing: PacingMapping = {};
  for (const role of ['label', 'duration', 'actions', 'cost', 'reward'] as const) {
    const key = value.pacing?.[role];
    if (!key) continue;
    const field = fields.find(f => f.key === key);
    if (!field || (role !== 'label' && field.type !== 'number')) throw new Error(`节奏映射 ${role} 必须对应${role === 'label' ? '已有' : '数值'}字段`);
    if (role !== 'label' && rows.some(row => typeof row[key] !== 'number' || (row[key] as number) < (role === 'actions' ? 1 : 0) || (role === 'actions' && !Number.isInteger(row[key])))) throw new Error(`节奏字段 ${key} 每行均需填写${role === 'actions' ? '正整数' : '非负数'}`);
    pacing[role] = key;
  }
  return { fields, rows, pacing, revision: 0, updatedAt: '' };
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false, closed = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; closed = true; } } else cell += c; }
    else if (c === '"' && !cell && !closed) quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; closed = false; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); if (row.some(x => x !== '')) rows.push(row); row = []; cell = ''; closed = false; }
    else { if (closed || c === '"') throw new Error('CSV 引号格式错误'); cell += c; }
  }
  if (quoted) throw new Error('CSV 引号未闭合');
  row.push(cell); if (row.some(x => x !== '')) rows.push(row);
  return rows;
}

export function configType(value: string): ConfigField['type'] | undefined {
  if (/^(number|int(?:32|64)?|integer|float|double|decimal|long|数值)$/i.test(value)) return 'number';
  if (/^(bool|boolean|布尔)$/i.test(value)) return 'boolean';
  if (/^(string|text|enum|文本)$/i.test(value) || /\[\]$/.test(value)) return 'string';
}

export function fromGrid(grid: string[][], previous?: ActivityConfiguration): ActivityConfiguration {
  let [header, ...data] = grid;
  if (!header || data.some(row => row.length !== header!.length)) throw new Error('配置表缺少表头，或每行列数不一致');
  let labels = header, types: string[] | undefined;
  const isTypes = (row?: string[]) => row?.length === header!.length && row.every(cell => configType(cell));
  const isKeys = (row?: string[]) => row?.length === header!.length && row.every(cell => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(cell));
  if (isTypes(data[0])) { types = data.shift(); if (isKeys(data[0])) header = data.shift()!; }
  else if (isKeys(data[0]) && (isTypes(data[1]) || header.some(cell => /[^a-zA-Z0-9_]/.test(cell)))) { header = data.shift()!; if (isTypes(data[0])) types = data.shift(); }
  const fields: ConfigField[] = header.map((key, index) => {
    const existing = previous?.fields.find(field => field.key === key.trim());
    const cells = data.map(row => row[index]!).filter(cell => cell !== '');
    const type = types ? configType(types[index]!)! : existing?.type ?? (cells.length && cells.every(cell => /^(?:-?(?:0|[1-9]\d*)(?:\.\d+)?(?:e[+-]?\d+)?)$/i.test(cell) && Number.isFinite(Number(cell)) && (!Number.isInteger(Number(cell)) || Number.isSafeInteger(Number(cell)))) ? 'number' : cells.length && cells.every(cell => ['true', 'false'].includes(cell)) ? 'boolean' : 'string');
    return { ...existing, key: key.trim(), label: existing?.label ?? labels[index]!.trim(), type, required: existing?.required ?? false };
  });
  const rows = data.map(row => Object.fromEntries(fields.map((field, index) => { const cell = row[index]!; return [field.key, field.type === 'number' && cell !== '' ? Number(cell) : field.type === 'boolean' && ['true', 'false'].includes(cell) ? cell === 'true' : cell]; })));
  const pacing: PacingMapping = {};
  for (const [role, key] of Object.entries(previous?.pacing ?? { label: 'name', duration: 'durationSeconds', actions: 'actions', cost: 'cost', reward: 'reward' })) if (fields.some(f => f.key === key && (role === 'label' || f.type === 'number'))) pacing[role as keyof PacingMapping] = key;
  return validateConfiguration({ fields, rows, pacing });
}

export function configurationFromDocument(activity: Activity): ActivityConfiguration & { warnings: string[] } {
  const document = activity.artifacts?.document;
  if (!document || document.encoding !== 'utf8') throw new Error('请先保存可读取的文本策划文档');
  const lines = document.content.split(/\r?\n/);
  const clean = (text: string) => text.replace(/\*\*|`/g, '').replace(/\\([_|*])/g, '$1').trim();
  const split = (line: string) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(clean);
  const tables: ConfigTable[] = [], warnings: string[] = [];
  let heading = '';
  for (let i = 0; i < lines.length; i++) {
    if (/^#+ |^\d[\d.\\]*\s+\*\*/.test(lines[i]!)) heading = clean(lines[i]!.replace(/^#+ |^\d[\d.\\]*\s+/, ''));
    if (i < 1 || !/^\s*\|?\s*:?-{3,}/.test(lines[i]!) || !lines[i]!.includes('|')) continue;
    const grid = [split(lines[i - 1]!)];
    while (i + 1 < lines.length && lines[i + 1]!.includes('|')) {
      const row = split(lines[++i]!);
      if (row.some(cell => /^(?:\.{3,}|…+)$/.test(cell)) && row.every(cell => !cell || /^(?:\.{3,}|…+)$/.test(cell))) continue;
      grid.push(row);
    }
    const header = grid[0]!;
    const keyColumn = header.findIndex(key => /^(字段|字段名|字段名称)$/.test(key));
    const typeColumn = header.indexOf('类型');
    let config: ActivityConfiguration;
    if (keyColumn >= 0 && typeColumn >= 0) {
      const labelColumn = header.indexOf('中文字段'), descriptionColumn = header.findIndex(key => key.includes('说明'));
      config = validateConfiguration({ fields: grid.slice(1).map(row => ({ key: row[keyColumn], label: row[labelColumn] || row[keyColumn], type: configType(row[typeColumn]!) ?? 'string', description: row[descriptionColumn] ?? '', required: false })), rows: [], pacing: {} });
    } else {
      // Exclude changelogs and descriptive UI/rule tables. Only explicit configuration/data tables qualify.
      if (!header.every(key => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) && !grid[1]?.every(key => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key))) continue;
      try { config = fromGrid(grid); }
      catch (error) { warnings.push(`「${heading || '配置表'}」的数据未导入：${(error as Error).message}。请核对文档类型与内容，或上传修正后的 XLSX。`); continue; }
    }
    const schema = tables.find(table => table.name === heading && !table.rows.length && table.fields.map(field => field.key).join(',') === config.fields.map(field => field.key).join(','));
    if (schema && config.rows.length) { schema.rows = config.rows; continue; }
    const baseId = heading.match(/[a-zA-Z][a-zA-Z0-9_]{0,63}/)?.[0] ?? (tables.length ? 'table_' + (tables.length + 1) : 'main');
    let id = baseId; for (let suffix = 2; tables.some(table => table.id === id); suffix++) id = baseId.slice(0, 60) + '_' + suffix;
    tables.push({ id, name: heading || '配置表 ' + (tables.length + 1), fields: config.fields, rows: config.rows, pacing: config.pacing });
  }
  if (!tables.length) throw new Error(warnings.join('\n') || '文档中未找到明确的配置字段表，请补充字段定义、上传 XLSX，或使用 AI 提取');
  return { ...validateConfiguration({ tables, primaryTableId: tables[0]!.id }), warnings };
}

export function exportCsv(config: ActivityConfiguration): string {
  const encode = (value: unknown) => { let cell = String(value ?? ''); if (/^[\s]*[=+@-]/.test(cell) && typeof value !== 'number') cell = "'" + cell; return '"' + cell.replace(/"/g, '""') + '"'; };
  return '\uFEFF' + [config.fields.map(f => encode(f.key)).join(','), ...config.rows.map(row => config.fields.map(f => encode(row[f.key])).join(','))].join('\r\n');
}

export function recordPlayEvent(activity: Activity, input: unknown): PlayEvent {
  const event = input as PlayEvent;
  const config = activity.demoConfiguration;
  if (!config || !event || event.revision !== config.revision) throw new Error('试玩配置版本已变化，请刷新 Demo 后重试');
  if (!event || !/^[a-zA-Z0-9-]{1,80}$/.test(event.id ?? '') || !/^[a-zA-Z0-9-]{1,80}$/.test(event.sessionId ?? '') || !['session_start', 'step_enter', 'step_complete', 'session_complete'].includes(event.type) || !Number.isFinite(event.elapsedMs) || event.elapsedMs < 0 || event.elapsedMs > 86_400_000) throw new Error('试玩事件格式无效');
  activity.playEvents ??= [];
  const duplicate = activity.playEvents.find(item => item.id === event.id); if (duplicate) return duplicate;
  const session = activity.playEvents.filter(e => e.sessionId === event.sessionId);
  if (event.type === 'session_start' ? session.length > 0 : !session.some(e => e.type === 'session_start' && e.revision === event.revision)) throw new Error('试玩会话状态无效');
  if (session.some(e => e.type === 'session_complete') || (session.at(-1)?.elapsedMs ?? 0) > event.elapsedMs) throw new Error('试玩事件顺序无效');
  if (event.type.startsWith('step_')) {
    if (!Number.isInteger(event.stepIndex) || event.stepIndex! < 0 || event.stepIndex! >= config.rows.length) throw new Error('试玩节点无效');
    const completed = session.filter(e => e.type === 'step_complete').length;
    if (event.stepIndex !== completed || (event.type === 'step_complete' && !session.some(e => e.type === 'step_enter' && e.stepIndex === event.stepIndex)) || session.some(e => e.type === event.type && e.stepIndex === event.stepIndex)) throw new Error('试玩节点顺序无效');
  }
  if (event.type === 'session_complete' && session.filter(e => e.type === 'step_complete').length !== config.rows.length) throw new Error('尚未完成全部节点');
  if (activity.playEvents.length >= 20_000) throw new Error('本地试玩记录已达 20000 条上限');
  const saved: PlayEvent = { id: event.id, sessionId: event.sessionId, revision: event.revision, type: event.type, ...(event.stepIndex === undefined ? {} : { stepIndex: event.stepIndex }), elapsedMs: event.elapsedMs, at: new Date().toISOString() };
  activity.playEvents.push(saved); return saved;
}

