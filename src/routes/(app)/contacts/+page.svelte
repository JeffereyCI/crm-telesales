<!--
  Kontak — Master View (kontak terkualifikasi).
  Hanya menampilkan lead yang sudah berstatus respon "Tertarik" — sesuai definisi
  funnel: lead Qualified menjadi "Contact" yang siap diserahkan ke manajer.
  Tabel lintas perusahaan: NAMA, JABATAN, ACCOUNT, NO WA, EMAIL, STATUS.
  Klik baris → side panel detail + aksi (status update, meeting, aktivitas).
  Tanpa tombol "+ Tambah Kontak" — data otomatis dari Leads / Perusahaan.
-->
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
	let selected = $state<LeadMasterViewItem | null>(null);

	// STATUS tampil: response_status lebih informatif; fallback ke action_status
	function smartStatus(c: LeadMasterViewItem): { label: string; tone: string } {
		if (c.response_status) {
			return {
				label: RESPONSE_STATUS_LABEL[c.response_status],
				tone: RESPONSE_STATUS_BADGE[c.response_status]
			};
		}
		return {
			label: ACTION_STATUS_LABEL[c.action_status],
			tone: ACTION_STATUS_BADGE[c.action_status]
		};
	}

	// Batalkan request sebelumnya agar respons lama (mis. ketikan cepat) tidak
	// menimpa hasil terbaru secara acak (race condition).
	let loadController: AbortController | null = null;

	async function load() {
		loadController?.abort();
		const controller = new AbortController();
		loadController = controller;
		loading = true;
		errorMsg = '';
		// Kontak = lead terkualifikasi: selalu dibatasi ke response_status "tertarik".
		// Sumber data: GET /leads (BDM + Telesales; telesales di-scope backend).
		const filter: LeadListFilter = {
			page,
			limit: PAGE_SIZE,
			search: search || undefined,
			response_status: 'tertarik'
		};
		try {
			const res = await leadsApi.listLeads(filter, controller.signal);
			contacts = res.data;
			pagination = res.pagination;
			// Perbarui item yang sedang dibuka di side panel
			if (selected) {
				const refreshed = res.data.find((c) => c.id === selected!.id);
				if (refreshed) selected = refreshed;
			}
		} catch (err) {
			if (controller.signal.aborted) return; // digantikan request lebih baru
			errorMsg = toMessage(err);
			contacts = [];
		} finally {
			if (loadController === controller) loading = false;
		}
	}

	onMount(() => {
		void load();
		return () => {
			loadController?.abort();
			clearTimeout(debounce);
		};
	});

	let debounce: ReturnType<typeof setTimeout>;
	function onSearchInput() {
		clearTimeout(debounce);
		debounce = setTimeout(() => {
			page = 1;
			load();
		}, 350);
	}

	function goPage(p: number) {
		page = p;
		load();
	}

	function openContact(c: LeadMasterViewItem) {
		selected = c;
	}
</script>

<svelte:head><title>Kontak · CRM Telesales</title></svelte:head>

<PageHeader
	title="Kontak"
	description="Lead terkualifikasi (Tertarik) yang siap di-follow up lintas perusahaan."
>
	{#snippet actions()}
		<Button variant="secondary" onclick={load} disabled={loading}>
			<Icon name="refresh-cw" size={16} /> Muat ulang
		</Button>
	{/snippet}
</PageHeader>

<div class="mb-4">
	<input
		type="search"
		bind:value={search}
		oninput={onSearchInput}
		placeholder="Cari nama / jabatan / perusahaan…"
		maxlength="200"
		class="h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink focus:border-brand focus:ring-2 focus:ring-brand/25 focus:outline-none"
	/>
</div>

<div class="overflow-hidden rounded-xl border border-line bg-surface">
	{#if loading}
		<LoadingState />
	{:else if errorMsg}
		<EmptyState icon="alert-circle" title="Gagal memuat data" description={errorMsg}>
			{#snippet action()}
				<Button variant="secondary" onclick={load}>Coba lagi</Button>
			{/snippet}
		</EmptyState>
	{:else if contacts.length === 0}
		<EmptyState
			icon="contact-2"
			title="Belum ada kontak terkualifikasi"
			description="Kontak muncul otomatis saat lead berstatus respon Tertarik."
		/>
	{:else}
		<div class="overflow-x-auto">
			<table class="w-full min-w-[700px] text-center text-sm">
				<thead class="border-b border-line bg-surface-2 text-xs text-muted uppercase">
					<tr>
						<th class="px-4 py-3 text-left font-medium">Nama</th>
						<th class="px-4 py-3 font-medium">Jabatan</th>
						<th class="px-4 py-3 font-medium">Account</th>
						<th class="px-4 py-3 font-medium">No WA</th>
						<th class="px-4 py-3 font-medium">Status WA</th>
						<th class="px-4 py-3 font-medium">Email</th>
						<th class="px-4 py-3 font-medium">Status</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-line">
					{#each contacts as contact (contact.id)}
						{@const st = smartStatus(contact)}
						<tr
							class="cursor-pointer hover:bg-surface-2 {selected?.id === contact.id
								? 'bg-brand-soft'
								: ''}"
							onclick={() => openContact(contact)}
							onkeydown={(e) => e.key === 'Enter' && openContact(contact)}
							tabindex="0"
							role="button"
							aria-label="Buka detail {contact.name}"
						>
							<td class="px-4 py-3 text-left">
								<p class="font-medium text-ink">{contact.name}</p>
							</td>
							<td class="px-4 py-3">
								<div class="mx-auto max-w-[140px] truncate text-muted">
									{orDash(contact.job_title)}
								</div>
							</td>
							<td class="px-4 py-3">
								<div class="mx-auto max-w-[160px] truncate font-medium text-ink-soft">
									{contact.company.name}
								</div>
							</td>
							<td class="px-4 py-3">
								<div class="mx-auto max-w-[130px] truncate text-muted">
									{orDash(contact.phone)}
								</div>
							</td>
							<td class="px-4 py-3">
								<div class="flex justify-center">
									<WhatsAppBadge status={contact.whatsapp_status} showNull />
								</div>
							</td>
							<td class="px-4 py-3">
								<div class="mx-auto max-w-[170px] truncate text-muted">
									{orDash(contact.email)}
								</div>
							</td>
							<td class="px-4 py-3">
								<Badge label={st.label} tone={st.tone} />
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
