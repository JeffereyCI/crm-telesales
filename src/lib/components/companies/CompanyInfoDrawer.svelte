<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		ApiError,
		IMPLEMENTATION_DELIVERY_STATUSES,
		IMPLEMENTATION_DELIVERY_STATUS_BADGE,
		IMPLEMENTATION_DELIVERY_STATUS_LABEL,
		IMPLEMENTATION_STAGES,
		IMPLEMENTATION_STAGE_LABEL,
		dealsApi,
		formatDate,
		formatCurrency,
		implementationProjectsApi,
		LatestRequest,
		orDash,
		toMessage
	} from '$lib';
	import type {
		CompanyDetailResponse,
		DealDetailResponse,
		DealResponse,
		ImplementationActivityResponse,
		ImplementationProjectResponse
	} from '$lib/types/api';
	import { PIPELINE_PHASE_LABEL } from '$lib/constants/enums';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import LoadingState from '$lib/components/ui/LoadingState.svelte';
	import Paginator from '$lib/components/ui/Pagination.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import ImplementationActivityTimeline from './ImplementationActivityTimeline.svelte';
	import CreateDealModal from '$lib/components/pipeline/CreateDealModal.svelte';

	interface Props {
		company: CompanyDetailResponse;
		canWrite: boolean;
		canCreateDeal: boolean;
		onclose: () => void;
		onedit: (company: CompanyDetailResponse) => void;
		ondelete: (company: CompanyDetailResponse) => void;
	}
	let { company, canWrite, canCreateDeal, onclose, onedit, ondelete }: Props = $props();

	const PROJECT_PAGE_SIZE = 5;
	const COMPANY_DEAL_PAGE_SIZE = 5;
	const ACTIVITY_PAGE_SIZE = 6;
	const SUBSCRIPTION_STATUS_LABEL: Record<'active' | 'expiring_soon' | 'expired', string> = {
		active: 'Active',
		expiring_soon: 'Expiring',
		expired: 'Expired'
	};
	const SUBSCRIPTION_STATUS_TONE: Record<'active' | 'expiring_soon' | 'expired', string> = {
		active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
		expiring_soon: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
		expired: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
	};

	let projectFilterStage = $state('');
	let projectFilterStatus = $state('');
	let projectPage = $state(1);
	let projects = $state<ImplementationProjectResponse[]>([]);
	let projectsLoading = $state(true);
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
	let companyDeals = $state<DealResponse[]>([]);
	let companyDealsLoading = $state(true);
	let companyDealsError = $state('');
	let companyDealPage = $state(1);
	let companyDealTotalPages = $state(1);
	let companyDealTotalItems = $state(0);

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
	let showCreateDeal = $state(false);

	const listRequest = new LatestRequest();
	const detailRequest = new LatestRequest();
	const activitiesRequest = new LatestRequest();
	const companyDealsRequest = new LatestRequest();

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

	async function loadProjects(companyId = company.id, page = projectPage) {
		const controller = listRequest.start();
		projectsLoading = true;
		projectsError = '';
		try {
			const result = await implementationProjectsApi.listByCompany(
				companyId,
				{
					page,
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

	async function loadProjectDetail(id: string) {
		const controller = detailRequest.start();
		projectDetailLoading = true;
		projectDetailError = '';
		try {
			const result = await implementationProjectsApi.getDetail(id, controller.signal);
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

	async function loadActivities(id: string, page = activityPage) {
		const controller = activitiesRequest.start();
		activitiesLoading = true;
		activitiesError = '';
		try {
			const result = await implementationProjectsApi.getActivities(
				id,
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

	async function loadCompanyDeals(companyId = company.id, page = companyDealPage) {
		const controller = companyDealsRequest.start();
		companyDealsLoading = true;
		companyDealsError = '';
		try {
			const result = await dealsApi.getCompanyDeals(
				companyId,
				{ page, limit: COMPANY_DEAL_PAGE_SIZE },
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
				loadProjects(company.id, projectPage),
				loadActivities(updated.id, activityPage)
			]);
		} catch (err) {
			if (err instanceof ApiError && err.status === 409) {
				await Promise.all([
					loadProjectDetail(projectDetail.id),
					loadActivities(projectDetail.id, activityPage),
					loadProjects(company.id, projectPage)
				]);
			}
			formError = toMessage(err);
		} finally {
			savingProject = false;
		}
	}

	function goProjectPage(next: number) {
		projectPage = next;
		void loadProjects(company.id, next);
	}

	function goActivityPage(next: number) {
		if (!selectedProjectId) return;
		activityPage = next;
		void loadActivities(selectedProjectId, next);
	}

	function goCompanyDealPage(next: number) {
		companyDealPage = next;
		void loadCompanyDeals(company.id, next);
	}

	async function handleCreated(deal: DealDetailResponse) {
		showCreateDeal = false;
		onclose();
		await goto(`/pipeline?deal=${encodeURIComponent(deal.id)}`);
	}

	$effect(() => {
		const companyId = company.id;
		projectPage = 1;
		companyDealPage = 1;
		activityPage = 1;
		selectedProjectId = '';
		projectFilterStage = '';
		projectFilterStatus = '';
		void Promise.all([loadProjects(companyId, 1), loadCompanyDeals(companyId, 1)]);
		return () => {
			listRequest.abort();
			detailRequest.abort();
			activitiesRequest.abort();
			companyDealsRequest.abort();
		};
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
</script>

<!-- Backdrop -->
<button
	type="button"
	class="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
	onclick={onclose}
	aria-label="Tutup panel"
></button>

<!-- Drawer -->
<aside
	class="fixed inset-y-0 right-0 z-40 flex w-full max-w-[46rem] flex-col border-l border-line bg-surface shadow-2xl"
>
	<div class="flex items-start justify-between border-b border-line p-5">
		<div class="min-w-0 pr-2">
			<h2 class="truncate text-base font-semibold text-ink">{company.name}</h2>
			<p class="mt-1 text-sm text-muted">
				{orDash(company.industry)} · {company.status}
			</p>
		</div>
		<button
			type="button"
			onclick={onclose}
			class="shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
			aria-label="Tutup"
		>
			<Icon name="x" size={18} />
		</button>
	</div>

	<div class="flex-1 overflow-y-auto p-5">
		<div class="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
			<section class="space-y-5">
				<dl class="space-y-3 text-sm">
					<div>
						<dt class="text-xs font-medium tracking-wide text-subtle uppercase">Telepon</dt>
						<dd class="mt-0.5 text-ink-soft">{orDash(company.phone)}</dd>
					</div>
					<div>
						<dt class="text-xs font-medium tracking-wide text-subtle uppercase">Website</dt>
						<dd class="mt-0.5 text-ink-soft">{orDash(company.website)}</dd>
					</div>
					<div>
						<dt class="text-xs font-medium tracking-wide text-subtle uppercase">Alamat</dt>
						<dd class="mt-0.5 text-ink-soft">{orDash(company.address)}</dd>
					</div>
					<div>
						<dt class="text-xs font-medium tracking-wide text-subtle uppercase">Assigned To</dt>
						<dd class="mt-0.5">{company.assigned_to?.name ?? 'Unassigned'}</dd>
					</div>
					{#if company.assigned_at}
						<div>
							<dt class="text-xs font-medium tracking-wide text-subtle uppercase">Assigned On</dt>
							<dd class="mt-0.5 text-ink-soft">{formatDate(company.assigned_at)}</dd>
						</div>
					{/if}
				</dl>

				<div class="rounded-xl border border-line bg-surface-2 p-4">
					<h3 class="mb-3 text-xs font-semibold tracking-wide text-ink-soft uppercase">
						Subscription Summary
					</h3>
					<div class="grid grid-cols-3 gap-3 text-sm">
						<div class="rounded-lg bg-surface px-3 py-2">
							<p class="text-xs text-muted">Active</p>
							<p class="mt-1 font-semibold text-ink">{company.subscription_summary.active}</p>
						</div>
						<div class="rounded-lg bg-surface px-3 py-2">
							<p class="text-xs text-muted">Expiring</p>
							<p class="mt-1 font-semibold text-ink">
								{company.subscription_summary.expiring_soon}
							</p>
						</div>
						<div class="rounded-lg bg-surface px-3 py-2">
							<p class="text-xs text-muted">Expired</p>
							<p class="mt-1 font-semibold text-ink">{company.subscription_summary.expired}</p>
						</div>
					</div>
				</div>

				{#if Object.keys(company.contacts_summary).length > 0}
					<div class="rounded-xl border border-brand/30 bg-surface-2 p-4">
						<h3 class="mb-3 text-xs font-semibold tracking-wide text-ink-soft uppercase">
							Lead Summary
						</h3>
						<p class="mb-2 text-2xl font-semibold text-ink">{company.contact_count}</p>
						<div class="space-y-1.5">
							{#each Object.entries(company.contacts_summary) as [key, count] (key)}
								<div class="flex items-center justify-between text-xs">
									<span class="text-muted">{key}</span>
									<span class="font-semibold text-ink-soft">{count}</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<div class="rounded-xl border border-line bg-surface-2 p-4">
					<div class="mb-3 flex flex-wrap items-center gap-2">
						<h3 class="text-xs font-semibold tracking-wide text-ink-soft uppercase">
							Deal History
						</h3>
						<Badge label={`${companyDealTotalItems} deal`} tone="bg-surface text-muted" />
					</div>
					{#if companyDealsLoading}
						<LoadingState />
					{:else if companyDealsError}
						<EmptyState
							icon="alert-circle"
							title="Gagal memuat deal"
							description={companyDealsError}
						/>
					{:else if companyDeals.length === 0}
						<EmptyState
							icon="layout-kanban"
							title="Belum ada deal"
							description="Histori deal customer akan tampil di sini."
						/>
					{:else}
						<div class="space-y-3">
							{#each companyDeals as deal (deal.id)}
								<article class="rounded-lg border border-line bg-surface p-3">
									<div class="flex items-start justify-between gap-3">
										<div>
											<p class="font-medium text-ink">{deal.name}</p>
											<p class="mt-1 text-xs text-muted">
												PIC: {deal.contact?.name ?? 'Tidak ada PIC'}
											</p>
										</div>
										<Badge
											label={PIPELINE_PHASE_LABEL[deal.pipeline_status]}
											tone="bg-surface-2 text-muted"
										/>
									</div>
									<p class="mt-3 text-sm font-semibold text-ink">
										{formatCurrency(asNumber(deal.amount))}
									</p>
									<div class="mt-2 flex flex-wrap gap-1.5">
										{#if deal.items.length === 0}
											<span class="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
												Belum ada item
											</span>
										{:else}
											{#each deal.items.slice(0, 3) as item (item.id)}
												<div
													class="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted"
												>
													<span class="max-w-40 truncate">{item.product_name}</span>
													{#if subscriptionBadge(item.subscription_status)}
														{@const badge = subscriptionBadge(item.subscription_status)}
														<span
															class="rounded-full px-1.5 py-0.5 text-[10px] font-medium {badge?.tone}"
														>
															{badge?.label}
														</span>
													{/if}
												</div>
											{/each}
											{#if deal.items.length > 3}
												<span class="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">
													+{deal.items.length - 3} item lain
												</span>
											{/if}
										{/if}
									</div>
								</article>
							{/each}
						</div>
						{#if companyDealTotalPages > 1}
							<Paginator
								page={companyDealPage}
								totalPages={companyDealTotalPages}
								totalItems={companyDealTotalItems}
								onpage={goCompanyDealPage}
							/>
						{/if}
					{/if}
				</div>

				<div class="rounded-xl border border-line bg-surface-2 p-4">
					<div class="mb-3 flex flex-wrap items-center gap-2">
						<h3 class="text-xs font-semibold tracking-wide text-ink-soft uppercase">
							Implementation Projects
						</h3>
						<Badge label={`${projectTotalItems} project`} tone="bg-surface text-muted" />
					</div>
					<div class="grid gap-3 sm:grid-cols-2">
						<Select
							label="Filter Stage"
							bind:value={projectFilterStage}
							options={filterStageOptions}
							onchange={() => {
								projectPage = 1;
								void loadProjects(company.id, 1);
							}}
						/>
						<Select
							label="Filter Status"
							bind:value={projectFilterStatus}
							options={filterStatusOptions}
							onchange={() => {
								projectPage = 1;
								void loadProjects(company.id, 1);
							}}
						/>
					</div>
					<div class="mt-4">
						{#if projectsLoading}
							<LoadingState />
						{:else if projectsError}
							<EmptyState
								icon="alert-circle"
								title="Gagal memuat project"
								description={projectsError}
							/>
						{:else if projects.length === 0}
							<EmptyState
								icon="layout-kanban"
								title="Belum ada implementation project"
								description="Project otomatis dibuat saat Deal Win memiliki item implementation."
							/>
						{:else}
							<div class="space-y-2">
								{#each projects as project (project.id)}
									<button
										type="button"
										class="block w-full rounded-lg border p-3 text-left transition-colors {selectedProjectId ===
										project.id
											? 'border-brand/40 bg-brand-soft/30'
											: 'border-line bg-surface hover:bg-surface-2'}"
										onclick={() => (selectedProjectId = project.id)}
									>
										<div class="flex items-start justify-between gap-3">
											<div>
												<p class="font-medium text-ink">{project.name}</p>
												<p class="mt-1 text-xs text-muted">{project.deal.name}</p>
											</div>
											<Badge
												label={IMPLEMENTATION_DELIVERY_STATUS_LABEL[
													project.delivery_status as keyof typeof IMPLEMENTATION_DELIVERY_STATUS_LABEL
												] ?? project.delivery_status}
												tone={IMPLEMENTATION_DELIVERY_STATUS_BADGE[
													project.delivery_status as keyof typeof IMPLEMENTATION_DELIVERY_STATUS_BADGE
												] ?? 'bg-surface-3 text-muted'}
											/>
										</div>
										<p class="mt-2 text-xs text-muted">
											{IMPLEMENTATION_STAGE_LABEL[
												project.stage as keyof typeof IMPLEMENTATION_STAGE_LABEL
											] ?? project.stage}
										</p>
									</button>
								{/each}
							</div>
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
			</section>

			<section class="space-y-4">
				{#if projectDetailLoading}
					<LoadingState />
				{:else if projectDetailError}
					<EmptyState
						icon="alert-circle"
						title="Gagal memuat detail project"
						description={projectDetailError}
					/>
				{:else if projectDetail}
					<div class="rounded-xl border border-line bg-surface p-4">
						<div class="mb-4 flex items-start justify-between gap-3">
							<div>
								<h3 class="font-semibold text-ink">{projectDetail.name}</h3>
								<p class="mt-1 text-xs text-muted">{projectDetail.deal.name}</p>
							</div>
							<Badge
								label={IMPLEMENTATION_DELIVERY_STATUS_LABEL[
									projectDetail.delivery_status as keyof typeof IMPLEMENTATION_DELIVERY_STATUS_LABEL
								] ?? projectDetail.delivery_status}
								tone={IMPLEMENTATION_DELIVERY_STATUS_BADGE[
									projectDetail.delivery_status as keyof typeof IMPLEMENTATION_DELIVERY_STATUS_BADGE
								] ?? 'bg-surface-3 text-muted'}
							/>
						</div>

						<form class="space-y-3" onsubmit={saveProject}>
							<div class="grid gap-3 sm:grid-cols-2">
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
								label="Notes"
								rows={3}
								bind:value={projectNotes}
								disabled={projectReadOnly || savingProject}
							/>
							<TextField
								label="Alasan Perubahan"
								bind:value={changeReason}
								disabled={projectReadOnly || savingProject}
								hint="Wajib saat koreksi stage mundur."
							/>
							{#if formError}
								<p class="text-xs text-brand">{formError}</p>
							{/if}
							{#if projectReadOnly}
								<p class="text-xs text-muted">
									{canWrite
										? 'Project terminal bersifat read-only.'
										: 'Telesales hanya dapat membaca implementation project.'}
								</p>
							{:else}
								<div class="flex justify-end">
									<Button type="submit" size="sm" loading={savingProject}>Simpan Progress</Button>
								</div>
							{/if}
						</form>
					</div>

					<div class="rounded-xl border border-line bg-surface p-4">
						<div class="mb-3 flex items-center justify-between gap-3">
							<h3 class="font-semibold text-ink">Audit Timeline</h3>
							<Badge label={`${activityTotalItems} aktivitas`} tone="bg-surface-2 text-muted" />
						</div>
						{#if activitiesLoading}
							<LoadingState />
						{:else if activitiesError}
							<EmptyState
								icon="alert-circle"
								title="Gagal memuat timeline"
								description={activitiesError}
							/>
						{:else if activities.length === 0}
							<EmptyState
								icon="history"
								title="Belum ada aktivitas"
								description="Perubahan implementation akan muncul di sini."
							/>
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
					<EmptyState
						icon="layout-kanban"
						title="Pilih project"
						description="Detail implementation project akan tampil di sini."
					/>
				{/if}
			</section>
		</div>
	</div>

	{#if canWrite || canCreateDeal}
		<div class="flex items-center gap-2 border-t border-line p-4">
			{#if canCreateDeal && company.status !== 'leads'}
				<Button type="button" onclick={() => (showCreateDeal = true)}>
					<Icon name="plus" size={15} /> Buat Deal Baru
				</Button>
			{/if}
			{#if canWrite}
				<button
					type="button"
					onclick={() => onedit(company)}
					class="flex flex-1 items-center justify-center gap-2 rounded-lg border border-line-strong bg-surface px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-3"
				>
					<Icon name="pencil" size={15} /> Edit Account
				</button>
				<button
					type="button"
					onclick={() => ondelete(company)}
					class="rounded-lg border border-red-200 p-2 text-red-600 transition-colors hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40"
					title="Hapus account"
					aria-label="Hapus account"
				>
					<Icon name="trash-2" size={16} />
				</button>
			{/if}
		</div>
	{/if}
</aside>

{#if showCreateDeal}
	<CreateDealModal
		company={{ id: company.id, name: company.name, status: company.status }}
		onclose={() => (showCreateDeal = false)}
		oncreated={handleCreated}
	/>
{/if}
