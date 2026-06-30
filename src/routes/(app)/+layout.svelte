<!-- Shell aplikasi: Sidebar + Topbar + area konten. -->
<script lang="ts">
	import Sidebar from '$lib/components/layout/Sidebar.svelte';
	import Topbar from '$lib/components/layout/Topbar.svelte';

	let { children } = $props();
</script>

<div class="flex h-screen overflow-hidden bg-bg">
	<Sidebar />

	<div class="flex min-w-0 flex-1 flex-col">
		<Topbar />
		<!-- px halved; pb doubled 1:1; NO pt here — pages control their own top spacing so sticky headers sit flush with topbar -->
		<main class="flex-1 overflow-y-auto px-1.5 pb-12 sm:px-2 sm:pb-16 lg:px-2.5 lg:pb-18">
			<div class="mx-auto w-full max-w-7xl">
				{@render children()}
			</div>
		</main>
	</div>
</div>
