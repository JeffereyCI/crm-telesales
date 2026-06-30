<!-- Banner notifikasi inline (error / sukses / info / peringatan). -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	type Variant = 'error' | 'success' | 'info' | 'warning';

	interface Props {
		variant?: Variant;
		children: Snippet;
	}
	let { variant = 'info', children }: Props = $props();

	const styles: Record<Variant, { box: string; icon: string }> = {
		error: {
			box: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300',
			icon: 'alert-circle'
		},
		success: {
			box: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300',
			icon: 'check-circle'
		},
		info: {
			box: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300',
			icon: 'info'
		},
		warning: {
			box: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300',
			icon: 'alert-circle'
		}
	};
</script>

<div class="flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm {styles[variant].box}">
	<Icon name={styles[variant].icon} size={18} class="mt-0.5 shrink-0" />
	<div class="leading-relaxed">{@render children()}</div>
</div>
