<script lang="ts">
	import { formatDate, formatDateTime } from '$lib';
	import type { ImplementationActivityResponse } from '$lib/types/api';
	import Icon from '$lib/components/ui/Icon.svelte';

	let { activities }: { activities: ImplementationActivityResponse[] } = $props();

	function fieldLabel(value?: string | null) {
		switch (value) {
			case 'stage':
				return 'Stage';
			case 'delivery_status':
				return 'Status';
			case 'planned_start_date':
				return 'Planned Start';
			case 'actual_start_date':
				return 'Actual Start';
			case 'planned_go_live_date':
				return 'Planned Go-Live';
			case 'actual_go_live_date':
				return 'Actual Go-Live';
			case 'notes':
				return 'Notes';
			default:
				return value || 'Field';
		}
	}

	function value(field: string | null, raw: string | null) {
		if (!raw) return '-';
		if (field?.endsWith('_date')) return formatDate(raw);
		return raw;
	}
</script>

<ol class="relative">
	{#each activities as activity, index (activity.id)}
		<li class="relative flex gap-3 pb-5 last:pb-0">
			{#if index < activities.length - 1}
				<span class="absolute top-8 bottom-0 left-[15px] w-px bg-line" aria-hidden="true"></span>
			{/if}
			<span
				class="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full {activity.source ===
				'system'
					? 'bg-amber-100 text-amber-700'
					: 'bg-blue-100 text-blue-700'}"
			>
				<Icon name={activity.source === 'system' ? 'cpu' : 'history'} size={15} />
			</span>
			<div class="min-w-0 flex-1">
				<p class="text-sm font-medium text-ink">
					{activity.action === 'project_created'
						? 'Project dibuat'
						: fieldLabel(activity.field_name)}
				</p>
				<p class="mt-0.5 text-xs text-muted">
					{activity.actor?.name ?? 'System'} · {formatDateTime(activity.created_at)} · {activity.source}
				</p>
				{#if activity.action !== 'project_created'}
					<div class="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs">
						<span class="min-w-0 rounded-md bg-surface-2 px-2 py-1.5 break-words text-muted">
							{value(activity.field_name, activity.old_value)}
						</span>
						<Icon name="arrow-right" size={13} class="text-subtle" />
						<span
							class="min-w-0 rounded-md bg-surface-2 px-2 py-1.5 font-medium break-words text-ink"
						>
							{value(activity.field_name, activity.new_value)}
						</span>
					</div>
				{:else if activity.new_value}
					<p class="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink-soft">
						{activity.new_value}
					</p>
				{/if}
				{#if activity.change_reason}
					<p class="mt-2 text-xs text-muted">Alasan: {activity.change_reason}</p>
				{/if}
			</div>
		</li>
	{/each}
</ol>
