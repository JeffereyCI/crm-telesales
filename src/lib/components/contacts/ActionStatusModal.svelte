<!-- Update action status kontak (Telesales). -->
<script lang="ts">
	import { contactsApi, validate, toMessage } from '$lib';
	import { toast } from '$lib/stores/toast.svelte';
	import { LIMITS } from '$lib/constants/limits';
	import {
		ACTION_STATUS_INPUTS,
		ACTION_STATUS_LABEL,
		CHANNELS,
		CHANNEL_LABEL
	} from '$lib/constants/enums';
	import type { ActionStatusInput, Channel } from '$lib/constants/enums';
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

	let actionStatus = $state<string>('');
	let channel = $state<string>('');
	let notes = $state('');
	let errors = $state<Errors>({});
	let saving = $state(false);

	const statusOptions = ACTION_STATUS_INPUTS.map((s) => ({
		value: s,
		label: ACTION_STATUS_LABEL[s]
	}));
	const channelOptions = CHANNELS.map((c) => ({ value: c, label: CHANNEL_LABEL[c] }));

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		errors = validate.validateActionStatus({
			action_status: actionStatus as ActionStatusInput,
			channel: channel as Channel
		});
		if (!validate.isValid(errors)) return;

		saving = true;
		try {
			await contactsApi.updateActionStatus(contact.id, {
				action_status: actionStatus as ActionStatusInput,
				channel: channel as Channel,
				notes
			});
			toast.success('Status kontak diperbarui.');
			onsaved();
		} catch (err) {
			toast.error(toMessage(err));
		} finally {
			saving = false;
		}
	}
</script>

<Modal title="Update Status Kontak" onclose={saving ? undefined : onclose}>
	<form id="action-form" onsubmit={handleSubmit} class="space-y-4">
		<p class="text-sm text-muted">
			Kontak: <span class="font-medium text-ink">{contact.name}</span>
		</p>
		<Select
			label="Hasil Kontak"
			bind:value={actionStatus}
			options={statusOptions}
			error={errors.action_status}
			placeholder="Pilih hasil"
			required
		/>
		<Select
			label="Channel"
			bind:value={channel}
			options={channelOptions}
			error={errors.channel}
			placeholder="Pilih channel"
			required
		/>
		<Textarea
			label="Catatan"
			bind:value={notes}
			maxlength={LIMITS.notes}
			rows={2}
			placeholder="Catatan tambahan (opsional)"
		/>
	</form>

	{#snippet footer()}
		<Button variant="secondary" onclick={onclose} disabled={saving}>Batal</Button>
		<Button type="submit" form="action-form" loading={saving}>Simpan</Button>
	{/snippet}
</Modal>
