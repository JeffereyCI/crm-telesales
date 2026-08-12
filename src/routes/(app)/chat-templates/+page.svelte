<script lang="ts">
	/**
	 * Halaman manajemen Chat Template — CRM-012.
	 * Hanya untuk BDM dan Telesales. Admin tidak punya akses.
	 * Fitur: list template milik sendiri, filter kategori, toggle inactive,
	 *        counter X/10, create, edit (active), deactivate (dengan konfirmasi).
	 */
	import { onMount } from 'svelte';
	import {
		LatestRequest,
		auth,
		can,
		chatTemplatesApi,
		formatDate,
		toMessage,
		CHAT_TEMPLATE_CATEGORIES,
		CHAT_TEMPLATE_CATEGORY_LABEL,
		CHAT_TEMPLATE_CATEGORY_BADGE
	} from '$lib';
	import { toast } from '$lib/stores/toast.svelte';
	import type { ChatTemplateResponse } from '$lib/types/api';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import LoadingState from '$lib/components/ui/LoadingState.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import ChatTemplateFormModal from '$lib/components/chat-templates/ChatTemplateFormModal.svelte';

	const ACTIVE_LIMIT = 10;
	const canManage = can(auth.role, 'manageChatTemplates');

	// ── State ─────────────────────────────────────────────────────────────────
	let templates = $state<ChatTemplateResponse[]>([]);
	let loading = $state(true);
	let errorMsg = $state('');

	/** undefined = form tertutup; null = create; ChatTemplateResponse = edit */
	let formTarget = $state<ChatTemplateResponse | null | undefined>(undefined);
	let deactivateTarget = $state<ChatTemplateResponse | null>(null);
	let deactivateBusy = $state(false);

	// Filter
	let filterCategory = $state<'leads' | 'contact' | 'customer' | ''>('');
	let showInactive = $state(false);

	const loadRequest = new LatestRequest();

	// ── Derived ───────────────────────────────────────────────────────────────
	const activeCount = $derived(templates.filter((t) => t.status === 'active').length);
	const atLimit = $derived(activeCount >= ACTIVE_LIMIT);

	const visibleTemplates = $derived(
		templates
			.filter((t) => {
				if (!showInactive && t.status === 'inactive') return false;
				if (filterCategory && t.category !== filterCategory) return false;
				return true;
			})
			.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
	);

	// ── Load ──────────────────────────────────────────────────────────────────
	async function load() {
		if (!canManage) {
			loading = false;
			templates = [];
			return;
		}
		const ctrl = loadRequest.start();
		loading = true;
		errorMsg = '';
		try {
			// Ambil semua termasuk inactive agar filter lokal bisa toggle
			const result = await chatTemplatesApi.listTemplates({ include_inactive: true }, ctrl.signal);
			if (!loadRequest.isCurrent(ctrl)) return;
			templates = result;
		} catch (err) {
			if (!loadRequest.isCurrent(ctrl)) return;
			errorMsg = toMessage(err);
			templates = [];
		} finally {
			if (loadRequest.finish(ctrl)) loading = false;
		}
	}

	onMount(() => {
		void load();
		return () => loadRequest.abort();
	});

	// ── Handlers ──────────────────────────────────────────────────────────────
	function saved() {
		formTarget = undefined;
		void load();
	}

	async function confirmDeactivate() {
		if (!deactivateTarget) return;
		deactivateBusy = true;
		try {
			await chatTemplatesApi.deactivateTemplate(deactivateTarget.id);
			toast.success(`Template "${deactivateTarget.name}" berhasil dinonaktifkan.`);
			deactivateTarget = null;
			await load();
		} catch (err) {
			toast.error(toMessage(err));
		} finally {
			deactivateBusy = false;
		}
	}
</script>

<svelte:head><title>Template Chat · CRM Telesales</title></svelte:head>

<PageHeader
	title="Template Chat"
	description="Kelola pesan WhatsApp multi-bubble milik Anda untuk follow-up lead, contact, dan customer."
/>

{#if loading}
	<LoadingState />
{:else if !canManage}
	<EmptyState
		icon="lock"
		title="Akses dibatasi"
		description="Halaman Template Chat hanya tersedia untuk BDM dan Telesales."
	/>
{:else if errorMsg}
	<EmptyState icon="alert-circle" title="Gagal memuat template" description={errorMsg}>
		{#snippet action()}<Button variant="secondary" onclick={load}>Coba lagi</Button>{/snippet}
	</EmptyState>
{:else}
	<!-- Toolbar: filter + tombol buat -->
	<div class="mb-5 flex flex-wrap items-center justify-between gap-3">
		<div class="flex flex-wrap items-center gap-2">
			<!-- Filter kategori -->
			<div class="flex overflow-hidden rounded-lg border border-line bg-surface text-sm">
				<button
					type="button"
					onclick={() => (filterCategory = '')}
					class="px-3 py-1.5 transition-colors {filterCategory === ''
						? 'bg-brand text-white'
						: 'text-muted hover:text-ink'}"
				>
					Semua
				</button>
				{#each CHAT_TEMPLATE_CATEGORIES as cat (cat)}
					<button
						type="button"
						onclick={() => (filterCategory = cat)}
						class="border-l border-line px-3 py-1.5 transition-colors {filterCategory === cat
							? 'bg-brand text-white'
							: 'text-muted hover:text-ink'}"
					>
						{CHAT_TEMPLATE_CATEGORY_LABEL[cat]}
					</button>
				{/each}
			</div>

			<!-- Toggle inactive -->
			<label class="flex cursor-pointer items-center gap-2 text-sm text-muted">
				<input type="checkbox" bind:checked={showInactive} class="rounded" />
				Tampilkan tidak aktif
			</label>
		</div>

		<div class="flex items-center gap-3">
			<!-- Counter X/10 -->
			<span class="text-sm {atLimit ? 'font-semibold text-red-500' : 'text-muted'}">
				{activeCount}/{ACTIVE_LIMIT} aktif
			</span>
			<Button
				onclick={() => (formTarget = null)}
				disabled={atLimit}
				title={atLimit
					? 'Batas 10 Template aktif tercapai. Nonaktifkan salah satu terlebih dahulu.'
					: ''}
			>
				<Icon name="plus" size={16} /> Buat Template
			</Button>
		</div>
	</div>

	<!-- List -->
	{#if visibleTemplates.length === 0}
		<div class="rounded-xl border border-line bg-surface">
			<EmptyState
				icon="message-square"
				title={filterCategory
					? `Tidak ada template untuk kategori ${CHAT_TEMPLATE_CATEGORY_LABEL[filterCategory]}`
					: 'Belum ada template chat'}
				description={filterCategory
					? 'Coba hapus filter atau buat template baru.'
					: 'Buat template pertama Anda untuk mulai mengirim pesan WhatsApp.'}
			>
				{#snippet action()}
					{#if !atLimit}
						<Button onclick={() => (formTarget = null)}>
							<Icon name="plus" size={16} /> Buat Template
						</Button>
					{/if}
				{/snippet}
			</EmptyState>
		</div>
	{:else}
		<div class="overflow-hidden rounded-xl border border-line bg-surface">
			<div class="overflow-x-auto">
				<table class="w-full text-left text-sm">
					<thead class="border-b border-line bg-surface-2 text-xs text-muted uppercase">
						<tr>
							<th class="px-4 py-3">Nama</th>
							<th class="px-4 py-3">Kategori</th>
							<th class="px-4 py-3 text-center">Bubble</th>
							<th class="px-4 py-3 text-center">Delay</th>
							<th class="px-4 py-3">Status</th>
							<th class="px-4 py-3">Diperbarui</th>
							<th class="px-4 py-3 text-center">Aksi</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-line">
						{#each visibleTemplates as t (t.id)}
							<tr class="hover:bg-surface-2 {t.status === 'inactive' ? 'opacity-60' : ''}">
								<!-- Nama + preview bubble pertama -->
								<td class="px-4 py-3">
									<p class="font-medium text-ink">{t.name}</p>
									<p class="mt-0.5 max-w-xs truncate text-xs text-muted">
										{t.bubbles[0]?.body ?? '—'}
									</p>
								</td>

								<!-- Kategori badge -->
								<td class="px-4 py-3">
									<span
										class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium {CHAT_TEMPLATE_CATEGORY_BADGE[
											t.category
										]}"
									>
										{CHAT_TEMPLATE_CATEGORY_LABEL[t.category]}
									</span>
								</td>

								<!-- Jumlah bubble -->
								<td class="px-4 py-3 text-center text-muted">{t.bubbles.length}</td>

								<!-- Mode delay -->
								<td class="px-4 py-3 text-center">
									{#if t.manual_delay_enabled}
										<span class="text-xs text-brand">Manual</span>
									{:else}
										<span class="text-xs text-muted">Default</span>
									{/if}
								</td>

								<!-- Status badge -->
								<td class="px-4 py-3">
									{#if t.status === 'active'}
										<span
											class="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700"
										>
											Aktif
										</span>
									{:else}
										<span
											class="inline-flex rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-muted"
										>
											Tidak Aktif
										</span>
									{/if}
								</td>

								<td class="px-4 py-3 text-muted">{formatDate(t.updated_at)}</td>

								<!-- Aksi -->
								<td class="px-4 py-3">
									<div class="flex justify-center gap-1">
										{#if t.status === 'active'}
											<button
												type="button"
												onclick={() => (formTarget = t)}
												class="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-brand transition-colors hover:bg-brand-soft"
											>
												<Icon name="pencil" size={13} /> Edit
											</button>
											<button
												type="button"
												onclick={() => (deactivateTarget = t)}
												class="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-950/40"
											>
												<Icon name="power-off" size={13} /> Nonaktifkan
											</button>
										{:else}
											<span class="text-xs text-muted italic">Read-only</span>
										{/if}
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
{/if}

<!-- Form Modal (create / edit) -->
{#if formTarget !== undefined}
	<ChatTemplateFormModal
		template={formTarget}
		onclose={() => (formTarget = undefined)}
		onsaved={saved}
	/>
{/if}

<!-- Konfirmasi deactivate -->
{#if deactivateTarget}
	<ConfirmDialog
		title="Nonaktifkan Template"
		message={`Nonaktifkan template "${deactivateTarget.name}"? Template tidak aktif bersifat read-only dan tidak dapat diaktifkan kembali.`}
		confirmLabel="Nonaktifkan"
		danger
		loading={deactivateBusy}
		onconfirm={confirmDeactivate}
		oncancel={() => (deactivateTarget = null)}
	/>
{/if}
