<!--
  WhatsAppBadge — badge status verifikasi WhatsApp (CRM-011).
  Menampilkan label + tone warna sesuai whatsapp_status dari backend.
  null = contact tanpa nomor → tidak render apapun (kecuali showNull=true).
-->
<script lang="ts">
	import { WHATSAPP_STATUS_LABEL, WHATSAPP_STATUS_BADGE } from '$lib/constants/enums';
	import type { WhatsAppStatus } from '$lib/constants/enums';

	interface Props {
		status: WhatsAppStatus | null | undefined;
		/** Tampilkan badge abu-abu "—" bila status null. Default: false (tidak render). */
		showNull?: boolean;
	}
	let { status, showNull = false }: Props = $props();
</script>

{#if status}
	<span
		class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium {WHATSAPP_STATUS_BADGE[status]}"
		title="Status WhatsApp: {WHATSAPP_STATUS_LABEL[status]}"
	>
		<span
			class="h-1.5 w-1.5 rounded-full {status === 'active'
				? 'bg-emerald-500'
				: status === 'inactive'
					? 'bg-red-500'
					: 'bg-amber-500'}"
		></span>
		{WHATSAPP_STATUS_LABEL[status]}
	</span>
{:else if showNull}
	<span
		class="inline-flex items-center rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted"
		title="Belum ada nomor telepon"
	>
		Belum ada nomor
	</span>
{/if}
