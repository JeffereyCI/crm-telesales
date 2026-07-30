/** Endpoint Meetings/Kalender. GET /meetings/upcoming (Role BDM & Telesales). */
import { api } from './client';
import type {
	MeetingDetailResponse,
	UpcomingMeetingsResponse,
	UpcomingMeetingFilter
} from '$lib/types/api';

/** Daftar meeting/jadwal dalam rentang tanggal. start_date & end_date wajib. */
export const getUpcoming = (filter: UpcomingMeetingFilter) =>
	api.get<UpcomingMeetingsResponse>('/meetings/upcoming', {
		query: filter as Record<string, unknown>
	});

/** Detail meeting. Otorisasi BDM/Telesales terkait diterapkan oleh backend. */
export const getByID = (id: string, signal?: AbortSignal) =>
	api
		.get<{ message: string; data: MeetingDetailResponse }>(
			`/meetings/${encodeURIComponent(id)}`,
			{ signal }
		)
		.then((response) => response.data);
