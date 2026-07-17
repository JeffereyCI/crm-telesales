/** Endpoint Leads — Master View (BDM + Telesales; telesales di-scope ke assigned_to oleh backend). */
import { api } from './client';
import type { LeadMasterViewListResponse, LeadListFilter } from '$lib/types/api';

export const listLeads = (filter: LeadListFilter = {}) =>
	api.get<LeadMasterViewListResponse>('/leads', { query: filter as Record<string, unknown> });
