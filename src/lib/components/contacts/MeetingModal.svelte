<!--
  Jadwalkan meeting (Telesales). Prasyarat backend: response_status === 'tertarik'.
  Tombol pembuka sudah di-gate; modal hanya muncul bila syarat terpenuhi.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { contactsApi, meetingTemplatesApi, productsApi, validate, toMessage } from '$lib';
	import { toast } from '$lib/stores/toast.svelte';
	import { LIMITS } from '$lib/constants/limits';
	import type {
		ContactResponse,
		MeetingTemplateResponse,
		ProductResponse,
		ScheduleMeetingRequest
	} from '$lib/types/api';
	import type { PipelinePhase } from '$lib/constants/enums';
	import type { Errors } from '$lib/utils/validation';
	import Modal from '$lib/components/ui/Modal.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import TextField from '$lib/components/ui/TextField.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';

	interface Props {
		contact: ContactResponse;
		pipelineStatus?: PipelinePhase;
		isFollowUp?: boolean;
		onclose: () => void;
		onsaved: () => void;
	}
	let { contact, pipelineStatus = 'demo', isFollowUp = false, onclose, onsaved }: Props = $props();

	// Lokasi: pilihan tetap & ringkas (backend hanya simpan string, opsional).
	const LOCATION_OPTIONS = [
		{ value: 'Kantor Klien', label: 'Kantor Klien' },
		{ value: 'Kantor Kami', label: 'Kantor Kami' },
		{ value: 'Online (Zoom)', label: 'Online (Zoom)' },
		{ value: 'Online (Google Meet)', label: 'Online (Google Meet)' },
		{ value: 'Online (Microsoft Teams)', label: 'Online (Microsoft Teams)' },
		{ value: 'Telepon', label: 'Telepon' }
	];

	// Tanggal minimum untuk native date picker = hari ini (komponen LOKAL, bukan
	// toISOString() yang bisa menggeser tanggal di timezone positif seperti GMT+7).
	const pad2 = (n: number) => String(n).padStart(2, '0');
	const _today = new Date();
	const todayStr = `${_today.getFullYear()}-${pad2(_today.getMonth() + 1)}-${pad2(_today.getDate())}`;

	let meetingDate = $state('');
	let meetingTime = $state('');
	let location = $state('');
	let agenda = $state('');
	let templateId = $state('');
	let templates = $state<MeetingTemplateResponse[]>([]);
	let templatesLoading = $state(true);
	// CRM-003: produk & nilai estimasi (opsional) → menempel ke Deal yang otomatis
	// dibuat backend saat meeting dijadwalkan.
	let productId = $state('');
	let amount = $state('');
	let products = $state<ProductResponse[]>([]);
	let errors = $state<Errors>({});
	let saving = $state(false);

	const productOptions = $derived(products.map((p) => ({ value: p.id, label: p.name })));
	const availableTemplates = $derived(
		templates.filter((t) => t.type === 'private' || t.category === pipelineStatus)
	);
	const templateOptions = $derived(
		availableTemplates.map((t) => ({
			value: t.id,
			label: `${t.type === 'public' ? 'Publik' : 'Privat'} · ${t.name}`
		}))
	);

	// Muat daftar produk saat modal dibuka (endpoint shared bdm+telesales).
	// Gagal muat tidak boleh memblokir penjadwalan — produk kan opsional.
	onMount(async () => {
		const [productResult, templateResult] = await Promise.allSettled([
			isFollowUp ? Promise.resolve([]) : productsApi.listProducts(),
			meetingTemplatesApi.listTemplates()
		]);
		products = productResult.status === 'fulfilled' ? productResult.value : [];
		templates = templateResult.status === 'fulfilled' ? templateResult.value : [];
		templatesLoading = false;
	});

	function applyTemplate() {
		const selected = availableTemplates.find((t) => t.id === templateId);
		if (selected) agenda = selected.body;
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		const amountErr = validate.validateAmount(amount);
		const payload: ScheduleMeetingRequest = {
			meeting_date: meetingDate,
			meeting_time: meetingTime,
			location,
			agenda: agenda.trim(),
			template_id: templateId || undefined,
			product_id: !isFollowUp && productId ? productId : undefined,
			amount: !isFollowUp && amount.trim() ? Number(amount) : undefined
		};
		errors = validate.validateMeeting(payload);
		if (amountErr) errors = { ...errors, amount: amountErr };
		if (!validate.isValid(errors)) return;

		saving = true;
		try {
			await contactsApi.scheduleMeeting(contact.id, payload);
			toast.success('Meeting berhasil dijadwalkan.');
			onsaved();
		} catch (err) {
			toast.error(toMessage(err));
		} finally {
			saving = false;
		}
	}
</script>

<Modal
	title={isFollowUp ? 'Jadwalkan Meeting Lanjutan' : 'Jadwalkan Meeting'}
	onclose={saving ? undefined : onclose}
>
	<form id="meeting-form" onsubmit={handleSubmit} class="space-y-4">
		<p class="text-sm text-muted">
			Kontak: <span class="font-medium text-ink">{contact.name}</span>
		</p>
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			<TextField
				label="Tanggal"
				type="date"
				min={todayStr}
				bind:value={meetingDate}
				error={errors.meeting_date}
				required
			/>
			<TextField
				label="Waktu"
				type="time"
				bind:value={meetingTime}
				error={errors.meeting_time}
				required
			/>
		</div>
		<Select
			label="Lokasi"
			bind:value={location}
			options={LOCATION_OPTIONS}
			error={errors.location}
			placeholder="Pilih lokasi (opsional)"
		/>
		<Select
			label="Template Agenda"
			bind:value={templateId}
			onchange={applyTemplate}
			options={templateOptions}
			disabled={templatesLoading}
			placeholder={templatesLoading ? 'Memuat template…' : 'Pilih template (opsional)'}
		/>
		<Textarea
			label="Agenda"
			bind:value={agenda}
			error={errors.agenda}
			maxlength={LIMITS.agenda}
			rows={5}
			placeholder="Tuliskan agenda meeting"
			required
		/>

		{#if !isFollowUp}
			<!-- Produk & nilai estimasi Deal. Saat meeting dibuat, backend otomatis
		     membentuk Deal di tahap Demo — data di bawah langsung menempel padanya. -->
			<div class="rounded-lg border border-line bg-surface-2 p-3">
				<p class="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted">
					<Icon name="package" size={13} /> Peluang Transaksi (opsional)
				</p>
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<Select
						label="Produk"
						bind:value={productId}
						options={productOptions}
						placeholder={products.length ? 'Pilih produk' : 'Belum ada produk'}
					/>
					<TextField
						label="Nilai Estimasi (Rp)"
						type="number"
						min="0"
						step="1000"
						bind:value={amount}
						error={errors.amount}
						placeholder="0"
					/>
				</div>
			</div>
		{/if}
	</form>

	{#snippet footer()}
		<Button variant="secondary" onclick={onclose} disabled={saving}>Batal</Button>
		<Button type="submit" form="meeting-form" loading={saving}>Jadwalkan</Button>
	{/snippet}
</Modal>
