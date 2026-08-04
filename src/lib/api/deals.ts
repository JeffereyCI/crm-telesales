/**
 * Endpoint Deal Pipeline (Papan Kanban).
 *  - GET /deals       — read (BDM + Telesales). Backend men-scope telesales ke
 *                       company yang di-assign kepadanya secara otomatis.
 *  - PATCH /deals/:id — update parsial tahap/harga/produk (BDM only; backend membalas
 *                       403 untuk telesales). Deal → `win` otomatis mengubah
 *                       staging company menjadi `customer` (transaksi ACID).
 *
 * Response backend dibungkus `{ message, data }` → di-unwrap di sini.
 */
import { api } from './client';
import type {
	DealResponse,
	UpdateDealRequest,
	DealKanbanFilter,
	DealActivityResponse
} from '$lib/types/api';

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

/** PATCH /deals/:id — geser tahap / edit harga & produk (BDM only). */
export const updateDeal = async (id: string, input: UpdateDealRequest): Promise<DealResponse> => {
	const res = await api.patch<Wrapped<DealResponse>>(`/deals/${id}`, {
		body: {
			product_id: input.product_id,
			amount: input.amount,
			pipeline_status: input.pipeline_status,
			deal_type: input.deal_type,
			subscription_end: input.subscription_end,
			lost_reason: input.lost_reason,
			notes: input.notes
		}
	});
	return res.data;
};

/** GET /deals/:id/activities — audit trail (BDM + Telesales yang berhak). */
export const getActivities = async (
	id: string,
	signal?: AbortSignal
): Promise<DealActivityResponse[]> => {
	const res = await api.get<Wrapped<DealActivityResponse[]>>(`/deals/${id}/activities`, { signal });
	return res.data ?? [];
};

/** POST /deals/:id/notes — catatan internal (BDM only menurut route backend). */
export const addNote = async (id: string, notes: string, signal?: AbortSignal): Promise<void> => {
	await api.post<Wrapped<never>>(`/deals/${id}/notes`, { body: { notes }, signal });
};
