<script lang="ts">
	import { untrack } from 'svelte';
	import { ApiError, companiesApi, dealsApi, formatCurrency, LatestRequest, toMessage } from '$lib';
	import { toast } from '$lib/stores/toast.svelte';
	import { PIPELINE_PHASES, PIPELINE_PHASE_LABEL } from '$lib/constants/enums';
	import type { DealItem, DealResponse, DealType, ProductResponse } from '$lib/types/api';
	import type { CompanyStaging, PipelinePhase } from '$lib/constants/enums';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';

	interface EditableItem {
		key: string;
		id?: string;
		product_id: string;
		product_name: string;
		billing_model: string;
		category: string;
		quantity: string;
		unit_price: string;
		discount_percent: string;
		subtotal_preview: string;
		subscription_start: string;
		subscription_end: string;
		inactive: boolean;
	}

	interface Props {
		deal: DealResponse;
		products: ProductResponse[];
		onclose: () => void;
		onclosed?: () => void;
		onsaved: () => void;
	}
	let { deal, products, onclose, onclosed, onsaved }: Props = $props();

	const initial = untrack(() => deal);
	let currentDeal = $state<DealResponse>(initial);
	let stage = $state<PipelinePhase>(initial.pipeline_status as PipelinePhase);
	let dealType = $state(initial.deal_type);
	let notes = $state(initial.notes ?? '');
	let itemRows = $state<EditableItem[]>([]);
	let saving = $state(false);
	let formError = $state('');
	let companyStatus = $state<CompanyStaging | null>(null);
	let companyStatusLoading = $state(false);
	const companyRequest = new LatestRequest();

	function asNumber(value: string | number | null | undefined) {
		return Number(value ?? 0);
	}

	function round2(value: number): string {
		return (Math.round(value * 100) / 100).toFixed(2);
	}

	function subtotalPreview(quantity: string, unitPrice: string, discountPercent: string): string {
		const q = Number(quantity);
		const p = Number(unitPrice);
		const d = Number(discountPercent);
		if (
			!Number.isFinite(q) ||
			!Number.isFinite(p) ||
			!Number.isFinite(d) ||
			q <= 0 ||
			p < 0 ||
			d < 0 ||
			d > 100
		) {
			return '0.00';
		}
		return round2(q * p * (1 - d / 100));
	}

	function makeRow(item?: DealItem): EditableItem {
		const activeProduct = item ? products.find((product) => product.id === item.product_id) : null;
		return {
			key: crypto.randomUUID(),
			id: item?.id,
			product_id: item?.product_id ?? '',
			product_name: item?.product_name ?? '',
			billing_model: item?.billing_model ?? activeProduct?.billing_model ?? '',
			category: item?.category ?? activeProduct?.category ?? '',
			quantity: item?.quantity ?? '1',
			unit_price: item?.unit_price ?? '0',
			discount_percent: item?.discount_percent ?? '0',
			subtotal_preview: item?.subtotal ?? '0.00',
			subscription_start: item?.subscription_start ?? '',
			subscription_end: item?.subscription_end ?? '',
			inactive: !!item && !activeProduct
		};
	}

	function hydrateDeal(next: DealResponse) {
		currentDeal = next;
		stage = next.pipeline_status as PipelinePhase;
		dealType = next.deal_type;
		notes = next.notes ?? '';
		itemRows = next.items.map((item) => makeRow(item));
		formError = '';
	}

	hydrateDeal(initial);

	const stageOptions = $derived(
		PIPELINE_PHASES.filter(
			(phase) => (phase !== 'win' && phase !== 'lost') || phase === currentDeal.pipeline_status
		).map((phase) => ({ value: phase, label: PIPELINE_PHASE_LABEL[phase] }))
	);

	const DEAL_TYPE_LABEL = {
		new: 'New',
		upsell: 'Upsell',
		cross_sell: 'Cross-Sell',
		renewal: 'Renewal'
	} as const;

	const dealTypeOptions = $derived.by(() => {
		const allowed: DealType[] =
			companyStatus === 'contact'
				? ['new']
				: companyStatus === 'customer'
					? ['upsell', 'cross_sell', 'renewal']
					: companyStatus === 'leads'
						? []
						: [];
		return [...new Set([currentDeal.deal_type, ...allowed])].map((value) => ({
			value,
			label: DEAL_TYPE_LABEL[value]
		}));
	});

	const productOptions = $derived(
		[...products]
			.sort((a, b) =>
				`${a.vendor}-${a.category}-${a.name}`.localeCompare(
					`${b.vendor}-${b.category}-${b.name}`,
					'id-ID'
				)
			)
			.map((product) => ({
				value: product.id,
				label: `${product.vendor.toUpperCase()} · ${product.category} · ${product.name}`
			}))
	);

	const duplicateProductIds = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const row of itemRows) {
			if (!row.product_id) continue;
			counts.set(row.product_id, (counts.get(row.product_id) ?? 0) + 1);
		}
		return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id));
	});

	const localTotal = $derived(
		itemRows.reduce(
			(sum, row) =>
				sum + Number(subtotalPreview(row.quantity, row.unit_price, row.discount_percent)),
			0
		)
	);

	function updateRow(index: number, patch: Partial<EditableItem>) {
		itemRows = itemRows.map((row, i) => {
			if (i !== index) return row;
			const next = { ...row, ...patch };
			next.subtotal_preview = subtotalPreview(
				next.quantity,
				next.unit_price,
				next.discount_percent
			);
			return next;
		});
	}

	function onProductChange(index: number, productId: string) {
		const selected = products.find((product) => product.id === productId);
		updateRow(index, {
			product_id: productId,
			product_name: selected?.name ?? '',
			billing_model: selected?.billing_model ?? '',
			category: selected?.category ?? '',
			inactive: false,
			subscription_start:
				selected?.billing_model === 'subscription'
					? (itemRows[index]?.subscription_start ?? '')
					: '',
			subscription_end:
				selected?.billing_model === 'subscription' ? (itemRows[index]?.subscription_end ?? '') : ''
		});
	}

	function addItem() {
		itemRows = [...itemRows, makeRow()];
	}

	function removeItem(index: number) {
		itemRows = itemRows.filter((_, i) => i !== index);
	}

	function itemsPayloadChanged() {
		if (itemRows.length !== currentDeal.items.length) return true;
		return itemRows.some((row, index) => {
			const existing = currentDeal.items[index];
			return (
				row.id !== existing?.id ||
				row.product_id !== existing?.product_id ||
				row.quantity !== existing?.quantity ||
				row.unit_price !== existing?.unit_price ||
				row.discount_percent !== existing?.discount_percent ||
				row.subscription_start !== (existing?.subscription_start ?? '') ||
				row.subscription_end !== (existing?.subscription_end ?? '')
			);
		});
	}

	function validateItems(): string {
		if (duplicateProductIds.size > 0)
			return 'Satu produk tidak boleh muncul dua kali dalam satu deal.';
		for (const row of itemRows) {
			if (!row.product_id) return 'Setiap item wajib memilih produk aktif.';
			const quantity = Number(row.quantity);
			const unitPrice = Number(row.unit_price);
			const discount = Number(row.discount_percent);
			if (!Number.isFinite(quantity) || quantity <= 0)
				return 'Quantity item harus lebih besar dari 0.';
			if (!Number.isFinite(unitPrice) || unitPrice < 0) return 'Harga item tidak boleh negatif.';
			if (!Number.isFinite(discount) || discount < 0 || discount > 100)
				return 'Diskon item harus berada di antara 0 sampai 100.';
			if (row.billing_model === 'subscription') {
				const hasStart = !!row.subscription_start;
				const hasEnd = !!row.subscription_end;
				if (hasStart !== hasEnd)
					return 'Periode subscription harus lengkap atau kosong seluruhnya.';
				if (hasStart && hasEnd && row.subscription_end < row.subscription_start)
					return 'Tanggal akhir subscription tidak boleh lebih awal dari tanggal mulai.';
			}
		}
		if (stage !== 'demo' && stage !== 'lost' && itemRows.length === 0) {
			return 'Deal tidak boleh keluar dari tahap Demo sebelum memiliki minimal satu item.';
		}
		return '';
	}

	async function loadCompanyStatus(companyId: string) {
		const controller = companyRequest.start();
		companyStatusLoading = true;
		try {
			const company = await companiesApi.getCompany(companyId, controller.signal);
			if (!companyRequest.isCurrent(controller)) return;
			companyStatus = company.status;
		} catch {
			if (!companyRequest.isCurrent(controller)) return;
			companyStatus = null;
		} finally {
			if (companyRequest.finish(controller)) companyStatusLoading = false;
		}
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (currentDeal.pipeline_status === 'win' || currentDeal.pipeline_status === 'lost') {
			toast.error('Deal terminal tidak dapat diedit.');
			onclose();
			return;
		}

		formError = validateItems();
		if (formError) return;

		saving = true;
		try {
			await dealsApi.updateDeal(currentDeal.id, {
				expected_version: currentDeal.version,
				pipeline_status: stage !== currentDeal.pipeline_status ? stage : undefined,
				deal_type:
					dealType !== currentDeal.deal_type
						? (dealType as 'new' | 'upsell' | 'cross_sell' | 'renewal')
						: undefined,
				notes: notes !== (currentDeal.notes ?? '') ? notes : undefined,
				items: itemsPayloadChanged()
					? itemRows.map((row) => ({
							id: row.id,
							product_id: row.product_id,
							quantity: row.quantity,
							unit_price: row.unit_price,
							discount_percent: row.discount_percent,
							subscription_start:
								row.billing_model === 'subscription' && row.subscription_start
									? row.subscription_start
									: undefined,
							subscription_end:
								row.billing_model === 'subscription' && row.subscription_end
									? row.subscription_end
									: undefined
						}))
					: undefined
			});
			toast.success('Deal berhasil diperbarui.');
			onsaved();
		} catch (err) {
			if (err instanceof ApiError && err.status === 409) {
				try {
					const latest = await dealsApi.getDealDetail(currentDeal.id);
					hydrateDeal(latest);
					if (latest.pipeline_status === 'win' || latest.pipeline_status === 'lost') {
						toast.error('Deal sudah berubah menjadi terminal. Modal edit ditutup.');
						onclose();
						return;
					}
					toast.error('Deal berubah karena update lain. Data terbaru sudah dimuat.');
					return;
				} catch {
					// gunakan pesan backend asli bila refetch gagal
				}
			}
			formError = toMessage(err);
		} finally {
			saving = false;
		}
	}

	$effect(() => {
		const companyId = currentDeal.company.id;
		void loadCompanyStatus(companyId);
		return () => companyRequest.abort();
	});
</script>

<Modal title="Edit Deal" size="lg" onclose={saving ? undefined : onclose} {onclosed}>
	<form id="deal-form" onsubmit={handleSubmit} class="space-y-5">
		<div class="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm">
			<p class="font-medium text-ink">{currentDeal.name}</p>
			<p class="text-xs text-muted">{currentDeal.company.name}</p>
			<p class="mt-2 text-xs text-muted">
				Preview total: <span class="font-medium text-ink">{formatCurrency(localTotal)}</span>
				· total final dihitung ulang oleh backend saat simpan.
			</p>
		</div>

		<div class="grid gap-4 sm:grid-cols-2">
			<Select label="Tahap Pipeline" bind:value={stage} options={stageOptions} required />
			<Select
				label="Tipe Deal"
				bind:value={dealType}
				options={dealTypeOptions}
				disabled={companyStatusLoading || dealTypeOptions.length === 0}
				required
			/>
		</div>
		{#if companyStatus === 'contact'}
			<p class="text-xs text-muted">Company contact hanya dapat memakai deal type `new`.</p>
		{:else if companyStatus === 'leads'}
			<p class="text-xs text-muted">
				Company leads tidak dapat mengganti tipe deal sampai masuk workflow contact/customer.
			</p>
		{:else if companyStatus === 'customer'}
			<p class="text-xs text-muted">
				Company customer hanya dapat memakai deal type `upsell`, `cross_sell`, atau
				`renewal`. Deal historis tetap bisa disimpan tanpa mengubah tipenya.
			</p>
		{:else if !companyStatusLoading}
			<p class="text-xs text-muted">
				Status company belum dapat dimuat. Tipe deal dikunci ke nilai saat ini untuk mencegah
				payload yang tidak sesuai backend.
			</p>
		{/if}

		<div class="space-y-3">
			<div class="flex items-center justify-between gap-3">
				<div>
					<h4 class="font-semibold text-ink">Deal Items</h4>
					<p class="text-xs text-muted">
						Payload `items[]` dikirim sebagai full replacement saat disimpan.
					</p>
				</div>
				<Button type="button" size="sm" onclick={addItem}>
					<Icon name="plus" size={14} /> Tambah Item
				</Button>
			</div>

			{#if currentDeal.pipeline_status === 'demo' && itemRows.length === 0}
				<div
					class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
				>
					Tambahkan Product setelah Demo sebelum Deal dipindahkan ke tahap selain Demo/Lost.
				</div>
			{/if}

			{#if itemRows.length === 0}
				<div
					class="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted"
				>
					Belum ada item pada deal ini.
				</div>
			{:else}
				<div class="space-y-4">
					{#each itemRows as row, index (row.key)}
						<div class="rounded-xl border border-line p-4">
							<div class="mb-3 flex items-center justify-between gap-3">
								<div>
									<p class="font-medium text-ink">Item #{index + 1}</p>
									{#if row.inactive}
										<p class="mt-1 text-xs text-amber-700">
											Produk historis nonaktif tetap dipertahankan sebagai snapshot read-only.
										</p>
									{/if}
								</div>
								<Button
									type="button"
									size="sm"
									variant="ghost"
									onclick={() => removeItem(index)}
								>
									Hapus
								</Button>
							</div>

							<div class="grid gap-4 sm:grid-cols-2">
								{#if row.inactive}
									<div class="sm:col-span-2">
										<p class="text-sm font-medium text-ink-soft">Produk</p>
										<div
											class="mt-1 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink"
										>
											{row.product_name} · {row.category} · {row.billing_model}
										</div>
									</div>
								{:else}
									<div class="sm:col-span-2">
										<Select
											label="Produk"
											value={row.product_id}
											options={productOptions}
											placeholder="Pilih produk aktif"
											error={duplicateProductIds.has(row.product_id)
												? 'Produk ini sudah dipilih pada item lain.'
												: ''}
											onchange={(e) =>
												onProductChange(
													index,
													(e.currentTarget as HTMLSelectElement).value
												)}
											required
										/>
									</div>
								{/if}

								<TextField
									label="Quantity"
									type="number"
									inputmode="decimal"
									min="0.01"
									step="0.01"
									value={row.quantity}
									oninput={(e) =>
										updateRow(index, {
											quantity: (e.currentTarget as HTMLInputElement).value
										})}
									placeholder="1"
									required
								/>
								<TextField
									label="Harga Satuan"
									type="number"
									inputmode="decimal"
									min="0"
									step="0.01"
									value={row.unit_price}
									oninput={(e) =>
										updateRow(index, {
											unit_price: (e.currentTarget as HTMLInputElement).value
										})}
									placeholder="0"
									required
								/>
								<TextField
									label="Diskon (%)"
									type="number"
									inputmode="decimal"
									min="0"
									max="100"
									step="0.01"
									value={row.discount_percent}
									oninput={(e) =>
										updateRow(index, {
											discount_percent: (e.currentTarget as HTMLInputElement).value
										})}
									placeholder="0"
									required
								/>
								<div class="flex flex-col gap-1.5">
									<p class="text-sm font-medium text-ink-soft">Subtotal Preview</p>
									<div
										class="h-10 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink"
									>
										{formatCurrency(asNumber(row.subtotal_preview))}
									</div>
								</div>

								{#if row.billing_model === 'subscription'}
									<TextField
										label="Tanggal Mulai Subscription"
										type="date"
										value={row.subscription_start}
										oninput={(e) =>
											updateRow(index, {
												subscription_start: (e.currentTarget as HTMLInputElement).value
											})}
									/>
									<TextField
										label="Tanggal Akhir Subscription"
										type="date"
										value={row.subscription_end}
										oninput={(e) =>
											updateRow(index, {
												subscription_end: (e.currentTarget as HTMLInputElement).value
											})}
									/>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<Textarea
			label="Catatan Deal"
			rows={4}
			bind:value={notes}
			placeholder="Tambahkan catatan internal bila diperlukan"
		/>

		{#if formError}
			<p class="text-sm text-brand">{formError}</p>
		{/if}
	</form>

	{#snippet footer()}
		<Button variant="secondary" onclick={onclose} disabled={saving}>Batal</Button>
		<Button type="submit" form="deal-form" loading={saving}>Simpan</Button>
	{/snippet}
</Modal>
