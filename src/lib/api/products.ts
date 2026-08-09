/**
 * Endpoint Master Produk.
 *  - GET /products        — read (BDM + Telesales; dipakai form meeting & Kanban).
 *  - POST/PUT/DELETE      — tulis (BDM only; ditegakkan backend via RBAC).
 *
 * Backend hanya membungkus LIST sebagai `{ data }`.
 * Response create/update mengembalikan objek produk langsung.
 */
import { api } from './client';
import { sanitizeText, pruneEmpty } from '$lib/utils/sanitize';
import type {
	ProductResponse,
	CreateProductRequest,
	UpdateProductRequest,
	ProductListFilter
} from '$lib/types/api';

interface ProductListResult {
	data: ProductResponse[];
}

/** GET /products — daftar produk (opsional filter `search`). */
export const listProducts = async (
	filter: ProductListFilter = {},
	signal?: AbortSignal
): Promise<ProductResponse[]> => {
	const res = await api.get<ProductListResult>('/products', {
		query: filter as Record<string, unknown>,
		signal
	});
	return res.data ?? [];
};

/** POST /products — BDM only. */
export const createProduct = (input: CreateProductRequest) =>
	api.post<ProductResponse>('/products', {
		body: {
			code: sanitizeText(input.code),
			name: sanitizeText(input.name),
			description: input.description ? sanitizeText(input.description) : undefined,
			vendor: input.vendor,
			billing_model: input.billing_model,
			category: input.category
		}
	});

/** PUT /products/:id — BDM only. */
export const updateProduct = (id: string, input: UpdateProductRequest) =>
	api.put<ProductResponse>(`/products/${id}`, {
		body: pruneEmpty({
			code: sanitizeText(input.code),
			name: sanitizeText(input.name),
			description: input.description ? sanitizeText(input.description) : undefined,
			vendor: input.vendor,
			billing_model: input.billing_model,
			category: input.category
		})
	});

/** DELETE /products/:id — BDM only. */
export const deleteProduct = (id: string) => api.del<{ message: string }>(`/products/${id}`);
