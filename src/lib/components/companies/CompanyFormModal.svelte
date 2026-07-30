<!-- Add/edit account form (BDM). Sanitization + char limits per field. -->
<script lang="ts">
	import { untrack } from 'svelte';
	import { companiesApi, validate, toMessage, sanitize } from '$lib';
	import { toast } from '$lib/stores/toast.svelte';
	import { LIMITS } from '$lib/constants/limits';
	import type { CompanyDetailResponse, CreateCompanyRequest } from '$lib/types/api';
	import type { Errors } from '$lib/utils/validation';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';

	interface Props {
		company?: CompanyDetailResponse | null;
		onclose: () => void;
		onsaved: () => void;
	}
	let { company = null, onclose, onsaved }: Props = $props();

	const initial = untrack(() => company);
	const isEdit = !!initial;

	let name = $state(initial?.name ?? '');
	let industry = $state(initial?.industry ?? '');
	let address = $state(initial?.address ?? '');
	let phone = $state(initial?.phone ?? '');
	let website = $state(initial?.website ?? '');
	let errors = $state<Errors>({});
	let saving = $state(false);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		const payload: CreateCompanyRequest = {
			name: sanitize.sanitizeText(name),
			industry: sanitize.sanitizeText(industry),
			address: sanitize.sanitizeMultiline(address),
			phone: sanitize.sanitizePhone(phone),
			website: sanitize.sanitizeWebsite(website)
		};
		errors = validate.validateCompany(payload);
		if (!validate.isValid(errors)) return;

		saving = true;
		try {
			if (isEdit && initial) {
				await companiesApi.updateCompany(initial.id, payload);
				toast.success('Account updated successfully.');
			} else {
				await companiesApi.createCompany(payload);
				toast.success('Account created successfully.');
			}
			onsaved();
		} catch (err) {
			toast.error(toMessage(err));
		} finally {
			saving = false;
		}
	}
</script>

<Modal title={isEdit ? 'Edit Account' : 'Add Account'} onclose={saving ? undefined : onclose}>
	<form id="company-form" onsubmit={handleSubmit} class="space-y-4">
		<TextField
			label="Account Name"
			bind:value={name}
			error={errors.name}
			maxlength={LIMITS.companyName}
			placeholder="e.g. Acme Corporation"
			required
		/>
		<TextField
			label="Industry"
			bind:value={industry}
			error={errors.industry}
			maxlength={LIMITS.industry}
			placeholder="e.g. Manufacturing, Retail, Technology"
		/>
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			<TextField
				label="Phone"
				bind:value={phone}
				oninput={(e) => (phone = sanitize.filterPhoneInput(e.currentTarget.value))}
				error={errors.phone}
				maxlength={LIMITS.phone}
				inputmode="tel"
				placeholder="+62 21-1234-567"
				hint="Digits, +, -, spaces only"
			/>
			<TextField
				label="Website"
				bind:value={website}
				error={errors.website}
				maxlength={LIMITS.website}
				inputmode="url"
				placeholder="example.com"
			/>
		</div>
		<Textarea
			label="Address"
			bind:value={address}
			error={errors.address}
			maxlength={LIMITS.address}
			rows={2}
			placeholder="Full address (optional)"
		/>
	</form>

	{#snippet footer()}
		<Button variant="secondary" onclick={onclose} disabled={saving}>Cancel</Button>
		<Button type="submit" form="company-form" loading={saving}>
			{isEdit ? 'Save Changes' : 'Create Account'}
		</Button>
	{/snippet}
</Modal>
