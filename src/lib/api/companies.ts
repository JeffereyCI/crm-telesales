/** Endpoint Companies. Tulis = BDM; baca = BDM + Telesales (lihat rbac.ts). */
import { api, downloadFile } from './client';
import {
	sanitizeText,
	sanitizeMultiline,
	sanitizePhone,
	sanitizeWebsite,
	pruneEmpty
} from '$lib/utils/sanitize';
import type {
	CompanyListResponse,
	CompanyDetailResponse,
	CompanyResponse,
	CreateCompanyRequest,
	UpdateCompanyRequest,
	AssignCompanyRequest,
	ReassignCompanyRequest,
	ImportResult,
	CompanyListFilter
} from '$lib/types/api';

/** Bersihkan payload company (dipakai create & update). */
function cleanCompany(input: CreateCompanyRequest) {
	return pruneEmpty({
		name: sanitizeText(input.name),
		industry: input.industry ? sanitizeText(input.industry) : undefined,
		address: input.address ? sanitizeMultiline(input.address) : undefined,
		phone: input.phone ? sanitizePhone(input.phone) : undefined,
		website: input.website ? sanitizeWebsite(input.website) : undefined
	});
}

export const listCompanies = (filter: CompanyListFilter = {}, signal?: AbortSignal) =>
	api.get<CompanyListResponse>('/companies', { query: filter as Record<string, unknown>, signal });

export const getCompany = (id: string) => api.get<CompanyDetailResponse>(`/companies/${id}`);

export const createCompany = (input: CreateCompanyRequest) =>
	api.post<CompanyResponse>('/companies', { body: cleanCompany(input) });

export const updateCompany = (id: string, input: UpdateCompanyRequest) =>
	api.put<CompanyResponse>(`/companies/${id}`, { body: cleanCompany(input) });

export const deleteCompany = (id: string) => api.del<{ message: string }>(`/companies/${id}`);

export const assignCompanies = (input: AssignCompanyRequest) =>
	api.post<void>('/companies/assign', { body: input });

export const reassignCompanies = (input: ReassignCompanyRequest) =>
	api.post<void>('/companies/reassign', {
		body: pruneEmpty({
			company_ids: input.company_ids,
			new_assigned_to: input.new_assigned_to,
			notes: input.notes ? sanitizeMultiline(input.notes) : undefined
		})
	});

/** Import Excel/CSV (multipart). */
export const importCompanies = (file: File) => {
	const form = new FormData();
	form.append('file', file);
	return api.post<ImportResult>('/companies/import', { formData: form });
};

/** Unduh template Excel untuk import. */
export const downloadImportTemplate = () =>
	downloadFile('/companies/import/template', 'template-import-companies.xlsx');
