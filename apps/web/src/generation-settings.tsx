import React, { useEffect, useState, type FormEvent } from 'react';
import { DEFAULT_GENERATION_SETTINGS, type GenerationSettings } from '@ai-activity-studio/shared';
import { api } from './api';

export function GenerationSettingsPanel({ toast }: { toast: (message: string, error?: boolean) => void }) {
  const [minutes,setMinutes] = useState(String(DEFAULT_GENERATION_SETTINGS.idleTimeoutMinutes));
  const [unlimited,setUnlimited] = useState(false);
  const [loaded,setLoaded] = useState(false);
  const [busy,setBusy] = useState(false);
  useEffect(()=>{void api<GenerationSettings>('/api/generation-settings').then(value=>{setUnlimited(value.idleTimeoutMinutes===0);setMinutes(String(value.idleTimeoutMinutes||30));setLoaded(true);}).catch(error=>toast(error.message,true));},[]);
  async function save(event: FormEvent) {
    event.preventDefault();setBusy(true);
    try { await api('/api/generation-settings',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({idleTimeoutMinutes:unlimited?0:Number(minutes)})});toast('等待设置已保存，下次生成任务生效'); }
    catch(error) { toast((error as Error).message,true); }
    finally { setBusy(false); }
  }
  return <section className="page generation-settings" aria-label="模型生成设置"><header><div><span className="eyebrow">GENERATION</span><h1>模型生成设置</h1><p>持续收到网关数据就继续等待，不限制生成总时长。</p></div></header><form onSubmit={save}>
    <label>最长等待时间<select aria-label="等待方式" disabled={!loaded||busy} value={unlimited?'unlimited':'limited'} onChange={event=>setUnlimited(event.target.value==='unlimited')}><option value="limited">限制连续无响应时长</option><option value="unlimited">不限时</option></select></label>
    {!unlimited&&<label>连续无响应时限（分钟）<input type="number" min="1" step="1" required value={minutes} disabled={!loaded||busy} onChange={event=>setMinutes(event.target.value)}/></label>}
    <p>默认 30 分钟；收到网关内容或心跳就重新计时。不限时模式由你手动暂停，或由网关返回结束/错误。设置适用于后续生成请求，不改变正在运行的任务；公司网关自身的超时仍可能提前终止请求。</p>
    <button className="primary" disabled={!loaded||busy}>{busy?'保存中…':'保存等待设置'}</button>
  </form></section>;
}
