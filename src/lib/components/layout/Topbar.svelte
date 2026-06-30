<!--
  Topbar (banner header bertema merah): toggle sidebar, judul section,
  switch tema terang/gelap, identitas user + logout (dengan konfirmasi FE).
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { auth, authApi, theme, ui, NAV_BY_ROLE, ROLE_LABEL } from '$lib';
	import Icon from '$lib/components/ui/Icon.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';

	const title = $derived.by(() => {
		if (!auth.role) return '';
		const match = NAV_BY_ROLE[auth.role].find(
			(i) => page.url.pathname === i.href || page.url.pathname.startsWith(i.href + '/')
		);
		return match?.label ?? '';
	});

	let confirmLogout = $state(false);
	let loggingOut = $state(false);

	async function doLogout() {
		loggingOut = true;
		await authApi.logout();
		await goto('/login');
	}
</script>

<!-- Banner header: latar brand (merah), teks putih. -->
<header
	class="flex h-16 shrink-0 items-center justify-between gap-3 bg-brand px-4 text-white lg:px-6"
>
	<div class="flex items-center gap-2">
		<!-- Mobile: buka drawer -->
		<button
			type="button"
			class="rounded-lg p-2 text-white/90 hover:bg-white/15 lg:hidden"
			aria-label="Buka menu"
			onclick={() => ui.openMobileNav()}
		>
			<Icon name="menu" size={20} />
		</button>
		<!-- Desktop: ciutkan/buka sidebar -->
		<button
			type="button"
			class="hidden rounded-lg p-2 text-white/90 hover:bg-white/15 lg:inline-flex"
			aria-label="Toggle sidebar"
			title="Buka/tutup sidebar"
			onclick={() => ui.toggleSidebar()}
		>
			<Icon name="panel-left" size={20} />
		</button>
		<h2 class="text-base font-semibold">{title}</h2>
	</div>

	<div class="flex items-center gap-1.5 sm:gap-3">
		<!-- Switch tema -->
		<button
			type="button"
			class="rounded-lg p-2 text-white/90 hover:bg-white/15"
			aria-label={theme.isDark ? 'Mode terang' : 'Mode gelap'}
			title={theme.isDark ? 'Mode terang' : 'Mode gelap'}
			onclick={() => theme.toggle()}
		>
			<Icon name={theme.isDark ? 'sun' : 'moon'} size={20} />
		</button>

		<div class="hidden text-right sm:block">
			<p class="text-sm font-medium text-white">{auth.user?.name ?? '-'}</p>
			<p class="text-xs text-white/80">{auth.role ? ROLE_LABEL[auth.role] : ''}</p>
		</div>
		<div
			class="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-sm font-semibold text-white"
		>
			{(auth.user?.name ?? '?').charAt(0).toUpperCase()}
		</div>
		<button
			type="button"
			onclick={() => (confirmLogout = true)}
			class="rounded-lg p-2 text-white/90 hover:bg-white/15"
			aria-label="Keluar"
			title="Keluar"
		>
			<Icon name="log-out" size={20} />
		</button>
	</div>
</header>

{#if confirmLogout}
	<ConfirmDialog
		title="Keluar"
		message="Anda yakin ingin keluar dari akun ini?"
		confirmLabel="Ya, keluar"
		cancelLabel="Batal"
		danger
		loading={loggingOut}
		onconfirm={doLogout}
		oncancel={() => (confirmLogout = false)}
	/>
{/if}
