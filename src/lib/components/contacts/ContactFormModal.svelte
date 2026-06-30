<!-- Add/edit lead form (Telesales). Strict per-field sanitization + char limits. -->
<script lang="ts">
	import { untrack } from 'svelte';
	import { contactsApi, validate, toMessage, sanitize } from '$lib';
	import { toast } from '$lib/stores/toast.svelte';
	import { LIMITS } from '$lib/constants/limits';
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
		onsaved: () => void;
	}
	let { companyId, contact = null, onclose, onsaved }: Props = $props();

	const initial = untrack(() => contact);
	const isEdit = !!initial;

	let name = $state(initial?.name ?? '');
	let jobTitle = $state(initial?.job_title ?? '');
	let phone = $state(initial?.phone ?? '');
	let email = $state(initial?.email ?? '');
	let errors = $state<Errors>({});
	let saving = $state(false);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		const payload: CreateContactRequest = { name, job_title: jobTitle, phone, email };
		errors = validate.validateContact(payload);
		if (!validate.isValid(errors)) return;

		saving = true;
		try {
			if (isEdit && initial) {
				await contactsApi.updateContact(initial.id, payload);
				toast.success('Lead updated successfully.');
			} else {
				await contactsApi.createContact(companyId, payload);
				toast.success('Lead added successfully.');
			}
			onsaved();
		} catch (err) {
			toast.error(toMessage(err));
		} finally {
			saving = false;
		}
	}
</script>

<Modal title={isEdit ? 'Edit Lead' : 'Add Lead'} onclose={saving ? undefined : onclose}>
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
