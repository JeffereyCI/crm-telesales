<!-- Form tambah/edit user (admin). Validasi mirror binding backend + sanitasi saat submit. -->
<script lang="ts">
	import { untrack } from 'svelte';
	import { usersApi, validate, toMessage, ROLES, ROLE_LABEL } from '$lib';
	import { toast } from '$lib/stores/toast.svelte';
	import { LIMITS } from '$lib/constants/limits';
	import type { Role } from '$lib/constants/enums';
	import type { UserResponse } from '$lib/types/api';
	import type { Errors } from '$lib/utils/validation';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import PasswordChecklist from '$lib/components/users/PasswordChecklist.svelte';

	interface Props {
		user?: UserResponse | null;
		onclose: () => void;
		onsaved: () => void;
	}
	let { user = null, onclose, onsaved }: Props = $props();

	// Snapshot non-reaktif: modal selalu di-mount ulang tiap dibuka (keyed parent),
	// jadi nilai awal form cukup diambil sekali dari prop.
	const initial = untrack(() => user);
	const isEdit = !!initial;
	let name = $state(initial?.name ?? '');
	let email = $state(initial?.email ?? '');
	let password = $state('');
	let role = $state<string>(initial?.role ?? '');
	let errors = $state<Errors>({});
	let saving = $state(false);

	const roleOptions = ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }));

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		errors = isEdit
			? validate.validateUpdateUser({ name, email, role: role as Role })
			: validate.validateCreateUser({ name, email, password, role: role as Role });
		if (!validate.isValid(errors)) return;

		saving = true;
		try {
			if (isEdit && initial) {
				await usersApi.updateUser(initial.id, { name, email, role: role as Role });
				toast.success('User berhasil diperbarui.');
			} else {
				await usersApi.createUser({ name, email, password, role: role as Role });
				toast.success('User baru berhasil dibuat.');
			}
			onsaved();
		} catch (err) {
			toast.error(toMessage(err));
		} finally {
			saving = false;
		}
	}
</script>

<Modal title={isEdit ? 'Edit User' : 'Tambah User'} onclose={saving ? undefined : onclose}>
	<form id="user-form" onsubmit={handleSubmit} class="space-y-4">
		<TextField
			label="Nama"
			bind:value={name}
			error={errors.name}
			maxlength={LIMITS.userName}
			placeholder="Nama lengkap"
			autocomplete="off"
			required
		/>
		<TextField
			label="Email"
			type="email"
			bind:value={email}
			error={errors.email}
			maxlength={LIMITS.email}
			placeholder="nama@perusahaan.com"
			autocomplete="off"
			required
		/>
		{#if !isEdit}
			<div class="space-y-1.5">
				<TextField
					label="Password"
					type="password"
					bind:value={password}
					error={errors.password}
					maxlength={LIMITS.password}
					hint="Minimal 8 karakter, mengandung huruf besar, kecil, angka, dan simbol."
					autocomplete="new-password"
					required
				/>
				<PasswordChecklist {password} />
			</div>
		{/if}
		<Select
			label="Role"
			bind:value={role}
			options={roleOptions}
			error={errors.role}
			placeholder="Pilih role"
			required
		/>
	</form>

	{#snippet footer()}
		<Button variant="secondary" onclick={onclose} disabled={saving}>Batal</Button>
		<Button type="submit" form="user-form" loading={saving}>
			{isEdit ? 'Simpan Perubahan' : 'Buat User'}
		</Button>
	{/snippet}
</Modal>
