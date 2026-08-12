<script lang="ts">
	import { onMount } from 'svelte';
	import {
		LatestRequest,
		auth,
		can,
		formatDate,
		meetingTemplatesApi,
		PIPELINE_PHASE_LABEL,
		toMessage
	} from '$lib';
	import { toast } from '$lib/stores/toast.svelte';
	import type { MeetingTemplateCategory, MeetingTemplateResponse } from '$lib/types/api';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import LoadingState from '$lib/components/ui/LoadingState.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import MeetingTemplateFormModal from '$lib/components/meeting-templates/MeetingTemplateFormModal.svelte';

	const PRIVATE_LIMIT = 5;
	const PUBLIC_CATEGORIES: MeetingTemplateCategory[] = [
		'demo',
		'proposal',
		'quotation',
		'waiting_list',
		'payment'
	];
	const canManageTemplates = can(auth.role, 'manageMeetingTemplates');
	let templates = $state<MeetingTemplateResponse[]>([]);
	let loading = $state(true);
	let errorMsg = $state('');
	let formTarget = $state<MeetingTemplateResponse | null | undefined>(undefined);
	let deleteTarget = $state<MeetingTemplateResponse | null>(null);
	let deleteBusy = $state(false);
	const loadRequest = new LatestRequest();

	const publicTemplates = $derived(
		PUBLIC_CATEGORIES.map((category) =>
			templates.find((t) => t.type === 'public' && t.category === category)
		)
	);
	const privateTemplates = $derived(
		templates
			.filter((t) => t.type === 'private')
			.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
	);
	const categoryLabel = (category: MeetingTemplateResponse['category']) =>
		category === 'general' ? 'Umum' : PIPELINE_PHASE_LABEL[category];

	async function load() {
		if (!canManageTemplates) {
			loading = false;
			errorMsg = '';
			templates = [];
			return;
		}
		const controller = loadRequest.start();
		loading = true;
		errorMsg = '';
		try {
			const result = await meetingTemplatesApi.listTemplates({}, controller.signal);
			if (!loadRequest.isCurrent(controller)) return;
			templates = result;
		} catch (err) {
			if (!loadRequest.isCurrent(controller)) return;
			errorMsg = toMessage(err);
			templates = [];
		} finally {
			if (loadRequest.finish(controller)) loading = false;
		}
	}

	onMount(() => {
		void load();
		return () => loadRequest.abort();
	});

	function saved() {
		formTarget = undefined;
		void load();
	}

	async function remove() {
		if (!deleteTarget) return;
		deleteBusy = true;
		try {
			await meetingTemplatesApi.deleteTemplate(deleteTarget.id);
			toast.success('Template privat berhasil dihapus.');
			deleteTarget = null;
			await load();
		} catch (err) {
			toast.error(toMessage(err));
		} finally {
			deleteBusy = false;
		}
	}
</script>

<svelte:head><title>Template Agenda · CRM Telesales</title></svelte:head>

<PageHeader
	title="Template Agenda"
	description="Kelola agenda publik kolaboratif dan template privat Anda."
/>

{#if loading}
	<LoadingState />
{:else if !canManageTemplates}
	<EmptyState
		icon="alert-circle"
		title="Akses dibatasi"
		description="Halaman Template Agenda hanya tersedia untuk role BDM."
	/>
{:else if errorMsg}
	<EmptyState icon="alert-circle" title="Gagal memuat template" description={errorMsg}>
		{#snippet action()}<Button variant="secondary" onclick={load}>Coba lagi</Button>{/snippet}
	</EmptyState>
{:else}
	<section class="mb-8">
		<div class="mb-3">
			<h2 class="text-lg font-semibold text-ink">Template Publik</h2>
			<p class="text-sm text-muted">Satu template bersama untuk setiap fase pipeline aktif.</p>
		</div>
		<div class="grid gap-4 lg:grid-cols-2">
			{#each publicTemplates as template, index (`public-${PUBLIC_CATEGORIES[index]}`)}
				{@const category = PUBLIC_CATEGORIES[index]}
				<article class="rounded-xl border border-line bg-surface p-4">
					<div class="flex items-start justify-between gap-3">
						<div>
							<p class="text-xs font-semibold tracking-wide text-brand uppercase">
								{categoryLabel(category)}
							</p>
							<h3 class="mt-1 font-semibold text-ink">
								{template?.name ?? 'Template belum tersedia'}
							</h3>
						</div>
						{#if template}
							<Button variant="secondary" onclick={() => (formTarget = template)}>
								<Icon name="pencil" size={14} /> Edit Isi
							</Button>
						{/if}
					</div>
					<p class="mt-3 line-clamp-5 text-sm whitespace-pre-wrap text-muted">
						{template?.body ??
							'Seeder template publik untuk kategori ini belum tersedia. Hubungi tim backend bila data awal tidak muncul.'}
					</p>
				</article>
			{/each}
		</div>
	</section>

	<section>
		<div class="mb-3 flex items-end justify-between gap-4">
			<div>
				<h2 class="text-lg font-semibold text-ink">Template Privat</h2>
				<p class="text-sm text-muted">
					Hanya dapat dilihat dan dikelola oleh Anda ({privateTemplates.length}/{PRIVATE_LIMIT}).
				</p>
			</div>
			{#if auth.role === 'bdm'}
				<Button
					onclick={() => (formTarget = null)}
					disabled={privateTemplates.length >= PRIVATE_LIMIT}
				>
					<Icon name="plus" size={16} /> Tambah Template
				</Button>
			{/if}
		</div>
		{#if privateTemplates.length === 0}
			<div class="rounded-xl border border-line bg-surface">
				<EmptyState
					icon="notebook-tabs"
					title="Belum ada template privat"
					description="Buat template agenda yang sering Anda gunakan."
				/>
			</div>
		{:else}
			<div class="overflow-hidden rounded-xl border border-line bg-surface">
				<div class="overflow-x-auto">
					<table class="w-full text-left text-sm">
						<thead class="border-b border-line bg-surface-2 text-xs text-muted uppercase">
							<tr
								><th class="px-4 py-3">Nama</th><th class="px-4 py-3">Kategori</th><th
									class="px-4 py-3">Diperbarui</th
								><th class="px-4 py-3 text-center">Aksi</th></tr
							>
						</thead>
						<tbody class="divide-y divide-line">
							{#each privateTemplates as template (template.id)}
								<tr class="hover:bg-surface-2">
									<td class="px-4 py-3"
										><p class="font-medium text-ink">{template.name}</p>
										<p class="mt-1 max-w-lg truncate text-xs text-muted">{template.body}</p></td
									>
									<td class="px-4 py-3 text-muted">{categoryLabel(template.category)}</td>
									<td class="px-4 py-3 text-muted">{formatDate(template.updated_at)}</td>
									<td class="px-4 py-3"
										><div class="flex justify-center gap-1">
											<button
												class="rounded-lg px-2 py-1 text-xs font-medium text-brand hover:bg-brand-soft"
												onclick={() => (formTarget = template)}
												><Icon name="pencil" size={13} /> Edit</button
											><button
												class="rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
												onclick={() => (deleteTarget = template)}
												><Icon name="trash-2" size={13} /> Hapus</button
											>
										</div></td
									>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}
	</section>
{/if}

{#if formTarget !== undefined}
	<MeetingTemplateFormModal
		template={formTarget}
		onclose={() => (formTarget = undefined)}
		onsaved={saved}
	/>
{/if}

{#if deleteTarget}
	<ConfirmDialog
		title="Hapus Template Privat"
		message={`Hapus template “${deleteTarget.name}”?`}
		confirmLabel="Hapus"
		danger
		loading={deleteBusy}
		onconfirm={remove}
		oncancel={() => (deleteTarget = null)}
	/>
{/if}
