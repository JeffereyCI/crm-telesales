<!-- Indikator loading terpusat untuk area konten. -->
<script lang="ts">
	import Icon from './Icon.svelte';
	interface Props {
		label?: string;
	}
	let { label = 'Memuat…' }: Props = $props();
</script>

<div class="flex flex-col items-center justify-center gap-2 px-6 py-14 text-muted">
	<Icon name="loader-2" size={28} class="animate-spin" />
	<p class="text-sm">{label}</p>
</div>
