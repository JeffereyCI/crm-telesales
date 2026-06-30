/**
 * Toast store (Svelte 5 runes) — feedback ringkas untuk sukses/error/info.
 * Render oleh `ui/Toaster.svelte`. Auto-dismiss default 4 detik.
 */
export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
	id: number;
	type: ToastType;
	message: string;
}

class ToastStore {
	items = $state<ToastItem[]>([]);
	#seq = 0;

	push(type: ToastType, message: string, ttl = 4000) {
		const id = ++this.#seq;
		this.items = [...this.items, { id, type, message }];
		if (ttl > 0) setTimeout(() => this.dismiss(id), ttl);
		return id;
	}

	dismiss(id: number) {
		this.items = this.items.filter((t) => t.id !== id);
	}

	success(message: string) {
		return this.push('success', message);
	}
	error(message: string) {
		return this.push('error', message, 6000);
	}
	info(message: string) {
		return this.push('info', message);
	}
}

export const toast = new ToastStore();
