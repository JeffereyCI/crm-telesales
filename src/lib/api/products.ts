/**
 * Endpoint Master Produk.
 *  - GET /products        — read (BDM + Telesales; dipakai form meeting & Kanban).
 *  - POST/PUT/DELETE      — tulis (BDM only; ditegakkan backend via RBAC).
 *
 * Backend membungkus response sebagai `{ message, data }` → di sini di-unwrap
 * agar pemanggil langsung menerima payload bersih (konsisten dgn client lain).
 */
import { api } from './client';
import { sanitizeText, pruneEmpty } from '$lib/utils/sanitize';
import type { ProductResponse, CreateProductRequest, UpdateProductRequest } from '$lib/types/api';

interface Wrapped<T> {
	message: string;
	data: T;
}

/** GET /products — daftar produk (opsional filter `search`). */
export const listProducts = async (
	search?: string,
	signal?: AbortSignal
): Promise<ProductResponse[]> => {
	const res = await api.get<Wrapped<ProductResponse[]>>('/products', {
		query: { search },
		signal
	});
	return res.data ?? [];
};

/** POST /products — BDM only. */
export const createProduct = async (input: CreateProductRequest): Promise<ProductResponse> => {
	const res = await api.post<Wrapped<ProductResponse>>('/products', {
		body: {
			name: sanitizeText(input.name),
			description: input.description ? sanitizeText(input.description) : undefined
		}
	});
	return res.data;
};

/** PUT /products/:id — BDM only. */
export const updateProduct = async (
	id: string,
	input: UpdateProductRequest
): Promise<ProductResponse> => {
	const res = await api.put<Wrapped<ProductResponse>>(`/products/${id}`, {
		body: pruneEmpty({
			name: sanitizeText(input.name),
			description: input.description ? sanitizeText(input.description) : undefined
		})
	});
	return res.data;
};

/** DELETE /products/:id — BDM only. */
export const deleteProduct = (id: string) => api.del<{ message: string }>(`/products/${id}`);
