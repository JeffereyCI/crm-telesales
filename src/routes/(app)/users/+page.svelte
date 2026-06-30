<script lang="ts">
	import { onMount } from 'svelte';
	import {
		auth,
		usersApi,
		toMessage,
		ROLES,
		ROLE_LABEL,
		USER_STATUSES,
		USER_STATUS_LABEL,
		USER_STATUS_BADGE
	} from '$lib';
	import { toast } from '$lib/stores/toast.svelte';
	import type { UserStatus } from '$lib/constants/enums';
	import type { UserResponse } from '$lib/types/api';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Paginator from '$lib/components/ui/Pagination.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import LoadingState from '$lib/components/ui/LoadingState.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import UserFormModal from '$lib/components/users/UserFormModal.svelte';
	import ResetPasswordModal from '$lib/components/users/ResetPasswordModal.svelte';

	const PAGE_SIZE = 10;
	const meId = auth.user?.id; // id admin yang sedang login (cegah kunci diri sendiri)

	// Backend GET /users mengirim ARRAY POLOS & tanpa pagination → ambil semua,
	// lalu filter + paginate di klien.
	let allUsers = $state<UserResponse[]>([]);
	let loading = $state(true);
	let errorMsg = $state('');

	let page = $state(1);
	let search = $state('');
	let roleFilter = $state('');
	let statusFilter = $state('');

	let showForm = $state(false);
	let editTarget = $state<UserResponse | null>(null);
	let resetTarget = $state<UserResponse | null>(null);
	let statusTarget = $state<UserResponse | null>(null);
	let statusBusy = $state(false);

	const roleOptions = ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }));
	const statusOptions = USER_STATUSES.map((s) => ({ value: s, label: USER_STATUS_LABEL[s] }));

	// ── Filter + pagination sisi-klien (reaktif) ──────────────────────────────
	const filtered = $derived.by(() => {
		const q = search.trim().toLowerCase();
		return allUsers.filter((u) => {
			if (roleFilter && u.role !== roleFilter) return false;
			if (statusFilter && u.status !== statusFilter) return false;
			if (q && !`${u.name} ${u.email}`.toLowerCase().includes(q)) return false;
			return true;
		});
	});
	const totalPages = $derived(Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
	const pageItems = $derived(filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE));

	async function load() {
		loading = true;
		errorMsg = '';
		try {
			allUsers = await usersApi.listUsers();
		} catch (err) {
			errorMsg = toMessage(err);
			allUsers = [];
		} finally {
			loading = false;
		}
	}

	onMount(load);

	// Filter/search jalan reaktif (client-side) — handler hanya reset ke halaman 1.
	function resetPage() {
		page = 1;
	}
	function goPage(p: number) {
		page = p;
	}

	function openCreate() {
		editTarget = null;
		showForm = true;
	}
	function openEdit(u: UserResponse) {
		editTarget = u;
		showForm = true;
	}
	function onSaved() {
		showForm = false;
		editTarget = null;
		load();
	}

	async function confirmToggleStatus() {
		if (!statusTarget) return;
		const next: UserStatus = statusTarget.status === 'active' ? 'inactive' : 'active';
		statusBusy = true;
		try {
			await usersApi.updateUserStatus(statusTarget.id, next);
			toast.success(`User di-${next === 'active' ? 'aktifkan' : 'nonaktifkan'}.`);
			statusTarget = null;
			load();
		} catch (err) {
			toast.error(toMessage(err));
		} finally {
			statusBusy = false;
		}
	}
</script>

<svelte:head><title>Manajemen User · CRM Telesales</title></svelte:head>

<PageHeader title="Manajemen User" description="Kelola akun admin, BDM, dan telesales.">
	{#snippet actions()}
		<Button onclick={openCreate}>
			<Icon name="users" size={16} /> Tambah User
		</Button>
	{/snippet}
</PageHeader>

<!-- Toolbar filter -->
<div class="mb-4 flex flex-wrap items-center gap-3">
	<div class="relative min-w-56 flex-1">
		<input
			type="search"
			bind:value={search}
			oninput={resetPage}
			placeholder="Cari nama atau email…"
			maxlength="100"
			class="h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink focus:border-brand focus:ring-2 focus:ring-brand/25 focus:outline-none"
		/>
	</div>
	<div class="w-40">
		<Select
			bind:value={roleFilter}
			options={roleOptions}
			placeholder="Semua role"
			onchange={resetPage}
		/>
	</div>
	<div class="w-40">
		<Select
			bind:value={statusFilter}
			options={statusOptions}
			placeholder="Semua status"
			onchange={resetPage}
		/>
	</div>
</div>

<!-- Tabel -->
<div class="overflow-hidden rounded-xl border border-line bg-surface">
	{#if loading}
		<LoadingState />
	{:else if errorMsg}
		<EmptyState icon="alert-circle" title="Gagal memuat data" description={errorMsg}>
			{#snippet action()}
				<Button variant="secondary" onclick={load}>Coba lagi</Button>
			{/snippet}
		</EmptyState>
	{:else if filtered.length === 0}
		<EmptyState icon="users" title="Belum ada user" description="Tambahkan user untuk memulai.">
			{#snippet action()}
				<Button onclick={openCreate}>Tambah User</Button>
			{/snippet}
		</EmptyState>
	{:else}
		<div class="overflow-x-auto">
			<table class="w-full text-center text-sm">
				<thead class="border-b border-line bg-surface-2 text-xs text-muted uppercase">
					<tr>
						<th class="px-4 py-3 font-medium">Nama</th>
						<th class="px-4 py-3 font-medium">Email</th>
						<th class="px-4 py-3 font-medium">Role</th>
						<th class="px-4 py-3 font-medium">Status</th>
						<th class="px-4 py-3 font-medium">Aksi</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-line">
					{#each pageItems as u (u.id)}
						<tr class="hover:bg-surface-2">
							<td class="px-4 py-3 font-medium text-ink">
								{u.name}
								{#if u.id === meId}
									<span
										class="ml-1.5 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand"
										>Anda</span
									>
								{/if}
							</td>
							<td class="px-4 py-3 text-muted">{u.email}</td>
							<td class="px-4 py-3 text-muted">{ROLE_LABEL[u.role]}</td>
							<td class="px-4 py-3">
								<Badge label={USER_STATUS_LABEL[u.status]} tone={USER_STATUS_BADGE[u.status]} />
							</td>
							<td class="px-4 py-3">
								<!-- Aksi: lebar konsisten antar baris (tiap tombol min-width sama,
								     baris "diri sendiri" memakai tombol disabled, bukan span). -->
								<div class="flex items-center justify-center gap-1">
									<button
										type="button"
										class="inline-flex min-w-[5rem] justify-center rounded-lg px-2 py-1 text-xs font-medium text-brand hover:bg-brand-soft"
										onclick={() => openEdit(u)}
									>
										Edit
									</button>
									<button
										type="button"
										class="inline-flex min-w-[5rem] justify-center rounded-lg px-2 py-1 text-xs font-medium text-muted hover:bg-surface-3"
										onclick={() => (resetTarget = u)}
									>
										Reset
									</button>
									{#if u.id === meId}
										<button
											type="button"
											disabled
											class="inline-flex min-w-[6.5rem] cursor-not-allowed justify-center rounded-lg px-2 py-1 text-xs font-medium text-subtle"
											title="Tidak bisa menonaktifkan akun sendiri"
										>
											Nonaktifkan
										</button>
									{:else}
										<button
											type="button"
											class="inline-flex min-w-[6.5rem] justify-center rounded-lg px-2 py-1 text-xs font-medium {u.status ===
											'active'
												? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40'
												: 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'}"
											onclick={() => (statusTarget = u)}
										>
											{u.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
										</button>
									{/if}
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<Paginator {page} {totalPages} totalItems={filtered.length} onpage={goPage} />
	{/if}
</div>

{#if showForm}
	<UserFormModal user={editTarget} onclose={() => (showForm = false)} onsaved={onSaved} />
{/if}

{#if resetTarget}
	<ResetPasswordModal
		user={resetTarget}
		onclose={() => (resetTarget = null)}
		onsaved={() => (resetTarget = null)}
	/>
{/if}

{#if statusTarget}
	<ConfirmDialog
		title={statusTarget.status === 'active' ? 'Nonaktifkan User' : 'Aktifkan User'}
		message={`Yakin ingin ${statusTarget.status === 'active' ? 'menonaktifkan' : 'mengaktifkan'} ${statusTarget.name}?`}
		confirmLabel={statusTarget.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
		danger={statusTarget.status === 'active'}
		loading={statusBusy}
		onconfirm={confirmToggleStatus}
		oncancel={() => (statusTarget = null)}
	/>
{/if}
