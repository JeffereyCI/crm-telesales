<!-- Tombol serbaguna (Tailwind, zero-dependency). Mendukung state loading. -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import Icon from './Icon.svelte';

	type Variant = 'primary' | 'positive' | 'secondary' | 'ghost' | 'danger';
	type Size = 'sm' | 'md';

	interface Props extends HTMLButtonAttributes {
		variant?: Variant;
		size?: Size;
		loading?: boolean;
		full?: boolean;
		children: Snippet;
	}

	let {
		variant = 'primary',
		size = 'md',
		loading = false,
		full = false,
		disabled = false,
		type = 'button',
		class: cls = '',
		children,
		...rest
	}: Props = $props();

	const base =
		'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60';

	const variants: Record<Variant, string> = {
		// brand (merah) — CTA utama / identitas
		primary: 'bg-brand text-white hover:bg-brand-hover focus-visible:ring-brand',
		// positif (hijau) — aksi afirmatif (simpan, aktifkan, masuk)
		positive: 'bg-positive text-white hover:bg-positive-hover focus-visible:ring-positive',
		secondary:
			'border border-line-strong bg-surface text-ink-soft hover:bg-surface-3 focus-visible:ring-line-strong',
		ghost: 'text-muted hover:bg-surface-3 focus-visible:ring-line-strong',
		danger: 'bg-brand text-white hover:bg-brand-hover focus-visible:ring-brand'
	};

	const sizes: Record<Size, string> = {
		sm: 'h-8 px-3 text-sm',
		md: 'h-10 px-4 text-sm'
	};
</script>

<button
	{type}
	disabled={disabled || loading}
	class="{base} {variants[variant]} {sizes[size]} {full ? 'w-full' : ''} {cls}"
	{...rest}
>
	{#if loading}
		<Icon name="loader-2" size={16} class="animate-spin" />
	{/if}
	{@render children()}
</button>
