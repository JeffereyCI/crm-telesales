/**
 * Theme store (Svelte 5 runes) — mode terang/gelap.
 *
 * - Preferensi disimpan di cookie `crm.theme` (1 tahun) agar konsisten lintas tab/reload.
 * - Jika belum pernah dipilih, ikut preferensi sistem (prefers-color-scheme).
 * - Menerapkan class `.dark` pada <html> (dibaca @custom-variant dark di layout.css).
 *
 * Catatan: app.html juga punya skrip inline kecil yang menerapkan class lebih awal
 * (sebelum hydration) untuk mencegah "flash" tema yang salah saat reload.
 */
import { browser } from '$app/environment';
import { getCookie, setCookie } from '$lib/utils/cookies';

export type Theme = 'light' | 'dark';

const COOKIE_KEY = 'crm.theme';
const ONE_YEAR = 60 * 60 * 24 * 365;

function systemPrefersDark(): boolean {
	return browser && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function initialTheme(): Theme {
	const saved = getCookie(COOKIE_KEY);
	if (saved === 'light' || saved === 'dark') return saved;
	return systemPrefersDark() ? 'dark' : 'light';
}

function apply(theme: Theme): void {
	if (!browser) return;
	document.documentElement.classList.toggle('dark', theme === 'dark');
}

class ThemeStore {
	current = $state<Theme>('light');

	constructor() {
		if (browser) {
			this.current = initialTheme();
			apply(this.current);
		}
	}

	get isDark(): boolean {
		return this.current === 'dark';
	}

	set(theme: Theme) {
		this.current = theme;
		apply(theme);
		setCookie(COOKIE_KEY, theme, { maxAgeSeconds: ONE_YEAR });
	}

	toggle() {
		this.set(this.current === 'dark' ? 'light' : 'dark');
	}
}

export const theme = new ThemeStore();
