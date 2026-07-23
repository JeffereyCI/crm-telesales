/**
 * Auth store (Svelte 5 runes).
 *
 * Model backend: SATU Bearer JWT, tanpa refresh token (lihat
 * internal/middleware/auth.go → otentikasi via header `Authorization: Bearer`).
 *
 * Penyimpanan sesi: COOKIE `crm.session` dengan atribut:
 *   - `SameSite=Strict` (anti-CSRF), `Path=/`, dan `Secure` saat HTTPS.
 *   - `Max-Age` selaras `exp` JWT → cookie ikut kedaluwarsa bersama token.
 *
 * ⚠️ Catatan keamanan (penting & jujur): cookie ini TIDAK `HttpOnly`.
 *    HttpOnly hanya bisa di-set server lewat Set-Cookie & dibaca di server.
 *    Backend di sini autentikasi lewat header Bearer (bukan cookie), sehingga
 *    frontend WAJIB bisa membaca token untuk melampirkannya ke setiap request →
 *    token harus tetap dapat diakses JavaScript. Untuk HttpOnly penuh, backend
 *    perlu beralih ke auth berbasis cookie + Set-Cookie (di luar scope FE).
 *    Mitigasi XSS yang dipakai: Svelte auto-escape, hindari `{@html}` dari data
 *    tak tepercaya, secure headers backend (middleware/secure_headers.go).
 */
import { browser } from '$app/environment';
import { decodeToken, isTokenExpired } from '$lib/utils/jwt';
import { getCookie, setCookie, deleteCookie } from '$lib/utils/cookies';
import type { Role } from '$lib/constants/enums';
import type { AuthUser } from '$lib/types/api';

const COOKIE_KEY = 'crm.session';

interface PersistedSession {
	token: string;
	user: AuthUser;
}

function loadPersisted(): PersistedSession | null {
	if (!browser) return null;
	try {
		const raw = getCookie(COOKIE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as PersistedSession;
		if (!parsed?.token || isTokenExpired(parsed.token)) {
			deleteCookie(COOKIE_KEY);
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

/** Sisa umur token (detik) dari klaim `exp`, untuk Max-Age cookie. */
function secondsUntilExpiry(token: string): number | undefined {
	const claims = decodeToken(token);
	if (!claims?.exp) return undefined;
	const remaining = claims.exp - Math.floor(Date.now() / 1000);
	return remaining > 0 ? remaining : 0;
}

class AuthStore {
	token = $state<string | null>(null);
	user = $state<AuthUser | null>(null);

	// Turunan reaktif.
	isAuthenticated = $derived(!!this.token && !isTokenExpired(this.token));
	// `role` DIAMBIL DARI KLAIM JWT (token), bukan dari objek `user` di cookie.
	// Token ditandatangani backend, jadi role ini selalu selaras dengan yang akan
	// ditegakkan RBAC backend. Mengubah payload token untuk memalsukan role akan
	// merusak signature → request berikutnya dibalas 401 → auto-logout. Objek `user`
	// (JSON di cookie, bisa disunting) hanya dipakai untuk tampilan nama/email.
	role = $derived<Role | null>(this.claims?.role ?? null);

	constructor() {
		const persisted = loadPersisted();
		if (persisted) {
			this.token = persisted.token;
			this.user = persisted.user;
		}
	}

	/** Set sesi setelah login berhasil. */
	setSession(token: string, user: AuthUser) {
		this.token = token;
		this.user = user;
		if (browser) {
			setCookie(COOKIE_KEY, JSON.stringify({ token, user }), {
				maxAgeSeconds: secondsUntilExpiry(token)
			});
		}
	}

	/** Hapus sesi (logout, atau saat 401/expired). */
	clear() {
		this.token = null;
		this.user = null;
		if (browser) deleteCookie(COOKIE_KEY);
	}

	/** Validasi cepat token saat ini (dipakai guard). */
	get expired(): boolean {
		return isTokenExpired(this.token);
	}

	/**
	 * Payload JWT ter-decode. Signature TIDAK diverifikasi di klien (otorisasi
	 * sebenarnya 100% di backend), tapi ini dipakai sebagai sumber tunggal untuk
	 * `role` & `exp` karena isinya selaras dengan yang ditegakkan backend.
	 */
	get claims() {
		return decodeToken(this.token);
	}
}

export const auth = new AuthStore();
