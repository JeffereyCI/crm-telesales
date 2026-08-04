/** Endpoint Contacts & Meeting. CRUD/action-status/meeting = Telesales;
 *  response-status & activities = BDM + Telesales (lihat rbac.ts). */
import { api } from './client';
import {
	sanitizeText,
	sanitizeEmail,
	sanitizePhone,
	sanitizeMultiline,
	pruneEmpty
} from '$lib/utils/sanitize';
import { MEETING_PREREQUISITE, RESPONSE_PREREQUISITE } from '$lib/constants/enums';
import type {
	ContactListResponse,
	ContactResponse,
	ContactListFilter,
	CreateContactRequest,
	UpdateContactRequest,
	UpdateActionStatusRequest,
	UpdateResponseStatusRequest,
	UpdateActionStatusResponse,
	UpdateResponseStatusResponse,
	ScheduleMeetingRequest,
	MeetingResponse,
	ContactActivityListResponse
} from '$lib/types/api';

function cleanContact(input: CreateContactRequest) {
	return pruneEmpty({
		name: sanitizeText(input.name),
		job_title: input.job_title ? sanitizeText(input.job_title) : undefined,
		phone: input.phone ? sanitizePhone(input.phone) : undefined,
		email: input.email ? sanitizeEmail(input.email) : undefined
	});
}

export const listContacts = (
	companyId: string,
	filter: ContactListFilter = {},
	signal?: AbortSignal
) =>
	api.get<ContactListResponse>(`/companies/${companyId}/contacts`, {
		query: filter as Record<string, unknown>,
		signal
	});

export const createContact = (companyId: string, input: CreateContactRequest) =>
	api.post<ContactResponse>(`/companies/${companyId}/contacts`, { body: cleanContact(input) });

export const updateContact = (id: string, input: UpdateContactRequest) =>
	api.put<ContactResponse>(`/contacts/${id}`, { body: cleanContact(input) });

export const deleteContact = (id: string) => api.del<{ message: string }>(`/contacts/${id}`);

export const updateActionStatus = (id: string, input: UpdateActionStatusRequest) =>
	api.patch<UpdateActionStatusResponse>(`/contacts/${id}/action-status`, {
		body: pruneEmpty({
			action_status: input.action_status,
			channel: input.channel,
			notes: input.notes ? sanitizeMultiline(input.notes) : undefined
		})
	});

export const updateResponseStatus = (id: string, input: UpdateResponseStatusRequest) =>
	api.patch<UpdateResponseStatusResponse>(`/contacts/${id}/response-status`, {
		body: pruneEmpty({
			response_status: input.response_status,
			notes: input.notes ? sanitizeMultiline(input.notes) : undefined
		})
	});

/**
 * Jadwalkan meeting. Prasyarat backend: response_status === 'tertarik'.
 * Guard ini hanya UX cepat — backend tetap menolak 400 bila belum 'tertarik'.
 */
export const scheduleMeeting = (id: string, input: ScheduleMeetingRequest) =>
	api.post<MeetingResponse>(`/contacts/${id}/meetings`, {
		// product_id & amount opsional: bila diisi, backend menempelkannya ke Deal
		// yang otomatis dibuat. pruneEmpty membuang field kosong, tapi amount=0 valid
		// (>=0) → kirim eksplisit agar tidak ikut terbuang.
		body: {
			...pruneEmpty({
				meeting_date: input.meeting_date,
				meeting_time: input.meeting_time,
				location: input.location ? sanitizeText(input.location) : undefined,
				agenda: input.agenda ? sanitizeMultiline(input.agenda) : undefined,
				product_id: input.product_id || undefined
			}),
			...(input.amount !== undefined ? { amount: input.amount } : {})
		}
	});

/** True bila tombol "Jadwalkan Meeting" boleh aktif (UX). */
export const canScheduleMeeting = (responseStatus: string | null | undefined): boolean =>
	responseStatus === MEETING_PREREQUISITE;

/**
 * True bila Status Respon boleh diisi/diubah (UX gate): kontak sudah berhasil
 * dihubungi. Cerminan alur funnel — respon baru ada SETELAH kontak dihubungi.
 * Catatan: guard ini hanya UX; backend belum menegakkannya (dua update independen).
 */
export const canRecordResponse = (actionStatus: string | null | undefined): boolean =>
	actionStatus === RESPONSE_PREREQUISITE;

export const getContactActivities = (id: string, signal?: AbortSignal) =>
	api.get<ContactActivityListResponse>(`/contacts/${id}/activities`, { signal });
