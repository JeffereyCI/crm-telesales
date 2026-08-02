<script lang="ts">
	import { untrack } from 'svelte';
	import { dealsApi, formatCurrency, toMessage, validate } from '$lib';
	import { toast } from '$lib/stores/toast.svelte';
	import type { DealResponse, ProductResponse } from '$lib/types/api';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';

	interface Props {
		deal: DealResponse;
		status: 'win' | 'lost';
		products: ProductResponse[];
		onclose: () => void;
		onsaved: () => void;
	}
	let { deal, status, products, onclose, onsaved }: Props = $props();
	const initial = untrack(() => deal);
	let productId = $state(initial.product?.id ?? '');
	let amount = $state(initial.amount > 0 ? String(initial.amount) : '');
	let subscriptionEnd = $state(initial.subscription_end ?? '');
	let lostReason = $state(initial.lost_reason ?? '');
	let amountError = $state('');
	let saving = $state(false);
	const productOptions = $derived(products.map((p) => ({ value: p.id, label: p.name })));

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		if (status === 'win') {
			amountError = validate.validateAmount(amount);
			if (!productId || !amount.trim() || Number(amount) <= 0 || amountError) return;
		} else if (!lostReason.trim()) return;

		saving = true;
		try {
			await dealsApi.updateDeal(deal.id, {
				pipeline_status: status,
				...(status === 'win'
					? {
							product_id: productId,
							amount: Number(amount),
							subscription_end: subscriptionEnd || undefined
						}
					: { lost_reason: lostReason.trim() })
			});
			toast.success(
				status === 'win' ? 'Deal berhasil dimenangkan.' : 'Deal ditandai sebagai Lost.'
			);
			onsaved();
		} catch (err) {
			toast.error(toMessage(err));
		} finally {
			saving = false;
		}
	}
</script>

<Modal
	title={status === 'win' ? 'Konfirmasi Deal Won' : 'Konfirmasi Deal Lost'}
	onclose={saving ? undefined : onclose}
>
	<form id="terminal-deal-form" class="space-y-4" onsubmit={submit}>
		<div class="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm">
			<p class="font-medium text-ink">{deal.name}</p>
			<p class="text-xs text-muted">{deal.company.name}</p>
		</div>
		{#if status === 'win'}
			<Select
				label="Produk"
				bind:value={productId}
				options={productOptions}
				placeholder="Pilih produk"
				required
			/>
			<TextField
				label="Harga Deal (Rp)"
				type="number"
				min="1"
				step="1000"
				bind:value={amount}
				error={amountError}
				hint={amount.trim() && !amountError ? formatCurrency(Number(amount)) : ''}
				required
			/>
			<TextField
				label="Tanggal Berakhir Langganan"
				type="date"
				bind:value={subscriptionEnd}
				hint="Isi jika produk memiliki masa langganan."
			/>
			<p
				class="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
			>
				Deal pertama kali Won otomatis dicatat sebagai tipe <strong>New</strong>.
			</p>
		{:else}
			<Textarea
				label="Alasan Penolakan"
				placeholder="Jelaskan alasan deal tidak berhasil ditutup"
				maxlength={500}
				bind:value={lostReason}
				required
			/>
		{/if}
	</form>
	{#snippet footer()}<Button variant="secondary" onclick={onclose} disabled={saving}>Batal</Button
		><Button
			type="submit"
			form="terminal-deal-form"
			variant={status === 'win' ? 'positive' : 'danger'}
			loading={saving}
			disabled={status === 'win'
				? !productId || !amount.trim() || Number(amount) <= 0
				: !lostReason.trim()}>{status === 'win' ? 'Konfirmasi Won' : 'Konfirmasi Lost'}</Button
		>{/snippet}
</Modal>
