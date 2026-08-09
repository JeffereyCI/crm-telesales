import { api } from './client';
import { pruneEmpty, sanitizeMultiline, sanitizeText } from '$lib/utils/sanitize';
import type {
	ImplementationActivityListResponse,
	ImplementationProjectFilter,
	ImplementationProjectListResponse,
	ImplementationProjectResponse,
	UpdateImplementationProjectRequest
} from '$lib/types/api';

export const listByCompany = (
	companyId: string,
	filter: ImplementationProjectFilter = {},
	signal?: AbortSignal
) =>
	api.get<ImplementationProjectListResponse>(`/companies/${companyId}/implementation-projects`, {
		query: filter as Record<string, unknown>,
		signal
	});

export const getDetail = (id: string, signal?: AbortSignal) =>
	api.get<ImplementationProjectResponse>(`/implementation-projects/${id}`, { signal });

export const getActivities = (
	id: string,
	filter: { page?: number; limit?: number } = {},
	signal?: AbortSignal
) =>
	api.get<ImplementationActivityListResponse>(`/implementation-projects/${id}/activities`, {
		query: filter as Record<string, unknown>,
		signal
	});

export const update = (id: string, input: UpdateImplementationProjectRequest) =>
	api.patch<ImplementationProjectResponse>(`/implementation-projects/${id}`, {
		body: pruneEmpty({
			expected_version: input.expected_version,
			stage: input.stage,
			delivery_status: input.delivery_status,
			planned_start_date: input.planned_start_date,
			actual_start_date: input.actual_start_date,
			planned_go_live_date: input.planned_go_live_date,
			actual_go_live_date: input.actual_go_live_date,
			notes: input.notes ? sanitizeMultiline(input.notes) : input.notes,
			change_reason: input.change_reason ? sanitizeText(input.change_reason) : input.change_reason
		})
	});
