<!-- Ganti password sendiri (semua role) — overlay dari Topbar. -->
<script lang="ts">
	import { usersApi, validate, toMessage, ApiError } from '$lib';
	import { toast } from '$lib/stores/toast.svelte';
	import { LIMITS } from '$lib/constants/limits';
	import type { Errors } from '$lib/utils/validation';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';
	import PasswordChecklist from '$lib/components/users/PasswordChecklist.svelte';

	interface Props {
		onclose: () => void;
	}
	let { onclose }: Props = $props();

	let oldPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let errors = $state<Errors>({});
	let saving = $state(false);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		errors = validate.validateChangePassword(oldPassword, newPassword, confirmPassword);
		if (!validate.isValid(errors)) return;

		saving = true;
		try {
			await usersApi.changeMyPassword(oldPassword, newPassword);
			toast.success('Password Anda berhasil diubah.');
			onclose();
		} catch (err) {
			// Sandi lama salah → backend membalas 400 `INVALID_OLD_PASSWORD` (sesi tetap
			// valid, client TIDAK logout). Kode spesifik ini membedakannya dari 400 lain
			// (mis. VALIDATION_ERROR), jadi cukup tampilkan inline pada field password lama.
			if (err instanceof ApiError && err.code === 'INVALID_OLD_PASSWORD') {
				errors = { ...errors, old_password: err.message };
			} else {
				toast.error(toMessage(err));
			}
		} finally {
			saving = false;
		}
	}
</script>

<Modal title="Ganti Password" size="sm" onclose={saving ? undefined : onclose}>
	<form id="change-password-form" onsubmit={handleSubmit} class="space-y-3">
		<TextField
			label="Password Lama"
			type="password"
			bind:value={oldPassword}
			error={errors.old_password}
			maxlength={LIMITS.password}
			autocomplete="current-password"
			required
		/>
		<TextField
			label="Password Baru"
			type="password"
			bind:value={newPassword}
			error={errors.new_password}
			maxlength={LIMITS.password}
			hint="Minimal 8 karakter, mengandung huruf besar, kecil, angka, dan simbol."
			autocomplete="new-password"
			required
		/>
		<PasswordChecklist password={newPassword} />
		<TextField
			label="Konfirmasi Password Baru"
			type="password"
			bind:value={confirmPassword}
			error={errors.confirm_password}
			maxlength={LIMITS.password}
			autocomplete="new-password"
			required
		/>
	</form>

	{#snippet footer()}
		<Button variant="secondary" onclick={onclose} disabled={saving}>Batal</Button>
		<Button type="submit" form="change-password-form" loading={saving}>Simpan</Button>
	{/snippet}
</Modal>
