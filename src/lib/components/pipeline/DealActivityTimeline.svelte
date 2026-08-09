<script lang="ts">
	import { formatCurrency, formatDate, formatDateTime } from '$lib';
	import { PIPELINE_PHASE_LABEL } from '$lib/constants/enums';
	import type { DealActivityResponse, ProductResponse } from '$lib/types/api';
	import type { PipelinePhase } from '$lib/constants/enums';
	import Icon from '$lib/components/ui/Icon.svelte';

	let {
		activities,
		products = []
	}: { activities: DealActivityResponse[]; products?: ProductResponse[] } = $props();

	function phase(value?: string | null) {
		return value && value in PIPELINE_PHASE_LABEL
			? PIPELINE_PHASE_LABEL[value as PipelinePhase]
			: value || '-';
	}
	function title(activity: DealActivityResponse) {
		if (activity.action === 'note_added') return 'Catatan internal ditambahkan';
		if (activity.action === 'status_changed') return 'Status deal diubah';
		if (activity.action === 'pipeline_status_changed') return 'Status deal diubah';
		if (activity.action === 'amount_changed') return 'Harga deal diubah';
		if (activity.action === 'product_changed') return 'Produk deal diubah';
		if (activity.action === 'contact_changed') return 'Kontak deal diubah';
		if (activity.action === 'deal_type_changed') return 'Tipe deal diubah';
		if (activity.action === 'subscription_end_changed') return 'Tanggal berakhir langganan diubah';
		if (activity.action === 'lost_reason_changed') return 'Alasan penolakan diubah';
		if (activity.action === 'notes_changed') return 'Catatan deal diubah';
		if (activity.action === 'item_added') return 'Produk ditambahkan';
		if (activity.action === 'item_updated') return 'Produk diperbarui';
		if (activity.action === 'item_removed') return 'Produk dihapus';
		return activity.action.replaceAll('_', ' ');
	}

	function itemValue(raw?: string | null) {
		if (!raw) return '-';
		const [productCode, quantity, unitPrice, discountPercent, subtotal, start, end] = raw.split('|');
		const productLabel = products.find((item) => item.code === productCode)?.name ?? productCode;
		const chunks = [
			productLabel ? `Produk ${productLabel}` : null,
			quantity ? `Qty ${quantity}` : null,
			unitPrice ? formatCurrency(Number(unitPrice)) : null,
			discountPercent ? `Diskon ${discountPercent}%` : null,
			subtotal ? `Subtotal ${formatCurrency(Number(subtotal))}` : null,
			start ? `Mulai ${formatDate(start)}` : null,
			end ? `Berakhir ${formatDate(end)}` : null
		].filter(Boolean);
		return chunks.join(' · ') || raw;
	}

	function value(activity: DealActivityResponse, raw?: string | null) {
		switch (activity.action) {
			case 'status_changed':
			case 'pipeline_status_changed':
				return phase(raw);
			case 'amount_changed':
				return raw ? formatCurrency(Number(raw)) : '-';
			case 'product_changed':
				return raw ? (products.find((item) => item.id === raw)?.name ?? raw) : '-';
			case 'deal_type_changed':
				return raw ? raw.replaceAll('_', ' ') : '-';
			case 'subscription_end_changed':
				return raw ? formatDate(raw) : '-';
			case 'item_added':
			case 'item_updated':
			case 'item_removed':
				return itemValue(raw);
			default:
				return raw || '-';
		}
	}

	function hasChange(activity: DealActivityResponse) {
		return (
			activity.action !== 'note_added' &&
			(activity.old_value !== undefined || activity.new_value !== undefined)
		);
	}
</script>

<ol class="relative">
	{#each activities as activity, index (activity.id)}
		<li class="relative flex gap-3 pb-5 last:pb-0">
			{#if index < activities.length - 1}
				<span class="absolute top-8 bottom-0 left-[15px] w-px bg-line" aria-hidden="true"></span>
			{/if}
			<span
				class="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full {activity.action ===
				'note_added'
					? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
					: activity.new_value === 'win'
						? 'bg-emerald-100 text-emerald-700'
						: activity.new_value === 'lost'
							? 'bg-red-100 text-red-700'
							: 'bg-blue-100 text-blue-700'}"
			>
				<Icon name={activity.action === 'note_added' ? 'message-circle' : 'clock'} size={15} />
			</span>
			<div class="min-w-0 flex-1">
				<p class="text-sm font-medium text-ink capitalize">{title(activity)}</p>
				<p class="mt-0.5 text-xs text-muted">
					{activity.user_name} · {formatDateTime(activity.created_at)}
				</p>
				{#if activity.notes}
					<p
						class="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-sm whitespace-pre-wrap text-ink-soft"
					>
						{activity.notes}
					</p>
				{/if}
				{#if hasChange(activity)}
					<div class="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs">
						<span class="min-w-0 rounded-md bg-surface-2 px-2 py-1.5 break-words text-muted"
							>{value(activity, activity.old_value)}</span
						>
						<Icon name="arrow-right" size={13} class="text-subtle" />
						<span
							class="min-w-0 rounded-md bg-surface-2 px-2 py-1.5 font-medium break-words text-ink"
							>{value(activity, activity.new_value)}</span
						>
					</div>
				{/if}
			</div>
		</li>
	{/each}
</ol>
