<!-- Dialog konfirmasi (dipakai untuk aksi destruktif: hapus, reset, dll). -->
<script lang="ts">
	import Modal from './Modal.svelte';
	import Button from './Button.svelte';

	interface Props {
		title: string;
		message: string;
		confirmLabel?: string;
		cancelLabel?: string;
		danger?: boolean;
		loading?: boolean;
		onconfirm: () => void;
		oncancel: () => void;
	}
	let {
		title,
		message,
		confirmLabel = 'Konfirmasi',
		cancelLabel = 'Batal',
		danger = false,
		loading = false,
		onconfirm,
		oncancel
	}: Props = $props();
</script>

<Modal {title} size="sm" onclose={loading ? undefined : oncancel}>
	<p class="text-sm text-muted">{message}</p>
	{#snippet footer()}
		<Button variant="secondary" onclick={oncancel} disabled={loading}>{cancelLabel}</Button>
		<Button variant={danger ? 'danger' : 'positive'} onclick={onconfirm} {loading}>
			{confirmLabel}
		</Button>
	{/snippet}
</Modal>
