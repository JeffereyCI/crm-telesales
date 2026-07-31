<!-- Update response status kontak (BDM + Telesales). -->
<script lang="ts">
	import { contactsApi, validate, toMessage } from '$lib';
	import { toast } from '$lib/stores/toast.svelte';
	import { LIMITS } from '$lib/constants/limits';
	import { RESPONSE_STATUSES, RESPONSE_STATUS_LABEL } from '$lib/constants/enums';
	import type { ResponseStatus } from '$lib/constants/enums';
	import type { ContactResponse } from '$lib/types/api';
	import type { Errors } from '$lib/utils/validation';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import Alert from '$lib/components/ui/Alert.svelte';

	interface Props {
		contact: ContactResponse;
		onclose: () => void;
		onclosed?: () => void;
		/** Field yang baru saja tersimpan, agar parent bisa memperbarui cache-nya
		 *  langsung tanpa refetch. Backend hanya membalas field ini, bukan kontak
		 *  utuh — jadi parent WAJIB merge, bukan menimpa objek lead. */
		onsaved: (patch: Partial<ContactResponse>) => void;
	}
	let { contact, onclose, onclosed, onsaved }: Props = $props();

	// Autofill respon saat ini (semua nilai response_status valid sebagai pilihan).
	let responseStatus = $state<string>(contact.response_status ?? '');
	let notes = $state('');
	let errors = $state<Errors>({});
	let saving = $state(false);

	const statusOptions = RESPONSE_STATUSES.map((s) => ({
		value: s,
		label: RESPONSE_STATUS_LABEL[s]
	}));

	// Cegah regresi: mengubah respon ke NON-tertarik padahal meeting sudah
	// terjadwal akan memindahkan lead ke tahap Loss (meeting jadi "yatim").
	// Bukan diblokir — tapi wajib konfirmasi eksplisit agar tidak tak sengaja.
	const willOrphanMeeting = $derived(
		!!contact.is_meeting_scheduled && !!responseStatus && responseStatus !== 'tertarik'
	);
	let needConfirm = $state(false);
	// Reset gerbang konfirmasi bila kondisi berisiko tidak lagi berlaku.
	$effect(() => {
		if (!willOrphanMeeting) needConfirm = false;
	});

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		errors = validate.validateResponseStatus({
			response_status: responseStatus as ResponseStatus
		});
		if (!validate.isValid(errors)) return;
		// Perubahan berisiko: butuh satu klik konfirmasi tambahan.
		if (willOrphanMeeting && !needConfirm) {
			needConfirm = true;
			return;
		}

		saving = true;
		try {
			const res = await contactsApi.updateResponseStatus(contact.id, {
				response_status: responseStatus as ResponseStatus,
				notes
			});
			toast.success('Status respon diperbarui.');
			onsaved({ response_status: res.response_status });
		} catch (err) {
			toast.error(toMessage(err));
		} finally {
			saving = false;
		}
	}
</script>

<Modal title="Update Status Respon" onclose={saving ? undefined : onclose} {onclosed}>
	<form id="response-form" onsubmit={handleSubmit} class="space-y-4">
		<p class="text-sm text-muted">
			Kontak: <span class="font-medium text-ink">{contact.name}</span>
		</p>
		<Select
			label="Status Respon"
			bind:value={responseStatus}
			options={statusOptions}
			error={errors.response_status}
			placeholder="Pilih status respon"
			required
		/>
		<Textarea
			label="Catatan"
			bind:value={notes}
			maxlength={LIMITS.notes}
			rows={2}
			placeholder="Catatan tambahan (opsional)"
		/>
		<p class="text-xs text-muted">
			Status <span class="font-medium">Tertarik</span> membuka opsi penjadwalan meeting.
		</p>
		{#if willOrphanMeeting}
			<Alert variant="warning">
				Kontak ini sudah punya <span class="font-medium">meeting terjadwal</span>. Mengubah respon
				ke
				<span class="font-medium">{RESPONSE_STATUS_LABEL[responseStatus as ResponseStatus]}</span>
				akan memindahkannya ke tahap <span class="font-medium">Loss</span> (meeting tetap tercatat, tapi
				lead dianggap gugur dari funnel).
			</Alert>
		{/if}
	</form>

	{#snippet footer()}
		<Button variant="secondary" onclick={onclose} disabled={saving}>Batal</Button>
		<Button
			type="submit"
			form="response-form"
			variant={willOrphanMeeting ? 'danger' : 'primary'}
			loading={saving}
		>
			{needConfirm ? 'Ya, tetap simpan' : 'Simpan'}
		</Button>
	{/snippet}
</Modal>
