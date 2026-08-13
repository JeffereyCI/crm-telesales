<script lang="ts">
	import { onMount } from 'svelte';
	import {
		leadsApi,
		toMessage,
		orDash,
		ACTION_STATUS_LABEL,
		ACTION_STATUS_BADGE,
		RESPONSE_STATUS_LABEL,
		RESPONSE_STATUS_BADGE
	} from '$lib';
	import type { ActionStatusInput, ResponseStatus } from '$lib/constants/enums';
	import type { LeadMasterViewItem, Pagination, LeadListFilter } from '$lib/types/api';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Paginator from '$lib/components/ui/Pagination.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import LoadingState from '$lib/components/ui/LoadingState.svelte';
	import ContactSidePanel from '$lib/components/contacts/ContactSidePanel.svelte';
	import WhatsAppBadge from '$lib/components/contacts/WhatsAppBadge.svelte';

	const PAGE_SIZE = 15;

	let contacts = $state<LeadMasterViewItem[]>([]);
	let pagination = $state<Pagination | null>(null);
	let loading = $state(true);
	let errorMsg = $state('');

	let page = $state(1);
	let search = $state('');
	let actionFilter = $state('');
	let responseFilter = $state('tertarik');
	let whatsappFilter = $state('');
	let selected = $state<LeadMasterViewItem | null>(null);

	// Client-side filtering for WhatsApp status since backend doesn't support it directly
	const filteredContacts = $derived(
		contacts.filter((c) => !whatsappFilter || c.whatsapp_status === whatsappFilter)
	);

	let loadController: AbortController | null = null;

	async function load() {
		loadController?.abort();
		const controller = new AbortController();
		loadController = controller;
		loading = true;
		errorMsg = '';

		const filter: LeadListFilter = {
			page,
			limit: PAGE_SIZE,
			search: search || undefined,
			action_status: (actionFilter || undefined) as ActionStatusInput | undefined,
			response_status: (responseFilter || undefined) as ResponseStatus | undefined
		};

		try {
			const res = await leadsApi.listLeads(filter);
			contacts = res.data.map((l) => ({ ...l, phone: l.phone ?? null, email: l.email ?? null }));
			pagination = res.pagination;

			if (selected) {
				const refreshed = contacts.find((c) => c.id === selected!.id);
				if (refreshed) selected = refreshed;
			}
		} catch (err) {
			if (controller.signal.aborted) return;
			errorMsg = toMessage(err);
			contacts = [];
		} finally {
			if (loadController === controller) loading = false;
		}
	}

	onMount(() => {
		void load();
		const onVisible = () => {
			if (document.visibilityState === 'visible') {
				void load();
			}
		};
		document.addEventListener('visibilitychange', onVisible);
		return () => {
			loadController?.abort();
			clearTimeout(debounce);
			document.removeEventListener('visibilitychange', onVisible);
		};
	});

	let debounce: ReturnType<typeof setTimeout>;
	function onSearchInput() {
		clearTimeout(debounce);
		debounce = setTimeout(() => {
			page = 1;
			void load();
		}, 350);
	}

	function onFilterChange() {
		page = 1;
		void load();
	}

	function goPage(p: number) {
		page = p;
		void load();
	}

	function openContact(c: LeadMasterViewItem) {
		selected = c;
	}
</script>

<svelte:head><title>Kontak · CRM Telesales</title></svelte:head>

<PageHeader
	title="Kontak"
	description="Daftar prospek dan kontak pelanggan terpusat untuk aktivitas telesales."
>
	{#snippet actions()}
		<div class="flex items-center gap-2">
			<span class="mr-1 inline-flex items-center gap-1 rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-semibold text-muted">
				<span class="h-1.5 w-1.5 rounded-full {loading ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}"></span>
				{loading ? 'Memuat...' : 'Sinkron'}
			</span>
			<Button variant="secondary" onclick={load} disabled={loading}>
				<Icon name="refresh-cw" size={16} /> Muat ulang
			</Button>
		</div>
	{/snippet}
</PageHeader>

<!-- Toolbar filter -->
<div class="mb-4 flex flex-wrap items-center gap-3">
	<!-- Search -->
	<div class="min-w-56 flex-1">
		<input
			type="search"
			bind:value={search}
			oninput={onSearchInput}
			placeholder="Cari nama / perusahaan…"
			maxlength="200"
			class="h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink focus:border-brand focus:ring-2 focus:ring-brand/25 focus:outline-none"
		/>
	</div>

	<!-- WhatsApp Status Filter -->
	<select
		bind:value={whatsappFilter}
		class="h-10 min-w-40 shrink-0 rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:border-brand focus:ring-2 focus:ring-brand/25 focus:outline-none"
		aria-label="Filter status WA"
	>
		<option value="">Semua Status WA</option>
		<option value="active">Active</option>
		<option value="inactive">Inactive</option>
		<option value="unverified">Unverified</option>
	</select>

	<!-- Action Status Filter -->
	<select
		bind:value={actionFilter}
		onchange={onFilterChange}
		class="h-10 min-w-40 shrink-0 rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:border-brand focus:ring-2 focus:ring-brand/25 focus:outline-none"
		aria-label="Filter status aksi"
	>
		<option value="">Semua Status Aksi</option>
		<option value="belum_dihubungi">Belum Dihubungi</option>
		<option value="sudah_dihubungi">Sudah Dihubungi</option>
		<option value="tidak_bisa_dihubungi">Tidak Bisa Dihubungi</option>
	</select>

	<!-- Response Status Filter -->
	<select
		bind:value={responseFilter}
		onchange={onFilterChange}
		class="h-10 min-w-40 shrink-0 rounded-lg border border-line bg-surface px-3 text-sm text-ink focus:border-brand focus:ring-2 focus:ring-brand/25 focus:outline-none"
		aria-label="Filter status respon"
	>
		<option value="">Semua Status Respon</option>
		<option value="tertarik">Tertarik</option>
		<option value="ditolak">Ditolak</option>
		<option value="sudah_pakai_lain">Sudah Pakai Lain</option>
		<option value="belum_perlu">Belum Perlu</option>
		<option value="tidak_dibalas">Tidak Dibalas</option>
	</select>
</div>

<!-- Data Table -->
<div class="overflow-hidden rounded-xl border border-line bg-surface">
	{#if loading}
		<LoadingState />
	{:else if errorMsg}
		<EmptyState icon="alert-circle" title="Gagal memuat data" description={errorMsg}>
			{#snippet action()}
				<Button variant="secondary" onclick={load}>Coba lagi</Button>
			{/snippet}
		</EmptyState>
	{:else if filteredContacts.length === 0}
		<EmptyState
			icon="contact-2"
			title="Tidak ada kontak ditemukan"
			description="Sesuaikan filter pencarian atau buat kontak baru dari detail perusahaan."
		/>
	{:else}
		<div class="overflow-x-auto">
			<table class="w-full text-left text-xs">
				<thead class="border-b border-line bg-surface-2 text-ink-soft font-semibold">
					<tr>
						<th class="p-3 font-semibold">Nama</th>
						<th class="p-3 font-semibold">Jabatan</th>
						<th class="p-3 font-semibold">Perusahaan</th>
						<th class="p-3 font-semibold">WhatsApp Status</th>
						<th class="p-3 font-semibold">Action Status</th>
						<th class="p-3 font-semibold">Response Status</th>
						<th class="p-3 font-semibold text-right">Aksi</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-line/60">
					{#each filteredContacts as contact (contact.id)}
						<tr
							class="hover:bg-surface-2/60 transition-colors {selected?.id === contact.id ? 'bg-brand-soft/30' : ''}"
						>
							<td class="p-3">
								<button
									type="button"
									onclick={() => openContact(contact)}
									class="font-semibold text-ink hover:text-brand hover:underline text-left"
								>
									{contact.name}
								</button>
							</td>
							<td class="p-3 text-muted">{orDash(contact.job_title)}</td>
							<td class="p-3">
								<a
									href="/companies/{contact.company.id}"
									class="font-semibold text-brand hover:underline"
								>
									{contact.company.name}
								</a>
							</td>
							<td class="p-3">
								<WhatsAppBadge status={contact.whatsapp_status} showNull />
							</td>
							<td class="p-3">
								<Badge
									label={ACTION_STATUS_LABEL[contact.action_status]}
									tone={ACTION_STATUS_BADGE[contact.action_status]}
								/>
							</td>
							<td class="p-3">
								{#if contact.response_status}
									<Badge
										label={RESPONSE_STATUS_LABEL[contact.response_status]}
										tone={RESPONSE_STATUS_BADGE[contact.response_status]}
									/>
								{:else}
									<span class="text-muted">—</span>
								{/if}
							</td>
							<td class="p-3 text-right">
								<div class="inline-flex items-center gap-1.5">
									<button
										type="button"
										onclick={() => openContact(contact)}
										class="inline-flex items-center gap-1 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs font-semibold text-ink-soft hover:bg-surface-3 transition-colors"
									>
										Aksi / Detail
									</button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		{#if pagination}
			<Paginator
				page={pagination.current_page}
				totalPages={pagination.total_pages}
				totalItems={pagination.total_items}
				onpage={goPage}
			/>
		{/if}
	{/if}
</div>

{#if selected}
	<ContactSidePanel item={selected} onclose={() => (selected = null)} onupdated={load} />
{/if}
