<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import {
		auth,
		can,
		companiesApi,
		contactsApi,
		LatestRequest,
		formatCurrency,
		formatDate,
		formatDateTime,
		orDash,
		PIPELINE_PHASE_LABEL,
		toMessage,
		ApiError,
		ACTION_STATUS_LABEL,
		ACTION_STATUS_BADGE,
		RESPONSE_STATUS_LABEL,
		RESPONSE_STATUS_BADGE
	} from '$lib';
	import { toast } from '$lib/stores/toast.svelte';
	import { decodeHtml } from '$lib/utils/sanitize';
	import type {
		ContactActivityResponse,
		CompanyDetailResponse,
		ContactDetailResponse,
		DealDetailResponse,
		ContactMeetingResponse
	} from '$lib/types/api';
	import type { PipelinePhase } from '$lib/constants/enums';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import LoadingState from '$lib/components/ui/LoadingState.svelte';
	import Paginator from '$lib/components/ui/Pagination.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import ActivityTimeline from '$lib/components/contacts/ActivityTimeline.svelte';
	import MeetingModal from '$lib/components/contacts/MeetingModal.svelte';
	import CreateDealModal from '$lib/components/pipeline/CreateDealModal.svelte';
	import WhatsAppBadge from '$lib/components/contacts/WhatsAppBadge.svelte';
	import QuickChatModal from '$lib/components/contacts/QuickChatModal.svelte';
	import HelpTooltip from '$lib/components/ui/HelpTooltip.svelte';

	const MEETING_PAGE_SIZE = 8;
	const contactId = $derived(page.params.id ?? '');
	let detail = $state<ContactDetailResponse | null>(null);
	let meetings = $state<ContactMeetingResponse[]>([]);
	let activities = $state<ContactActivityResponse[]>([]);
	let meetingPage = $state(1);
	let meetingTotalPages = $state(1);
	let meetingTotal = $state(0);
	let loading = $state(true);
	let meetingsLoading = $state(false);
	let activitiesLoading = $state(false);
	let errorMsg = $state('');
	let note = $state('');
	let noteError = $state('');
	let savingNote = $state(false);
	let showMeetingModal = $state(false);
	let showCreateDealModal = $state(false);
	let showQuickChatModal = $state(false);
	let activeTab = $state<'summary' | 'activity' | 'notes' | 'meetings'>('summary');
	let recheckLoading = $state(false);
	const detailRequest = new LatestRequest();
	const meetingsRequest = new LatestRequest();
	const activitiesRequest = new LatestRequest();
	const companyRequest = new LatestRequest();
	let companyContext = $state<CompanyDetailResponse | null>(null);
	let companyLoading = $state(false);

	function asNumber(value: string | number | null | undefined) {
		return Number(value ?? 0);
	}

	const canSchedule = $derived(can(auth.role, 'scheduleMeeting'));
	const canCreateDeal = $derived(can(auth.role, 'editDeal'));
	const canUseQuickChat = $derived(can(auth.role, 'useQuickChat'));
	const activeDeal = $derived.by(() => {
		const current = detail;
		if (!current) return null;
		return current.active_deals.find((deal) => deal.contact?.id === current.id) ?? null;
	});
	const companyStatus = $derived(companyContext?.status ?? null);
	const pipelineStatus = $derived((activeDeal?.pipeline_status ?? 'demo') as PipelinePhase);
	const isFollowUp = $derived(!!activeDeal);
	const hasMeetingPrerequisite = $derived(
		detail ? contactsApi.canScheduleMeeting(detail.response_status) : false
	);
	const telesalesFollowUpAllowed = $derived(
		auth.role !== 'telesales' || !isFollowUp || pipelineStatus === 'demo'
	);
	const customerNeedsManualDeal = $derived(companyStatus === 'customer' && !isFollowUp);
	const showMeetingButton = $derived(canSchedule);
	const canOpenMeetingModal = $derived(
		showMeetingButton &&
			hasMeetingPrerequisite &&
			telesalesFollowUpAllowed &&
			!customerNeedsManualDeal &&
			!companyLoading
	);

	const meetingButtonTitle = $derived.by(() => {
		if (!hasMeetingPrerequisite) {
			return 'Status respon harus Tertarik sebelum meeting dapat dijadwalkan.';
		}
		if (!telesalesFollowUpAllowed) {
			return 'Telesales hanya dapat menjadwalkan meeting lanjutan saat deal masih di tahap Demo.';
		}
		if (companyLoading) {
			return 'Memuat status company terlebih dahulu.';
		}
		if (customerNeedsManualDeal) {
			return auth.role === 'bdm'
				? 'Customer tanpa deal aktif harus dibuatkan deal manual terlebih dahulu.'
				: 'Telesales tidak dapat memulai opportunity baru untuk customer tanpa deal aktif.';
		}
		return undefined;
	});

	async function loadCompanyContext(companyId: string) {
		const controller = companyRequest.start();
		companyLoading = true;
		try {
			const result = await companiesApi.getCompany(companyId, controller.signal);
			if (!companyRequest.isCurrent(controller)) return;
			companyContext = result;
		} catch {
			if (!companyRequest.isCurrent(controller)) return;
			companyContext = null;
		} finally {
			if (companyRequest.finish(controller)) companyLoading = false;
		}
	}

	async function loadDetail() {
		const controller = detailRequest.start();
		loading = true;
		errorMsg = '';
		try {
			const result = await contactsApi.getContactDetail(contactId, controller.signal);
			if (!detailRequest.isCurrent(controller)) return;
			detail = result;
			void loadCompanyContext(result.company.id);
			await Promise.all([loadMeetings(), loadActivities()]);
		} catch (err) {
			if (!detailRequest.isCurrent(controller)) return;
			errorMsg = toMessage(err);
			detail = null;
			companyContext = null;
		} finally {
			if (detailRequest.finish(controller)) loading = false;
		}
	}

	async function loadMeetings() {
		const controller = meetingsRequest.start();
		meetingsLoading = true;
		try {
			const res = await contactsApi.getContactMeetings(
				contactId,
				{
					page: meetingPage,
					limit: MEETING_PAGE_SIZE
				},
				controller.signal
			);
			if (!meetingsRequest.isCurrent(controller)) return;
			meetings = res.data;
			meetingTotalPages = res.pagination.total_pages;
			meetingTotal = res.pagination.total_items;
		} catch (err) {
			if (!meetingsRequest.isCurrent(controller)) return;
			toast.error(toMessage(err));
			meetings = [];
		} finally {
			if (meetingsRequest.finish(controller)) meetingsLoading = false;
		}
	}

	async function loadActivities() {
		const controller = activitiesRequest.start();
		activitiesLoading = true;
		try {
			const res = await contactsApi.getContactActivities(contactId, controller.signal);
			if (!activitiesRequest.isCurrent(controller)) return;
			activities = res.data;
		} catch (err) {
			if (!activitiesRequest.isCurrent(controller)) return;
			toast.error(toMessage(err));
			activities = [];
		} finally {
			if (activitiesRequest.finish(controller)) activitiesLoading = false;
		}
	}

	async function addNote(e: SubmitEvent) {
		e.preventDefault();
		noteError = '';
		const value = note.trim();
		if (!value) {
			noteError = 'Catatan wajib diisi.';
			return;
		}
		if (value.length > 5000) {
			noteError = 'Catatan maksimal 5000 karakter.';
			return;
		}
		savingNote = true;
		try {
			await contactsApi.addContactNote(contactId, value);
			note = '';
			toast.success('Catatan kontak berhasil ditambahkan.');
			await Promise.all([loadActivities(), loadDetailSummary()]);
			activeTab = 'notes';
		} catch (err) {
			toast.error(toMessage(err));
		} finally {
			savingNote = false;
		}
	}

	async function loadDetailSummary() {
		try {
			const summary = await contactsApi.getContactDetail(contactId);
			detail = summary;
			void loadCompanyContext(summary.company.id);
		} catch {
			// Silent error
		}
	}

	async function meetingSaved() {
		showMeetingModal = false;
		await Promise.all([loadDetailSummary(), loadMeetings(), loadActivities()]);
	}

	function goMeetingPage(next: number) {
		meetingPage = next;
		void loadMeetings();
	}



	async function handleCreated(deal: DealDetailResponse) {
		showCreateDealModal = false;
		await goto(`/pipeline?deal=${encodeURIComponent(deal.id)}`);
	}

	async function handleRecheck() {
		if (!detail) return;
		recheckLoading = true;
		try {
			const updated = await contactsApi.verifyWhatsApp(detail.id);
			detail = {
				...detail,
				whatsapp_status: updated.whatsapp_status,
				whatsapp_verified_at: updated.whatsapp_verified_at
			};
		} catch (err) {
			if (err instanceof ApiError) {
				if (err.status === 504) toast.error('Recheck timeout. Coba lagi nanti.');
				else if (err.status === 503) toast.error('Server WhatsApp tidak tersedia.');
				else if (err.status === 502) toast.error('Respons provider tidak valid.');
				else toast.error(toMessage(err));
			} else {
				toast.error(toMessage(err));
			}
		} finally {
			recheckLoading = false;
		}
	}

	onMount(() => {
		void loadDetail();
		const onVisible = () => {
			if (document.visibilityState === 'visible') {
				void loadDetail();
			}
		};
		document.addEventListener('visibilitychange', onVisible);
		return () => {
			detailRequest.abort();
			meetingsRequest.abort();
			activitiesRequest.abort();
			companyRequest.abort();
			document.removeEventListener('visibilitychange', onVisible);
		};
	});
</script>

<svelte:head>
	<title>{detail?.name ?? 'Detail Kontak'} · CRM Telesales</title>
</svelte:head>

<div class="space-y-6">
	<!-- Breadcrumbs -->
	<div class="pt-6">
		<a href="/contacts" class="text-xs text-muted hover:underline inline-flex items-center gap-1">
			<Icon name="arrow-left" size={12} /> Kembali ke Kontak
		</a>
	</div>

	{#if loading}
		<LoadingState />
	{:else if errorMsg || !detail}
		<EmptyState icon="alert-circle" title="Gagal memuat detail Kontak" description={errorMsg}>
			{#snippet action()}
				<Button variant="secondary" onclick={loadDetail}>Coba lagi</Button>
			{/snippet}
		</EmptyState>
	{:else}
		<!-- Page Header (Clean & Uncluttered) -->
		<PageHeader
			title={detail.name}
			description={`${detail.job_title ?? 'Kontak'} · ${detail.company.name}`}
		>
			{#snippet actions()}
				<div class="flex items-center gap-2">
					<span class="inline-flex items-center gap-1 rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-semibold text-muted">
						<span class="h-1.5 w-1.5 rounded-full {loading ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}"></span>
						{loading ? 'Memuat...' : 'Sinkron'}
					</span>
					<Button variant="secondary" onclick={loadDetail} disabled={loading}>
						<Icon name="refresh-cw" size={14} />
					</Button>
				</div>
			{/snippet}
		</PageHeader>

		<!-- Action Bar / Control Bar -->
		<div class="flex flex-wrap items-center gap-2.5 rounded-xl border border-line bg-surface-2 p-4 shadow-sm">
			{#if canUseQuickChat && detail}
				{@const ineligible = contactsApi.whatsAppIneligibleReason({ phone: detail.phone, whatsapp_status: detail.whatsapp_status })}
				<div class="relative">
					<Button
						variant="secondary"
						onclick={() => (showQuickChatModal = true)}
						disabled={ineligible !== null}
					>
						<Icon name="message-square" size={16} /> Quick Chat
					</Button>
					{#if ineligible}
						<div class="absolute -top-1.5 -right-1.5">
							<HelpTooltip text={ineligible} position="top" />
						</div>
					{/if}
				</div>
			{/if}

			{#if canCreateDeal && detail && companyStatus && companyStatus !== 'leads'}
				{#if activeDeal}
					<Button
						variant="secondary"
						onclick={() => goto(`/pipeline?deal=${encodeURIComponent(activeDeal.id)}`)}
					>
						<Icon name="arrow-up-right" size={16} /> Buka Deal Aktif
					</Button>
				{:else}
					<Button onclick={() => (showCreateDealModal = true)}>
						<Icon name="plus" size={16} /> Buat Deal Baru
					</Button>
				{/if}
			{/if}

			{#if showMeetingButton}
				<div class="relative">
					<Button
						onclick={() => (showMeetingModal = true)}
						disabled={!canOpenMeetingModal}
					>
						<Icon name="calendar-plus" size={16} /> {isFollowUp ? 'Jadwalkan Rapat Lanjutan' : 'Jadwalkan Rapat'}
					</Button>
					{#if meetingButtonTitle}
						<div class="absolute -top-1.5 -right-1.5">
							<HelpTooltip text={meetingButtonTitle} position="top" />
						</div>
					{/if}
				</div>
				{#if customerNeedsManualDeal && canCreateDeal && auth.role === 'bdm'}
					<Button variant="secondary" onclick={() => (showCreateDealModal = true)}>
						<Icon name="plus" size={16} /> Buat Deal Manual
					</Button>
				{/if}
			{/if}

			<Button variant="secondary" onclick={loadDetail}>
				<Icon name="refresh-cw" size={16} /> Refresh Data
			</Button>
		</div>

		<!-- Tabs navigation -->
		<div class="border-b border-line">
			<nav class="-mb-px flex gap-6 text-sm font-medium">
				<button
					type="button"
					onclick={() => (activeTab = 'summary')}
					class="border-b-2 px-1 pb-4 transition-colors {activeTab === 'summary' ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink'}"
				>
					Ringkasan
				</button>
				<button
					type="button"
					onclick={() => (activeTab = 'activity')}
					class="border-b-2 px-1 pb-4 transition-colors {activeTab === 'activity' ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink'}"
				>
					Aktivitas ({activities.length})
				</button>
				<button
					type="button"
					onclick={() => (activeTab = 'notes')}
					class="border-b-2 px-1 pb-4 transition-colors {activeTab === 'notes' ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink'}"
				>
					Catatan ({detail.notes_count})
				</button>
				<button
					type="button"
					onclick={() => (activeTab = 'meetings')}
					class="border-b-2 px-1 pb-4 transition-colors {activeTab === 'meetings' ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink'}"
				>
					Rapat ({detail.meeting_summary.total_meetings})
				</button>
			</nav>
		</div>

		<!-- Tab Content Area -->
		<div class="mt-4">
			{#if activeTab === 'summary'}
				<!-- ── TAB RINGKASAN ── -->
				<div class="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
					<div class="space-y-5">
						<!-- Profil Info Card -->
						<section class="rounded-xl border border-line bg-surface p-5 shadow-sm space-y-4">
							<h3 class="text-sm font-bold text-ink border-b border-line pb-2">Profil Kontak</h3>
							<dl class="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
								<div>
									<dt class="text-subtle font-medium uppercase tracking-wider">Nama</dt>
									<dd class="mt-1 text-sm font-semibold text-ink">{detail.name}</dd>
								</div>
								<div>
									<dt class="text-subtle font-medium uppercase tracking-wider">Jabatan</dt>
									<dd class="mt-1 text-sm text-ink-soft">{orDash(detail.job_title)}</dd>
								</div>
								<div>
									<dt class="text-subtle font-medium uppercase tracking-wider">Telepon</dt>
									<dd class="mt-1 flex flex-wrap items-center gap-2">
										<span class="text-sm font-mono text-ink-soft">{orDash(detail.phone)}</span>
										<WhatsAppBadge status={detail.whatsapp_status} showNull />
									</dd>
									{#if detail.phone && (detail.whatsapp_status === 'inactive' || detail.whatsapp_status === 'unverified')}
										<button
											type="button"
											onclick={handleRecheck}
											disabled={recheckLoading}
											class="mt-1.5 flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-ink hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
										>
											{recheckLoading ? 'Memeriksa...' : '↻ Cek Ulang WA'}
										</button>
									{/if}
								</div>
								<div>
									<dt class="text-subtle font-medium uppercase tracking-wider">Email</dt>
									<dd class="mt-1 text-sm text-ink-soft">{orDash(detail.email)}</dd>
								</div>
								<div>
									<dt class="text-subtle font-medium uppercase tracking-wider">Perusahaan</dt>
									<dd class="mt-1 text-sm font-semibold text-brand">{detail.company.name}</dd>
								</div>
								<div>
									<dt class="text-subtle font-medium uppercase tracking-wider">Terakhir Diperbarui</dt>
									<dd class="mt-1 text-sm text-ink-soft">{formatDateTime(detail.updated_at)}</dd>
								</div>
							</dl>
						</section>

						<!-- Status Card -->
						<section class="rounded-xl border border-line bg-surface p-5 shadow-sm space-y-3">
							<h3 class="text-sm font-bold text-ink border-b border-line pb-2">Status Saat Ini</h3>
							<div class="grid grid-cols-2 gap-3 text-xs">
								<div class="rounded-lg bg-surface-2 p-3 space-y-1.5">
									<span class="text-muted block text-[10px] uppercase font-semibold">Status Aksi</span>
									<Badge
										label={ACTION_STATUS_LABEL[detail.action_status]}
										tone={ACTION_STATUS_BADGE[detail.action_status]}
									/>
								</div>
								<div class="rounded-lg bg-surface-2 p-3 space-y-1.5">
									<span class="text-muted block text-[10px] uppercase font-semibold">Status Respon</span>
									{#if detail.response_status}
										<Badge
											label={RESPONSE_STATUS_LABEL[detail.response_status]}
											tone={RESPONSE_STATUS_BADGE[detail.response_status]}
										/>
									{:else}
										<span class="text-subtle font-semibold block">—</span>
									{/if}
								</div>
							</div>
						</section>
					</div>

					<!-- Right Side: Active Deals -->
					<section class="rounded-xl border border-line bg-surface p-5 shadow-sm space-y-4">
						<div class="flex items-center justify-between border-b border-line pb-2">
							<h3 class="text-sm font-bold text-ink">Active Deals</h3>
							<span class="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-muted font-medium">
								{detail.active_deals.length} deal aktif
							</span>
						</div>
						{#if detail.active_deals.length === 0}
							<EmptyState icon="layout-kanban" title="Tidak ada deal aktif" description="Transaksi deal yang terhubung dengan kontak ini akan muncul di sini." />
						{:else}
							<div class="grid gap-4 sm:grid-cols-2">
								{#each detail.active_deals as deal (deal.id)}
									<a
										href={`/pipeline?deal=${encodeURIComponent(deal.id)}`}
										class="block rounded-xl border border-line bg-surface-2 p-4 hover:border-brand/40 hover:bg-surface-3 transition-all"
									>
										<div class="flex items-start justify-between gap-3">
											<div>
												<p class="font-semibold text-ink text-sm">{deal.name}</p>
												<p class="text-[10px] text-muted mt-0.5">PIC: {deal.contact?.name ?? 'Belum ditentukan'}</p>
											</div>
											<Badge
												label={PIPELINE_PHASE_LABEL[deal.pipeline_status]}
												tone="bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
											/>
										</div>
										<p class="text-sm font-bold text-brand mt-4">
											{formatCurrency(asNumber(deal.amount))}
										</p>
									</a>
								{/each}
							</div>
						{/if}
					</section>
				</div>
			{:else if activeTab === 'activity'}
				<!-- ── TAB AKTIVITAS (TIMELINE) ── -->
				<section class="rounded-xl border border-line bg-surface p-5 shadow-sm space-y-4">
					<h3 class="text-sm font-bold text-ink border-b border-line pb-2">Timeline Aktivitas Kontak</h3>
					{#if activitiesLoading}
						<LoadingState />
					{:else if activities.length === 0}
						<EmptyState icon="history" title="Belum ada aktivitas" description="Riwayat perubahan log audit akan muncul di sini." />
					{:else}
						<ActivityTimeline {activities} />
					{/if}
				</section>
			{:else if activeTab === 'notes'}
				<!-- ── TAB CATATAN ── -->
				<div class="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
					<!-- Form Add Note -->
					<form class="rounded-xl border border-line bg-surface p-5 shadow-sm space-y-4" onsubmit={addNote}>
						<h3 class="text-sm font-bold text-ink border-b border-line pb-2">Tambah Catatan Baru</h3>
						<Textarea
							label="Catatan Internal"
							bind:value={note}
							error={noteError}
							maxlength={5000}
							rows={4}
							placeholder="Tambahkan konteks interaksi, catatan meeting, atau kebutuhan personal klien..."
							required
						/>
						<div class="flex justify-end pt-2">
							<Button type="submit" size="sm" loading={savingNote} disabled={!note.trim()}>
								Simpan Catatan
							</Button>
						</div>
					</form>

					<!-- List of notes (filtered from activities timeline) -->
					<section class="rounded-xl border border-line bg-surface p-5 shadow-sm space-y-4">
						<h3 class="text-sm font-bold text-ink border-b border-line pb-2">Riwayat Catatan</h3>
						{#if activitiesLoading}
							<LoadingState />
						{:else}
							{@const notes = activities.filter(a => a.activity_type === 'note' || a.notes)}
							{#if notes.length === 0}
								<EmptyState icon="sticky-note" title="Belum ada catatan" description="Tulis catatan pertama untuk prospek ini pada form di samping." />
							{:else}
								<div class="space-y-4">
									{#each notes as noteItem (noteItem.id)}
										<article class="rounded-lg border border-line bg-surface-2 p-4">
											<div class="flex items-center justify-between text-xs text-muted">
												<span class="font-semibold text-ink-soft">{noteItem.user_name}</span>
												<span>{formatDateTime(noteItem.created_at)}</span>
											</div>
											<p class="mt-2 text-xs text-ink leading-relaxed whitespace-pre-wrap">
												{decodeHtml(noteItem.notes ?? '')}
											</p>
										</article>
									{/each}
								</div>
							{/if}
						{/if}
					</section>
				</div>
			{:else if activeTab === 'meetings'}
				<!-- ── TAB MEETING ── -->
				<section class="rounded-xl border border-line bg-surface p-5 shadow-sm space-y-4">
					<div class="flex items-center justify-between border-b border-line pb-2">
						<h3 class="text-sm font-bold text-ink flex items-center gap-1.5">
							<Icon name="calendar" size={16} /> Riwayat Pertemuan (Meetings)
						</h3>
					</div>

					<div class="grid gap-3 sm:grid-cols-3">
						<div class="rounded-lg bg-surface-2 p-3 text-center border border-line/40">
							<p class="text-[10px] text-muted uppercase font-bold">Total Meeting</p>
							<p class="mt-1 text-lg font-bold text-ink">
								{detail.meeting_summary.total_meetings}
							</p>
						</div>
						<div class="rounded-lg bg-surface-2 p-3 text-center border border-line/40">
							<p class="text-[10px] text-muted uppercase font-bold">Meeting Terakhir</p>
							<p class="mt-1 text-xs font-semibold text-ink">
								{formatDateTime(detail.meeting_summary.last_meeting_at)}
							</p>
						</div>
						<div class="rounded-lg bg-surface-2 p-3 text-center border border-line/40">
							<p class="text-[10px] text-muted uppercase font-bold">Meeting Berikutnya</p>
							<p class="mt-1 text-xs font-semibold text-ink">
								{formatDateTime(detail.meeting_summary.next_meeting_at)}
							</p>
						</div>
					</div>

					{#if meetingsLoading}
						<LoadingState />
					{:else if meetings.length === 0}
						<EmptyState icon="calendar" title="Belum ada rapat dijadwalkan" description="Jadwalkan rapat presentasi atau follow up dari Action Bar di atas." />
					{:else}
						<div class="grid gap-4 sm:grid-cols-2">
							{#each meetings as meeting (meeting.id)}
								<article class="rounded-xl border border-line bg-surface-2 p-4 flex flex-col justify-between">
									<div class="flex items-start justify-between gap-3">
										<div>
											<p class="font-semibold text-ink text-sm">{decodeHtml(meeting.agenda)}</p>
											<p class="text-[10px] text-muted mt-0.5">
												Penyelenggara: {meeting.scheduled_by_name}
											</p>
										</div>
										<Badge
											label={meeting.status === 'upcoming' ? 'Mendatang' : 'Selesai'}
											tone={meeting.status === 'upcoming'
												? 'bg-emerald-100 text-emerald-700'
												: 'bg-surface text-muted border border-line'}
										/>
									</div>
									<div class="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted border-t border-line/60 pt-2.5">
										<span class="flex items-center gap-1">
											<Icon name="calendar" size={13} /> {formatDate(meeting.meeting_date)}
										</span>
										<span class="flex items-center gap-1">
											<Icon name="clock" size={13} /> {meeting.meeting_time} WIB
										</span>
										<span class="flex items-center gap-1">
											<Icon name="map-pin" size={13} /> {meeting.location ?? '-'}
										</span>
									</div>
								</article>
							{/each}
						</div>

						{#if meetingTotalPages > 1}
							<div class="pt-4">
								<Paginator
									page={meetingPage}
									totalPages={meetingTotalPages}
									totalItems={meetingTotal}
									onpage={goMeetingPage}
								/>
							</div>
						{/if}
					{/if}
				</section>
			{/if}
		</div>
	{/if}
</div>

<!-- Modals -->
{#if detail && showMeetingModal}
	<MeetingModal
		contact={detail}
		{pipelineStatus}
		{isFollowUp}
		onclose={() => (showMeetingModal = false)}
		onsaved={meetingSaved}
	/>
{/if}

{#if detail && companyStatus && showCreateDealModal}
	<CreateDealModal
		company={{ id: detail.company.id, name: detail.company.name, status: companyStatus }}
		initialContactId={detail.id}
		lockContact
		onclose={() => (showCreateDealModal = false)}
		oncreated={handleCreated}
	/>
{/if}

{#if detail && companyStatus && showQuickChatModal}
	<QuickChatModal contact={detail} {companyStatus} onclose={() => (showQuickChatModal = false)} />
{/if}
