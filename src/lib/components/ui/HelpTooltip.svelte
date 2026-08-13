<!-- Tooltip bantuan kontekstual berbentuk tanda tanya (?). -->
<script lang="ts">
	import Icon from './Icon.svelte';

	interface Props {
		text: string;
		position?: 'top' | 'bottom' | 'left' | 'right';
	}
	let { text, position = 'top' }: Props = $props();

	let visible = $state(false);

	const posStyles = {
		top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
		bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
		left: 'right-full top-1/2 -translate-y-1/2 mr-2',
		right: 'left-full top-1/2 -translate-y-1/2 ml-2'
	};
</script>

<div
	class="relative inline-flex items-center"
	role="none"
	onmouseenter={() => (visible = true)}
	onmouseleave={() => (visible = false)}
	onfocusin={() => (visible = true)}
	onfocusout={() => (visible = false)}
>
	<button
		type="button"
		class="text-muted hover:text-ink focus:outline-none transition-colors"
		aria-label="Bantuan"
	>
		<Icon name="help-circle" size={14} />
	</button>

	{#if visible}
		<div
			role="tooltip"
			class="absolute z-50 w-52 rounded-lg border border-line bg-surface p-2.5 text-[11px] font-normal leading-normal text-ink shadow-lg pointer-events-none transition-opacity {posStyles[position]}"
		>
			{text}
			<!-- Arrow -->
			<div class="absolute h-2 w-2 rotate-45 border-line bg-surface
				{position === 'top' ? 'top-full left-1/2 -translate-x-1/2 -translate-y-1 border-r border-b' : ''}
				{position === 'bottom' ? 'bottom-full left-1/2 -translate-x-1/2 translate-y-1 border-t border-l' : ''}
				{position === 'left' ? 'left-full top-1/2 -translate-y-1/2 -translate-x-1 border-t border-r' : ''}
				{position === 'right' ? 'right-full top-1/2 -translate-y-1/2 translate-x-1 border-b border-l' : ''}
			"></div>
		</div>
	{/if}
</div>
