<!--
  Edit Deal (BDM only). Ubah tahap pipeline, deal_type, dan catatan.
  Produk & nominal diedit via items[] — perlu UX tersendiri di luar modal ini.
  Memindah tahap ke `win`/`lost` harus melalui TerminalDealModal (data wajib).
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { dealsApi, toMessage } from '$lib';
	import { toast } from '$lib/stores/toast.svelte';
	import { PIPELINE_PHASES, PIPELINE_PHASE_LABEL } from '$lib/constants/enums';
	import type { DealResponse } from '$lib/types/api';
	import type { PipelinePhase } from '$lib/constants/enums';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Select from '$lib/components/ui/Select.svelte';

	interface Props {
		deal: DealResponse;
		onclose: () => void;
		onclosed?: () => void;
		onsaved: () => void;
	}
	let { deal, onclose, onclosed, onsaved }: Props = $props();

	// Snapshot non-reaktif: modal di-mount ulang tiap dibuka (keyed parent).
	const initial = untrack(() => deal);
	let stage = $state<PipelinePhase>(initial.pipeline_status as PipelinePhase);
	let dealType = $state(initial.deal_type);
	let saving = $state(false);

	// Status terminal (win/lost) harus melalui TerminalDealModal yang meminta data wajib.
	const stageOptions = PIPELINE_PHASES.filter(
		(s) => (s !== 'win' && s !== 'lost') || s === initial.pipeline_status
	).map((s) => ({ value: s, label: PIPELINE_PHASE_LABEL[s] }));

	const dealTypeOptions = [
		{ value: 'new', label: 'New' },
		{ value: 'upsell', label: 'Upsell' },
		{ value: 'cross_sell', label: 'Cross-Sell' },
		{ value: 'renewal', label: 'Renewal' }
	];

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		saving = true;
		try {
			await dealsApi.updateDeal(deal.id, {
				expected_version: deal.version,
				pipeline_status: stage !== initial.pipeline_status ? stage : undefined,
				deal_type: dealType !== initial.deal_type ? dealType as 'new' | 'upsell' | 'cross_sell' | 'renewal' : undefined
			});
			toast.success('Deal berhasil diperbarui.');
			onsaved();
		} catch (err) {
			toast.error(toMessage(err));
		} finally {
			saving = false;
		}
	}
</script>

<Modal title="Edit Deal" onclose={saving ? undefined : onclose} {onclosed}>
	<form id="deal-form" onsubmit={handleSubmit} class="space-y-4">
		<div class="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm">
			<p class="font-medium text-ink">{deal.name}</p>
			<p class="text-xs text-muted">{deal.company.name}</p>
		</div>

		<Select label="Tahap Pipeline" bind:value={stage} options={stageOptions} required />
		<Select label="Tipe Deal" bind:value={dealType} options={dealTypeOptions} required />

		<p class="text-xs text-muted">
			Untuk mengubah produk atau nominal, gunakan fitur edit items di halaman detail deal.
		</p>
	</form>

	{#snippet footer()}
		<button
			type="button"
			class="inline-flex h-10 items-center justify-center rounded-lg border border-line-strong bg-surface px-4 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-60"
			onclick={onclose}
			disabled={saving}
		>
			Batal
		</button>
		<button
			type="submit"
			form="deal-form"
			class="inline-flex h-10 items-center justify-center rounded-lg bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
			disabled={saving}
		>
			{saving ? 'Menyimpan...' : 'Simpan'}
		</button>
	{/snippet}
</Modal>
