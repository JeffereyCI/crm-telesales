<!--
  Jadwalkan meeting (Telesales). Prasyarat backend: response_status === 'tertarik'.
  Tombol pembuka sudah di-gate; modal hanya muncul bila syarat terpenuhi.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { contactsApi, meetingTemplatesApi, validate, toMessage, LatestRequest } from '$lib';
	import { toast } from '$lib/stores/toast.svelte';
	import { LIMITS } from '$lib/constants/limits';
	import type {
		ContactResponse,
		MeetingTemplateResponse,
		ScheduleMeetingRequest
	} from '$lib/types/api';
	import type { PipelinePhase } from '$lib/constants/enums';
	import type { Errors } from '$lib/utils/validation';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import Select from '$lib/components/ui/Select.svelte';

	interface Props {
		contact: ContactResponse;
		pipelineStatus?: PipelinePhase;
		isFollowUp?: boolean;
		onclose: () => void;
		onsaved: () => void;
	}
	let { contact, pipelineStatus = 'demo', isFollowUp = false, onclose, onsaved }: Props = $props();

	// Lokasi: pilihan tetap & ringkas (backend hanya simpan string, opsional).
	const LOCATION_OPTIONS = [
		{ value: 'Kantor Klien', label: 'Kantor Klien' },
		{ value: 'Kantor Kami', label: 'Kantor Kami' },
		{ value: 'Online (Zoom)', label: 'Online (Zoom)' },
		{ value: 'Online (Google Meet)', label: 'Online (Google Meet)' },
		{ value: 'Online (Microsoft Teams)', label: 'Online (Microsoft Teams)' },
		{ value: 'Telepon', label: 'Telepon' }
	];

	// Tanggal minimum untuk native date picker = hari ini (komponen LOKAL, bukan
	// toISOString() yang bisa menggeser tanggal di timezone positif seperti GMT+7).
	const pad2 = (n: number) => String(n).padStart(2, '0');
	const _today = new Date();
	const todayStr = `${_today.getFullYear()}-${pad2(_today.getMonth() + 1)}-${pad2(_today.getDate())}`;

	let meetingDate = $state('');
	let meetingTime = $state('');
	let location = $state('');
	let agenda = $state('');
	let templateId = $state('');
	let dealName = $state('');
	let templates = $state<MeetingTemplateResponse[]>([]);
	let templatesLoading = $state(true);
	let errors = $state<Errors>({});
	let saving = $state(false);
	const templatesRequest = new LatestRequest();

	const activeTemplateCategory = $derived(
		pipelineStatus === 'proposal' ||
			pipelineStatus === 'quotation' ||
			pipelineStatus === 'waiting_list' ||
			pipelineStatus === 'payment'
			? pipelineStatus
			: 'demo'
	);
	const availableTemplates = $derived(
		templates
			.filter(
				(t) =>
					t.type === 'private' || (t.type === 'public' && t.category === activeTemplateCategory)
			)
			.sort((a, b) => {
				if (a.type !== b.type) return a.type === 'public' ? -1 : 1;
				return a.name.localeCompare(b.name, 'id-ID');
			})
	);
	const templateOptions = $derived(
		availableTemplates.map((t) => ({
			value: t.id,
			label: `${t.type === 'public' ? 'Publik' : 'Privat'} · ${t.name}`
		}))
	);

	async function loadTemplates() {
		const controller = templatesRequest.start();
		templatesLoading = true;
		try {
			const result = await meetingTemplatesApi.listTemplates({}, controller.signal);
			if (!templatesRequest.isCurrent(controller)) return;
			templates = result;
		} catch {
			if (!templatesRequest.isCurrent(controller)) return;
			templates = [];
		} finally {
			if (templatesRequest.finish(controller)) templatesLoading = false;
		}
	}

	onMount(() => {
		void loadTemplates();
		return () => templatesRequest.abort();
	});

	function applyTemplate() {
		const selected = availableTemplates.find((t) => t.id === templateId);
		if (selected) agenda = selected.body;
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		const payload: ScheduleMeetingRequest = {
			meeting_date: meetingDate,
			meeting_time: meetingTime,
			location,
			agenda: agenda.trim(),
			template_id: templateId || undefined,
			deal_name: !isFollowUp ? dealName.trim() : undefined
		};
		errors = validate.validateMeeting(payload, { requiresDealName: !isFollowUp });
		if (!validate.isValid(errors)) return;

		saving = true;
		try {
			await contactsApi.scheduleMeeting(contact.id, payload);
			toast.success('Meeting berhasil dijadwalkan.');
			onsaved();
		} catch (err) {
			toast.error(toMessage(err));
		} finally {
			saving = false;
		}
	}
</script>

<Modal
	title={isFollowUp ? 'Jadwalkan Meeting Lanjutan' : 'Jadwalkan Meeting'}
	onclose={saving ? undefined : onclose}
>
	<form id="meeting-form" onsubmit={handleSubmit} class="space-y-4">
		<p class="text-sm text-muted">
			Kontak: <span class="font-medium text-ink">{contact.name}</span>
		</p>
		<p class="text-xs text-muted">
			{#if isFollowUp}
				Meeting akan dicatat ke deal aktif pada fase {activeTemplateCategory}.
			{:else}
				Masukkan nama deal untuk opportunity baru; backend akan membuat deal demo baru bila belum
				ada deal aktif.
			{/if}
		</p>
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			<TextField
				label="Tanggal"
				type="date"
				min={todayStr}
				bind:value={meetingDate}
				error={errors.meeting_date}
				required
			/>
			<TextField
				label="Waktu"
				type="time"
				bind:value={meetingTime}
				error={errors.meeting_time}
				required
			/>
		</div>
		{#if !isFollowUp}
			<TextField
				label="Nama Deal"
				bind:value={dealName}
				error={errors.deal_name}
				maxlength={255}
				placeholder="Contoh: Follow-up Demo Q3"
				required
			/>
		{/if}
		<Select
			label="Lokasi"
			bind:value={location}
			options={LOCATION_OPTIONS}
			error={errors.location}
			placeholder="Pilih lokasi (opsional)"
		/>
		<Select
			label="Template Agenda"
			bind:value={templateId}
			onchange={applyTemplate}
			options={templateOptions}
			disabled={templatesLoading || templateOptions.length === 0}
			placeholder={templatesLoading ? 'Memuat template…' : 'Pilih template (opsional)'}
		/>
		{#if !templatesLoading && templateOptions.length === 0}
			<p class="text-xs text-muted">
				Belum ada template yang cocok untuk fase ini. Anda tetap bisa menulis agenda manual.
			</p>
		{/if}
		<Textarea
			label="Agenda"
			bind:value={agenda}
			error={errors.agenda}
			maxlength={LIMITS.agenda}
			rows={5}
			placeholder="Tuliskan agenda meeting"
			required
		/>
	</form>

	{#snippet footer()}
		<Button variant="secondary" onclick={onclose} disabled={saving}>Batal</Button>
		<Button type="submit" form="meeting-form" loading={saving}>Jadwalkan</Button>
	{/snippet}
</Modal>
