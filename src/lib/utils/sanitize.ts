/**
 * Sanitasi input sebelum dikirim ke backend.
 *
 * Tujuan:
 *  - Normalisasi (trim, rapikan spasi) agar tidak mengirim sampah ke DB.
 *  - Buang karakter kontrol tak terlihat yang bisa memicu masalah.
 *  - Bukan pengganti escaping XSS — Svelte sudah auto-escape saat render.
 *    Sanitasi di sini fokus pada KEBERSIHAN DATA & kepatuhan format backend.
 *
 * Catatan: jangan over-sanitize. Field bebas (notes, agenda, address) hanya
 * di-trim & dibersihkan karakter kontrol; tanda baca normal dibiarkan.
 */

// Karakter kontrol (kecuali \t=09, \n=0A) + zero-width (200B-200D, FEFF).
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\u200B-\u200D\uFEFF]/g;

/** Teks satu baris: trim, buang kontrol, ratakan spasi ganda. */
export function sanitizeText(value: string | null | undefined): string {
	if (value == null) return '';
	return value.replace(CONTROL_CHARS, '').replace(/\s+/g, ' ').trim();
}

/** Teks panjang (notes/agenda/address): pertahankan newline, rapikan sisi. */
export function sanitizeMultiline(value: string | null | undefined): string {
	if (value == null) return '';
	return value
		.replace(CONTROL_CHARS, '')
		.replace(/[^\S\n]+/g, ' ') // spasi/tab ganda -> 1 spasi, newline tetap
		.replace(/\n{3,}/g, '\n\n') // batasi newline beruntun
		.trim();
}

/** Email: trim + lowercase (backend menyimpan/mencocokkan apa adanya). */
export function sanitizeEmail(value: string | null | undefined): string {
	if (value == null) return '';
	return value.replace(CONTROL_CHARS, '').trim().toLowerCase();
}

/**
 * Filter telepon untuk `oninput` (live): buang karakter selain digit & + - ( ) spasi,
 * TANPA trim/collapse agar pengetikan terasa natural (boleh spasi di tengah).
 * Tujuannya: yang dilihat user == yang tersimpan (tak ada alfabet yang diam-diam dibuang).
 */
export function filterPhoneInput(value: string): string {
	return value.replace(/[^\d+()\-\s]/g, '');
}

/** Telepon: hanya izinkan digit, spasi, dan + - ( ). */
export function sanitizePhone(value: string | null | undefined): string {
	if (value == null) return '';
	return value
		.replace(CONTROL_CHARS, '')
		.replace(/[^\d+()\-\s]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Filter for person name fields (live oninput): allow letters (incl. accented),
 * spaces, hyphens, apostrophes, and dots only. No digits or special symbols.
 */
export function filterPersonName(value: string): string {
	// Keep: Unicode letters (\p{L}), spaces, hyphens, apostrophes, dots
	return value.replace(/[^\p{L}\s\-.'']/gu, '');
}

/**
 * Filter for job title fields (live oninput): letters, spaces, hyphens, dots,
 * slashes, ampersands, and parentheses — common in titles like "Sr. Manager / BDM".
 * No digits at start; digits allowed in context (e.g. "VP of Product 2").
 */
export function filterJobTitle(value: string): string {
	return value.replace(/[^\p{L}\d\s\-./&(),']/gu, '');
}

/** Website: trim; tambahkan https:// bila user lupa skema (UX), kosong dibiarkan. */
export function sanitizeWebsite(value: string | null | undefined): string {
	const v = sanitizeText(value);
	if (!v) return '';
	if (!/^https?:\/\//i.test(v)) return `https://${v}`;
	return v;
}

/** Buang field kosong ('' / null / undefined) dari payload agar `omitempty` backend bersih. */
export function pruneEmpty<T extends Record<string, unknown>>(obj: T): Partial<T> {
	const out: Partial<T> = {};
	for (const [k, val] of Object.entries(obj)) {
		if (val === '' || val == null) continue;
		out[k as keyof T] = val as T[keyof T];
	}
	return out;
}
