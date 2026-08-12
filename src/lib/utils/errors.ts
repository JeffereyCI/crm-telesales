/** Helper UX untuk menangani error API secara konsisten (toast, countdown). */
import { ApiError } from '$lib/api/client';

/**
 * Ambil pesan ramah-user dari error apa pun (untuk toast/inline).
 * Menggabungkan `details[]` validasi bila ada.
 */
export function toMessage(err: unknown): string {
	if (err instanceof ApiError) {
		if (Array.isArray(err.details) && err.details.length) return err.details.join(' ');
		return err.message;
	}
	if (err instanceof Error) return err.message;
	return 'Terjadi kesalahan yang tidak diketahui.';
}

export function activeDealConflictId(err: unknown): string | null {
	if (!(err instanceof ApiError) || !err.details || typeof err.details !== 'object') return null;
	const activeDealId = (err.details as { active_deal_id?: unknown }).active_deal_id;
	return typeof activeDealId === 'string' && activeDealId ? activeDealId : null;
}

/** True bila error adalah rate-limit (429). */
export function isRateLimit(err: unknown): err is ApiError {
	return err instanceof ApiError && err.isRateLimit;
}

/** Detik countdown yang disarankan dari error 429 (default 60). */
export function retryAfter(err: unknown): number {
	return err instanceof ApiError ? (err.retryAfterSeconds ?? 60) : 60;
}

/**
 * Membuat countdown rate-limit untuk komponen (mis. tombol login).
 * Pakai di Svelte 5 dengan `$state` di komponen; ini hanya logic tick-nya.
 *
 *   let seconds = $state(0);
 *   const cd = createCountdown((s) => (seconds = s));
 *   // saat tangkap 429: cd.start(retryAfter(err));
 *   // onDestroy(cd.stop);
 */
export function createCountdown(onTick: (secondsLeft: number) => void) {
	let timer: ReturnType<typeof setInterval> | null = null;

	function stop() {
		if (timer) {
			clearInterval(timer);
			timer = null;
		}
	}

	function start(seconds: number) {
		stop();
		let left = Math.max(0, Math.floor(seconds));
		onTick(left);
		timer = setInterval(() => {
			left -= 1;
			onTick(left);
			if (left <= 0) stop();
		}, 1000);
	}

	return { start, stop };
}
