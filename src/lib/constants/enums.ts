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

// CRM-012
// Chat template management
export const CHAT_TEMPLATE_CATEGORIES = ['leads', 'contact', 'customer'] as const;
export type ChatTemplateCategory = (typeof CHAT_TEMPLATE_CATEGORIES)[number];
export const CHAT_TEMPLATE_CATEGORY_LABEL: Record<ChatTemplateCategory, string> = {
	leads: 'Lead',
	contact: 'Contact',
	customer: 'Customer'
};

export const CHAT_TEMPLATE_CATEGORY_BADGE: Record<ChatTemplateCategory, string> = {
	leads: 'bg-blue-100 text-blue-700',
	contact: 'bg-amber-100 text-amber-700',
	customer: 'bg-emerald-100 text-emerald-700'
};

// ── WhatsApp Status (CRM-011) ───────────────────────────────────────────────
// Mirror enum backend: active | inactive | unverified.
// State "belum ada nomor" = null (bukan string), jangan tambah 'no-phone' di sini.
export const WHATSAPP_STATUSES = ['active', 'inactive', 'unverified'] as const;
export type WhatsAppStatus = (typeof WHATSAPP_STATUSES)[number];

export const WHATSAPP_STATUS_LABEL: Record<WhatsAppStatus, string> = {
	active: 'Terverifikasi',
	inactive: 'Tidak Terdaftar di WA',
	unverified: 'Belum Diverifikasi'
};

export const WHATSAPP_STATUS_BADGE: Record<WhatsAppStatus, string> = {
	active: 'bg-emerald-100 text-emerald-700',
	inactive: 'bg-red-100 text-red-700',
	unverified: 'bg-amber-100 text-amber-700'
};

// Tooltip untuk menonaktifkan Quick Chat (dipakai CRM-011 badge & CRM-013 guard).
export const WHATSAPP_INELIGIBLE_TOOLTIP = {
	inactive: 'Nomor ini tidak terdaftar di WhatsApp.',
	unverified: 'Nomor WhatsApp belum berhasil diverifikasi.',
	no_phone: 'Contact ini belum mempunyai nomor telepon.'
} as const;

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

// ── Implementation Project (CRM-009) ───────────────────────────────────────
export const IMPLEMENTATION_STAGES = [
	'discovery',
	'preparation',
	'fit_gap_design',
	'configuration_development',
	'data_migration_integration',
	'testing_sit',
	'testing_uat',
	'training_readiness',
	'cutover',
	'go_live',
	'hypercare',
	'handover_completed'
] as const;
export type ImplementationStage = (typeof IMPLEMENTATION_STAGES)[number];

export const IMPLEMENTATION_STAGE_LABEL: Record<ImplementationStage, string> = {
	discovery: 'Discovery',
	preparation: 'Preparation',
	fit_gap_design: 'Fit/Gap Design',
	configuration_development: 'Configuration & Development',
	data_migration_integration: 'Data Migration & Integration',
	testing_sit: 'Testing SIT',
	testing_uat: 'Testing UAT',
	training_readiness: 'Training & Readiness',
	cutover: 'Cutover',
	go_live: 'Go-Live',
	hypercare: 'Hypercare',
	handover_completed: 'Handover Completed'
};

export const IMPLEMENTATION_DELIVERY_STATUSES = [
	'planned',
	'in_progress',
	'on_hold',
	'completed',
	'cancelled'
] as const;
export type ImplementationDeliveryStatus = (typeof IMPLEMENTATION_DELIVERY_STATUSES)[number];

export const IMPLEMENTATION_DELIVERY_STATUS_LABEL: Record<ImplementationDeliveryStatus, string> = {
	planned: 'Planned',
	in_progress: 'In Progress',
	on_hold: 'On Hold',
	completed: 'Completed',
	cancelled: 'Cancelled'
};

export const IMPLEMENTATION_DELIVERY_STATUS_BADGE: Record<ImplementationDeliveryStatus, string> = {
	planned: 'bg-slate-100 text-slate-600',
	in_progress: 'bg-blue-100 text-blue-700',
	on_hold: 'bg-amber-100 text-amber-700',
	completed: 'bg-emerald-100 text-emerald-700',
	cancelled: 'bg-red-100 text-red-700'
};

// Hanya prasyarat untuk membuka tombol "Jadwalkan Meeting".
export const MEETING_PREREQUISITE: ResponseStatus = 'tertarik';

// Prasyarat untuk MENGISI/mengubah Status Respon: kontak harus SUDAH berhasil
// dihubungi. Belum/tidak bisa dihubungi ⇒ mustahil ada respon yang dicatat.
export const RESPONSE_PREREQUISITE: ActionStatus = 'sudah_dihubungi';
