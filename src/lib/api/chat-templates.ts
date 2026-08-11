/**
 * API Client Chat Templates — CRM-012.
 * Owner: BDM & Telesales. Admin tidak punya akses.
 * Deactivation = soft delete idempoten (DELETE → 200, bukan 204).
 */
import { api } from './client';
import type { ChatTemplateRequest, ChatTemplateResponse } from '$lib/types/api';

export interface ListChatTemplatesFilter {
    category?: 'leads' | 'contact' | 'customer';
    include_inactive?: boolean;
}

/** GET /chat-templates — hanya template milik user sendiri. */
export const listTemplates = (filter: ListChatTemplatesFilter = {}, signal?: AbortSignal) =>
    api.get<ChatTemplateResponse[]>('/chat-templates', {
        query: filter as Record<string, unknown>,
        signal
    });

/** GET /chat-templates/:id — detail template milik sendiri. */
export const getTemplate = (id: string, signal?: AbortSignal) =>
    api.get<ChatTemplateResponse>(`/chat-templates/${id}`, { signal });

/** POST /chat-templates — buat template baru (201). */
export const createTemplate = (input: ChatTemplateRequest) =>
    api.post<ChatTemplateResponse>('/chat-templates', { body: input });

/** PUT /chat-templates/:id — ganti seluruh header + bubble template active. */
export const updateTemplate = (id: string, input: ChatTemplateRequest) =>
    api.put<ChatTemplateResponse>(`/chat-templates/${id}`, { body: input });

/**
 * DELETE /chat-templates/:id — deactivation idempoten (bukan physical delete).
 * Response 200 { message: string }.
 */
export const deactivateTemplate = (id: string) =>
    api.del<{ message: string }>(`/chat-templates/${id}`);
