<!--
  Bar chart horizontal sederhana — zero dependency (Tailwind + div).
  Bereaksi otomatis terhadap perubahan `data` (Svelte runes).
-->
<script lang="ts">
	interface Bar {
		label: string;
		value: number;
		tone?: string; // kelas warna bar, mis. "bg-indigo-500"
	}
	interface Props {
		data: Bar[];
		emptyLabel?: string;
	}
	let { data, emptyLabel = 'Belum ada data' }: Props = $props();

	const max = $derived(Math.max(1, ...data.map((d) => d.value)));
	const hasData = $derived(data.some((d) => d.value > 0));
</script>

{#if !hasData}
	<p class="py-8 text-center text-sm text-subtle">{emptyLabel}</p>
{:else}
	<div class="space-y-3">
		{#each data as bar (bar.label)}
			<div>
				<div class="mb-1 flex items-center justify-between text-xs">
					<span class="text-muted">{bar.label}</span>
					<span class="font-medium text-ink-soft">{bar.value}</span>
				</div>
				<div class="h-2.5 w-full overflow-hidden rounded-full bg-surface-3">
					<div
						class="h-full rounded-full transition-all duration-500 {bar.tone ?? 'bg-brand'}"
						style="width: {(bar.value / max) * 100}%"
					></div>
				</div>
			</div>
		{/each}
	</div>
{/if}
