/** Endpoint Leads — Master View (BDM only, lihat rbac.ts). */
import { api } from './client';
import type { LeadMasterViewListResponse, LeadListFilter } from '$lib/types/api';

export const listLeads = (filter: LeadListFilter = {}) =>
	api.get<LeadMasterViewListResponse>('/leads', { query: filter as Record<string, unknown> });
