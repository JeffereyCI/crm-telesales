/**
 * Guard area aplikasi (semua route dalam grup (app)).
 *  - Belum login / token kedaluwarsa → /login?redirect=<asal>.
 *  - Login tapi role tak punya akses ke section → kembali ke landing role.
 *
 * Otorisasi sebenarnya tetap ditegakkan backend; ini hanya cegah render
 * halaman yang pasti ditolak (UX + hemat request).
 */
import { redirect } from '@sveltejs/kit';
import { auth } from '$lib/stores/auth.svelte';
import { NAV_BY_ROLE, defaultRoute } from '$lib/utils/rbac';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = ({ url }) => {
	if (!auth.isAuthenticated || !auth.role) {
		redirect(307, `/login?redirect=${encodeURIComponent(url.pathname)}`);
	}

	const role = auth.role;
	const allowed = [...NAV_BY_ROLE[role].map((i) => i.href), '/help'];
	const permitted = allowed.some(
		(href) => url.pathname === href || url.pathname.startsWith(href + '/')
	);
	if (!permitted) {
		redirect(307, defaultRoute(role));
	}
};
