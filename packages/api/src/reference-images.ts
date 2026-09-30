import type { SourceImage } from '@ai-activity-studio/shared';

export function readReferenceImages(value: unknown): SourceImage[] {
  if(value===undefined)return [];
  if(!Array.isArray(value)||value.length>4)throw Error('参考图片最多 4 张');
  return value.map((image,index)=>{
    if(!image||typeof image.name!=='string'||!image.name.trim()||image.name.length>160||typeof image.base64!=='string'||image.base64.length>2_796_204||!image.base64.length||image.base64.length%4||!/^[A-Za-z0-9+/]+={0,2}$/.test(image.base64))throw Error('参考图片格式无效或超过 2 MB');
    const bytes=Buffer.from(image.base64,'base64');
    const valid=image.mimeType==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):image.mimeType==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:image.mimeType==='image/webp'?bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP':false;
    if(!valid||bytes.length>2_097_152||bytes.toString('base64')!==image.base64)throw Error('请上传有效的 PNG、JPG 或 WebP 图片，每张不超过 2 MB');
    return {id:'reference-'+(index+1),name:image.name,mimeType:image.mimeType,base64:image.base64};
  });
}
