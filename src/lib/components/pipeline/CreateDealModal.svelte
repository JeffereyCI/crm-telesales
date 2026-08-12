<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		activeDealConflictId,
		contactsApi,
		dealsApi,
		formatCurrency,
		LatestRequest,
		productsApi,
		toMessage
	} from '$lib';
	import { toast } from '$lib/stores/toast.svelte';
	import type {
		ContactResponse,
		CreateDealRequest,
		DealDetailResponse,
		DealType,
		ProductCategory,
		ProductResponse,
		ProductVendor
	} from '$lib/types/api';
	import type { CompanyStaging } from '$lib/constants/enums';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import LoadingState from '$lib/components/ui/LoadingState.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';

	interface EditableItem {
		key: string;
		product_id: string;
		quantity: string;
		unit_price: string;
		discount_percent: string;
		subtotal_preview: string;
	}

	interface Props {
		company: { id: string; name: string; status: CompanyStaging };
		initialContactId?: string;
		lockContact?: boolean;
		onclose: () => void;
		onclosed?: () => void;
		oncreated: (deal: DealDetailResponse, replayed: boolean) => void;
	}

	let {
		company,
		initialContactId = '',
		lockContact = false,
		onclose,
		onclosed,
		oncreated
	}: Props = $props();

	const contactsRequest = new LatestRequest();
	const productsRequest = new LatestRequest();

	let contacts = $state<ContactResponse[]>([]);
	let products = $state<ProductResponse[]>([]);
	let contactsLoading = $state(true);
	let productsLoading = $state(true);
	let loadError = $state('');

	let name = $state('');
	let contactId = $state('');
	let dealType = $state<DealType>('new');
	let itemRows = $state<EditableItem[]>([]);
	let vendorFilter = $state('');
	let categoryFilter = $state('');
	let saving = $state(false);
	let formError = $state('');
	let activeConflictDealId = $state('');
	let idempotencyKey = $state(crypto.randomUUID());
	let intentSignature = $state('');
	const DECIMAL_INPUT_RE = /^\d+(?:\.\d+)?$/;

	function asNumber(value: string | number | null | undefined) {
		return Number(value ?? 0);
	}

	function round2(value: number): string {
		return (Math.round(value * 100) / 100).toFixed(2);
	}

	function normalizeDecimal(value: string, scale: number, integerDigits: number): string | null {
		const trimmed = value.trim();
		if (!DECIMAL_INPUT_RE.test(trimmed)) return null;

		const [wholePartRaw, fractionPartRaw = ''] = trimmed.split('.');
		const digits = `${wholePartRaw}${fractionPartRaw}`.replace(/^0+(?=\d)/, '') || '0';
		const numerator = BigInt(digits);
		const denominator = 10n ** BigInt(fractionPartRaw.length);
		const scaleFactor = 10n ** BigInt(scale);
		let scaled = (numerator * scaleFactor) / denominator;
		const remainder = (numerator * scaleFactor) % denominator;

		if (remainder * 2n >= denominator) scaled += 1n;

		let normalized = scaled.toString();
		if (scale > 0) {
			while (normalized.length <= scale) normalized = `0${normalized}`;
			normalized = `${normalized.slice(0, -scale)}.${normalized.slice(-scale)}`;
		}

		const wholePart = normalized.split('.', 1)[0].replace(/^0+/, '') || '0';
		return wholePart.length <= integerDigits ? normalized : null;
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

	function createRow(): EditableItem {
		return {
			key: crypto.randomUUID(),
			product_id: '',
			quantity: '1',
			unit_price: '0',
			discount_percent: '0',
			subtotal_preview: '0.00'
		};
	}

	const vendorOptions = $derived([
		{ value: '', label: 'Semua Vendor' },
		...([...new Set(products.map((product) => product.vendor))] as ProductVendor[])
			.sort((a, b) => a.localeCompare(b, 'id-ID'))
			.map((value) => ({ value, label: value.toUpperCase() }))
	]);

	const categoryOptions = $derived([
		{ value: '', label: 'Semua Kategori' },
		...([...new Set(products.map((product) => product.category))] as ProductCategory[])
			.sort((a, b) => a.localeCompare(b, 'id-ID'))
			.map((value) => ({ value, label: value.replace('_', ' ') }))
	]);

	const filteredProducts = $derived(
		products.filter(
			(product) =>
				(!vendorFilter || product.vendor === vendorFilter) &&
				(!categoryFilter || product.category === categoryFilter)
		)
	);

	const contactOptions = $derived(
		[...contacts]
			.sort((a, b) => a.name.localeCompare(b.name, 'id-ID'))
			.map((contact) => ({
				value: contact.id,
				label: `${contact.name}${contact.job_title ? ` · ${contact.job_title}` : ''}`
			}))
	);

	const dealTypeOptions = $derived(
		company.status === 'customer'
			? [
					{ value: 'upsell', label: 'Upsell' },
					{ value: 'cross_sell', label: 'Cross-Sell' },
					{ value: 'renewal', label: 'Renewal' }
				]
			: [{ value: 'new', label: 'New' }]
	);

	const duplicateProductIds = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const row of itemRows) {
			if (!row.product_id) continue;
			counts.set(row.product_id, (counts.get(row.product_id) ?? 0) + 1);
		}
		return new Set(
			[...counts.entries()].filter(([, count]) => count > 1).map(([productId]) => productId)
		);
	});

	const localTotal = $derived(
		itemRows.reduce((sum, row) => sum + asNumber(row.subtotal_preview), 0)
	);

	async function loadContacts() {
		const controller = contactsRequest.start();
		contactsLoading = true;
		loadError = '';
		try {
			const response = await contactsApi.listContacts(company.id, {}, controller.signal);
			if (!contactsRequest.isCurrent(controller)) return;
			contacts = response.data;
			if (!contactId && response.data.length === 1) {
				contactId = response.data[0].id;
			}
		} catch (err) {
			if (!contactsRequest.isCurrent(controller)) return;
			loadError = toMessage(err);
			contacts = [];
		} finally {
			if (contactsRequest.finish(controller)) contactsLoading = false;
		}
	}

	async function loadProducts() {
		const controller = productsRequest.start();
		productsLoading = true;
		loadError = '';
		try {
			const response = await productsApi.listProducts({}, controller.signal);
			if (!productsRequest.isCurrent(controller)) return;
			products = response;
		} catch (err) {
			if (!productsRequest.isCurrent(controller)) return;
			loadError = toMessage(err);
			products = [];
		} finally {
			if (productsRequest.finish(controller)) productsLoading = false;
		}
	}

	function productOptionsFor(selectedProductId = '') {
		const selected = products.find((product) => product.id === selectedProductId);
		const available =
			selected && !filteredProducts.some((product) => product.id === selected.id)
				? [selected, ...filteredProducts]
				: filteredProducts;
		return available.map((product) => ({
			value: product.id,
			label: `${product.vendor.toUpperCase()} · ${product.category} · ${product.name}`
		}));
	}

	function addItem() {
		itemRows = [...itemRows, createRow()];
	}

	function removeItem(index: number) {
		itemRows = itemRows.filter((_, rowIndex) => rowIndex !== index);
	}

	function updateRow(index: number, patch: Partial<EditableItem>) {
		itemRows = itemRows.map((row, rowIndex) => {
			if (rowIndex !== index) return row;
			const next = { ...row, ...patch };
			next.subtotal_preview = subtotalPreview(
				next.quantity,
				next.unit_price,
				next.discount_percent
			);
			return next;
		});
	}

	function validateForm() {
		if (company.status === 'leads') {
			return 'Company dengan status Leads harus melalui workflow Contact dan Schedule Meeting terlebih dahulu.';
		}
		if (!name.trim()) return 'Nama deal wajib diisi.';
		if (!contactId) return 'PIC wajib dipilih.';
		if (itemRows.length === 0) return 'Minimal satu product item wajib diisi.';
		if (duplicateProductIds.size > 0) {
			return 'Satu product tidak boleh muncul dua kali dalam deal yang sama.';
		}
		for (const row of itemRows) {
			if (!row.product_id) return 'Setiap item wajib memilih product aktif.';
			const quantity = Number(row.quantity);
			const unitPrice = Number(row.unit_price);
			const discount = Number(row.discount_percent);
			if (!Number.isFinite(quantity) || quantity <= 0)
				return 'Quantity item harus lebih besar dari 0.';
			if (!Number.isFinite(unitPrice) || unitPrice < 0) return 'Harga item tidak boleh negatif.';
			if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
				return 'Diskon item harus berada di antara 0 sampai 100.';
			}
			if (!normalizeDecimal(row.quantity, 2, 10)) {
				return 'Quantity item harus berupa angka desimal valid dengan maksimal 10 digit integer.';
			}
			if (!normalizeDecimal(row.unit_price, 2, 13)) {
				return 'Harga item harus berupa angka desimal valid dengan maksimal 13 digit integer.';
			}
			if (!normalizeDecimal(row.discount_percent, 2, 3)) {
				return 'Diskon item harus berupa angka desimal valid dengan maksimal 3 digit integer.';
			}
		}
		return '';
	}

	function createPayload(): CreateDealRequest {
		return {
			company_id: company.id,
			contact_id: contactId,
			name: name.trim(),
			deal_type: dealType,
			items: itemRows.map((row) => ({
				product_id: row.product_id,
				quantity: normalizeDecimal(row.quantity, 2, 10) ?? row.quantity.trim(),
				unit_price: normalizeDecimal(row.unit_price, 2, 13) ?? row.unit_price.trim(),
				discount_percent:
					normalizeDecimal(row.discount_percent, 2, 3) ?? row.discount_percent.trim()
			}))
		};
	}

	function payloadSignature(payload: CreateDealRequest) {
		return JSON.stringify(payload);
	}

	function ensureIntentKey(signature: string) {
		if (intentSignature !== signature) {
			intentSignature = signature;
			idempotencyKey = crypto.randomUUID();
		}
		return idempotencyKey;
	}

	function openActiveConflictDeal() {
		if (!activeConflictDealId) return;
		onclose();
		void goto(`/pipeline?deal=${encodeURIComponent(activeConflictDealId)}`);
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		formError = validateForm();
		activeConflictDealId = '';
		if (formError) return;

		const payload = createPayload();
		const signature = payloadSignature(payload);
		const key = ensureIntentKey(signature);

		saving = true;
		try {
			const created = await dealsApi.createDeal(payload, key);
			const dealId = created.location?.split('/').filter(Boolean).pop() || created.deal.id;
			const detail =
				dealId && dealId !== created.deal.id ? await dealsApi.getDealDetail(dealId) : created.deal;
			if (!created.replayed) {
				toast.success('Deal berhasil dibuat.');
			}
			oncreated(detail, created.replayed);
		} catch (err) {
			activeConflictDealId = activeDealConflictId(err) ?? '';
			formError = toMessage(err);
		} finally {
			saving = false;
		}
	}

	$effect(() => {
		contactId = initialContactId;
		dealType = company.status === 'customer' ? 'upsell' : 'new';
		itemRows = [createRow()];
		void Promise.all([loadContacts(), loadProducts()]);
		return () => {
			contactsRequest.abort();
			productsRequest.abort();
		};
	});
</script>

<Modal title="Buat Deal Baru" size="lg" onclose={saving ? undefined : onclose} {onclosed}>
	<form id="create-deal-form" class="space-y-5" onsubmit={submit}>
		<div class="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm">
			<p class="font-medium text-ink">{company.name}</p>
			<p class="text-xs text-muted">
				Status company: {company.status}
				{#if company.status === 'contact'}
					· hanya deal type <strong>new</strong> yang diizinkan
				{:else if company.status === 'customer'}
					· hanya <strong>upsell</strong>, <strong>cross-sell</strong>, atau
					<strong>renewal</strong>
				{/if}
			</p>
			<p class="mt-2 text-xs text-muted">
				Preview total item:
				<span class="font-medium text-ink">{formatCurrency(localTotal)}</span>
				· total final dihitung backend.
			</p>
		</div>

		{#if contactsLoading || productsLoading}
			<LoadingState />
		{:else if loadError}
			<EmptyState icon="alert-circle" title="Gagal memuat form" description={loadError} />
		{:else}
			<div class="grid gap-4 sm:grid-cols-2">
				<TextField
					label="Nama Deal"
					bind:value={name}
					maxlength={255}
					placeholder="Contoh: Renewal SAP 2027"
					required
				/>
				<Select
					label="Deal Type"
					bind:value={dealType}
					options={dealTypeOptions}
					disabled={dealTypeOptions.length === 1}
					required
				/>
				<Select
					label="PIC"
					bind:value={contactId}
					options={contactOptions}
					placeholder="Pilih PIC"
					disabled={lockContact}
					required
				/>
			</div>

			{#if contacts.length === 0}
				<p class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
					Belum ada PIC aktif pada company ini. Tambahkan contact aktif terlebih dahulu.
				</p>
			{/if}

			<div class="space-y-3">
				<div class="flex items-center justify-between gap-3">
					<div>
						<h4 class="font-semibold text-ink">Deal Items</h4>
						<p class="text-xs text-muted">Minimal satu product/service wajib dipilih.</p>
					</div>
					<Button type="button" size="sm" onclick={addItem}>
						<Icon name="plus" size={14} /> Tambah Item
					</Button>
				</div>

				<div class="grid gap-3 sm:grid-cols-2">
					<Select label="Filter Vendor" bind:value={vendorFilter} options={vendorOptions} />
					<Select label="Filter Kategori" bind:value={categoryFilter} options={categoryOptions} />
				</div>

				<div class="space-y-4">
					{#each itemRows as row, index (row.key)}
						<div class="rounded-xl border border-line p-4">
							<div class="mb-3 flex items-center justify-between gap-3">
								<p class="font-medium text-ink">Item #{index + 1}</p>
								<Button
									type="button"
									size="sm"
									variant="ghost"
									onclick={() => removeItem(index)}
									disabled={itemRows.length === 1}
								>
									Hapus
								</Button>
							</div>
							<div class="grid gap-4 sm:grid-cols-2">
								<div class="sm:col-span-2">
									<Select
										label="Product"
										value={row.product_id}
										options={productOptionsFor(row.product_id)}
										placeholder="Pilih product aktif"
										error={duplicateProductIds.has(row.product_id)
											? 'Product ini sudah dipilih pada item lain.'
											: ''}
										onchange={(e) =>
											updateRow(index, {
												product_id: (e.currentTarget as HTMLSelectElement).value
											})}
										required
									/>
								</div>
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
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		{#if activeConflictDealId}
			<div class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
				PIC ini sudah memiliki deal aktif. Tambahkan product ke deal yang ada, bukan membuat PIC
				palsu.
			</div>
		{/if}

		{#if formError}
			<p class="text-sm text-brand">{formError}</p>
		{/if}
	</form>

	{#snippet footer()}
		{#if activeConflictDealId}
			<Button variant="secondary" onclick={openActiveConflictDeal} disabled={saving}>
				Buka Deal Aktif
			</Button>
		{/if}
		<Button variant="secondary" onclick={onclose} disabled={saving}>Batal</Button>
		<Button
			type="submit"
			form="create-deal-form"
			loading={saving}
			disabled={contactsLoading ||
				productsLoading ||
				contacts.length === 0 ||
				company.status === 'leads'}
		>
			Buat Deal
		</Button>
	{/snippet}
</Modal>
