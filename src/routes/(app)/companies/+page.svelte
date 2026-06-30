<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteSet, SvelteMap } from 'svelte/reactivity';
	import {
		auth,
		can,
		companiesApi,
		contactsApi,
		toMessage,
		orDash,
		ACTION_STATUS_LABEL,
		ACTION_STATUS_BADGE,
		RESPONSE_STATUS_LABEL,
		RESPONSE_STATUS_BADGE
	} from '$lib';
	import { toast } from '$lib/stores/toast.svelte';
	import type {
		CompanyResponse,
		CompanyDetailResponse,
		ContactResponse,
		Pagination
	} from '$lib/types/api';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Paginator from '$lib/components/ui/Pagination.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import LoadingState from '$lib/components/ui/LoadingState.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import CompanyFormModal from '$lib/components/companies/CompanyFormModal.svelte';
	import CompanyInfoDrawer from '$lib/components/companies/CompanyInfoDrawer.svelte';
	import AssignCompanyModal from '$lib/components/companies/AssignCompanyModal.svelte';
	import ImportCompaniesModal from '$lib/components/companies/ImportCompaniesModal.svelte';
	import ContactFormModal from '$lib/components/contacts/ContactFormModal.svelte';
	import ActionStatusModal from '$lib/components/contacts/ActionStatusModal.svelte';
	import ResponseStatusModal from '$lib/components/contacts/ResponseStatusModal.svelte';

	const PAGE_SIZE = 10;
	const canWrite = can(auth.role, 'createCompany');
	const canAssign = can(auth.role, 'assignCompany');
	const canFilterUnassigned = canAssign;
	const canManageContacts = can(auth.role, 'manageContacts');
	const canUpdateAction = can(auth.role, 'updateActionStatus');
	const canUpdateResponse = can(auth.role, 'updateResponseStatus');

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
	// Salinan terurut untuk dropdown — JANGAN sort() langsung di template karena
	// itu memutasi state reaktif saat render → memicu update-loop (loading nyangkut).
	const sortedIndustries = $derived([...knownIndustries].sort());

	// ── Company form & delete ────────────────────────────────────────────────────
	let showForm = $state(false);
	let editTarget = $state<CompanyDetailResponse | null>(null);
	let deleteTargetId = $state<string | null>(null);
	let deleteTargetName = $state('');
	let deleteBusy = $state(false);
	let showImport = $state(false);

	// ── BDM bulk select ──────────────────────────────────────────────────────────
	const selectedIds = new SvelteSet<string>();
	let showAssign = $state(false);
	const selectedCompanies = $derived(companies.filter((c) => selectedIds.has(c.id)));
	const allSelected = $derived(companies.length > 0 && selectedIds.size === companies.length);

	// ── Accordion ────────────────────────────────────────────────────────────────
	const expandedIds = new SvelteSet<string>();
	const contactsCache = new SvelteMap<string, ContactResponse[]>();
	const loadingContactIds = new SvelteSet<string>();

	// ── INFO drawer ──────────────────────────────────────────────────────────────
	let infoCompany = $state<CompanyDetailResponse | null>(null);
	let infoLoadingId = $state<string | null>(null);

	// ── Contact form ─────────────────────────────────────────────────────────────
	let showContactForm = $state(false);
	let contactFormCompanyId = $state('');
	let contactEdit = $state<ContactResponse | null>(null);

	// ── Contact delete ───────────────────────────────────────────────────────────
	let contactDeleteId = $state<string | null>(null);
	let contactDeleteName = $state('');
	let contactDeleteCompanyId = $state('');
	let contactDeleteBusy = $state(false);

	// ── Lead status update (action / response) ────────────────────────────────────
	let statusLead = $state<ContactResponse | null>(null);
	let statusCompanyId = $state('');
	let showActionStatus = $state(false);
	let showResponseStatus = $state(false);

	// ── Load companies ───────────────────────────────────────────────────────────
	async function load() {
		loading = true;
		errorMsg = '';
		try {
			const res = await companiesApi.listCompanies({
				page,
				limit: PAGE_SIZE,
				search: search || undefined,
				industry: industryFilter || undefined,
				unassigned: unassignedOnly || undefined
			});
			companies = res.data;
			pagination = res.pagination;
			selectedIds.clear();
			const seen = new SvelteSet(knownIndustries);
			for (const c of res.data) {
				if (c.industry && !seen.has(c.industry)) {
					seen.add(c.industry);
					knownIndustries = [...knownIndustries, c.industry];
				}
			}

			// Saat ada search query, otomatis expand semua accordion supaya
			// BDM bisa langsung melihat lead yang cocok tanpa klik satu-satu.
			if (search.trim()) {
				for (const c of res.data) {
					expandedIds.add(c.id);
					if (!contactsCache.has(c.id)) fetchContacts(c.id);
				}
			} else {
				expandedIds.clear();
			}
		} catch (err) {
			errorMsg = toMessage(err);
			companies = [];
		} finally {
			loading = false;
		}
	}

	onMount(load);

	let debounce: ReturnType<typeof setTimeout>;
	function onSearchInput() {
		clearTimeout(debounce);
		debounce = setTimeout(() => {
			page = 1;
			load();
		}, 350);
	}
	function onIndustryChange() {
		page = 1;
		load();
	}
	function toggleUnassigned() {
		unassignedOnly = !unassignedOnly;
		page = 1;
		load();
	}
	function goPage(p: number) {
		page = p;
		load();
	}

	// ── Accordion ────────────────────────────────────────────────────────────────
	async function toggleExpand(companyId: string) {
		if (expandedIds.has(companyId)) {
			expandedIds.delete(companyId);
			return;
		}
		expandedIds.add(companyId);
		if (contactsCache.has(companyId)) return;
		await fetchContacts(companyId);
	}

	async function fetchContacts(companyId: string) {
		loadingContactIds.add(companyId);
		try {
			const res = await contactsApi.listContacts(companyId);
			contactsCache.set(companyId, res.data);
		} catch (err) {
			toast.error(toMessage(err));
			expandedIds.delete(companyId);
		} finally {
			loadingContactIds.delete(companyId);
		}
	}

	async function refreshContacts(companyId: string) {
		try {
			const res = await contactsApi.listContacts(companyId);
			contactsCache.set(companyId, res.data);
		} catch (err) {
			toast.error(toMessage(err));
		}
	}

	// ── Company CRUD ─────────────────────────────────────────────────────────────
	function openCreate() {
		editTarget = null;
		showForm = true;
	}
	function onSaved() {
		showForm = false;
		editTarget = null;
		load();
	}

	function onInfoEdit(c: CompanyDetailResponse) {
		infoCompany = null;
		editTarget = c;
		showForm = true;
	}
	function onInfoDelete(c: CompanyDetailResponse) {
		infoCompany = null;
		deleteTargetId = c.id;
		deleteTargetName = c.name;
	}

	async function confirmDeleteCompany() {
		if (!deleteTargetId) return;
		deleteBusy = true;
		try {
			await companiesApi.deleteCompany(deleteTargetId);
			toast.success('Account deleted successfully.');
			if (companies.length === 1 && page > 1) page -= 1;
			deleteTargetId = null;
			deleteTargetName = '';
			load();
		} catch (err) {
			toast.error(toMessage(err));
		} finally {
			deleteBusy = false;
		}
	}

	// ── INFO drawer ──────────────────────────────────────────────────────────────
	async function openInfo(c: CompanyResponse) {
		if (infoLoadingId === c.id) return;
		infoLoadingId = c.id;
		try {
			infoCompany = await companiesApi.getCompany(c.id);
		} catch (err) {
			toast.error(toMessage(err));
		} finally {
			infoLoadingId = null;
		}
	}

	// ── Contact CRUD ─────────────────────────────────────────────────────────────
	function openAddLead(companyId: string) {
		contactFormCompanyId = companyId;
		contactEdit = null;
		showContactForm = true;
	}
	function openEditContact(lead: ContactResponse, companyId: string) {
		contactFormCompanyId = companyId;
		contactEdit = lead;
		showContactForm = true;
	}
	async function onContactSaved() {
		showContactForm = false;
		contactEdit = null;
		await refreshContacts(contactFormCompanyId);
		load();
	}

	function openDeleteContact(lead: ContactResponse, companyId: string) {
		contactDeleteId = lead.id;
		contactDeleteName = lead.name;
		contactDeleteCompanyId = companyId;
	}
	async function confirmContactDelete() {
		if (!contactDeleteId) return;
		contactDeleteBusy = true;
		try {
			await contactsApi.deleteContact(contactDeleteId);
			toast.success('Lead deleted.');
			const cid = contactDeleteCompanyId;
			contactDeleteId = null;
			contactDeleteName = '';
			contactDeleteCompanyId = '';
			await refreshContacts(cid);
			load();
		} catch (err) {
			toast.error(toMessage(err));
		} finally {
			contactDeleteBusy = false;
		}
	}

	// ── Lead status update ─────────────────────────────────────────────────────────
	function openActionStatus(lead: ContactResponse, companyId: string) {
		statusLead = lead;
		statusCompanyId = companyId;
		showActionStatus = true;
	}
	function openResponseStatus(lead: ContactResponse, companyId: string) {
		statusLead = lead;
		statusCompanyId = companyId;
		showResponseStatus = true;
	}
	async function onStatusSaved() {
		showActionStatus = false;
		showResponseStatus = false;
		const cid = statusCompanyId;
		statusLead = null;
		statusCompanyId = '';
		await refreshContacts(cid);
		load();
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
		load();
	}

	// ── Stage funnel filter ───────────────────────────────────────────────────────
	type StageKey = 'all' | 'belum_dihubungi' | 'sudah_dihubungi' | 'tertarik' | 'meeting';
	const STAGES: { key: StageKey; label: string }[] = [
		{ key: 'all', label: 'Semua' },
		{ key: 'belum_dihubungi', label: 'Belum Dihubungi' },
		{ key: 'sudah_dihubungi', label: 'Sudah Dihubungi' },
		{ key: 'tertarik', label: 'Tertarik' },
		{ key: 'meeting', label: 'Meeting' }
	];
	let stage = $state<StageKey>('all');

	function filterLeads(leads: ContactResponse[]): ContactResponse[] {
		if (stage === 'all') return leads;
		return leads.filter((c) => {
			switch (stage) {
				case 'belum_dihubungi':
					return c.action_status === 'belum_dihubungi';
				case 'sudah_dihubungi':
					return c.action_status === 'sudah_dihubungi';
				case 'tertarik':
					return c.response_status === 'tertarik';
				case 'meeting':
					return c.is_meeting_scheduled;
				default:
					return true;
			}
		});
	}

	// ── Helpers ──────────────────────────────────────────────────────────────────
	function waHref(phone: string | null): string | null {
		if (!phone) return null;
		const digits = phone.replace(/\D/g, '');
		return digits ? `https://wa.me/${digits}` : null;
	}

	/** Cek apakah lead cocok dengan search query saat ini (untuk highlight). */
	function leadMatchesSearch(lead: ContactResponse): boolean {
		if (!search.trim()) return false;
		const q = search.toLowerCase();
		return (
			lead.name.toLowerCase().includes(q) ||
			(lead.job_title?.toLowerCase().includes(q) ?? false)
		);
	}
</script>

<svelte:head><title>Accounts · CRM Telesales</title></svelte:head>

<PageHeader title="Accounts" description="Daftar perusahaan dan leads telesales.">
	{#snippet actions()}
		{#if canWrite}
			<Button variant="secondary" onclick={() => (showImport = true)}>
				<Icon name="upload" size={16} /> Import
			</Button>
			<Button onclick={openCreate}>
				<Icon name="building-2" size={16} /> Add Account
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
			placeholder="Cari perusahaan / nama lead / jabatan…"
			maxlength="200"
			class="h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink focus:border-brand focus:ring-2 focus:ring-brand/25 focus:outline-none"
		/>
	</div>
	{#if knownIndustries.length > 0}
		<select
			bind:value={industryFilter}
			onchange={onIndustryChange}
			class="h-10 min-w-48 shrink-0 rounded-lg border border-brand/40 bg-surface px-3 text-sm text-ink focus:border-brand focus:ring-2 focus:ring-brand/25 focus:outline-none"
			aria-label="Filter by industry"
		>
			<option value="">All Industries</option>
			{#each sortedIndustries as ind (ind)}
				<option value={ind}>{ind}</option>
			{/each}
		</select>
	{/if}
	{#if canFilterUnassigned}
		<label
			class="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-sm text-muted"
		>
			<input type="checkbox" checked={unassignedOnly} onchange={toggleUnassigned} class="rounded" />
			Unassigned only
		</label>
	{/if}
</div>

<!-- BDM selection bar -->
{#if canAssign && selectedIds.size > 0}
	<div
		class="mb-4 flex items-center justify-between rounded-lg border border-brand/30 bg-brand-soft px-4 py-2.5 text-sm"
	>
		<span class="font-medium text-brand"
			>{selectedIds.size} account{selectedIds.size > 1 ? 's' : ''} selected</span
		>
		<div class="flex items-center gap-2">
			<button
				type="button"
				class="inline-flex rounded-lg px-2.5 py-1 text-xs font-medium text-muted hover:bg-surface"
				onclick={() => selectedIds.clear()}
			>
				Deselect
			</button>
			<Button onclick={() => (showAssign = true)}>
				<Icon name="users" size={16} /> Assign / Reassign
			</Button>
		</div>
	</div>
{/if}

<!-- Funnel stage chips -->
<div class="mb-4 flex flex-wrap items-center gap-2">
	<span class="flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted">
		<Icon name="filter" size={14} /> Filter Lead:
	</span>
	{#each STAGES as s (s.key)}
		<button
			type="button"
			onclick={() => (stage = s.key)}
			class="rounded-full border px-3 py-1.5 text-xs font-medium transition-colors {stage === s.key
				? 'border-brand bg-brand text-white'
				: 'border-line-strong bg-surface text-muted hover:bg-surface-2'}"
		>
			{s.label}
		</button>
	{/each}
</div>

<!-- Accordion list -->
<div class="overflow-hidden rounded-xl border border-brand/40 bg-surface">
	{#if loading}
		<LoadingState />
	{:else if errorMsg}
		<EmptyState icon="alert-circle" title="Gagal memuat data" description={errorMsg}>
			{#snippet action()}
				<Button variant="secondary" onclick={load}>Coba Lagi</Button>
			{/snippet}
		</EmptyState>
	{:else if companies.length === 0}
		<EmptyState
			icon="building-2"
			title="Belum ada account"
			description={canWrite ? 'Tambah atau import account untuk memulai.' : 'Tidak ada data.'}
		>
			{#snippet action()}
				{#if canWrite}<Button onclick={openCreate}>Add Account</Button>{/if}
			{/snippet}
		</EmptyState>
	{:else}
		<!-- BDM: select-all header -->
		{#if canAssign}
			<div class="flex items-center gap-2 border-b border-line bg-surface-2 px-4 py-2">
				<input
					type="checkbox"
					checked={allSelected}
					onchange={toggleAll}
					class="rounded"
					aria-label="Select all accounts"
				/>
				<span class="text-xs text-muted">Pilih semua</span>
			</div>
		{/if}

		<div class="divide-y divide-line/60">
			{#each companies as c (c.id)}
				<div>
					<!-- ── Company header row ── -->
					<div class="flex items-center gap-2 px-4 py-3 transition-colors hover:bg-surface-2/60">
						{#if canAssign}
							<input
								type="checkbox"
								checked={selectedIds.has(c.id)}
								onchange={() => toggleRow(c.id)}
								class="shrink-0 rounded"
								aria-label="Select {c.name}"
							/>
						{/if}

						<!-- Expand chevron -->
						<button
							type="button"
							onclick={() => toggleExpand(c.id)}
							class="shrink-0 rounded p-0.5 text-muted transition-colors hover:text-ink"
							aria-label={expandedIds.has(c.id) ? 'Tutup' : 'Buka'}
						>
							<Icon name={expandedIds.has(c.id) ? 'chevron-down' : 'chevron-right'} size={16} />
						</button>

						<!-- Company name + meta (wide clickable area) -->
						<button
							type="button"
							onclick={() => toggleExpand(c.id)}
							class="min-w-0 flex-1 text-left"
						>
							<span class="font-semibold text-ink">{c.name}</span>
							{#if c.industry || c.phone}
								<span class="ml-2 hidden text-xs text-muted sm:inline">
									{[c.industry, c.phone].filter(Boolean).join(' · ')}
								</span>
							{/if}
						</button>

						<!-- Counters -->
						<div class="hidden shrink-0 items-center gap-3 text-xs text-muted sm:flex">
							<span>Lead <strong class="text-ink">{c.contact_count}</strong></span>
							{#if contactsCache.has(c.id)}
								{@const qualified = (contactsCache.get(c.id) ?? []).filter(
									(x) => x.response_status === 'tertarik'
								).length}
								<span>Kontak <strong class="text-ink">{qualified}</strong></span>
							{/if}
						</div>

						<!-- Action buttons -->
						<div class="flex shrink-0 items-center gap-1">
							{#if canManageContacts}
								<button
									type="button"
									onclick={() => openAddLead(c.id)}
									class="inline-flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand/90"
									title="Tambah lead ke {c.name}"
								>
									<Icon name="user-plus" size={13} />
									<span class="hidden sm:inline">Add Lead</span>
								</button>
							{/if}
							<button
								type="button"
								onclick={() => openInfo(c)}
								disabled={infoLoadingId === c.id}
								class="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-3 hover:text-ink disabled:opacity-50"
								title="Info perusahaan"
								aria-label="Info {c.name}"
							>
								{#if infoLoadingId === c.id}
									<Icon name="loader-2" size={16} class="animate-spin" />
								{:else}
									<Icon name="info" size={16} />
								{/if}
							</button>
						</div>
					</div>

					<!-- ── Lead child rows ── -->
					{#if expandedIds.has(c.id)}
						<div class="border-t border-line/40 bg-surface-2/30">
							{#if loadingContactIds.has(c.id)}
								<div class="flex items-center justify-center gap-2 py-5 text-sm text-muted">
									<Icon name="loader-2" size={16} class="animate-spin" /> Memuat leads…
								</div>
							{:else}
								{@const leads = filterLeads(contactsCache.get(c.id) ?? [])}
								{#if leads.length === 0}
									<p class="py-5 text-center text-sm text-subtle">
										Belum ada lead.
										{#if canManageContacts}
											<button
												type="button"
												onclick={() => openAddLead(c.id)}
												class="text-brand underline hover:no-underline">Tambah lead pertama?</button
											>
										{/if}
									</p>
								{:else}
									<div class="divide-y divide-line/30">
										{#each leads as lead (lead.id)}
											<div
												class="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 pl-10 transition-colors hover:bg-surface-2 {leadMatchesSearch(lead) ? 'bg-brand-soft/50 ring-1 ring-brand/20' : ''}"
											>
												<!-- Nama + Jabatan -->
												<div class="w-36 min-w-0 shrink-0">
													<p class="truncate text-sm font-medium text-ink">
														{lead.name}
													</p>
													<p class="truncate text-xs text-subtle">
														{orDash(lead.job_title)}
													</p>
												</div>

												<!-- WA + Email links -->
												<div class="flex w-44 min-w-0 shrink-0 flex-col gap-0.5 text-xs">
													{#if lead.phone}
														{@const wa = waHref(lead.phone)}
														{#if wa}
															<a
																href={wa}
																target="_blank"
																rel="noopener noreferrer"
																class="flex items-center gap-1 truncate text-emerald-600 hover:underline"
																title="WhatsApp {lead.name}"
															>
																<Icon name="message-circle" size={12} />{lead.phone}
															</a>
														{:else}
															<span class="truncate text-muted">{lead.phone}</span>
														{/if}
													{/if}
													{#if lead.email}
														<a
															href="mailto:{lead.email}"
															class="flex items-center gap-1 truncate text-brand hover:underline"
															title="Email {lead.name}"
														>
															<Icon name="mail" size={12} />{lead.email}
														</a>
													{/if}
													{#if !lead.phone && !lead.email}
														<span class="text-subtle">-</span>
													{/if}
												</div>

												<!-- Status + Sub-status badges -->
												<div class="flex flex-1 flex-wrap items-center gap-1.5">
													<Badge
														label={ACTION_STATUS_LABEL[lead.action_status]}
														tone={ACTION_STATUS_BADGE[lead.action_status]}
													/>
													{#if lead.response_status}
														<Badge
															label={RESPONSE_STATUS_LABEL[lead.response_status]}
															tone={RESPONSE_STATUS_BADGE[lead.response_status]}
														/>
													{/if}
												</div>

												<!-- Status + Edit + Delete icons -->
												{#if canManageContacts || canUpdateAction || canUpdateResponse}
													<div class="ml-auto flex shrink-0 items-center gap-1">
														{#if canUpdateAction}
															<button
																type="button"
																onclick={() => openActionStatus(lead, c.id)}
																class="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-3 hover:text-blue-600"
																title="Ubah status kontak {lead.name}"
																aria-label="Ubah status kontak {lead.name}"
															>
																<Icon name="phone" size={14} />
															</button>
														{/if}
														{#if canUpdateResponse}
															<button
																type="button"
																onclick={() => openResponseStatus(lead, c.id)}
																class="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-3 hover:text-emerald-600"
																title="Ubah status respon {lead.name}"
																aria-label="Ubah status respon {lead.name}"
															>
																<Icon name="check-circle" size={14} />
															</button>
														{/if}
														{#if canManageContacts}
															<button
																type="button"
																onclick={() => openEditContact(lead, c.id)}
																class="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-3 hover:text-brand"
																title="Edit {lead.name}"
																aria-label="Edit {lead.name}"
															>
																<Icon name="pencil" size={14} />
															</button>
															<button
																type="button"
																onclick={() => openDeleteContact(lead, c.id)}
																class="rounded-lg p-1.5 text-muted transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
																title="Hapus {lead.name}"
																aria-label="Hapus {lead.name}"
															>
																<Icon name="trash-2" size={14} />
															</button>
														{/if}
													</div>
												{/if}
											</div>
										{/each}
									</div>
								{/if}
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>

		{#if pagination}
			<Paginator
				page={pagination.current_page}
				totalPages={pagination.total_pages}
				totalItems={pagination.total_items}
				onpage={goPage}
			/>
		{/if}
	{/if}
</div>

<!-- Modals & drawers -->
{#if showForm}
	<CompanyFormModal company={editTarget} onclose={() => (showForm = false)} onsaved={onSaved} />
{/if}

{#if infoCompany}
	<CompanyInfoDrawer
		company={infoCompany}
		{canWrite}
		onclose={() => (infoCompany = null)}
		onedit={onInfoEdit}
		ondelete={onInfoDelete}
	/>
{/if}

{#if deleteTargetId}
	<ConfirmDialog
		title="Hapus Account"
		message={`Yakin ingin menghapus "${deleteTargetName}"? Tindakan ini tidak dapat dibatalkan.`}
		confirmLabel="Hapus"
		danger
		loading={deleteBusy}
		onconfirm={confirmDeleteCompany}
		oncancel={() => {
			deleteTargetId = null;
			deleteTargetName = '';
		}}
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
	<ImportCompaniesModal onclose={() => (showImport = false)} onimported={load} />
{/if}

{#if showContactForm}
	<ContactFormModal
		companyId={contactFormCompanyId}
		contact={contactEdit}
		onclose={() => (showContactForm = false)}
		onsaved={onContactSaved}
	/>
{/if}

{#if contactDeleteId}
	<ConfirmDialog
		title="Hapus Lead"
		message={`Yakin ingin menghapus lead "${contactDeleteName}"?`}
		confirmLabel="Hapus"
		danger
		loading={contactDeleteBusy}
		onconfirm={confirmContactDelete}
		oncancel={() => {
			contactDeleteId = null;
			contactDeleteName = '';
			contactDeleteCompanyId = '';
		}}
	/>
{/if}

{#if showActionStatus && statusLead}
	<ActionStatusModal
		contact={statusLead}
		onclose={() => (showActionStatus = false)}
		onsaved={onStatusSaved}
	/>
{/if}

{#if showResponseStatus && statusLead}
	<ResponseStatusModal
		contact={statusLead}
		onclose={() => (showResponseStatus = false)}
		onsaved={onStatusSaved}
	/>
{/if}
