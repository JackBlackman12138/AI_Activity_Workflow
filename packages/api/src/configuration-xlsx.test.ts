import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Activity } from '@ai-activity-studio/shared';
import { configurationFromDocument, fromGrid, parseCsv, validateConfiguration } from './configuration.js';
import { exportXlsx, importXlsx } from './xlsx.js';
import { createApiServer } from './server.js';
import { JsonPersistenceStore } from './store.js';

const document = `# 活动说明
| **检查项** | **规则** |
| --- | --- |
| 开放 | 等级7 |
9.4.1 **任务组表ManualTask**
| 字段 | 类型 | 说明 |
| --- | --- | --- |
| task\\_id | string | 唯一ID |
| task\\_type | enum | COLLECT |
9.5.6 **奖励配置**
| 收藏组 ID | 奖励 | 类型 |
| --- | --- | --- |
| **CollectionId** | **rewardId** | **Type** |
| 601 | 10001\\|3\\_10002\\|3 | 1 |
9.6 **订单配置**
| ID | R标签 | 代币系数 |
| --- | --- | --- |
| id | rtagCondition | tokenFactor |
| Number | String | Number |
| 1 | 0;1;2 | 2.5 |
| ... | | |`;

test('Word 配置提取跳过说明表，识别字段定义、加粗、转义管道及三行表头', () => {
  const config = configurationFromDocument({ artifacts: { document: { content: document, encoding: 'utf8' } } } as Activity);
  assert.equal(config.tables?.length, 3);
  assert.equal(config.tables![0]!.id, 'ManualTask');
  assert.equal(config.tables![0]!.fields[0]!.key, 'task_id');
  assert.deepEqual(config.tables![0]!.rows, []);
  assert.equal(config.tables![1]!.rows[0]!.rewardId, '10001|3_10002|3');
  assert.equal(config.tables![2]!.rows[0]!.tokenFactor, 2.5);
  assert.equal(config.tables![2]!.rows[0]!.rtagCondition, '0;1;2');
});

test('CSV 和空字段模板保留前导零及大整数标识', () => {
  const config = fromGrid(parseCsv('id,reward\n001,10001|3_10002|3\n9007199254740993,10001|3'));
  assert.equal(config.rows[0]!.id, '001'); assert.equal(config.rows[1]!.id, '9007199254740993');
  assert.equal(fromGrid([['id'], ['string']]).rows.length, 0);
});

test('文档示例字段类型冲突仅提示该表，不阻断其他配置', () => {
  const content = document + '\n# 商品表\n| 商品ID | 奖励ID |\n| --- | --- |\n| Number | Number |\n| Id | RewardId |\n| 1 | 10001\\|1 |';
  const config = configurationFromDocument({ artifacts: { document: { content, encoding: 'utf8' } } } as Activity);
  assert.equal(config.tables?.length, 3);
  assert.match(config.warnings[0]!, /商品表.*奖励ID.*number/);
});

test('XLSX 多表往返保留数据、类型、中文标签及已有映射', async () => {
  const config = validateConfiguration({ tables: [
    { id: 'main', name: '流程表', fields: [{ key: 'id', label: '编号', type: 'string', required: true }, { key: 'cost', label: '消耗', type: 'number' }, { key: 'enabled', label: '启用', type: 'boolean' }], rows: [{ id: '001', cost: 2.5, enabled: true }, { id: '=literal', cost: 0, enabled: false }], pacing: { label: 'id', cost: 'cost' } },
    { id: 'rewards', name: '奖励表', fields: [{ key: 'reward', label: '奖励串', type: 'string' }], rows: [{ reward: '10001|3_10002|3' }], pacing: {} }
  ], primaryTableId: 'main' });
  const parsed = await importXlsx(await exportXlsx(config), config);
  assert.deepEqual(parsed, config);
  const fresh = await importXlsx(await exportXlsx(config));
  assert.equal(fresh.tables![0]!.rows[0]!.id, '001');
  assert.equal(fresh.tables![0]!.rows[1]!.id, '=literal');
});

test('XLSX 标准表头、类型在前、文本 ID 和公式缓存', async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('items');
  sheet.addRows([['id', 'value'], ['001', 1], ['123', { formula: '1+2', result: 3 }]]);
  const second = workbook.addWorksheet('typed');
  second.addRows([['编号', '消耗'], ['String', 'Number'], ['id', 'cost'], ['001', 3]]);
  const config = await importXlsx(Buffer.from(await workbook.xlsx.writeBuffer()));
  assert.equal(config.tables![0]!.rows[0]!.id, '001'); assert.equal(config.tables![0]!.rows[1]!.value, 3);
  assert.equal(config.tables![1]!.rows[0]!.id, '001'); assert.equal(config.tables![1]!.rows[0]!.cost, 3);
});

test('XLSX 无缓存公式、错误值、损坏及空工作簿给出明确错误', async () => {
  const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet('items');
  sheet.addRows([['id'], [{ formula: '1+1' }]]);
  await assert.rejects(importXlsx(Buffer.from(await workbook.xlsx.writeBuffer())), /items.*公式没有计算结果/);
  sheet.getCell('A2').value = { error: '#DIV/0!' };
  await assert.rejects(importXlsx(Buffer.from(await workbook.xlsx.writeBuffer())), /items.*Excel 错误/);
  await assert.rejects(importXlsx(Buffer.from('broken')));
  await assert.rejects(importXlsx(Buffer.from(await new ExcelJS.Workbook().xlsx.writeBuffer())), /工作簿为空/);
});

test('配置接口无需模型可读 Word 表格，XLSX 预览不修改已存数据，保存后整组导出', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'config-xlsx-'));
  const store = new JsonPersistenceStore(join(dir, 'runtime.json'));
  const server = createApiServer({ store, encryptionSecret: 'test' });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('listen');
  const base = `http://127.0.0.1:${address.port}`;
  t.after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); await rm(dir, { recursive: true, force: true }); });
  const call = async (path: string, method = 'GET', value?: unknown) => { const res = await fetch(base + path, { method, ...(value ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) } : {}) }); const data = await res.json() as any; assert.ok(res.ok, JSON.stringify(data)); return data; };
  const activity = await call('/api/activities', 'POST', { name: '配置测试', type: 'race', productId: 'mc', markdown: '# 原稿' });
  const path = '/api/activities/' + activity.id;
  await call(path + '/confirm/source', 'POST', { expectedUpdatedAt: activity.artifacts.source.updatedAt });
  await call(path + '/artifacts/document', 'PUT', { content: document, kind: 'markdown', mimeType: 'text/markdown', fileName: 'document.md' });
  const draft = await call(path + '/configuration/generate', 'POST');
  assert.equal(draft.tables.length, 3);
  const form = new FormData(); form.append('file', new Blob([new Uint8Array(await exportXlsx(draft))]), 'configuration.xlsx');
  const response = await fetch(base + path + '/configuration/import', { method: 'POST', body: form });
  assert.equal(response.status, 200); const uploaded = await response.json() as any;
  assert.equal(uploaded.tables.length, 3); assert.equal((await call(path)).configuration, undefined);
  await call(path + '/configuration', 'PUT', { configuration: uploaded, expectedRevision: 0 });
  const download = await fetch(base + path + '/configuration?format=xlsx'); assert.equal(download.status, 200);
  assert.equal((await importXlsx(Buffer.from(await download.arrayBuffer()))).tables?.length, 3);
});
