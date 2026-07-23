/** Endpoint Users (admin only — lihat rbac.ts). */
import { api } from './client';
import { sanitizeText, sanitizeEmail, pruneEmpty } from '$lib/utils/sanitize';
import type { UserResponse, CreateUserRequest, UpdateUserRequest } from '$lib/types/api';
import type { UserStatus } from '$lib/constants/enums';

/**
 * GET /users — backend mengembalikan ARRAY POLOS (tanpa `{data,pagination}`)
 * dan TIDAK menerima filter/pagination query. Jadi seluruh user diambil sekali;
 * pencarian/filter/pagination dilakukan di sisi klien (lihat halaman users).
 */
export const listUsers = () => api.get<UserResponse[]>('/users');

export const getUser = (id: string) => api.get<UserResponse>(`/users/${id}`);

export const createUser = (input: CreateUserRequest) =>
	api.post<UserResponse>('/users', {
		body: {
			name: sanitizeText(input.name),
			email: sanitizeEmail(input.email),
			password: input.password,
			role: input.role
		}
	});

export const updateUser = (id: string, input: UpdateUserRequest) =>
	api.put<UserResponse>(`/users/${id}`, {
		body: pruneEmpty({
			name: input.name ? sanitizeText(input.name) : undefined,
			email: input.email ? sanitizeEmail(input.email) : undefined,
			role: input.role
		})
	});

export const updateUserStatus = (id: string, status: UserStatus) =>
	api.patch<void>(`/users/${id}/status`, { body: { status } });

export const resetUserPassword = (id: string, newPassword: string) =>
	api.patch<{ message: string }>(`/users/${id}/password`, { body: { new_password: newPassword } });

/**
 * PATCH /users/me/password — user yang sedang login (SEMUA role) mengganti
 * sandinya sendiri. Backend memverifikasi sandi lama; bila salah membalas
 * 400 `INVALID_OLD_PASSWORD` (BUKAN 401), sehingga client tidak menganggapnya
 * sesi kedaluwarsa — 401 tetap murni berarti token bermasalah → auto-logout.
 * Password TIDAK disanitasi (bisa mengandung simbol/spasi yang disengaja).
 */
export const changeMyPassword = (oldPassword: string, newPassword: string) =>
	api.patch<{ message: string }>('/users/me/password', {
		body: { old_password: oldPassword, new_password: newPassword }
	});
