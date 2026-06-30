<!--
  Input telepon modern: dropdown kode negara (bisa dicari, default +62) +
  input nomor yang otomatis diberi pemisah "-" tiap 4 digit.

  Nilai yang dibind ke parent = satu string "<dial> <nomor-berdash>", mis.
  "+62 8123-4567-890". Kosong bila nomor kosong (agar tetap opsional).
  Panjang total dijaga <= 20 karakter (batas backend) dengan memangkas digit.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { COUNTRIES, matchCountry, type Country } from '$lib/constants/countries';
	import Icon from './Icon.svelte';

	interface Props {
		label?: string;
		value?: string;
		error?: string;
		hint?: string;
		required?: boolean;
	}
	let {
		label = 'Telepon',
		value = $bindable(''),
		error = '',
		hint = '',
		required = false
	}: Props = $props();

	// ITU-T E.164 standard: max 15 digits. Backend allows 20 chars (for formatted string).
	const MAX_TOTAL = 15; // max digit count (no real phone exceeds 15 digits)

	// Pisahkan nilai awal jadi negara + digit nasional (sekali, tanpa reaktif).
	const init = untrack(() => value);
	let country = $state<Country>(matchCountry(init));
	let national = $state<string>(
		untrack(() => {
			const stripped = (init ?? '').replace(/\s/g, '');
			const c = matchCountry(init);
			const rest = stripped.startsWith(c.dial) ? stripped.slice(c.dial.length) : stripped;
			return rest.replace(/\D/g, '');
		})
	);

	// Format: sisipkan "-" tiap 4 digit. "812345678" -> "8123-4567-8".
	function formatNational(digits: string): string {
		return digits.replace(/(.{4})/g, '$1-').replace(/-$/, '');
	}

	// Limit digit count to MAX_TOTAL (ITU-T E.164: 15 digits max).
	function capDigits(digits: string, _dialLen?: number): string {
		return digits.slice(0, MAX_TOTAL);
	}

	const formatted = $derived(formatNational(national));

	// Tulis balik ke parent setiap negara/nomor berubah.
	$effect(() => {
		value = national ? `${country.dial} ${formatNational(national)}` : '';
	});

	function onInput(e: Event & { currentTarget: HTMLInputElement }) {
		const digits = e.currentTarget.value.replace(/\D/g, '');
		national = capDigits(digits, country.dial.length);
	}

	// ── Dropdown negara (bisa dicari) ────────────────────────────────────────
	let open = $state(false);
	let query = $state('');
	let root = $state<HTMLDivElement | null>(null);

	const filtered = $derived(
		query.trim()
			? COUNTRIES.filter((c) => {
					const q = query.toLowerCase();
					return (
						c.name.toLowerCase().includes(q) || c.dial.includes(q) || c.code.toLowerCase() === q
					);
				})
			: COUNTRIES
	);

	function selectCountry(c: Country) {
		country = c;
		national = capDigits(national, c.dial.length); // re-pangkas sesuai dial baru
		open = false;
		query = '';
	}

	function toggle() {
		open = !open;
		query = '';
	}

	$effect(() => {
		if (!open) return;
		function onDocClick(ev: MouseEvent) {
			if (root && !root.contains(ev.target as Node)) open = false;
		}
		function onKey(ev: KeyboardEvent) {
			if (ev.key === 'Escape') open = false;
		}
		document.addEventListener('click', onDocClick);
		document.addEventListener('keydown', onKey);
		return () => {
			document.removeEventListener('click', onDocClick);
			document.removeEventListener('keydown', onKey);
		};
	});
</script>

<div class="flex flex-col gap-1.5" bind:this={root}>
	<span class="text-sm font-medium text-ink-soft">
		{label}
		{#if required}<span class="text-brand">*</span>{/if}
	</span>

	<div class="relative">
		<div
			class="flex h-10 w-full items-stretch rounded-lg border bg-surface focus-within:ring-2 {error
				? 'border-brand focus-within:border-brand focus-within:ring-brand/30'
				: 'border-line-strong focus-within:border-brand focus-within:ring-brand/25'}"
		>
			<!-- Tombol kode negara -->
			<button
				type="button"
				onclick={toggle}
				aria-haspopup="listbox"
				aria-expanded={open}
				class="flex shrink-0 items-center gap-1 rounded-l-lg border-r border-line px-2.5 text-sm text-ink-soft hover:bg-surface-2"
			>
				<span class="text-base leading-none">{country.flag}</span>
				<span class="font-medium">{country.dial}</span>
				<Icon name="chevron-down" size={14} class="text-subtle" />
			</button>

			<!-- Input nomor (format dash tiap 4) -->
			<input
				type="tel"
				inputmode="tel"
				value={formatted}
				oninput={onInput}
				placeholder="8123-4567-890"
				aria-label="Nomor telepon"
				aria-invalid={error ? 'true' : undefined}
				class="w-full rounded-r-lg bg-transparent px-3 text-sm text-ink placeholder:text-subtle focus:outline-none"
			/>
		</div>

		{#if open}
			<div
				class="absolute z-20 mt-1 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-line-strong bg-surface shadow-lg"
				role="listbox"
				tabindex="-1"
			>
				<div class="border-b border-line p-2">
					<div class="relative">
						<Icon
							name="search"
							size={15}
							class="absolute top-1/2 left-2.5 -translate-y-1/2 text-subtle"
						/>
						<!-- svelte-ignore a11y_autofocus -->
						<input
							bind:value={query}
							autofocus
							placeholder="Search country / code…"
							class="h-9 w-full rounded-md border border-line-strong bg-surface pr-3 pl-8 text-sm text-ink placeholder:text-subtle focus:border-brand focus:ring-2 focus:ring-brand/25 focus:outline-none"
						/>
					</div>
				</div>
				<ul class="max-h-60 overflow-y-auto py-1">
					{#each filtered as c (c.code + c.dial)}
						<li>
							<button
								type="button"
								onclick={() => selectCountry(c)}
								class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-surface-2 {c.code ===
									country.code && c.dial === country.dial
									? 'bg-brand-soft text-brand'
									: 'text-ink-soft'}"
							>
								<span class="text-base leading-none">{c.flag}</span>
								<span class="flex-1 truncate">{c.name}</span>
								<span class="text-subtle">{c.dial}</span>
							</button>
						</li>
					{:else}
						<li class="px-3 py-4 text-center text-sm text-subtle">Not found.</li>
					{/each}
				</ul>
			</div>
		{/if}
	</div>

	{#if error}
		<p class="text-xs text-brand">{error}</p>
	{:else if hint}
		<p class="text-xs text-muted">{hint}</p>
	{/if}
</div>
