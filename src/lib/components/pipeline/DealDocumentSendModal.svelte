<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { dealsApi, contactsApi, toMessage, ApiError } from '$lib';
	import type { DealResponse, ContactDetailResponse } from '$lib/types/api';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Alert from '$lib/components/ui/Alert.svelte';
	import LoadingState from '$lib/components/ui/LoadingState.svelte';

	interface Props {
		deal: DealResponse;
		documentType: 'Proposal' | 'Quotation';
		onclose: () => void;
	}
	let { deal, documentType, onclose }: Props = $props();

	let step = $state<'loading_contact' | 'confirm' | 'sending' | 'result'>('loading_contact');
	let status = $state<'processing' | 'sent' | 'failed' | 'fallback_required' | null>(null);
	let contactDetails = $state<ContactDetailResponse | null>(null);
	let contactError = $state('');

	let errorMsg = $state('');
	let idempotencyKey = $state(crypto.randomUUID());
	let isNetworkError = $state(false);

	let abortController: AbortController | null = null;

	onMount(() => {
		void loadContact();
	});

	onDestroy(() => {
		abortController?.abort();
	});

	async function loadContact() {
		if (!deal.contact?.id) {
			contactError = 'PIC Deal belum diatur. Silakan atur PIC terlebih dahulu.';
			step = 'confirm';
			return;
		}

		step = 'loading_contact';
		contactError = '';
		try {
			contactDetails = await contactsApi.getContactDetail(deal.contact.id);
			step = 'confirm';
		} catch (err) {
			contactError = 'Gagal memuat kontak PIC: ' + toMessage(err);
			step = 'confirm';
		}
	}

	async function sendDoc() {
		step = 'sending';
		errorMsg = '';
		isNetworkError = false;

		abortController = new AbortController();
		try {
			const res = await dealsApi.sendDocument(deal.id, idempotencyKey, abortController.signal);
			status = res.status;
			step = 'result';

			if (res.status === 'failed') {
				// Logical failure, prepare new key for next explicit attempt
				idempotencyKey = crypto.randomUUID();
			}
		} catch (err) {
			step = 'result';
			status = 'failed';
			errorMsg = toMessage(err);

			if (err instanceof ApiError) {
				if (err.isNetwork) {
					isNetworkError = true;
					// Keep idempotencyKey for retry
				} else if (err.code === 'DOCUMENT_SEND_IN_PROGRESS') {
					status = 'processing';
					errorMsg =
						'Pengiriman dokumen untuk Deal ini sedang diproses. Silakan tunggu beberapa saat.';
				} else {
					idempotencyKey = crypto.randomUUID();
				}
			} else {
				idempotencyKey = crypto.randomUUID();
			}
		}
	}

	function handleRetry() {
		if (!isNetworkError) {
			// If not network error, it was an explicit failure, so we use the already refreshed key
		}
		void sendDoc();
	}

	const isWhatsAppActive = $derived(contactDetails?.whatsapp_status === 'active');
	const canSend = $derived(!!contactDetails && isWhatsAppActive);
</script>

<Modal title={`Kirim ${documentType}`} size="md" onclose={step === 'sending' ? undefined : onclose}>
	<div class="space-y-4">
		{#if step === 'loading_contact'}
			<LoadingState />
		{:else if step === 'confirm'}
			{#if contactError}
				<Alert variant="error">{contactError}</Alert>
			{:else if contactDetails}
				<p class="text-sm text-ink-soft">
					Kirim dokumen **{documentType}** untuk **{deal.company.name}** ke WhatsApp PIC Deal?
				</p>

				<div class="space-y-2 rounded-xl border border-line bg-surface-2 p-4">
					<div class="flex justify-between text-sm">
						<span class="text-muted">PIC Deal:</span>
						<span class="font-medium text-ink">{contactDetails.name}</span>
					</div>
					<div class="flex justify-between text-sm">
						<span class="text-muted">Nomor WhatsApp:</span>
						<span class="font-medium text-ink">{contactDetails.phone ?? '—'}</span>
					</div>
					<div class="flex justify-between text-sm">
						<span class="text-muted">Status WA:</span>
						{#if isWhatsAppActive}
							<span class="font-medium text-emerald-600">Aktif</span>
						{:else}
							<span class="font-medium text-red-600">
								{contactDetails.whatsapp_status === 'unverified'
									? 'Belum Terverifikasi'
									: 'Tidak Aktif'}
							</span>
						{/if}
					</div>
				</div>

				{#if !isWhatsAppActive}
					<Alert variant="warning">
						Nomor WhatsApp PIC tidak aktif atau belum diverifikasi. Pengiriman pesan WhatsApp
						dinonaktifkan.
					</Alert>
				{/if}

				<p class="text-xs text-muted">
					Dokumen akan dikirimkan sebagai lampiran PDF secara langsung ke nomor WhatsApp di atas.
				</p>
			{/if}
		{:else if step === 'sending'}
			<div class="space-y-3 py-8 text-center">
				<Icon name="loader-2" size={32} class="mx-auto animate-spin text-brand" />
				<p class="font-medium text-ink">Mengirim dokumen via WhatsApp...</p>
				<p class="text-xs text-muted">Mohon tunggu, proses ini sinkron dengan server.</p>
			</div>
		{:else if step === 'result'}
			{#if status === 'sent'}
				<div class="space-y-3 py-6 text-center">
					<div
						class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"
					>
						<Icon name="check" size={24} />
					</div>
					<p class="text-base font-semibold text-ink">Dokumen Berhasil Terkirim!</p>
					<p class="text-sm text-muted">
						{documentType} telah sukses dikirim ke WhatsApp PIC.
					</p>
				</div>
			{:else if status === 'processing'}
				<div class="space-y-3 py-6 text-center">
					<div
						class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600"
					>
						<Icon name="clock" size={24} />
					</div>
					<p class="text-base font-semibold text-ink">Sedang Diproses</p>
					<p class="text-sm text-muted">
						{errorMsg || 'Pengiriman sedang diproses di server. Anda dapat menutup dialog ini.'}
					</p>
				</div>
			{:else if status === 'fallback_required'}
				<div class="space-y-3 py-4">
					<div class="rounded-xl border border-orange-200 bg-orange-50 p-4">
						<div class="flex gap-2">
							<Icon name="alert-circle" class="shrink-0 text-orange-600" size={20} />
							<div>
								<h4 class="text-sm font-semibold text-orange-800">Status Pengiriman Ambigu</h4>
								<p class="mt-1 text-xs leading-relaxed text-orange-700">
									Sistem tidak dapat memastikan apakah dokumen telah sukses terkirim. Mohon lakukan
									tindak lanjut (follow-up) secara manual melalui WhatsApp untuk memastikan dokumen
									telah diterima.
								</p>
							</div>
						</div>
					</div>
				</div>
			{:else}
				<div class="space-y-3 py-4">
					<div class="rounded-xl border border-red-200 bg-red-50 p-4">
						<div class="flex gap-2">
							<Icon name="alert-circle" class="shrink-0 text-red-600" size={20} />
							<div>
								<h4 class="text-sm font-semibold text-red-800">Pengiriman Gagal</h4>
								<p class="mt-1 text-xs text-red-700">
									{errorMsg || 'Terjadi kesalahan saat mengirim dokumen. Silakan coba lagi.'}
								</p>
							</div>
						</div>
					</div>
					{#if isNetworkError}
						<p class="text-center text-xs text-muted">
							Koneksi terputus. Menekan tombol "Coba Lagi" akan menggunakan kunci pengiriman yang
							sama untuk mencegah duplikasi.
						</p>
					{/if}
				</div>
			{/if}
		{/if}
	</div>

	{#snippet footer()}
		{#if step === 'confirm'}
			<Button variant="secondary" onclick={onclose}>Batal</Button>
			{#if canSend}
				<Button variant="primary" onclick={sendDoc}>Kirim</Button>
			{/if}
		{:else if step === 'result'}
			{#if status === 'failed'}
				<Button variant="secondary" onclick={onclose}>Tutup</Button>
				<Button variant="primary" onclick={handleRetry}>
					{isNetworkError ? 'Coba Lagi' : 'Kirim Ulang'}
				</Button>
			{:else}
				<Button variant="primary" onclick={onclose}>Tutup</Button>
			{/if}
		{/if}
	{/snippet}
</Modal>
