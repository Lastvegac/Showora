import type { ApiErrorEnvelope, AuthResponse } from '@showora/shared-types';
let accessToken: string | null = null;
let csrfToken: string | null = null;
let csrfPromise: Promise<string> | null = null;
let refreshPromise: Promise<void> | null = null;
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
  }
}
export function setAccessToken(token: string | null) {
  accessToken = token;
}
async function csrf() {
  if (csrfPromise) return csrfPromise;
  csrfPromise = loadCsrf().finally(() => {
    csrfPromise = null;
  });
  return csrfPromise;
}
async function loadCsrf() {
  if (!csrfToken) {
    const response = await fetch('/api/v1/auth/csrf', { credentials: 'same-origin' });
    if (!response.ok)
      throw new HttpError(
        response.status,
        'UNAVAILABLE',
        'Không kết nối được với không gian doanh nghiệp.',
      );
    csrfToken = ((await response.json()) as { csrfToken: string }).csrfToken;
  }
  return csrfToken;
}
async function request<T>(path: string, options: RequestInit): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  if (options.method && !['GET', 'HEAD'].includes(options.method))
    headers.set('X-CSRF-Token', await csrf());
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, { ...options, headers, credentials: 'same-origin' });
  } catch {
    throw new HttpError(0, 'OFFLINE', 'Không thể kết nối máy chủ. Kiểm tra kết nối và thử lại.');
  }
  if (response.status === 204) return undefined as T;
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (body as ApiErrorEnvelope | null)?.error;
    throw new HttpError(
      response.status,
      error?.code ?? 'REQUEST_FAILED',
      error?.message ?? 'Không thể thực hiện yêu cầu.',
      error?.fieldErrors,
    );
  }
  return body as T;
}
export async function refreshSession() {
  const refresh = () =>
    request<AuthResponse>('/auth/refresh', { method: 'POST' }).then((value) => {
      accessToken = value.accessToken;
    });
  const coordinated = async () => {
    if (navigator.locks) await navigator.locks.request('showora:refresh', refresh);
    else await refresh();
  };
  if (!refreshPromise)
    refreshPromise = coordinated().finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  try {
    return await request<T>(path, options);
  } catch (error) {
    if (error instanceof HttpError && error.code === 'CSRF_INVALID') {
      csrfToken = null;
      return request<T>(path, options);
    }
    if (
      error instanceof HttpError &&
      error.status === 401 &&
      !path.startsWith('/auth/') &&
      !path.startsWith('/invitations/')
    ) {
      try {
        await refreshSession();
        return await request<T>(path, options);
      } catch {
        accessToken = null;
        window.dispatchEvent(new Event('showora:session-expired'));
        throw error;
      }
    }
    throw error;
  }
}
export const jsonBody = (value: unknown): RequestInit => ({
  method: 'POST',
  body: JSON.stringify(value),
});
export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Đã có lỗi xảy ra.';
