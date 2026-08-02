/** Endpoint Meeting Templates CRM006. List: BDM + Telesales; mutasi: BDM. */
import { api } from './client';
import { sanitizeMultiline, sanitizeText } from '$lib/utils/sanitize';
import type {
	MeetingTemplateFilter,
	MeetingTemplateResponse,
	SaveMeetingTemplateRequest
} from '$lib/types/api';

export const listTemplates = (filter: MeetingTemplateFilter = {}) =>
	api.get<MeetingTemplateResponse[]>('/meeting-templates', {
		query: filter as Record<string, unknown>
	});

function clean(input: SaveMeetingTemplateRequest): SaveMeetingTemplateRequest {
	return {
		name: sanitizeText(input.name),
		body: sanitizeMultiline(input.body),
		category: input.category
	};
}

export const createTemplate = (input: SaveMeetingTemplateRequest) =>
	api.post<MeetingTemplateResponse>('/meeting-templates', { body: clean(input) });

export const updateTemplate = (id: string, input: SaveMeetingTemplateRequest) =>
	api.put<MeetingTemplateResponse>(`/meeting-templates/${id}`, { body: clean(input) });

export const deleteTemplate = (id: string) =>
	api.del<{ message: string }>(`/meeting-templates/${id}`);
