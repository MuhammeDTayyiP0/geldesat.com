import { API_BASE_URL } from '@/lib/config';
import { clearSession, getToken } from '@/auth/session';

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export const NETWORK_ERROR = 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.';

/** Header the site's upload routes require (see web/src/lib/listing-photos.ts). */
export const UPLOAD_HEADER = 'x-geldesat-upload';

type RequestOptions = {
  method?: 'GET' | 'POST' | 'DELETE' | 'PUT';
  body?: unknown;
  form?: FormData;
  headers?: Record<string, string>;
  /** Send the session token (default true when signed in). */
  auth?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
};

/**
 * JSON request to the GeldeSat API. Resolves with the parsed body; rejects with
 * an ApiError carrying the server's Turkish message. A 401 on an authenticated
 * call means the session ended elsewhere, so the app signs out locally.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', ...options.headers };
  const token = options.auth === false ? null : getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (options.form) {
    body = options.form;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 20_000);
  options.signal?.addEventListener('abort', () => controller.abort());

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? (body ? 'POST' : 'GET'),
      headers,
      body,
      signal: controller.signal,
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiError(NETWORK_ERROR, 0);
  } finally {
    clearTimeout(timeout);
  }

  const data = (await response.json().catch(() => null)) as
    | ({ success?: boolean; error?: string; message?: string } & Record<string, unknown>)
    | null;

  if (response.status === 401 && token) {
    void clearSession();
    throw new ApiError(data?.error || 'Oturumunuz sona erdi. Lütfen tekrar giriş yapın.', 401);
  }
  if (!response.ok || data?.success === false) {
    throw new ApiError(data?.error || data?.message || fallbackMessage(response.status), response.status);
  }
  return (data ?? {}) as T;
}

function fallbackMessage(status: number): string {
  if (status === 401) return 'Bu işlem için giriş yapın.';
  if (status === 403) return 'Bu işlem için yetkiniz yok.';
  if (status === 404) return 'Aradığınız içerik bulunamadı.';
  if (status === 413) return 'Dosya çok büyük.';
  if (status === 429) return 'Çok fazla istek. Lütfen biraz bekleyin.';
  if (status >= 500) return 'Sunucu şu an yanıt veremiyor. Lütfen biraz sonra tekrar deneyin.';
  return 'İşlem tamamlanamadı.';
}

/** Call a whitelisted server function through /api/mobile/rpc/<name>. */
export async function rpc<T>(name: string, data?: unknown): Promise<T> {
  const res = await request<{ result: T }>(`/api/mobile/rpc/${name}`, {
    method: 'POST',
    body: data === undefined ? {} : { data },
  });
  return res.result;
}

export function errorMessage(error: unknown, fallback = 'Bir şeyler ters gitti.'): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/** Turn filters into a query string, skipping empty values. */
export function toQuery(params: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === false) continue;
    const encoded = typeof value === 'object' ? JSON.stringify(value) : String(value);
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(encoded)}`);
  }
  return parts.length ? `?${parts.join('&')}` : '';
}
