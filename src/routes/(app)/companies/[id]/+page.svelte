<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import {
		ApiError,
		auth,
		can,
		companiesApi,
		contactsApi,
		dealsApi,
		implementationProjectsApi,
		toMessage,
		formatDate,
		formatCurrency,
		orDash,
		waNumber,
		LatestRequest,
		ACTION_STATUS_LABEL,
		ACTION_STATUS_BADGE,
		RESPONSE_STATUS_LABEL,
		RESPONSE_STATUS_BADGE,
		IMPLEMENTATION_DELIVERY_STATUSES,
		IMPLEMENTATION_DELIVERY_STATUS_BADGE,
		IMPLEMENTATION_DELIVERY_STATUS_LABEL,
		IMPLEMENTATION_STAGES,
		IMPLEMENTATION_STAGE_LABEL
	} from '$lib';
	import { toast } from '$lib/stores/toast.svelte';
	import { PIPELINE_PHASE_LABEL } from '$lib/constants/enums';
	import type {
		CompanyDetailResponse,
		ContactResponse,
		DealResponse,
		ImplementationProjectResponse,
		ImplementationActivityResponse,
		DealDetailResponse
	} from '$lib/types/api';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import LoadingState from '$lib/components/ui/LoadingState.svelte';
	import Paginator from '$lib/components/ui/Pagination.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import ContactFormModal from '$lib/components/contacts/ContactFormModal.svelte';
	import ActionStatusModal from '$lib/components/contacts/ActionStatusModal.svelte';
	import ResponseStatusModal from '$lib/components/contacts/ResponseStatusModal.svelte';
	import CompanyFormModal from '$lib/components/companies/CompanyFormModal.svelte';
	import CreateDealModal from '$lib/components/pipeline/CreateDealModal.svelte';
	import ImplementationActivityTimeline from '$lib/components/companies/ImplementationActivityTimeline.svelte';

	const canWrite = can(auth.role, 'createCompany');
	const canCreateDeal = can(auth.role, 'editDeal');
	const canManageContacts = can(auth.role, 'manageContacts');
	const canUpdateAction = can(auth.role, 'updateActionStatus');
	const canUpdateResponse = can(auth.role, 'updateResponseStatus');

	const PROJECT_PAGE_SIZE = 5;
	const COMPANY_DEAL_PAGE_SIZE = 5;
	const ACTIVITY_PAGE_SIZE = 6;

	const SUBSCRIPTION_STATUS_LABEL: Record<'active' | 'expiring_soon' | 'expired', string> = {
		active: 'Aktif',
		expiring_soon: 'Segera Berakhir',
		expired: 'Kedaluwarsa'
	};
	const SUBSCRIPTION_STATUS_TONE: Record<'active' | 'expiring_soon' | 'expired', string> = {
		active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
		expiring_soon: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
		expired: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
	};

	let activeTab = $state<'leads' | 'info' | 'subscription' | 'deals'>('leads');

	// ── Company details state ───────────────────────────────────────────────────
	let company = $state<CompanyDetailResponse | null>(null);
	let companyLoading = $state(true);
	let companyError = $state('');
	const companyStatus = $derived(company?.status);

	// ── Company edit & delete state ──────────────────────────────────────────────
	let showEditCompany = $state(false);
	let showDeleteCompany = $state(false);
	let deleteBusy = $state(false);

	// ── Leads (Contacts) state ───────────────────────────────────────────────────
	let leads = $state<ContactResponse[]>([]);
	let leadsLoading = $state(false);
	let leadsError = $state('');

	let showContactForm = $state(false);
	let contactEdit = $state<ContactResponse | null>(null);
	let showContactDelete = $state(false);
	let contactDeleteId = $state<string | null>(null);
	let contactDeleteName = $state('');
	let contactDeleteBusy = $state(false);

	let showActionStatus = $state(false);
	let showResponseStatus = $state(false);
	let statusLead = $state<ContactResponse | null>(null);

	// ── Projects (Subscriptions) state ───────────────────────────────────────────
	let projectFilterStage = $state('');
	let projectFilterStatus = $state('');
	let projectPage = $state(1);
	let projects = $state<ImplementationProjectResponse[]>([]);
	let projectsLoading = $state(false);
	let projectsError = $state('');
	let projectTotalPages = $state(1);
	let projectTotalItems = $state(0);
	let selectedProjectId = $state('');

	let projectDetail = $state<ImplementationProjectResponse | null>(null);
	let projectDetailLoading = $state(false);
	let projectDetailError = $state('');

	let activityPage = $state(1);
	let activities = $state<ImplementationActivityResponse[]>([]);
	let activitiesLoading = $state(false);
	let activitiesError = $state('');
	let activityTotalPages = $state(1);
	let activityTotalItems = $state(0);

	let formStage = $state('');
	let formStatus = $state('');
	let plannedStartDate = $state('');
	let actualStartDate = $state('');
	let plannedGoLiveDate = $state('');
	let actualGoLiveDate = $state('');
	let projectNotes = $state('');
	let changeReason = $state('');
	let savingProject = $state(false);
	let formError = $state('');

	const listRequest = new LatestRequest();
	const detailRequest = new LatestRequest();
	const activitiesRequest = new LatestRequest();

	const stageOptions = IMPLEMENTATION_STAGES.map((value) => ({
		value,
		label: IMPLEMENTATION_STAGE_LABEL[value]
	}));
	const statusOptions = IMPLEMENTATION_DELIVERY_STATUSES.map((value) => ({
		value,
		label: IMPLEMENTATION_DELIVERY_STATUS_LABEL[value]
	}));
	const filterStageOptions = [{ value: '', label: 'Semua Stage' }, ...stageOptions];
	const filterStatusOptions = [{ value: '', label: 'Semua Status' }, ...statusOptions];

	const projectReadOnly = $derived(
		!canWrite ||
			!projectDetail ||
			projectDetail.delivery_status === 'completed' ||
			projectDetail.delivery_status === 'cancelled'
	);

	// ── Deals state ─────────────────────────────────────────────────────────────
	let companyDeals = $state<DealResponse[]>([]);
	let companyDealsLoading = $state(false);
	let companyDealsError = $state('');
	let companyDealPage = $state(1);
	let companyDealTotalPages = $state(1);
	let companyDealTotalItems = $state(0);
	let showCreateDeal = $state(false);

	const companyDealsRequest = new LatestRequest();

	// ── Loaders ──────────────────────────────────────────────────────────────────
	async function loadCompany() {
		const id = page.params.id;
		if (!id) return;
		companyLoading = true;
		companyError = '';
		try {
			company = await companiesApi.getCompany(id);
		} catch (err) {
			companyError = toMessage(err);
		} finally {
			companyLoading = false;
		}
	}

	async function loadLeads() {
		const id = page.params.id;
		if (!id) return;
		leadsLoading = true;
		leadsError = '';
		try {
			const res = await contactsApi.listContacts(id);
			leads = res.data;
		} catch (err) {
			leadsError = toMessage(err);
		} finally {
			leadsLoading = false;
		}
	}

	async function loadProjects(pageNum = projectPage) {
		const id = page.params.id;
		if (!id) return;
		const controller = listRequest.start();
		projectsLoading = true;
		projectsError = '';
		try {
			const result = await implementationProjectsApi.listByCompany(
				id,
				{
					page: pageNum,
					limit: PROJECT_PAGE_SIZE,
					stage: projectFilterStage || undefined,
					delivery_status: projectFilterStatus || undefined
				},
				controller.signal
			);
			if (!listRequest.isCurrent(controller)) return;
			projects = result.data;
			projectTotalPages = result.pagination.total_pages;
			projectTotalItems = result.pagination.total_items;
			const preferred =
				result.data.find((item) => item.id === selectedProjectId) ?? result.data[0] ?? null;
			selectedProjectId = preferred?.id ?? '';
		} catch (err) {
			if (!listRequest.isCurrent(controller)) return;
			projects = [];
			projectTotalPages = 1;
			projectTotalItems = 0;
			selectedProjectId = '';
			projectsError = toMessage(err);
		} finally {
			if (listRequest.finish(controller)) projectsLoading = false;
		}
	}

	async function loadProjectDetail(projId: string) {
		const controller = detailRequest.start();
		projectDetailLoading = true;
		projectDetailError = '';
		try {
			const result = await implementationProjectsApi.getDetail(projId, controller.signal);
			if (!detailRequest.isCurrent(controller)) return;
			projectDetail = result;
			formStage = result.stage;
			formStatus = result.delivery_status;
			plannedStartDate = result.planned_start_date ?? '';
			actualStartDate = result.actual_start_date ?? '';
			plannedGoLiveDate = result.planned_go_live_date ?? '';
			actualGoLiveDate = result.actual_go_live_date ?? '';
			projectNotes = result.notes ?? '';
			changeReason = '';
			formError = '';
		} catch (err) {
			if (!detailRequest.isCurrent(controller)) return;
			projectDetail = null;
			projectDetailError = toMessage(err);
		} finally {
			if (detailRequest.finish(controller)) projectDetailLoading = false;
		}
	}

	async function loadActivities(projId: string, page = activityPage) {
		const controller = activitiesRequest.start();
		activitiesLoading = true;
		activitiesError = '';
		try {
			const result = await implementationProjectsApi.getActivities(
				projId,
				{ page, limit: ACTIVITY_PAGE_SIZE },
				controller.signal
			);
			if (!activitiesRequest.isCurrent(controller)) return;
			activities = result.data;
			activityTotalPages = result.pagination.total_pages;
			activityTotalItems = result.pagination.total_items;
		} catch (err) {
			if (!activitiesRequest.isCurrent(controller)) return;
			activities = [];
			activityTotalPages = 1;
			activityTotalItems = 0;
			activitiesError = toMessage(err);
		} finally {
			if (activitiesRequest.finish(controller)) activitiesLoading = false;
		}
	}

	async function loadCompanyDeals(pageNum = companyDealPage) {
		const id = page.params.id;
		if (!id) return;
		const controller = companyDealsRequest.start();
		companyDealsLoading = true;
		companyDealsError = '';
		try {
			const result = await dealsApi.getCompanyDeals(
				id,
				{ page: pageNum, limit: COMPANY_DEAL_PAGE_SIZE },
				controller.signal
			);
			if (!companyDealsRequest.isCurrent(controller)) return;
			companyDeals = result.data;
			companyDealTotalPages = result.pagination.total_pages;
			companyDealTotalItems = result.pagination.total_items;
		} catch (err) {
			if (!companyDealsRequest.isCurrent(controller)) return;
			companyDeals = [];
			companyDealTotalPages = 1;
			companyDealTotalItems = 0;
			companyDealsError = toMessage(err);
		} finally {
			if (companyDealsRequest.finish(controller)) companyDealsLoading = false;
		}
	}

	onMount(() => {
		void loadCompany();
		void loadLeads();
		return () => {
			listRequest.abort();
			detailRequest.abort();
			activitiesRequest.abort();
			companyDealsRequest.abort();
		};
	});

	$effect(() => {
		if (activeTab === 'subscription') {
			void loadProjects(1);
		} else if (activeTab === 'deals') {
			void loadCompanyDeals(1);
		}
	});

	$effect(() => {
		const id = selectedProjectId;
		if (!id) {
			projectDetail = null;
			activities = [];
			activityTotalPages = 1;
			activityTotalItems = 0;
			return;
		}
		activityPage = 1;
		void Promise.all([loadProjectDetail(id), loadActivities(id, 1)]);
	});

	// ── Company CRUD ─────────────────────────────────────────────────────────────
	function onSaved() {
		showEditCompany = false;
		void loadCompany();
	}

	async function confirmDeleteCompany() {
		const id = page.params.id;
		if (!id) return;
		deleteBusy = true;
		try {
			await companiesApi.deleteCompany(id);
			toast.success('Account deleted successfully.');
			void goto('/companies');
		} catch (err) {
			toast.error(toMessage(err));
		} finally {
			deleteBusy = false;
			showDeleteCompany = false;
		}
	}

	// ── Contact CRUD ─────────────────────────────────────────────────────────────
	function openAddLead() {
		contactEdit = null;
		showContactForm = true;
	}
	function openEditContact(lead: ContactResponse) {
		contactEdit = lead;
		showContactForm = true;
	}
	function openDeleteContact(lead: ContactResponse) {
		contactDeleteId = lead.id;
		contactDeleteName = lead.name;
		showContactDelete = true;
	}
	async function onContactSaved() {
		showContactForm = false;
		void loadLeads();
	}
	async function confirmContactDelete() {
		if (!contactDeleteId) return;
		contactDeleteBusy = true;
		try {
			await contactsApi.deleteContact(contactDeleteId);
			toast.success('Lead deleted.');
			showContactDelete = false;
			void loadLeads();
		} catch (err) {
			if (err instanceof ApiError && err.status === 409) {
				toast.error(
					'Contact ini masih menjadi PIC deal aktif. Ganti PIC atau tutup deal tersebut terlebih dahulu.'
				);
			} else {
				toast.error(toMessage(err));
			}
		} finally {
			contactDeleteBusy = false;
		}
	}

	// ── Lead status update ─────────────────────────────────────────────────────────
	function openActionStatus(lead: ContactResponse) {
		statusLead = lead;
		showActionStatus = true;
	}
	function openResponseStatus(lead: ContactResponse) {
		if (!contactsApi.canRecordResponse(lead.action_status)) {
			toast.error('Set status kontak ke "Sudah Dihubungi" dulu sebelum mengisi respon.');
			return;
		}
		statusLead = lead;
		showResponseStatus = true;
	}
	function onStatusSaved() {
		showActionStatus = false;
		showResponseStatus = false;
		void loadLeads();
	}

	// ── Project saving ───────────────────────────────────────────────────────────
	function validateProjectForm() {
		if (!projectDetail) return 'Project tidak tersedia.';
		if (
			(formStage === 'go_live' ||
				(projectDetail.stage !== 'go_live' && formStage === 'handover_completed')) &&
			actualGoLiveDate &&
			!/^\d{4}-\d{2}-\d{2}$/.test(actualGoLiveDate)
		) {
			return 'Format tanggal harus YYYY-MM-DD.';
		}
		const dates = [plannedStartDate, actualStartDate, plannedGoLiveDate, actualGoLiveDate].filter(
			Boolean
		);
		if (dates.some((value) => !/^\d{4}-\d{2}-\d{2}$/.test(value))) {
			return 'Format tanggal harus YYYY-MM-DD.';
		}
		if (formStage === 'handover_completed' && formStatus !== 'completed') {
			return 'Stage Handover Completed harus berstatus Completed.';
		}
		if (
			IMPLEMENTATION_STAGES.indexOf(formStage as (typeof IMPLEMENTATION_STAGES)[number]) <
				IMPLEMENTATION_STAGES.indexOf(
					projectDetail.stage as (typeof IMPLEMENTATION_STAGES)[number]
				) &&
			!changeReason.trim()
		) {
			return 'Alasan wajib diisi saat koreksi stage mundur.';
		}
		return '';
	}

	async function saveProject(e: SubmitEvent) {
		e.preventDefault();
		if (!projectDetail || projectReadOnly) return;
		formError = validateProjectForm();
		if (formError) return;
		savingProject = true;
		try {
			const updated = await implementationProjectsApi.update(projectDetail.id, {
				expected_version: projectDetail.version,
				stage: formStage !== projectDetail.stage ? formStage : undefined,
				delivery_status: formStatus !== projectDetail.delivery_status ? formStatus : undefined,
				planned_start_date:
					plannedStartDate !== (projectDetail.planned_start_date ?? '')
						? plannedStartDate
						: undefined,
				actual_start_date:
					actualStartDate !== (projectDetail.actual_start_date ?? '') ? actualStartDate : undefined,
				planned_go_live_date:
					plannedGoLiveDate !== (projectDetail.planned_go_live_date ?? '')
						? plannedGoLiveDate
						: undefined,
				actual_go_live_date:
					actualGoLiveDate !== (projectDetail.actual_go_live_date ?? '')
						? actualGoLiveDate
						: undefined,
				notes: projectNotes !== (projectDetail.notes ?? '') ? projectNotes : undefined,
				change_reason: changeReason.trim() || undefined
			});
			projectDetail = updated;
			formStage = updated.stage;
			formStatus = updated.delivery_status;
			changeReason = '';
			await Promise.all([
				loadProjects(projectPage),
				loadActivities(updated.id, activityPage)
			]);
			toast.success('Pembaruan progress project berhasil disimpan.');
		} catch (err) {
			if (err instanceof ApiError && err.status === 409) {
				await Promise.all([
					loadProjectDetail(projectDetail.id),
					loadActivities(projectDetail.id, activityPage),
					loadProjects(projectPage)
				]);
			}
			formError = toMessage(err);
		} finally {
			savingProject = false;
		}
	}

	// ── Pagination helpers ───────────────────────────────────────────────────────
	function goProjectPage(next: number) {
		projectPage = next;
		void loadProjects(next);
	}
	function goActivityPage(next: number) {
		if (!selectedProjectId) return;
		activityPage = next;
		void loadActivities(selectedProjectId, next);
	}
	function goCompanyDealPage(next: number) {
		companyDealPage = next;
		void loadCompanyDeals(next);
	}

	async function handleCreated(deal: DealDetailResponse) {
		showCreateDeal = false;
		await goto(`/pipeline?deal=${encodeURIComponent(deal.id)}`);
	}

	function asNumber(value: string | number | null | undefined) {
		return Number(value ?? 0);
	}

	function subscriptionBadge(status: 'active' | 'expiring_soon' | 'expired' | null) {
		if (!status) return null;
		return {
			label: SUBSCRIPTION_STATUS_LABEL[status],
			tone: SUBSCRIPTION_STATUS_TONE[status]
		};
	}

	function waHref(phone: string | null): string | null {
		const n = waNumber(phone);
		return n ? `https://wa.me/${n}` : null;
	}
</script>

<svelte:head>
	<title>{company ? company.name : 'Detail Perusahaan'} · CRM Telesales</title>
</svelte:head>

<div class="space-y-6">
	<!-- Breadcrumbs and header navigation -->
	<div class="pt-6">
		<a href="/companies" class="text-xs text-muted hover:underline inline-flex items-center gap-1">
			<Icon name="arrow-left" size={12} /> Kembali ke Perusahaan & Lead
		</a>
	</div>

	{#if companyLoading}
		<LoadingState />
	{:else if companyError}
		<EmptyState icon="alert-circle" title="Gagal memuat detail" description={companyError} />
	{:else if company}
		<PageHeader title={company.name} description={`${orDash(company.industry)} · ${company.address ?? 'Tidak ada alamat'}`}>
			{#snippet actions()}
				{#if canWrite}
					<Button variant="secondary" onclick={() => (showEditCompany = true)}>
						<Icon name="pencil" size={15} /> Edit
					</Button>
					<Button variant="secondary" onclick={() => (showDeleteCompany = true)} class="border-red-200 text-red-600 hover:bg-red-50">
						<Icon name="trash-2" size={15} /> Hapus
					</Button>
				{/if}
				{#if canCreateDeal && companyStatus !== 'leads'}
					<Button onclick={() => (showCreateDeal = true)}>
						<Icon name="plus" size={15} /> Buat Deal Baru
					</Button>
				{/if}
			{/snippet}
		</PageHeader>

		<!-- Tabs navigation -->
		<div class="border-b border-line">
			<nav class="-mb-px flex gap-6 text-sm font-medium">
				<button
					type="button"
					onclick={() => (activeTab = 'leads')}
					class="border-b-2 px-1 pb-4 transition-colors {activeTab === 'leads' ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink'}"
				>
					Lead ({company.contact_count})
				</button>
				<button
					type="button"
					onclick={() => (activeTab = 'info')}
					class="border-b-2 px-1 pb-4 transition-colors {activeTab === 'info' ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink'}"
				>
					Info Perusahaan
				</button>
				<button
					type="button"
					onclick={() => (activeTab = 'subscription')}
					class="border-b-2 px-1 pb-4 transition-colors {activeTab === 'subscription' ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink'}"
				>
					Langganan
				</button>
				<button
					type="button"
					onclick={() => (activeTab = 'deals')}
					class="border-b-2 px-1 pb-4 transition-colors {activeTab === 'deals' ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink'}"
				>
					Deal
				</button>
			</nav>
		</div>

		<!-- Tab Content Area -->
		<div class="mt-4">
			{#if activeTab === 'leads'}
				<!-- ── TAB LEADS ── -->
				<div class="space-y-4">
					<div class="flex items-center justify-between">
						<h3 class="text-sm font-semibold text-ink">Kontak Prospek (Leads)</h3>
						{#if canManageContacts}
							<Button size="sm" onclick={openAddLead}>
								<Icon name="user-plus" size={14} /> Tambah Lead
							</Button>
						{/if}
					</div>

					<div class="overflow-x-auto rounded-xl border border-line bg-surface">
						{#if leadsLoading}
							<LoadingState />
						{:else if leadsError}
							<EmptyState icon="alert-circle" title="Gagal memuat lead" description={leadsError} />
						{:else if leads.length === 0}
							<EmptyState
								icon="contact-2"
								title="Belum ada lead"
								description={canManageContacts ? 'Tambah lead pertama untuk mulai menghubungi.' : 'Tidak ada lead.'}
							>
								{#snippet action()}
									{#if canManageContacts}
										<Button size="sm" onclick={openAddLead}>Tambah Lead</Button>
									{/if}
								{/snippet}
							</EmptyState>
						{:else}
							<table class="w-full border-collapse text-left text-xs">
								<thead>
									<tr class="border-b border-line bg-surface-2 text-ink-soft font-semibold">
										<th class="p-3 font-semibold">Nama</th>
										<th class="p-3 font-semibold">Jabatan</th>
										<th class="p-3 font-semibold">Kontak</th>
										<th class="p-3 font-semibold">WhatsApp</th>
										<th class="p-3 font-semibold">Status Aksi</th>
										<th class="p-3 font-semibold">Status Respon</th>
										{#if canManageContacts || canUpdateAction || canUpdateResponse}
											<th class="p-3 font-semibold text-right">Aksi</th>
										{/if}
									</tr>
								</thead>
								<tbody class="divide-y divide-line/60">
									{#each leads as lead (lead.id)}
										<tr class="hover:bg-surface-2/60 transition-colors">
											<td class="p-3 font-semibold text-ink">{lead.name}</td>
											<td class="p-3 text-muted">{orDash(lead.job_title)}</td>
											<td class="p-3 text-muted">
												<div class="flex flex-col gap-0.5">
													{#if lead.phone}
														<span class="text-ink-soft font-mono">{lead.phone}</span>
													{/if}
													{#if lead.email}
														<span class="text-subtle">{lead.email}</span>
													{/if}
													{#if !lead.phone && !lead.email}
														<span>—</span>
													{/if}
												</div>
											</td>
											<td class="p-3">
												{#if lead.phone}
													{@const wa = waHref(lead.phone)}
													{#if wa}
														<a
															href={wa}
															target="_blank"
															rel="noopener noreferrer"
															class="inline-flex items-center gap-1 font-semibold text-emerald-600 hover:underline"
														>
															<Icon name="message-circle" size={13} /> Chat WA
														</a>
													{:else}
														<span class="text-muted">Tidak valid</span>
													{/if}
												{:else}
													<span class="text-muted">—</span>
												{/if}
											</td>
											<td class="p-3">
												<Badge
													label={ACTION_STATUS_LABEL[lead.action_status]}
													tone={ACTION_STATUS_BADGE[lead.action_status]}
												/>
											</td>
											<td class="p-3">
												{#if lead.response_status}
													<Badge
														label={RESPONSE_STATUS_LABEL[lead.response_status]}
														tone={RESPONSE_STATUS_BADGE[lead.response_status]}
													/>
												{:else}
													<span class="text-muted">—</span>
												{/if}
											</td>
											{#if canManageContacts || canUpdateAction || canUpdateResponse}
												<td class="p-3 text-right">
													<div class="inline-flex items-center gap-1">
														{#if canUpdateAction}
															<button
																type="button"
																onclick={() => openActionStatus(lead)}
																class="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-3 hover:text-blue-600"
																title="Ubah status kontak"
															>
																<Icon name="phone" size={14} />
															</button>
														{/if}
														{#if canUpdateResponse}
															{@const canResp = contactsApi.canRecordResponse(lead.action_status)}
															<button
																type="button"
																onclick={() => openResponseStatus(lead)}
																disabled={!canResp}
																class="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-3 hover:text-emerald-600 disabled:opacity-40 disabled:hover:bg-transparent"
																title={canResp ? 'Ubah status respon' : 'Hubungi kontak terlebih dahulu'}
															>
																<Icon name="check-circle" size={14} />
															</button>
														{/if}
														{#if canManageContacts}
															<button
																type="button"
																onclick={() => openEditContact(lead)}
																class="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-3 hover:text-brand"
																title="Edit"
															>
																<Icon name="pencil" size={14} />
															</button>
															<button
																type="button"
																onclick={() => openDeleteContact(lead)}
																class="rounded-lg p-1.5 text-muted transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
																title="Hapus"
															>
																<Icon name="trash-2" size={14} />
															</button>
														{/if}
													</div>
												</td>
											{/if}
										</tr>
									{/each}
								</tbody>
							</table>
						{/if}
					</div>
				</div>
			{:else if activeTab === 'info'}
				<!-- ── TAB INFO PERUSAHAAN ── -->
				<div class="grid gap-6 md:grid-cols-2">
					<div class="rounded-xl border border-line bg-surface p-5 shadow-sm space-y-4">
						<h3 class="text-sm font-semibold text-ink border-b border-line pb-2">Informasi Umum</h3>
						<dl class="grid grid-cols-2 gap-4 text-xs">
							<div>
								<dt class="text-subtle font-medium uppercase tracking-wider">Telepon</dt>
								<dd class="mt-1 text-sm font-medium text-ink-soft">{orDash(company.phone)}</dd>
							</div>
							<div>
								<dt class="text-subtle font-medium uppercase tracking-wider">Website</dt>
								<dd class="mt-1 text-sm font-medium text-ink-soft">
									{#if company.website}
										<a href={company.website} target="_blank" rel="noopener noreferrer" class="text-brand hover:underline">
											{company.website}
										</a>
									{:else}
										—
									{/if}
								</dd>
							</div>
							<div class="col-span-2">
								<dt class="text-subtle font-medium uppercase tracking-wider">Alamat Lengkap</dt>
								<dd class="mt-1 text-sm font-medium text-ink-soft leading-relaxed">{orDash(company.address)}</dd>
							</div>
						</dl>
					</div>

					<div class="rounded-xl border border-line bg-surface p-5 shadow-sm space-y-4">
						<h3 class="text-sm font-semibold text-ink border-b border-line pb-2">Status Penugasan</h3>
						<dl class="grid grid-cols-2 gap-4 text-xs">
							<div>
								<dt class="text-subtle font-medium uppercase tracking-wider">Ditugaskan Kepada</dt>
								<dd class="mt-1 text-sm font-semibold text-brand">
									{company.assigned_to?.name ?? 'Belum Ditugaskan'}
								</dd>
							</div>
							<div>
								<dt class="text-subtle font-medium uppercase tracking-wider">Ditugaskan Oleh</dt>
								<dd class="mt-1 text-sm font-medium text-ink-soft">
									{company.assigned_by?.name ?? '—'}
								</dd>
							</div>
							<div>
								<dt class="text-subtle font-medium uppercase tracking-wider">Waktu Penugasan</dt>
								<dd class="mt-1 text-sm font-medium text-ink-soft">
									{company.assigned_at ? formatDate(company.assigned_at) : '—'}
								</dd>
							</div>
							<div>
								<dt class="text-subtle font-medium uppercase tracking-wider">Terakhir Diperbarui</dt>
								<dd class="mt-1 text-sm font-medium text-ink-soft">
									{company.created_at ? formatDate(company.created_at) : '—'}
								</dd>
							</div>
						</dl>
					</div>
				</div>
			{:else if activeTab === 'subscription'}
				<!-- ── TAB SUBSCRIPTION & PROJECTS ── -->
				<div class="space-y-6">
					<div class="grid gap-6 md:grid-cols-4">
						<div class="rounded-xl border border-line bg-surface p-4 text-center">
							<p class="text-xs text-muted font-medium">Total Layanan Langganan</p>
							<p class="mt-2 text-2xl font-bold text-ink">
								{company.subscription_summary.active + company.subscription_summary.expiring_soon + company.subscription_summary.expired}
							</p>
						</div>
						<div class="rounded-xl border border-line bg-emerald-50 dark:bg-emerald-950/20 p-4 text-center">
							<p class="text-xs text-emerald-700 dark:text-emerald-300 font-medium">Layanan Aktif</p>
							<p class="mt-2 text-2xl font-bold text-emerald-800 dark:text-emerald-200">
								{company.subscription_summary.active}
							</p>
						</div>
						<div class="rounded-xl border border-line bg-amber-50 dark:bg-amber-950/20 p-4 text-center">
							<p class="text-xs text-amber-700 dark:text-amber-300 font-medium">Segera Berakhir</p>
							<p class="mt-2 text-2xl font-bold text-amber-800 dark:text-amber-200">
								{company.subscription_summary.expiring_soon}
							</p>
						</div>
						<div class="rounded-xl border border-line bg-red-50 dark:bg-red-950/20 p-4 text-center">
							<p class="text-xs text-red-700 dark:text-red-300 font-medium">Layanan Kedaluwarsa</p>
							<p class="mt-2 text-2xl font-bold text-red-800 dark:text-red-200">
								{company.subscription_summary.expired}
							</p>
						</div>
					</div>

					<!-- Implementation Projects -->
					<div class="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
						<!-- Left: projects list -->
						<div class="rounded-xl border border-line bg-surface p-5 shadow-sm space-y-4">
							<div class="flex items-center justify-between border-b border-line pb-2">
								<h3 class="text-sm font-semibold text-ink flex items-center gap-1.5">
									<Icon name="package" size={16} /> Implementation Projects
								</h3>
								<Badge label={`${projectTotalItems} project`} tone="bg-surface-2 text-muted" />
							</div>

							<div class="grid gap-3 sm:grid-cols-2">
								<Select
									label="Filter Stage"
									bind:value={projectFilterStage}
									options={filterStageOptions}
									onchange={() => {
										projectPage = 1;
										void loadProjects(1);
									}}
								/>
								<Select
									label="Filter Status"
									bind:value={projectFilterStatus}
									options={filterStatusOptions}
									onchange={() => {
										projectPage = 1;
										void loadProjects(1);
									}}
								/>
							</div>

							<div class="mt-4 space-y-2">
								{#if projectsLoading}
									<LoadingState />
								{:else if projectsError}
									<EmptyState icon="alert-circle" title="Gagal memuat project" description={projectsError} />
								{:else if projects.length === 0}
									<EmptyState
										icon="layout-kanban"
										title="Belum ada project"
										description="Project otomatis terbuat ketika Deal berstatus WIN memiliki item implementasi."
									/>
								{:else}
									{#each projects as project (project.id)}
										<button
											type="button"
											class="block w-full rounded-lg border p-3 text-left transition-colors {selectedProjectId === project.id ? 'border-brand/40 bg-brand-soft/30' : 'border-line bg-surface hover:bg-surface-2'}"
											onclick={() => (selectedProjectId = project.id)}
										>
											<div class="flex items-start justify-between gap-3">
												<div>
													<p class="font-semibold text-ink">{project.name}</p>
													<p class="mt-0.5 text-xs text-muted">{project.deal.name}</p>
												</div>
												<Badge
													label={IMPLEMENTATION_DELIVERY_STATUS_LABEL[project.delivery_status as keyof typeof IMPLEMENTATION_DELIVERY_STATUS_LABEL] ?? project.delivery_status}
													tone={IMPLEMENTATION_DELIVERY_STATUS_BADGE[project.delivery_status as keyof typeof IMPLEMENTATION_DELIVERY_STATUS_BADGE] ?? 'bg-surface-3 text-muted'}
												/>
											</div>
											<p class="mt-2 text-xs font-medium text-ink-soft">
												Stage: {IMPLEMENTATION_STAGE_LABEL[project.stage as keyof typeof IMPLEMENTATION_STAGE_LABEL] ?? project.stage}
											</p>
										</button>
									{/each}

									{#if projectTotalPages > 1}
										<Paginator
											page={projectPage}
											totalPages={projectTotalPages}
											totalItems={projectTotalItems}
											onpage={goProjectPage}
										/>
									{/if}
								{/if}
							</div>
						</div>

						<!-- Right: project detail & timeline -->
						<div class="space-y-4">
							{#if projectDetailLoading}
								<LoadingState />
							{:else if projectDetailError}
								<EmptyState icon="alert-circle" title="Gagal memuat detail" description={projectDetailError} />
							{:else if projectDetail}
								<div class="rounded-xl border border-line bg-surface p-5 shadow-sm space-y-4">
									<div class="flex items-start justify-between border-b border-line pb-3">
										<div>
											<h3 class="font-semibold text-ink">{projectDetail.name}</h3>
											<p class="text-xs text-muted">Deal: {projectDetail.deal.name}</p>
										</div>
										<Badge
											label={IMPLEMENTATION_DELIVERY_STATUS_LABEL[projectDetail.delivery_status as keyof typeof IMPLEMENTATION_DELIVERY_STATUS_LABEL] ?? projectDetail.delivery_status}
											tone={IMPLEMENTATION_DELIVERY_STATUS_BADGE[projectDetail.delivery_status as keyof typeof IMPLEMENTATION_DELIVERY_STATUS_BADGE] ?? 'bg-surface-3 text-muted'}
										/>
									</div>

									<form class="space-y-4" onsubmit={saveProject}>
										<div class="grid gap-4 sm:grid-cols-2">
											<Select
												label="Stage"
												bind:value={formStage}
												options={stageOptions}
												disabled={projectReadOnly || savingProject}
											/>
											<Select
												label="Delivery Status"
												bind:value={formStatus}
												options={statusOptions}
												disabled={projectReadOnly || savingProject}
											/>
											<TextField
												label="Planned Start"
												type="date"
												bind:value={plannedStartDate}
												disabled={projectReadOnly || savingProject}
											/>
											<TextField
												label="Actual Start"
												type="date"
												bind:value={actualStartDate}
												disabled={projectReadOnly || savingProject}
											/>
											<TextField
												label="Planned Go-Live"
												type="date"
												bind:value={plannedGoLiveDate}
												disabled={projectReadOnly || savingProject}
											/>
											<TextField
												label="Actual Go-Live"
												type="date"
												bind:value={actualGoLiveDate}
												disabled={projectReadOnly || savingProject}
											/>
										</div>

										<Textarea
											label="Catatan"
											rows={2}
											bind:value={projectNotes}
											disabled={projectReadOnly || savingProject}
										/>

										<TextField
											label="Alasan Perubahan"
											bind:value={changeReason}
											disabled={projectReadOnly || savingProject}
											hint="Wajib diisi jika koreksi/mundur ke stage sebelumnya."
										/>

										{#if formError}
											<p class="text-xs font-semibold text-brand">{formError}</p>
										{/if}

										{#if projectReadOnly}
											<p class="text-xs text-muted leading-relaxed">
												{canWrite ? 'Project dengan status Completed / Cancelled bersifat terkunci (read-only).' : 'Hanya BDM yang dapat memperbarui progress project.'}
											</p>
										{:else}
											<div class="flex justify-end pt-2">
												<Button type="submit" size="sm" loading={savingProject}>
													Simpan Progress Project
												</Button>
											</div>
										{/if}
									</form>
								</div>

								<div class="rounded-xl border border-line bg-surface p-5 shadow-sm space-y-4">
									<div class="flex items-center justify-between border-b border-line pb-2">
										<h3 class="font-semibold text-ink">Audit Timeline</h3>
										<Badge label={`${activityTotalItems} aktivitas`} tone="bg-surface-2 text-muted" />
									</div>

									{#if activitiesLoading}
										<LoadingState />
									{:else if activitiesError}
										<EmptyState icon="alert-circle" title="Gagal memuat timeline" description={activitiesError} />
									{:else if activities.length === 0}
										<EmptyState icon="history" title="Belum ada aktivitas" description="Perubahan audit log akan muncul di sini." />
									{:else}
										<ImplementationActivityTimeline {activities} />

										{#if activityTotalPages > 1}
											<Paginator
												page={activityPage}
												totalPages={activityTotalPages}
												totalItems={activityTotalItems}
												onpage={goActivityPage}
											/>
										{/if}
									{/if}
								</div>
							{:else}
								<EmptyState icon="mouse-pointer-click" title="Pilih Project" description="Klik salah satu project di panel kiri untuk melihat detail." />
							{/if}
						</div>
					</div>
				</div>
			{:else if activeTab === 'deals'}
				<!-- ── TAB DEALS ── -->
				<div class="rounded-xl border border-line bg-surface p-5 shadow-sm space-y-4">
					<div class="flex items-center justify-between border-b border-line pb-2">
						<h3 class="text-sm font-semibold text-ink flex items-center gap-1.5">
							<Icon name="layout-kanban" size={16} /> Riwayat Deal Penjualan
						</h3>
						<Badge label={`${companyDealTotalItems} deal`} tone="bg-surface-2 text-muted" />
					</div>

					{#if companyDealsLoading}
						<LoadingState />
					{:else if companyDealsError}
						<EmptyState icon="alert-circle" title="Gagal memuat deal" description={companyDealsError} />
					{:else if companyDeals.length === 0}
						<EmptyState icon="layout-kanban" title="Belum ada deal" description="Transaksi deal yang terdaftar akan ditampilkan di sini." />
					{:else}
						<div class="grid gap-4 sm:grid-cols-2">
							{#each companyDeals as deal (deal.id)}
								<article class="rounded-lg border border-line bg-surface-2 p-4 flex flex-col justify-between">
									<div class="flex items-start justify-between gap-3">
										<div>
											<p class="font-semibold text-ink text-sm">{deal.name}</p>
											<p class="text-[11px] text-muted mt-0.5">PIC: {deal.contact?.name ?? 'Tidak ada PIC'}</p>
										</div>
										<Badge
											label={PIPELINE_PHASE_LABEL[deal.pipeline_status]}
											tone="bg-surface text-ink-soft border border-line font-medium text-[10px]"
										/>
									</div>

									<p class="text-sm font-bold text-brand mt-3">
										{formatCurrency(asNumber(deal.amount))}
									</p>

									<div class="mt-2.5 flex flex-wrap gap-1.5">
										{#if deal.items.length === 0}
											<span class="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-800">
												Belum ada item produk
											</span>
										{:else}
											{#each deal.items as item (item.id)}
												<div class="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-[10px] text-muted border border-line">
													<span class="max-w-40 truncate">{item.product_name}</span>
													{#if subscriptionBadge(item.subscription_status)}
														{@const badge = subscriptionBadge(item.subscription_status)}
														<span class="rounded-full px-1.5 py-0.5 text-[9px] font-medium {badge?.tone}">
															{badge?.label}
														</span>
													{/if}
												</div>
											{/each}
										{/if}
									</div>
								</article>
							{/each}
						</div>

						{#if companyDealTotalPages > 1}
							<div class="pt-4">
								<Paginator
									page={companyDealPage}
									totalPages={companyDealTotalPages}
									totalItems={companyDealTotalItems}
									onpage={goCompanyDealPage}
								/>
							</div>
						{/if}
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>

<!-- Modals -->
{#if showEditCompany && company}
	<CompanyFormModal
		company={company}
		onclose={() => (showEditCompany = false)}
		onsaved={onSaved}
	/>
{/if}

{#if showDeleteCompany && company}
	<ConfirmDialog
		title="Hapus Perusahaan"
		message={`Yakin ingin menghapus "${company.name}"? Semua data kontak, deal, dan project terkait akan ikut terhapus.`}
		confirmLabel="Hapus"
		danger
		loading={deleteBusy}
		onconfirm={confirmDeleteCompany}
		oncancel={() => (showDeleteCompany = false)}
	/>
{/if}

{#if showCreateDeal && company}
	<CreateDealModal
		company={{ id: company.id, name: company.name, status: company.status }}
		onclose={() => (showCreateDeal = false)}
		oncreated={handleCreated}
	/>
{/if}

{#if showContactForm && company}
	<ContactFormModal
		companyId={company.id}
		contact={contactEdit}
		onclose={() => (showContactForm = false)}
		onsaved={onContactSaved}
	/>
{/if}

{#if showContactDelete}
	<ConfirmDialog
		title="Hapus Lead"
		message={`Yakin ingin menghapus lead "${contactDeleteName}"?`}
		confirmLabel="Hapus"
		danger
		loading={contactDeleteBusy}
		onconfirm={confirmContactDelete}
		oncancel={() => (showContactDelete = false)}
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
