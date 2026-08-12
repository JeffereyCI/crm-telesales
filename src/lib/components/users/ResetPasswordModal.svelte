<!-- Reset password user (admin). -->
<script lang="ts">
	import { usersApi, validate, toMessage } from '$lib';
	import { toast } from '$lib/stores/toast.svelte';
	import { LIMITS } from '$lib/constants/limits';
	import type { UserResponse } from '$lib/types/api';
	import type { Errors } from '$lib/utils/validation';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';
	import PasswordChecklist from '$lib/components/users/PasswordChecklist.svelte';

	interface Props {
		user: UserResponse;
		onclose: () => void;
		onclosed?: () => void;
		onsaved: () => void;
	}
	let { user, onclose, onclosed, onsaved }: Props = $props();

	let password = $state('');
	let errors = $state<Errors>({});
	let saving = $state(false);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		errors = validate.validateResetPassword(password);
		if (!validate.isValid(errors)) return;

		saving = true;
		try {
			await usersApi.resetUserPassword(user.id, password);
			toast.success(`Password ${user.name} berhasil direset.`);
			onsaved();
		} catch (err) {
			toast.error(toMessage(err));
		} finally {
			saving = false;
		}
	}
</script>

<Modal title="Reset Password" size="sm" onclose={saving ? undefined : onclose} {onclosed}>
	<form id="reset-form" onsubmit={handleSubmit} class="space-y-3">
		<p class="text-sm text-muted">
			Setel password baru untuk <span class="font-medium text-ink">{user.name}</span>.
		</p>
		<TextField
			label="Password Baru"
			type="password"
			bind:value={password}
			error={errors.new_password}
			maxlength={LIMITS.password}
			hint="Minimal 8 karakter, mengandung huruf besar, kecil, angka, dan simbol."
			autocomplete="new-password"
			required
		/>
		<PasswordChecklist {password} />
	</form>

	{#snippet footer()}
		<Button variant="secondary" onclick={onclose} disabled={saving}>Batal</Button>
		<Button type="submit" form="reset-form" loading={saving}>Reset Password</Button>
	{/snippet}
</Modal>
