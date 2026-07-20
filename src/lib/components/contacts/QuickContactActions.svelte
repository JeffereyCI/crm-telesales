<!--
  Quick action komunikasi (click-to-WA / Email) — murni frontend.
  Membuka WhatsApp / email client dengan data kontak terisi, tanpa input ulang.
  Tombol nonaktif bila field-nya kosong. Tidak mengubah data — pencatatan hasil
  tetap lewat disposition (status kontak/respon).
-->
<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { waNumber } from '$lib/utils/format';

	interface Props {
		name: string;
		phone?: string | null;
		email?: string | null;
		companyName?: string | null;
		size?: number;
	}
	let { name, phone, email, companyName, size = 16 }: Props = $props();

	const greeting = $derived(companyName ? `Halo ${name} dari ${companyName}, ` : `Halo ${name}, `);

	const waHref = $derived.by(() => {
		const n = waNumber(phone);
		return n ? `https://wa.me/${n}?text=${encodeURIComponent(greeting)}` : null;
	});
	const mailHref = $derived(email ? `mailto:${email}?body=${encodeURIComponent(greeting)}` : null);

	const baseBtn = 'inline-flex h-7 w-7 items-center justify-center rounded-lg transition-colors';
</script>

<div class="flex items-center justify-center gap-1">
	{#if waHref}
		<a
			href={waHref}
			target="_blank"
			rel="noopener noreferrer"
			class="{baseBtn} text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
			title="Chat WhatsApp"
			aria-label="WhatsApp {name}"
		>
			<Icon name="message-circle" {size} />
		</a>
	{/if}
	{#if mailHref}
		<a
			href={mailHref}
			class="{baseBtn} text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/40"
			title="Kirim email"
			aria-label="Email {name}"
		>
			<Icon name="mail" {size} />
		</a>
	{/if}
	{#if !waHref && !mailHref}
		<span class="text-xs text-subtle">—</span>
	{/if}
</div>
