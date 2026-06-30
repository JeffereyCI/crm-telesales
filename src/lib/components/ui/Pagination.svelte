<!-- Kontrol pagination (pakai nomor halaman — backend mendukung page/limit). -->
<script lang="ts">
	import Icon from './Icon.svelte';

	interface Props {
		page: number;
		totalPages: number;
		totalItems: number;
		onpage: (page: number) => void;
	}
	let { page, totalPages, totalItems, onpage }: Props = $props();

	const canPrev = $derived(page > 1);
	const canNext = $derived(page < totalPages);
</script>

{#if totalItems > 0}
	<div class="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm">
		<p class="text-muted">
			Halaman <span class="font-medium text-ink-soft">{page}</span> dari {totalPages} ·
			{totalItems} data
		</p>
		<div class="flex items-center gap-1">
			<button
				type="button"
				class="flex h-8 items-center gap-1 rounded-lg border border-line-strong px-2.5 text-muted hover:bg-surface-3 disabled:opacity-40"
				disabled={!canPrev}
				onclick={() => canPrev && onpage(page - 1)}
			>
				<Icon name="chevron-right" size={16} class="rotate-180" /> Sebelumnya
			</button>
			<button
				type="button"
				class="flex h-8 items-center gap-1 rounded-lg border border-line-strong px-2.5 text-muted hover:bg-surface-3 disabled:opacity-40"
				disabled={!canNext}
				onclick={() => canNext && onpage(page + 1)}
			>
				Berikutnya <Icon name="chevron-right" size={16} />
			</button>
		</div>
	</div>
{/if}
