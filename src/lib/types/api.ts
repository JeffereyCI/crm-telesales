/**
 * Tipe kontrak API — disalin 1:1 dari `internal/dto/*.go` & `internal/service/auth.go`.
 *
 * Catatan kontrak backend:
 *  - Shape response TIDAK sepenuhnya seragam; beberapa endpoint mengembalikan
 *    objek polos, sebagian list memakai `{ data, pagination }`, dan ada route
 *    tertentu yang masih dibungkus `{ message, data }`.
 *  - Wrapper di `src/lib/api/*` menangani normalisasi bila diperlukan.
 *  - Field pointer Go (`*string`, dst) → di sini `| null`.
 *  - Field `omitempty` → opsional (`?`).
 */
import type {
	Role,
	UserStatus,
	ActionStatus,
	ActionStatusInput,
	ResponseStatus,
	Channel,
	CompanyStaging,
	PipelinePhase,
	WhatsAppStatus
} from '$lib/constants/enums';

// ── Error & Pagination ───────────────────────────────────────────────────────
export interface ApiErrorBody {
	error: string; // kode mesin, mis. "AUTH_FAILED", "VALIDATION_ERROR"
	message: string;
	details?: unknown; // VALIDATION_ERROR bisa string[], conflict tertentu bisa object
}

export interface Pagination {
	current_page: number;
	total_pages: number;
	total_items: number;
	limit: number;
	next_cursor?: string;
}

export interface SubscriptionSummary {
	active: number;
	expiring_soon: number;
	expired: number;
}

// ── Auth ─────────────────────────────────────────────────────────────────────
export interface LoginRequest {
	email: string;
	password: string;
}

export interface AuthUser {
	id: string;
	name: string;
	email: string;
	role: Role;
}

export interface LoginResponse {
	token: string;
	user: AuthUser;
}

// ── Users ────────────────────────────────────────────────────────────────────
export interface UserResponse {
	id: string;
	name: string;
	email: string;
	role: Role;
	status: UserStatus;
	created_at: string;
	updated_at: string;
}

export interface CreateUserRequest {
	name: string;
	email: string;
	password: string;
	role: Role;
}

export interface UpdateUserRequest {
	name?: string;
	email?: string;
	role?: Role;
}

export interface UpdateStatusRequest {
	status: UserStatus;
}

export interface ResetPasswordRequest {
	new_password: string;
}

// ── Companies ────────────────────────────────────────────────────────────────
export interface AssignedUser {
	id: string;
	name: string;
}

export interface CompanyResponse {
	id: string;
	name: string;
	industry: string | null;
	phone: string | null;
	website: string | null;
	assigned_to: AssignedUser | null;
	contact_count: number;
	status: CompanyStaging; // staging: leads | contact | customer
	subscription_summary: SubscriptionSummary;
	created_at: string;
}

export interface CompanyDetailResponse {
	id: string;
	name: string;
	industry: string | null;
	address: string | null;
	phone: string | null;
	website: string | null;
	assigned_to: AssignedUser | null;
	assigned_by: AssignedUser | null;
	assigned_at: string | null;
	contact_count: number;
	status: CompanyStaging; // staging: leads | contact | customer
	contacts_summary: Record<string, number>;
	subscription_summary: SubscriptionSummary;
	created_at: string;
}

export interface CompanyListResponse {
	data: CompanyResponse[];
	pagination: Pagination;
}

export interface CreateCompanyRequest {
	name: string;
	industry?: string;
	address?: string;
	phone?: string;
	website?: string;
}

export type UpdateCompanyRequest = CreateCompanyRequest;

export interface AssignCompanyRequest {
	company_ids: string[];
	assigned_to: string;
}

export interface ReassignCompanyRequest {
	company_ids: string[];
	new_assigned_to: string;
	notes?: string;
}

export interface ImportErrorDetail {
	row: number;
	reason: string;
}

export interface ImportResult {
	total_rows: number;
	success: number;
	duplicates_updated: number;
	errors: number;
	error_details: ImportErrorDetail[];
}

export interface CompanyListFilter {
	page?: number;
	limit?: number;
	cursor?: string;
	search?: string;
	status?: CompanyStaging;
	industry?: string;
	assigned_to?: string;
	unassigned?: boolean;
}

// ── Contacts ─────────────────────────────────────────────────────────────────
export interface ContactResponse {
	id: string;
	name: string;
	job_title: string | null;
	phone: string | null;
	whatsapp_status: WhatsAppStatus | null;
	whatsapp_verified_at: string | null;
	email: string | null;
	action_status: ActionStatus;
	response_status: ResponseStatus | null;
	is_meeting_scheduled: boolean;
	created_at?: string;
	updated_at?: string;
}

export interface ContactDetailResponse extends ContactResponse {
	company: { id: string; name: string };
	active_deals: DealResponse[];
	meeting_summary: {
		total_meetings: number;
		last_meeting_at: string | null;
		next_meeting_at: string | null;
	};
	notes_count: number;
	last_activity_at: string | null;
}

export interface ContactMeetingResponse {
	id: string;
	scheduled_by: string;
	scheduled_by_name: string;
	meeting_date: string;
	meeting_time: string;
	location: string | null;
	agenda: string;
	template_id: string | null;
	status: 'upcoming' | 'completed';
	created_at: string;
}

export interface ContactMeetingListResponse {
	data: ContactMeetingResponse[];
	pagination: Pagination;
}

export interface ContactMeetingFilter {
	page?: number;
	limit?: number;
}

export interface ContactListResponse {
	company: { id: string; name: string };
	data: ContactResponse[];
}

export interface CreateContactRequest {
	name: string;
	job_title?: string;
	phone?: string;
	email?: string;
}

export type UpdateContactRequest = CreateContactRequest;

export interface UpdateActionStatusRequest {
	action_status: ActionStatusInput;
	channel: Channel;
	notes?: string;
}

export interface UpdateResponseStatusRequest {
	response_status: ResponseStatus;
	notes?: string;
}

/**
 * Balasan PATCH status — backend (handler/contact.go) HANYA mengirim pesan +
 * field yang baru saja diubah, BUKAN kontak lengkap. Jangan tipekan sebagai
 * ContactResponse: menimpa objek lead dengan ini akan menghapus field lain.
 */
export interface UpdateActionStatusResponse {
	message: string;
	action_status: ActionStatusInput;
}

export interface UpdateResponseStatusResponse {
	message: string;
	response_status: ResponseStatus;
}

export interface ScheduleMeetingRequest {
	meeting_date: string; // YYYY-MM-DD
	meeting_time: string; // HH:MM
	location?: string;
	agenda: string;
	template_id?: string;
	// Wajib untuk first/new opportunity saat contact belum punya active deal.
	deal_name?: string;
}

export interface MeetingResponse {
	id: string;
	contact_id: string;
	meeting_date: string;
	meeting_time: string;
	location: string;
	agenda: string;
	template_id: string | null;
	created_at: string;
}

// ── Meeting Detail (GET /meetings/:id) ──────────────────────────────────────
export interface MeetingDetailResponse {
	id: string;
	contact_id: string;
	contact_name: string;
	company_id: string;
	company_name: string;
	scheduled_by: string;
	scheduler_name: string;
	meeting_date: string;
	meeting_time: string;
	location: string;
	agenda: string;
	template_id: string | null;
	created_at: string;
	updated_at?: string;
}

// ── Upcoming Meetings / Kalender (GET /meetings/upcoming) ────────────────────
// Data gabungan meeting+contact+company agar dashboard bisa merender jadwal
// tanpa over-fetch. Tersedia untuk role BDM & Telesales.
export interface UpcomingMeetingItem {
	meeting_id: string;
	agenda: string;
	meeting_date: string; // YYYY-MM-DD
	meeting_time: string; // HH:MM:SS
	location: string;
	contact_id: string;
	contact_name: string;
	company_id: string;
	company_name: string;
}

// Paginasi endpoint ini berbeda dari `Pagination` umum (memakai total/page/limit).
export interface UpcomingMeetingsMeta {
	total: number;
	page: number;
	limit: number;
	total_pages: number;
}

export interface UpcomingMeetingsResponse {
	data: UpcomingMeetingItem[];
	meta: UpcomingMeetingsMeta;
}

// Opsional di tipe agar kompatibel pola `as Record` (seperti ReportFilter),
// namun start_date & end_date WAJIB diisi caller — backend menolak bila kosong.
export interface UpcomingMeetingFilter {
	start_date?: string; // YYYY-MM-DD
	end_date?: string; // YYYY-MM-DD
	page?: number;
	limit?: number;
}

// ── Meeting Agenda Templates (CRM006) ───────────────────────────────────────
export type MeetingTemplateType = 'public' | 'private';
export type MeetingTemplateCategory =
	| 'demo'
	| 'proposal'
	| 'quotation'
	| 'waiting_list'
	| 'payment'
	| 'general';

export interface MeetingTemplateResponse {
	id: string;
	name: string;
	body: string;
	category: MeetingTemplateCategory;
	type: MeetingTemplateType;
	created_by: string | null;
	created_at: string;
	updated_at: string;
}

export interface MeetingTemplateFilter {
	type?: MeetingTemplateType;
	category?: MeetingTemplateCategory;
}

export interface SaveMeetingTemplateRequest {
	name: string;
	body: string;
	category: MeetingTemplateCategory;
}

export interface ContactActivityResponse {
	id: string;
	user_name: string;
	activity_type: string;
	channel: Channel | null;
	old_action_status: ActionStatus | null;
	new_action_status: ActionStatus | null;
	old_response_status: ResponseStatus | null;
	new_response_status: ResponseStatus | null;
	notes: string | null;
	created_at: string;
}

export interface ContactActivityListResponse {
	contact: { id: string; name: string; company_name: string };
	data: ContactActivityResponse[];
}

// Mirrors dto.ContactListFilter — HANYA 3 field ini yang di-bind backend
// (`form:"action_status|response_status|search"`); field lain diabaikan diam-diam.
export interface ContactListFilter {
	search?: string;
	action_status?: ActionStatus;
	response_status?: ResponseStatus;
}

// ── Leads (Master View: BDM + Telesales) ─────────────────────────────────────
export interface LeadMasterViewItem {
	id: string;
	name: string;
	job_title: string | null;
	phone: string | null;
	whatsapp_status: WhatsAppStatus | null;
	whatsapp_verified_at: string | null;
	email: string | null;
	company: { id: string; name: string };
	assigned_to: AssignedUser | null;
	action_status: ActionStatus;
	response_status: ResponseStatus | null;
	is_meeting_scheduled: boolean;
	updated_at: string;
}

export interface LeadMasterViewListResponse {
	data: LeadMasterViewItem[];
	pagination: Pagination;
}

export interface LeadListFilter {
	page?: number;
	limit?: number;
	cursor?: string;
	assigned_to?: string;
	action_status?: ActionStatus;
	response_status?: ResponseStatus;
	company_id?: string;
	search?: string;
	sort_by?: string;
}

// ── Reports ──────────────────────────────────────────────────────────────────
export interface ReportPeriod {
	start: string;
	end: string;
}

export interface PersonalReportSummary {
	total_companies_assigned: number;
	total_contacts: number;
	belum_dihubungi: number;
	sudah_dihubungi: number;
	tidak_bisa_dihubungi: number;
	tertarik: number;
	ditolak: number;
	belum_perlu: number;
	tidak_dibalas: number;
	sudah_pakai_lain: number;
	meetings_scheduled: number;
}

export interface PersonalReportResponse {
	period: ReportPeriod;
	summary: PersonalReportSummary;
	conversion_rate: number;
}

export interface TeamSummary {
	total_telesales: number;
	total_contacts: number;
	total_meetings: number;
	overall_conversion_rate: number;
}

export interface TelesalesPerformance {
	user: { id: string; name: string };
	total_contacts: number;
	sudah_dihubungi: number;
	meetings_scheduled: number;
	conversion_rate: number;
}

export interface TeamReportResponse {
	period: ReportPeriod;
	team_summary: TeamSummary;
	per_telesales: TelesalesPerformance[];
}

export interface ReportFilter {
	period?: 'this_week' | 'this_month' | 'this_year';
	start_date?: string; // YYYY-MM-DD
	end_date?: string; // YYYY-MM-DD
	telesales_id?: string;
	format?: 'excel' | 'pdf';
}

// ── Products (Master Data — CRUD oleh BDM, read oleh BDM+Telesales) ───────────
export type ProductVendor = 'sap' | 'yonyou' | 'salesforce' | 'internal';
export type ProductBillingModel = 'subscription' | 'perpetual' | 'one_time';
export type ProductCategory = 'license' | 'module' | 'implementation' | 'support' | 'consulting';

export interface ProductResponse {
	id: string;
	code: string;
	name: string;
	description: string;
	vendor: ProductVendor;
	billing_model: ProductBillingModel;
	category: ProductCategory;
	is_active: boolean;
	created_at: string;
	updated_at: string;
}

export interface ProductListFilter {
	search?: string;
	vendor?: ProductVendor;
	category?: ProductCategory;
	include_inactive?: boolean;
}

export interface CreateProductRequest {
	code: string;
	name: string;
	description?: string;
	vendor: ProductVendor;
	billing_model: ProductBillingModel;
	category: ProductCategory;
}

export type UpdateProductRequest = CreateProductRequest;

// ── Deals / Pipeline Kanban (GET /deals, PUT /deals/:id) ─────────────────────
export type DealType = 'new' | 'upsell' | 'cross_sell' | 'renewal';

export interface DealCompanySummary {
	id: string;
	name: string;
}

export interface DealContactSummary {
	id: string;
	name: string;
}

// Helper: ambil nama produk pertama dari items[], atau null jika kosong.
// Gantikan semua akses `deal.product?.name` dengan ini.
export function getDealPrimaryProductName(deal: Pick<DealResponse, 'items'>): string | null {
	return deal.items[0]?.product_name ?? null;
}

// Satu item produk di dalam Deal.
export interface DealItem {
	id: string;
	product_id: string;
	product_code: string;
	product_name: string;
	vendor: string;
	billing_model: string;
	category: string;
	quantity: string;
	unit_price: string;
	discount_percent: string;
	subtotal: string;
	subscription_start: string | null;
	subscription_end: string | null;
	subscription_status: 'active' | 'expiring_soon' | 'expired' | null;
	position: number;
}

// 1 kartu Deal di papan Kanban.
export interface DealResponse {
	id: string;
	company: DealCompanySummary;
	contact?: DealContactSummary | null;
	name: string;
	/**
	 * Computed total dari subtotal seluruh items.
	 * Backend mengirim sebagai STRING desimal ("2500000.00"), bukan number.
	 * Gunakan Number(deal.amount) atau formatCurrency(deal.amount) untuk render.
	 */
	amount: string;
	version: number;
	pipeline_status: PipelinePhase;
	deal_type: DealType;
	items: DealItem[];
	lost_reason?: string | null;
	notes?: string | null;
	created_at: string;
	updated_at: string;
}

// Backend membungkus daftar deal sebagai { message, data: [...] }.
export interface DealListResponse {
	data: DealResponse[];
}

// GET /deals/:id dan PATCH /deals/:id mengembalikan DealDetailResponse
// (= DealResponse + activities_count).
export interface DealDetailResponse extends DealResponse {
	activities_count: number;
}

export interface DealItemUpsertRequest {
	id?: string; // UUID item existing, kosong = tambah baru
	product_id: string;
	quantity: string;
	unit_price: string;
	discount_percent: string;
	subscription_start?: string;
	subscription_end?: string;
}

export interface CreateDealItemRequest {
	product_id: string;
	quantity: string;
	unit_price: string;
	discount_percent: string;
}

export interface CreateDealRequest {
	company_id: string;
	contact_id: string;
	name: string;
	deal_type: DealType;
	items: CreateDealItemRequest[];
}

export interface UpdateDealRequest {
	contact_id?: string;
	pipeline_status?: PipelinePhase;
	deal_type?: DealType;
	lost_reason?: string;
	notes?: string;
	items?: DealItemUpsertRequest[];
	expected_version: number;
}

export interface CreateDealResponseMeta {
	deal: DealDetailResponse;
	location: string | null;
	replayed: boolean;
}

export interface ActiveDealConflictDetails {
	active_deal_id?: string;
}

export interface DealActivityResponse {
	id: string;
	deal_id: string;
	user_id: string;
	user_name: string;
	action:
	| 'pipeline_status_changed'
	| 'contact_changed'
	| 'deal_type_changed'
	| 'lost_reason_changed'
	| 'notes_changed'
	| 'note_added'
	| 'item_added'
	| 'item_updated'
	| 'item_removed'
	| string;
	old_value?: string | null;
	new_value?: string | null;
	notes?: string | null;
	created_at: string;
}

export interface DealKanbanFilter {
	search?: string;
	pipeline_status?: PipelinePhase;
	assigned_to?: string;
}

export interface CompanyDealFilter {
	page?: number;
	limit?: number;
}

export interface CompanyDealListResponse {
	data: DealResponse[];
	pagination: Pagination;
}

export interface ImplementationProjectFilter {
	page?: number;
	limit?: number;
	stage?: string;
	delivery_status?: string;
}

export interface ImplementationProjectResponse {
	id: string;
	company: { id: string; name: string };
	deal: { id: string; name: string };
	name: string;
	stage: string;
	delivery_status: string;
	planned_start_date: string | null;
	actual_start_date: string | null;
	planned_go_live_date: string | null;
	actual_go_live_date: string | null;
	version: number;
	notes: string | null;
	external_system: string | null;
	external_reference: string | null;
	external_metadata: Record<string, unknown>;
	activities_count: number;
	created_at: string;
	updated_at: string;
}

export interface ImplementationActivityResponse {
	id: string;
	actor: { id: string; name: string } | null;
	source: string;
	action: string;
	field_name: string | null;
	old_value: string | null;
	new_value: string | null;
	change_reason: string | null;
	created_at: string;
}

export interface ImplementationProjectListResponse {
	data: ImplementationProjectResponse[];
	pagination: Pagination;
}

export interface ImplementationActivityListResponse {
	data: ImplementationActivityResponse[];
	pagination: Pagination;
}

export interface UpdateImplementationProjectRequest {
	expected_version: number;
	stage?: string;
	delivery_status?: string;
	planned_start_date?: string;
	actual_start_date?: string;
	planned_go_live_date?: string;
	actual_go_live_date?: string;
	notes?: string;
	change_reason?: string;
}

// ── In-app Notifications (CRM-004) ──────────────────────────────────────────
export type NotificationType =
	| 'ASSIGN_COMPANY'
	| 'REASSIGN_COMPANY'
	| 'SCHEDULE_MEETING'
	| 'DEAL_WON';
export type NotificationReferenceType = 'company' | 'meeting' | 'deal';

export interface NotificationResponse {
	id: string;
	user_id: string;
	title: string;
	type: NotificationType;
	message: string;
	reference_id?: string | null;
	reference_type?: NotificationReferenceType | null;
	is_read: boolean;
	created_at: string;
}

export interface NotificationListResponse {
	data: NotificationResponse[];
	unread_count: number;
}

export interface NotificationListFilter {
	page?: number;
	limit?: number;
}

export interface NotificationStreamEvent {
	event: 'new_notification' | 'ping';
	id?: string;
	data: unknown;
}