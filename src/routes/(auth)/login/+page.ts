/** Bila sudah login, jangan tampilkan form — langsung ke landing per role. */
import { redirect } from '@sveltejs/kit';
import { auth } from '$lib/stores/auth.svelte';
import { defaultRoute } from '$lib/utils/rbac';

export const load = () => {
	if (auth.isAuthenticated && auth.role) {
		redirect(307, defaultRoute(auth.role));
	}
};
