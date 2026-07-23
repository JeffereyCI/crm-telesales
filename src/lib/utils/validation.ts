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
	// Bandingkan komponen secara lokal — JANGAN round-trip lewat toISOString()/UTC,
	// karena di timezone positif (mis. GMT+7) tanggal akan tergeser mundur 1 hari
	// sehingga tanggal yang valid keliru ditolak.
	const [y, m, d] = v.split('-').map(Number);
	if (m < 1 || m > 12 || d < 1 || d > 31) return false;
	const date = new Date(y, m - 1, d);
	return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

export function isValidTime(v: string): boolean {
	return TIME_RE.test(v);
}

/**
 * Kebijakan password untuk field yang MENYETEL password (buat user & reset).
 * Aturan: huruf besar, huruf kecil, angka, dan simbol — plus panjang minimum.
 *
 * Catatan: minimum efektif = 8 karakter karena backend (internal/dto/user.go)
 * mengikat `min=8` pada create & reset password. Memakai 6 akan ditolak backend
 * (400). Jadi kompleksitas sesuai permintaan + panjang selaras backend.
 */
export const PASSWORD_MIN = 8;

export function passwordIssues(pw: string): string[] {
	const issues: string[] = [];
	if (pw.length < PASSWORD_MIN) issues.push(`at least ${PASSWORD_MIN} characters`);
	if (!/[A-Z]/.test(pw)) issues.push('uppercase letter');
	if (!/[a-z]/.test(pw)) issues.push('lowercase letter');
	if (!/[0-9]/.test(pw)) issues.push('number');
	if (!/[^A-Za-z0-9]/.test(pw)) issues.push('symbol');
	return issues;
}

/** Ready-to-use password error message (empty = valid). */
export function passwordError(pw: string): string {
	const issues = passwordIssues(pw);
	return issues.length ? `Password must contain: ${issues.join(', ')}.` : '';
}

// ── Login ───────────────────────────────────────────────────────────────────
export function validateLogin(v: LoginRequest): Errors {
	const e: Errors = {};
	if (!v.email?.trim()) e.email = 'Email is required.';
	else if (!isEmail(v.email)) e.email = 'Invalid email format.';
	if (!v.password) e.password = 'Password is required.';
	else if (v.password.length < 6) e.password = 'Password must be at least 6 characters.';
	return e;
}

// ── User ──────────────────────────────────────────────────────────────────────
const NAME_RE = /^[\p{L}\d\s\-.']+$/u;

export function validateCreateUser(v: CreateUserRequest): Errors {
	const e: Errors = {};
	if (len(v.name) < 2) e.name = 'Name must be at least 2 characters.';
	else if (len(v.name) > 100) e.name = 'Name must not exceed 100 characters.';
	else if (!NAME_RE.test(v.name.trim()))
		e.name = 'Name may only contain letters, number, spaces, hyphens, and apostrophes.';
	if (!v.email?.trim()) e.email = 'Email is required.';
	else if (!isEmail(v.email)) e.email = 'Invalid email format.';
	if (!v.password) e.password = 'Password is required.';
	else {
		const pwErr = passwordError(v.password);
		if (pwErr) e.password = pwErr;
	}
	if (!ROLES.includes(v.role)) e.role = 'Role must be admin, bdm, or telesales.';
	return e;
}

export function validateUpdateUser(v: UpdateUserRequest): Errors {
	const e: Errors = {};
	if (v.name !== undefined && v.name !== '' && (len(v.name) < 2 || len(v.name) > 100))
		e.name = 'Name must be 2–100 characters.';
	if (v.name && !NAME_RE.test(v.name.trim()))
		e.name = 'Name may only contain letters, numbers, spaces, hyphens, and apostrophes.';
	if (v.email !== undefined && v.email !== '' && !isEmail(v.email))
		e.email = 'Invalid email format.';
	if (v.role !== undefined && v.role !== ('' as never) && !ROLES.includes(v.role))
		e.role = 'Invalid role.';
	return e;
}

export function validateResetPassword(newPassword: string): Errors {
	const e: Errors = {};
	if (!newPassword) e.new_password = 'New password is required.';
	else {
		const pwErr = passwordError(newPassword);
		if (pwErr) e.new_password = pwErr;
	}
	return e;
}

/**
 * Ganti password sendiri (PATCH /users/me/password).
 * Backend hanya mewajibkan old_password ada + new_password min=8; aturan
 * kompleksitas & konfirmasi di bawah adalah lapisan UX (selaras validateResetPassword).
 */
export function validateChangePassword(
	oldPassword: string,
	newPassword: string,
	confirmPassword: string
): Errors {
	const e: Errors = {};
	if (!oldPassword) e.old_password = 'Password lama wajib diisi.';

	if (!newPassword) e.new_password = 'Password baru wajib diisi.';
	else {
		const pwErr = passwordError(newPassword);
		if (pwErr) e.new_password = pwErr;
		else if (newPassword === oldPassword)
			e.new_password = 'Password baru harus berbeda dari password lama.';
	}

	if (!confirmPassword) e.confirm_password = 'Konfirmasi password wajib diisi.';
	else if (confirmPassword !== newPassword) e.confirm_password = 'Konfirmasi password tidak cocok.';

	return e;
}

export function validateStatus(status: string): Errors {
	const e: Errors = {};
	if (!USER_STATUSES.includes(status as never)) e.status = 'Status must be active or inactive.';
	return e;
}

// ── Company ───────────────────────────────────────────────────────────────────
export function validateCompany(v: CreateCompanyRequest): Errors {
	const e: Errors = {};
	if (len(v.name) < 2) e.name = 'Account name must be at least 2 characters.';
	else if (len(v.name) > 200) e.name = 'Account name must not exceed 200 characters.';
	if (v.industry && len(v.industry) > 100) e.industry = 'Industry must not exceed 100 characters.';
	if (v.phone && len(v.phone) > 20) e.phone = 'Phone must not exceed 20 characters.';
	if (v.website && len(v.website) > 255) e.website = 'Website must not exceed 255 characters.';
	return e;
}

// ── Contact ───────────────────────────────────────────────────────────────────
// Extra UI rules (stricter than backend, for data quality):
//  - Job title is REQUIRED.
//  - At least ONE of phone / email must be filled (need a contact channel).
const PHONE_RE = /^[+\d()\-\s]+$/;

export function validateContact(v: CreateContactRequest): Errors {
	const e: Errors = {};
	if (len(v.name) < 2) e.name = 'Full name must be at least 2 characters.';
	else if (len(v.name) > 100) e.name = 'Full name must not exceed 100 characters.';
	else if (/\d/.test(v.name ?? '')) e.name = 'Name must not contain numbers.';

	if (!v.job_title?.trim()) e.job_title = 'Job title is required.';
	else if (len(v.job_title) > 100) e.job_title = 'Job title must not exceed 100 characters.';
	else if (/\d/.test(v.job_title)) e.job_title = 'Job title must not contain numbers.';

	const hasPhone = !!v.phone?.trim();
	const hasEmail = !!v.email?.trim();
	if (!hasPhone && !hasEmail) {
		e.phone = 'At least one of phone or email is required.';
		e.email = 'At least one of phone or email is required.';
	} else {
		if (hasPhone) {
			const digits = (v.phone ?? '').replace(/\D/g, '');
			if (len(v.phone) > 20) e.phone = 'Phone must not exceed 20 characters.';
			else if (!PHONE_RE.test(v.phone!))
				e.phone = 'Phone may only contain digits, +, -, spaces, and parentheses.';
		}
		if (hasEmail && (!isEmail(v.email!) || len(v.email) > 150))
			e.email = 'Invalid email address (max 150 characters).';
	}
	return e;
}

// ── Action Status ─────────────────────────────────────────────────────────────
export function validateActionStatus(v: UpdateActionStatusRequest): Errors {
	const e: Errors = {};
	if (!ACTION_STATUS_INPUTS.includes(v.action_status))
		e.action_status = 'Select: Contacted or Cannot Be Reached.';
	if (!CHANNELS.includes(v.channel)) e.channel = 'Channel is required.';
	return e;
}

// ── Response Status ───────────────────────────────────────────────────────────
export function validateResponseStatus(v: UpdateResponseStatusRequest): Errors {
	const e: Errors = {};
	if (!RESPONSE_STATUSES.includes(v.response_status))
		e.response_status = 'Response status is required.';
	return e;
}

// ── Schedule Meeting ──────────────────────────────────────────────────────────
export function validateMeeting(v: ScheduleMeetingRequest): Errors {
	const e: Errors = {};
	if (!v.meeting_date) e.meeting_date = 'Meeting date is required.';
	else if (!isValidDate(v.meeting_date)) e.meeting_date = 'Date format must be YYYY-MM-DD.';
	if (!v.meeting_time) e.meeting_time = 'Meeting time is required.';
	else if (!isValidTime(v.meeting_time)) e.meeting_time = 'Time format must be HH:MM (24h).';
	// Tolak jadwal di masa lalu. Bandingkan pakai komponen LOKAL (new Date(y,m,d,h,i))
	// vs Date.now() — JANGAN lewat toISOString()/UTC, karena di timezone positif
	// (GMT+7) tanggal/jam hari ini bisa keliru dianggap "lampau".
	if (!e.meeting_date && !e.meeting_time) {
		const [y, mo, d] = v.meeting_date.split('-').map(Number);
		const [hh, mi] = v.meeting_time.split(':').map(Number);
		if (new Date(y, mo - 1, d, hh, mi).getTime() < Date.now())
			e.meeting_date = 'Meeting cannot be scheduled in the past.';
	}
	if (v.location && len(v.location) > 255) e.location = 'Location must not exceed 255 characters.';
	return e;
}

/** Helper: true bila tidak ada error. */
export const isValid = (e: Errors): boolean => Object.keys(e).length === 0;
