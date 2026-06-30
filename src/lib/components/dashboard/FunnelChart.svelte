<!--
  Funnel chart sederhana (zero-dep) untuk pipeline telesales.
  Tiap tahap memakai persentase terhadap tahap pertama (total), sehingga
  penyusutan pipeline langsung terlihat. Menampilkan nilai absolut + % konversi
  relatif terhadap tahap teratas.
-->
<script lang="ts">
	interface Stage {
		label: string;
		value: number;
		tone: string; // kelas bg untuk bar
	}
	interface Props {
		stages: Stage[];
		emptyLabel?: string;
	}
	let { stages, emptyLabel = 'Belum ada data' }: Props = $props();

	const base = $derived(stages.length ? Math.max(1, stages[0].value) : 1);
	const hasData = $derived(stages.some((s) => s.value > 0));
</script>

{#if !hasData}
	<p class="py-8 text-center text-sm text-subtle">{emptyLabel}</p>
{:else}
	<div class="space-y-2.5">
		{#each stages as stage, i (stage.label)}
			{@const pct = Math.round((stage.value / base) * 100)}
			{@const prev = i > 0 ? stages[i - 1].value : 0}
			{@const step = i > 0 ? Math.round((stage.value / Math.max(1, prev)) * 100) : 0}
			<div>
				<div class="mb-1 flex items-center justify-between text-xs">
					<span class="text-muted">{stage.label}</span>
					<span class="font-medium text-ink-soft tabular-nums">
						{stage.value}
						{#if i > 0}<span class="ml-1 text-subtle">({pct}% total)</span>{/if}
					</span>
				</div>
				<div class="h-6 w-full overflow-hidden rounded-md bg-surface-3">
					<div
						class="flex h-full items-center justify-end rounded-md px-2 text-[10px] font-semibold text-white transition-all duration-500 {stage.tone}"
						style="width: {Math.max(pct, 4)}%"
					></div>
				</div>
				{#if i > 0}
					<p class="mt-1 text-[11px] text-subtle tabular-nums">
						↳ {step}% lanjut dari "{stages[i - 1].label}"
					</p>
				{/if}
			</div>
		{/each}
	</div>
{/if}
