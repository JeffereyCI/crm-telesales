<!-- Badge status. `tone` = kelas Tailwind (mis. dari *_BADGE di enums.ts). -->
<script lang="ts">
	interface Props {
		label: string;
		tone?: string;
	}
	let { label, tone = 'bg-surface-3 text-muted' }: Props = $props();
</script>

<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {tone}">
	{label}
</span>
