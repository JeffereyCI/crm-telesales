<!-- Form tambah/edit produk (BDM). Validasi mirror binding backend + sanitasi saat submit. -->
<script lang="ts">
	import { untrack } from 'svelte';
	import { productsApi, validate, toMessage } from '$lib';
	import { toast } from '$lib/stores/toast.svelte';
	import { LIMITS } from '$lib/constants/limits';
	import type { ProductResponse } from '$lib/types/api';
	import type { Errors } from '$lib/utils/validation';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';

	interface Props {
		product?: ProductResponse | null;
		onclose: () => void;
		onsaved: () => void;
	}
	let { product = null, onclose, onsaved }: Props = $props();

	// Snapshot non-reaktif: modal di-mount ulang tiap dibuka (keyed parent).
	const initial = untrack(() => product);
	const isEdit = !!initial;
	let name = $state(initial?.name ?? '');
	let description = $state(initial?.description ?? '');
	let errors = $state<Errors>({});
	let saving = $state(false);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		errors = validate.validateProduct({ name, description });
		if (!validate.isValid(errors)) return;

		saving = true;
		try {
			if (isEdit && initial) {
				await productsApi.updateProduct(initial.id, { name, description });
				toast.success('Produk berhasil diperbarui.');
			} else {
				await productsApi.createProduct({ name, description });
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

<Modal title={isEdit ? 'Edit Produk' : 'Tambah Produk'} onclose={saving ? undefined : onclose}>
	<form id="product-form" onsubmit={handleSubmit} class="space-y-4">
		<TextField
			label="Nama Produk"
			bind:value={name}
			error={errors.name}
			maxlength={LIMITS.productName}
			placeholder="mis. SAP Business One"
			autocomplete="off"
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
