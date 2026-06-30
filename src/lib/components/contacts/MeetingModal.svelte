<!--
  Jadwalkan meeting (Telesales). Prasyarat backend: response_status === 'tertarik'.
  Tombol pembuka sudah di-gate; modal hanya muncul bila syarat terpenuhi.
-->
<script lang="ts">
	import { contactsApi, validate, toMessage } from '$lib';
	import { toast } from '$lib/stores/toast.svelte';
	import { LIMITS } from '$lib/constants/limits';
	import type { ContactResponse, ScheduleMeetingRequest } from '$lib/types/api';
	import type { Errors } from '$lib/utils/validation';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import Select from '$lib/components/ui/Select.svelte';

	interface Props {
		contact: ContactResponse;
		onclose: () => void;
		onsaved: () => void;
	}
	let { contact, onclose, onsaved }: Props = $props();

	// Lokasi: pilihan tetap & ringkas (backend hanya simpan string, opsional).
	const LOCATION_OPTIONS = [
		{ value: 'Kantor Klien', label: 'Kantor Klien' },
		{ value: 'Kantor Kami', label: 'Kantor Kami' },
		{ value: 'Online (Zoom)', label: 'Online (Zoom)' },
		{ value: 'Online (Google Meet)', label: 'Online (Google Meet)' },
		{ value: 'Online (Microsoft Teams)', label: 'Online (Microsoft Teams)' },
		{ value: 'Telepon', label: 'Telepon' }
	];

	let meetingDate = $state('');
	let meetingTime = $state('');
	let location = $state('');
	let agenda = $state('');
	let errors = $state<Errors>({});
	let saving = $state(false);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		const payload: ScheduleMeetingRequest = {
			meeting_date: meetingDate,
			meeting_time: meetingTime,
			location,
			agenda
		};
		errors = validate.validateMeeting(payload);
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

<Modal title="Jadwalkan Meeting" onclose={saving ? undefined : onclose}>
	<form id="meeting-form" onsubmit={handleSubmit} class="space-y-4">
		<p class="text-sm text-muted">
			Kontak: <span class="font-medium text-ink">{contact.name}</span>
		</p>
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			<TextField
				label="Tanggal"
				type="date"
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
		<Select
			label="Lokasi"
			bind:value={location}
			options={LOCATION_OPTIONS}
			error={errors.location}
			placeholder="Pilih lokasi (opsional)"
		/>
		<Textarea
			label="Agenda"
			bind:value={agenda}
			maxlength={LIMITS.agenda}
			rows={2}
			placeholder="Agenda meeting (opsional)"
		/>
	</form>

	{#snippet footer()}
		<Button variant="secondary" onclick={onclose} disabled={saving}>Batal</Button>
		<Button type="submit" form="meeting-form" loading={saving}>Jadwalkan</Button>
	{/snippet}
</Modal>
