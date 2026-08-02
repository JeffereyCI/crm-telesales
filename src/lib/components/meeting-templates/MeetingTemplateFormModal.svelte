<script lang="ts">
	import { untrack } from 'svelte';
	import { meetingTemplatesApi, PIPELINE_PHASE_LABEL, toMessage } from '$lib';
	import { toast } from '$lib/stores/toast.svelte';
	import type { MeetingTemplateCategory, MeetingTemplateResponse } from '$lib/types/api';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import Select from '$lib/components/ui/Select.svelte';

	interface Props {
		template?: MeetingTemplateResponse | null;
		onclose: () => void;
		onsaved: () => void;
	}

	let { template = null, onclose, onsaved }: Props = $props();
	const initial = untrack(() => template);
	const isEdit = !!initial;
	const isPublic = initial?.type === 'public';

	let name = $state(initial?.name ?? '');
	let body = $state(initial?.body ?? '');
	let category = $state<MeetingTemplateCategory>(initial?.category ?? 'general');
	let errors = $state<Record<string, string>>({});
	let saving = $state(false);

	const categories: MeetingTemplateCategory[] = [
		'demo',
		'proposal',
		'quotation',
		'waiting_list',
		'payment',
		'general'
	];
	const categoryOptions = categories.map((value) => ({
		value,
		label: value === 'general' ? 'Umum' : PIPELINE_PHASE_LABEL[value]
	}));

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		errors = {};
		if (!name.trim()) errors.name = 'Nama template wajib diisi.';
		if (name.trim().length > 255) errors.name = 'Nama template maksimal 255 karakter.';
		if (!body.trim()) errors.body = 'Isi agenda wajib diisi.';
		if (Object.keys(errors).length) return;

		saving = true;
		try {
			const payload = { name: name.trim(), body: body.trim(), category };
			if (initial) await meetingTemplatesApi.updateTemplate(initial.id, payload);
			else await meetingTemplatesApi.createTemplate(payload);
			toast.success(isEdit ? 'Template berhasil diperbarui.' : 'Template privat berhasil dibuat.');
			onsaved();
		} catch (err) {
			toast.error(toMessage(err));
		} finally {
			saving = false;
		}
	}
</script>

<Modal
	title={isPublic
		? 'Edit Template Publik'
		: isEdit
			? 'Edit Template Privat'
			: 'Tambah Template Privat'}
	onclose={saving ? undefined : onclose}
>
	<form id="meeting-template-form" class="space-y-4" onsubmit={submit}>
		<TextField
			label="Nama Template"
			bind:value={name}
			error={errors.name}
			maxlength={255}
			disabled={isPublic}
			required
		/>
		<Select
			label="Kategori"
			bind:value={category}
			options={categoryOptions}
			disabled={isPublic}
			required
		/>
		<Textarea
			label="Isi Agenda"
			bind:value={body}
			error={errors.body}
			rows={8}
			placeholder="Tuliskan agenda yang dapat digunakan kembali"
			required
		/>
		{#if isPublic}
			<p class="text-xs text-muted">
				Template publik bersifat kolaboratif. Nama dan kategori tidak dapat diubah.
			</p>
		{/if}
	</form>

	{#snippet footer()}
		<Button variant="secondary" onclick={onclose} disabled={saving}>Batal</Button>
		<Button type="submit" form="meeting-template-form" loading={saving}>Simpan</Button>
	{/snippet}
</Modal>
