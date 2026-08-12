import { api } from './client';
import type {
	QuickChatRenderResponse,
	QuickChatDeliveryAccepted,
	QuickChatDeliveryStatus
} from '$lib/types/api';

/**
 * Render preview of a Quick Chat message.
 * Does not send the message.
 */
export const renderQuickChat = (contactId: string, templateId: string, signal?: AbortSignal) =>
	api.post<QuickChatRenderResponse>('/quick-chat/render', {
		body: { contact_id: contactId, template_id: templateId },
		signal
	});

/**
 * Create a delivery request for Quick Chat.
 * Requires an idempotency key to prevent double sending.
 */
export const createDelivery = async (
	contactId: string,
	templateId: string,
	idempotencyKey: string,
	signal?: AbortSignal
): Promise<{ data: QuickChatDeliveryAccepted; replayed: boolean }> => {
	const res = await api.postMeta<QuickChatDeliveryAccepted>('/quick-chat/deliveries', {
		body: { contact_id: contactId, template_id: templateId },
		headers: { 'Idempotency-Key': idempotencyKey },
		signal
	});
	return {
		data: res.data,
		replayed: res.headers.get('Idempotency-Replayed') === 'true'
	};
};

/**
 * Poll for the status of a Quick Chat delivery.
 */
export const getDelivery = (deliveryId: string, signal?: AbortSignal) =>
	api.get<QuickChatDeliveryStatus>(`/quick-chat/deliveries/${deliveryId}`, { signal });
