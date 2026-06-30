<script lang="ts">
	import type { CompanyDetailResponse } from '$lib/types/api';
	import { orDash, formatDate, ACTION_STATUS_LABEL, RESPONSE_STATUS_LABEL } from '$lib';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Icon from '$lib/components/ui/Icon.svelte';

	interface Props {
		company: CompanyDetailResponse;
		canWrite: boolean;
		onclose: () => void;
		onedit: (company: CompanyDetailResponse) => void;
		ondelete: (company: CompanyDetailResponse) => void;
	}
	let { company, canWrite, onclose, onedit, ondelete }: Props = $props();
</script>

<!-- Backdrop -->
<button
	type="button"
	class="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
	onclick={onclose}
	aria-label="Tutup panel"
></button>

<!-- Drawer -->
<aside
	class="fixed inset-y-0 right-0 z-40 flex w-96 max-w-full flex-col border-l border-line bg-surface shadow-2xl"
>
	<!-- Header -->
	<div class="flex items-start justify-between border-b border-line p-5">
		<div class="min-w-0 pr-2">
			<h2 class="truncate text-base font-semibold text-ink">{company.name}</h2>
			{#if company.industry}
				<p class="text-sm text-muted">{company.industry}</p>
			{/if}
		</div>
		<button
			type="button"
			onclick={onclose}
			class="shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
			aria-label="Tutup"
		>
			<Icon name="x" size={18} />
		</button>
	</div>

	<!-- Body -->
	<div class="flex-1 space-y-5 overflow-y-auto p-5">
		<!-- Detail info -->
		<dl class="space-y-3 text-sm">
			<div>
				<dt class="text-xs font-medium tracking-wide text-subtle uppercase">Telepon</dt>
				<dd class="mt-0.5 text-ink-soft">{orDash(company.phone)}</dd>
			</div>
			<div>
				<dt class="text-xs font-medium tracking-wide text-subtle uppercase">Website</dt>
				<dd class="mt-0.5 text-ink-soft">{orDash(company.website)}</dd>
			</div>
			<div>
				<dt class="text-xs font-medium tracking-wide text-subtle uppercase">Alamat</dt>
				<dd class="mt-0.5 text-ink-soft">{orDash(company.address)}</dd>
			</div>
			<div>
				<dt class="text-xs font-medium tracking-wide text-subtle uppercase">Assigned To</dt>
				<dd class="mt-0.5">
					{#if company.assigned_to}
						<Badge label={company.assigned_to.name} tone="bg-brand-soft text-brand" />
					{:else}
						<span class="text-subtle">Unassigned</span>
					{/if}
				</dd>
			</div>
			{#if company.assigned_at}
				<div>
					<dt class="text-xs font-medium tracking-wide text-subtle uppercase">Assigned On</dt>
					<dd class="mt-0.5 text-ink-soft">{formatDate(company.assigned_at)}</dd>
				</div>
			{/if}
		</dl>

		<!-- Lead summary -->
		{#if Object.keys(company.contacts_summary).length > 0}
			<div class="rounded-xl border border-brand/30 bg-surface-2 p-4">
				<h3 class="mb-3 text-xs font-semibold tracking-wide text-ink-soft uppercase">
					Lead Summary
				</h3>
				<p class="mb-2 text-2xl font-semibold text-ink">{company.contact_count}</p>
				<div class="space-y-1.5">
					{#each Object.entries(company.contacts_summary) as [key, count] (key)}
						<div class="flex items-center justify-between text-xs">
							<span class="text-muted">
								{ACTION_STATUS_LABEL[key as keyof typeof ACTION_STATUS_LABEL] ??
									RESPONSE_STATUS_LABEL[key as keyof typeof RESPONSE_STATUS_LABEL] ??
									key}
							</span>
							<span class="font-semibold text-ink-soft">{count}</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	<!-- Footer: company actions -->
	{#if canWrite}
		<div class="flex items-center gap-2 border-t border-line p-4">
			<button
				type="button"
				onclick={() => onedit(company)}
				class="flex flex-1 items-center justify-center gap-2 rounded-lg border border-line-strong bg-surface px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-3"
			>
				<Icon name="pencil" size={15} /> Edit Account
			</button>
			<button
				type="button"
				onclick={() => ondelete(company)}
				class="rounded-lg border border-red-200 p-2 text-red-600 transition-colors hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40"
				title="Hapus account"
				aria-label="Hapus account"
			>
				<Icon name="trash-2" size={16} />
			</button>
		</div>
	{/if}
</aside>
