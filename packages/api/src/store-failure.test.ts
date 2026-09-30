import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { JsonPersistenceStore, replaceFileWithRetry, type PersistenceStore } from './store.js';
import { createApiServer } from './server.js';

test('Windows 短暂文件占用重试后原子替换，不提前破坏旧数据', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'store-lock-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const source = join(dir, 'pending.tmp'), destination = join(dir, 'runtime.json');
  await writeFile(source, 'new-data'); await writeFile(destination, 'old-data');
  let attempts = 0;
  await replaceFileWithRetry(source, destination, async (from, to) => {
    assert.equal(await readFile(destination, 'utf8'), 'old-data');
    if (++attempts <= 2) throw Object.assign(new Error('locked'), { code: 'EPERM' });
    await rename(from, to);
  });
  assert.equal(attempts, 3);
  assert.equal(await readFile(destination, 'utf8'), 'new-data');
});

test('持久占用有重试上限，非占用错误立即返回', async () => {
  let attempts = 0;
  await assert.rejects(replaceFileWithRetry('from', 'to', async () => { attempts++; throw Object.assign(new Error('locked'), { code: 'EBUSY' }); }), { code: 'EBUSY' });
  assert.equal(attempts, 6);
  attempts = 0;
  await assert.rejects(replaceFileWithRetry('from', 'to', async () => { attempts++; throw Object.assign(new Error('full'), { code: 'ENOSPC' }); }), { code: 'ENOSPC' });
  assert.equal(attempts, 1);
});

test('后台任务连失败状态都无法保存时 API 仍存活，解除占用后可暂停', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'job-store-failure-'));
  const backing = new JsonPersistenceStore(join(dir, 'runtime.json'));
  let failWrites = false;
  const store: PersistenceStore = { read: () => backing.read(), update: mutate => failWrites ? Promise.reject(Object.assign(new Error('locked'), { code: 'EPERM' })) : backing.update(mutate) };
  let scheduled: (() => void) | undefined;
  let stopped!: () => void;
  const failureHandled = new Promise<void>(resolve => { stopped = resolve; });
  t.mock.method(console, 'error', () => stopped());
  const server = createApiServer({ store, schedule: task => { scheduled = task; } });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('listen failed');
  const base = `http://127.0.0.1:${address.port}`;
  t.after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); await rm(dir, { recursive: true, force: true }); });
  const post = async (path: string, data: unknown) => {
    const response = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
    return { status: response.status, data: await response.json() as any };
  };
  const activity = (await post('/api/activities', { name: '存储故障隔离', type: 'other', markdown: '# 已保存原稿' })).data;
  await post(`/api/activities/${activity.id}/confirm/source`, { expectedUpdatedAt: activity.artifacts.source.updatedAt });
  const created = await post('/api/generation-jobs', { activityId: activity.id, stage: 'document' });
  assert.equal(created.status, 201);
  failWrites = true;
  scheduled!();
  await failureHandled;
  assert.equal((await fetch(base + '/api/health')).status, 200);
  assert.equal((await fetch(base + `/api/activities/${activity.id}`)).status, 200);
  failWrites = false;
  const paused = await post(`/api/generation-jobs/${created.data.id}/pause`, {});
  assert.equal(paused.status, 200);
  assert.equal(paused.data.state, 'paused');
  assert.equal((await backing.read()).activities[0]?.markdown, '# 已保存原稿');
});
