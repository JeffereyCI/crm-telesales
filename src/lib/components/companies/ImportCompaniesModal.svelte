<!--
  Import perusahaan dari Excel/CSV (BDM). POST /companies/import (multipart).

  Perilaku loading & hasil (poin 9):
   - `uploading` selalu berhenti di blok finally → tidak ada loading menggantung.
   - Saat sukses TANPA baris gagal → modal otomatis ditutup & daftar di-refresh
     (onimported), sehingga tampilan langsung berubah tanpa refresh manual.
   - Saat ADA baris gagal → modal tetap terbuka untuk menampilkan detail error,
     tapi daftar tetap di-refresh di latar.
   - Toast menjelaskan secara eksplisit: berapa ditambahkan, berapa DIPERBARUI
     (duplikat nama → di-update, bukan ditolak — sesuai backend ImportResult),
     dan berapa gagal.
-->
<script lang="ts">
	import { companiesApi, toMessage } from '$lib';
	import { toast } from '$lib/stores/toast.svelte';
	import type { ImportResult } from '$lib/types/api';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';

	interface Props {
		onclose: () => void;
		onimported: () => void;
	}
	let { onclose, onimported }: Props = $props();

	const ACCEPT = '.xlsx,.xls,.csv';

	let file = $state<File | null>(null);
	let uploading = $state(false);
	let downloading = $state(false);
	let result = $state<ImportResult | null>(null);

	function onFileChange(e: Event) {
		const input = e.target as HTMLInputElement;
		file = input.files?.[0] ?? null;
		result = null;
	}

	async function downloadTemplate() {
		downloading = true;
		try {
			await companiesApi.downloadImportTemplate();
		} catch (err) {
			toast.error(toMessage(err));
		} finally {
			downloading = false;
		}
	}

	/** Susun pesan toast yang menjelaskan hasil import secara manusiawi. */
	function describe(r: ImportResult): { type: 'success' | 'info' | 'error'; msg: string } {
		const parts: string[] = [];
		if (r.success > 0) parts.push(`${r.success} ditambahkan`);
		if (r.duplicates_updated > 0) parts.push(`${r.duplicates_updated} diperbarui (nama sudah ada)`);
		if (r.errors > 0) parts.push(`${r.errors} gagal`);

		if (r.success === 0 && r.duplicates_updated === 0 && r.errors > 0)
			return { type: 'error', msg: `Import gagal: ${r.errors} baris bermasalah. Periksa detail.` };
		if (r.errors > 0) return { type: 'info', msg: `Import selesai: ${parts.join(', ')}.` };
		if (parts.length === 0) return { type: 'info', msg: 'Tidak ada data yang diproses dari file.' };
		return { type: 'success', msg: `Import berhasil: ${parts.join(', ')}.` };
	}

	async function handleUpload() {
		if (!file || uploading) return;
		uploading = true;
		try {
			const r = await companiesApi.importCompanies(file);
			result = r;

			const { type, msg } = describe(r);
			toast[type](msg);

			// Selalu segarkan daftar di latar (data mungkin berubah).
			onimported();

			// Tidak ada baris gagal → tutup modal agar daftar yang segar langsung terlihat.
			if (r.errors === 0) onclose();
		} catch (err) {
			toast.error(toMessage(err));
		} finally {
			uploading = false; // jaminan: loading selalu berhenti setelah response.
		}
	}
</script>

<Modal title="Import Perusahaan" onclose={uploading ? undefined : onclose} size="lg">
	<div class="space-y-4">
		<p class="text-sm text-muted">
			Unggah file Excel/CSV. Baris dengan nama perusahaan yang sudah ada akan
			<span class="font-medium text-ink-soft">diperbarui</span> (bukan ditolak sebagai duplikat).
		</p>

		<button
			type="button"
			class="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline disabled:opacity-50"
			onclick={downloadTemplate}
			disabled={downloading}
		>
			<Icon name="download" size={16} />
			{downloading ? 'Mengunduh…' : 'Unduh template'}
		</button>

		<div>
			<input
				type="file"
				accept={ACCEPT}
				onchange={onFileChange}
				disabled={uploading}
				class="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand hover:file:opacity-80"
			/>
		</div>

		{#if result}
			<div class="rounded-lg border border-line bg-surface-2 p-3 text-sm">
				<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
					<div>
						<span class="text-xs text-muted">Total baris</span><br />
						<span class="font-semibold text-ink">{result.total_rows}</span>
					</div>
					<div>
						<span class="text-xs text-muted">Ditambahkan</span><br />
						<span class="font-semibold text-emerald-600">{result.success}</span>
					</div>
					<div>
						<span class="text-xs text-muted">Diperbarui</span><br />
						<span class="font-semibold text-brand">{result.duplicates_updated}</span>
					</div>
					<div>
						<span class="text-xs text-muted">Gagal</span><br />
						<span class="font-semibold text-red-600">{result.errors}</span>
					</div>
				</div>

				{#if result.error_details.length > 0}
					<div class="mt-3 max-h-40 overflow-y-auto border-t border-line pt-2">
						<p class="mb-1 text-xs font-medium text-muted">Baris yang gagal:</p>
						<table class="w-full text-center text-xs">
							<thead class="text-muted">
								<tr>
									<th class="py-1 pr-3 font-medium">Baris</th>
									<th class="py-1 font-medium">Alasan</th>
								</tr>
							</thead>
							<tbody>
								{#each result.error_details as d (d.row)}
									<tr class="border-t border-line">
										<td class="py-1 pr-3 text-ink-soft">{d.row}</td>
										<td class="py-1 text-red-600">{d.reason}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	{#snippet footer()}
		<Button variant="secondary" onclick={onclose} disabled={uploading}>
			{result ? 'Tutup' : 'Batal'}
		</Button>
		{#if !result || result.errors > 0}
			<Button onclick={handleUpload} loading={uploading} disabled={!file}>
				{result ? 'Unggah ulang' : 'Import'}
			</Button>
		{/if}
	{/snippet}
</Modal>
