<script lang="ts">
	/**
	 * ChatTemplateBubbleEditor — editor satu bubble pesan.
	 * Props: bubble state, posisi dalam array, total bubble, toggle manual delay,
	 *        dan callback aksi (up, down, remove).
	 */
	import Icon from '$lib/components/ui/Icon.svelte';

	interface BubbleState {
		body: string;
		delay_seconds: number; // 1–30; diabaikan untuk bubble final dan saat manual_delay=false
	}

	interface Props {
		bubble: BubbleState;
		index: number; // 0-based index di array
		total: number; // total jumlah bubble
		manualDelay: boolean; // apakah manual_delay_enabled aktif
		error?: string; // error message untuk body field
		onchange: (updated: BubbleState) => void;
		onmoveup: () => void;
		onmovedown: () => void;
		onremove: () => void;
	}

	let {
		bubble,
		index,
		total,
		manualDelay,
		error,
		onchange,
		onmoveup,
		onmovedown,
		onremove
	}: Props = $props();

	const isFinal = $derived(index === total - 1);
	const position = $derived(index + 1);
	const bodyLen = $derived(bubble.body.length);

	const TOKENS = [
		{ label: '{{contact_name}}', value: '{{contact_name}}' },
		{ label: '{{contact_position}}', value: '{{contact_position}}' },
		{ label: '{{company_name}}', value: '{{company_name}}' },
		{ label: '{{sender_name}}', value: '{{sender_name}}' }
	];

	let textareaEl = $state<HTMLTextAreaElement | undefined>(undefined);

	function insertToken(token: string) {
		if (!textareaEl) return;
		const start = textareaEl.selectionStart ?? bubble.body.length;
		const end = textareaEl.selectionEnd ?? bubble.body.length;
		const newBody = bubble.body.slice(0, start) + token + bubble.body.slice(end);
		onchange({ ...bubble, body: newBody });
		// Restore fokus dan posisi kursor setelah token diinsert
		requestAnimationFrame(() => {
			textareaEl?.focus();
			const pos = start + token.length;
			textareaEl?.setSelectionRange(pos, pos);
		});
	}
</script>

<div class="rounded-xl border border-line bg-surface p-4">
	<!-- Bubble header: nomor + aksi reorder + hapus -->
	<div class="mb-3 flex items-center justify-between gap-2">
		<span class="text-xs font-semibold tracking-wide text-brand uppercase">
			Bubble {position}
			{#if isFinal}<span class="ml-1 font-normal text-muted">(Terakhir)</span>{/if}
		</span>
		<div class="flex items-center gap-1">
			<button
				type="button"
				onclick={onmoveup}
				disabled={index === 0}
				title="Pindah ke atas"
				class="rounded p-1 text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
			>
				<Icon name="chevron-up" size={15} />
			</button>
			<button
				type="button"
				onclick={onmovedown}
				disabled={index === total - 1}
				title="Pindah ke bawah"
				class="rounded p-1 text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
			>
				<Icon name="chevron-down" size={15} />
			</button>
			{#if total > 1}
				<button
					type="button"
					onclick={onremove}
					title="Hapus bubble ini"
					class="rounded p-1 text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-950/40"
				>
					<Icon name="trash-2" size={15} />
				</button>
			{/if}
		</div>
	</div>

	<!-- Token chips -->
	<div class="mb-2 flex flex-wrap gap-1.5">
		{#each TOKENS as token (token.value)}
			<button
				type="button"
				onclick={() => insertToken(token.value)}
				class="rounded-full border border-brand/30 bg-brand-soft px-2.5 py-0.5 font-mono text-[10px] text-brand transition-colors hover:bg-brand hover:text-white"
				title="Klik untuk menyisipkan token"
			>
				{token.label}
			</button>
		{/each}
	</div>

	<!-- Textarea body -->
	<div class="relative">
		<textarea
			bind:this={textareaEl}
			value={bubble.body}
			oninput={(e) => onchange({ ...bubble, body: (e.currentTarget as HTMLTextAreaElement).value })}
			rows={4}
			maxlength={4000}
			placeholder="Tulis pesan bubble ini…"
			class="w-full resize-y rounded-lg border bg-surface px-3 py-2 text-sm text-ink placeholder-muted transition-colors focus:ring-2 focus:outline-none {error
				? 'border-red-400 focus:ring-red-300'
				: 'border-line focus:ring-brand/30'}"
		></textarea>
		<span
			class="absolute right-2 bottom-2 text-[10px] {bodyLen > 3800 ? 'text-red-500' : 'text-muted'}"
		>
			{bodyLen}/4000
		</span>
	</div>
	{#if error}
		<p class="mt-1 text-xs text-red-500">{error}</p>
	{/if}

	<!-- Delay input — hanya untuk non-final bubble saat manual delay aktif -->
	{#if !isFinal}
		{#if manualDelay}
			<div class="mt-3 flex items-center gap-2">
				<label class="text-xs text-muted" for="delay-{index}"
					>Delay sebelum bubble berikutnya:</label
				>
				<input
					id="delay-{index}"
					type="number"
					min={1}
					max={30}
					value={bubble.delay_seconds}
					oninput={(e) =>
						onchange({
							...bubble,
							delay_seconds: Math.min(
								30,
								Math.max(1, Number((e.currentTarget as HTMLInputElement).value))
							)
						})}
					class="w-20 rounded-lg border border-line bg-surface px-2 py-1 text-sm text-ink focus:ring-2 focus:ring-brand/30 focus:outline-none"
				/>
				<span class="text-xs text-muted">detik (1–30)</span>
			</div>
		{:else}
			<p class="mt-2 text-xs text-muted">
				<Icon name="clock" size={12} class="mr-1 inline" />
				Delay default: 5 detik
			</p>
		{/if}
	{:else}
		<p class="mt-2 text-xs text-muted">
			<Icon name="flag" size={12} class="mr-1 inline" />
			Bubble terakhir — tidak ada delay.
		</p>
	{/if}
</div>
