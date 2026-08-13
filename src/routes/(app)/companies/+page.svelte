<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import {
		auth,
		can,
		companiesApi,
		reportsApi,
		toMessage,
		orDash,
		COMPANY_STAGING_LABEL,
		COMPANY_STAGING_BADGE
	} from '$lib';

	import type {
		CompanyResponse,
		CompanyDetailResponse,
		Pagination
	} from '$lib/types/api';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Paginator from '$lib/components/ui/Pagination.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import LoadingState from '$lib/components/ui/LoadingState.svelte';
	import CompanyFormModal from '$lib/components/companies/CompanyFormModal.svelte';
	import AssignCompanyModal from '$lib/components/companies/AssignCompanyModal.svelte';
	import ImportCompaniesModal from '$lib/components/companies/ImportCompaniesModal.svelte';

	const PAGE_SIZE = 10;
	const canWrite = can(auth.role, 'createCompany');
	const canAssign = can(auth.role, 'assignCompany');

	// ── Companies list ───────────────────────────────────────────────────────────
	let companies = $state<CompanyResponse[]>([]);
	let pagination = $state<Pagination | null>(null);
	let loading = $state(true);
	let errorMsg = $state('');
	let page = $state(1);
	let search = $state('');
	let industryFilter = $state('');
	let unassignedOnly = $state(false);
	let knownIndustries = $state<string[]>([]);
	const sortedIndustries = $derived([...knownIndustries].sort());

	let telesalesFilter = $state('');
	let telesalesOptions = $state<{ value: string; label: string }[]>([]);

	// ── Company form ─────────────────────────────────────────────────────────────
	let showForm = $state(false);
	let editTarget = $state<CompanyDetailResponse | null>(null);
	let showImport = $state(false);

	// ── BDM bulk select ──────────────────────────────────────────────────────────
	const selectedIds = new SvelteSet<string>();
	let showAssign = $state(false);
	const selectedCompanies = $derived(companies.filter((c) => selectedIds.has(c.id)));
	const allSelected = $derived(companies.length > 0 && selectedIds.size === companies.length);

	let loadController: AbortController | null = null;

	async function load(opts: { background?: boolean } = {}) {
		const background = opts.background ?? false;
		loadController?.abort();
		const controller = new AbortController();
		loadController = controller;
		if (!background) loading = true;
		errorMsg = '';
		try {
			const res = await companiesApi.listCompanies(
				{
					page,
					limit: PAGE_SIZE,
					search: search || undefined,
					industry: industryFilter || undefined,
					unassigned: unassignedOnly || undefined,
					assigned_to: telesalesFilter || undefined
				},
				controller.signal
			);
			companies = res.data;
			pagination = res.pagination;
			if (!background) selectedIds.clear();
			const seen = new SvelteSet(knownIndustries);
			for (const c of res.data) {
				if (c.industry && !seen.has(c.industry)) {
					seen.add(c.industry);
					knownIndustries = [...knownIndustries, c.industry];
				}
			}
		} catch (err) {
			if (controller.signal.aborted || background) return;
			errorMsg = toMessage(err);
			companies = [];
		} finally {
			if (loadController === controller && !background) loading = false;
		}
	}

	async function loadTelesales() {
		if (!canAssign) return;
		try {
			const report = await reportsApi.getTeamReport();
			telesalesOptions = report.per_telesales.map((t) => ({
				value: t.user.id,
				label: t.user.name
			}));
		} catch {
			// Silent error
		}
	}

	onMount(() => {
		void load();
		void loadTelesales();
	});

	// ── Filters & Search ─────────────────────────────────────────────────────────
	let searchTimeout: ReturnType<typeof setTimeout>;
	function onSearchInput() {
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			page = 1;
			void load();
		}, 300);
	}

	function onIndustryChange() {
		page = 1;
		void load();
	}

	function toggleUnassigned() {
		unassignedOnly = !unassignedOnly;
		page = 1;
		void load();
	}

	function onTelesalesChange() {
		page = 1;
		void load();
	}

	function goPage(p: number) {
		page = p;
		void load();
	}

	// ── Company CRUD ─────────────────────────────────────────────────────────────
	function openCreate() {
		editTarget = null;
		showForm = true;
	}
	function onSaved() {
		showForm = false;
		void load();
	}
	function clearEditTarget() {
		if (!showForm) editTarget = null;
	}

	// ── BDM bulk ─────────────────────────────────────────────────────────────────
	function toggleRow(id: string) {
		if (selectedIds.has(id)) selectedIds.delete(id);
		else selectedIds.add(id);
	}
	function toggleAll() {
		if (allSelected) selectedIds.clear();
		else for (const c of companies) selectedIds.add(c.id);
	}
	function onAssigned() {
		showAssign = false;
		selectedIds.clear();
		void load();
	}
</script>

<svelte:head><title>Perusahaan & Lead · CRM Telesales</title></svelte:head>

<PageHeader title="Perusahaan & Lead" description="Kelola database perusahaan, penugasan telesales, dan ringkasan langganan.">
	{#snippet actions()}
		{#if canWrite}
			<Button variant="secondary" onclick={() => (showImport = true)}>
				<Icon name="upload" size={16} /> Impor
			</Button>
			<Button onclick={openCreate}>
				<Icon name="building-2" size={16} /> Tambah Perusahaan
			</Button>
		{/if}
	{/snippet}
</PageHeader>

<!-- Filter bar -->
<div class="mb-4 flex flex-wrap items-center gap-3">
	<div class="min-w-56 flex-1">
		<input
			type="search"
			bind:value={search}
			oninput={onSearchInput}
			placeholder="Cari perusahaan…"
			maxlength="200"
			class="h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink focus:border-brand focus:ring-2 focus:ring-brand/25 focus:outline-none"
		/>
	</div>
	{#if knownIndustries.length > 0}
		<select
			bind:value={industryFilter}
			onchange={onIndustryChange}
			class="h-10 min-w-48 shrink-0 rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:border-brand focus:ring-2 focus:ring-brand/25 focus:outline-none"
			aria-label="Filter by industry"
		>
			<option value="">Semua Industri</option>
			{#each sortedIndustries as ind (ind)}
				<option value={ind}>{ind}</option>
			{/each}
		</select>
	{/if}
	{#if canAssign}
		{#if telesalesOptions.length > 0}
			<select
				bind:value={telesalesFilter}
				onchange={onTelesalesChange}
				class="h-10 min-w-48 shrink-0 rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:border-brand focus:ring-2 focus:ring-brand/25 focus:outline-none"
				aria-label="Filter by Telesales"
			>
				<option value="">Semua Telesales</option>
				{#each telesalesOptions as opt (opt.value)}
					<option value={opt.value}>{opt.label}</option>
				{/each}
			</select>
		{/if}
		<label
			class="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm text-muted"
		>
			<input type="checkbox" checked={unassignedOnly} onchange={toggleUnassigned} class="rounded" />
			Belum ditugaskan
		</label>
	{/if}
</div>

<!-- BDM selection bar -->
{#if canAssign && selectedIds.size > 0}
	<div
		class="mb-4 flex items-center justify-between rounded-lg border border-brand/30 bg-brand-soft px-4 py-2.5 text-sm"
	>
		<span class="font-medium text-brand"
			>{selectedIds.size} perusahaan dipilih</span
		>
		<div class="flex items-center gap-2">
			<button
				type="button"
				class="inline-flex rounded-lg px-2.5 py-1 text-xs font-medium text-muted hover:bg-surface"
				onclick={() => selectedIds.clear()}
			>
				Batal Pilih
			</button>
			<Button onclick={() => (showAssign = true)}>
				<Icon name="users" size={16} /> Tugaskan / Pindahkan
			</Button>
		</div>
	</div>
{/if}

<!-- Data Table -->
<div class="overflow-x-auto rounded-xl border border-line bg-surface">
	{#if loading}
		<LoadingState />
	{:else if errorMsg}
		<EmptyState icon="alert-circle" title="Gagal memuat data" description={errorMsg}>
			{#snippet action()}
				<Button variant="secondary" onclick={() => void load()}>Coba Lagi</Button>
			{/snippet}
		</EmptyState>
	{:else if companies.length === 0}
		<EmptyState
			icon="building-2"
			title="Belum ada account"
			description={canWrite ? 'Tambah atau impor account untuk memulai.' : 'Tidak ada data.'}
		>
			{#snippet action()}
				{#if canWrite}<Button onclick={openCreate}>Tambah Perusahaan</Button>{/if}
			{/snippet}
		</EmptyState>
	{:else}
		<table class="w-full border-collapse text-left text-xs">
			<thead>
				<tr class="border-b border-line bg-surface-2 text-ink-soft font-semibold">
					{#if canAssign}
						<th class="p-3 w-10">
							<input
								type="checkbox"
								checked={allSelected}
								onchange={toggleAll}
								class="rounded border-line-strong"
								aria-label="Pilih semua"
							/>
						</th>
					{/if}
					<th class="p-3 font-semibold">Nama Perusahaan</th>
					<th class="p-3 font-semibold">Industri</th>
					<th class="p-3 font-semibold">Ditugaskan Ke</th>
					<th class="p-3 font-semibold">Status Langganan</th>
					<th class="p-3 font-semibold text-center">Lead</th>
					<th class="p-3 font-semibold text-right">Aksi</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-line/60">
				{#each companies as c (c.id)}
					<tr class="hover:bg-surface-2/60 transition-colors">
						{#if canAssign}
							<td class="p-3">
								<input
									type="checkbox"
									checked={selectedIds.has(c.id)}
									onchange={() => toggleRow(c.id)}
									class="rounded border-line-strong"
									aria-label="Pilih {c.name}"
								/>
							</td>
						{/if}
						<td class="p-3">
							<div class="font-medium text-ink flex items-center gap-1.5">
								<a href="/companies/{c.id}" class="hover:text-brand hover:underline font-semibold">{c.name}</a>
								<span class="inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium {COMPANY_STAGING_BADGE[c.status]}">
									{COMPANY_STAGING_LABEL[c.status]}
								</span>
							</div>
						</td>
						<td class="p-3 text-muted">{orDash(c.industry)}</td>
						<td class="p-3 text-muted">{c.assigned_to?.name ?? 'Belum ditugaskan'}</td>
						<td class="p-3">
							<div class="flex flex-wrap gap-1">
								{#if c.subscription_summary.active > 0}
									<span class="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
										Aktif {c.subscription_summary.active}
									</span>
								{/if}
								{#if c.subscription_summary.expiring_soon > 0}
									<span class="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
										Segera Berakhir {c.subscription_summary.expiring_soon}
									</span>
								{/if}
								{#if c.subscription_summary.expired > 0}
									<span class="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">
										Kedaluwarsa {c.subscription_summary.expired}
									</span>
								{/if}
								{#if c.subscription_summary.active === 0 && c.subscription_summary.expiring_soon === 0 && c.subscription_summary.expired === 0}
									<span class="text-xs text-muted">—</span>
								{/if}
							</div>
						</td>
						<td class="p-3 text-center font-medium text-ink-soft">{c.contact_count}</td>
						<td class="p-3 text-right">
							<div class="inline-flex items-center gap-1.5">
								<a
									href="/companies/{c.id}"
									class="inline-flex items-center gap-1 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs font-semibold text-ink-soft hover:bg-surface-3 transition-colors"
								>
									Detail
								</a>
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</div>

{#if pagination}
	<Paginator
		page={pagination.current_page}
		totalPages={pagination.total_pages}
		totalItems={pagination.total_items}
		onpage={goPage}
	/>
{/if}

<!-- Modals & drawers -->
{#if showForm}
	<CompanyFormModal
		company={editTarget}
		onclose={() => (showForm = false)}
		onclosed={clearEditTarget}
		onsaved={onSaved}
	/>
{/if}

{#if showAssign}
	<AssignCompanyModal
		companies={selectedCompanies}
		onclose={() => (showAssign = false)}
		onsaved={onAssigned}
	/>
{/if}

{#if showImport}
	<ImportCompaniesModal
		onclose={() => (showImport = false)}
		onimported={() => void load({ background: true })}
	/>
{/if}
