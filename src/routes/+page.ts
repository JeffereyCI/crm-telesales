/** Root index: arahkan ke landing per role, atau ke /login bila belum masuk. */
import { redirect } from '@sveltejs/kit';
import { auth } from '$lib/stores/auth.svelte';
import { defaultRoute } from '$lib/utils/rbac';

export const load = () => {
	if (auth.isAuthenticated && auth.role) {
		redirect(307, defaultRoute(auth.role));
	}
	redirect(307, '/login');
};
