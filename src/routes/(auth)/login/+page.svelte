<!--
  Halaman Login.
  - Validasi klien via validate.validateLogin (mirror binding backend).
  - 429 (rate limit) → countdown menonaktifkan tombol (backend tak kirim Retry-After).
  - 401/gagal → pesan inline Bahasa Indonesia dari toMessage().
-->
<script lang="ts">
	import { onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import {
		auth,
		authApi,
		defaultRoute,
		validate,
		toMessage,
		isRateLimit,
		retryAfter,
		createCountdown
	} from '$lib';
	import type { Errors } from '$lib/utils/validation';
	import Button from '$lib/components/ui/Button.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';
	import Alert from '$lib/components/ui/Alert.svelte';

	let email = $state('');
	let password = $state('');
	let errors = $state<Errors>({});
	let formError = $state('');
	let loading = $state(false);
	let cooldown = $state(0);

	const cd = createCountdown((s) => (cooldown = s));
	onDestroy(cd.stop);

	// Pesan info bila tiba dari sesi yang kedaluwarsa (?session=expired).
	const sessionExpired = $derived(page.url.searchParams.get('session') === 'expired');
	const redirectTo = $derived(page.url.searchParams.get('redirect'));

	const disabled = $derived(loading || cooldown > 0);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		formError = '';
		errors = validate.validateLogin({ email, password });
		if (!validate.isValid(errors)) return;

		loading = true;
		try {
			await authApi.login(email, password);
			const target = redirectTo || (auth.role ? defaultRoute(auth.role) : '/');
			await goto(target, { replaceState: true });
		} catch (err) {
			if (isRateLimit(err)) cd.start(retryAfter(err));
			formError = toMessage(err);
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head><title>Masuk · CRM Telesales</title></svelte:head>

<div class="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
	<div class="w-full max-w-md rounded-3xl border border-line bg-surface p-8 shadow-lg sm:p-10">
		<!-- Urutan atas→bawah: image, kepanjangan CRM, email, password, tombol Masuk. -->
		<div class="mb-8 flex flex-col items-center text-center">
			<img src="/clientBanner.png" alt="Eclectic Consulting" class="h-16 w-auto object-contain" />
			<p class="mt-4 text-sm text-muted">Silakan masuk untuk melanjutkan.</p>
		</div>

		<form onsubmit={handleSubmit} class="space-y-5">
			{#if sessionExpired && !formError}
				<Alert variant="info">Sesi Anda berakhir. Silakan masuk kembali.</Alert>
			{/if}
			{#if formError}
				<Alert variant="error">{formError}</Alert>
			{/if}

			<TextField
				label="Email"
				type="email"
				bind:value={email}
				error={errors.email}
				placeholder="nama@perusahaan.com"
				autocomplete="username"
				required
			/>

			<TextField
				label="Password"
				type="password"
				bind:value={password}
				error={errors.password}
				placeholder="••••••••"
				autocomplete="current-password"
				required
			/>

			<Button type="submit" full {loading} {disabled}>
				{#if cooldown > 0}
					Coba lagi dalam {cooldown}s
				{:else if loading}
					Memproses…
				{:else}
					Masuk
				{/if}
			</Button>
		</form>
	</div>
</div>
