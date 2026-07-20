/**
 * Klasifikasi tahap funnel — SATU sumber kebenaran.
 *
 * Dipakai bersama oleh Pipeline Board, LeadSidePanel, dan filter funnel lain
 * agar tidak ada logika stage yang saling menyimpang (blindspot: dulu ada 3
 * salinan yang sudah berbeda perilaku).
 *
 * Aturan prioritas (yang di atas menang):
 *  1. LOSS  — sudah ada respon TAPI bukan 'tertarik' (ditolak / sudah pakai
 *     lain / belum perlu / tidak dibalas). Menang atas Meeting/Close supaya
 *     lead yang gugur tidak "tersangkut" di tahap lanjut hanya karena meeting
 *     sempat terjadwal SEBELUM responnya berubah jadi negatif.
 *  2. CLOSE — tertarik + meeting terjadwal.
 *  3. MEETING — meeting terjadwal, atau tertarik (siap dijadwalkan).
 *  4. CONTACT — sudah/ tidak bisa dihubungi (ada aksi, belum ada respon).
 *  5. LEADS — belum dihubungi.
 */
import type { ActionStatus, ResponseStatus } from '$lib/constants/enums';

export type Stage = 'leads' | 'contact' | 'meeting' | 'close' | 'loss';

/** Bentuk minimal yang dibutuhkan untuk menurunkan tahap funnel. */
export interface Staged {
	action_status: ActionStatus;
	response_status?: ResponseStatus | null;
	is_meeting_scheduled?: boolean | null;
}

export function toStage(item: Staged): Stage {
	// Respon ada & bukan 'tertarik' ⇒ gugur, apa pun status meeting-nya.
	if (item.response_status && item.response_status !== 'tertarik') return 'loss';
	if (item.response_status === 'tertarik' && item.is_meeting_scheduled) return 'close';
	if (item.is_meeting_scheduled) return 'meeting';
	if (item.response_status === 'tertarik') return 'meeting';
	if (item.action_status !== 'belum_dihubungi') return 'contact';
	return 'leads';
}

export const STAGE_LABEL: Record<Stage, string> = {
	leads: 'Leads',
	contact: 'Contact',
	meeting: 'Meeting',
	close: 'Close',
	loss: 'Loss'
};

/** Warna badge per tahap (selaras kolom Pipeline Board, light + dark). */
export const STAGE_BADGE: Record<Stage, string> = {
	leads: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
	contact: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
	meeting: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
	close: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
	loss: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
};
