/**
 * Endpoint Deal Pipeline (Papan Kanban).
 *  - GET /deals       — read (BDM + Telesales). Backend men-scope telesales ke
 *                       company yang di-assign kepadanya secara otomatis.
 *  - PATCH /deals/:id — update parsial tahap/produk (BDM only; backend membalas
 *                       403 untuk telesales). Deal → `win` otomatis mengubah
 *                       staging company menjadi `customer` (transaksi ACID).
 *
 * Response backend dibungkus `{ message, data }` → di-unwrap di sini.
 */
import { api } from './client';
import { sanitizeText } from '$lib/utils/sanitize';
import type {
	CreateDealRequest,
	CreateDealResponseMeta,
	DealDetailResponse,
	DealResponse,
	UpdateDealRequest,
	DealKanbanFilter,
	DealActivityResponse,
	CompanyDealFilter,
	CompanyDealListResponse
} from '$lib/types/api';

interface Wrapped<T> {
	message: string;
	data: T;
}

/** POST /deals — create manual multi-product deal (BDM only). */
export const createDeal = async (
	input: CreateDealRequest,
	idempotencyKey: string
): Promise<CreateDealResponseMeta> => {
	const response = await api.postMeta<Wrapped<DealDetailResponse>>('/deals', {
		headers: { 'Idempotency-Key': idempotencyKey },
		body: {
			company_id: input.company_id,
			contact_id: input.contact_id,
			name: sanitizeText(input.name),
			deal_type: input.deal_type,
			items: input.items.map((item) => ({
				product_id: item.product_id,
				quantity: item.quantity,
				unit_price: item.unit_price,
				discount_percent: item.discount_percent
			}))
		}
	});
	return {
		deal: response.data.data,
		location: response.headers.get('Location'),
		replayed: response.headers.get('Idempotency-Replayed') === 'true'
	};
};

/** GET /deals — seluruh kartu pipeline (opsional filter). */
export const getPipeline = async (filter: DealKanbanFilter = {}): Promise<DealResponse[]> => {
	const res = await api.get<Wrapped<DealResponse[]>>('/deals', {
		query: filter as Record<string, unknown>
	});
	return res.data ?? [];
};

/** PATCH /deals/:id — geser tahap / edit contact, deal_type, notes, dan items (BDM only). */
export const updateDeal = async (
	id: string,
	input: UpdateDealRequest
): Promise<DealDetailResponse> => {
	const body = compact({
		contact_id: input.contact_id,
		pipeline_status: input.pipeline_status,
		deal_type: input.deal_type,
		lost_reason: input.lost_reason,
		notes: input.notes,
		items: input.items,
		expected_version: input.expected_version
	});
	const res = await api.patch<Wrapped<DealDetailResponse>>(`/deals/${id}`, { body });
	return res.data;
};

/** GET /deals/:id — detail lengkap deal untuk modal pipeline. */
export const getDealDetail = (id: string, signal?: AbortSignal) =>
	api.get<DealDetailResponse>(`/deals/${id}`, { signal });

/** GET /companies/:id/deals — seluruh histori deal milik company dengan paginasi. */
export const getCompanyDeals = (
	companyId: string,
	filter: CompanyDealFilter = {},
	signal?: AbortSignal
) =>
	api.get<CompanyDealListResponse>(`/companies/${companyId}/deals`, {
		query: filter as Record<string, unknown>,
		signal
	});

function compact<T extends Record<string, unknown>>(obj: T): T {
	return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined)) as T;
}

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
