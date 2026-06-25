/**
 * Decode payload JWT untuk kebutuhan UX SAJA (cek expiry & baca role).
 *
 * ⚠️ KEAMANAN: ini TIDAK memverifikasi signature. Jangan pernah memakai hasil
 * decode di sini untuk keputusan keamanan — otorisasi sebenarnya 100% di backend.
 * Di sini hanya untuk: auto-logout saat token kedaluwarsa & pre-fill UI.
 */
import type { Role } from '$lib/constants/enums';

export interface JwtPayload {
	user_id: string;
	email: string;
	role: Role;
	exp: number; // unix seconds
	iat: number;
}

/** Decode base64url (payload JWT) dengan aman; null bila gagal. */
function base64UrlDecode(segment: string): string | null {
	try {
		const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
		const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
		const decoded = atob(padded + pad);
		// Tangani karakter UTF-8 (mis. nama non-ASCII)
		return decodeURIComponent(
			decoded
				.split('')
				.map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
				.join('')
		);
	} catch {
		return null;
	}
}

export function decodeToken(token: string | null | undefined): JwtPayload | null {
	if (!token) return null;
	const parts = token.split('.');
	if (parts.length !== 3) return null;
	const json = base64UrlDecode(parts[1]);
	if (!json) return null;
	try {
		const payload = JSON.parse(json) as JwtPayload;
		if (!payload || typeof payload.exp !== 'number') return null;
		return payload;
	} catch {
		return null;
	}
}

/**
 * True bila token kedaluwarsa (atau tidak valid). `skewSeconds` memberi margin
 * agar request tidak dikirim dengan token yang akan mati dalam hitungan detik.
 */
export function isTokenExpired(token: string | null | undefined, skewSeconds = 30): boolean {
	const payload = decodeToken(token);
	if (!payload) return true;
	const now = Math.floor(Date.now() / 1000);
	return payload.exp <= now + skewSeconds;
}
