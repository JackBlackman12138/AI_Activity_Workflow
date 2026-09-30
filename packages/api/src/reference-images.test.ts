import test from 'node:test';import assert from 'node:assert/strict';
import {readReferenceImages} from './reference-images.js';
const image={name:'场景草图.png',mimeType:'image/png',base64:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aM1sAAAAASUVORK5CYII='};
test('参考图保留图片内容，限制类型、数量和大小，拒绝伪造图片',()=>{
  assert.deepEqual(readReferenceImages(undefined),[]);
  assert.deepEqual(readReferenceImages([image]),[{id:'reference-1',...image}]);
  for(const value of [{},Array(5).fill(image),[{...image,mimeType:'image/svg+xml'}],[{...image,base64:Buffer.from('not an image').toString('base64')}],[{...image,base64:'a'.repeat(2_800_000)}]])assert.throws(()=>readReferenceImages(value));
});
