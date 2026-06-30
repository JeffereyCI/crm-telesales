/**
 * UI store (Svelte 5 runes) — preferensi tata letak shell aplikasi.
 *
 * - `sidebarCollapsed`: sidebar desktop diciutkan (hanya ikon). Disimpan di
 *   cookie `crm.sidebar` agar konsisten lintas reload/tab.
 * - `mobileNavOpen`: drawer sidebar di layar kecil (tidak dipersist).
 */
import { browser } from '$app/environment';
import { getCookie, setCookie } from '$lib/utils/cookies';

const COOKIE_KEY = 'crm.sidebar';
const ONE_YEAR = 60 * 60 * 24 * 365;

class UiStore {
	sidebarCollapsed = $state(false);
	mobileNavOpen = $state(false);

	constructor() {
		if (browser) this.sidebarCollapsed = getCookie(COOKIE_KEY) === '1';
	}

	toggleSidebar() {
		this.sidebarCollapsed = !this.sidebarCollapsed;
		if (browser)
			setCookie(COOKIE_KEY, this.sidebarCollapsed ? '1' : '0', { maxAgeSeconds: ONE_YEAR });
	}

	openMobileNav() {
		this.mobileNavOpen = true;
	}
	closeMobileNav() {
		this.mobileNavOpen = false;
	}
}

export const ui = new UiStore();
