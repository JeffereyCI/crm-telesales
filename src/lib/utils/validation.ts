/**
 * Validasi sisi-klien yang MENIRU aturan `binding` di backend (internal/dto/*.go).
 *
 * Tujuan: feedback cepat di UI sebelum request. Backend tetap validasi ulang
 * (jangan pernah hanya andalkan validasi klien). Pesan dalam Bahasa Indonesia.
 *
 * Setiap fungsi `validateX` mengembalikan `Errors` = peta field -> pesan.
 * Object kosong berarti valid.
 */
import {
	ROLES,
	USER_STATUSES,
	ACTION_STATUS_INPUTS,
	RESPONSE_STATUSES,
	CHANNELS
} from '$lib/constants/enums';
import type {
	LoginRequest,
	CreateUserRequest,
	UpdateUserRequest,
	CreateCompanyRequest,
	CreateContactRequest,
	UpdateActionStatusRequest,
	UpdateResponseStatusRequest,
	ScheduleMeetingRequest
} from '$lib/types/api';

export type Errors = Record<string, string>;

// ── Primitif ─────────────────────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/; // YYYY-MM-DD
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/; // HH:MM (24 jam)

export const len = (s: string | undefined | null) => (s ? [...s.trim()].length : 0);

export function isEmail(v: string): boolean {
	return EMAIL_RE.test(v);
}

export function isValidDate(v: string): boolean {
	if (!DATE_RE.test(v)) return false;
	const d = new Date(`${v}T00:00:00`);
	return !Number.isNaN(d.getTime()) && v === d.toISOString().slice(0, 10);
}

export function isValidTime(v: string): boolean {
	return TIME_RE.test(v);
}

// ── Login (handler: email required+email, password required min 6) ────────────
export function validateLogin(v: LoginRequest): Errors {
	const e: Errors = {};
	if (!v.email?.trim()) e.email = 'Email wajib diisi.';
	else if (!isEmail(v.email)) e.email = 'Format email tidak valid.';
	if (!v.password) e.password = 'Password wajib diisi.';
	else if (v.password.length < 6) e.password = 'Password minimal 6 karakter.';
	return e;
}

// ── User (dto: name 2..100, email, password min 8, role oneof) ────────────────
export function validateCreateUser(v: CreateUserRequest): Errors {
	const e: Errors = {};
	if (len(v.name) < 2) e.name = 'Nama minimal 2 karakter.';
	else if (len(v.name) > 100) e.name = 'Nama maksimal 100 karakter.';
	if (!v.email?.trim()) e.email = 'Email wajib diisi.';
	else if (!isEmail(v.email)) e.email = 'Format email tidak valid.';
	if (!v.password || v.password.length < 8) e.password = 'Password minimal 8 karakter.';
	if (!ROLES.includes(v.role)) e.role = 'Role harus admin, bdm, atau telesales.';
	return e;
}

export function validateUpdateUser(v: UpdateUserRequest): Errors {
	const e: Errors = {};
	if (v.name !== undefined && v.name !== '' && (len(v.name) < 2 || len(v.name) > 100))
		e.name = 'Nama 2–100 karakter.';
	if (v.email !== undefined && v.email !== '' && !isEmail(v.email))
		e.email = 'Format email tidak valid.';
	if (v.role !== undefined && v.role !== ('' as never) && !ROLES.includes(v.role))
		e.role = 'Role tidak valid.';
	return e;
}

export function validateResetPassword(newPassword: string): Errors {
	const e: Errors = {};
	if (!newPassword || newPassword.length < 8) e.new_password = 'Password baru minimal 8 karakter.';
	return e;
}

export function validateStatus(status: string): Errors {
	const e: Errors = {};
	if (!USER_STATUSES.includes(status as never)) e.status = 'Status harus active atau inactive.';
	return e;
}

// ── Company (dto: name 2..200, sisanya max length opsional) ───────────────────
export function validateCompany(v: CreateCompanyRequest): Errors {
	const e: Errors = {};
	if (len(v.name) < 2) e.name = 'Nama perusahaan minimal 2 karakter.';
	else if (len(v.name) > 200) e.name = 'Nama perusahaan maksimal 200 karakter.';
	if (v.industry && len(v.industry) > 100) e.industry = 'Industri maksimal 100 karakter.';
	if (v.phone && len(v.phone) > 20) e.phone = 'Telepon maksimal 20 karakter.';
	if (v.website && len(v.website) > 255) e.website = 'Website maksimal 255 karakter.';
	return e;
}

// ── Contact (dto: name 2..100, job_title/email max, phone max 20) ─────────────
export function validateContact(v: CreateContactRequest): Errors {
	const e: Errors = {};
	if (len(v.name) < 2) e.name = 'Nama kontak minimal 2 karakter.';
	else if (len(v.name) > 100) e.name = 'Nama kontak maksimal 100 karakter.';
	if (v.job_title && len(v.job_title) > 100) e.job_title = 'Jabatan maksimal 100 karakter.';
	if (v.phone && len(v.phone) > 20) e.phone = 'Telepon maksimal 20 karakter.';
	if (v.email && (!isEmail(v.email) || len(v.email) > 150))
		e.email = 'Email tidak valid (maks 150 karakter).';
	return e;
}

// ── Action Status (dto: action_status oneof input, channel oneof, notes opsional)
export function validateActionStatus(v: UpdateActionStatusRequest): Errors {
	const e: Errors = {};
	if (!ACTION_STATUS_INPUTS.includes(v.action_status))
		e.action_status = 'Pilih: Sudah Dihubungi atau Tidak Bisa Dihubungi.';
	if (!CHANNELS.includes(v.channel)) e.channel = 'Channel wajib dipilih.';
	return e;
}

// ── Response Status (dto: response_status oneof, notes opsional) ───────────────
export function validateResponseStatus(v: UpdateResponseStatusRequest): Errors {
	const e: Errors = {};
	if (!RESPONSE_STATUSES.includes(v.response_status))
		e.response_status = 'Status respon wajib dipilih.';
	return e;
}

// ── Schedule Meeting (dto: date & time required; location max 255 opsional) ───
export function validateMeeting(v: ScheduleMeetingRequest): Errors {
	const e: Errors = {};
	if (!v.meeting_date) e.meeting_date = 'Tanggal meeting wajib diisi.';
	else if (!isValidDate(v.meeting_date)) e.meeting_date = 'Format tanggal harus YYYY-MM-DD.';
	if (!v.meeting_time) e.meeting_time = 'Waktu meeting wajib diisi.';
	else if (!isValidTime(v.meeting_time)) e.meeting_time = 'Format waktu harus HH:MM (24 jam).';
	if (v.location && len(v.location) > 255) e.location = 'Lokasi maksimal 255 karakter.';
	return e;
}

/** Helper: true bila tidak ada error. */
export const isValid = (e: Errors): boolean => Object.keys(e).length === 0;
