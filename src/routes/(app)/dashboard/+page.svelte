<!--
  Dashboard — ringkasan metrik + chart.
  - Telesales : laporan pribadi (GET /reports/personal).
  - BDM       : laporan tim (GET /reports/team) + performa per telesales.
  Tombol "Muat ulang" + auto-refresh saat tab kembali fokus → angka selalu segar.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import {
		auth,
		can,
		reportsApi,
		meetingsApi,
		toMessage,
		formatNumber,
		formatPercent,
		formatDate,
		ROLE_LABEL,
		RESPONSE_STATUS_LABEL,
		ACTION_STATUS_LABEL
	} from '$lib';
	import type {
		PersonalReportResponse,
		TeamReportResponse,
		ReportFilter,
		UpcomingMeetingItem
	} from '$lib/types/api';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import StatCard from '$lib/components/ui/StatCard.svelte';
	import FunnelChart from '$lib/components/dashboard/FunnelChart.svelte';
	import DonutChart from '$lib/components/dashboard/DonutChart.svelte';
	import PerformanceLeaderboard from '$lib/components/dashboard/PerformanceLeaderboard.svelte';
	import Alert from '$lib/components/ui/Alert.svelte';
	import LoadingState from '$lib/components/ui/LoadingState.svelte';

	const isTeam = can(auth.role, 'viewTeamReport'); // bdm
	const isPersonal = can(auth.role, 'viewPersonalReport'); // telesales

	const periodOptions = [
		{ value: 'this_week', label: 'Minggu Ini' },
		{ value: 'this_month', label: 'Bulan Ini' },
		{ value: 'this_year', label: 'Tahun Ini' }
	];
	let period = $state<'this_week' | 'this_month' | 'this_year'>('this_month');

	let personal = $state<PersonalReportResponse | null>(null);
	let team = $state<TeamReportResponse | null>(null);
	let loading = $state(true);
	let errorMsg = $state('');

	async function load() {
		loading = true;
		errorMsg = '';
		const filter: ReportFilter = { period };
		try {
			if (isTeam) {
				team = await reportsApi.getTeamReport(filter);
			} else if (isPersonal) {
				personal = await reportsApi.getPersonalReport(filter);
			}
		} catch (err) {
			errorMsg = toMessage(err);
		} finally {
			loading = false;
		}
	}

	// ── Agenda / jadwal mendatang (GET /meetings/upcoming) ────────────────────
	// State terpisah dari laporan: kegagalan kalender tidak mengosongkan dashboard,
	// dan ganti periode laporan tidak ikut memuat ulang kalender.
	const AGENDA_DAYS = 30; // rentang: hari ini → +30 hari
	let meetings = $state<UpcomingMeetingItem[]>([]);
	let meetingsLoading = $state(true);
	let meetingsError = $state('');

	/** Date → "YYYY-MM-DD" pakai tanggal lokal (hindari geser hari akibat UTC). */
	function toDateStr(d: Date): string {
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${y}-${m}-${day}`;
	}

	/** "14:30:00" / "14:30" → "14:30". Null-safe. */
	function formatTime(value: string | null | undefined): string {
		if (!value) return '-';
		const m = value.match(/^(\d{2}):(\d{2})/);
		return m ? `${m[1]}:${m[2]}` : value;
	}

	async function loadMeetings() {
		meetingsLoading = true;
		meetingsError = '';
		const now = new Date();
		// Konstruktor tunggal (bukan mutasi) → aman dari lint & normalisasi overflow bulan.
		const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + AGENDA_DAYS);
		try {
			const res = await meetingsApi.getUpcoming({
				start_date: toDateStr(now),
				end_date: toDateStr(end),
				limit: 50
			});
			meetings = res.data;
		} catch (err) {
			meetingsError = toMessage(err);
		} finally {
			meetingsLoading = false;
		}
	}

	onMount(() => {
		load();
		loadMeetings();
		// Saat user balik ke tab, segarkan angka + agenda (input dari halaman lain ikut terlihat).
		const onVisible = () => {
			if (document.visibilityState === 'visible') {
				load();
				loadMeetings();
			}
		};
		document.addEventListener('visibilitychange', onVisible);
		return () => document.removeEventListener('visibilitychange', onVisible);
	});

	function changePeriod() {
		load();
	}

	// ── Chart data telesales (reaktif) ────────────────────────────────────────
	// Funnel pipeline: tahap menurun dari total kontak → meeting, agar telesales
	// langsung melihat di mana pipeline menyusut (lebih kontekstual dari bar lepas).
	const funnelStages = $derived(
		personal
			? [
					{ label: 'Total Kontak', value: personal.summary.total_contacts, tone: 'bg-slate-500' },
					{
						label: ACTION_STATUS_LABEL.sudah_dihubungi,
						value: personal.summary.sudah_dihubungi,
						tone: 'bg-blue-500'
					},
					{
						label: RESPONSE_STATUS_LABEL.tertarik,
						value: personal.summary.tertarik,
						tone: 'bg-positive'
					},
					{
						label: 'Meeting Terjadwal',
						value: personal.summary.meetings_scheduled,
						tone: 'bg-brand'
					}
				]
			: []
	);
	// Rincian respon = komposisi part-to-whole → Donut (proporsi tiap hasil
	// terhadap total respon). Warna selaras dengan palet badge status respon.
	const responseDonut = $derived(
		personal
			? [
					{
						label: RESPONSE_STATUS_LABEL.tertarik,
						value: personal.summary.tertarik,
						color: '#10b981'
					},
					{
						label: RESPONSE_STATUS_LABEL.ditolak,
						value: personal.summary.ditolak,
						color: '#ef4444'
					},
					{
						label: RESPONSE_STATUS_LABEL.belum_perlu,
						value: personal.summary.belum_perlu,
						color: '#a1a1aa'
					},
					{
						label: RESPONSE_STATUS_LABEL.tidak_dibalas,
						value: personal.summary.tidak_dibalas,
						color: '#f59e0b'
					},
					{
						label: RESPONSE_STATUS_LABEL.sudah_pakai_lain,
						value: personal.summary.sudah_pakai_lain,
						color: '#8b5cf6'
					}
				]
			: []
	);

	// ── Chart data BDM (reaktif) ──────────────────────────────────────────────
	// Funnel tim: pipeline agregat seluruh telesales (kesehatan pipeline tim).
	// Dihubungi = total kontak yang sudah dihubungi (jumlah lintas telesales).
	const teamFunnelStages = $derived(
		team
			? [
					{ label: 'Total Kontak', value: team.team_summary.total_contacts, tone: 'bg-slate-500' },
					{
						label: ACTION_STATUS_LABEL.sudah_dihubungi,
						value: team.per_telesales.reduce((s, t) => s + t.sudah_dihubungi, 0),
						tone: 'bg-blue-500'
					},
					{ label: 'Meeting Terjadwal', value: team.team_summary.total_meetings, tone: 'bg-brand' }
				]
			: []
	);
</script>

<svelte:head><title>Dashboard · CRM Telesales</title></svelte:head>

<PageHeader
	title="Dashboard"
	description={`Selamat datang, ${auth.user?.name ?? ''} (${auth.role ? ROLE_LABEL[auth.role] : ''}).`}
>
	{#snippet actions()}
		<div class="flex items-center gap-2">
			<div class="w-40">
				<Select bind:value={period} options={periodOptions} onchange={changePeriod} />
			</div>
			<Button variant="secondary" onclick={load} disabled={loading}>
				<Icon name="refresh-cw" size={16} /> Muat ulang
			</Button>
		</div>
	{/snippet}
</PageHeader>

{#if loading}
	<div class="rounded-xl border border-line bg-surface">
		<LoadingState />
	</div>
{:else if errorMsg}
	<Alert variant="error">{errorMsg}</Alert>
{:else if isTeam && team}
	<!-- ── BDM: monitoring tim ───────────────────────────────────────────── -->
	<div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<StatCard
			label="Telesales Aktif"
			value={formatNumber(team.team_summary.total_telesales)}
			icon="users"
			tone="bg-brand-soft text-brand"
		/>
		<StatCard
			label="Total Kontak"
			value={formatNumber(team.team_summary.total_contacts)}
			icon="users"
			tone="bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
		/>
		<StatCard
			label="Meeting Terjadwal"
			value={formatNumber(team.team_summary.total_meetings)}
			icon="calendar"
			tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
		/>
		<StatCard
			label="Konversi Keseluruhan"
			value={formatPercent(team.team_summary.overall_conversion_rate)}
			icon="trending-up"
			tone="bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400"
		/>
	</div>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
		<!-- Funnel tim: kesehatan pipeline agregat (Total → Dihubungi → Meeting). -->
		<div class="rounded-xl border border-line bg-surface p-5 lg:col-span-1">
			<h2 class="mb-1 text-sm font-semibold text-ink-soft">Pipeline Tim</h2>
			<p class="mb-4 text-xs text-subtle">Alur agregat seluruh telesales.</p>
			<FunnelChart stages={teamFunnelStages} />
		</div>
		<!-- Leaderboard performa: menonjolkan top performer & banding antar-sales. -->
		<div class="rounded-xl border border-line bg-surface p-5 lg:col-span-2">
			<PerformanceLeaderboard data={team.per_telesales} />
		</div>
	</div>
{:else if isPersonal && personal}
	<!-- ── Telesales: laporan pribadi ───────────────────────────────────── -->
	<div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<StatCard
			label="Perusahaan Ditugaskan"
			value={formatNumber(personal.summary.total_companies_assigned)}
			icon="building-2"
			tone="bg-brand-soft text-brand"
		/>
		<StatCard
			label="Total Kontak"
			value={formatNumber(personal.summary.total_contacts)}
			icon="users"
			tone="bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
		/>
		<StatCard
			label="Meeting Terjadwal"
			value={formatNumber(personal.summary.meetings_scheduled)}
			icon="calendar"
			tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
		/>
		<StatCard
			label="Tingkat Konversi"
			value={formatPercent(personal.conversion_rate)}
			icon="trending-up"
			tone="bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400"
			hint="Tertarik / total kontak"
		/>
	</div>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
		<div class="rounded-xl border border-line bg-surface p-5">
			<h2 class="mb-1 text-sm font-semibold text-ink-soft">Pipeline Telesales</h2>
			<p class="mb-4 text-xs text-subtle">Alur dari total kontak hingga meeting terjadwal.</p>
			<FunnelChart stages={funnelStages} />
		</div>
		<div class="rounded-xl border border-line bg-surface p-5">
			<h2 class="mb-1 text-sm font-semibold text-ink-soft">Komposisi Status Respon</h2>
			<p class="mb-4 text-xs text-subtle">Proporsi hasil respon dari kontak yang dihubungi.</p>
			<DonutChart data={responseDonut} centerLabel="Respon" />
		</div>
	</div>
{:else}
	<div class="rounded-xl border border-dashed border-line bg-surface p-8 text-center">
		<p class="text-sm text-muted">Tidak ada laporan untuk role ini.</p>
	</div>
{/if}

<!-- ── Agenda / jadwal mendatang (BDM & Telesales) ─────────────────────────── -->
<section class="mt-6 rounded-xl border border-line bg-surface p-5">
	<div class="mb-4 flex items-center justify-between gap-2">
		<div>
			<h2 class="flex items-center gap-2 text-sm font-semibold text-ink-soft">
				<Icon name="calendar" size={16} /> Agenda Mendatang
			</h2>
			<p class="text-xs text-subtle">Meeting terjadwal {AGENDA_DAYS} hari ke depan.</p>
		</div>
		<Button variant="ghost" onclick={loadMeetings} disabled={meetingsLoading}>
			<Icon name="refresh-cw" size={14} /> Muat ulang
		</Button>
	</div>

	{#if meetingsLoading}
		<LoadingState />
	{:else if meetingsError}
		<Alert variant="error">{meetingsError}</Alert>
	{:else if meetings.length === 0}
		<div class="rounded-lg border border-dashed border-line p-6 text-center">
			<p class="text-sm text-muted">Belum ada meeting terjadwal dalam rentang ini.</p>
		</div>
	{:else}
		<ul class="divide-y divide-line">
			{#each meetings as m (m.meeting_id)}
				<li class="flex items-start gap-3 py-3">
					<div
						class="mt-0.5 flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-soft px-2.5 py-1.5 text-xs font-semibold text-brand"
					>
						<Icon name="clock" size={12} />
						{formatTime(m.meeting_time)}
					</div>
					<div class="min-w-0 flex-1">
						<p class="truncate text-sm font-medium text-ink">{m.agenda || 'Meeting'}</p>
						<p class="truncate text-xs text-ink-soft">
							{m.contact_name}{#if m.company_name}
								· {m.company_name}{/if}
						</p>
						<p class="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-subtle">
							<span class="flex items-center gap-1">
								<Icon name="calendar" size={12} />
								{formatDate(m.meeting_date)}
							</span>
							{#if m.location}
								<span class="flex items-center gap-1">
									<Icon name="map-pin" size={12} />
									{m.location}
								</span>
							{/if}
						</p>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>
