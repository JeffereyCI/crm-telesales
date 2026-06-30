<!--
  Leaderboard performa telesales untuk monitoring BDM (poin 10).
  - Diurutkan berdasarkan metrik terpilih (default: konversi) menurun.
  - Peringkat #1 disorot (brand) + ikon award untuk menonjolkan top performer.
  - Bar relatif terhadap nilai tertinggi → mudah membandingkan antar-sales.
-->
<script lang="ts">
	import { formatPercent, formatNumber } from '$lib';
	import type { TelesalesPerformance } from '$lib/types/api';
	import Icon from '$lib/components/ui/Icon.svelte';

	type Metric = 'conversion_rate' | 'total_contacts' | 'meetings_scheduled' | 'sudah_dihubungi';

	interface Props {
		data: TelesalesPerformance[];
	}
	let { data }: Props = $props();

	const metricMeta: Record<Metric, { label: string; isPercent: boolean }> = {
		conversion_rate: { label: 'Konversi', isPercent: true },
		total_contacts: { label: 'Total Kontak', isPercent: false },
		meetings_scheduled: { label: 'Meeting', isPercent: false },
		sudah_dihubungi: { label: 'Dihubungi', isPercent: false }
	};

	let metric = $state<Metric>('conversion_rate');

	const ranked = $derived([...data].sort((a, b) => b[metric] - a[metric]));
	const max = $derived(Math.max(1, ...ranked.map((r) => r[metric])));

	function display(v: number): string {
		return metricMeta[metric].isPercent ? formatPercent(v) : formatNumber(v);
	}
</script>

<div class="mb-4 flex items-center justify-between gap-3">
	<h2 class="text-sm font-semibold text-ink-soft">Peringkat Performa Telesales</h2>
	<select
		bind:value={metric}
		class="h-8 rounded-lg border border-line-strong bg-surface px-2 text-xs text-ink-soft focus:border-brand focus:outline-none"
		aria-label="Urutkan berdasarkan"
	>
		{#each Object.entries(metricMeta) as [val, meta] (val)}
			<option value={val}>Urut: {meta.label}</option>
		{/each}
	</select>
</div>

{#if ranked.length === 0}
	<p class="py-8 text-center text-sm text-subtle">Belum ada data telesales.</p>
{:else}
	<ol class="space-y-2.5">
		{#each ranked as t, i (t.user.id)}
			{@const isTop = i === 0 && t[metric] > 0}
			<li
				class="flex items-center gap-3 rounded-lg border p-3 {isTop
					? 'border-brand/40 bg-brand-soft'
					: 'border-line bg-surface-2'}"
			>
				<div
					class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold {isTop
						? 'bg-brand text-white'
						: 'bg-surface-3 text-muted'}"
				>
					{#if isTop}
						<Icon name="award" size={16} />
					{:else}
						{i + 1}
					{/if}
				</div>
				<div class="min-w-0 flex-1">
					<div class="flex items-center justify-between gap-2">
						<p class="truncate text-sm font-medium text-ink">
							{t.user.name}
							{#if isTop}<span class="ml-1 text-xs font-semibold text-brand">· Teratas</span>{/if}
						</p>
						<p class="shrink-0 text-sm font-semibold text-ink-soft tabular-nums">
							{display(t[metric])}
						</p>
					</div>
					<div class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
						<div
							class="h-full rounded-full transition-all duration-500 {isTop
								? 'bg-brand'
								: 'bg-positive'}"
							style="width: {(t[metric] / max) * 100}%"
						></div>
					</div>
					<div class="mt-1 flex gap-3 text-[11px] text-subtle">
						<span>{formatNumber(t.total_contacts)} kontak</span>
						<span>{formatNumber(t.sudah_dihubungi)} dihubungi</span>
						<span>{formatNumber(t.meetings_scheduled)} meeting</span>
						<span>{formatPercent(t.conversion_rate)} konversi</span>
					</div>
				</div>
			</li>
		{/each}
	</ol>
{/if}
