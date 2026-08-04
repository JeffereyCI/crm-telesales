/** Endpoint Reports. personal=Telesales; team=BDM; export=BDM+Telesales. */
import { api, downloadFile } from './client';
import type { PersonalReportResponse, TeamReportResponse, ReportFilter } from '$lib/types/api';

export const getPersonalReport = (filter: ReportFilter = {}, signal?: AbortSignal) =>
	api.get<PersonalReportResponse>('/reports/personal', {
		query: filter as Record<string, unknown>,
		signal
	});

export const getTeamReport = (filter: ReportFilter = {}, signal?: AbortSignal) =>
	api.get<TeamReportResponse>('/reports/team', {
		query: filter as Record<string, unknown>,
		signal
	});

/** Export laporan (Blob). Format excel/pdf via filter.format. */
export const exportReport = (filter: ReportFilter = {}) => {
	const ext = filter.format === 'pdf' ? 'pdf' : 'xlsx';
	return downloadFile(`/reports/export`, `laporan.${ext}`, {
		query: filter as Record<string, unknown>
	});
};
