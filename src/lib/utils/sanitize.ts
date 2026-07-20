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

/** Entity bernama yang realistis muncul dari paste (Word/Excel/web). */
const NAMED_ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: '\u00A0',
	ensp: ' ',
	emsp: ' ',
	thinsp: ' ',
	hellip: '\u2026',
	ndash: '\u2013',
	mdash: '\u2014',
	lsquo: '\u2018',
	rsquo: '\u2019',
	ldquo: '\u201C',
	rdquo: '\u201D'
};

/**
 * Decode entity HTML SEKALI (bukan berulang \u2014 decode berulang justru membuka
 * celah `&amp;lt;script&amp;gt;` lolos jadi tag aktif).
 *
 * Kenapa perlu: paste dari Word/web sering membawa `&nbsp;` mentah. Backend
 * (bluemonday UGCPolicy) meng-decode-nya jadi NBSP asli \u2014 spasi tak terlihat
 * yang mengotori DB, export Excel/PDF, dan payload n8n. Lebih baik FE yang
 * menormalkannya jadi spasi biasa sebelum kirim.
 */
function decodeEntities(value: string): string {
	return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, body: string) => {
		if (body[0] === '#') {
			const code =
				body[1] === 'x' || body[1] === 'X'
					? parseInt(body.slice(2), 16)
					: parseInt(body.slice(1), 10);
			// Tolak codepoint di luar rentang valid agar String.fromCodePoint tidak lempar.
			if (!Number.isFinite(code) || code < 0x20 || code > 0x10ffff) return match;
			return String.fromCodePoint(code);
		}
		return NAMED_ENTITIES[body.toLowerCase()] ?? match;
	});
}

/**
 * Buang markup HTML dari teks bebas.
 *
 * Perlu karena bluemonday UGCPolicy MELOLOSKAN tag "aman" seperti <b>/<i>/<a>,
 * sementara FE merender notes sebagai teks biasa (`{a.notes}`) \u2014 hasilnya user
 * melihat literal "<b>tebal</b>". Field CRM ini teks polos, jadi markup apa pun
 * adalah noise. Konsekuensi yang diterima: teks matematis "a<b" ikut terpotong.
 */
function stripTags(value: string): string {
	return value.replace(/<[^>]*>/g, '');
}

/** Bersihkan noise markup: kontrol \u2192 decode entity \u2192 buang tag. */
function stripNoise(value: string): string {
	return stripTags(decodeEntities(value.replace(CONTROL_CHARS, '')));
}

/** Teks satu baris: buang noise HTML, ratakan spasi (termasuk NBSP), trim. */
export function sanitizeText(value: string | null | undefined): string {
	if (value == null) return '';
	return stripNoise(value).replace(/\s+/g, ' ').trim();
}

/** Teks panjang (notes/agenda/address): pertahankan newline, rapikan sisi. */
export function sanitizeMultiline(value: string | null | undefined): string {
	if (value == null) return '';
	return stripNoise(value)
		.replace(/[^\S\n]+/g, ' ') // spasi/tab/NBSP ganda -> 1 spasi, newline tetap
		.replace(/\n{3,}/g, '\n\n') // batasi newline beruntun
		.trim();
}

/**
 * Email: buang SEMUA whitespace (termasuk NBSP hasil paste yang tak terlihat —
 * penyebab klasik "email valid tapi ditolak backend"), lalu lowercase.
 */
export function sanitizeEmail(value: string | null | undefined): string {
	if (value == null) return '';
	return stripNoise(value).replace(/\s+/g, '').toLowerCase();
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
 * Angka DITOLAK: jabatan tidak wajar mengandung angka (preferensi user). Kalau
 * suatu saat butuh angka kontekstual (mis. "Level 2"), tambahkan `\d` kembali.
 */
export function filterJobTitle(value: string): string {
	return value.replace(/[^\p{L}\s\-./&(),']/gu, '');
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
