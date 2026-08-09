/** Formatter tampilan (locale id-ID). Zero-dependency (Intl bawaan). */

const DATE_FMT = new Intl.DateTimeFormat('id-ID', {
	day: 'numeric',
	month: 'long',
	year: 'numeric'
});
const DATETIME_FMT = new Intl.DateTimeFormat('id-ID', {
	day: 'numeric',
	month: 'short',
	year: 'numeric',
	hour: '2-digit',
	minute: '2-digit'
});
const NUMBER_FMT = new Intl.NumberFormat('id-ID');
const CURRENCY_FMT = new Intl.NumberFormat('id-ID', {
	style: 'currency',
	currency: 'IDR',
	maximumFractionDigits: 0
});

function toFiniteNumber(value: unknown): number {
	if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
	if (typeof value === 'string') {
		const n = Number(value);
		return Number.isFinite(n) ? n : 0;
	}
	return 0;
}

/** "2026-06-25" / ISO → "25 Juni 2026". Null-safe. */
export function formatDate(value: string | null | undefined): string {
	if (!value) return '-';
	const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
	return Number.isNaN(d.getTime()) ? '-' : DATE_FMT.format(d);
}

export function formatDateTime(value: string | null | undefined): string {
	if (!value) return '-';
	const d = new Date(value);
	return Number.isNaN(d.getTime()) ? '-' : DATETIME_FMT.format(d);
}

export function formatNumber(value: number | null | undefined): string {
	return NUMBER_FMT.format(toFiniteNumber(value));
}

/** Nilai Rupiah tanpa desimal — mis. 1500000 → "Rp 1.500.000". Null-safe. */
export function formatCurrency(value: number | null | undefined): string {
	// Intl id-ID memakai "Rp" tanpa spasi; sisipkan spasi agar lebih mudah dibaca.
	return CURRENCY_FMT.format(toFiniteNumber(value)).replace(/^Rp\s?/, 'Rp ');
}

/**
 * Backend mengirim conversion_rate sebagai angka (mis. 42.5).
 * Dibulatkan ke bilangan bulat agar mudah dibaca pengguna awam → "43%".
 */
export function formatPercent(value: number | null | undefined): string {
	return `${Math.round(toFiniteNumber(value))}%`;
}

/** Tampilkan nilai nullable dengan fallback. */
export function orDash(value: string | null | undefined): string {
	return value && value.trim() ? value : '-';
}

/**
 * Normalisasi nomor telepon untuk tautan wa.me (WhatsApp menolak awalan "0" lokal).
 * Ambil digit saja; awalan "0" (format lokal Indonesia) → kode negara "62".
 * Idempoten: nomor yang sudah "62…"/"+62…" dibiarkan. Null bila tak ada digit.
 */
export function waNumber(phone: string | null | undefined): string | null {
	if (!phone) return null;
	let d = phone.replace(/\D/g, '');
	if (!d) return null;
	if (d.startsWith('0')) d = '62' + d.slice(1);
	return d;
}
