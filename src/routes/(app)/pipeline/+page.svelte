<!--
  Deal Pipeline — Papan Kanban (CRM-003).
  - BDM: drag-and-drop kartu antar tahap + edit produk/harga/tahap (PUT /deals/:id).
  - Telesales: READ-ONLY (backend membalas 403 untuk edit; UI mengunci aksi).
  Memindah kartu ke `Win` otomatis mengubah staging perusahaan → Customer (backend, ACID).

  Catatan: halaman ini sebelumnya berisi funnel master-view leads; diganti menjadi
  Deal Kanban sesuai CRM-003. Logika lama tetap tersimpan di riwayat git.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { dealsApi, productsApi, auth, can, toMessage, formatCurrency } from '$lib';
	import { toast } from '$lib/stores/toast.svelte';
	import { PIPELINE_PHASES, PIPELINE_PHASE_LABEL } from '$lib/constants/enums';
	import type { PipelinePhase } from '$lib/constants/enums';
	import type { DealResponse, ProductResponse } from '$lib/types/api';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import LoadingState from '$lib/components/ui/LoadingState.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import DealEditModal from '$lib/components/pipeline/DealEditModal.svelte';

	const isBDM = can(auth.role, 'editDeal');
	const selectedDealID = $derived(page.url.searchParams.get('deal'));

	// Styling per kolom (header + titik). Urutan mengikuti PIPELINE_PHASES.
	const COLUMN_STYLE: Record<PipelinePhase, { header: string; dot: string }> = {
		demo: {
			header: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
			dot: 'bg-slate-400'
		},
		proposal: {
			header: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
			dot: 'bg-blue-400'
		},
		quotation: {
			header: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
			dot: 'bg-violet-400'
		},
		waiting_list: {
			header: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
			dot: 'bg-amber-400'
		},
		payment: {
			header: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
			dot: 'bg-cyan-400'
		},
		win: {
			header: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
			dot: 'bg-emerald-400'
		},
		lost: {
			header: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
			dot: 'bg-red-400'
		}
	};

	let deals = $state<DealResponse[]>([]);
	let products = $state<ProductResponse[]>([]);
	let loading = $state(true);
	let errorMsg = $state('');
	let editTarget = $state<DealResponse | null>(null);
	let draggedId = $state<string | null>(null);
	let dragOverStage = $state<PipelinePhase | null>(null);

	// Kelompokkan deal per tahap (reaktif).
	const board = $derived.by(() => {
		const map = {} as Record<PipelinePhase, DealResponse[]>;
		for (const phase of PIPELINE_PHASES) map[phase] = [];
		for (const d of deals) (map[d.pipeline_status] ??= []).push(d);
		return map;
	});

	const totalValue = $derived(deals.reduce((sum, d) => sum + (d.amount || 0), 0));

	async function load() {
		loading = true;
		errorMsg = '';
		try {
			// Produk untuk modal edit (endpoint shared). Gagal produk tidak fatal.
			const [dealList, productList] = await Promise.all([
				dealsApi.getPipeline(),
				productsApi.listProducts().catch(() => [] as ProductResponse[])
			]);
			deals = dealList;
			products = productList;
		} catch (err) {
			errorMsg = toMessage(err);
		} finally {
			loading = false;
		}
	}

	onMount(load);

	// ── Drag & drop (BDM only) ────────────────────────────────────────────────
	function onDragStart(id: string) {
		if (!isBDM) return;
		draggedId = id;
	}
	function onDragEnd() {
		draggedId = null;
		dragOverStage = null;
	}
	function onDragOver(e: DragEvent, stage: PipelinePhase) {
		if (!isBDM || !draggedId) return;
		e.preventDefault();
		dragOverStage = stage;
	}
	async function onDrop(stage: PipelinePhase) {
		const id = draggedId;
		onDragEnd();
		if (!isBDM || !id) return;
		const deal = deals.find((d) => d.id === id);
		if (!deal || deal.pipeline_status === stage) return;

		// Optimistic update — pindahkan lokal dulu, rollback bila gagal.
		const prevStage = deal.pipeline_status;
		deals = deals.map((d) => (d.id === id ? { ...d, pipeline_status: stage } : d));
		try {
			// Kirim product_id & amount existing: backend men-set ProductID dari req
			// (nil = menghapus produk), jadi wajib disertakan agar tidak hilang.
			await dealsApi.updateDeal(id, {
				product_id: deal.product?.id ?? undefined,
				amount: deal.amount,
				pipeline_status: stage
			});
			// Sinkron ulang bila Win (staging company berubah di server) + apresiasi.
			if (stage === 'win') {
				toast.success('Deal dimenangkan! Status perusahaan menjadi Customer.');
				await load();
			}
		} catch (err) {
			deals = deals.map((d) => (d.id === id ? { ...d, pipeline_status: prevStage } : d));
			toast.error(toMessage(err));
		}
	}

	function openEdit(deal: DealResponse) {
		if (!isBDM) return;
		editTarget = deal;
	}
	function onSaved() {
		editTarget = null;
		load();
	}
</script>

<svelte:head><title>Pipeline · CRM Telesales</title></svelte:head>

<PageHeader
	title="Deal Pipeline"
	description={isBDM
		? 'Geser kartu untuk memperbarui tahap negosiasi.'
		: 'Pantau perkembangan deal (mode baca).'}
>
	{#snippet actions()}
		<div class="flex items-center gap-2">
			{#if !isBDM}
				<span class="rounded-lg bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted">
					Read-only
				</span>
			{/if}
			<Button variant="secondary" onclick={load} disabled={loading}>
				<Icon name="refresh-cw" size={15} />
			</Button>
		</div>
	{/snippet}
</PageHeader>

{#if loading}
	<LoadingState />
{:else if errorMsg}
	<EmptyState icon="alert-circle" title="Gagal memuat data" description={errorMsg}>
		{#snippet action()}
			<Button variant="secondary" onclick={load}>Coba lagi</Button>
		{/snippet}
	</EmptyState>
{:else if deals.length === 0}
	<EmptyState
		icon="layout-kanban"
		title="Belum ada deal"
		description="Deal otomatis terbentuk saat Telesales menjadwalkan meeting dengan prospek."
	/>
{:else}
	<div class="mb-4 flex flex-wrap items-center gap-3 text-sm">
		<p class="text-muted">
			<span class="font-semibold text-ink">{deals.length}</span> deal aktif
		</p>
		<span class="text-line-strong">|</span>
		<p class="text-muted">
			Total nilai: <span class="font-semibold text-ink">{formatCurrency(totalValue)}</span>
		</p>
	</div>

	<!-- Board: scroll horizontal, tiap kolom scroll vertikal independen -->
	<div class="flex h-[calc(100vh-16rem)] min-h-[400px] gap-3 overflow-x-auto pb-2">
		{#each PIPELINE_PHASES as phase (phase)}
			{@const cards = board[phase]}
			{@const style = COLUMN_STYLE[phase]}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="flex w-[280px] min-w-[280px] shrink-0 flex-col gap-2 rounded-xl transition-colors {dragOverStage ===
				phase
					? 'bg-brand/5 ring-2 ring-brand/30'
					: ''}"
				ondragover={(e) => onDragOver(e, phase)}
				ondrop={() => onDrop(phase)}
			>
				<div class="flex items-center gap-2 rounded-xl px-3 py-2.5 {style.header}">
					<span class="h-2 w-2 rounded-full {style.dot}"></span>
					<span class="text-sm font-semibold">{PIPELINE_PHASE_LABEL[phase]}</span>
					<span
						class="ml-auto rounded-full bg-white/60 px-2 py-0.5 text-xs font-bold dark:bg-black/25"
					>
						{cards.length}
					</span>
				</div>

				<div class="flex flex-1 flex-col gap-2 overflow-y-auto">
					{#if cards.length === 0}
						<div
							class="rounded-xl border border-dashed border-line py-10 text-center text-xs text-subtle"
						>
							Kosong
						</div>
					{:else}
						{#each cards as deal (deal.id)}
							<svelte:element
								this={isBDM ? 'button' : 'div'}
								type={isBDM ? 'button' : undefined}
								draggable={isBDM}
								ondragstart={isBDM ? () => onDragStart(deal.id) : undefined}
								ondragend={isBDM ? onDragEnd : undefined}
								onclick={isBDM ? () => openEdit(deal) : undefined}
								class="block w-full rounded-xl border border-line bg-surface p-3 text-left shadow-sm transition-all {isBDM
									? 'cursor-grab hover:border-brand/40 hover:shadow-md active:cursor-grabbing'
									: 'cursor-default'} {draggedId === deal.id
									? 'opacity-50'
									: ''} {selectedDealID === deal.id ? 'ring-2 ring-brand/40' : ''}"
							>
								<div class="flex items-start gap-1.5">
									{#if isBDM}
										<Icon name="grip-vertical" size={14} class="mt-0.5 shrink-0 text-subtle" />
									{/if}
									<div class="min-w-0 flex-1">
										<p class="truncate text-sm font-medium text-brand">{deal.company.name}</p>
										<p class="mt-0.5 truncate text-xs text-subtle">{deal.name}</p>
										<div class="mt-2 flex flex-wrap items-center gap-1.5">
											<span class="text-sm font-semibold text-ink"
												>{formatCurrency(deal.amount)}</span
											>
										</div>
										{#if deal.product}
											<p
												class="mt-1 inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted"
											>
												<Icon name="package" size={11} />
												{deal.product.name}
											</p>
										{/if}
									</div>
								</div>
							</svelte:element>
						{/each}
					{/if}
				</div>
			</div>
		{/each}
	</div>
{/if}

{#if editTarget}
	<DealEditModal
		deal={editTarget}
		{products}
		onclose={() => (editTarget = null)}
		onsaved={onSaved}
	/>
{/if}
