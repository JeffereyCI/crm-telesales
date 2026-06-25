/**
 * Tipe kontrak API — disalin 1:1 dari `internal/dto/*.go` & `internal/service/auth.go`.
 *
 * Konvensi backend:
 *  - Response TIDAK di-wrap envelope. List = `{ data, pagination }` langsung.
 *  - Field pointer Go (`*string`, dst) → di sini `| null`.
 *  - Field `omitempty` → opsional (`?`).
 */
import type {
	Role,
	UserStatus,
	ActionStatus,
	ActionStatusInput,
	ResponseStatus,
	Channel
} from '$lib/constants/enums';

// ── Error & Pagination ───────────────────────────────────────────────────────
export interface ApiErrorBody {
	error: string; // kode mesin, mis. "AUTH_FAILED", "VALIDATION_ERROR"
	message: string;
	details?: string[]; // hanya pada VALIDATION_ERROR
}

export interface Pagination {
	current_page: number;
	total_pages: number;
	total_items: number;
	limit: number;
	next_cursor?: string;
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
	contacts_summary: Record<string, number>;
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
	email: string | null;
	action_status: ActionStatus;
	response_status: ResponseStatus | null;
	is_meeting_scheduled: boolean;
	created_at?: string;
	updated_at?: string;
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

export interface ScheduleMeetingRequest {
	meeting_date: string; // YYYY-MM-DD
	meeting_time: string; // HH:MM
	location?: string;
	agenda?: string;
}

export interface MeetingResponse {
	id: string;
	contact_id: string;
	meeting_date: string;
	meeting_time: string;
	location: string;
	agenda: string;
	created_at: string;
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

export interface ContactListFilter {
	search?: string;
	job_title?: string;
	action_status?: ActionStatus;
	response_status?: ResponseStatus;
}

// ── Leads (Master View BDM) ──────────────────────────────────────────────────
export interface LeadMasterViewItem {
	id: string;
	name: string;
	job_title: string | null;
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
