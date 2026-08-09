<!--
  Master Produk (BDM only — di-guard NAV_BY_ROLE + backend RBAC).
  CRUD katalog produk yang dijual. Dipakai sebagai sumber dropdown di form
  Jadwal Meeting (Telesales) dan edit kartu Deal Pipeline.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { productsApi, toMessage, formatDate, LatestRequest } from '$lib';
	import { toast } from '$lib/stores/toast.svelte';
	import type { ProductResponse } from '$lib/types/api';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Paginator from '$lib/components/ui/Pagination.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import LoadingState from '$lib/components/ui/LoadingState.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import ProductFormModal from '$lib/components/products/ProductFormModal.svelte';

	const PAGE_SIZE = 10;

	let all = $state<ProductResponse[]>([]);
	let loading = $state(true);
	let errorMsg = $state('');
	const listRequest = new LatestRequest();

	let page = $state(1);
	let search = $state('');

	let showForm = $state(false);
	let editTarget = $state<ProductResponse | null>(null);
	let deleteTarget = $state<ProductResponse | null>(null);
	let showDelete = $state(false);
	let deleteBusy = $state(false);

	// ── Filter + pagination sisi-klien ────────────────────────────────────────
	const filtered = $derived.by(() => {
		const q = search.trim().toLowerCase();
		if (!q) return all;
		return all.filter((p) =>
			`${p.code} ${p.name} ${p.description} ${p.vendor} ${p.billing_model} ${p.category}`
				.toLowerCase()
				.includes(q)
		);
	});
	const totalPages = $derived(Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
	const safePage = $derived(Math.min(page, totalPages));
	const pageItems = $derived(filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE));

	async function load() {
		const controller = listRequest.start();
		loading = true;
		errorMsg = '';
		try {
			const result = await productsApi.listProducts(undefined, controller.signal);
			if (listRequest.isCurrent(controller)) all = result;
		} catch (err) {
			if (!listRequest.isCurrent(controller)) return;
			errorMsg = toMessage(err);
			all = [];
		} finally {
			if (listRequest.finish(controller)) loading = false;
		}
	}

	onMount(() => {
		void load();
		return () => listRequest.abort();
	});

	function openCreate() {
		editTarget = null;
		showForm = true;
	}
	function openEdit(p: ProductResponse) {
		editTarget = p;
		showForm = true;
	}
	function onSaved() {
		showForm = false;
		load();
	}
	function clearEditTarget() {
		if (!showForm) editTarget = null;
	}
	function openDelete(product: ProductResponse) {
		deleteTarget = product;
		showDelete = true;
	}
	function closeDelete() {
		showDelete = false;
	}
	function clearDeleteTarget() {
		if (!showDelete) deleteTarget = null;
	}

	async function confirmDelete() {
		if (!deleteTarget) return;
		deleteBusy = true;
		try {
			await productsApi.deleteProduct(deleteTarget.id);
			toast.success('Produk berhasil dihapus.');
			showDelete = false;
			load();
		} catch (err) {
			toast.error(toMessage(err));
		} finally {
			deleteBusy = false;
		}
	}
</script>

<svelte:head><title>Master Produk · CRM Telesales</title></svelte:head>

<PageHeader title="Master Produk" description="Kelola katalog produk/jasa yang ditawarkan.">
	{#snippet actions()}
		<Button onclick={openCreate}>
			<Icon name="plus" size={16} /> Tambah Produk
		</Button>
	{/snippet}
</PageHeader>

<!-- Toolbar filter -->
<div class="mb-4 flex flex-wrap items-center gap-3">
	<div class="relative min-w-56 flex-1">
		<input
			type="search"
			bind:value={search}
			oninput={() => (page = 1)}
			placeholder="Cari nama atau deskripsi…"
			maxlength="100"
			class="h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink focus:border-brand focus:ring-2 focus:ring-brand/25 focus:outline-none"
		/>
	</div>
</div>

<!-- Tabel -->
<div class="overflow-hidden rounded-xl border border-line bg-surface">
	{#if loading}
		<LoadingState />
	{:else if errorMsg}
		<EmptyState icon="alert-circle" title="Gagal memuat data" description={errorMsg}>
			{#snippet action()}
				<Button variant="secondary" onclick={load}>Coba lagi</Button>
			{/snippet}
		</EmptyState>
	{:else if filtered.length === 0}
		<EmptyState
			icon="package"
			title="Belum ada produk"
			description="Tambahkan produk untuk mulai menyusun katalog."
		>
			{#snippet action()}
				<Button onclick={openCreate}>Tambah Produk</Button>
			{/snippet}
		</EmptyState>
	{:else}
		<div class="overflow-x-auto">
			<table class="w-full text-left text-sm">
				<thead class="border-b border-line bg-surface-2 text-xs text-muted uppercase">
					<tr>
						<th class="px-4 py-3 font-medium">Produk</th>
						<th class="px-4 py-3 font-medium">Vendor</th>
						<th class="px-4 py-3 font-medium">Billing</th>
						<th class="px-4 py-3 font-medium">Kategori</th>
						<th class="px-4 py-3 font-medium">Deskripsi</th>
						<th class="px-4 py-3 font-medium">Dibuat</th>
						<th class="px-4 py-3 text-center font-medium">Aksi</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-line">
					{#each pageItems as p (p.id)}
						<tr class="hover:bg-surface-2">
							<td class="px-4 py-3">
								<p class="font-medium text-ink">{p.name}</p>
								<p class="mt-1 text-xs text-muted">{p.code}</p>
							</td>
							<td class="px-4 py-3 text-muted">{p.vendor}</td>
							<td class="px-4 py-3 text-muted">{p.billing_model}</td>
							<td class="px-4 py-3 text-muted">{p.category}</td>
							<td class="max-w-md px-4 py-3 text-muted">
								<span class="line-clamp-2">{p.description || '-'}</span>
							</td>
							<td class="px-4 py-3 text-muted">{formatDate(p.created_at)}</td>
							<td class="px-4 py-3">
								<div class="flex items-center justify-center gap-1">
									<button
										type="button"
										class="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-brand hover:bg-brand-soft"
										onclick={() => openEdit(p)}
									>
										<Icon name="pencil" size={13} /> Edit
									</button>
									<button
										type="button"
										class="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
										onclick={() => openDelete(p)}
									>
										<Icon name="trash-2" size={13} /> Hapus
									</button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<Paginator
			page={safePage}
			{totalPages}
			totalItems={filtered.length}
			onpage={(p) => (page = p)}
		/>
	{/if}
</div>

{#if showForm}
	<ProductFormModal
		product={editTarget}
		onclose={() => (showForm = false)}
		onclosed={clearEditTarget}
		onsaved={onSaved}
	/>
{/if}

{#if showDelete && deleteTarget}
	<ConfirmDialog
		title="Hapus Produk"
		message={`Yakin ingin menghapus produk "${deleteTarget.name}"? Deal yang memakai produk ini akan kehilangan referensinya.`}
		confirmLabel="Hapus"
		danger
		loading={deleteBusy}
		onconfirm={confirmDelete}
		oncancel={closeDelete}
		onclosed={clearDeleteTarget}
	/>
{/if}
