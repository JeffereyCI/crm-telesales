<!--
  Dialog modal. Dirender kondisional oleh parent ({#if open}).
  Tutup via tombol X, klik backdrop, atau Escape.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import Icon from './Icon.svelte';

	type Size = 'sm' | 'md' | 'lg';
	interface Props {
		title: string;
		onclose?: () => void;
		size?: Size;
		children: Snippet;
		footer?: Snippet;
	}
	let { title, onclose, size = 'md', children, footer }: Props = $props();

	const widths: Record<Size, string> = {
		sm: 'max-w-sm',
		md: 'max-w-lg',
		lg: 'max-w-2xl'
	};

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose?.();
	}
</script>

<svelte:window {onkeydown} />

<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
	<button
		class="absolute inset-0 bg-slate-900/50"
		aria-label="Tutup dialog"
		onclick={onclose}
		transition:fade={{ duration: 150 }}
	></button>

	<div
		role="dialog"
		aria-modal="true"
		aria-label={title}
		transition:scale={{ duration: 150, start: 0.96 }}
		class="relative z-10 flex max-h-[85vh] w-full bg-surface {widths[
			size
		]} flex-col rounded-2xl shadow-xl"
	>
		<header class="flex items-center justify-between border-b border-line px-5 py-3.5">
			<h3 class="text-base font-semibold text-ink">{title}</h3>
			<button
				type="button"
				class="rounded-lg p-1.5 text-subtle hover:bg-surface-3 hover:text-ink"
				aria-label="Tutup"
				onclick={onclose}
			>
				<Icon name="x" size={18} />
			</button>
		</header>

		<div class="flex-1 overflow-y-auto px-5 py-4">
			{@render children()}
		</div>

		{#if footer}
			<footer class="flex items-center justify-end gap-2 border-t border-line px-5 py-3.5">
				{@render footer()}
			</footer>
		{/if}
	</div>
</div>
