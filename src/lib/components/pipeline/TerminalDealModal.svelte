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
		onclosed?: () => void;
		onsaved: () => void;
	}
	let { deal, status, products, onclose, onclosed, onsaved }: Props = $props();
	const initial = untrack(() => deal);
	let productId = $state(initial.items[0]?.product_id ?? '');
	let amount = $state(Number(initial.amount) > 0 ? String(initial.amount) : '');
	let subscriptionEnd = $state(initial.items[0]?.subscription_end ?? '');
	let lostReason = $state(initial.lost_reason ?? '');
	let amountError = $state('');
	let subscriptionEndError = $state('');
	let saving = $state(false);
	const productOptions = $derived(products.map((p) => ({ value: p.id, label: p.name })));
	const selectedProduct = $derived(products.find((p) => p.id === productId) ?? null);
	const requiresSubscriptionEnd = $derived(selectedProduct?.billing_model === 'subscription');
	const amountText = $derived(amount == null ? '' : String(amount));
	const amountNumber = $derived(amountText.trim() ? Number(amountText) : NaN);

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		if (status === 'win') {
			amountError = validate.validateAmount(amount);
			subscriptionEndError =
				requiresSubscriptionEnd && !subscriptionEnd
					? 'Tanggal berakhir langganan wajib untuk produk subscription.'
					: '';
			if (
				!productId ||
				!amountText.trim() ||
				amountNumber <= 0 ||
				amountError ||
				subscriptionEndError
			)
				return;
		} else if (!lostReason.trim()) return;

		saving = true;
		try {
			await dealsApi.updateDeal(deal.id, {
				expected_version: deal.version,
				pipeline_status: status,
				...(status === 'win'
					? {
							items: [
								{
									id: initial.items[0]?.id,
									product_id: productId,
									quantity: '1',
									unit_price: String(amountNumber),
									discount_percent: '0',
									subscription_end: requiresSubscriptionEnd ? subscriptionEnd : undefined
								}
							]
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
	{onclosed}
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
				hint={amountText.trim() && !amountError ? formatCurrency(amountNumber) : ''}
				required
			/>
			<TextField
				label="Tanggal Berakhir Langganan"
				type="date"
				bind:value={subscriptionEnd}
				error={subscriptionEndError}
				hint={requiresSubscriptionEnd ? 'Wajib untuk produk subscription.' : 'Hanya relevan untuk produk subscription.'}
				disabled={!requiresSubscriptionEnd}
				required={requiresSubscriptionEnd}
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
					? !productId ||
						!amountText.trim() ||
						amountNumber <= 0 ||
						(requiresSubscriptionEnd && !subscriptionEnd)
					: !lostReason.trim()}
				>{status === 'win' ? 'Konfirmasi Won' : 'Konfirmasi Lost'}</Button
			>{/snippet}
</Modal>
