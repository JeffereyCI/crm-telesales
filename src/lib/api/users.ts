/** Endpoint Users (admin only — lihat rbac.ts). */
import { api } from './client';
import { sanitizeText, sanitizeEmail, pruneEmpty } from '$lib/utils/sanitize';
import type {
	UserResponse,
	CreateUserRequest,
	UpdateUserRequest,
	Pagination
} from '$lib/types/api';
import type { Role, UserStatus } from '$lib/constants/enums';

export interface UserListFilter {
	page?: number;
	limit?: number;
	search?: string;
	role?: Role;
	status?: UserStatus;
}

interface UserListResponse {
	data: UserResponse[];
	pagination: Pagination;
}

export const listUsers = (filter: UserListFilter = {}) =>
	api.get<UserListResponse>('/users', { query: filter as Record<string, unknown> });

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
