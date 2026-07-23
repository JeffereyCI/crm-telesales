/**
 * Enum kontrak backend (internal/dto/*.go).
 *
 * PENTING: nilai (value) di sini WAJIB sama persis dengan tag `binding:"oneof=..."`
 * di backend — lowercase snake_case. JANGAN terjemahkan value-nya; yang
 * diterjemahkan hanya LABEL untuk ditampilkan ke user.
 */

// ── Role ───────────────────────────────────────────────────────────────────
export const ROLES = ['admin', 'bdm', 'telesales'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
	admin: 'Admin',
	bdm: 'BDM',
	telesales: 'Telesales'
};

// ── Status User ──────────────────────────────────────────────────────────────
export const USER_STATUSES = ['active', 'inactive'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const USER_STATUS_LABEL: Record<UserStatus, string> = {
	active: 'Aktif',
	inactive: 'Nonaktif'
};

export const USER_STATUS_BADGE: Record<UserStatus, string> = {
	active: 'bg-emerald-100 text-emerald-700',
	inactive: 'bg-red-100 text-red-700'
};

// ── Action Status (state machine) ────────────────────────────────────────────
// 'belum_dihubungi' = state awal (default DB). TIDAK valid sebagai input PATCH.
export const ACTION_STATUSES = [
	'belum_dihubungi',
	'sudah_dihubungi',
	'tidak_bisa_dihubungi'
] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

// Hanya 2 nilai ini yang boleh dikirim ke PATCH /contacts/:id/action-status.
export const ACTION_STATUS_INPUTS = ['sudah_dihubungi', 'tidak_bisa_dihubungi'] as const;
export type ActionStatusInput = (typeof ACTION_STATUS_INPUTS)[number];

export const ACTION_STATUS_LABEL: Record<ActionStatus, string> = {
	belum_dihubungi: 'Belum Dihubungi',
	sudah_dihubungi: 'Sudah Dihubungi',
	tidak_bisa_dihubungi: 'Tidak Bisa Dihubungi'
};

export const ACTION_STATUS_BADGE: Record<ActionStatus, string> = {
	belum_dihubungi: 'bg-slate-100 text-slate-600',
	sudah_dihubungi: 'bg-blue-100 text-blue-700',
	tidak_bisa_dihubungi: 'bg-orange-100 text-orange-700'
};

// ── Response Status (state machine) ──────────────────────────────────────────
export const RESPONSE_STATUSES = [
	'tertarik',
	'ditolak',
	'sudah_pakai_lain',
	'belum_perlu',
	'tidak_dibalas'
] as const;
export type ResponseStatus = (typeof RESPONSE_STATUSES)[number];

export const RESPONSE_STATUS_LABEL: Record<ResponseStatus, string> = {
	tertarik: 'Tertarik',
	ditolak: 'Ditolak',
	sudah_pakai_lain: 'Sudah Pakai Lain',
	belum_perlu: 'Belum Perlu',
	tidak_dibalas: 'Tidak Dibalas'
};

export const RESPONSE_STATUS_BADGE: Record<ResponseStatus, string> = {
	tertarik: 'bg-emerald-100 text-emerald-700',
	ditolak: 'bg-red-100 text-red-700',
	sudah_pakai_lain: 'bg-violet-100 text-violet-700',
	belum_perlu: 'bg-zinc-100 text-zinc-600',
	tidak_dibalas: 'bg-amber-100 text-amber-700'
};

// ── Company Staging (Leads → Contact → Customer) ─────────────────────────────
// Mirror ENUM `company_staging` backend (migrasi 000003). Menandakan kedekatan
// hubungan; transisi otomatis oleh backend (schedule meeting → contact, deal win
// → customer).
export const COMPANY_STAGINGS = ['leads', 'contact', 'customer'] as const;
export type CompanyStaging = (typeof COMPANY_STAGINGS)[number];

export const COMPANY_STAGING_LABEL: Record<CompanyStaging, string> = {
	leads: 'Leads',
	contact: 'Contact',
	customer: 'Customer'
};

export const COMPANY_STAGING_BADGE: Record<CompanyStaging, string> = {
	leads: 'bg-slate-100 text-slate-600',
	contact: 'bg-amber-100 text-amber-700',
	customer: 'bg-emerald-100 text-emerald-700'
};

// ── Pipeline Phase (Deal Kanban) ─────────────────────────────────────────────
// Mirror ENUM `pipeline_phase` backend (migrasi 000003) + binding oneof di
// UpdateDealRequest. Urutan array = urutan kolom Kanban.
export const PIPELINE_PHASES = [
	'demo',
	'proposal',
	'quotation',
	'waiting_list',
	'payment',
	'win',
	'lost'
] as const;
export type PipelinePhase = (typeof PIPELINE_PHASES)[number];

export const PIPELINE_PHASE_LABEL: Record<PipelinePhase, string> = {
	demo: 'Demo',
	proposal: 'Proposal',
	quotation: 'Quotation',
	waiting_list: 'Waiting List',
	payment: 'Payment',
	win: 'Win',
	lost: 'Lost'
};

// ── Channel ──────────────────────────────────────────────────────────────────
export const CHANNELS = ['call', 'whatsapp', 'email', 'visit'] as const;
export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_LABEL: Record<Channel, string> = {
	call: 'Telepon',
	whatsapp: 'WhatsApp',
	email: 'Email',
	visit: 'Kunjungan'
};

// Hanya prasyarat untuk membuka tombol "Jadwalkan Meeting".
export const MEETING_PREREQUISITE: ResponseStatus = 'tertarik';

// Prasyarat untuk MENGISI/mengubah Status Respon: kontak harus SUDAH berhasil
// dihubungi. Belum/tidak bisa dihubungi ⇒ mustahil ada respon yang dicatat.
export const RESPONSE_PREREQUISITE: ActionStatus = 'sudah_dihubungi';
