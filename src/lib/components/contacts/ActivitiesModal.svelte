<!-- Riwayat aktivitas kontak (read-only, BDM + Telesales). -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { contactsApi, toMessage } from '$lib';
	import type { ContactResponse, ContactActivityResponse } from '$lib/types/api';
	import Modal from '$lib/components/ui/Modal.svelte';
	import LoadingState from '$lib/components/ui/LoadingState.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import ActivityTimeline from './ActivityTimeline.svelte';

	interface Props {
		contact: ContactResponse;
		onclose: () => void;
	}
	let { contact, onclose }: Props = $props();

	let activities = $state<ContactActivityResponse[]>([]);
	let loading = $state(true);
	let errorMsg = $state('');

	onMount(async () => {
		try {
			const res = await contactsApi.getContactActivities(contact.id);
			activities = res.data;
		} catch (err) {
			errorMsg = toMessage(err);
		} finally {
			loading = false;
		}
	});
</script>

<Modal title="Riwayat Aktivitas — {contact.name}" {onclose}>
	{#if loading}
		<LoadingState />
	{:else if errorMsg}
		<EmptyState icon="alert-circle" title="Gagal memuat" description={errorMsg} />
	{:else if activities.length === 0}
		<EmptyState icon="info" title="Belum ada aktivitas" />
	{:else}
		<ActivityTimeline {activities} />
	{/if}
</Modal>
