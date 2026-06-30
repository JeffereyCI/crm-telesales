<!--
  Pipeline Board — BDM + Telesales.
  Visual funnel: Leads → Contact → Meeting → Close.
  Klik kartu → side panel detail + aksi (update status, meeting, riwayat).
  Filter: periode (Minggu / 1 Bulan / 3 Bulan) diproses client-side.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import {
		leadsApi,
		contactsApi,
		auth,
		can,
		toMessage,
		ACTION_STATUS_LABEL,
		ACTION_STATUS_BADGE,
		RESPONSE_STATUS_LABEL,
		RESPONSE_STATUS_BADGE,
		formatPercent
	} from '$lib';
	import type { LeadMasterViewItem } from '$lib/types/api';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import LoadingState from '$lib/components/ui/LoadingState.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import LeadSidePanel from '$lib/components/pipeline/LeadSidePanel.svelte';

	type Period = 'week' | 'month' | 'quarter';
	type Stage = 'leads' | 'contact' | 'meeting' | 'close';

	const PERIODS: { key: Period; label: string }[] = [
		{ key: 'week', label: 'Minggu' },
		{ key: 'month', label: '1 Bulan' },
		{ key: 'quarter', label: '3 Bulan' }
	];

	const COLUMNS: {
		key: Stage;
		label: string;
		header: string;
		dot: string;
		emptyText: string;
	}[] = [
		{
			key: 'leads',
			label: 'Leads',
			header: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
			dot: 'bg-slate-400',
			emptyText: 'Tidak ada leads baru'
		},
		{
			key: 'contact',
			label: 'Contact',
			header: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
			dot: 'bg-amber-400',
			emptyText: 'Belum ada yang dihubungi'
		},
		{
			key: 'meeting',
			label: 'Meeting',
			header: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
			dot: 'bg-violet-400',
			emptyText: 'Belum ada meeting'
		},
		{
			key: 'close',
			label: 'Close',
			header: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
			dot: 'bg-emerald-400',
			emptyText: 'Belum ada yang closing'
		}
	];

	let all = $state<LeadMasterViewItem[]>([]);
	let loading = $state(true);
	let errorMsg = $state('');
	let period = $state<Period>('month');
	let selected = $state<LeadMasterViewItem | null>(null);

	// Pemetaan stage: prioritas tertinggi menang (close > meeting > contact > leads)
	function toStage(item: LeadMasterViewItem): Stage {
		if (item.response_status === 'tertarik' && item.is_meeting_scheduled) return 'close';
		if (item.is_meeting_scheduled) return 'meeting';
		if (item.response_status === 'tertarik') return 'meeting';
		if (item.action_status !== 'belum_dihubungi') return 'contact';
		return 'leads';
	}

	function smartBadge(item: LeadMasterViewItem): { label: string; tone: string } {
		if (item.response_status) {
			return {
				label: RESPONSE_STATUS_LABEL[item.response_status],
				tone: RESPONSE_STATUS_BADGE[item.response_status]
			};
		}
		return {
			label: ACTION_STATUS_LABEL[item.action_status],
			tone: ACTION_STATUS_BADGE[item.action_status]
		};
	}

	// Filter berdasarkan updated_at vs cutoff periode
	const filtered = $derived.by(() => {
		const days = period === 'week' ? 7 : period === 'month' ? 30 : 90;
		const cutoffMs = Date.now() - days * 86_400_000;
		return all.filter((i) => Date.parse(i.updated_at) >= cutoffMs);
	});

	const board = $derived.by(() => ({
		leads: filtered.filter((i) => toStage(i) === 'leads'),
		contact: filtered.filter((i) => toStage(i) === 'contact'),
		meeting: filtered.filter((i) => toStage(i) === 'meeting'),
		close: filtered.filter((i) => toStage(i) === 'close')
	}));

	const total = $derived(filtered.length);

	// Funnel conversion: berapa persen lead yang sudah progress dari tahap sebelumnya
	const convRate = $derived.by(() => {
		if (total === 0) return { contacted: 0, meeting: 0, close: 0 };
		const contacted = board.contact.length + board.meeting.length + board.close.length;
		const meetingN = board.meeting.length + board.close.length;
		return {
			contacted: total > 0 ? (contacted / total) * 100 : 0,
			meeting: contacted > 0 ? (meetingN / contacted) * 100 : 0,
			close: meetingN > 0 ? (board.close.length / meetingN) * 100 : 0
		};
	});

	async function load() {
		loading = true;
		errorMsg = '';
		try {
			// Ambil hingga 200 item — cukup untuk board.
			// BDM memakai Master View Leads (/leads, khusus BDM); Telesales memakai
			// daftar kontak miliknya (/contacts) karena /leads ditolak server untuk telesales.
			// Keduanya menghasilkan item yang struktur-kompatibel dengan LeadMasterViewItem.
			const res = can(auth.role, 'viewLeads')
				? await leadsApi.listLeads({ limit: 200, page: 1 })
				: await contactsApi.listAllContacts({ limit: 200, page: 1 });
			all = res.data;
			// Refresh item yang sedang terbuka di side panel
			if (selected) {
				const refreshed = res.data.find((i) => i.id === selected!.id);
				if (refreshed) selected = refreshed;
			}
		} catch (err) {
			errorMsg = toMessage(err);
		} finally {
			loading = false;
		}
	}

	function openLead(item: LeadMasterViewItem) {
		selected = item;
	}

	onMount(load);
</script>

<svelte:head><title>Pipeline · CRM Telesales</title></svelte:head>

<PageHeader title="Pipeline Board" description="Visualisasi funnel lintas telesales.">
	{#snippet actions()}
		<div class="flex items-center gap-2">
			<!-- Period filter -->
			<div class="flex rounded-lg border border-line-strong bg-surface p-0.5">
				{#each PERIODS as p (p.key)}
					<button
						type="button"
						onclick={() => (period = p.key)}
						class="rounded-md px-3 py-1 text-xs font-medium transition-colors {period === p.key
							? 'bg-brand text-white shadow-sm'
							: 'text-muted hover:text-ink'}"
					>
						{p.label}
					</button>
				{/each}
			</div>
			<Button variant="secondary" onclick={load} disabled={loading}>
				<Icon name="refresh-cw" size={15} />
			</Button>
		</div>
	{/snippet}
</PageHeader>

{#if loading}
	<LoadingState />
{:else if errorMsg}
	<EmptyState icon="alert-circle" title="Gagal memuat data" description={errorMsg}>
		{#snippet action()}
			<Button variant="secondary" onclick={load}>Coba lagi</Button>
		{/snippet}
	</EmptyState>
{:else if all.length === 0}
	<EmptyState
		icon="layout-kanban"
		title="Belum ada data pipeline"
		description="Data akan muncul setelah ada leads yang masuk."
	/>
{:else}
	<!-- Funnel summary stats -->
	<div class="mb-4 flex flex-wrap items-center gap-3">
		<p class="text-sm text-muted">
			<span class="font-semibold text-ink">{total}</span> lead aktif dalam periode ini
		</p>
		<span class="text-line-strong">|</span>
		<div class="flex items-center gap-3 text-xs">
			<span class="flex items-center gap-1 text-amber-600 dark:text-amber-400">
				<Icon name="arrow-right" size={12} />
				Contacted {formatPercent(convRate.contacted)}
			</span>
			<span class="flex items-center gap-1 text-violet-600 dark:text-violet-400">
				<Icon name="arrow-right" size={12} />
				Meeting {formatPercent(convRate.meeting)}
			</span>
			<span class="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
				<Icon name="arrow-right" size={12} />
				Close {formatPercent(convRate.close)}
			</span>
		</div>
	</div>

	<!-- Board: scroll horizontal, kolom scroll vertikal independen -->
	<div class="flex h-[calc(100vh-16rem)] min-h-[400px] gap-3 overflow-x-auto pb-2">
		{#each COLUMNS as col (col.key)}
			{@const cards = board[col.key]}
			<div class="flex w-[280px] min-w-[280px] shrink-0 flex-col gap-2">
				<!-- Column header -->
				<div class="flex items-center gap-2 rounded-xl px-3 py-2.5 {col.header}">
					<span class="h-2 w-2 rounded-full {col.dot}"></span>
					<span class="text-sm font-semibold">{col.label}</span>
					<span
						class="ml-auto rounded-full bg-white/60 px-2 py-0.5 text-xs font-bold dark:bg-black/25"
					>
						{cards.length}
					</span>
				</div>

				<!-- Cards container (scrollable) -->
				<div class="flex flex-1 flex-col gap-2 overflow-y-auto">
					{#if cards.length === 0}
						<div
							class="rounded-xl border border-dashed border-line py-10 text-center text-xs text-subtle"
						>
							{col.emptyText}
						</div>
					{:else}
						{#each cards as item (item.id)}
							{@const badge = smartBadge(item)}
							<button
								type="button"
								onclick={() => openLead(item)}
								class="w-full rounded-xl border border-line bg-surface p-3 text-left shadow-sm transition-all hover:border-brand/40 hover:shadow-md {selected?.id ===
								item.id
									? 'border-brand ring-2 ring-brand/30'
									: ''}"
							>
								<p class="truncate text-sm font-medium text-ink">{item.name}</p>
								{#if item.job_title}
									<p class="truncate text-xs text-subtle">{item.job_title}</p>
								{/if}
								<p class="mt-1 truncate text-xs font-medium text-brand">{item.company.name}</p>

								<div class="mt-2.5 flex flex-wrap items-center gap-1.5">
									<Badge label={badge.label} tone={badge.tone} />
									{#if item.is_meeting_scheduled}
										<span
											class="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
										>
											<Icon name="check" size={11} /> Meeting
										</span>
									{/if}
								</div>

								{#if item.assigned_to}
									<p class="mt-2 truncate text-xs text-subtle">
										<Icon name="users" size={11} class="inline" />
										{item.assigned_to.name}
									</p>
								{/if}
							</button>
						{/each}
					{/if}
				</div>
			</div>
		{/each}
	</div>
{/if}

{#if selected}
	<LeadSidePanel item={selected} onclose={() => (selected = null)} onupdated={load} />
{/if}
