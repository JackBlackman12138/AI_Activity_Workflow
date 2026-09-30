import React from 'react';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { SourceImage } from '@ai-activity-studio/shared';

export function SourcePreview({ content, images = [] }: { content: string; images?: SourceImage[] }) {
  return <div className="source-preview"><ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={url => url.startsWith('attachment:') ? url : defaultUrlTransform(url)} components={{
    img: ({ src, alt }) => {
      const image = images.find(item => src === `attachment:${item.id}`);
      return image ? <img src={`data:${image.mimeType};base64,${image.base64}`} alt={alt || image.name} /> : <span className="source-image-missing">[图片未导入：{alt || '请检查原文件'}]</span>;
    },
    a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
  }}>{content}</ReactMarkdown></div>;
}
