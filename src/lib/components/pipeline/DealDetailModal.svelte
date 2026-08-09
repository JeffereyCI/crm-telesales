<script lang="ts">
	import { contactsApi, dealsApi, formatCurrency, formatDate, toMessage, LatestRequest } from '$lib';
	import { PIPELINE_PHASE_LABEL } from '$lib/constants/enums';
	import { toast } from '$lib/stores/toast.svelte';
	import type {
		ContactDetailResponse,
		DealActivityResponse,
		DealResponse,
		ProductResponse
	} from '$lib/types/api';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import LoadingState from '$lib/components/ui/LoadingState.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import MeetingModal from '$lib/components/contacts/MeetingModal.svelte';
	import DealActivityTimeline from './DealActivityTimeline.svelte';

	interface Props {
		deal: DealResponse;
		canEdit: boolean;
		products?: ProductResponse[];
		onclose: () => void;
		onclosed?: () => void;
		onedit: () => void;
	}
	let { deal, canEdit, products = [], onclose, onclosed, onedit }: Props = $props();
	let activities = $state<DealActivityResponse[]>([]);
	let loading = $state(true);
	let error = $state('');
	let note = $state('');
	let savingNote = $state(false);
	let showMeetingModal = $state(false);
	let meetingContact = $state<ContactDetailResponse | null>(null);
	let meetingLoading = $state(false);

	let activitiesController: AbortController | null = null;
	let noteController: AbortController | null = null;
	const meetingRequest = new LatestRequest();
	const canScheduleFollowUp = $derived(
		canEdit &&
			deal.pipeline_status !== 'win' &&
			deal.pipeline_status !== 'lost' &&
			!!deal.contact?.id
	);

	async function loadActivities(dealId = deal.id) {
		activitiesController?.abort();
		const controller = new AbortController();
		activitiesController = controller;
		loading = true;
		error = '';
		try {
			activities = await dealsApi.getActivities(dealId, controller.signal);
		} catch (err) {
			if (controller.signal.aborted) return;
			error = toMessage(err);
		} finally {
			if (activitiesController === controller) {
				activitiesController = null;
				loading = false;
			}
		}
	}

	async function addNote() {
		if (!note.trim()) return;
		noteController?.abort();
		const controller = new AbortController();
		noteController = controller;
		savingNote = true;
		try {
			await dealsApi.addNote(deal.id, note.trim(), controller.signal);
			if (controller.signal.aborted) return;
			note = '';
			toast.success('Catatan internal ditambahkan.');
			await loadActivities();
		} catch (err) {
			if (controller.signal.aborted) return;
			toast.error(toMessage(err));
		} finally {
			if (noteController === controller) {
				noteController = null;
				savingNote = false;
			}
		}
	}

	async function openMeetingModal() {
		if (!deal.contact?.id) {
			toast.error('Deal ini belum memiliki PIC yang bisa dijadwalkan meeting.');
			return;
		}

		const controller = meetingRequest.start();
		meetingLoading = true;
		try {
			const detail = await contactsApi.getContactDetail(deal.contact.id, controller.signal);
			if (!meetingRequest.isCurrent(controller)) return;
			meetingContact = detail;
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
		void loadActivities();
	}

	$effect(() => {
		const dealId = deal.id;
		void loadActivities(dealId);
		return () => {
			activitiesController?.abort();
			meetingRequest.abort();
		};
	});

	$effect(() => () => noteController?.abort());
</script>

<Modal title="Detail Deal" size="lg" onclose={savingNote ? undefined : onclose} {onclosed}>
	<div class="grid gap-5 md:grid-cols-[0.8fr_1.2fr]">
		<section>
			<p class="text-lg font-semibold text-ink">{deal.name}</p>
			<p class="text-sm text-muted">{deal.company.name}</p>
			<dl
				class="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-line bg-surface-2 p-4 text-sm"
			>
				<div class="col-span-2">
					<dt class="text-xs text-muted">PIC</dt>
					<dd class="mt-1 font-medium text-ink">{deal.contact?.name ?? '-'}</dd>
				</div>
				<div>
					<dt class="text-xs text-muted">Status</dt>
					<dd class="mt-1 font-medium text-ink">{PIPELINE_PHASE_LABEL[deal.pipeline_status]}</dd>
				</div>
				<div>
					<dt class="text-xs text-muted">Nilai</dt>
					<dd class="mt-1 font-medium text-ink">{formatCurrency(deal.amount)}</dd>
				</div>
				<div>
					<dt class="text-xs text-muted">Produk</dt>
					<dd class="mt-1 font-medium text-ink">{deal.items[0]?.product_name ?? '-'}</dd>
				</div>
				<div>
					<dt class="text-xs text-muted">Tipe Deal</dt>
					<dd class="mt-1 font-medium text-ink capitalize">
						{deal.deal_type?.replace('_', ' ') || '-'}
					</dd>
				</div>
				{#if deal.items[0]?.subscription_end}
					<div class="col-span-2">
						<dt class="text-xs text-muted">Langganan berakhir</dt>
						<dd class="mt-1 font-medium text-ink">{formatDate(deal.items[0].subscription_end)}</dd>
					</div>
				{/if}
				{#if deal.lost_reason}<div class="col-span-2">
						<dt class="text-xs text-muted">Alasan penolakan</dt>
						<dd class="mt-1 text-ink">{deal.lost_reason}</dd>
					</div>{/if}
			</dl>
			<div class="mt-3 space-y-2">
				{#if canScheduleFollowUp}
					<Button full onclick={() => void openMeetingModal()} disabled={savingNote || meetingLoading}>
						Jadwalkan Meeting Lanjutan
					</Button>
				{:else if canEdit}
					<p class="text-xs text-muted">
						Meeting lanjutan hanya bisa dijadwalkan jika deal memiliki PIC aktif.
					</p>
				{/if}
				{#if canEdit}
					<Button variant="secondary" full onclick={onedit} disabled={savingNote || meetingLoading}
						>Edit deal</Button
					>
				{/if}
			</div>
		</section>

		<section class="min-w-0 border-t border-line pt-5 md:border-t-0 md:border-l md:pt-0 md:pl-5">
			<div class="mb-4 flex items-center justify-between">
				<h4 class="font-semibold text-ink">Riwayat</h4>
				<Button size="sm" variant="ghost" onclick={() => void loadActivities()} disabled={loading}
					>Muat ulang</Button
				>
			</div>
			{#if canEdit}
				<form
					class="mb-5 rounded-xl border border-line p-3"
					onsubmit={(e) => {
						e.preventDefault();
						void addNote();
					}}
				>
					<Textarea
						label="Catatan Internal"
						placeholder="Contoh: Client meminta diskon 10%"
						maxlength={500}
						bind:value={note}
					/>
					<div class="mt-2 flex justify-end">
						<Button type="submit" size="sm" loading={savingNote} disabled={!note.trim()}
							>Simpan Catatan</Button
						>
					</div>
				</form>
			{/if}
			{#if loading}<LoadingState />{:else if error}<p
					class="rounded-lg bg-red-50 p-3 text-sm text-red-700"
				>
					{error}
				</p>{:else if activities.length === 0}<p class="py-8 text-center text-sm text-muted">
					Belum ada riwayat aktivitas.
				</p>{:else}<DealActivityTimeline {activities} {products} />{/if}
		</section>
	</div>
</Modal>

{#if showMeetingModal && meetingContact}
	<MeetingModal
		contact={meetingContact}
		pipelineStatus={deal.pipeline_status}
		isFollowUp={true}
		onclose={() => {
			showMeetingModal = false;
			meetingContact = null;
		}}
		onsaved={meetingSaved}
	/>
{/if}
