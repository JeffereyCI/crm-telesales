<!--
  Laporan — export Excel/PDF. Detail metrik & chart ada di Dashboard;
  halaman ini fokus pada unduhan laporan periodik.
-->
<script lang="ts">
	import { auth, can, reportsApi, toMessage } from '$lib';
	import { toast } from '$lib/stores/toast.svelte';
	import type { ReportFilter } from '$lib/types/api';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Select from '$lib/components/ui/Select.svelte';

	const canExport = can(auth.role, 'exportReport');

	const periodOptions = [
		{ value: 'this_week', label: 'Minggu Ini' },
		{ value: 'this_month', label: 'Bulan Ini' },
		{ value: 'this_year', label: 'Tahun Ini' }
	];
	const formatOptions = [
		{ value: 'excel', label: 'Excel (.xlsx)' },
		{ value: 'pdf', label: 'PDF (.pdf)' }
	];

	let period = $state<'this_week' | 'this_month' | 'this_year'>('this_month');
	let format = $state<'excel' | 'pdf'>('excel');
	let exporting = $state(false);

	async function handleExport() {
		exporting = true;
		try {
			const filter: ReportFilter = { period, format };
			await reportsApi.exportReport(filter);
			toast.success('Laporan berhasil diunduh.');
		} catch (err) {
			toast.error(toMessage(err));
		} finally {
			exporting = false;
		}
	}
</script>

<svelte:head><title>Laporan · CRM Telesales</title></svelte:head>

<PageHeader title="Laporan" description="Unduh ringkasan performa dan konversi." />

<div class="max-w-lg rounded-xl border border-line bg-surface p-6">
	<div class="space-y-4">
		<Select label="Periode" bind:value={period} options={periodOptions} />
		<Select label="Format" bind:value={format} options={formatOptions} />
		{#if canExport}
			<Button onclick={handleExport} loading={exporting}>
				<Icon name="bar-chart-3" size={16} /> Export Laporan
			</Button>
		{:else}
			<p class="text-sm text-muted">Anda tidak memiliki akses export laporan.</p>
		{/if}
	</div>
	<p class="mt-4 text-xs text-subtle">
		Metrik & grafik interaktif tersedia di halaman <a
			href="/dashboard"
			class="text-brand hover:underline">Dashboard</a
		>.
	</p>
</div>
