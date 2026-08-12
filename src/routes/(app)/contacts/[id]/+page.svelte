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
		WHATSAPP_INELIGIBLE_TOOLTIP
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

	const MEETING_PAGE_SIZE = 8;
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
	let activeTab = $state<'meetings' | 'activity'>('meetings');
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
			activeTab = 'activity';
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
			// Timeline sudah tersimpan; summary dapat dimuat lagi lewat tombol refresh.
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

	function subscriptionBadge(status: 'active' | 'expiring_soon' | 'expired' | null) {
		if (!status) return null;
		return {
			label: SUBSCRIPTION_STATUS_LABEL[status],
			tone: SUBSCRIPTION_STATUS_TONE[status]
		};
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
			// Patch hanya field WA tanpa reload penuh
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
		return () => {
			detailRequest.abort();
			meetingsRequest.abort();
			activitiesRequest.abort();
			companyRequest.abort();
		};
	});
</script>

<svelte:head>
	<title>{detail?.name ?? 'Detail Contact'} · CRM Telesales</title>
</svelte:head>

{#if loading}
	<LoadingState />
{:else if errorMsg || !detail}
	<EmptyState icon="alert-circle" title="Gagal memuat detail Contact" description={errorMsg}>
		{#snippet action()}
			<Button variant="secondary" onclick={loadDetail}>Coba lagi</Button>
		{/snippet}
	</EmptyState>
{:else}
	<PageHeader
		title={detail.name}
		description={`${detail.job_title ?? 'Contact'} · ${detail.company.name}`}
	>
		{#snippet actions()}
			<a
				href="/contacts"
				class="inline-flex h-10 items-center gap-2 rounded-lg border border-line-strong bg-surface px-4 text-sm font-medium text-ink-soft hover:bg-surface-2"
			>
				<Icon name="arrow-left" size={16} /> Kembali
			</a>
			{#if canUseQuickChat && detail}
				<Button
					variant="secondary"
					onclick={() => (showQuickChatModal = true)}
					disabled={detail.whatsapp_status !== 'active'}
					title={detail.whatsapp_status !== 'active'
						? WHATSAPP_INELIGIBLE_TOOLTIP[detail.whatsapp_status || 'no_phone']
						: undefined}
				>
					<Icon name="message-square" size={16} /> Quick Chat
				</Button>
			{/if}
			{#if canCreateDeal && detail && companyStatus && companyStatus !== 'leads'}
				{#if activeDeal}
					<Button
						variant="secondary"
						onclick={() => goto(`/pipeline?deal=${encodeURIComponent(activeDeal.id)}`)}
					>
						<Icon name="arrow-up-right" size={16} />
						Buka Deal Aktif
					</Button>
				{:else}
					<Button onclick={() => (showCreateDealModal = true)}>
						<Icon name="plus" size={16} />
						Buat Deal Baru
					</Button>
				{/if}
			{/if}
			{#if showMeetingButton}
				<Button
					onclick={() => (showMeetingModal = true)}
					disabled={!canOpenMeetingModal}
					title={meetingButtonTitle}
				>
					<Icon name="calendar-plus" size={16} />
					{isFollowUp ? 'Jadwalkan Meeting Lanjutan' : 'Jadwalkan Meeting'}
				</Button>
				{#if customerNeedsManualDeal && canCreateDeal && auth.role === 'bdm'}
					<Button variant="secondary" onclick={() => (showCreateDealModal = true)}>
						<Icon name="plus" size={16} />
						Buat Deal Manual
					</Button>
				{/if}
			{/if}
		{/snippet}
	</PageHeader>

	<div class="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
		<div class="space-y-5">
			<section class="rounded-xl border border-line bg-surface p-5">
				<h2 class="mb-4 font-semibold text-ink">Profil Contact</h2>
				<dl class="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
					<div>
						<dt class="text-xs text-muted">Nama</dt>
						<dd class="mt-1 font-medium text-ink">{detail.name}</dd>
					</div>
					<div>
						<dt class="text-xs text-muted">Jabatan</dt>
						<dd class="mt-1 text-ink">{orDash(detail.job_title)}</dd>
					</div>
					<div>
						<dt class="text-xs text-muted">Telepon</dt>
						<dd class="mt-1 flex flex-wrap items-center gap-2">
							<span class="text-ink">{orDash(detail.phone)}</span>
							<WhatsAppBadge status={detail.whatsapp_status} showNull />
						</dd>
						{#if detail.phone && (detail.whatsapp_status === 'inactive' || detail.whatsapp_status === 'unverified')}
							<button
								type="button"
								onclick={handleRecheck}
								disabled={recheckLoading}
								class="mt-1 flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-2.5 py-1 text-xs font-medium text-ink-soft transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
							>
								{recheckLoading ? 'Memeriksa...' : '↻ Cek Ulang WA'}
							</button>
						{/if}
					</div>
					<div>
						<dt class="text-xs text-muted">Email</dt>
						<dd class="mt-1 text-ink">{orDash(detail.email)}</dd>
					</div>
					<div>
						<dt class="text-xs text-muted">Company</dt>
						<dd class="mt-1 font-medium text-ink">{detail.company.name}</dd>
					</div>
					<div>
						<dt class="text-xs text-muted">Terakhir diperbarui</dt>
						<dd class="mt-1 text-ink">{formatDateTime(detail.updated_at)}</dd>
					</div>
				</dl>
			</section>

			<section class="rounded-xl border border-line bg-surface p-5">
				<div class="mb-4 flex items-center justify-between">
					<h2 class="font-semibold text-ink">Active Deals</h2>
					<span class="text-xs text-muted">{detail.active_deals.length} deal</span>
				</div>
				{#if detail.active_deals.length === 0}
					<p class="py-6 text-center text-sm text-muted">Tidak ada Deal aktif pada company ini.</p>
				{:else}
					<div class="space-y-3">
						{#each detail.active_deals as deal (deal.id)}
							<a
								href={`/pipeline?deal=${encodeURIComponent(deal.id)}`}
								class="block rounded-lg border border-line p-3 hover:border-brand/40 hover:bg-surface-2"
							>
								<div class="flex items-start justify-between gap-3">
									<div>
										<p class="font-medium text-ink">{deal.name}</p>
										<div class="mt-2 flex flex-wrap gap-1.5">
											{#if deal.items.length === 0}
												<span class="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
													Produk belum ditentukan
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
										<p class="mt-1 text-xs text-muted">
											PIC: {deal.contact?.name ?? 'Belum ditentukan'}
											{#if deal.contact?.id === detail.id}
												· Contact ini{/if}
										</p>
									</div>
									<Badge
										label={PIPELINE_PHASE_LABEL[deal.pipeline_status]}
										tone="bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
									/>
								</div>
								<p class="mt-3 text-sm font-semibold text-ink">
									{formatCurrency(asNumber(deal.amount))}
								</p>
							</a>
						{/each}
					</div>
				{/if}
			</section>
		</div>

		<section class="min-w-0 rounded-xl border border-line bg-surface">
			<div class="grid grid-cols-3 border-b border-line bg-surface-2">
				<button
					class="px-3 py-3 text-sm font-medium {activeTab === 'meetings'
						? 'border-b-2 border-brand text-brand'
						: 'text-muted'}"
					onclick={() => (activeTab = 'meetings')}
				>
					Meeting ({detail.meeting_summary.total_meetings})
				</button>
				<button
					class="px-3 py-3 text-sm font-medium {activeTab === 'activity'
						? 'border-b-2 border-brand text-brand'
						: 'text-muted'}"
					onclick={() => (activeTab = 'activity')}>Activity & Notes ({detail.notes_count})</button
				>
				<button
					class="px-3 py-3 text-sm font-medium text-muted transition-colors hover:text-ink"
					onclick={loadDetail}
				>
					Refresh
				</button>
			</div>

			<div class="p-5">
				{#if activeTab === 'meetings'}
					<div class="mb-4 grid gap-3 sm:grid-cols-3">
						<div class="rounded-lg bg-surface-2 p-3">
							<p class="text-xs text-muted">Total</p>
							<p class="mt-1 text-lg font-semibold text-ink">
								{detail.meeting_summary.total_meetings}
							</p>
						</div>
						<div class="rounded-lg bg-surface-2 p-3">
							<p class="text-xs text-muted">Meeting Terakhir</p>
							<p class="mt-1 text-sm font-medium text-ink">
								{formatDateTime(detail.meeting_summary.last_meeting_at)}
							</p>
						</div>
						<div class="rounded-lg bg-surface-2 p-3">
							<p class="text-xs text-muted">Meeting Berikutnya</p>
							<p class="mt-1 text-sm font-medium text-ink">
								{formatDateTime(detail.meeting_summary.next_meeting_at)}
							</p>
						</div>
					</div>
					{#if meetingsLoading}
						<LoadingState />
					{:else if meetings.length === 0}
						<p class="py-10 text-center text-sm text-muted">Belum ada riwayat meeting.</p>
					{:else}
						<div class="space-y-3">
							{#each meetings as meeting (meeting.id)}
								<article class="rounded-lg border border-line p-4">
									<div class="flex flex-wrap items-start justify-between gap-2">
										<div>
											<p class="font-medium text-ink">{decodeHtml(meeting.agenda)}</p>
											<p class="mt-1 text-xs text-muted">
												Dijadwalkan oleh {meeting.scheduled_by_name}
											</p>
										</div>
										<Badge
											label={meeting.status === 'upcoming' ? 'Mendatang' : 'Selesai'}
											tone={meeting.status === 'upcoming'
												? 'bg-emerald-100 text-emerald-700'
												: 'bg-surface-3 text-muted'}
										/>
									</div>
									<div class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
										<span
											><Icon name="calendar" size={13} /> {formatDate(meeting.meeting_date)}</span
										>
										<span><Icon name="clock" size={13} /> {meeting.meeting_time} WIB</span>
										<span><Icon name="map-pin" size={13} /> {meeting.location ?? '-'}</span>
									</div>
								</article>
							{/each}
						</div>
						{#if meetingTotalPages > 1}
							<Paginator
								page={meetingPage}
								totalPages={meetingTotalPages}
								totalItems={meetingTotal}
								onpage={goMeetingPage}
							/>
						{/if}
					{/if}
				{:else}
					<form class="mb-5 rounded-xl border border-line p-4" onsubmit={addNote}>
						<Textarea
							label="Catatan Internal Contact"
							bind:value={note}
							error={noteError}
							maxlength={5000}
							rows={4}
							placeholder="Tambahkan konteks personal atau informasi penting klien"
							required
						/>
						<div class="mt-3 flex justify-end">
							<Button type="submit" size="sm" loading={savingNote} disabled={!note.trim()}>
								Simpan Catatan
							</Button>
						</div>
					</form>
					{#if activitiesLoading}
						<LoadingState />
					{:else if activities.length === 0}
						<p class="py-10 text-center text-sm text-muted">Belum ada activity atau catatan.</p>
					{:else}
						<ActivityTimeline {activities} />
					{/if}
				{/if}
			</div>
		</section>
	</div>
{/if}

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
