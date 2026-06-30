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

	interface Props {
		contact: ContactResponse;
		onclose: () => void;
		onsaved: () => void;
	}
	let { contact, onclose, onsaved }: Props = $props();

	let responseStatus = $state<string>('');
	let notes = $state('');
	let errors = $state<Errors>({});
	let saving = $state(false);

	const statusOptions = RESPONSE_STATUSES.map((s) => ({
		value: s,
		label: RESPONSE_STATUS_LABEL[s]
	}));

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		errors = validate.validateResponseStatus({
			response_status: responseStatus as ResponseStatus
		});
		if (!validate.isValid(errors)) return;

		saving = true;
		try {
			await contactsApi.updateResponseStatus(contact.id, {
				response_status: responseStatus as ResponseStatus,
				notes
			});
			toast.success('Status respon diperbarui.');
			onsaved();
		} catch (err) {
			toast.error(toMessage(err));
		} finally {
			saving = false;
		}
	}
</script>

<Modal title="Update Status Respon" onclose={saving ? undefined : onclose}>
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
	</form>

	{#snippet footer()}
		<Button variant="secondary" onclick={onclose} disabled={saving}>Batal</Button>
		<Button type="submit" form="response-form" loading={saving}>Simpan</Button>
	{/snippet}
</Modal>
