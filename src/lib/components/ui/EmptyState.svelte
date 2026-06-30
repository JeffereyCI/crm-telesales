<!-- State kosong (tidak ada data / hasil filter kosong). -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	interface Props {
		icon?: string;
		title: string;
		description?: string;
		action?: Snippet;
	}
	let { icon = 'info', title, description = '', action }: Props = $props();
</script>

<div class="flex flex-col items-center justify-center px-6 py-14 text-center">
	<div
		class="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-3 text-subtle"
	>
		<Icon name={icon} size={24} />
	</div>
	<p class="text-sm font-medium text-ink-soft">{title}</p>
	{#if description}
		<p class="mt-1 max-w-sm text-sm text-muted">{description}</p>
	{/if}
	{#if action}
		<div class="mt-4">{@render action()}</div>
	{/if}
</div>
