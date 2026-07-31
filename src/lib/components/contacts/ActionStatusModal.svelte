<!-- Update action status kontak (Telesales). -->
<script lang="ts">
	import { contactsApi, validate, toMessage } from '$lib';
	import { toast } from '$lib/stores/toast.svelte';
	import { LIMITS } from '$lib/constants/limits';
	import {
		ACTION_STATUS_INPUTS,
		ACTION_STATUS_LABEL,
		RESPONSE_STATUS_LABEL,
		CHANNELS,
		CHANNEL_LABEL
	} from '$lib/constants/enums';
	import type { ActionStatusInput, Channel, ResponseStatus } from '$lib/constants/enums';
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

	// Autofill status saat ini bila valid sebagai input. Catatan: 'belum_dihubungi'
	// (default awal) BUKAN pilihan input, jadi dibiarkan kosong. Channel tidak bisa
	// di-autofill karena ia per-interaksi (tidak disimpan di kontak) → tetap wajib pilih.
	let actionStatus = $state<string>(
		ACTION_STATUS_INPUTS.includes(contact.action_status as ActionStatusInput)
			? contact.action_status
			: ''
	);
	let channel = $state<string>('');
	let notes = $state('');
	let errors = $state<Errors>({});
	let saving = $state(false);

	const statusOptions = ACTION_STATUS_INPUTS.map((s) => ({
		value: s,
		label: ACTION_STATUS_LABEL[s]
	}));
	const channelOptions = CHANNELS.map((c) => ({ value: c, label: CHANNEL_LABEL[c] }));

	// Cegah regresi: menandai "Tidak Bisa Dihubungi" padahal respons SUDAH
	// tercatat membuat state tidak konsisten (respons tetap tersimpan padahal
	// kontak dianggap tak terhubungi). Wajib konfirmasi eksplisit.
	const willOrphanResponse = $derived(
		!!contact.response_status && actionStatus === 'tidak_bisa_dihubungi'
	);
	let needConfirm = $state(false);
	$effect(() => {
		if (!willOrphanResponse) needConfirm = false;
	});

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		errors = validate.validateActionStatus({
			action_status: actionStatus as ActionStatusInput,
			channel: channel as Channel
		});
		if (!validate.isValid(errors)) return;
		if (willOrphanResponse && !needConfirm) {
			needConfirm = true;
			return;
		}

		saving = true;
		try {
			const res = await contactsApi.updateActionStatus(contact.id, {
				action_status: actionStatus as ActionStatusInput,
				channel: channel as Channel,
				notes
			});
			toast.success('Status kontak diperbarui.');
			onsaved({ action_status: res.action_status });
		} catch (err) {
			toast.error(toMessage(err));
		} finally {
			saving = false;
		}
	}
</script>

<Modal title="Update Status Kontak" onclose={saving ? undefined : onclose} {onclosed}>
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
		{#if willOrphanResponse}
			<Alert variant="warning">
				Kontak ini sudah punya respons
				<span class="font-medium"
					>{RESPONSE_STATUS_LABEL[contact.response_status as ResponseStatus]}</span
				>. Menandai
				<span class="font-medium">Tidak Bisa Dihubungi</span> membuat status tidak konsisten — respons
				lama tetap tersimpan. Pastikan ini memang benar.
			</Alert>
		{/if}
	</form>

	{#snippet footer()}
		<Button variant="secondary" onclick={onclose} disabled={saving}>Batal</Button>
		<Button
			type="submit"
			form="action-form"
			variant={willOrphanResponse ? 'danger' : 'primary'}
			loading={saving}
		>
			{needConfirm ? 'Ya, tetap simpan' : 'Simpan'}
		</Button>
	{/snippet}
</Modal>
