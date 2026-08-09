<!-- Form tambah/edit produk (BDM). Validasi mirror binding backend + sanitasi saat submit. -->
<script lang="ts">
	import { untrack } from 'svelte';
	import { productsApi, validate, toMessage } from '$lib';
	import { toast } from '$lib/stores/toast.svelte';
	import { LIMITS } from '$lib/constants/limits';
	import type {
		ProductBillingModel,
		ProductCategory,
		ProductResponse,
		ProductVendor
	} from '$lib/types/api';
	import type { Errors } from '$lib/utils/validation';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import Select from '$lib/components/ui/Select.svelte';

	interface Props {
		product?: ProductResponse | null;
		onclose: () => void;
		onclosed?: () => void;
		onsaved: () => void;
	}
	let { product = null, onclose, onclosed, onsaved }: Props = $props();

	// Snapshot non-reaktif: modal di-mount ulang tiap dibuka (keyed parent).
	const initial = untrack(() => product);
	const isEdit = !!initial;
	let code = $state(initial?.code ?? '');
	let name = $state(initial?.name ?? '');
	let description = $state(initial?.description ?? '');
	let vendor = $state<ProductVendor>(initial?.vendor ?? 'sap');
	let billingModel = $state<ProductBillingModel>(initial?.billing_model ?? 'subscription');
	let category = $state<ProductCategory>(initial?.category ?? 'license');
	let errors = $state<Errors>({});
	let saving = $state(false);

	const vendorOptions = [
		{ value: 'sap', label: 'SAP' },
		{ value: 'yonyou', label: 'Yonyou' },
		{ value: 'salesforce', label: 'Salesforce' },
		{ value: 'internal', label: 'Internal' }
	] satisfies { value: ProductVendor; label: string }[];

	const billingModelOptions = [
		{ value: 'subscription', label: 'Subscription' },
		{ value: 'perpetual', label: 'Perpetual' },
		{ value: 'one_time', label: 'One Time' }
	] satisfies { value: ProductBillingModel; label: string }[];

	const categoryOptions = [
		{ value: 'license', label: 'License' },
		{ value: 'module', label: 'Module' },
		{ value: 'implementation', label: 'Implementation' },
		{ value: 'support', label: 'Support' },
		{ value: 'consulting', label: 'Consulting' }
	] satisfies { value: ProductCategory; label: string }[];

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		errors = validate.validateProduct({
			code,
			name,
			description,
			vendor,
			billing_model: billingModel,
			category
		});
		if (!validate.isValid(errors)) return;

		saving = true;
		try {
			if (isEdit && initial) {
				await productsApi.updateProduct(initial.id, {
					code,
					name,
					description,
					vendor,
					billing_model: billingModel,
					category
				});
				toast.success('Produk berhasil diperbarui.');
			} else {
				await productsApi.createProduct({
					code,
					name,
					description,
					vendor,
					billing_model: billingModel,
					category
				});
				toast.success('Produk baru berhasil dibuat.');
			}
			onsaved();
		} catch (err) {
			toast.error(toMessage(err));
		} finally {
			saving = false;
		}
	}
</script>

<Modal
	title={isEdit ? 'Edit Produk' : 'Tambah Produk'}
	onclose={saving ? undefined : onclose}
	{onclosed}
>
	<form id="product-form" onsubmit={handleSubmit} class="space-y-4">
		<TextField
			label="Kode Produk"
			bind:value={code}
			error={errors.code}
			maxlength={LIMITS.productCode}
			placeholder="mis. SAP-B1-LIC"
			autocomplete="off"
			disabled={isEdit}
			hint={isEdit ? 'Kode produk tidak dapat diubah setelah dibuat.' : ''}
			required
		/>
		<TextField
			label="Nama Produk"
			bind:value={name}
			error={errors.name}
			maxlength={LIMITS.productName}
			placeholder="mis. SAP Business One"
			autocomplete="off"
			required
		/>
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			<Select
				label="Vendor"
				bind:value={vendor}
				options={vendorOptions}
				error={errors.vendor}
				required
			/>
			<Select
				label="Billing Model"
				bind:value={billingModel}
				options={billingModelOptions}
				error={errors.billing_model}
				required
			/>
		</div>
		<Select
			label="Kategori"
			bind:value={category}
			options={categoryOptions}
			error={errors.category}
			required
		/>
		<Textarea
			label="Deskripsi"
			bind:value={description}
			error={errors.description}
			maxlength={LIMITS.productDescription}
			rows={3}
			placeholder="Deskripsi singkat produk (opsional)"
		/>
	</form>

	{#snippet footer()}
		<Button variant="secondary" onclick={onclose} disabled={saving}>Batal</Button>
		<Button type="submit" form="product-form" loading={saving}>
			{isEdit ? 'Simpan Perubahan' : 'Buat Produk'}
		</Button>
	{/snippet}
</Modal>
