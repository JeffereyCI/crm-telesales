<script lang="ts">
	import {
		ApiError,
		contactsApi,
		dealsApi,
		formatCurrency,
		formatDate,
		formatDateTime,
		LatestRequest,
		toMessage
	} from '$lib';
	import { PIPELINE_PHASE_LABEL } from '$lib/constants/enums';
	import { toast } from '$lib/stores/toast.svelte';
	import type {
		ContactDetailResponse,
		DealActivityResponse,
		DealDetailResponse,
		DealResponse,
		ProductResponse
	} from '$lib/types/api';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import LoadingState from '$lib/components/ui/LoadingState.svelte';
	import Paginator from '$lib/components/ui/Pagination.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import MeetingModal from '$lib/components/contacts/MeetingModal.svelte';
	import DealActivityTimeline from './DealActivityTimeline.svelte';

	interface Props {
		deal: DealResponse;
		canEdit: boolean;
		products?: ProductResponse[];
		onclose: () => void;
		onclosed?: () => void;
		onedit: (deal: DealDetailResponse) => void;
	}

	const COMPANY_HISTORY_PAGE_SIZE = 5;

	let { deal, canEdit, products = [], onclose, onclosed, onedit }: Props = $props();
	let detail = $state<DealDetailResponse | null>(null);
	let detailLoading = $state(true);
	let detailError = $state('');
	let activities = $state<DealActivityResponse[]>([]);
	let activitiesLoading = $state(true);
	let activitiesError = $state('');
	let companyDeals = $state<DealResponse[]>([]);
	let companyDealsLoading = $state(false);
	let companyDealsError = $state('');
	let companyPage = $state(1);
	let companyTotalPages = $state(1);
	let companyTotalItems = $state(0);
	let note = $state('');
	let savingNote = $state(false);
	let activeTab = $state<'activity' | 'company_history'>('activity');
	let showMeetingModal = $state(false);
	let meetingContact = $state<ContactDetailResponse | null>(null);
	let meetingLoading = $state(false);

	const detailRequest = new LatestRequest();
	const activitiesRequest = new LatestRequest();
	const companyDealsRequest = new LatestRequest();
	const meetingRequest = new LatestRequest();
	let noteController: AbortController | null = null;

	const isTerminal = $derived(detail?.pipeline_status === 'win' || detail?.pipeline_status === 'lost');
	const canMutate = $derived(canEdit && !!detail && !isTerminal);
	const canOpenContactProfile = $derived(!!detail?.contact?.id);
	const canScheduleFollowUp = $derived(canMutate && !!detail?.contact?.id);

	async function loadDetail(id = deal.id, resetCompanyPage = false) {
		const controller = detailRequest.start();
		detailLoading = true;
		if (resetCompanyPage) companyPage = 1;
		detailError = '';
		try {
			const result = await dealsApi.getDealDetail(id, controller.signal);
			if (!detailRequest.isCurrent(controller)) return;
			detail = result;
		} catch (err) {
			if (!detailRequest.isCurrent(controller)) return;
			detail = null;
			detailError = toMessage(err);
		} finally {
			if (detailRequest.finish(controller)) detailLoading = false;
		}
	}

	async function loadActivities(id = deal.id) {
		const controller = activitiesRequest.start();
		activitiesLoading = true;
		activitiesError = '';
		try {
			const result = await dealsApi.getActivities(id, controller.signal);
			if (!activitiesRequest.isCurrent(controller)) return;
			activities = result;
		} catch (err) {
			if (!activitiesRequest.isCurrent(controller)) return;
			activities = [];
			activitiesError = toMessage(err);
		} finally {
			if (activitiesRequest.finish(controller)) activitiesLoading = false;
		}
	}

	async function loadCompanyDeals(companyId: string, page = companyPage) {
		const controller = companyDealsRequest.start();
		companyDealsLoading = true;
		companyDealsError = '';
		try {
			const result = await dealsApi.getCompanyDeals(
				companyId,
				{ page, limit: COMPANY_HISTORY_PAGE_SIZE },
				controller.signal
			);
			if (!companyDealsRequest.isCurrent(controller)) return;
			companyDeals = result.data;
			companyTotalPages = result.pagination.total_pages;
			companyTotalItems = result.pagination.total_items;
		} catch (err) {
			if (!companyDealsRequest.isCurrent(controller)) return;
			companyDeals = [];
			companyTotalPages = 1;
			companyTotalItems = 0;
			companyDealsError = toMessage(err);
		} finally {
			if (companyDealsRequest.finish(controller)) companyDealsLoading = false;
		}
	}

	async function addNote() {
		if (!detail || !note.trim()) return;
		noteController?.abort();
		const controller = new AbortController();
		noteController = controller;
		savingNote = true;
		try {
			await dealsApi.addNote(detail.id, note.trim(), controller.signal);
			if (controller.signal.aborted) return;
			note = '';
			toast.success('Catatan internal ditambahkan.');
			await Promise.all([loadDetail(detail.id), loadActivities(detail.id)]);
		} catch (err) {
			if (controller.signal.aborted) return;
			if (err instanceof ApiError && err.status === 409) {
				await Promise.all([loadDetail(detail.id), loadActivities(detail.id)]);
			}
			toast.error(toMessage(err));
		} finally {
			if (noteController === controller) {
				noteController = null;
				savingNote = false;
			}
		}
	}

	async function openMeetingModal() {
		const contactId = detail?.contact?.id;
		if (!contactId) {
			toast.error('Deal ini belum memiliki PIC yang bisa dijadwalkan meeting.');
			return;
		}

		const controller = meetingRequest.start();
		meetingLoading = true;
		try {
			const contactDetail = await contactsApi.getContactDetail(contactId, controller.signal);
			if (!meetingRequest.isCurrent(controller)) return;
			meetingContact = contactDetail;
			showMeetingModal = true;
		} catch (err) {
			if (!meetingRequest.isCurrent(controller)) return;
			toast.error(toMessage(err));
		} finally {
			if (meetingRequest.finish(controller)) meetingLoading = false;
		}
	}

	function meetingSaved() {
		showMeetingModal = false;
		meetingContact = null;
		if (!detail) return;
		void Promise.all([loadDetail(detail.id), loadActivities(detail.id)]);
	}

	function editDeal() {
		if (!detail || !canMutate) return;
		onedit(detail);
	}

	function goCompanyPage(next: number) {
		companyPage = next;
		if (detail) void loadCompanyDeals(detail.company.id, next);
	}

	$effect(() => {
		const id = deal.id;
		companyPage = 1;
		activeTab = 'activity';
		companyDeals = [];
		companyTotalPages = 1;
		companyTotalItems = 0;
		void Promise.all([loadDetail(id, true), loadActivities(id)]);
		return () => {
			detailRequest.abort();
			activitiesRequest.abort();
			companyDealsRequest.abort();
			meetingRequest.abort();
		};
	});

	$effect(() => {
		const companyId = detail?.company.id;
		const page = companyPage;
		if (!companyId) return;
		void loadCompanyDeals(companyId, page);
	});

	$effect(() => () => noteController?.abort());
</script>

<Modal title="Detail Deal" size="lg" onclose={savingNote ? undefined : onclose} {onclosed}>
	{#if detailLoading && !detail}
		<LoadingState />
	{:else if detailError || !detail}
		<div class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
			{detailError || 'Gagal memuat detail deal.'}
		</div>
	{:else}
		<div class="grid gap-5 md:grid-cols-[0.82fr_1.18fr]">
			<section>
				<p class="text-lg font-semibold text-ink">{detail.name}</p>
				<p class="text-sm text-muted">{detail.company.name}</p>
				<dl
					class="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-line bg-surface-2 p-4 text-sm"
				>
					<div class="col-span-2">
						<dt class="text-xs text-muted">PIC</dt>
						<dd class="mt-1 font-medium text-ink">{detail.contact?.name ?? '-'}</dd>
					</div>
					<div>
						<dt class="text-xs text-muted">Status</dt>
						<dd class="mt-1 font-medium text-ink">{PIPELINE_PHASE_LABEL[detail.pipeline_status]}</dd>
					</div>
					<div>
						<dt class="text-xs text-muted">Tipe Deal</dt>
						<dd class="mt-1 font-medium text-ink capitalize">
							{detail.deal_type.replace('_', ' ')}
						</dd>
					</div>
					<div>
						<dt class="text-xs text-muted">Nilai</dt>
						<dd class="mt-1 font-medium text-ink">{formatCurrency(detail.amount)}</dd>
					</div>
					<div>
						<dt class="text-xs text-muted">Aktivitas</dt>
						<dd class="mt-1 font-medium text-ink">{detail.activities_count}</dd>
					</div>
					<div class="col-span-2">
						<dt class="text-xs text-muted">Produk</dt>
						<dd class="mt-1 space-y-2">
							{#if detail.items.length === 0}
								<p class="text-ink">-</p>
							{:else}
								{#each detail.items as item (item.id)}
									<div class="rounded-lg border border-line bg-surface px-3 py-2">
										<p class="font-medium text-ink">{item.product_name}</p>
										<p class="mt-1 text-xs text-muted">
											{item.quantity} x {formatCurrency(item.unit_price)}
											{#if Number(item.discount_percent) > 0}
												· Diskon {item.discount_percent}%
											{/if}
										</p>
										{#if item.subscription_end}
											<p class="mt-1 text-xs text-muted">
												Berakhir {formatDate(item.subscription_end)}
											</p>
										{/if}
									</div>
								{/each}
							{/if}
						</dd>
					</div>
					{#if detail.lost_reason}
						<div class="col-span-2">
							<dt class="text-xs text-muted">Alasan penolakan</dt>
							<dd class="mt-1 text-ink">{detail.lost_reason}</dd>
						</div>
					{/if}
					{#if detail.notes}
						<div class="col-span-2">
							<dt class="text-xs text-muted">Catatan deal</dt>
							<dd class="mt-1 whitespace-pre-wrap text-ink">{detail.notes}</dd>
						</div>
					{/if}
					<div>
						<dt class="text-xs text-muted">Dibuat</dt>
						<dd class="mt-1 text-ink">{formatDateTime(detail.created_at)}</dd>
					</div>
					<div>
						<dt class="text-xs text-muted">Diperbarui</dt>
						<dd class="mt-1 text-ink">{formatDateTime(detail.updated_at)}</dd>
					</div>
				</dl>
				<div class="mt-3 space-y-2">
					{#if canOpenContactProfile}
						<a
							href={`/contacts/${encodeURIComponent(detail.contact?.id ?? '')}`}
							class="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-line-strong bg-surface px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-3"
						>
							Lihat Profil Kontak
						</a>
					{:else}
						<Button full variant="secondary" disabled>Profil kontak tidak tersedia</Button>
					{/if}
					{#if canScheduleFollowUp}
						<Button full onclick={() => void openMeetingModal()} disabled={savingNote || meetingLoading}>
							Jadwalkan Meeting Lanjutan
						</Button>
					{:else if canEdit}
						<p class="text-xs text-muted">
							Deal terminal atau tanpa PIC aktif bersifat read-only untuk follow-up.
						</p>
					{/if}
					{#if canMutate}
						<Button variant="secondary" full onclick={editDeal} disabled={savingNote || meetingLoading}>
							Edit deal
						</Button>
					{:else if canEdit}
						<p class="text-xs text-muted">
							Deal dengan status Win/Lost bersifat immutable dan tidak bisa diedit.
						</p>
					{/if}
				</div>
			</section>

			<section class="min-w-0 border-t border-line pt-5 md:border-t-0 md:border-l md:pt-0 md:pl-5">
				<div class="mb-4 flex items-center justify-between gap-3">
					<div class="flex items-center gap-2 rounded-lg bg-surface-2 p-1">
						<button
							type="button"
							class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors {activeTab ===
							'activity'
								? 'bg-surface text-ink shadow-sm'
								: 'text-muted hover:text-ink'}"
							onclick={() => (activeTab = 'activity')}
						>
							Riwayat Aktivitas
						</button>
						<button
							type="button"
							class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors {activeTab ===
							'company_history'
								? 'bg-surface text-ink shadow-sm'
								: 'text-muted hover:text-ink'}"
							onclick={() => (activeTab = 'company_history')}
						>
							Histori Company
						</button>
					</div>
					<Button
						size="sm"
						variant="ghost"
						onclick={() =>
							activeTab === 'activity'
								? void loadActivities(detail.id)
								: void loadCompanyDeals(detail.company.id, companyPage)}
						disabled={activeTab === 'activity' ? activitiesLoading : companyDealsLoading}
					>
						Muat ulang
					</Button>
				</div>

				{#if activeTab === 'activity'}
					{#if canMutate}
						<form
							class="mb-5 rounded-xl border border-line p-3"
							onsubmit={(e) => {
								e.preventDefault();
								void addNote();
							}}
						>
							<Textarea
								label="Catatan Internal"
								placeholder="Contoh: Client meminta revisi terms pembayaran"
								maxlength={500}
								bind:value={note}
							/>
							<div class="mt-2 flex justify-end">
								<Button type="submit" size="sm" loading={savingNote} disabled={!note.trim()}>
									Simpan Catatan
								</Button>
							</div>
						</form>
					{/if}
					{#if activitiesLoading}
						<LoadingState />
					{:else if activitiesError}
						<p class="rounded-lg bg-red-50 p-3 text-sm text-red-700">{activitiesError}</p>
					{:else if activities.length === 0}
						<p class="py-8 text-center text-sm text-muted">Belum ada riwayat aktivitas.</p>
					{:else}
						<DealActivityTimeline {activities} {products} />
					{/if}
				{:else}
					{#if companyDealsLoading}
						<LoadingState />
					{:else if companyDealsError}
						<p class="rounded-lg bg-red-50 p-3 text-sm text-red-700">{companyDealsError}</p>
					{:else if companyDeals.length === 0}
						<p class="py-8 text-center text-sm text-muted">Belum ada histori deal pada company ini.</p>
					{:else}
						<div class="space-y-3">
							{#each companyDeals as companyDeal (companyDeal.id)}
								<article
									class="rounded-lg border border-line p-4 {companyDeal.id === detail.id
										? 'border-brand/40 bg-brand-soft/30'
										: 'bg-surface'}"
								>
									<div class="flex items-start justify-between gap-3">
										<div>
											<p class="font-medium text-ink">{companyDeal.name}</p>
											<p class="mt-1 text-xs text-muted">
												PIC: {companyDeal.contact?.name ?? 'Tidak ada PIC'}
											</p>
										</div>
										<span class="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-muted">
											{PIPELINE_PHASE_LABEL[companyDeal.pipeline_status]}
										</span>
									</div>
									<p class="mt-3 text-sm font-semibold text-ink">{formatCurrency(companyDeal.amount)}</p>
									<p class="mt-1 text-xs text-muted">
										Diperbarui {formatDateTime(companyDeal.updated_at)}
										{#if companyDeal.id === detail.id} · Deal ini{/if}
									</p>
								</article>
							{/each}
						</div>
						{#if companyTotalPages > 1}
							<Paginator
								page={companyPage}
								totalPages={companyTotalPages}
								totalItems={companyTotalItems}
								onpage={goCompanyPage}
							/>
						{/if}
					{/if}
				{/if}
			</section>
		</div>
	{/if}
</Modal>

{#if showMeetingModal && meetingContact}
	<MeetingModal
		contact={meetingContact}
		pipelineStatus={detail?.pipeline_status}
		isFollowUp={true}
		onclose={() => {
			showMeetingModal = false;
			meetingContact = null;
		}}
		onsaved={meetingSaved}
	/>
{/if}
