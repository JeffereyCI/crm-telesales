/**
 * Helper cookie sisi-klien (browser).
 *
 * Catatan keamanan penting:
 *  Backend CRM Telesales mengautentikasi via header `Authorization: Bearer <token>`
 *  (lihat internal/middleware/auth.go) dan TIDAK membaca cookie. Karena itu token
 *  HARUS bisa dibaca JavaScript untuk dilampirkan ke header → cookie TIDAK bisa
 *  `HttpOnly` (HttpOnly hanya bisa di-set server lewat Set-Cookie & dibaca di server).
 *
 *  Yang BISA kita terapkan dari frontend sebagai best practice:
 *   - `Secure`   : hanya dikirim lewat HTTPS (otomatis aktif saat protokol https).
 *   - `SameSite=Strict` : cookie tak ikut terkirim pada navigasi lintas-situs (anti-CSRF).
 *   - `Path=/`   : berlaku seluruh aplikasi.
 *   - `Max-Age`  : kedaluwarsa selaras `exp` JWT (sesi berakhir bersama token).
 */
import { browser } from '$app/environment';

interface CookieOptions {
	/** Umur cookie dalam detik. Tanpa ini → cookie sesi (hapus saat browser tutup). */
	maxAgeSeconds?: number;
	path?: string;
	sameSite?: 'Strict' | 'Lax' | 'None';
}

/** Apakah konteks aman (https atau localhost) → boleh pasang atribut Secure. */
function isSecureContextHost(): boolean {
	if (!browser) return false;
	return location.protocol === 'https:';
}

export function setCookie(name: string, value: string, opts: CookieOptions = {}): void {
	if (!browser) return;
	const { maxAgeSeconds, path = '/', sameSite = 'Strict' } = opts;
	let cookie = `${name}=${encodeURIComponent(value)}; Path=${path}; SameSite=${sameSite}`;
	if (maxAgeSeconds !== undefined) cookie += `; Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`;
	if (isSecureContextHost() || sameSite === 'None') cookie += '; Secure';
	document.cookie = cookie;
}

export function getCookie(name: string): string | null {
	if (!browser) return null;
	const prefix = `${name}=`;
	const parts = document.cookie ? document.cookie.split('; ') : [];
	for (const part of parts) {
		if (part.startsWith(prefix)) return decodeURIComponent(part.slice(prefix.length));
	}
	return null;
}

export function deleteCookie(name: string, path = '/'): void {
	if (!browser) return;
	document.cookie = `${name}=; Path=${path}; Max-Age=0; SameSite=Strict`;
}
