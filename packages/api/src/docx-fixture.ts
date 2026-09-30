import { deflateSync } from 'node:zlib';

function crc32(data: Buffer) { let crc = 0xffffffff; for (const byte of data) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); } return (crc ^ 0xffffffff) >>> 0; }
function chunk(type: string, data: Buffer) { const name = Buffer.from(type), result = Buffer.alloc(data.length + 12); result.writeUInt32BE(data.length); name.copy(result, 4); data.copy(result, 8); result.writeUInt32BE(crc32(Buffer.concat([name, data])), data.length + 8); return result; }
export function fixturePng() {
  const width = 240, height = 120, pixels = Buffer.alloc((width * 3 + 1) * height), header = Buffer.alloc(13);
  header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const at = y * (width * 3 + 1) + 1 + x * 3; const accent = x > 40 && x < 200 && y > 30 && y < 90; pixels[at] = accent ? 40 : 225; pixels[at + 1] = accent ? 128 : 243; pixels[at + 2] = accent ? 96 : 231; }
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
}
export function fixtureZip(entries: Record<string, Buffer | string>) {
  const bodies: Buffer[] = [], directory: Buffer[] = []; let offset = 0;
  for (const [name, value] of Object.entries(entries)) {
    const fileName = Buffer.from(name), bytes = Buffer.isBuffer(value) ? value : Buffer.from(value), crc = crc32(bytes);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt32LE(crc, 14); local.writeUInt32LE(bytes.length, 18); local.writeUInt32LE(bytes.length, 22); local.writeUInt16LE(fileName.length, 26);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt32LE(crc, 16); central.writeUInt32LE(bytes.length, 20); central.writeUInt32LE(bytes.length, 24); central.writeUInt16LE(fileName.length, 28); central.writeUInt32LE(offset, 42);
    bodies.push(local, fileName, bytes); directory.push(central, fileName); offset += local.length + fileName.length + bytes.length;
  }
  const index = Buffer.concat(directory), end = Buffer.alloc(22), count = Object.keys(entries).length;
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(count, 8); end.writeUInt16LE(count, 10); end.writeUInt32LE(index.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...bodies, index, end]);
}
export function docxFixture() {
  return fixtureZip({
    '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    '_rels/.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/_rels/document.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="image1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/><Relationship Id="unsafe" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="javascript:alert(1)" TargetMode="External"/></Relationships>',
    'word/document.xml': `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>
      <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Word 图文导入验证</w:t></w:r></w:p><w:p><w:r><w:t>玩家收集材料后合成宝箱，奖励需要手动领取。</w:t></w:r></w:p>
      <w:p><w:r><w:drawing><wp:inline><wp:extent cx="2286000" cy="1143000"/><wp:docPr id="1" name="测试场景" descr="绿色活动场景"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:blipFill><a:blip r:embed="image1"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>
      <w:tbl><w:tr><w:tc><w:p><w:r><w:t>节点</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>奖励</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>领取宝箱</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>100 金币</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
      <w:p><w:hyperlink r:id="unsafe"><w:r><w:t>无效脚本链接应被清理</w:t></w:r></w:hyperlink></w:p>
    </w:body></w:document>`,
    'word/media/image1.png': fixturePng()
  });
}
