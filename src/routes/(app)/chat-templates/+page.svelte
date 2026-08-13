<script lang="ts">
	/**
	 * Halaman manajemen Chat Template — CRM-012.
	 * Hanya untuk BDM dan Telesales. Admin tidak punya akses.
	 * Fitur: list template milik sendiri, filter kategori, toggle inactive,
	 *        counter X/10, create, edit (active), deactivate (dengan konfirmasi).
	 */
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
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
	import HelpTooltip from '$lib/components/ui/HelpTooltip.svelte';

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

	const expandedIds = new SvelteSet<string>();
	function toggleExpand(id: string) {
		if (expandedIds.has(id)) expandedIds.delete(id);
		else expandedIds.add(id);
	}

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

		<div class="flex items-center gap-4">
			<!-- Counter X/10 with Help Tooltip -->
			<div class="flex items-center gap-1.5">
				<span class="text-sm font-semibold {atLimit ? 'text-brand' : 'text-ink-soft'}">
					Batas Aktif: {activeCount}/{ACTIVE_LIMIT}
				</span>
				<HelpTooltip text="Batas maksimal template chat aktif yang dapat disimpan oleh satu user adalah 10. Jika sudah mencapai limit, Anda harus menonaktifkan salah satu template sebelum dapat membuat template baru." position="bottom" />
			</div>
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
									<button
										type="button"
										onclick={() => toggleExpand(t.id)}
										class="font-semibold text-ink hover:text-brand hover:underline text-left"
									>
										{t.name}
									</button>
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
									<div class="flex justify-center gap-1.5">
										<button
											type="button"
											onclick={() => toggleExpand(t.id)}
											class="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-ink-soft border border-line bg-surface-2 hover:bg-surface-3 transition-colors"
										>
											<Icon name={expandedIds.has(t.id) ? 'eye-off' : 'eye'} size={13} /> {expandedIds.has(t.id) ? 'Tutup' : 'Pratinjau'}
										</button>
										{#if t.status === 'active'}
											<button
												type="button"
												onclick={() => (formTarget = t)}
												class="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-brand transition-colors hover:bg-brand-soft"
											>
												<Icon name="pencil" size={13} /> Edit
											</button>
											<button
												type="button"
												onclick={() => (deactivateTarget = t)}
												class="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-950/40"
											>
												<Icon name="power-off" size={13} /> Nonaktifkan
											</button>
										{:else}
											<span class="text-xs text-muted italic">Read-only</span>
										{/if}
									</div>
								</td>
							</tr>
							{#if expandedIds.has(t.id)}
								<tr class="bg-surface-2/40">
									<td colspan="7" class="p-4 border-t border-line/60">
										<div class="max-w-md mx-auto rounded-xl border border-line bg-[#efeae2] p-4 shadow-inner">
											<div class="mb-3 border-b border-[#efeae2]/85 pb-1.5 text-center">
												<span class="rounded bg-white/75 px-2.5 py-0.5 text-[9px] font-semibold text-muted shadow-sm uppercase tracking-wider">
													WhatsApp Chat Simulator
												</span>
											</div>
											
											<!-- Chat message list -->
											<div class="space-y-3">
												{#each t.bubbles as bubble, idx (idx)}
													<div class="flex justify-end relative">
														<div class="relative max-w-[85%] rounded-lg bg-[#d9fdd3] px-3.5 py-2 text-xs text-ink shadow-sm">
															<p class="whitespace-pre-wrap leading-relaxed">{bubble.body}</p>
															<div class="mt-1 flex items-center justify-end gap-1 text-[9px] text-[#667781]">
																<span>Bubble #{idx + 1}</span>
																{#if t.manual_delay_enabled}
																	<span class="font-semibold text-brand">· Delay: {bubble.effective_delay_seconds}s</span>
																{/if}
															</div>
															<!-- Chat bubble tail shape -->
															<div class="absolute right-0 top-0 -mr-1 h-2.5 w-2 bg-[#d9fdd3] rounded-tr-md"></div>
														</div>
													</div>
												{/each}
											</div>
										</div>
									</td>
								</tr>
							{/if}
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
