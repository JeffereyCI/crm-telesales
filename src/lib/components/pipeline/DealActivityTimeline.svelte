<script lang="ts">
	import { formatDateTime } from '$lib';
	import { PIPELINE_PHASE_LABEL } from '$lib/constants/enums';
	import type { DealActivityResponse } from '$lib/types/api';
	import type { PipelinePhase } from '$lib/constants/enums';
	import Icon from '$lib/components/ui/Icon.svelte';

	let { activities }: { activities: DealActivityResponse[] } = $props();

	function phase(value?: string | null) {
		return value && value in PIPELINE_PHASE_LABEL
			? PIPELINE_PHASE_LABEL[value as PipelinePhase]
			: value || '-';
	}
	function title(activity: DealActivityResponse) {
		if (activity.action === 'note_added') return 'Catatan internal ditambahkan';
		if (activity.action === 'status_changed') {
			return `Status: ${phase(activity.old_value)} → ${phase(activity.new_value)}`;
		}
		if (activity.action === 'deal_updated') return 'Detail deal diperbarui';
		return activity.action.replaceAll('_', ' ');
	}
</script>

<ol class="relative">
	{#each activities as activity, index (activity.id)}
		<li class="relative flex gap-3 pb-5 last:pb-0">
			{#if index < activities.length - 1}
				<span class="absolute top-8 bottom-0 left-[15px] w-px bg-line" aria-hidden="true"></span>
			{/if}
			<span
				class="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full {activity.action ===
				'note_added'
					? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
					: activity.new_value === 'win'
						? 'bg-emerald-100 text-emerald-700'
						: activity.new_value === 'lost'
							? 'bg-red-100 text-red-700'
							: 'bg-blue-100 text-blue-700'}"
			>
				<Icon name={activity.action === 'note_added' ? 'message-circle' : 'clock'} size={15} />
			</span>
			<div class="min-w-0 flex-1">
				<p class="text-sm font-medium text-ink capitalize">{title(activity)}</p>
				<p class="mt-0.5 text-xs text-muted">
					{activity.user_name} · {formatDateTime(activity.created_at)}
				</p>
				{#if activity.notes}
					<p
						class="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-sm whitespace-pre-wrap text-ink-soft"
					>
						{activity.notes}
					</p>
				{/if}
			</div>
		</li>
	{/each}
</ol>
