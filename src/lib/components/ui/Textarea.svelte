<!-- Textarea + label + error + penghitung karakter (bila maxlength diberi). -->
<script lang="ts">
	import type { HTMLTextareaAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLTextareaAttributes, 'value'> {
		label?: string;
		value?: string;
		error?: string;
		hint?: string;
		maxlength?: number;
	}

	let {
		label = '',
		value = $bindable(''),
		error = '',
		hint = '',
		maxlength,
		rows = 3,
		id,
		required = false,
		class: cls = '',
		...rest
	}: Props = $props();

	const generatedId = `t-${Math.random().toString(36).slice(2, 9)}`;
	const fieldId = $derived(id ?? generatedId);
	const count = $derived(value?.length ?? 0);
</script>

<div class="flex flex-col gap-1.5">
	{#if label}
		<label for={fieldId} class="text-sm font-medium text-ink-soft">
			{label}
			{#if required}<span class="text-brand">*</span>{/if}
		</label>
	{/if}

	<textarea
		id={fieldId}
		bind:value
		{rows}
		{maxlength}
		{required}
		aria-invalid={error ? 'true' : undefined}
		class="w-full resize-y rounded-lg border bg-surface px-3 py-2 text-sm text-ink placeholder:text-subtle focus:ring-2 focus:outline-none {error
			? 'border-brand focus:border-brand focus:ring-brand/30'
			: 'border-line-strong focus:border-brand focus:ring-brand/25'} {cls}"
		{...rest}
	></textarea>

	<div class="flex items-start justify-between gap-2">
		<p class="text-xs {error ? 'text-brand' : 'text-muted'}">{error || hint}</p>
		{#if maxlength}
			<span
				class="shrink-0 text-xs tabular-nums {count >= maxlength ? 'text-brand' : 'text-subtle'}"
			>
				{count}/{maxlength}
			</span>
		{/if}
	</div>
</div>
