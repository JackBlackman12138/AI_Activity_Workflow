import React, { useRef, useState } from 'react';
import type { SourceImage } from '@ai-activity-studio/shared';

async function referenceImage(file:File):Promise<SourceImage> {
  if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('支持 PNG、JPG、WebP 图片');
  if(file.size>8*1024*1024)throw Error('原图请控制在 8 MB 以内');
  const bitmap=await createImageBitmap(file);
  let blob:Blob=file;
  try {
    if(bitmap.width>2048||bitmap.height>2048||file.size>2*1024*1024){
      const scale=Math.min(1,2048/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
      canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);
      blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('图片处理失败')),'image/webp',0.92));
    }
  }finally{bitmap.close();}
  if(blob.size>2*1024*1024)throw Error('图片处理后仍超过 2 MB，请裁剪需要修改的区域');
  const url=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error('图片读取失败'));reader.readAsDataURL(blob);});
  return {id:crypto.randomUUID(),name:(file.name||'粘贴图片').slice(0,160),mimeType:blob.type,base64:url.split(',')[1]!};
}

export function RefineChat({modelName,instruction,onInstruction,disabled,onSend}:{modelName:string;instruction:string;onInstruction:(value:string)=>void;disabled:boolean;onSend:(instruction:string,images:SourceImage[])=>Promise<boolean>}) {
  const [images,setImages]=useState<SourceImage[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(false);
  const picker=useRef<HTMLInputElement>(null),loadingRef=useRef(false);
  const add=async(files:File[])=>{
    if(disabled||loadingRef.current)return;
    setError('');if(images.length+files.length>4){setError('每次最多附 4 张参考图片');return;}
    loadingRef.current=true;setLoading(true);
    try{const added=await Promise.all(files.map(referenceImage));setImages(current=>[...current,...added]);}
    catch(error){setError((error as Error).message);}finally{loadingRef.current=false;setLoading(false);}
  };
  const send=async()=>{setError('');if(await onSend(instruction,images))setImages([]);};
  return <div className="ai-chat" onPaste={event=>{
    const files=[...event.clipboardData.items].filter(item=>item.kind==='file'&&item.type.startsWith('image/')).map(item=>item.getAsFile()).filter((file):file is File=>Boolean(file));
    if(files.length){event.preventDefault();void add(files);}
  }}>
    <div className="ai-chat-heading"><b>与 AI 交流修改</b><span>{modelName}</span></div>
    <textarea aria-label="AI 修改要求" rows={4} value={instruction} onChange={e=>onInstruction(e.target.value)} placeholder="描述想调整的场景、界面或交互；可粘贴截图、草图并说明参考哪一部分…" disabled={disabled}/>
    <input hidden ref={picker} type="file" accept="image/png,image/jpeg,image/webp" multiple aria-label="上传修改参考图片" onChange={event=>{const files=[...(event.target.files??[])];event.target.value='';void add(files);}}/>
    <div className="reference-actions"><button disabled={disabled||loading||images.length>=4} onClick={()=>picker.current?.click()}>{loading?'正在处理图片…':'上传参考图片'}</button><small>支持 Ctrl+V 粘贴 · 最多 4 张 · 需使用支持识图的模型</small></div>
    {!!images.length&&<div className="reference-images">{images.map((image,index)=><figure key={image.id}><img src={`data:${image.mimeType};base64,${image.base64}`} alt={`参考图 ${index+1}：${image.name}`}/><figcaption>图 {index+1} · {image.name}</figcaption><button disabled={disabled||loading} aria-label={`移除参考图 ${index+1}`} onClick={()=>setImages(current=>current.filter(item=>item.id!==image.id))}>移除</button></figure>)}</div>}
    {error&&<p className="data-warning" role="alert">{error}</p>}
    <div className="ai-chat-footer"><small>按文字与参考图局部修改，保留其他玩法；完成后检查并更新预览</small><button className="primary" disabled={disabled||loading||!instruction.trim()} onClick={()=>void send()}>发送并应用 ↗</button></div>
  </div>;
}
