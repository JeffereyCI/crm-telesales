<!--
  LeadSidePanel — drawer kanan untuk Pipeline Board.
  Menampilkan profil lead, histori aktivitas, dan aksi pipeline.
  BDM bisa: update response status, jadwalkan meeting (via modal reuse).
  Telesales bisa: update action status, jadwalkan meeting.

  Data source: LeadMasterViewItem (tanpa phone/email — memang tidak ditampilkan
  di Pipeline Board karena fokusnya adalah funnel progression, bukan profil kontak).
-->
<script lang="ts">
	import {
		contactsApi,
		can,
		auth,
		orDash,
		formatDateTime,
		toMessage,
		toStage,
		STAGE_LABEL,
		STAGE_BADGE,
		ACTION_STATUS_LABEL,
		ACTION_STATUS_BADGE,
		RESPONSE_STATUS_LABEL,
		RESPONSE_STATUS_BADGE
	} from '$lib';
	import type {
		LeadMasterViewItem,
		ContactActivityResponse,
		ContactResponse
	} from '$lib/types/api';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import LoadingState from '$lib/components/ui/LoadingState.svelte';
	import ActivityTimeline from '$lib/components/contacts/ActivityTimeline.svelte';
	import ActionStatusModal from '$lib/components/contacts/ActionStatusModal.svelte';
	import ResponseStatusModal from '$lib/components/contacts/ResponseStatusModal.svelte';
	import MeetingModal from '$lib/components/contacts/MeetingModal.svelte';

	interface Props {
		item: LeadMasterViewItem;
		onclose: () => void;
		onupdated: () => void;
	}
	let { item, onclose, onupdated }: Props = $props();

	type Tab = 'overview' | 'activity';
	let activeTab = $state<Tab>('overview');

	let activities = $state<ContactActivityResponse[]>([]);
	let activitiesLoading = $state(false);
	let activitiesError = $state('');
	// Penanda cache: timeline sudah pernah dimuat untuk kontak ini. Dipakai agar
	// riwayat KOSONG tidak dianggap "belum dimuat", dan agar setiap simpan status
	// menandai cache basi (aktivitas baru wajib terlihat saat tab dibuka lagi).
	let activitiesLoaded = $state(false);

	let showActionModal = $state(false);
	let showResponseModal = $state(false);
	let showMeetingModal = $state(false);

	const canAction = $derived(can(auth.role, 'updateActionStatus'));
	const canResponse = $derived(can(auth.role, 'updateResponseStatus'));
	const canMeeting = $derived(can(auth.role, 'scheduleMeeting'));

	// Buat ContactResponse minimal dari LeadMasterViewItem supaya modal-modal
	// yang sudah ada (ActionStatusModal, ResponseStatusModal, MeetingModal)
	// bisa di-reuse tanpa duplikasi.
	const asContact = $derived({
		id: item.id,
		name: item.name,
		job_title: item.job_title,
		phone: item.phone,
		email: item.email,
		action_status: item.action_status,
		response_status: item.response_status,
		is_meeting_scheduled: item.is_meeting_scheduled,
		updated_at: item.updated_at
	} as ContactResponse);

	// Reset per-item state on selection change
	let _prevId = '';
	$effect(() => {
		const id = item.id;
		if (id !== _prevId) {
			_prevId = id;
			activities = [];
			activitiesError = '';
			activitiesLoaded = false;
			activeTab = 'overview';
		}
	});

	async function loadActivities() {
		activitiesLoading = true;
		activitiesError = '';
		try {
			const res = await contactsApi.getContactActivities(item.id);
			activities = res.data;
			activitiesLoaded = true;
		} catch (err) {
			activitiesError = toMessage(err);
		} finally {
			activitiesLoading = false;
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
		// Simpan status SELALU menghasilkan baris aktivitas baru (+catatan) di backend.
		// Tandai cache basi agar tab Aktivitas memuat ulang, bukan menampilkan data lama.
		activitiesLoaded = false;
		if (activeTab === 'activity') loadActivities();
		onupdated();
	}

	// Pipeline stage — memakai helper bersama `toStage` ($lib/utils/pipeline)
	// agar SELALU sinkron dengan Pipeline Board (termasuk cabang Loss).
	const stage = $derived(toStage(item));
	const stageLabel = $derived(STAGE_LABEL[stage]);
	const stageBg = $derived(STAGE_BADGE[stage]);

	const TABS: { key: Tab; label: string }[] = [
		{ key: 'overview', label: 'Ringkasan' },
		{ key: 'activity', label: 'Aktivitas' }
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
			<div class="flex shrink-0 items-center gap-2">
				<Badge label={stageLabel} tone={stageBg} />
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
		<!-- Ringkasan -->
		{#if activeTab === 'overview'}
			<div class="space-y-4">
				<!-- Info dasar -->
				<dl class="space-y-3 text-sm">
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
					{#if item.assigned_to}
						<div>
							<dt class="text-xs font-medium tracking-wide text-subtle uppercase">Telesales PIC</dt>
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

				<!-- Status Kontak -->
				<div class="rounded-xl border border-line p-4">
					<h3 class="mb-2 text-xs font-semibold tracking-wide text-ink-soft uppercase">
						Status Kontak
					</h3>
					<Badge
						label={ACTION_STATUS_LABEL[item.action_status]}
						tone={ACTION_STATUS_BADGE[item.action_status]}
					/>
					{#if canAction}
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
					{#if canMeeting && !item.is_meeting_scheduled}
						{#if contactsApi.canScheduleMeeting(item.response_status)}
							<div class="mt-3">
								<button
									type="button"
									onclick={() => (showMeetingModal = true)}
									class="flex items-center gap-2 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand/90"
								>
									<Icon name="calendar" size={14} /> Jadwalkan Meeting
								</button>
							</div>
						{:else}
							<p class="mt-2 text-xs text-subtle">
								Status respon harus <span class="font-medium text-ink-soft">Tertarik</span> untuk menjadwalkan
								meeting.
							</p>
						{/if}
					{/if}
				</div>
			</div>

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

			{#if canAction && !activitiesLoading}
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
		onclose={() => (showMeetingModal = false)}
		onsaved={handleSaved}
	/>
{/if}
