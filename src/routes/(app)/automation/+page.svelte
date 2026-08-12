<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import {
		auth,
		can,
		automationApi,
		chatTemplatesApi,
		toMessage,
		LatestRequest,
		ApiError,
		formatDateTime
	} from '$lib';
	import { toast } from '$lib/stores/toast.svelte';
	import type {
		LeadAutomationSettings,
		LeadAutomationRun,
		LeadAutomationResult,
		ChatTemplateResponse
	} from '$lib/types/api';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';
	import Alert from '$lib/components/ui/Alert.svelte';
	import LoadingState from '$lib/components/ui/LoadingState.svelte';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';

	const canManage = $derived(can(auth.role, 'manageLeadAutomation'));

	// ── State ─────────────────────────────────────────────────────────────────
	let settings = $state<LeadAutomationSettings | null>(null);
	let templates = $state<ChatTemplateResponse[]>([]);
	let recentResults = $state<LeadAutomationResult[]>([]);

	let settingsLoading = $state(true);
	let templatesLoading = $state(true);
	let resultsLoading = $state(true);

	let settingsError = $state('');
	let templatesError = $state('');
	let resultsError = $state('');

	let saveBusy = $state(false);
	let saveError = $state('');
	let saveWarning = $state('');

	// Edit states
	let formEnabled = $state(false);
	let formTemplateId = $state('');
	let formScheduleModeStr = $state('1');
	const formScheduleMode = $derived(Number(formScheduleModeStr));
	const scheduleModeOptions = [
		{ value: '1', label: '1x Sehari (Maks. 5 Prospek)' },
		{ value: '2', label: '2x Sehari (Slot 1: 2, Slot 2: 3)' }
	];
	const templateOptions = $derived(templates.map((t) => ({ value: t.id, label: t.name })));
	let formSlot1Time = $state('09:00');
	let formSlot2Time = $state('14:00');

	// Detailed Run View Modal
	let runIdToView = $derived(page.url.searchParams.get('run'));
	let selectedRun = $state<LeadAutomationRun | null>(null);
	let runLoading = $state(false);
	let runError = $state('');

	const settingsRequest = new LatestRequest();
	const templatesRequest = new LatestRequest();
	const resultsRequest = new LatestRequest();
	const runRequest = new LatestRequest();

	// ── Computed / Derived ─────────────────────────────────────────────────────
	const showSlot2 = $derived(formScheduleMode === 2);
	const slotsEqual = $derived(formScheduleMode === 2 && formSlot1Time === formSlot2Time);

	// Hitung Next Run secara lokal untuk UX preview
	const nextRunText = $derived.by(() => {
		if (!settings) return '—';
		return getNextRunPreview(settings);
	});

	// Ambil run terakhir berdasarkan attempt_id di results (tiap attempt punya run_id)
	const latestRunId = $derived.by(() => {
		if (recentResults.length === 0) return null;
		return recentResults[0].run_id;
	});

	// State untuk load detailed Last Run info
	let lastRunDetails = $state<LeadAutomationRun | null>(null);
	let lastRunLoading = $state(false);

	// ── Loaders ───────────────────────────────────────────────────────────────
	async function loadAll() {
		if (!canManage) {
			settingsLoading = false;
			templatesLoading = false;
			resultsLoading = false;
			return;
		}
		void loadSettings();
		void loadTemplates();
		void loadResults();
	}

	async function loadSettings() {
		const ctrl = settingsRequest.start();
		settingsLoading = true;
		settingsError = '';
		try {
			const res = await automationApi.getSettings(ctrl.signal);
			if (!settingsRequest.isCurrent(ctrl)) return;
			settings = res;

			// Populate form
			formEnabled = res.enabled;
			formTemplateId = res.template_id ?? '';
			formScheduleModeStr = String(res.schedule_mode);
			formSlot1Time = res.slot_1_time ?? '09:00';
			formSlot2Time = res.slot_2_time ?? '14:00';
		} catch (err) {
			if (!settingsRequest.isCurrent(ctrl)) return;
			settingsError = toMessage(err);
		} finally {
			if (settingsRequest.finish(ctrl)) settingsLoading = false;
		}
	}

	async function loadTemplates() {
		const ctrl = templatesRequest.start();
		templatesLoading = true;
		templatesError = '';
		try {
			// default listTemplates memfilter templates active. Kita filter kategori 'leads'.
			const res = await chatTemplatesApi.listTemplates({ category: 'leads' }, ctrl.signal);
			if (!templatesRequest.isCurrent(ctrl)) return;
			templates = res;
		} catch (err) {
			if (!templatesRequest.isCurrent(ctrl)) return;
			templatesError = toMessage(err);
		} finally {
			if (templatesRequest.finish(ctrl)) templatesLoading = false;
		}
	}

	async function loadResults() {
		const ctrl = resultsRequest.start();
		resultsLoading = true;
		resultsError = '';
		try {
			const res = await automationApi.getRecentResults(ctrl.signal);
			if (!resultsRequest.isCurrent(ctrl)) return;
			recentResults = res ?? [];
		} catch (err) {
			if (!resultsRequest.isCurrent(ctrl)) return;
			resultsError = toMessage(err);
		} finally {
			if (resultsRequest.finish(ctrl)) resultsLoading = false;
		}
	}

	async function loadRunDetails(runId: string) {
		const ctrl = runRequest.start();
		runLoading = true;
		runError = '';
		selectedRun = null;
		try {
			const res = await automationApi.getRun(runId, ctrl.signal);
			if (!runRequest.isCurrent(ctrl)) return;
			selectedRun = res;
		} catch (err) {
			if (!runRequest.isCurrent(ctrl)) return;
			runError = toMessage(err);
		} finally {
			if (runRequest.finish(ctrl)) runLoading = false;
		}
	}

	async function loadLastRunInfo(runId: string) {
		lastRunLoading = true;
		try {
			const res = await automationApi.getRun(runId);
			lastRunDetails = res;
		} catch {
			// Silent error for dashboard summary
		} finally {
			lastRunLoading = false;
		}
	}

	// ── Actions ───────────────────────────────────────────────────────────────
	async function saveSettings(e: SubmitEvent) {
		e.preventDefault();
		if (slotsEqual || saveBusy) return;

		saveBusy = true;
		saveError = '';
		saveWarning = '';

		const payload = {
			enabled: formEnabled,
			template_id: formTemplateId || null,
			schedule_mode: formScheduleMode,
			slot_1_time: formSlot1Time || null,
			slot_2_time: formScheduleMode === 2 ? formSlot2Time : null
		};

		try {
			const res = await automationApi.saveSettings(payload);
			settings = res;
			toast.success('Pengaturan otomatisasi berhasil disimpan.');
		} catch (err) {
			if (err instanceof ApiError) {
				if (err.status === 409) {
					if (err.code === 'AUTOMATION_IN_PROGRESS') {
						saveWarning =
							'Otomatisasi sedang berjalan di server. Harap tunggu beberapa saat sebelum mengganti konfigurasi.';
					} else {
						saveError = err.message || 'Setup belum lengkap atau template tidak valid.';
					}
				} else {
					saveError = toMessage(err);
				}
			} else {
				saveError = toMessage(err);
			}
		} finally {
			saveBusy = false;
		}
	}

	// ── Effect ────────────────────────────────────────────────────────────────
	$effect(() => {
		if (latestRunId) {
			void loadLastRunInfo(latestRunId);
		} else {
			lastRunDetails = null;
		}
	});

	$effect(() => {
		if (runIdToView) {
			void loadRunDetails(runIdToView);
		} else {
			selectedRun = null;
		}
	});

	onMount(() => {
		void loadAll();
	});

	// ── Helpers ───────────────────────────────────────────────────────────────
	function getNextRunPreview(cfg: LeadAutomationSettings): string {
		if (!cfg.enabled || !cfg.slot_1_time) return 'Nonaktif';

		const now = new Date();
		const currentDay = now.getDay(); // 0: Sun, 1: Mon, ..., 6: Sat
		const currentHour = now.getHours();
		const currentMin = now.getMinutes();
		const currentTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;

		const s1 = cfg.slot_1_time;
		const s2 = cfg.schedule_mode === 2 ? cfg.slot_2_time : null;
		const isWeekend = currentDay === 0 || currentDay === 6;

		if (isWeekend) {
			return `Senin · ${s1}`;
		}

		if (cfg.schedule_mode === 1) {
			if (s1 > currentTimeStr) {
				return `Hari ini · ${s1}`;
			} else {
				return currentDay === 5 ? `Senin · ${s1}` : `Besok · ${s1}`;
			}
		} else if (s2) {
			if (s1 > currentTimeStr) {
				return `Hari ini · ${s1}`;
			} else if (s2 > currentTimeStr) {
				return `Hari ini · ${s2}`;
			} else {
				return currentDay === 5 ? `Senin · ${s1}` : `Besok · ${s1}`;
			}
		}
		return 'Tidak valid';
	}

	const STATUS_BADGE_STYLE: Record<string, string> = {
		queued: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
		processing: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
		sent: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
		failed: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
		fallback_required: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300'
	};

	const STATUS_LABEL: Record<string, string> = {
		queued: 'Antre',
		processing: 'Diproses',
		sent: 'Terkirim',
		failed: 'Gagal',
		fallback_required: 'Ambigu/Fallback'
	};
</script>

<PageHeader
	title="Lead First-Touch Automation"
	description="Gunakan template WhatsApp kategori Leads untuk menghubungi prospek baru secara otomatis."
/>

{#if !canManage}
	<Alert variant="error">
		Anda tidak memiliki akses ke halaman ini. Hanya pengguna dengan peran Telesales yang dapat
		mengatur otomatisasi lead.
	</Alert>
{:else if settingsLoading || templatesLoading}
	<LoadingState />
{:else}
	{#if settingsError}
		<div class="mb-4">
			<Alert variant="error">{settingsError}</Alert>
		</div>
	{/if}
	{#if templatesError}
		<div class="mb-4">
			<Alert variant="error">{templatesError}</Alert>
		</div>
	{/if}

	<div class="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
		<!-- ── KOLOM KIRI: KONFIGURASI ── -->
		<div class="space-y-6">
			<form
				onsubmit={saveSettings}
				class="space-y-6 rounded-xl border border-line bg-surface p-5 shadow-sm"
			>
				<div class="flex items-center justify-between border-b border-line pb-4">
					<div>
						<h3 class="text-base font-semibold text-ink">Konfigurasi Otomatisasi</h3>
						<p class="text-xs text-muted">Tentukan template dan jadwal harian Anda.</p>
					</div>
					<label class="relative inline-flex cursor-pointer items-center">
						<input type="checkbox" bind:checked={formEnabled} class="peer sr-only" />
						<div
							class="peer h-6 w-11 rounded-full bg-line-strong transition-colors peer-checked:bg-brand peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:border-gray-600"
						></div>
						<span class="ml-2.5 text-sm font-medium text-ink">
							{formEnabled ? 'Aktif' : 'Nonaktif'}
						</span>
					</label>
				</div>

				{#if saveError}
					<Alert variant="error">{saveError}</Alert>
				{/if}
				{#if saveWarning}
					<Alert variant="warning">{saveWarning}</Alert>
				{/if}

				<!-- Template Selection -->
				<div class="space-y-2">
					{#if templates.length === 0}
						<div class="rounded-xl border border-dashed border-line bg-surface-2 p-5 text-center">
							<Icon name="message-square" size={32} class="mx-auto mb-2 text-subtle" />
							<p class="text-sm font-medium text-ink">Belum Ada Template Leads</p>
							<p class="mb-4 text-xs text-muted">
								Anda memerlukan minimal satu template chat aktif berkategori **Leads** milik
								sendiri.
							</p>
							<Button variant="secondary" size="sm" onclick={() => goto('/chat-templates')}>
								<Icon name="plus" size={14} /> Buat Template
							</Button>
						</div>
						<Select
							label="Template Chat (Kategori Leads)"
							bind:value={formTemplateId}
							required={formEnabled}
							options={templateOptions}
							placeholder="— Pilih Template Chat —"
						/>
					{/if}
				</div>

				<!-- Schedule Mode -->
				<div class="grid gap-4 sm:grid-cols-2">
					<Select
						label="Frekuensi Harian"
						bind:value={formScheduleModeStr}
						options={scheduleModeOptions}
					/>

					<div class="flex flex-col justify-end rounded-lg border border-line bg-surface-2 p-3">
						<p class="text-xs leading-relaxed text-muted">
							{#if formScheduleMode === 1}
								Otomatisasi akan memproses maksimal **5 prospek** dalam sekali jalan di waktu slot
								yang ditentukan.
							{:else}
								Slot pertama memproses **2 prospek**, dilanjutkan slot kedua memproses **3 prospek**
								(Total 5/hari).
							{/if}
						</p>
					</div>
				</div>

				<!-- Slots Time -->
				<div class="grid gap-4 sm:grid-cols-2">
					<TextField
						label="Waktu Slot 1 (Senin-Jumat)"
						type="time"
						bind:value={formSlot1Time}
						required={formEnabled}
					/>

					{#if showSlot2}
						<TextField
							label="Waktu Slot 2 (Senin-Jumat)"
							type="time"
							bind:value={formSlot2Time}
							required={formEnabled}
							error={slotsEqual ? 'Waktu slot 2 tidak boleh sama dengan slot 1.' : ''}
						/>
					{/if}
				</div>

				<div class="flex justify-end gap-2 border-t border-line pt-4">
					<Button type="button" variant="secondary" onclick={loadSettings} disabled={saveBusy}>
						Reset
					</Button>
					<Button type="submit" variant="primary" loading={saveBusy} disabled={slotsEqual}>
						Simpan Pengaturan
					</Button>
				</div>
			</form>
		</div>

		<!-- ── KOLOM KANAN: MONITORING & PROGRESS ── -->
		<div class="space-y-6">
			<!-- Run Progress Card -->
			<div class="space-y-4 rounded-xl border border-line bg-surface p-5 shadow-sm">
				<h3 class="text-base font-semibold text-ink">Status Pengiriman Hari Ini</h3>

				<div class="grid grid-cols-2 gap-3">
					<div class="rounded-lg border border-line bg-surface-2 p-3">
						<p class="text-[11px] font-medium text-muted uppercase">Diproses / Batas</p>
						<p class="mt-1 text-lg font-semibold text-ink">
							{#if lastRunDetails && new Date(lastRunDetails.business_date).toDateString() === new Date().toDateString()}
								{lastRunDetails.attempt_count} / {settings?.daily_limit ?? 5}
							{:else}
								0 / {settings?.daily_limit ?? 5}
							{/if}
						</p>
					</div>
					<div class="rounded-lg border border-line bg-surface-2 p-3">
						<p class="text-[11px] font-medium text-muted uppercase">Jadwal Berikutnya</p>
						<p class="mt-1 truncate text-sm font-semibold text-brand">
							{nextRunText}
						</p>
					</div>
				</div>

				<!-- Stats Detail -->
				<div class="space-y-2.5 pt-2">
					<h4 class="text-xs font-semibold text-muted uppercase">Statistik Run Terakhir</h4>
					{#if lastRunLoading}
						<p class="text-xs text-muted">Memuat data...</p>
					{:else if lastRunDetails}
						<button
							type="button"
							onclick={() => goto(`/automation?run=${lastRunDetails!.id}`)}
							class="group w-full space-y-2 rounded-lg border border-line bg-surface-2 p-3 text-left transition-colors hover:bg-surface-3"
						>
							<div class="flex items-center justify-between text-xs">
								<span class="font-medium text-ink">
									Run: {formatDateTime(lastRunDetails.scheduled_at)}
								</span>
								<Icon name="arrow-up-right" size={12} class="text-muted group-hover:text-brand" />
							</div>
							<div class="grid grid-cols-3 gap-2 pt-1 text-center text-xs">
								<div
									class="rounded bg-emerald-50 py-1 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300"
								>
									{lastRunDetails.success_count} Sukses
								</div>
								<div
									class="rounded bg-red-50 py-1 text-red-700 dark:bg-red-950/20 dark:text-red-300"
								>
									{lastRunDetails.failed_count} Gagal
								</div>
								<div
									class="rounded bg-orange-50 py-1 text-orange-700 dark:bg-orange-950/20 dark:text-orange-300"
								>
									{lastRunDetails.fallback_count} Ambigu
								</div>
							</div>
						</button>
					{:else}
						<p class="text-xs text-muted italic">Belum ada aktivitas run otomatis.</p>
					{/if}
				</div>
			</div>
		</div>

		<!-- ── SECTION BOTTOM: RECENT CONTACTS ── -->
		<div class="space-y-3 xl:col-span-2">
			<div class="flex items-center justify-between">
				<h3 class="text-base font-semibold text-ink">Aktivitas Otomatis Terbaru</h3>
				<Button variant="secondary" size="sm" onclick={loadResults} disabled={resultsLoading}>
					<Icon name="refresh-cw" size={13} class={resultsLoading ? 'animate-spin' : ''} />
					Segarkan
				</Button>
			</div>

			{#if resultsLoading}
				<LoadingState />
			{:else if resultsError}
				<Alert variant="error">{resultsError}</Alert>
			{:else if recentResults.length === 0}
				<div class="rounded-xl border border-line bg-surface p-8 text-center">
					<Icon name="target" size={32} class="mx-auto mb-2 text-subtle" />
					<p class="font-medium text-ink">Belum Ada Kontak Otomatis</p>
					<p class="text-sm text-muted">
						Kontak yang dihubungi oleh sistem otomatisasi lead harian akan muncul di sini.
					</p>
				</div>
			{:else}
				<div class="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
					<div class="overflow-x-auto">
						<table class="w-full text-left text-sm">
							<thead class="border-b border-line bg-surface-2 text-xs text-muted uppercase">
								<tr>
									<th class="px-4 py-3">Waktu</th>
									<th class="px-4 py-3">Kontak</th>
									<th class="px-4 py-3">Perusahaan</th>
									<th class="px-4 py-3">Status Percobaan</th>
									<th class="px-4 py-3">Penyebab Gagal</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-line">
								{#each recentResults as r (r.attempt_id)}
									<tr
										onclick={() => goto(`/contacts/${r.contact_id}`)}
										class="cursor-pointer transition-colors hover:bg-surface-2"
									>
										<td class="px-4 py-3 text-xs whitespace-nowrap text-ink">
											{formatDateTime(r.scheduled_at)}
										</td>
										<td class="px-4 py-3 font-medium text-ink">
											{r.contact_name}
										</td>
										<td class="px-4 py-3 text-ink-soft">
											{r.company_name}
										</td>
										<td class="px-4 py-3">
											<Badge
												label={STATUS_LABEL[r.delivery_status || r.attempt_status] ||
													r.attempt_status}
												tone={STATUS_BADGE_STYLE[r.delivery_status || r.attempt_status]}
											/>
										</td>
										<td class="px-4 py-3 text-xs font-medium text-red-600 dark:text-red-400">
											{r.failure_category || '—'}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}

<!-- ── DETAIL RUN MODAL ── -->
{#if runIdToView}
	<Modal
		title="Detail Run Lead Automation"
		size="lg"
		onclose={() => {
			const u = new URL(window.location.href);
			u.searchParams.delete('run');
			void goto(u.pathname + u.search);
		}}
	>
		{#if runLoading}
			<LoadingState />
		{:else if runError}
			<Alert variant="error">{runError}</Alert>
		{:else if selectedRun}
			<div class="space-y-5">
				<!-- Run Header Stats -->
				<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
					<div class="rounded-lg border border-line bg-surface-2 p-3 text-center">
						<span class="text-[10px] font-bold text-muted uppercase">Tanggal Bisnis</span>
						<p class="mt-1 text-sm font-semibold text-ink">
							{new Date(selectedRun.business_date).toLocaleDateString('id-ID', {
								weekday: 'long',
								year: 'numeric',
								month: 'long',
								day: 'numeric'
							})}
						</p>
					</div>
					<div class="rounded-lg border border-line bg-surface-2 p-3 text-center">
						<span class="text-[10px] font-bold text-muted uppercase">Slot Pengiriman</span>
						<p class="mt-1 text-sm font-semibold text-brand">Slot #{selectedRun.slot_no}</p>
					</div>
					<div class="rounded-lg border border-line bg-surface-2 p-3 text-center">
						<span class="text-[10px] font-bold text-muted uppercase">Waktu Mulai</span>
						<p class="mt-1 text-sm font-semibold text-ink">
							{selectedRun.started_at ? formatDateTime(selectedRun.started_at) : '—'}
						</p>
					</div>
					<div class="rounded-lg border border-line bg-surface-2 p-3 text-center">
						<span class="text-[10px] font-bold text-muted uppercase">Status Run</span>
						<p class="mt-1 text-sm font-semibold text-ink capitalize">{selectedRun.status}</p>
					</div>
				</div>

				<div class="grid grid-cols-5 gap-2 text-center text-xs">
					<div class="rounded border border-line bg-gray-50 p-2 dark:bg-gray-900">
						<span class="block font-bold text-ink">{selectedRun.candidate_count}</span>
						<span class="block text-[10px] text-muted">Kandidat</span>
					</div>
					<div class="rounded border border-blue-100 bg-blue-50 p-2 dark:bg-blue-950/20">
						<span class="block font-bold text-blue-700 dark:text-blue-300"
							>{selectedRun.attempt_count}</span
						>
						<span class="block text-[10px] text-blue-500">Dihubungi</span>
					</div>
					<div class="rounded border border-emerald-100 bg-emerald-50 p-2 dark:bg-emerald-950/20">
						<span class="block font-bold text-emerald-700 dark:text-emerald-300"
							>{selectedRun.success_count}</span
						>
						<span class="block text-[10px] text-emerald-500">Sukses</span>
					</div>
					<div class="rounded border border-red-100 bg-red-50 p-2 dark:bg-red-950/20">
						<span class="block font-bold text-red-700 dark:text-red-300"
							>{selectedRun.failed_count}</span
						>
						<span class="block text-[10px] text-red-500">Gagal</span>
					</div>
					<div class="rounded border border-orange-100 bg-orange-50 p-2 dark:bg-orange-950/20">
						<span class="block font-bold text-orange-700 dark:text-orange-300"
							>{selectedRun.fallback_count}</span
						>
						<span class="block text-[10px] text-orange-500">Ambigu</span>
					</div>
				</div>

				<!-- Run Candidates list -->
				<div class="space-y-2">
					<h4 class="text-sm font-semibold text-ink">Daftar Kontak Prospek Terproses</h4>
					{#if selectedRun.results.length === 0}
						<p
							class="rounded-lg border border-line bg-surface-2 py-4 text-center text-xs text-muted italic"
						>
							Tidak ada kontak yang diproses pada run ini.
						</p>
					{:else}
						<div
							class="max-h-60 divide-y divide-line overflow-y-auto rounded-lg border border-line bg-surface"
						>
							{#each selectedRun.results as r (r.attempt_id)}
								<div
									class="flex items-center justify-between p-3 text-xs transition-colors hover:bg-surface-2"
								>
									<div>
										<p class="font-semibold text-ink">{r.contact_name}</p>
										<p class="text-[10px] text-muted">{r.company_name}</p>
									</div>
									<div class="flex items-center gap-2">
										<Badge
											label={STATUS_LABEL[r.delivery_status || r.attempt_status] ||
												r.attempt_status}
											tone={STATUS_BADGE_STYLE[r.delivery_status || r.attempt_status]}
										/>
										{#if r.failure_category}
											<span class="font-medium text-red-600">({r.failure_category})</span>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</Modal>
{/if}
