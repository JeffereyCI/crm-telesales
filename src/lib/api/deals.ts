/**
 * Endpoint Deal Pipeline (Papan Kanban).
 *  - GET /deals       — read (BDM + Telesales). Backend men-scope telesales ke
 *                       company yang di-assign kepadanya secara otomatis.
 *  - PUT /deals/:id   — update tahap/harga/produk (BDM only; backend membalas
 *                       403 untuk telesales). Deal → `win` otomatis mengubah
 *                       staging company menjadi `customer` (transaksi ACID).
 *
 * Response backend dibungkus `{ message, data }` → di-unwrap di sini.
 */
import { api } from './client';
import type { DealResponse, UpdateDealRequest, DealKanbanFilter } from '$lib/types/api';

interface Wrapped<T> {
	message: string;
	data: T;
}

/** GET /deals — seluruh kartu pipeline (opsional filter). */
export const getPipeline = async (filter: DealKanbanFilter = {}): Promise<DealResponse[]> => {
	const res = await api.get<Wrapped<DealResponse[]>>('/deals', {
		query: filter as Record<string, unknown>
	});
	return res.data ?? [];
};

/** PUT /deals/:id — geser tahap / edit harga & produk (BDM only). */
export const updateDeal = async (id: string, input: UpdateDealRequest): Promise<DealResponse> => {
	const res = await api.put<Wrapped<DealResponse>>(`/deals/${id}`, {
		body: {
			product_id: input.product_id,
			amount: input.amount,
			pipeline_status: input.pipeline_status
		}
	});
	return res.data;
};
