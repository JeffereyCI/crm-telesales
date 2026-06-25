/**
 * HTTP client terpusat (native fetch, tanpa dependency).
 *
 * Tanggung jawab:
 *  - Inject header `Authorization: Bearer <token>`.
 *  - Bangun query string dari objek filter (lewati nilai kosong).
 *  - Parse error backend `{ error, message, details? }` jadi `ApiError`.
 *  - 401 → bersihkan sesi + redirect ke /login (TIDAK ada silent refresh).
 *  - 429 → tandai rate-limit + sediakan `retryAfterSeconds` (default 60,
 *    karena backend tidak mengirim header `Retry-After`).
 *  - Dukung JSON, multipart (import), dan unduhan Blob (export/template).
 */
import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { env } from '$env/dynamic/public';
import { auth } from '$lib/stores/auth.svelte';
import type { ApiErrorBody } from '$lib/types/api';

const BASE_URL = (env.PUBLIC_API_BASE_URL ?? 'http://localhost:8080/api/v1').replace(/\/+$/, '');
const DEFAULT_RETRY_AFTER = 60;

export class ApiError extends Error {
	readonly status: number;
	readonly code: string; // field "error" dari backend
	readonly details?: string[];
	readonly isRateLimit: boolean;
	readonly retryAfterSeconds?: number;
	readonly isNetwork: boolean;

	constructor(opts: {
		status: number;
		code: string;
		message: string;
		details?: string[];
		isRateLimit?: boolean;
		retryAfterSeconds?: number;
		isNetwork?: boolean;
	}) {
		super(opts.message);
		this.name = 'ApiError';
		this.status = opts.status;
		this.code = opts.code;
		this.details = opts.details;
		this.isRateLimit = opts.isRateLimit ?? false;
		this.retryAfterSeconds = opts.retryAfterSeconds;
		this.isNetwork = opts.isNetwork ?? false;
	}
}

export interface RequestOptions {
	query?: Record<string, unknown>;
	body?: unknown; // dikirim sebagai JSON
	formData?: FormData; // multipart (mengabaikan body)
	responseType?: 'json' | 'blob';
	auth?: boolean; // lampirkan Bearer (default true)
	signal?: AbortSignal;
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

function buildQuery(query?: Record<string, unknown>): string {
	if (!query) return '';
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(query)) {
		if (value === undefined || value === null || value === '') continue;
		params.append(key, String(value));
	}
	const qs = params.toString();
	return qs ? `?${qs}` : '';
}

async function parseError(res: Response): Promise<ApiError> {
	let body: Partial<ApiErrorBody> = {};
	try {
		body = (await res.json()) as ApiErrorBody;
	} catch {
		/* response bukan JSON */
	}
	const isRateLimit = res.status === 429;
	let retryAfterSeconds: number | undefined;
	if (isRateLimit) {
		const header = res.headers.get('Retry-After');
		retryAfterSeconds = header ? Number(header) || DEFAULT_RETRY_AFTER : DEFAULT_RETRY_AFTER;
	}
	return new ApiError({
		status: res.status,
		code: body.error ?? `HTTP_${res.status}`,
		message: body.message ?? defaultMessage(res.status),
		details: body.details,
		isRateLimit,
		retryAfterSeconds
	});
}

function defaultMessage(status: number): string {
	switch (status) {
		case 400:
			return 'Permintaan tidak valid.';
		case 401:
			return 'Sesi berakhir. Silakan login kembali.';
		case 403:
			return 'Anda tidak memiliki akses untuk tindakan ini.';
		case 404:
			return 'Data tidak ditemukan.';
		case 409:
			return 'Data sudah ada / konflik.';
		case 429:
			return 'Terlalu banyak permintaan. Coba lagi sebentar.';
		case 500:
			return 'Terjadi kesalahan pada server.';
		default:
			return 'Terjadi kesalahan.';
	}
}

/** Tangani 401: bersihkan sesi & arahkan ke login (sekali, di browser). */
function handleUnauthorized() {
	auth.clear();
	if (browser && !location.pathname.startsWith('/login')) {
		// Path literal disengaja: route /login dibuat di tahap UI berikutnya.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		void goto('/login?session=expired');
	}
}

async function request<T>(method: Method, path: string, opts: RequestOptions = {}): Promise<T> {
	const useAuth = opts.auth ?? true;

	// Cegat lebih awal bila token sudah kedaluwarsa (hemat round-trip).
	if (useAuth && auth.expired) {
		handleUnauthorized();
		throw new ApiError({ status: 401, code: 'TOKEN_EXPIRED', message: defaultMessage(401) });
	}

	const headers: Record<string, string> = { Accept: 'application/json' };
	if (useAuth && auth.token) headers.Authorization = `Bearer ${auth.token}`;

	let payload: BodyInit | undefined;
	if (opts.formData) {
		payload = opts.formData; // jangan set Content-Type (browser atur boundary)
	} else if (opts.body !== undefined) {
		headers['Content-Type'] = 'application/json';
		payload = JSON.stringify(opts.body);
	}

	const url = `${BASE_URL}${path}${buildQuery(opts.query)}`;

	let res: Response;
	try {
		res = await fetch(url, { method, headers, body: payload, signal: opts.signal });
	} catch (err) {
		if (err instanceof DOMException && err.name === 'AbortError') throw err;
		throw new ApiError({
			status: 0,
			code: 'NETWORK_ERROR',
			message: 'Tidak dapat terhubung ke server. Periksa koneksi Anda.',
			isNetwork: true
		});
	}

	if (res.status === 401) {
		handleUnauthorized();
		throw await parseError(res);
	}
	if (!res.ok) throw await parseError(res);

	// Sukses
	if (opts.responseType === 'blob') return (await res.blob()) as T;
	if (res.status === 204) return undefined as T;
	const text = await res.text();
	return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
	get: <T>(path: string, opts?: RequestOptions) => request<T>('GET', path, opts),
	post: <T>(path: string, opts?: RequestOptions) => request<T>('POST', path, opts),
	put: <T>(path: string, opts?: RequestOptions) => request<T>('PUT', path, opts),
	patch: <T>(path: string, opts?: RequestOptions) => request<T>('PATCH', path, opts),
	del: <T>(path: string, opts?: RequestOptions) => request<T>('DELETE', path, opts)
};

/** Helper unduh Blob (export laporan / template import). */
export async function downloadFile(
	path: string,
	filename: string,
	opts?: RequestOptions
): Promise<void> {
	const blob = await request<Blob>('GET', path, { ...opts, responseType: 'blob' });
	if (!browser) return;
	const href = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = href;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(href);
}
