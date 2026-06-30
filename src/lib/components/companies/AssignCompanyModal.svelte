<!--
  Tugaskan / Pindahkan perusahaan ke Telesales (BDM).
  - Semua perusahaan terpilih belum ditugaskan → mode "assign" (POST /companies/assign).
  - Ada minimal satu yang sudah ditugaskan      → mode "reassign" (POST /companies/reassign),
    dengan field catatan opsional.

  Roster telesales diambil dari /reports/team (per_telesales[].user) karena
  endpoint /users hanya untuk admin. Ini satu-satunya sumber daftar telesales
  yang boleh diakses BDM.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { companiesApi, reportsApi, toMessage } from '$lib';
	import { toast } from '$lib/stores/toast.svelte';
	import { LIMITS } from '$lib/constants/limits';
	import type { CompanyResponse } from '$lib/types/api';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import Alert from '$lib/components/ui/Alert.svelte';

	interface Props {
		companies: CompanyResponse[];
		onclose: () => void;
		onsaved: () => void;
	}
	let { companies, onclose, onsaved }: Props = $props();

	// Reassign bila ada perusahaan yang sudah punya pemilik.
	const isReassign = $derived(companies.some((c) => c.assigned_to !== null));
	const title = $derived(isReassign ? 'Pindahkan Perusahaan' : 'Tugaskan Perusahaan');

	let telesalesOptions = $state<{ value: string; label: string }[]>([]);
	let rosterLoading = $state(true);
	let rosterError = $state('');

	let assignedTo = $state('');
	let notes = $state('');
	let fieldError = $state('');
	let saving = $state(false);

	async function loadRoster() {
		rosterLoading = true;
		rosterError = '';
		try {
			const report = await reportsApi.getTeamReport();
			telesalesOptions = report.per_telesales.map((t) => ({
				value: t.user.id,
				label: t.user.name
			}));
			if (telesalesOptions.length === 0) {
				rosterError = 'Belum ada telesales yang bisa dituju.';
			}
		} catch (err) {
			rosterError = toMessage(err);
		} finally {
			rosterLoading = false;
		}
	}

	onMount(loadRoster);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!assignedTo) {
			fieldError = 'Pilih telesales tujuan.';
			return;
		}
		fieldError = '';

		const ids = companies.map((c) => c.id);
		saving = true;
		try {
			if (isReassign) {
				await companiesApi.reassignCompanies({
					company_ids: ids,
					new_assigned_to: assignedTo,
					notes: notes || undefined
				});
			} else {
				await companiesApi.assignCompanies({ company_ids: ids, assigned_to: assignedTo });
			}
			toast.success(
				`${ids.length} perusahaan berhasil di${isReassign ? 'pindahkan' : 'tugaskan'}.`
			);
			onsaved();
		} catch (err) {
			toast.error(toMessage(err));
		} finally {
			saving = false;
		}
	}
</script>

<Modal {title} onclose={saving ? undefined : onclose}>
	<form id="assign-form" onsubmit={handleSubmit} class="space-y-4">
		<p class="text-sm text-muted">
			{companies.length} perusahaan terpilih akan {isReassign ? 'dipindahkan' : 'ditugaskan'} ke:
		</p>

		{#if rosterLoading}
			<p class="text-sm text-subtle">Memuat daftar telesales…</p>
		{:else if rosterError}
			<Alert variant="error">{rosterError}</Alert>
		{:else}
			<Select
				label="Telesales"
				bind:value={assignedTo}
				options={telesalesOptions}
				placeholder="Pilih telesales"
				error={fieldError}
				required
			/>
			{#if isReassign}
				<Textarea
					label="Catatan"
					bind:value={notes}
					maxlength={LIMITS.notes}
					rows={2}
					placeholder="Alasan pemindahan (opsional)"
				/>
			{/if}
		{/if}
	</form>

	{#snippet footer()}
		<Button variant="secondary" onclick={onclose} disabled={saving}>Batal</Button>
		<Button
			type="submit"
			form="assign-form"
			loading={saving}
			disabled={rosterLoading || !!rosterError}
		>
			{isReassign ? 'Pindahkan' : 'Tugaskan'}
		</Button>
	{/snippet}
</Modal>
