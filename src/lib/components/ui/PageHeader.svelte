<!-- Header halaman: judul + deskripsi + slot aksi (kanan). -->
<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		description?: string;
		actions?: Snippet;
	}
	let { title, description = '', actions }: Props = $props();
</script>

<div class="mb-6 flex flex-wrap items-end justify-between gap-3 pt-6 sm:pt-8 lg:pt-9">
	<div>
		<h1 class="text-xl font-semibold text-ink">{title}</h1>
		{#if description}
			<p class="mt-1 text-sm text-muted">{description}</p>
		{/if}
	</div>
	{#if actions}
		<div class="flex items-center gap-2">{@render actions()}</div>
	{/if}
</div>
