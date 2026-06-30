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
	return value == null ? '0' : NUMBER_FMT.format(value);
}

/**
 * Backend mengirim conversion_rate sebagai angka (mis. 42.5).
 * Dibulatkan ke bilangan bulat agar mudah dibaca pengguna awam → "43%".
 */
export function formatPercent(value: number | null | undefined): string {
	if (value == null) return '0%';
	return `${Math.round(value)}%`;
}

/** Tampilkan nilai nullable dengan fallback. */
export function orDash(value: string | null | undefined): string {
	return value && value.trim() ? value : '-';
}
