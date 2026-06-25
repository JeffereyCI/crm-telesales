/**
 * Auth store (Svelte 5 runes).
 *
 * Model backend: SATU Bearer JWT, tanpa refresh token. Maka:
 *  - Token disimpan in-memory + dicermin ke sessionStorage agar TAHAN reload
 *    halaman (tanpa ini, refresh = sesi hilang). sessionStorage dipilih ketimbang
 *    localStorage agar sesi otomatis berakhir saat tab/browser ditutup.
 *  - Saat token kedaluwarsa (cek `exp`) → anggap tidak terautentikasi.
 *
 * ⚠️ Trade-off keamanan: token di sessionStorage rentan XSS. Mitigasi: Svelte
 * auto-escape, CSP ketat, hindari `{@html}` dari data tak tepercaya. Tanpa
 * HttpOnly cookie di backend, ini kompromi yang wajar untuk scope ini.
 */
import { browser } from '$app/environment';
import { decodeToken, isTokenExpired } from '$lib/utils/jwt';
import type { Role } from '$lib/constants/enums';
import type { AuthUser } from '$lib/types/api';

const STORAGE_KEY = 'crm.session';

interface PersistedSession {
	token: string;
	user: AuthUser;
}

function loadPersisted(): PersistedSession | null {
	if (!browser) return null;
	try {
		const raw = sessionStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as PersistedSession;
		if (!parsed?.token || isTokenExpired(parsed.token)) {
			sessionStorage.removeItem(STORAGE_KEY);
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

class AuthStore {
	token = $state<string | null>(null);
	user = $state<AuthUser | null>(null);

	// Turunan reaktif
	isAuthenticated = $derived(!!this.token && !isTokenExpired(this.token));
	role = $derived<Role | null>(this.user?.role ?? null);

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
			sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user }));
		}
	}

	/** Hapus sesi (logout, atau saat 401/expired). */
	clear() {
		this.token = null;
		this.user = null;
		if (browser) sessionStorage.removeItem(STORAGE_KEY);
	}

	/** Validasi cepat token saat ini (dipakai guard). */
	get expired(): boolean {
		return isTokenExpired(this.token);
	}

	/** Payload JWT ter-decode (UX only, mis. cek exp/role). */
	get claims() {
		return decodeToken(this.token);
	}
}

export const auth = new AuthStore();
