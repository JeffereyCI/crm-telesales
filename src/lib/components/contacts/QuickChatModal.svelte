<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { chatTemplatesApi, quickChatApi, LatestRequest, toMessage, ApiError } from '$lib';
	import { toast } from '$lib/stores/toast.svelte';
	import type {
		ContactDetailResponse,
		ChatTemplateResponse,
		QuickChatRenderResponse,
		QuickChatDeliveryStatus
	} from '$lib/types/api';
	import type { CompanyStaging } from '$lib/constants/enums';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import LoadingState from '$lib/components/ui/LoadingState.svelte';
	import Alert from '$lib/components/ui/Alert.svelte';

	interface Props {
		contact: ContactDetailResponse;
		companyStatus: CompanyStaging;
		onclose: () => void;
	}
	let { contact, companyStatus, onclose }: Props = $props();

	// Step 1: Selection & Preview
	let step = $state<1 | 2>(1);
	let templates = $state<ChatTemplateResponse[]>([]);
	let templatesLoading = $state(true);
	let templatesError = $state('');
	const loadRequest = new LatestRequest();

	let selectedTemplateId = $state('');
	let templateOptions = $derived(templates.map((t) => ({ value: t.id, label: t.name })));

	let preview = $state<QuickChatRenderResponse | null>(null);
	let previewLoading = $state(false);
	let previewError = $state('');
	const previewRequest = new LatestRequest();

	// Step 2: Delivery & Polling
	let deliveryId = $state<string | null>(null);
	let deliveryStatus = $state<QuickChatDeliveryStatus | null>(null);
	let sending = $state(false);
	let pollError = $state('');
	let idempotencyKey = $state(crypto.randomUUID());

	let pollTimer: ReturnType<typeof setTimeout> | null = null;
	let pollTimeout: ReturnType<typeof setTimeout> | null = null;
	const POLL_INTERVAL_MS = 2000;
	const MAX_POLL_MS = 300000; // 5 minutes
	let pollTimeoutReached = $state(false);

	async function loadTemplates() {
		const controller = loadRequest.start();
		templatesLoading = true;
		templatesError = '';
		try {
			// Backend list endpoint handles filtering by category and active status.
			// Currently the category is either leads, contact, or customer which maps to companyStatus.
			// Let's typecast companyStatus to ChatTemplateCategory if needed.
			const res = await chatTemplatesApi.listTemplates(
				{ category: companyStatus as 'leads' | 'contact' | 'customer' },
				controller.signal
			);
			if (!loadRequest.isCurrent(controller)) return;
			templates = res.filter((t) => t.status === 'active');
			if (templates.length > 0) {
				selectedTemplateId = templates[0].id;
			}
		} catch (err) {
			if (!loadRequest.isCurrent(controller)) return;
			templatesError = toMessage(err);
		} finally {
			if (loadRequest.finish(controller)) templatesLoading = false;
		}
	}

	async function loadPreview() {
		if (!selectedTemplateId) {
			preview = null;
			return;
		}
		const controller = previewRequest.start();
		previewLoading = true;
		previewError = '';
		try {
			const res = await quickChatApi.renderQuickChat(
				contact.id,
				selectedTemplateId,
				controller.signal
			);
			if (!previewRequest.isCurrent(controller)) return;
			preview = res;
		} catch (err) {
			if (!previewRequest.isCurrent(controller)) return;
			previewError = toMessage(err);
			preview = null;
		} finally {
			if (previewRequest.finish(controller)) previewLoading = false;
		}
	}

	$effect(() => {
		if (step === 1 && selectedTemplateId && !templatesLoading) {
			void loadPreview();
		}
	});

	onMount(() => {
		void loadTemplates();
	});

	onDestroy(() => {
		loadRequest.abort();
		previewRequest.abort();
		stopPolling();
	});

	function stopPolling() {
		if (pollTimer) clearTimeout(pollTimer);
		if (pollTimeout) clearTimeout(pollTimeout);
		pollTimer = null;
		pollTimeout = null;
	}

	function startPolling(id: string) {
		stopPolling();
		deliveryId = id;
		pollTimeoutReached = false;

		pollTimeout = setTimeout(() => {
			stopPolling();
			pollTimeoutReached = true;
		}, MAX_POLL_MS);

		const poll = async () => {
			if (!deliveryId) return;
			try {
				const status = await quickChatApi.getDelivery(deliveryId);
				deliveryStatus = status;

				const terminalStates = ['sent', 'partially_sent', 'failed', 'fallback_required'];
				if (terminalStates.includes(status.status)) {
					stopPolling();
					return;
				}
			} catch (err) {
				stopPolling();
				pollError = toMessage(err);
				return;
			}
			pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
		};

		void poll();
	}

	async function refreshStatus() {
		if (!deliveryId) return;
		pollError = '';
		try {
			deliveryStatus = await quickChatApi.getDelivery(deliveryId);
		} catch (err) {
			pollError = toMessage(err);
		}
	}

	async function sendQuickChat() {
		if (!selectedTemplateId || sending) return;
		sending = true;
		pollError = '';

		try {
			const res = await quickChatApi.createDelivery(contact.id, selectedTemplateId, idempotencyKey);
			// Note: if res.replayed is true, it means we reused an idempotency key that already succeeded.
			// This is fine, we just proceed to poll.

			step = 2;
			deliveryId = res.data.delivery_id;
			await startPolling(res.data.delivery_id);
		} catch (err) {
			if (err instanceof ApiError && err.status === 409) {
				toast.error(`Gagal mengirim: ${err.message}`);
				if (err.code === 'IDEMPOTENCY_KEY_REUSED') {
					// Extremely rare, reset key
					idempotencyKey = crypto.randomUUID();
				}
			} else {
				toast.error(toMessage(err));
			}
		} finally {
			sending = false;
		}
	}

	async function copyFallback() {
		if (!deliveryStatus?.fallback_text) return;
		try {
			await navigator.clipboard.writeText(deliveryStatus.fallback_text);
			toast.success('Pesan fallback disalin ke clipboard.');
		} catch {
			toast.error('Gagal menyalin pesan.');
		}
	}

	// Helpers
	const isTerminal = $derived(
		deliveryStatus &&
			['sent', 'partially_sent', 'failed', 'fallback_required'].includes(deliveryStatus.status)
	);
</script>

<Modal title={step === 1 ? 'Kirim Quick Chat' : 'Status Pengiriman'} size="md" {onclose}>
	<div class="space-y-4">
		{#if step === 1}
			<!-- STEP 1: Template Selection & Preview -->
			{#if templatesLoading}
				<LoadingState />
			{:else if templatesError}
				<Alert variant="error">{templatesError}</Alert>
			{:else if templates.length === 0}
				<div class="rounded-xl border border-dashed border-line p-6 text-center">
					<Icon name="message-square" size={32} class="mx-auto mb-2 text-subtle" />
					<p class="font-medium text-ink">Tidak ada Template</p>
					<p class="text-sm text-muted">
						Belum ada template chat aktif untuk kategori {companyStatus}.
					</p>
				</div>
			{:else}
				<div>
					<Select
						label="Pilih Template"
						bind:value={selectedTemplateId}
						options={templateOptions}
						required
					/>
				</div>

				<div class="rounded-xl border border-line bg-surface-2 p-4">
					<h3 class="mb-3 text-sm font-semibold text-ink-soft">Preview Pesan</h3>

					{#if previewLoading}
						<LoadingState />
					{:else if previewError}
						<Alert variant="error">{previewError}</Alert>
					{:else if preview}
						{#if preview.warnings && preview.warnings.length > 0}
							<div class="mb-4 space-y-2">
								{#each preview.warnings as warn (warn.code)}
									<Alert variant="warning">
										{#if warn.code === 'CONTACT_NAME_FALLBACK'}
											Nama kontak tidak tersedia, disesuaikan menjadi "Bapak/Ibu".
										{:else if warn.code === 'CONTACT_POSITION_FALLBACK'}
											Posisi kontak tidak tersedia, disesuaikan menjadi "-".
										{:else if warn.code === 'COMPANY_NAME_FALLBACK'}
											Nama perusahaan tidak tersedia, disesuaikan menjadi "-".
										{:else if warn.code === 'SENDER_NAME_FALLBACK'}
											Nama pengirim tidak tersedia, disesuaikan menjadi "-".
										{:else}
											Peringatan ({warn.code}): {warn.field}
										{/if}
									</Alert>
								{/each}
							</div>
						{/if}

						<div class="space-y-3">
							{#each preview.bubbles as bubble (bubble.position)}
								<div
									class="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm whitespace-pre-wrap text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100"
								>
									{bubble.body}
								</div>
								{#if bubble.effective_delay_seconds > 0}
									<div class="flex justify-center text-xs text-muted">
										<Icon name="clock" size={12} class="mr-1" />
										Delay {bubble.effective_delay_seconds} detik
									</div>
								{/if}
							{/each}
						</div>
					{:else}
						<p class="py-4 text-center text-sm text-muted">Pilih template untuk melihat preview.</p>
					{/if}
				</div>
			{/if}
		{:else}
			<!-- STEP 2: Delivery Polling -->
			{#if deliveryStatus}
				<div class="mb-4 flex items-center justify-between">
					<h3 class="font-semibold text-ink">
						Status:
						{#if deliveryStatus.status === 'queued'}
							<span class="text-muted">Dalam antrean</span>
						{:else if deliveryStatus.status === 'processing'}
							<span class="text-blue-600">Sedang diproses...</span>
						{:else if deliveryStatus.status === 'sent'}
							<span class="text-emerald-600">Berhasil Terkirim</span>
						{:else if deliveryStatus.status === 'partially_sent'}
							<span class="text-amber-600">Terkirim Sebagian</span>
						{:else if deliveryStatus.status === 'fallback_required'}
							<span class="text-orange-600">Manual Fallback</span>
						{:else if deliveryStatus.status === 'failed'}
							<span class="text-red-600">Gagal Terkirim</span>
						{/if}
					</h3>
					<span class="text-xs text-muted">
						Terkirim {deliveryStatus.sent_bubbles} / {deliveryStatus.total_bubbles}
					</span>
				</div>

				<div class="mb-6 space-y-3">
					{#each deliveryStatus.bubbles as bubble (bubble.position)}
						<div class="flex items-center justify-between rounded-lg border border-line p-3">
							<span class="text-sm font-medium">Bubble {bubble.position}</span>
							<div class="flex items-center gap-2">
								{#if bubble.state === 'sent'}
									<span class="flex items-center gap-1 text-xs text-emerald-600">
										<Icon name="check-circle" size={14} /> Terkirim
									</span>
								{:else if bubble.state === 'failed'}
									<span class="flex items-center gap-1 text-xs text-red-600">
										<Icon name="x-circle" size={14} /> Gagal
										{#if bubble.provider_error_category}
											({bubble.provider_error_category})
										{/if}
									</span>
								{:else if bubble.state === 'processing'}
									<span class="flex items-center gap-1 text-xs text-blue-600">
										<Icon name="loader-2" size={14} class="animate-spin" /> Proses
									</span>
								{:else}
									<span class="text-xs text-muted">Menunggu</span>
								{/if}
							</div>
						</div>
					{/each}
				</div>

				{#if deliveryStatus.status === 'fallback_required'}
					<div
						class="rounded-xl border border-orange-200 bg-orange-50 p-4 dark:border-orange-900/50 dark:bg-orange-950/20"
					>
						<h4 class="mb-2 font-semibold text-orange-800 dark:text-orange-300">
							Pesan belum terkirim melalui server
						</h4>

						{#if deliveryStatus.fallback_available && deliveryStatus.fallback_url}
							<p class="mb-4 text-sm text-orange-700 dark:text-orange-400">
								Silakan lanjutkan pengiriman secara manual menggunakan aplikasi WhatsApp.
							</p>
							<a
								href={deliveryStatus.fallback_url}
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-600"
								onclick={onclose}
							>
								<Icon name="message-circle" size={16} /> Buka WhatsApp
							</a>
						{:else if deliveryStatus.fallback_unavailable_reason === 'MESSAGE_TOO_LONG'}
							<p class="mb-4 text-sm text-orange-700 dark:text-orange-400">
								Pesan terlalu panjang untuk link WhatsApp. Silakan salin pesan secara manual.
							</p>
							<Button variant="primary" class="w-full justify-center" onclick={copyFallback}>
								<Icon name="copy" size={16} /> Salin Pesan
							</Button>
						{:else}
							<p class="text-sm text-orange-700 dark:text-orange-400">
								Fallback manual tidak tersedia. Alasan: {deliveryStatus.fallback_unavailable_reason ||
									'Unknown'}
							</p>
						{/if}
					</div>
				{/if}

				{#if pollError}
					<div class="mt-4">
						<Alert variant="error">{pollError}</Alert>
					</div>
				{/if}

				{#if pollTimeoutReached && !isTerminal}
					<div class="mt-4">
						<Alert variant="info">
							Status masih diproses. Anda dapat menutup dialog ini dan memeriksa nanti, proses tetap
							berjalan di server.
						</Alert>
					</div>
					<div class="mt-3 flex justify-end">
						<Button variant="secondary" onclick={refreshStatus}>Refresh Status</Button>
					</div>
				{/if}
			{:else}
				<div class="py-8 text-center">
					<Icon name="loader-2" size={32} class="mx-auto mb-4 animate-spin text-brand" />
					<p class="font-medium text-ink">Memulai pengiriman...</p>
				</div>
			{/if}
		{/if}
	</div>

	{#snippet footer()}
		{#if step === 1}
			<Button variant="secondary" onclick={onclose}>Batal</Button>
			<Button
				variant="primary"
				onclick={sendQuickChat}
				disabled={templatesLoading || !selectedTemplateId || previewLoading || !preview || sending}
				loading={sending}
			>
				<Icon name="send" size={16} /> Kirim Pesan
			</Button>
		{:else if isTerminal || pollTimeoutReached}
			<Button variant="primary" onclick={onclose}>Tutup</Button>
		{/if}
	{/snippet}
</Modal>
