<!-- Container toast (fixed kanan-bawah). Pasang sekali di root layout. -->
<script lang="ts">
	import { fly } from 'svelte/transition';
	import { toast } from '$lib/stores/toast.svelte';
	import Icon from './Icon.svelte';

	const styles = {
		success: {
			box: 'border-emerald-200 bg-surface text-emerald-700 dark:border-emerald-900/60 dark:text-emerald-300',
			icon: 'check-circle'
		},
		error: {
			box: 'border-red-200 bg-surface text-red-700 dark:border-red-900/60 dark:text-red-300',
			icon: 'alert-circle'
		},
		info: {
			box: 'border-sky-200 bg-surface text-sky-700 dark:border-sky-900/60 dark:text-sky-300',
			icon: 'info'
		}
	} as const;
</script>

<div class="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-full max-w-sm flex-col gap-2">
	{#each toast.items as item (item.id)}
		<div
			transition:fly={{ y: 12, duration: 200 }}
			class="pointer-events-auto flex items-start gap-2.5 rounded-lg border px-3.5 py-3 shadow-lg {styles[
				item.type
			].box}"
			role="status"
		>
			<Icon name={styles[item.type].icon} size={18} class="mt-0.5 shrink-0" />
			<p class="flex-1 text-sm leading-snug">{item.message}</p>
			<button
				type="button"
				class="shrink-0 text-subtle hover:text-ink"
				aria-label="Tutup"
				onclick={() => toast.dismiss(item.id)}
			>
				<Icon name="x" size={16} />
			</button>
		</div>
	{/each}
</div>
