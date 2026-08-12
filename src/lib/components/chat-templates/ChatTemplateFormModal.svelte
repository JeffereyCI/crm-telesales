<script lang="ts">
	/**
	 * ChatTemplateFormModal — modal create & edit Chat Template.
	 * - Create: template = null → POST /chat-templates
	 * - Edit (active): template?.status === 'active' → PUT /chat-templates/:id
	 * - Template inactive bersifat read-only; modal ini tidak pernah dibuka untuk inactive.
	 */
	import { untrack } from 'svelte';
	import {
		chatTemplatesApi,
		CHAT_TEMPLATE_CATEGORIES,
		CHAT_TEMPLATE_CATEGORY_LABEL,
		ApiError,
		toMessage
	} from '$lib';
	import { toast } from '$lib/stores/toast.svelte';
	import type { ChatTemplateResponse } from '$lib/types/api';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import ChatTemplateBubbleEditor from './ChatTemplateBubbleEditor.svelte';

	interface BubbleState {
		body: string;
		delay_seconds: number;
	}

	interface Props {
		/** null = create; ChatTemplateResponse (active) = edit */
		template?: ChatTemplateResponse | null;
		onclose: () => void;
		onsaved: () => void;
	}

	let { template = null, onclose, onsaved }: Props = $props();

	const initial = untrack(() => template);
	const isEdit = !!initial;

	// ── Form state ────────────────────────────────────────────────────────────
	let name = $state(initial?.name ?? '');
	let category = $state<'leads' | 'contact' | 'customer'>(initial?.category ?? 'leads');
	let manualDelay = $state(initial?.manual_delay_enabled ?? false);
	let bubbles = $state<BubbleState[]>(
		initial?.bubbles.length
			? initial.bubbles.map((b) => ({
					body: b.body,
					delay_seconds: b.effective_delay_seconds || 5
				}))
			: [{ body: '', delay_seconds: 5 }]
	);
	let errors = $state<Record<string, string>>({});
	let saving = $state(false);

	const categoryOptions = CHAT_TEMPLATE_CATEGORIES.map((v) => ({
		value: v,
		label: CHAT_TEMPLATE_CATEGORY_LABEL[v]
	}));

	const MAX_BUBBLES = 5;
	const canAddBubble = $derived(bubbles.length < MAX_BUBBLES);

	// ── Bubble helpers ────────────────────────────────────────────────────────
	function addBubble() {
		if (!canAddBubble) return;
		bubbles = [...bubbles, { body: '', delay_seconds: 5 }];
	}

	function removeBubble(index: number) {
		if (bubbles.length <= 1) return;
		bubbles = bubbles.filter((_, i) => i !== index);
	}

	function moveBubble(index: number, direction: 'up' | 'down') {
		const target = direction === 'up' ? index - 1 : index + 1;
		if (target < 0 || target >= bubbles.length) return;
		const next = [...bubbles];
		[next[index], next[target]] = [next[target], next[index]];
		bubbles = next;
	}

	function updateBubble(index: number, updated: BubbleState) {
		const next = [...bubbles];
		next[index] = updated;
		bubbles = next;
	}

	// ── Validation & submit ───────────────────────────────────────────────────
	async function submit(e: SubmitEvent) {
		e.preventDefault();
		errors = {};

		// Validasi nama
		if (!name.trim()) errors.name = 'Nama Template wajib diisi.';
		else if (name.trim().length > 255) errors.name = 'Nama Template maksimal 255 karakter.';

		// Validasi bubble body
		bubbles.forEach((b, i) => {
			if (!b.body.trim()) errors[`bubble_${i}`] = 'Isi pesan tidak boleh kosong.';
			else if (b.body.length > 4000) errors[`bubble_${i}`] = 'Maksimal 4000 karakter.';
		});

		if (Object.keys(errors).length) return;

		// Bangun payload sesuai contract backend
		const isFinalIdx = bubbles.length - 1;
		const payload = {
			name: name.trim(),
			category,
			manual_delay_enabled: manualDelay,
			bubbles: bubbles.map((b, i) => ({
				position: i + 1,
				body: b.body,
				// delay_seconds hanya dikirim untuk non-final dan saat manual delay aktif
				...(i !== isFinalIdx && manualDelay ? { delay_seconds: b.delay_seconds } : {})
			}))
		};

		saving = true;
		try {
			if (isEdit && initial) {
				await chatTemplatesApi.updateTemplate(initial.id, payload);
				toast.success('Template Chat berhasil diperbarui.');
			} else {
				await chatTemplatesApi.createTemplate(payload);
				toast.success('Template Chat berhasil dibuat.');
			}
			onsaved();
		} catch (err) {
			if (err instanceof ApiError) {
				if (err.code === 'TEMPLATE_NAME_ALREADY_EXISTS') {
					errors.name = 'Nama Template sudah digunakan di kategori ini.';
				} else if (err.code === 'TEMPLATE_ACTIVE_LIMIT_REACHED') {
					toast.error(
						'Batas 10 Template aktif tercapai. Nonaktifkan template lain terlebih dahulu.'
					);
				} else if (err.code === 'TEMPLATE_INACTIVE') {
					toast.error('Template tidak aktif dan tidak dapat diubah.');
				} else {
					toast.error(toMessage(err));
				}
			} else {
				toast.error(toMessage(err));
			}
		} finally {
			saving = false;
		}
	}
</script>

<Modal
	title={isEdit ? 'Edit Template Chat' : 'Buat Template Chat'}
	onclose={saving ? undefined : onclose}
	size="lg"
>
	<form id="chat-template-form" class="space-y-5" onsubmit={submit}>
		<!-- Nama -->
		<TextField
			label="Nama Template"
			bind:value={name}
			error={errors.name}
			maxlength={255}
			placeholder="Contoh: Follow-up Demo Leads"
			required
		/>

		<!-- Kategori -->
		<Select label="Kategori Lifecycle" bind:value={category} options={categoryOptions} required />

		<!-- Toggle manual delay -->
		<div class="flex items-center gap-3">
			<button
				type="button"
				role="switch"
				aria-checked={manualDelay}
				aria-label="Atur delay antar-bubble secara manual"
				onclick={() => (manualDelay = !manualDelay)}
				class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:ring-2 focus:ring-brand/40 focus:outline-none {manualDelay
					? 'bg-brand'
					: 'bg-line-strong'}"
			>
				<span
					class="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform {manualDelay
						? 'translate-x-5'
						: 'translate-x-0'}"
				></span>
			</button>
			<span class="text-sm text-ink">Atur delay antar-bubble secara manual</span>
			{#if !manualDelay}
				<span class="text-xs text-muted">(default: 5 detik)</span>
			{/if}
		</div>

		<!-- Bubble builder -->
		<div class="space-y-3">
			<div class="flex items-center justify-between">
				<p class="text-sm font-medium text-ink">Pesan Bubble ({bubbles.length}/{MAX_BUBBLES})</p>
				{#if canAddBubble}
					<button
						type="button"
						onclick={addBubble}
						class="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink"
					>
						+ Tambah Bubble
					</button>
				{/if}
			</div>
			{#each bubbles as bubble, i (i)}
				<ChatTemplateBubbleEditor
					{bubble}
					index={i}
					total={bubbles.length}
					{manualDelay}
					error={errors[`bubble_${i}`]}
					onchange={(updated) => updateBubble(i, updated)}
					onmoveup={() => moveBubble(i, 'up')}
					onmovedown={() => moveBubble(i, 'down')}
					onremove={() => removeBubble(i)}
				/>
			{/each}
		</div>
	</form>

	{#snippet footer()}
		<Button variant="secondary" onclick={onclose} disabled={saving}>Batal</Button>
		<Button type="submit" form="chat-template-form" loading={saving}>
			{isEdit ? 'Simpan Perubahan' : 'Buat Template'}
		</Button>
	{/snippet}
</Modal>
