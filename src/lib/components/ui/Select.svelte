<!-- Dropdown + label + error. Value dua-arah via $bindable. -->
<script lang="ts">
	import type { HTMLSelectAttributes } from 'svelte/elements';

	export interface Option {
		value: string;
		label: string;
	}

	interface Props extends Omit<HTMLSelectAttributes, 'value'> {
		label?: string;
		value?: string;
		options: Option[];
		error?: string;
		placeholder?: string;
	}

	let {
		label = '',
		value = $bindable(''),
		options,
		error = '',
		placeholder = '',
		id,
		required = false,
		class: cls = '',
		...rest
	}: Props = $props();

	const generatedId = `s-${Math.random().toString(36).slice(2, 9)}`;
	const fieldId = $derived(id ?? generatedId);
</script>

<div class="flex flex-col gap-1.5">
	{#if label}
		<label for={fieldId} class="text-sm font-medium text-ink-soft">
			{label}
			{#if required}<span class="text-brand">*</span>{/if}
		</label>
	{/if}

	<select
		id={fieldId}
		bind:value
		{required}
		aria-invalid={error ? 'true' : undefined}
		class="h-10 w-full rounded-lg border bg-surface px-3 text-sm text-ink focus:ring-2 focus:outline-none {error
			? 'border-brand focus:border-brand focus:ring-brand/30'
			: 'border-line-strong focus:border-brand focus:ring-brand/25'} {cls}"
		{...rest}
	>
		{#if placeholder}
			<option value="" disabled={required}>{placeholder}</option>
		{/if}
		{#each options as opt (opt.value)}
			<option value={opt.value}>{opt.label}</option>
		{/each}
	</select>

	{#if error}
		<p class="text-xs text-brand">{error}</p>
	{/if}
</div>
