/** Endpoint Meetings/Kalender. GET /meetings/upcoming (Role BDM & Telesales). */
import { api } from './client';
import type { UpcomingMeetingsResponse, UpcomingMeetingFilter } from '$lib/types/api';

/** Daftar meeting/jadwal dalam rentang tanggal. start_date & end_date wajib. */
export const getUpcoming = (filter: UpcomingMeetingFilter) =>
	api.get<UpcomingMeetingsResponse>('/meetings/upcoming', {
		query: filter as Record<string, unknown>
	});
