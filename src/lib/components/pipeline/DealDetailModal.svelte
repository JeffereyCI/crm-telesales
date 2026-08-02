<script lang="ts">
	import { dealsApi, formatCurrency, formatDate, toMessage } from '$lib';
	import { PIPELINE_PHASE_LABEL } from '$lib/constants/enums';
	import { toast } from '$lib/stores/toast.svelte';
	import type { DealActivityResponse, DealResponse } from '$lib/types/api';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import LoadingState from '$lib/components/ui/LoadingState.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import DealActivityTimeline from './DealActivityTimeline.svelte';

	interface Props {
		deal: DealResponse;
		canEdit: boolean;
		onclose: () => void;
		onedit: () => void;
	}
	let { deal, canEdit, onclose, onedit }: Props = $props();
	let activities = $state<DealActivityResponse[]>([]);
	let loading = $state(true);
	let error = $state('');
	let note = $state('');
	let savingNote = $state(false);

	async function loadActivities() {
		loading = true;
		error = '';
		try {
			activities = await dealsApi.getActivities(deal.id);
		} catch (err) {
			error = toMessage(err);
		} finally {
			loading = false;
		}
	}

	async function addNote() {
		if (!note.trim()) return;
		savingNote = true;
		try {
			await dealsApi.addNote(deal.id, note.trim());
			note = '';
			toast.success('Catatan internal ditambahkan.');
			await loadActivities();
		} catch (err) {
			toast.error(toMessage(err));
		} finally {
			savingNote = false;
		}
	}

	$effect(() => {
		void loadActivities();
	});
</script>

<Modal title="Detail Deal" size="lg" {onclose}>
	<div class="grid gap-5 md:grid-cols-[0.8fr_1.2fr]">
		<section>
			<p class="text-lg font-semibold text-ink">{deal.name}</p>
			<p class="text-sm text-muted">{deal.company.name}</p>
			<dl
				class="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-line bg-surface-2 p-4 text-sm"
			>
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
					<dd class="mt-1 font-medium text-ink">{deal.product?.name ?? '-'}</dd>
				</div>
				<div>
					<dt class="text-xs text-muted">Tipe Deal</dt>
					<dd class="mt-1 font-medium text-ink capitalize">
						{deal.deal_type?.replace('_', ' ') || '-'}
					</dd>
				</div>
				<div class="col-span-2">
					<dt class="text-xs text-muted">Langganan berakhir</dt>
					<dd class="mt-1 font-medium text-ink">{formatDate(deal.subscription_end)}</dd>
				</div>
				{#if deal.lost_reason}<div class="col-span-2">
						<dt class="text-xs text-muted">Alasan penolakan</dt>
						<dd class="mt-1 text-ink">{deal.lost_reason}</dd>
					</div>{/if}
			</dl>
			{#if canEdit}
				<Button variant="secondary" full class="mt-3" onclick={onedit}>Edit deal</Button>
			{/if}
		</section>

		<section class="min-w-0 border-t border-line pt-5 md:border-t-0 md:border-l md:pt-0 md:pl-5">
			<div class="mb-4 flex items-center justify-between">
				<h4 class="font-semibold text-ink">Riwayat</h4>
				<Button size="sm" variant="ghost" onclick={loadActivities} disabled={loading}
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
				</p>{:else}<DealActivityTimeline {activities} />{/if}
		</section>
	</div>
</Modal>
