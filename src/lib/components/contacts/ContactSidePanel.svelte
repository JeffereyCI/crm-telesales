<!--
  ContactSidePanel — drawer kanan (≈40% layar) untuk detail & aksi kontak.
  Sticky header: nama, jabatan, perusahaan, quick-action WA + Email.
  Tab Profil  : kelengkapan data administratif.
  Tab Aktivitas: timeline histori interaksi (lazy-load saat tab diklik).
  Tab Pipeline : status action/respon + penjadwalan meeting.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		companiesApi,
		contactsApi,
		can,
		auth,
		orDash,
		formatDateTime,
		toMessage,
		LatestRequest,
		ACTION_STATUS_LABEL,
		ACTION_STATUS_BADGE,
		RESPONSE_STATUS_LABEL,
		RESPONSE_STATUS_BADGE,
		ApiError
	} from '$lib';
	import { toast } from '$lib/stores/toast.svelte';
	import WhatsAppBadge from '$lib/components/contacts/WhatsAppBadge.svelte';
	import type {
		CompanyDetailResponse,
		DealDetailResponse,
		LeadMasterViewItem,
		ContactActivityResponse,
		ContactDetailResponse,
		ContactResponse
	} from '$lib/types/api';
	import type { PipelinePhase } from '$lib/constants/enums';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import LoadingState from '$lib/components/ui/LoadingState.svelte';
	import ActivityTimeline from '$lib/components/contacts/ActivityTimeline.svelte';
	import ActionStatusModal from '$lib/components/contacts/ActionStatusModal.svelte';
	import ResponseStatusModal from '$lib/components/contacts/ResponseStatusModal.svelte';
	import MeetingModal from '$lib/components/contacts/MeetingModal.svelte';
	import QuickContactActions from '$lib/components/contacts/QuickContactActions.svelte';
	import CreateDealModal from '$lib/components/pipeline/CreateDealModal.svelte';

	interface Props {
		item: LeadMasterViewItem;
		onclose: () => void;
		onupdated: () => void;
	}
	let { item, onclose, onupdated }: Props = $props();

	type Tab = 'profile' | 'activity' | 'pipeline';
	let activeTab = $state<Tab>('profile');

	let activities = $state<ContactActivityResponse[]>([]);
	let activitiesLoading = $state(false);
	let activitiesError = $state('');
	// Penanda cache: timeline sudah pernah dimuat untuk kontak ini. Dipakai agar
	// riwayat KOSONG tidak dianggap "belum dimuat", dan agar setiap simpan status
	// menandai cache basi (aktivitas baru wajib terlihat saat tab dibuka lagi).
	let activitiesLoaded = $state(false);
	const activitiesRequest = new LatestRequest();

	let showActionModal = $state(false);
	let showResponseModal = $state(false);
	let showMeetingModal = $state(false);
	let showCreateDealModal = $state(false);
	let contactDetail = $state<ContactDetailResponse | null>(null);
	let detailLoading = $state(false);
	let recheckLoading = $state(false);
	const detailRequest = new LatestRequest();
	let companyContext = $state<CompanyDetailResponse | null>(null);
	const companyRequest = new LatestRequest();
	let companyLoading = $state(false);

	const canManage = $derived(can(auth.role, 'manageContacts'));
	const canResponse = $derived(can(auth.role, 'updateResponseStatus'));
	const canMeeting = $derived(can(auth.role, 'scheduleMeeting'));
	const canCreateDeal = $derived(can(auth.role, 'editDeal'));
	const activeDeal = $derived.by(() => {
		if (!contactDetail) return null;
		return contactDetail.active_deals.find((deal) => deal.contact?.id === item.id) ?? null;
	});
	const companyStatus = $derived(companyContext?.status ?? null);
	const pipelineStatus = $derived((activeDeal?.pipeline_status ?? 'demo') as PipelinePhase);
	const isFollowUp = $derived(!!activeDeal);
	const telesalesFollowUpAllowed = $derived(
		auth.role !== 'telesales' || !isFollowUp || pipelineStatus === 'demo'
	);
	const customerNeedsManualDeal = $derived(companyStatus === 'customer' && !isFollowUp);
	const meetingStateReady = $derived(!detailLoading && !companyLoading && !!contactDetail);

	const currentPhone = $derived(contactDetail ? contactDetail.phone : item.phone);
	const currentWaStatus = $derived(contactDetail ? contactDetail.whatsapp_status : item.whatsapp_status);
	const currentWaVerifiedAt = $derived(contactDetail ? contactDetail.whatsapp_verified_at : item.whatsapp_verified_at);

	// LeadMasterViewItem is structurally compatible with ContactResponse
	const asContact = $derived({
		id: item.id,
		name: item.name,
		job_title: item.job_title,
		phone: currentPhone,
		email: item.email,
		whatsapp_status: currentWaStatus,
		whatsapp_verified_at: currentWaVerifiedAt,
		action_status: item.action_status,
		response_status: item.response_status,
		is_meeting_scheduled: item.is_meeting_scheduled,
		updated_at: item.updated_at
	} as ContactResponse);

	/** Recheck WhatsApp status — hanya untuk inactive/unverified. */
	async function handleRecheck() {
		recheckLoading = true;
		try {
			await contactsApi.verifyWhatsApp(item.id);
			// Muat ulang detail agar status terbaru terpanggil dari backend
			await loadContactDetail();
			onupdated();
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

	// Reset per-item state when the selected contact changes
	let _prevId = '';
	$effect(() => {
		const id = item.id;
		if (id !== _prevId) {
			activitiesRequest.abort();
			activitiesLoading = false;
			_prevId = id;
			activities = [];
			activitiesError = '';
			activitiesLoaded = false;
			contactDetail = null;
			companyContext = null;
			activeTab = 'profile';
			void loadContactDetail();
			void loadCompanyContext(item.company.id);
		}
	});
	// Effect tanpa dependency: cleanup hanya saat component benar-benar dihancurkan,
	// bukan setiap object `item` direfresh dengan ID yang masih sama.
	$effect(() => () => {
		activitiesRequest.abort();
		detailRequest.abort();
		companyRequest.abort();
	});

	async function loadContactDetail() {
		const controller = detailRequest.start();
		detailLoading = true;
		try {
			const result = await contactsApi.getContactDetail(item.id, controller.signal);
			if (!detailRequest.isCurrent(controller)) return;
			contactDetail = result;
		} catch {
			if (!detailRequest.isCurrent(controller)) return;
			contactDetail = null;
		} finally {
			if (detailRequest.finish(controller)) detailLoading = false;
		}
	}

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

	async function loadActivities() {
		const contactId = item.id;
		const controller = activitiesRequest.start();
		activitiesLoading = true;
		activitiesError = '';
		try {
			const res = await contactsApi.getContactActivities(contactId, controller.signal);
			if (!activitiesRequest.isCurrent(controller)) return;
			activities = res.data;
			activitiesLoaded = true;
		} catch (err) {
			if (!activitiesRequest.isCurrent(controller)) return;
			activitiesError = toMessage(err);
		} finally {
			if (activitiesRequest.finish(controller)) activitiesLoading = false;
		}
	}

	function selectTab(t: Tab) {
		activeTab = t;
		if (t === 'activity' && !activitiesLoaded && !activitiesLoading) {
			loadActivities();
		}
	}

	function handleSaved() {
		showActionModal = false;
		showResponseModal = false;
		showMeetingModal = false;
		void loadContactDetail();
		// Simpan status SELALU menghasilkan baris aktivitas baru (+catatan) di backend.
		// Tandai cache basi agar tab Aktivitas memuat ulang, bukan menampilkan data lama.
		activitiesLoaded = false;
		if (activeTab === 'activity') loadActivities();
		onupdated();
	}

	async function handleCreated(deal: DealDetailResponse) {
		showCreateDealModal = false;
		onclose();
		await goto(`/pipeline?deal=${encodeURIComponent(deal.id)}`);
	}

	const TABS: { key: Tab; label: string }[] = [
		{ key: 'profile', label: 'Profil' },
		{ key: 'activity', label: 'Aktivitas' },
		{ key: 'pipeline', label: 'Pipeline' }
	];
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
	class="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-line bg-surface shadow-2xl lg:max-w-lg"
>
	<!-- Sticky header -->
	<div class="sticky top-0 z-10 border-b border-line bg-surface px-5 pt-4 pb-0">
		<div class="mb-3 flex items-start gap-3">
			<div class="min-w-0 flex-1">
				<h2 class="truncate text-base font-semibold text-ink">{item.name}</h2>
				<p class="truncate text-sm text-muted">{orDash(item.job_title)}</p>
				<p class="truncate text-sm font-medium text-brand">{item.company.name}</p>
			</div>
			<div class="flex shrink-0 items-center gap-1">
				<a
					href={`/contacts/${item.id}`}
					class="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
					aria-label="Buka halaman detail lengkap"
					title="Detail lengkap"
				>
					<Icon name="external-link" size={18} />
				</a>
				<QuickContactActions
					name={item.name}
					phone={currentPhone}
					email={item.email}
					companyName={item.company.name}
					size={18}
				/>
				<button
					type="button"
					onclick={onclose}
					class="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
					aria-label="Tutup"
				>
					<Icon name="x" size={18} />
				</button>
			</div>
		</div>

		<!-- Tab bar -->
		<div class="flex">
			{#each TABS as tab (tab.key)}
				<button
					type="button"
					onclick={() => selectTab(tab.key)}
					class="border-b-2 px-4 py-2.5 text-sm font-medium transition-colors {activeTab === tab.key
						? 'border-brand text-brand'
						: 'border-transparent text-muted hover:text-ink'}"
				>
					{tab.label}
				</button>
			{/each}
		</div>
	</div>

	<!-- Scrollable tab content -->
	<div class="flex-1 overflow-y-auto p-5">
		<!-- Profil -->
		{#if activeTab === 'profile'}
			<dl class="space-y-4 text-sm">
				<div>
					<dt class="text-xs font-medium tracking-wide text-subtle uppercase">Nama</dt>
					<dd class="mt-0.5 text-ink">{item.name}</dd>
				</div>
				<div>
					<dt class="text-xs font-medium tracking-wide text-subtle uppercase">Jabatan</dt>
					<dd class="mt-0.5 text-ink-soft">{orDash(item.job_title)}</dd>
				</div>
				<div>
					<dt class="text-xs font-medium tracking-wide text-subtle uppercase">Perusahaan</dt>
					<dd class="mt-0.5 font-medium text-brand">{item.company.name}</dd>
				</div>
				<div>
					<dt class="text-xs font-medium tracking-wide text-subtle uppercase">No. WhatsApp</dt>
					<dd class="mt-0.5 flex flex-wrap items-center gap-2">
						<span class="text-ink-soft">{orDash(currentPhone)}</span>
						<WhatsAppBadge status={currentWaStatus} />
					</dd>
					{#if currentPhone && (currentWaStatus === 'inactive' || currentWaStatus === 'unverified')}
						<button
							type="button"
							onclick={handleRecheck}
							disabled={recheckLoading}
							class="mt-1.5 flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-2.5 py-1 text-xs font-medium text-ink-soft transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{recheckLoading ? 'Memeriksa...' : '↻ Cek Ulang WA'}
						</button>
					{/if}
				</div>
				<div>
					<dt class="text-xs font-medium tracking-wide text-subtle uppercase">Email</dt>
					<dd class="mt-0.5 text-ink-soft">{orDash(item.email)}</dd>
				</div>
				{#if item.assigned_to}
					<div>
						<dt class="text-xs font-medium tracking-wide text-subtle uppercase">Telesales</dt>
						<dd class="mt-0.5">
							<Badge label={item.assigned_to.name} tone="bg-brand-soft text-brand" />
						</dd>
					</div>
				{/if}
				<div>
					<dt class="text-xs font-medium tracking-wide text-subtle uppercase">
						Terakhir diperbarui
					</dt>
					<dd class="mt-0.5 text-ink-soft">{formatDateTime(item.updated_at)}</dd>
				</div>
			</dl>

			<!-- Aktivitas -->
		{:else if activeTab === 'activity'}
			{#if activitiesLoading}
				<LoadingState />
			{:else if activitiesError}
				<div class="py-6 text-center">
					<p class="mb-3 text-sm text-muted">{activitiesError}</p>
					<button
						type="button"
						onclick={loadActivities}
						class="rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-2"
					>
						Coba lagi
					</button>
				</div>
			{:else if activities.length === 0}
				<div class="py-10 text-center">
					<Icon name="calendar" size={32} class="mx-auto mb-2 text-subtle" />
					<p class="text-sm text-muted">Belum ada histori aktivitas.</p>
				</div>
			{:else}
				<ActivityTimeline {activities} />
			{/if}

			{#if canManage && !activitiesLoading}
				<div class="mt-5 border-t border-line pt-4">
					<button
						type="button"
						onclick={() => (showActionModal = true)}
						class="flex w-full items-center justify-center gap-2 rounded-lg border border-line-strong bg-surface px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-2"
					>
						<Icon name="phone" size={15} /> Catat Interaksi
					</button>
				</div>
			{/if}

			<!-- Pipeline -->
		{:else if activeTab === 'pipeline'}
			<div class="space-y-4">
				<!-- Status Kontak -->
				<div class="rounded-xl border border-line p-4">
					<h3 class="mb-2 text-xs font-semibold tracking-wide text-ink-soft uppercase">
						Status Kontak
					</h3>
					<Badge
						label={ACTION_STATUS_LABEL[item.action_status]}
						tone={ACTION_STATUS_BADGE[item.action_status]}
					/>
					{#if canManage}
						<div class="mt-3">
							<button
								type="button"
								onclick={() => (showActionModal = true)}
								class="flex items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-2"
							>
								<Icon name="phone" size={14} /> Update Status Kontak
							</button>
						</div>
					{/if}
				</div>

				<!-- Status Respon -->
				<div class="rounded-xl border border-line p-4">
					<h3 class="mb-2 text-xs font-semibold tracking-wide text-ink-soft uppercase">
						Status Respon
					</h3>
					{#if item.response_status}
						<Badge
							label={RESPONSE_STATUS_LABEL[item.response_status]}
							tone={RESPONSE_STATUS_BADGE[item.response_status]}
						/>
					{:else}
						<span class="text-sm text-subtle">Belum ada respon</span>
					{/if}
					{#if canResponse}
						{#if contactsApi.canRecordResponse(item.action_status)}
							<div class="mt-3">
								<button
									type="button"
									onclick={() => (showResponseModal = true)}
									class="flex items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-2"
								>
									<Icon name="check-circle" size={14} /> Update Status Respon
								</button>
							</div>
						{:else}
							<p class="mt-2 text-xs text-subtle">
								Set status kontak ke <span class="font-medium text-ink-soft">Sudah Dihubungi</span>
								dulu untuk mengisi respon.
							</p>
						{/if}
					{/if}
				</div>

				<!-- Meeting -->
				<div class="rounded-xl border border-line p-4">
					<h3 class="mb-2 text-xs font-semibold tracking-wide text-ink-soft uppercase">Meeting</h3>
					{#if item.is_meeting_scheduled}
						<span class="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
							<Icon name="check" size={15} /> Meeting telah dijadwalkan
						</span>
					{:else}
						<span class="text-sm text-subtle">Belum dijadwalkan</span>
					{/if}
					{#if canMeeting}
						{#if contactsApi.canScheduleMeeting(item.response_status)}
							<div class="mt-3">
								<button
									type="button"
									onclick={() => (showMeetingModal = true)}
									disabled={!meetingStateReady || !telesalesFollowUpAllowed || customerNeedsManualDeal}
									class="flex items-center gap-2 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
								>
									<Icon name="calendar" size={14} />
									{isFollowUp ? 'Jadwalkan Meeting Lanjutan' : 'Jadwalkan Meeting'}
								</button>
								{#if !meetingStateReady}
									<p class="mt-2 text-xs text-subtle">
										Memuat status company dan deal aktif terlebih dahulu sebelum meeting dijadwalkan.
									</p>
								{:else if customerNeedsManualDeal}
									<p class="mt-2 text-xs text-subtle">
										Customer tanpa deal aktif harus dibuatkan deal manual terlebih dahulu.
									</p>
									{#if canCreateDeal && auth.role === 'bdm'}
										<button
											type="button"
											onclick={() => (showCreateDealModal = true)}
											class="mt-2 flex items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-2"
										>
											<Icon name="plus" size={14} /> Buat Deal Manual
										</button>
									{/if}
								{:else if !telesalesFollowUpAllowed}
									<p class="mt-2 text-xs text-subtle">
										Telesales hanya dapat menjadwalkan meeting lanjutan saat Deal masih di tahap
										Demo.
									</p>
								{/if}
							</div>
						{:else}
							<p class="mt-2 text-xs text-subtle">
								Status respon harus
								<span class="font-medium text-ink-soft">Tertarik</span>
								untuk menjadwalkan meeting.
							</p>
						{/if}
					{/if}
					{#if canCreateDeal && companyStatus && companyStatus !== 'leads'}
						<div class="mt-3">
							{#if activeDeal}
								<button
									type="button"
									onclick={() => goto(`/pipeline?deal=${encodeURIComponent(activeDeal.id)}`)}
									class="flex items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-2"
								>
									<Icon name="arrow-up-right" size={14} /> Buka Deal Aktif
								</button>
							{:else}
								<button
									type="button"
									onclick={() => (showCreateDealModal = true)}
									class="flex items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-2"
								>
									<Icon name="plus" size={14} /> Buat Deal Baru
								</button>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</aside>

{#if showActionModal}
	<ActionStatusModal
		contact={asContact}
		onclose={() => (showActionModal = false)}
		onsaved={handleSaved}
	/>
{/if}
{#if showResponseModal}
	<ResponseStatusModal
		contact={asContact}
		onclose={() => (showResponseModal = false)}
		onsaved={handleSaved}
	/>
{/if}
{#if showMeetingModal}
	<MeetingModal
		contact={asContact}
		{pipelineStatus}
		{isFollowUp}
		onclose={() => (showMeetingModal = false)}
		onsaved={handleSaved}
	/>
{/if}
{#if showCreateDealModal && companyStatus}
	<CreateDealModal
		company={{ id: item.company.id, name: item.company.name, status: companyStatus }}
		initialContactId={item.id}
		lockContact
		onclose={() => (showCreateDealModal = false)}
		oncreated={handleCreated}
	/>
{/if}
