<!-- Add/edit lead form (Telesales). Strict per-field sanitization + char limits. -->
<script lang="ts">
	import { untrack } from 'svelte';
	import { contactsApi, validate, toMessage, sanitize, ApiError } from '$lib';
	import { toast } from '$lib/stores/toast.svelte';
	import { LIMITS } from '$lib/constants/limits';
	import { WHATSAPP_STATUS_LABEL } from '$lib/constants/enums';
	import type { ContactResponse, CreateContactRequest } from '$lib/types/api';
	import type { Errors } from '$lib/utils/validation';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';
	import PhoneField from '$lib/components/ui/PhoneField.svelte';

	interface Props {
		companyId: string;
		contact?: ContactResponse | null;
		onclose: () => void;
		onclosed?: () => void;
		onsaved: () => void;
	}
	let { companyId, contact = null, onclose, onclosed, onsaved }: Props = $props();

	const initial = untrack(() => contact);
	const isEdit = !!initial;

	let name = $state(initial?.name ?? '');
	let jobTitle = $state(initial?.job_title ?? '');
	let phone = $state(initial?.phone ?? '');
	let email = $state(initial?.email ?? '');
	let errors = $state<Errors>({});
	let saving = $state(false);

	/** Buat pesan toast berdasarkan whatsapp_status dari response backend. */
	function toastAfterSave(result: ContactResponse, verb: 'ditambahkan' | 'diperbarui') {
		const base = `Lead berhasil ${verb}.`;
		if (!result.whatsapp_status) {
			toast.success(base);
			return;
		}
		const waLabel = WHATSAPP_STATUS_LABEL[result.whatsapp_status];
		toast.success(`${base} Status WhatsApp: ${waLabel}.`);
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		const payload: CreateContactRequest = { name, job_title: jobTitle, phone, email };
		errors = validate.validateContact(payload);
		if (!validate.isValid(errors)) return;

		saving = true;
		try {
			if (isEdit && initial) {
				const result = await contactsApi.updateContact(initial.id, payload);
				toastAfterSave(result, 'diperbarui');
			} else {
				const result = await contactsApi.createContact(companyId, payload);
				toastAfterSave(result, 'ditambahkan');
			}
			onsaved();
		} catch (err) {
			// 409: nomor sudah dipakai contact lain — jangan tampilkan data owner
			if (err instanceof ApiError && err.code === 'PHONE_ALREADY_EXISTS') {
				toast.error('Nomor telepon ini sudah digunakan oleh contact lain.');
			} else {
				toast.error(toMessage(err));
			}
		} finally {
			saving = false;
		}
	}
</script>

<Modal title={isEdit ? 'Edit Lead' : 'Add Lead'} onclose={saving ? undefined : onclose} {onclosed}>
	<form id="contact-form" onsubmit={handleSubmit} class="space-y-4">
		<TextField
			label="Full Name"
			bind:value={name}
			oninput={(e) => (name = sanitize.filterPersonName(e.currentTarget.value))}
			error={errors.name}
			maxlength={LIMITS.contactName}
			placeholder="e.g. John Smith"
			hint="Letters, spaces, hyphens, and apostrophes only"
			required
		/>
		<TextField
			label="Job Title"
			bind:value={jobTitle}
			oninput={(e) => (jobTitle = sanitize.filterJobTitle(e.currentTarget.value))}
			error={errors.job_title}
			maxlength={LIMITS.jobTitle}
			placeholder="e.g. Procurement Manager"
			required
		/>
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			<PhoneField bind:value={phone} error={errors.phone} hint="Phone or email required" />
			<TextField
				label="Email"
				type="email"
				bind:value={email}
				error={errors.email}
				maxlength={LIMITS.email}
				placeholder="name@company.com"
				hint="Phone or email required"
			/>
		</div>
	</form>

	{#snippet footer()}
		<Button variant="secondary" onclick={onclose} disabled={saving}>Cancel</Button>
		<Button type="submit" form="contact-form" loading={saving}>
			{isEdit ? 'Save Changes' : 'Add Lead'}
		</Button>
	{/snippet}
</Modal>
