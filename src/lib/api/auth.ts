/** Endpoint Auth. Login menyetel sesi; logout membersihkannya. */
import { api } from './client';
import { auth } from '$lib/stores/auth.svelte';
import { sanitizeEmail } from '$lib/utils/sanitize';
import type { LoginResponse } from '$lib/types/api';

export async function login(email: string, password: string): Promise<LoginResponse> {
	const res = await api.post<LoginResponse>('/auth/login', {
		auth: false, // endpoint publik
		body: { email: sanitizeEmail(email), password }
	});
	auth.setSession(res.token, res.user);
	return res;
}

export async function logout(): Promise<void> {
	try {
		// Backend mem-blacklist token di Redis. Abaikan error agar logout lokal tetap jalan.
		await api.post('/auth/logout');
	} catch {
		/* tetap lanjut bersihkan sesi lokal */
	} finally {
		auth.clear();
	}
}
