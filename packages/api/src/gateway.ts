import { Agent } from 'undici';
import { activityImages, DEFAULT_GENERATION_SETTINGS } from '@ai-activity-studio/shared';
import type { ModelConfig, Activity, SourceImage } from '@ai-activity-studio/shared';
import { decryptSecret } from './crypto.js';
import type { StoredModelConfig } from './store.js';

export function selectModel(configs: StoredModelConfig[], modelId?: string) {
  if(modelId!==undefined)return configs.find(c=>c.id===modelId&&c.enabled);
  return configs.find(c => c.enabled && c.isDefault) ?? configs.find(c => c.enabled && c.provider !== 'demo') ?? configs.find(c => c.enabled);
}

export function gatewayUrl(config: Pick<ModelConfig, 'baseUrl' | 'fullUrl'>): string {
  if (!config.baseUrl) throw new Error('请填写模型请求地址');
  const url = new URL(config.baseUrl);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('请求地址必须是无账号密码的 HTTP/HTTPS URL');
  if (!config.fullUrl && !/\/chat\/completions\/?$/.test(url.pathname)) url.pathname = url.pathname.replace(/\/$/, '') + '/chat/completions';
  url.hash = '';
  return url.toString();
}

export type ChatMessage = { role: string; content: string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> };

export function withSourceImages(activity: Activity, text: string, source = text, references: SourceImage[] = []): ChatMessage {
  const images = [...activityImages(activity).filter(image => source.includes('attachment:' + image.id)),...references];
  if (!images.length) return { role: 'user', content: text };
  const content: Exclude<ChatMessage['content'], string> = [{ type: 'text', text }];
  const groups = new Map<string, typeof images>();
  for (const image of images) { const key = image.mimeType + ':' + image.base64; groups.set(key, [...(groups.get(key) ?? []), image]); }
  for (const group of groups.values()) { const image = group[0]!; content.push({ type: 'text', text: '图片参考：' + group.map(item => item.name+'（attachment:' + item.id+'）').join('、') }, { type: 'image_url', image_url: { url: 'data:' + image.mimeType + ';base64,' + image.base64 } }); }
  return { role: 'user', content };
}

export type GatewayProgress = { phase: 'waiting' | 'receiving'; characters: number; elapsedMs: number; firstContentMs?: number; lastEventAt: string };
// Override the transport's implicit header/body deadlines; the idle watchdog owns waiting.
const gatewayDispatcher = new Agent({ headersTimeout: 0, bodyTimeout: 0 }).compose(dispatch => (options, handler) => dispatch({ ...options, headersTimeout: 0, bodyTimeout: 0 }, handler));
export const gatewayFetch: typeof fetch = (input, init) => fetch(input, { ...init, dispatcher: gatewayDispatcher } as RequestInit);
export type ChatOptions = { stream?: boolean; idleTimeoutMs?: number; onProgress?: (progress: GatewayProgress) => Promise<void> };
class GatewayError extends Error {}

export async function requestChat(config: StoredModelConfig, messages: ChatMessage[], secret: string, fetchImpl: typeof fetch, signal?: AbortSignal, options: ChatOptions = {}): Promise<string> {
  if (!config.encryptedApiKey) throw new Error('请配置 API 密钥');
  const endpoint = gatewayUrl(config), started = Date.now();
  const idleMs = options.idleTimeoutMs ?? DEFAULT_GENERATION_SETTINGS.idleTimeoutMinutes * 60_000;
  if (!Number.isFinite(idleMs) || idleMs < 0) throw new Error('等待时限必须为非负数');
  const deadline = new AbortController();
  const combined = signal ? AbortSignal.any([signal, deadline.signal]) : deadline.signal;
  let timedOut = false, idle: ReturnType<typeof setTimeout> | undefined;
  let lastDataAt = Date.now();
  const checkIdle = () => {
    const remaining = idleMs - (Date.now() - lastDataAt);
    if (remaining <= 0) { timedOut = true; deadline.abort(); }
    else idle = setTimeout(checkIdle, Math.min(remaining, 2_147_483_647));
  };
  const touch = () => { clearTimeout(idle); lastDataAt = Date.now(); if (idleMs > 0) checkIdle(); };
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let content = '', firstContentMs: number | undefined;
  const progress = () => options.onProgress?.({ phase: content ? 'receiving' : 'waiting', characters: content.length, elapsedMs: Date.now() - started, firstContentMs, lastEventAt: new Date().toISOString() });
  const append = (text: unknown) => { if (typeof text === 'string' && text) { firstContentMs ??= Date.now() - started; content += text; if (content.length > 4_000_000) throw new GatewayError('模型产物过大，请缩小本次生成范围'); } };
  const finish = (reason: unknown) => {
    if (reason === 'length') throw new GatewayError('模型输出达到长度上限，Demo 尚未完整生成。请提高网关输出上限或缩小单次生成范围');
    if (reason === 'content_filter') throw new GatewayError('模型网关终止了本次输出，请核对输入内容');
    if (reason && reason !== 'stop') throw new GatewayError('模型未返回完整最终产物，请检查网关模型是否支持直接生成文本');
  };
  touch();
  try {
    const response = await fetchImpl(endpoint, { method: 'POST', signal: combined, headers: { 'content-type': 'application/json', authorization: `Bearer ${decryptSecret(config.encryptedApiKey, secret)}` }, body: JSON.stringify({ model: config.model, messages, stream: Boolean(options.stream) }) });
    combined.throwIfAborted();
    if (!response.ok) {
      const hint = response.status === 401 || response.status === 403 ? '请核对密钥及模型权限' : response.status === 429 ? '网关限流或额度不足，请稍后重试或检查额度' : response.status === 504 || response.status === 524 ? '网关自身等待超时，请联系网关管理员检查上游时限' : '请检查网关地址、模型 ID 或上游服务';
      throw new GatewayError(`模型网关请求失败（HTTP ${response.status}），${hint}`);
    }
    touch(); await progress();
    if (/text\/event-stream/i.test(response.headers.get('content-type') ?? '')) {
      if (!response.body) throw new GatewayError('模型网关返回空响应');
      reader = response.body.getReader();
      const decoder = new TextDecoder(); let pending = '', done = false, finished = false;
      const consume = (frame: string) => {
        const payload = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
        if (!payload) return;
        if (payload.trim() === '[DONE]') { done = true; return; }
        let packet: { error?: unknown; choices?: Array<{ index?: number; delta?: { content?: unknown }; finish_reason?: unknown }> };
        try { packet = JSON.parse(payload); } catch { throw new GatewayError('模型网关返回了无效流式数据'); }
        if (packet.error) throw new GatewayError('模型网关在生成过程中返回错误，本次产物未保存');
        const choice = packet.choices?.find(item => item.index === 0 || item.index === undefined);
        if (choice) { finish(choice.finish_reason); append(choice.delta?.content); if (choice.finish_reason === 'stop') finished = true; }
      };
      while (!done) {
        const chunk = await reader.read(); combined.throwIfAborted();
        if (chunk.done) break;
        touch(); pending += decoder.decode(chunk.value, { stream: true });
        pending = pending.replace(/\r\n/g, '\n');
        let boundary: number;
        while ((boundary = pending.indexOf('\n\n')) >= 0) { const frame = pending.slice(0, boundary); pending = pending.slice(boundary + 2); consume(frame); if (done) break; }
        if (pending.length > 4_000_000) throw new GatewayError('模型网关流式数据过大或格式无效');
        await progress();
      }
      pending += decoder.decode(); if (!done && pending.trim()) consume(pending);
      if (!done && !finished) throw new GatewayError('模型响应流提前断开，未收到完成标记，未保存不完整产物，请重试');
    } else {
      // Some compatible gateways ignore stream=true and return ordinary JSON.
      let parsed: { error?: unknown; choices?: Array<{ finish_reason?: unknown; message?: { content?: unknown } }> };
      try {
        if (!response.body) throw new Error('empty response');
        reader = response.body.getReader(); const decoder = new TextDecoder(); let text = '';
        while (true) {
          const chunk = await reader.read(); combined.throwIfAborted(); if (chunk.done) break;
          touch(); text += decoder.decode(chunk.value, { stream: true });
          if (text.length > 8_000_000) throw new GatewayError('模型网关响应过大');
          await progress();
        }
        parsed = JSON.parse(text + decoder.decode()) as typeof parsed;
      } catch (error) { if (combined.aborted || error instanceof GatewayError) throw error; throw new GatewayError('模型网关返回了无效 JSON'); }
      combined.throwIfAborted(); if (parsed.error) throw new GatewayError('模型网关返回错误，本次产物未保存');
      finish(parsed.choices?.[0]?.finish_reason); append(parsed.choices?.[0]?.message?.content); await progress();
    }
    if (!content.trim()) throw new GatewayError('模型网关未返回可保存内容');
    return content.trim();
  } catch (error) {
    if (signal?.aborted) throw new DOMException('请求已中断', 'AbortError');
    if (timedOut) throw new GatewayError(`连续 ${Math.round(idleMs / 1000)} 秒未收到网关数据，已停止请求；可在高级配置调整等待时限，或检查网关与上游模型`);
    if (error instanceof GatewayError) throw error;
    const code = (error as { cause?: { code?: string }; code?: string })?.cause?.code ?? (error as { code?: string })?.code;
    const hint = code === 'ENOTFOUND' ? '地址无法解析' : code === 'ECONNREFUSED' ? '连接被拒绝' : code === 'ECONNRESET' || code === 'UND_ERR_SOCKET' ? '连接被中途断开' : code?.includes('TIMEOUT') ? '网络连接等待超时' : '连接或响应读取失败';
    throw new GatewayError(`模型网关${hint}，请检查地址和网络（已等待 ${Math.round((Date.now() - started) / 1000)} 秒）`);
  } finally {
    clearTimeout(idle); deadline.abort();
    if (reader) { void reader.cancel().catch(() => {}); }
  }
}
