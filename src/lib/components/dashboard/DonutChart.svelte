<!--
  Donut chart zero-dependency (SVG murni) untuk komposisi part-to-whole.
  Dipakai pada sebaran status respon: tiap irisan = proporsi satu kategori
  terhadap total, jadi "porsi" tiap hasil langsung terbaca (lebih tepat
  daripada bar lepas untuk data komposisi). Reaktif terhadap perubahan `data`.
-->
<script lang="ts">
	import { formatNumber } from '$lib';

	interface Segment {
		label: string;
		value: number;
		color: string; // CSS color (hex) untuk irisan + legend
	}
	interface Props {
		data: Segment[];
		centerLabel?: string;
		emptyLabel?: string;
	}
	let { data, centerLabel = 'Total', emptyLabel = 'Belum ada data' }: Props = $props();

	const segments = $derived(data.filter((d) => d.value > 0));
	const total = $derived(segments.reduce((sum, d) => sum + d.value, 0));
	const hasData = $derived(total > 0);

	// Geometri lingkaran
	const SIZE = 168;
	const STROKE = 24;
	const R = (SIZE - STROKE) / 2;
	const CIRC = 2 * Math.PI * R;

	// Hitung arc tiap irisan (offset kumulatif untuk dash).
	const arcs = $derived.by(() => {
		let offset = 0;
		return segments.map((s) => {
			const frac = s.value / total;
			const dash = frac * CIRC;
			const arc = { ...s, dash, offset, pct: Math.round(frac * 100) };
			offset += dash;
			return arc;
		});
	});
</script>

{#if !hasData}
	<p class="py-8 text-center text-sm text-subtle">{emptyLabel}</p>
{:else}
	<div class="flex flex-col items-center gap-5 sm:flex-row sm:gap-6">
		<svg viewBox="0 0 {SIZE} {SIZE}" class="h-40 w-40 shrink-0" role="img" aria-label={centerLabel}>
			<!-- Grup lingkaran diputar -90° agar irisan mulai dari atas; teks tetap tegak. -->
			<g transform="rotate(-90 {SIZE / 2} {SIZE / 2})">
				<circle
					cx={SIZE / 2}
					cy={SIZE / 2}
					r={R}
					fill="none"
					stroke="currentColor"
					class="text-surface-3"
					stroke-width={STROKE}
				/>
				{#each arcs as arc (arc.label)}
					<circle
						cx={SIZE / 2}
						cy={SIZE / 2}
						r={R}
						fill="none"
						stroke={arc.color}
						stroke-width={STROKE}
						stroke-dasharray="{arc.dash} {CIRC - arc.dash}"
						stroke-dashoffset={-arc.offset}
						class="transition-all duration-500"
					/>
				{/each}
			</g>
			<!-- Pusat: total -->
			<text
				x={SIZE / 2}
				y={SIZE / 2}
				dy="-2"
				text-anchor="middle"
				class="fill-ink text-[26px] font-semibold tabular-nums">{formatNumber(total)}</text
			>
			<text x={SIZE / 2} y={SIZE / 2} dy="20" text-anchor="middle" class="fill-subtle text-[11px]"
				>{centerLabel}</text
			>
		</svg>

		<ul class="w-full flex-1 space-y-2">
			{#each arcs as arc (arc.label)}
				<li class="flex items-center gap-2.5 text-sm">
					<span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background-color: {arc.color}"
					></span>
					<span class="flex-1 truncate text-muted">{arc.label}</span>
					<span class="font-medium text-ink-soft tabular-nums">{formatNumber(arc.value)}</span>
					<span class="w-9 shrink-0 text-right text-xs text-subtle tabular-nums">{arc.pct}%</span>
				</li>
			{/each}
		</ul>
	</div>
{/if}
