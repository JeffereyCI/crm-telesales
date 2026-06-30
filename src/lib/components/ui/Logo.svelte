<!--
  Logo — gunakan gambar ohrm_logo.png.
  Prop `compact` → hanya icon (sidebar diciutkan), expanded → icon + teks nama klien.
-->
<script lang="ts">
	interface Props {
		compact?: boolean;
		size?: number;
		class?: string;
	}
	let { compact = false, size = 32, class: cls = '' }: Props = $props();
</script>

<span class="inline-flex items-center gap-2.5 {cls}">
	<img
		src="/ohrm_logo.png"
		alt="Eclectic Consulting"
		width={size}
		height={size}
		class="shrink-0 object-contain"
	/>
	{#if !compact}
		<span class="text-base font-semibold tracking-tight text-ink">Eclectic Consulting</span>
	{/if}
</span>
