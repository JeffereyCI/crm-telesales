<!--
  Grouped Bar Chart horizontal — membandingkan Pencapaian vs Target.
  Zero dependency (Tailwind + div).
-->
<script lang="ts">
	interface GroupedBar {
		label: string;
		value: number;  // Pencapaian
		target: number; // Target
		tone?: string;
		targetTone?: string;
	}
	interface Props {
		data: GroupedBar[];
		emptyLabel?: string;
	}
	let { data, emptyLabel = 'Belum ada data' }: Props = $props();

	// Temukan nilai maksimum dari target atau value untuk penskalaan bar
	const max = $derived(
		Math.max(1, ...data.map((d) => Math.max(d.value, d.target)))
	);
	const hasData = $derived(data.some((d) => d.value > 0 || d.target > 0));
</script>

{#if !hasData}
	<p class="py-8 text-center text-sm text-subtle">{emptyLabel}</p>
{:else}
	<div class="space-y-4">
		{#each data as bar (bar.label)}
			<div class="space-y-1">
				<div class="flex items-center justify-between text-xs">
					<span class="font-medium text-ink-soft">{bar.label}</span>
					<span class="text-muted">
						<span class="font-semibold text-ink-soft">{bar.value}</span> / {bar.target}
					</span>
				</div>
				
				<!-- Grouped bars -->
				<div class="space-y-1 rounded-lg bg-surface-3/30 p-2 border border-line/40">
					<!-- Bar Pencapaian -->
					<div>
						<div class="flex justify-between text-[9px] text-muted mb-0.5">
							<span>Pencapaian</span>
							<span>{Math.round((bar.value / Math.max(1, bar.target)) * 100)}%</span>
						</div>
						<div class="h-2 w-full overflow-hidden rounded-full bg-surface-3">
							<div
								class="h-full rounded-full transition-all duration-500 {bar.tone ?? 'bg-brand'}"
								style="width: {(bar.value / max) * 100}%"
							></div>
						</div>
					</div>
					
					<!-- Bar Target -->
					<div>
						<div class="text-[9px] text-muted mb-0.5">Target</div>
						<div class="h-2 w-full overflow-hidden rounded-full bg-surface-3">
							<div
								class="h-full rounded-full transition-all duration-500 {bar.targetTone ?? 'bg-muted/65'}"
								style="width: {(bar.target / max) * 100}%"
							></div>
						</div>
					</div>
				</div>
			</div>
		{/each}
	</div>
{/if}
