<!--
  Edit Deal (BDM only). Ubah produk, nilai (amount), dan tahap pipeline.
  Memindah tahap ke `win` akan membuat backend otomatis mengubah staging
  company menjadi `customer` (transaksi ACID di sisi server).
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { dealsApi, validate, toMessage, formatCurrency } from '$lib';
	import { toast } from '$lib/stores/toast.svelte';
	import { PIPELINE_PHASES, PIPELINE_PHASE_LABEL } from '$lib/constants/enums';
	import type { DealResponse, ProductResponse } from '$lib/types/api';
	import type { PipelinePhase } from '$lib/constants/enums';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';
	import Select from '$lib/components/ui/Select.svelte';

	interface Props {
		deal: DealResponse;
		products: ProductResponse[];
		onclose: () => void;
		onclosed?: () => void;
		onsaved: () => void;
	}
	let { deal, products, onclose, onclosed, onsaved }: Props = $props();

	// Snapshot non-reaktif: modal di-mount ulang tiap dibuka (keyed parent).
	const initial = untrack(() => deal);
	let productId = $state(initial.product?.id ?? '');
	let amount = $state(String(initial.amount ?? 0));
	let stage = $state<PipelinePhase>(initial.pipeline_status);
	let amountError = $state('');
	let saving = $state(false);

	const productOptions = $derived(products.map((p) => ({ value: p.id, label: p.name })));
	// Status terminal harus melalui modal konfirmasi khusus yang meminta data wajib.
	const stageOptions = PIPELINE_PHASES.filter(
		(s) => (s !== 'win' && s !== 'lost') || s === initial.pipeline_status
	).map((s) => ({ value: s, label: PIPELINE_PHASE_LABEL[s] }));

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		amountError = validate.validateAmount(amount);
		if (amountError) return;

		saving = true;
		try {
			await dealsApi.updateDeal(deal.id, {
				product_id: productId || undefined,
				amount: amount.trim() ? Number(amount) : undefined,
				pipeline_status: stage
			});
			toast.success(
				stage === 'win'
					? 'Deal dimenangkan! Status perusahaan menjadi Customer.'
					: 'Deal berhasil diperbarui.'
			);
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

		<Select
			label="Produk"
			bind:value={productId}
			options={productOptions}
			placeholder={products.length ? 'Pilih produk' : 'Belum ada produk'}
		/>
		<TextField
			label="Nilai (Rp)"
			type="number"
			min="0"
			step="1000"
			bind:value={amount}
			error={amountError}
			hint={amount.trim() && !amountError ? formatCurrency(Number(amount)) : ''}
		/>
		<Select label="Tahap Pipeline" bind:value={stage} options={stageOptions} required />
	</form>

	{#snippet footer()}
		<Button variant="secondary" onclick={onclose} disabled={saving}>Batal</Button>
		<Button type="submit" form="deal-form" loading={saving}>Simpan</Button>
	{/snippet}
</Modal>
