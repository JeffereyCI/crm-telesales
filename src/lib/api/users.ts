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
