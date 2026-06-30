<!--
  Input teks + label + pesan error. Bila type="password", otomatis ada
  tombol show/hide. Value dua-arah via $bindable.
-->
<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import Icon from './Icon.svelte';

	interface Props extends Omit<HTMLInputAttributes, 'value'> {
		label: string;
		value?: string;
		error?: string;
		hint?: string;
	}

	let {
		label,
		value = $bindable(''),
		error = '',
		hint = '',
		type = 'text',
		id,
		required = false,
		class: cls = '',
		...rest
	}: Props = $props();

	const generatedId = `f-${Math.random().toString(36).slice(2, 9)}`;
	const fieldId = $derived(id ?? generatedId);
	const isPassword = $derived(type === 'password');
	let reveal = $state(false);
	const inputType = $derived(isPassword && reveal ? 'text' : type);
</script>

<div class="flex flex-col gap-1.5">
	<label for={fieldId} class="text-sm font-medium text-ink-soft">
		{label}
		{#if required}<span class="text-brand">*</span>{/if}
	</label>

	<div class="relative">
		<input
			id={fieldId}
			type={inputType}
			bind:value
			{required}
			aria-invalid={error ? 'true' : undefined}
			aria-describedby={error ? `${fieldId}-err` : undefined}
			class="h-10 w-full rounded-lg border bg-surface px-3 text-sm text-ink placeholder:text-subtle focus:ring-2 focus:outline-none disabled:bg-surface-2 {error
				? 'border-brand focus:border-brand focus:ring-brand/30'
				: 'border-line-strong focus:border-brand focus:ring-brand/25'} {isPassword
				? 'pr-10'
				: ''} {cls}"
			{...rest}
		/>

		{#if isPassword}
			<button
				type="button"
				onclick={() => (reveal = !reveal)}
				class="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-subtle hover:text-ink"
				aria-label={reveal ? 'Sembunyikan password' : 'Tampilkan password'}
				tabindex="-1"
			>
				<Icon name={reveal ? 'eye-off' : 'eye'} size={18} />
			</button>
		{/if}
	</div>

	{#if error}
		<p id="{fieldId}-err" class="text-xs text-brand">{error}</p>
	{:else if hint}
		<p class="text-xs text-muted">{hint}</p>
	{/if}
</div>
