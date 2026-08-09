<script lang="ts">
	import { untrack } from 'svelte';
	import { ApiError, dealsApi, formatCurrency, toMessage } from '$lib';
	import { toast } from '$lib/stores/toast.svelte';
	import type { DealItem, DealResponse, ProductResponse } from '$lib/types/api';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';

	interface SubscriptionPeriodInput {
		item_id: string;
		product_name: string;
		subscription_start: string;
		subscription_end: string;
	}

	interface Props {
		deal: DealResponse;
		status: 'win' | 'lost';
		products?: ProductResponse[];
		onclose: () => void;
		onclosed?: () => void;
		onsaved: () => void;
	}

	let { deal, status, onclose, onclosed, onsaved }: Props = $props();

	const initial = untrack(() => deal);
	let currentDeal = $state<DealResponse>(initial);
	let lostReason = $state(initial.lost_reason ?? '');
	let subscriptionPeriods = $state<SubscriptionPeriodInput[]>([]);
	let formError = $state('');
	let saving = $state(false);
	const canConfirmWin = $derived(currentDeal.items.length > 0 && Number(currentDeal.amount) > 0);

	function asNumber(value: string | number | null | undefined) {
		return Number(value ?? 0);
	}

	function todayWIB() {
		const parts = new Intl.DateTimeFormat('en-CA', {
			timeZone: 'Asia/Jakarta',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit'
		}).formatToParts(new Date());
		const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
		const month = parts.find((part) => part.type === 'month')?.value ?? '01';
		const day = parts.find((part) => part.type === 'day')?.value ?? '01';
		return `${year}-${month}-${day}`;
	}

	function hydrateDeal(next: DealResponse) {
		const defaultStart = todayWIB();
		currentDeal = next;
		lostReason = next.lost_reason ?? '';
		subscriptionPeriods = next.items
			.filter((item) => item.billing_model === 'subscription')
			.map((item) => ({
				item_id: item.id,
				product_name: item.product_name,
				subscription_start: item.subscription_start ?? defaultStart,
				subscription_end: item.subscription_end ?? ''
			}));
		formError = '';
	}

	hydrateDeal(initial);

	function updateSubscriptionPeriod(itemId: string, patch: Partial<SubscriptionPeriodInput>) {
		subscriptionPeriods = subscriptionPeriods.map((period) =>
			period.item_id === itemId ? { ...period, ...patch } : period
		);
	}

	function validateWin() {
		if (currentDeal.pipeline_status === 'win' || currentDeal.pipeline_status === 'lost') {
			return 'Deal terminal tidak dapat diubah lagi.';
		}
		if (currentDeal.items.length === 0) {
			return 'Deal harus memiliki minimal satu item sebelum diubah menjadi Won.';
		}
		if (Number(currentDeal.amount) <= 0) {
			return 'Total deal harus lebih besar dari 0 sebelum diubah menjadi Won.';
		}
		for (const period of subscriptionPeriods) {
			if (!period.subscription_start || !period.subscription_end) {
				return `Periode subscription untuk ${period.product_name} wajib dilengkapi.`;
			}
			if (period.subscription_end < period.subscription_start) {
				return `Tanggal akhir subscription ${period.product_name} tidak boleh lebih awal dari tanggal mulai.`;
			}
		}
		return '';
	}

	function buildItemsPayload(items: DealItem[]) {
		const periodMap = new Map(subscriptionPeriods.map((period) => [period.item_id, period]));
		return items.map((item) => {
			const period = periodMap.get(item.id);
			return {
				id: item.id,
				product_id: item.product_id,
				quantity: item.quantity,
				unit_price: item.unit_price,
				discount_percent: item.discount_percent,
				subscription_start:
					item.billing_model === 'subscription'
						? period?.subscription_start || undefined
						: undefined,
				subscription_end:
					item.billing_model === 'subscription' ? period?.subscription_end || undefined : undefined
			};
		});
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		formError =
			status === 'win' ? validateWin() : !lostReason.trim() ? 'Alasan lost wajib diisi.' : '';
		if (formError) return;

		saving = true;
		try {
			await dealsApi.updateDeal(currentDeal.id, {
				expected_version: currentDeal.version,
				pipeline_status: status,
				...(status === 'win'
					? { items: buildItemsPayload(currentDeal.items) }
					: { lost_reason: lostReason.trim() })
			});
			toast.success(
				status === 'win' ? 'Deal berhasil dimenangkan.' : 'Deal ditandai sebagai Lost.'
			);
			onsaved();
		} catch (err) {
			if (err instanceof ApiError && err.status === 409) {
				try {
					const latest = await dealsApi.getDealDetail(currentDeal.id);
					hydrateDeal(latest);
					if (latest.pipeline_status === 'win' || latest.pipeline_status === 'lost') {
						toast.error('Deal sudah diubah pengguna lain dan kini terminal. Modal ditutup.');
						onclose();
						return;
					}
					formError = 'Deal berubah karena update lain. Data terbaru sudah dimuat.';
					return;
				} catch {
					// gunakan pesan backend asli bila refetch gagal
				}
			}
			formError = toMessage(err);
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
			<p class="font-medium text-ink">{currentDeal.name}</p>
			<p class="text-xs text-muted">{currentDeal.company.name}</p>
			<p class="mt-2 text-xs text-muted">
				Total final backend:
				<span class="font-medium text-ink">{formatCurrency(asNumber(currentDeal.amount))}</span>
			</p>
		</div>

		{#if status === 'win'}
			<div class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
				Deal yang sudah Won akan menjadi immutable. Pastikan item dan periode subscription sudah
				benar.
			</div>

			{#if currentDeal.items.length === 0}
				<div class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
					Deal ini belum memiliki item. Tambahkan product terlebih dahulu dari editor deal.
				</div>
			{/if}

			{#if Number(currentDeal.amount) <= 0}
				<div class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
					Total deal masih 0 atau negatif. Backend akan menolak perubahan ke Won.
				</div>
			{/if}

			<div class="space-y-3">
				{#each currentDeal.items as item (item.id)}
					<div class="rounded-xl border border-line p-4">
						<div class="flex flex-wrap items-start justify-between gap-3">
							<div>
								<p class="font-medium text-ink">{item.product_name}</p>
								<p class="mt-1 text-xs text-muted">
									{item.quantity} x {formatCurrency(asNumber(item.unit_price))}
									{#if Number(item.discount_percent) > 0}
										· Diskon {item.discount_percent}%
									{/if}
								</p>
							</div>
							<p class="text-sm font-semibold text-ink">
								{formatCurrency(asNumber(item.subtotal))}
							</p>
						</div>

						{#if item.billing_model === 'subscription'}
							{@const period = subscriptionPeriods.find((entry) => entry.item_id === item.id)}
							<div class="mt-4 grid gap-4 sm:grid-cols-2">
								<TextField
									label="Tanggal Mulai Subscription"
									type="date"
									value={period?.subscription_start ?? ''}
									oninput={(e) =>
										updateSubscriptionPeriod(item.id, {
											subscription_start: (e.currentTarget as HTMLInputElement).value
										})}
									required
								/>
								<TextField
									label="Tanggal Akhir Subscription"
									type="date"
									value={period?.subscription_end ?? ''}
									oninput={(e) =>
										updateSubscriptionPeriod(item.id, {
											subscription_end: (e.currentTarget as HTMLInputElement).value
										})}
									required
								/>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{:else}
			<Textarea
				label="Alasan Penolakan"
				placeholder="Jelaskan alasan deal tidak berhasil ditutup"
				maxlength={500}
				bind:value={lostReason}
				required
			/>
		{/if}

		{#if formError}
			<p class="text-sm text-brand">{formError}</p>
		{/if}
	</form>

	{#snippet footer()}
		<Button variant="secondary" onclick={onclose} disabled={saving}>Batal</Button>
		<Button
			type="submit"
			form="terminal-deal-form"
			variant={status === 'win' ? 'positive' : 'danger'}
			loading={saving}
			disabled={status === 'win' ? !canConfirmWin : !lostReason.trim()}
		>
			{status === 'win' ? 'Konfirmasi Won' : 'Konfirmasi Lost'}
		</Button>
	{/snippet}
</Modal>
