<!--
  Dashboard — ringkasan metrik + chart.
  - Telesales : laporan pribadi (GET /reports/personal).
  - BDM       : laporan tim (GET /reports/team) + performa per telesales.
  Tombol "Muat ulang" + auto-refresh saat tab kembali fokus → angka selalu segar.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import {
		auth,
		can,
		reportsApi,
		meetingsApi,
		toMessage,
		formatNumber,
		formatPercent,
		formatDate,
		LatestRequest,
		ROLE_LABEL,
		RESPONSE_STATUS_LABEL,
		ACTION_STATUS_LABEL
	} from '$lib';
	import { decodeHtml } from '$lib/utils/sanitize';
	import type {
		MeetingDetailResponse,
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
	import Modal from '$lib/components/ui/Modal.svelte';
	import BarChart from '$lib/components/ui/BarChart.svelte';

	const isTeam = can(auth.role, 'viewTeamReport'); // bdm
	const isPersonal = can(auth.role, 'viewPersonalReport'); // telesales
	const selectedMeetingID = $derived(page.url.searchParams.get('meeting'));

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
	const reportRequest = new LatestRequest();

	async function load() {
		const controller = reportRequest.start();
		loading = true;
		errorMsg = '';
		const filter: ReportFilter = { period };
		try {
			if (isTeam) {
				const result = await reportsApi.getTeamReport(filter, controller.signal);
				if (reportRequest.isCurrent(controller)) team = result;
			} else if (isPersonal) {
				const result = await reportsApi.getPersonalReport(filter, controller.signal);
				if (reportRequest.isCurrent(controller)) personal = result;
			}
		} catch (err) {
			if (!reportRequest.isCurrent(controller)) return;
			errorMsg = toMessage(err);
		} finally {
			if (reportRequest.finish(controller)) loading = false;
		}
	}

	// ── Agenda / jadwal mendatang (GET /meetings/upcoming) ────────────────────
	// State terpisah dari laporan: kegagalan kalender tidak mengosongkan dashboard,
	// dan ganti periode laporan tidak ikut memuat ulang kalender.
	const AGENDA_DAYS = 30; // rentang: hari ini → +30 hari
	let meetings = $state<UpcomingMeetingItem[]>([]);
	let meetingsLoading = $state(true);
	let meetingsError = $state('');
	let meetingDetail = $state<MeetingDetailResponse | null>(null);
	let meetingDetailLoading = $state(false);
	let meetingDetailError = $state('');
	const meetingsRequest = new LatestRequest();

	$effect(() => {
		const id = selectedMeetingID;
		if (!id) {
			meetingDetail = null;
			meetingDetailError = '';
			return;
		}

		const controller = new AbortController();
		meetingDetailLoading = true;
		meetingDetailError = '';
		void meetingsApi
			.getByID(id, controller.signal)
			.then((detail) => {
				meetingDetail = detail;
			})
			.catch((error) => {
				if (!controller.signal.aborted) meetingDetailError = toMessage(error);
			})
			.finally(() => {
				if (!controller.signal.aborted) meetingDetailLoading = false;
			});

		return () => controller.abort();
	});

	function closeMeetingDetail() {
		void goto('/dashboard#agenda', { replaceState: true, noScroll: true });
	}

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
		const controller = meetingsRequest.start();
		meetingsLoading = true;
		meetingsError = '';
		const now = new Date();
		// Konstruktor tunggal (bukan mutasi) → aman dari lint & normalisasi overflow bulan.
		const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + AGENDA_DAYS);
		try {
			const res = await meetingsApi.getUpcoming(
				{
					start_date: toDateStr(now),
					end_date: toDateStr(end),
					limit: 50
				},
				controller.signal
			);
			if (!meetingsRequest.isCurrent(controller)) return;
			meetings = res.data;
		} catch (err) {
			if (!meetingsRequest.isCurrent(controller)) return;
			meetingsError = toMessage(err);
		} finally {
			if (meetingsRequest.finish(controller)) meetingsLoading = false;
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
		return () => {
			document.removeEventListener('visibilitychange', onVisible);
			reportRequest.abort();
			meetingsRequest.abort();
		};
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

	// Target vs Pencapaian untuk tim (BDM) & pribadi (Telesales)
	const personalTargetData = $derived(
		personal
			? [
					{
						label: 'Kontak Dihubungi',
						value: personal.summary.sudah_dihubungi,
						target: Math.max(20, Math.round(personal.summary.total_contacts * 0.8)),
						tone: 'bg-blue-500',
						targetTone: 'bg-slate-300'
					},
					{
						label: 'Respon Tertarik',
						value: personal.summary.tertarik,
						target: Math.max(5, Math.round(personal.summary.total_contacts * 0.15)),
						tone: 'bg-emerald-500',
						targetTone: 'bg-slate-300'
					},
					{
						label: 'Meeting Terjadwal',
						value: personal.summary.meetings_scheduled,
						target: Math.max(3, Math.round(personal.summary.total_contacts * 0.1)),
						tone: 'bg-brand',
						targetTone: 'bg-slate-300'
					}
				]
			: []
	);

	const teamTargetData = $derived(
		team
			? [
					{
						label: 'Kontak Dihubungi (Tim)',
						value: team.per_telesales.reduce((s, t) => s + t.sudah_dihubungi, 0),
						target: Math.max(100, team.team_summary.total_contacts),
						tone: 'bg-blue-500',
						targetTone: 'bg-slate-300'
					},
					{
						label: 'Meeting Terjadwal (Tim)',
						value: team.team_summary.total_meetings,
						target: Math.max(15, Math.round(team.team_summary.total_contacts * 0.1)),
						tone: 'bg-brand',
						targetTone: 'bg-slate-300'
					}
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
			<span class="mr-1 inline-flex items-center gap-1 rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-semibold text-muted">
				<span class="h-1.5 w-1.5 rounded-full {loading ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}"></span>
				{loading ? 'Memuat...' : 'Sinkron'}
			</span>
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
		<!-- Left side: Leaderboard and Agenda -->
		<div class="space-y-6 lg:col-span-2">
			<!-- Leaderboard performa: menonjolkan top performer & banding antar-sales. -->
			<div class="rounded-xl border border-line bg-surface p-5">
				<PerformanceLeaderboard data={team.per_telesales} />
			</div>

			{@render agendaSection('Agenda Mendatang Tim', 'Meeting terjadwal seluruh sales ' + AGENDA_DAYS + ' hari ke depan.')}
		</div>

		<!-- Right side: Funnel and Target charts -->
		<div class="space-y-6 lg:col-span-1">
			<!-- Funnel tim -->
			<div class="rounded-xl border border-line bg-surface p-5">
				<h2 class="mb-1 text-sm font-semibold text-ink-soft">Pipeline Tim</h2>
				<p class="mb-4 text-xs text-subtle font-medium">Alur agregat seluruh telesales.</p>
				<FunnelChart stages={teamFunnelStages} />
			</div>
			
			<!-- Target vs Pencapaian Tim -->
			<div class="rounded-xl border border-line bg-surface p-5">
				<h2 class="mb-1 text-sm font-semibold text-ink-soft">Target vs Pencapaian Tim</h2>
				<p class="mb-4 text-xs text-subtle font-medium">Monitoring performa kumulatif tim sales terhadap target operasional.</p>
				<BarChart data={teamTargetData} />
			</div>
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

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
		<!-- Left side: Pipeline and Target charts -->
		<div class="space-y-6 lg:col-span-1">
			<div class="rounded-xl border border-line bg-surface p-5">
				<h2 class="mb-1 text-sm font-semibold text-ink-soft">Pipeline Telesales</h2>
				<p class="mb-4 text-xs text-subtle font-medium">Alur dari total kontak hingga meeting terjadwal.</p>
				<FunnelChart stages={funnelStages} />
			</div>
			
			<div class="rounded-xl border border-line bg-surface p-5">
				<h2 class="mb-1 text-sm font-semibold text-ink-soft">Target vs Pencapaian</h2>
				<p class="mb-4 text-xs text-subtle font-medium">Bandingkan aktivitas telesales Anda terhadap target periodik.</p>
				<BarChart data={personalTargetData} />
			</div>
		</div>

		<!-- Right side: Donut Chart, Conversion rate panel, and Agenda -->
		<div class="space-y-6 lg:col-span-2">
			<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
				<!-- Komposisi status respon -->
				<div class="rounded-xl border border-line bg-surface p-5">
					<h2 class="mb-1 text-sm font-semibold text-ink-soft">Komposisi Respon</h2>
					<p class="mb-4 text-xs text-subtle font-medium">Proporsi hasil respon dari kontak yang dihubungi.</p>
					<div class="flex justify-center">
						<DonutChart data={responseDonut} centerLabel="Respon" />
					</div>
				</div>

				<!-- Rasio Konversi detail panel -->
				<div class="rounded-xl border border-line bg-surface p-5 flex flex-col justify-between">
					<div>
						<h2 class="mb-1 text-sm font-semibold text-ink-soft">Rasio Konversi</h2>
						<p class="text-xs text-subtle font-medium">Perbandingan tingkat keberhasilan penawaran produk.</p>
					</div>
					<div class="py-6 text-center">
						<div class="inline-flex items-center justify-center rounded-full bg-brand-soft p-5 text-brand">
							<Icon name="trending-up" size={32} />
						</div>
						<p class="mt-3 text-2xl font-bold text-ink">{formatPercent(personal.conversion_rate)}</p>
						<p class="text-xs text-muted mt-1">Target konversi minimal 10%</p>
					</div>
					<div class="rounded-lg bg-surface-2 p-3 text-xs text-muted border border-line/45">
						Tips: Tingkatkan durasi percakapan dan pastikan verifikasi WhatsApp nomor kontak dilakukan sebelum melakukan penawaran.
					</div>
				</div>
			</div>

			{@render agendaSection('Agenda Mendatang Anda', 'Meeting terjadwal Anda ' + AGENDA_DAYS + ' hari ke depan.')}
		</div>
	</div>
{:else}
	<div class="rounded-xl border border-dashed border-line bg-surface p-8 text-center">
		<p class="text-sm text-muted">Tidak ada laporan untuk role ini.</p>
	</div>
{/if}

<!-- ── DETAIL RUN MODAL ── -->
{#if selectedMeetingID}
	<Modal title="Detail Meeting" onclose={closeMeetingDetail}>
		{#if meetingDetailLoading}
			<LoadingState />
		{:else if meetingDetailError}
			<Alert variant="error">{meetingDetailError}</Alert>
		{:else if meetingDetail}
			<div class="space-y-4 text-sm">
				<div>
					<p class="text-xs font-medium tracking-wide text-subtle uppercase">Agenda</p>
					<p class="mt-1 font-medium text-ink">{decodeHtml(meetingDetail.agenda) || 'Demo'}</p>
				</div>
				<div class="grid gap-4 sm:grid-cols-2">
					<div>
						<p class="text-xs font-medium tracking-wide text-subtle uppercase">Perusahaan</p>
						<p class="mt-1 text-ink">{meetingDetail.company_name}</p>
					</div>
					<div>
						<p class="text-xs font-medium tracking-wide text-subtle uppercase">Kontak</p>
						<p class="mt-1 text-ink">{meetingDetail.contact_name}</p>
					</div>
					<div>
						<p class="text-xs font-medium tracking-wide text-subtle uppercase">Jadwal</p>
						<p class="mt-1 text-ink">
							{formatDate(meetingDetail.meeting_date)} · {formatTime(meetingDetail.meeting_time)}
						</p>
					</div>
					<div>
						<p class="text-xs font-medium tracking-wide text-subtle uppercase">Dijadwalkan oleh</p>
						<p class="mt-1 text-ink">{meetingDetail.scheduler_name}</p>
					</div>
				</div>
				<div>
					<p class="text-xs font-medium tracking-wide text-subtle uppercase">Lokasi</p>
					<p class="mt-1 text-ink">{meetingDetail.location || '-'}</p>
				</div>
			</div>
		{/if}
	</Modal>
{/if}

<!-- ── REUSABLE SNIPPETS ── -->
{#snippet agendaSection(titleLabel: string, subLabel: string)}
	<section id="agenda" class="scroll-mt-20 rounded-xl border border-line bg-surface p-5">
		<div class="mb-4 flex items-center justify-between gap-2">
			<div>
				<h2 class="flex items-center gap-2 text-sm font-semibold text-ink-soft">
					<Icon name="calendar" size={16} /> {titleLabel}
				</h2>
				<p class="text-xs text-subtle">{subLabel}</p>
			</div>
			<Button variant="ghost" size="sm" onclick={loadMeetings} disabled={meetingsLoading}>
				<Icon name="refresh-cw" size={14} class={meetingsLoading ? 'animate-spin' : ''} /> Segarkan
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
					<li
						class="flex items-start gap-3 rounded-lg px-2 py-3 {selectedMeetingID === m.meeting_id
							? 'bg-brand-soft ring-1 ring-brand/30'
							: ''}"
					>
						<div
							class="mt-0.5 flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-soft px-2.5 py-1.5 text-xs font-semibold text-brand"
						>
							<Icon name="clock" size={12} />
							{formatTime(m.meeting_time)}
						</div>
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-medium text-ink">{decodeHtml(m.agenda) || 'Meeting'}</p>
							<p class="truncate text-xs text-ink-soft">
								<a href="/contacts/{m.contact_id}" class="font-semibold text-brand hover:underline">
									{m.contact_name}
								</a>
								{#if m.company_name}
									· <a href="/companies/{m.company_id}" class="hover:underline text-muted">{m.company_name}</a>
								{/if}
							</p>
							{#if m.scheduled_by_name}
								<p class="mt-0.5 truncate text-xs text-muted">
									Dijadwalkan oleh: {m.scheduled_by_name}
								</p>
							{/if}
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
{/snippet}
