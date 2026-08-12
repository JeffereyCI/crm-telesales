import { api } from './client';
import type {
	LeadAutomationSettings,
	LeadAutomationSettingsRequest,
	LeadAutomationRun,
	LeadAutomationResult
} from '$lib/types/api';

/** GET /automation/lead-settings — ambil config lead automation */
export const getSettings = (signal?: AbortSignal) =>
	api.get<LeadAutomationSettings>('/automation/lead-settings', { signal });

/** PUT /automation/lead-settings — simpan config lead automation */
export const saveSettings = (body: LeadAutomationSettingsRequest, signal?: AbortSignal) =>
	api.put<LeadAutomationSettings>('/automation/lead-settings', { body, signal });

/** GET /automation/lead-runs/:id — ambil detail run automation */
export const getRun = (id: string, signal?: AbortSignal) =>
	api.get<LeadAutomationRun>(`/automation/lead-runs/${id}`, { signal });

/** GET /automation/lead-results — ambil daftar hasil automation terbaru */
export const getRecentResults = (signal?: AbortSignal) =>
	api.get<LeadAutomationResult[]>('/automation/lead-results', { signal });
