<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { notificationsApi, toMessage, formatDateTime } from '$lib';
	import { toast } from '$lib/stores/toast.svelte';
	import type { NotificationResponse } from '$lib/types/api';
	import Icon from '$lib/components/ui/Icon.svelte';

	const PAGE_SIZE = 20;
	const MAX_RECONNECT_DELAY_MS = 30_000;
	// Safety net bila event SSE terlewat setelah notifikasi berhasil tersimpan.
	const HISTORY_RECONCILE_INTERVAL_MS = 45_000;

	let notifications = $state<NotificationResponse[]>([]);
	let unreadCount = $state(0);
	let open = $state(false);
	let loading = $state(false);
	let loaded = $state(false);
	let errorMessage = $state('');
	let controller: AbortController | null = null;
	let streamController: AbortController | null = null;
	let realtimeConnected = $state(false);

	function notificationLink(notification: NotificationResponse): string {
		switch (notification.reference_type) {
			case 'meeting':
				return `/dashboard?meeting=${encodeURIComponent(notification.reference_id ?? '')}#agenda`;
			case 'deal':
				return `/pipeline?deal=${encodeURIComponent(notification.reference_id ?? '')}`;
			case 'company':
			default:
				return '/companies';
		}
	}

	async function load(silent = false) {
		if (!silent) loading = true;
		controller?.abort();
		controller = new AbortController();
		try {
			const response = await notificationsApi.listNotifications(
				{ page: 1, limit: PAGE_SIZE },
				controller.signal
			);
			notifications = response.data ?? [];
			unreadCount =
				response.unread_count ??
				notifications.reduce((total, notification) => total + Number(!notification.is_read), 0);
			errorMessage = '';
			loaded = true;
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') return;
			// Polling latar belakang tidak boleh men-spam toast.
			if (!silent) errorMessage = toMessage(error);
		} finally {
			if (!silent) loading = false;
		}
	}

	onMount(() => {
		let disposed = false;
		const wait = (milliseconds: number) =>
			new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));

		const connect = async () => {
			let retry = 0;
			while (!disposed) {
				if (!navigator.onLine) {
					realtimeConnected = false;
					await wait(2_000);
					continue;
				}

				streamController = new AbortController();
				try {
					await notificationsApi.consumeNotificationStream((event) => {
						realtimeConnected = true;
						retry = 0;
						if (event.event === 'new_notification') {
							const incoming = event.data as NotificationResponse;
							if (!incoming?.id || !incoming.message) return;
							const existing = notifications.find((item) => item.id === incoming.id);
							notifications = [
								incoming,
								...notifications.filter((item) => item.id !== incoming.id)
							].slice(0, PAGE_SIZE);
							if (!incoming.is_read && (!existing || existing.is_read)) unreadCount += 1;
						}
					}, streamController.signal);
					if (!disposed) throw new Error('SSE connection closed');
				} catch (error) {
					if (disposed || (error instanceof DOMException && error.name === 'AbortError')) break;
					realtimeConnected = false;
					retry += 1;
					await wait(Math.min(1_000 * 2 ** (retry - 1), MAX_RECONNECT_DELAY_MS));
					// Rekonsiliasi event yang mungkin terjadi selama koneksi putus.
					await load(true);
				}
			}
		};

		void load(true);
		void connect();
		const reconciliationTimer = window.setInterval(
			() => void load(true),
			HISTORY_RECONCILE_INTERVAL_MS
		);
		const refreshWhenVisible = () => {
			if (document.visibilityState === 'visible') {
				void load(true);
			}
		};
		document.addEventListener('visibilitychange', refreshWhenVisible);
		return () => {
			disposed = true;
			window.clearInterval(reconciliationTimer);
			document.removeEventListener('visibilitychange', refreshWhenVisible);
			controller?.abort();
			streamController?.abort();
		};
	});

	async function toggle() {
		open = !open;
		if (open && (!loaded || errorMessage)) await load();
	}

	async function read(notification: NotificationResponse) {
		if (!notification.is_read) {
			notifications = notifications.map((item) =>
				item.id === notification.id ? { ...item, is_read: true } : item
			);
			unreadCount = Math.max(0, unreadCount - 1);
			try {
				await notificationsApi.markAsRead(notification.id);
			} catch (error) {
				notifications = notifications.map((item) =>
					item.id === notification.id ? { ...item, is_read: false } : item
				);
				unreadCount += 1;
				toast.error(toMessage(error));
				return;
			}
		}
		open = false;
		await goto(notificationLink(notification));
	}

	async function readAll() {
		if (!unreadCount) return;
		const previous = notifications;
		const previousCount = unreadCount;
		notifications = notifications.map((item) => ({ ...item, is_read: true }));
		unreadCount = 0;
		try {
			await notificationsApi.markAllAsRead();
		} catch (error) {
			notifications = previous;
			unreadCount = previousCount;
			toast.error(toMessage(error));
		}
	}
</script>

<div class="relative">
	<button
		type="button"
		class="relative rounded-lg p-2 text-white/90 hover:bg-white/15"
		aria-label={`Notifikasi${unreadCount ? `, ${unreadCount} belum dibaca` : ''}`}
		aria-expanded={open}
		aria-haspopup="dialog"
		title="Notifikasi"
		onclick={toggle}
	>
		<Icon name="bell" size={20} />
		{#if unreadCount > 0}
			<span
				class="absolute -top-0.5 -right-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-brand ring-2 ring-brand"
			>
				{unreadCount > 99 ? '99+' : unreadCount}
			</span>
		{/if}
	</button>

	{#if open}
		<div
			role="dialog"
			aria-label="Riwayat notifikasi"
			class="absolute top-12 right-0 z-50 w-[min(24rem,calc(100vw-1rem))] overflow-hidden rounded-xl border border-line bg-surface text-ink shadow-xl"
		>
			<div class="flex items-center justify-between border-b border-line px-4 py-3">
				<div>
					<div class="flex items-center gap-2">
						<p class="text-sm font-semibold">Notifikasi</p>
						<span
							class="h-1.5 w-1.5 rounded-full {realtimeConnected
								? 'bg-emerald-500'
								: 'bg-amber-500'}"
							title={realtimeConnected ? 'Real-time terhubung' : 'Menghubungkan ulang'}
						></span>
					</div>
					<p class="text-xs text-muted">{unreadCount} belum dibaca</p>
				</div>
				{#if unreadCount > 0}
					<button
						type="button"
						class="text-xs font-medium text-brand hover:underline"
						onclick={readAll}
					>
						Tandai semua dibaca
					</button>
				{/if}
			</div>

			<div class="max-h-96 overflow-y-auto">
				{#if loading}
					<p class="px-4 py-8 text-center text-sm text-muted">Memuat notifikasi…</p>
				{:else if errorMessage}
					<div class="px-4 py-8 text-center">
						<p class="text-sm text-red-600">{errorMessage}</p>
						<button
							type="button"
							class="mt-2 text-xs font-medium text-brand"
							onclick={() => load()}
						>
							Coba lagi
						</button>
					</div>
				{:else if notifications.length === 0}
					<p class="px-4 py-10 text-center text-sm text-muted">Belum ada notifikasi.</p>
				{:else}
					{#each notifications as notification (notification.id)}
						<button
							type="button"
							class="flex w-full gap-3 border-b border-line px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-surface-2 {notification.is_read
								? ''
								: 'bg-brand-soft/60'}"
							onclick={() => read(notification)}
						>
							<span
								class="mt-1.5 h-2 w-2 shrink-0 rounded-full {notification.is_read
									? 'bg-transparent'
									: 'bg-brand'}"
							></span>
							<span class="min-w-0">
								<span class="block text-sm leading-5">{notification.message}</span>
								<span class="mt-1 block text-xs text-subtle">
									{formatDateTime(notification.created_at)}
								</span>
							</span>
						</button>
					{/each}
				{/if}
			</div>
		</div>
	{/if}
</div>
