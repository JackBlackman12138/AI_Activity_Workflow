import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

function keyFromSecret(secret: string) { return createHash('sha256').update(secret).digest(); }
export function encryptSecret(plaintext: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFromSecret(secret), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join('.');
}
export function decryptSecret(value: string, secret: string): string {
  const [version, iv, tag, encrypted] = value.split('.');
  if (version !== 'v1' || !iv || !tag || !encrypted) throw new Error('无效的密钥密文');
  const decipher = createDecipheriv('aes-256-gcm', keyFromSecret(secret), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64')), decipher.final()]).toString('utf8');
}
export function fingerprint(value: string) { return createHash('sha256').update(value).digest('hex').slice(0, 12); }
