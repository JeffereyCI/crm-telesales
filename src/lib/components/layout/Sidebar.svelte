<!--
  Sidebar navigasi. Menu diambil dari NAV_BY_ROLE sesuai role aktif
  (mencerminkan matriks RBAC backend).
  - Mobile: overlay drawer (ui.mobileNavOpen).
  - Desktop: bisa diciutkan jadi rail ikon (ui.sidebarCollapsed).
  - Item aktif disorot dengan tema merah (brand).
-->
<script lang="ts">
	import { page } from '$app/state';
	import { auth, ui, NAV_BY_ROLE } from '$lib';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Logo from '$lib/components/ui/Logo.svelte';

	const items = $derived(auth.role ? NAV_BY_ROLE[auth.role] : []);
	const collapsed = $derived(ui.sidebarCollapsed);

	function isActive(href: string): boolean {
		return page.url.pathname === href || page.url.pathname.startsWith(href + '/');
	}
</script>

<!-- Overlay mobile -->
{#if ui.mobileNavOpen}
	<button
		class="fixed inset-0 z-30 bg-slate-900/50 lg:hidden"
		aria-label="Tutup menu"
		onclick={() => ui.closeMobileNav()}
	></button>
{/if}

<aside
	class="fixed inset-y-0 left-0 z-40 flex flex-col border-r border-line bg-surface transition-all duration-200 lg:static lg:translate-x-0 {ui.mobileNavOpen
		? 'translate-x-0'
		: '-translate-x-full'} {collapsed ? 'w-16' : 'w-64'}"
>
	<div
		class="flex h-16 items-center border-b border-line {collapsed ? 'justify-center px-0' : 'px-5'}"
	>
		<a href="/" aria-label="CRM Telesales" class="flex items-center">
			<Logo compact={collapsed} />
		</a>
	</div>

	<nav class="flex-1 space-y-1 overflow-y-auto p-3">
		{#each items as item (item.href)}
			<a
				href={item.href}
				onclick={() => ui.closeMobileNav()}
				aria-current={isActive(item.href) ? 'page' : undefined}
				title={collapsed ? item.label : undefined}
				class="flex items-center rounded-lg text-sm font-medium transition-colors {collapsed
					? 'justify-center px-0 py-2.5'
					: 'gap-3 px-3 py-2'} {isActive(item.href)
					? 'bg-brand-soft text-brand'
					: 'text-muted hover:bg-surface-3 hover:text-ink'}"
			>
				{#if item.icon}<Icon name={item.icon} size={19} />{/if}
				{#if !collapsed}{item.label}{/if}
			</a>
		{/each}
	</nav>

	<!-- Toggle ciutkan (desktop) -->
	<div class="hidden border-t border-line p-3 lg:block">
		<button
			type="button"
			onclick={() => ui.toggleSidebar()}
			class="flex w-full items-center rounded-lg text-sm font-medium text-muted hover:bg-surface-3 hover:text-ink {collapsed
				? 'justify-center px-0 py-2.5'
				: 'gap-3 px-3 py-2'}"
			aria-label={collapsed ? 'Buka sidebar' : 'Tutup sidebar'}
			title={collapsed ? 'Buka sidebar' : 'Tutup sidebar'}
		>
			<Icon name="chevrons-left" size={19} class={collapsed ? 'rotate-180' : ''} />
			{#if !collapsed}Ciutkan{/if}
		</button>
	</div>
</aside>
