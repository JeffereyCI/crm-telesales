/**
 * Endpoint notifikasi internal (CRM-004).
 * Data selalu di-scope ke user dari JWT oleh backend.
 */
import { api } from './client';
import type {
	NotificationListFilter,
	NotificationListResponse,
	NotificationResponse,
	NotificationStreamEvent
} from '$lib/types/api';

export const listNotifications = (filter: NotificationListFilter = {}, signal?: AbortSignal) =>
	api
		.get<{
			data: NotificationResponse[];
			meta?: { unread_count?: number };
			unread_count?: number;
		}>('/notifications', {
			query: filter as Record<string, unknown>,
			signal
		})
		.then((response): NotificationListResponse => ({
			data: response.data ?? [],
			unread_count: response.meta?.unread_count ?? response.unread_count ?? 0
		}));

export const markAsRead = (id: string) =>
	api.patch<{ message: string; data?: NotificationResponse }>(`/notifications/${id}/read`);

export const markAllAsRead = () => api.patch<{ message: string }>('/notifications/read-all');

/**
 * Membaca satu koneksi SSE sampai server menutup koneksi atau signal dibatalkan.
 * Mendukung frame multiline sesuai spesifikasi SSE dan mengabaikan comment ping.
 */
export async function consumeNotificationStream(
	onEvent: (event: NotificationStreamEvent) => void,
	signal: AbortSignal
): Promise<void> {
	const response = await api.stream('/notifications/stream', signal);
	const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
	let buffer = '';

	const emitFrame = (frame: string) => {
		let event = 'new_notification';
		let id: string | undefined;
		const data: string[] = [];

		for (const line of frame.split(/\r?\n/)) {
			if (!line || line.startsWith(':')) continue;
			const separator = line.indexOf(':');
			const field = separator === -1 ? line : line.slice(0, separator);
			const value = separator === -1 ? '' : line.slice(separator + 1).replace(/^ /, '');
			if (field === 'event') event = value;
			else if (field === 'id') id = value;
			else if (field === 'data') data.push(value);
		}
		if (!data.length) return;

		let payload: unknown = data.join('\n');
		try {
			payload = JSON.parse(payload as string);
		} catch {
			// Payload teks tetap valid untuk heartbeat/connected.
		}
		onEvent({
			event: event as NotificationStreamEvent['event'],
			id,
			data: payload
		});
	};

	try {
		while (!signal.aborted) {
			const { value, done } = await reader.read();
			if (done) break;
			buffer += value;
			const frames = buffer.split(/\r?\n\r?\n/);
			buffer = frames.pop() ?? '';
			for (const frame of frames) emitFrame(frame);
		}
	} finally {
		reader.releaseLock();
	}
}
