export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `请求失败 ${response.status}`);
  return data;
}
