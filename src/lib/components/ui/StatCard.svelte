<!-- Kartu metrik ringkas untuk dashboard. -->
<script lang="ts">
	import Icon from './Icon.svelte';

	interface Props {
		label: string;
		value: string | number;
		icon?: string;
		tone?: string; // kelas warna untuk ikon, mis. "bg-indigo-50 text-indigo-600"
		hint?: string;
	}
	let { label, value, icon, tone = 'bg-surface-3 text-muted', hint = '' }: Props = $props();
</script>

<div class="rounded-xl border border-line bg-surface p-5">
	<div class="flex items-start justify-between">
		<div>
			<p class="text-sm text-muted">{label}</p>
			<p class="mt-1 text-2xl font-semibold text-ink">{value}</p>
			{#if hint}<p class="mt-0.5 text-xs text-subtle">{hint}</p>{/if}
		</div>
		{#if icon}
			<span class="flex h-9 w-9 items-center justify-center rounded-lg {tone}">
				<Icon name={icon} size={18} />
			</span>
		{/if}
	</div>
</div>
