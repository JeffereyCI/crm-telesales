<!--
  Timeline aktivitas kontak (kronologi 360) — read-only, reusable.
  Menyusun ContactActivity jadi garis waktu vertikal: tiap titik diberi ikon &
  warna sesuai jenis kejadian (perubahan status kontak / respon), menampilkan
  transisi "lama → baru" sehingga konteks penuh terbaca sebelum menelepon.
-->
<script lang="ts">
	import { formatDateTime } from '$lib';
	import { ACTION_STATUS_LABEL, RESPONSE_STATUS_LABEL, CHANNEL_LABEL } from '$lib/constants/enums';
	import { decodeHtml } from '$lib/utils/sanitize';
	import type { ContactActivityResponse } from '$lib/types/api';
	import Icon from '$lib/components/ui/Icon.svelte';

	interface Props {
		activities: ContactActivityResponse[];
	}
	let { activities }: Props = $props();

	const RESPONSE_DOT: Record<string, string> = {
		tertarik: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400',
		ditolak: 'bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400',
		sudah_pakai_lain: 'bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400',
		belum_perlu: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
		tidak_dibalas: 'bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400'
	};
	const ACTION_DOT = 'bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400';

	// Ikon + warna titik sesuai jenis kejadian.
	function dot(a: ContactActivityResponse): { icon: string; klass: string } {
		if (a.activity_type === 'note_added') {
			return {
				icon: 'message-circle',
				klass: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
			};
		}
		if (a.new_response_status)
			return { icon: 'check-circle', klass: RESPONSE_DOT[a.new_response_status] };
		if (a.new_action_status) return { icon: 'phone', klass: ACTION_DOT };
		return { icon: 'info', klass: 'bg-surface-3 text-muted' };
	}

	// Judul: tampilkan transisi "lama → baru" bila status sebelumnya diketahui.
	function title(a: ContactActivityResponse): string {
		if (a.activity_type === 'note_added') return 'Catatan internal ditambahkan';
		if (a.new_response_status) {
			const to = RESPONSE_STATUS_LABEL[a.new_response_status];
			const from = a.old_response_status ? RESPONSE_STATUS_LABEL[a.old_response_status] : null;
			return from ? `Status respon: ${from} → ${to}` : `Status respon → ${to}`;
		}
		if (a.new_action_status) {
			const to = ACTION_STATUS_LABEL[a.new_action_status];
			const from = a.old_action_status ? ACTION_STATUS_LABEL[a.old_action_status] : null;
			return from ? `Status kontak: ${from} → ${to}` : `Status kontak → ${to}`;
		}
		return a.activity_type;
	}
</script>

<ol class="relative">
	{#each activities as a, i (a.id)}
		{@const d = dot(a)}
		<li class="relative flex gap-3 pb-5 last:pb-0">
			{#if i < activities.length - 1}
				<span class="absolute top-7 bottom-0 left-[13px] w-px bg-line" aria-hidden="true"></span>
			{/if}
			<span
				class="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full {d.klass}"
			>
				<Icon name={d.icon} size={14} />
			</span>
			<div class="-mt-0.5 flex-1">
				<p class="text-sm font-medium text-ink">{title(a)}</p>
				<p class="mt-0.5 text-xs text-muted">
					{a.user_name}{#if a.channel}
						· {CHANNEL_LABEL[a.channel]}{/if} · {formatDateTime(a.created_at)}
				</p>
				{#if a.notes}
					<p class="mt-1.5 rounded-md bg-surface-2 px-2.5 py-1.5 text-sm text-muted">
						{decodeHtml(a.notes)}
					</p>
				{/if}
			</div>
		</li>
	{/each}
</ol>
