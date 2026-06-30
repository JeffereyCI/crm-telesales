<!--
  Checklist syarat password (live). Membantu admin memenuhi kebijakan:
  min 8 karakter + huruf besar + kecil + angka + simbol.
-->
<script lang="ts">
	import { PASSWORD_MIN } from '$lib/utils/validation';
	import Icon from '$lib/components/ui/Icon.svelte';

	interface Props {
		password: string;
	}
	let { password }: Props = $props();

	const rules = $derived([
		{ ok: password.length >= PASSWORD_MIN, label: `Minimal ${PASSWORD_MIN} karakter` },
		{ ok: /[A-Z]/.test(password), label: 'Huruf besar' },
		{ ok: /[a-z]/.test(password), label: 'Huruf kecil' },
		{ ok: /[0-9]/.test(password), label: 'Angka' },
		{ ok: /[^A-Za-z0-9]/.test(password), label: 'Simbol' }
	]);
</script>

{#if password.length > 0}
	<ul class="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
		{#each rules as rule (rule.label)}
			<li class="flex items-center gap-1.5 {rule.ok ? 'text-emerald-600' : 'text-subtle'}">
				<Icon name={rule.ok ? 'check' : 'x'} size={13} />
				{rule.label}
			</li>
		{/each}
	</ul>
{/if}
