<script lang="ts">
	import { auth } from '$lib';
	import Icon from '$lib/components/ui/Icon.svelte';
	import PageHeader from '$lib/components/ui/PageHeader.svelte';


</script>

<svelte:head>
	<title>Pusat Bantuan & Panduan Fitur - CRM Telemarketing</title>
</svelte:head>

<div class="space-y-6">
	<PageHeader
		title="Pusat Bantuan & Panduan Fitur"
		description="Dokumentasi resmi dan panduan penggunaan fitur CRM Telemarketing sesuai hak akses peran pengguna"
	/>

	<!-- TAB TELESALES CONTENT -->
	{#if auth.role === 'telesales'}
		<div class="space-y-6">
			<!-- Section 1: Quick Actions & Workflow Overview -->
			<div class="rounded-xl border border-line bg-surface p-5 shadow-sm space-y-4">
				<div class="flex items-center gap-2 text-brand font-semibold text-base border-b border-line pb-3">
					<Icon name="zap" size={20} />
					<h2>Alur Kerja Utama Agen Telemarketing</h2>
				</div>
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<div class="rounded-lg border border-line bg-surface-2 p-4 space-y-2">
						<div class="flex items-center gap-2 font-medium text-ink text-sm">
							<span class="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-white text-xs font-bold">1</span>
							Pilih Prospek
						</div>
						<p class="text-xs text-muted">
							Buka menu <b>Account & Lead</b> atau <b>Master View Leads</b> untuk memilih kontak yang akan dihubungi hari ini.
						</p>
					</div>
					<div class="rounded-lg border border-line bg-surface-2 p-4 space-y-2">
						<div class="flex items-center gap-2 font-medium text-ink text-sm">
							<span class="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-white text-xs font-bold">2</span>
							Sidepanel Quick View
						</div>
						<p class="text-xs text-muted">
							Klik baris kontak untuk membuka Sidepanel Drawer. Cek status Verifikasi WhatsApp (harus <i>Active</i>).
						</p>
					</div>
					<div class="rounded-lg border border-line bg-surface-2 p-4 space-y-2">
						<div class="flex items-center gap-2 font-medium text-ink text-sm">
							<span class="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-white text-xs font-bold">3</span>
							Kirim Chat / Telepon
						</div>
						<p class="text-xs text-muted">
							Gunakan tombol <b>Quick Chat</b> untuk merender pesan instan WA, atau lakukan panggilan telepon langsung.
						</p>
					</div>
					<div class="rounded-lg border border-line bg-surface-2 p-4 space-y-2">
						<div class="flex items-center gap-2 font-medium text-ink text-sm">
							<span class="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-white text-xs font-bold">4</span>
							Update Status & Rapat
						</div>
						<p class="text-xs text-muted">
							Perbarui Status Respon (misal: <i>Tertarik</i>) dan klik <b>Jadwalkan Meeting</b> jika prospek setuju presentasi.
						</p>
					</div>
				</div>
			</div>

			<!-- Section 2: Detailed Fitur Telesales -->
			<div class="grid gap-6 md:grid-cols-2">
				<!-- Fitur 1: Status Verifikasi WhatsApp -->
				<div class="rounded-xl border border-line bg-surface p-5 shadow-sm space-y-3">
					<div class="flex items-center gap-2 font-semibold text-ink text-sm border-b border-line pb-2">
						<Icon name="check-circle" class="text-emerald-600" size={18} />
						Status Verifikasi WhatsApp & Tombol Cek Manual
					</div>
					<ul class="text-xs text-muted space-y-2 list-disc pl-4">
						<li><b class="text-emerald-600">Terverifikasi (Active):</b> Nomor terdaftar di WhatsApp. Tombol Quick Chat aktif.</li>
						<li><b class="text-amber-600">Belum Diverifikasi (Unverified):</b> Koneksi terputus/pernah gagal. Tombol Quick Chat mati. Klik tombol <i>"Cek Manual WA"</i> untuk memicu verifikasi ulang.</li>
						<li><b class="text-red-600">Tidak Terdaftar (Inactive):</b> Nomor bukan akun WA aktif. Tombol Quick Chat dinonaktifkan permanen.</li>
					</ul>
				</div>

				<!-- Fitur 2: Quick Chat Fallback -->
				<div class="rounded-xl border border-line bg-surface p-5 shadow-sm space-y-3">
					<div class="flex items-center gap-2 font-semibold text-ink text-sm border-b border-line pb-2">
						<Icon name="message-square" class="text-blue-600" size={18} />
						Pesan Instan Quick Chat & Dialog Fallback
					</div>
					<p class="text-xs text-muted">
						Jika pengiriman pesan instan gagal akibat kendala jaringan provider, sistem memunculkan <b>Dialog Fallback</b>.
					</p>
					<div class="rounded-lg bg-surface-2 p-3 text-xs border border-line space-y-1">
						<div class="font-medium text-ink flex items-center gap-1">
							<Icon name="info" size={14} class="text-brand" />
							Aksi saat Fallback:
						</div>
						<p class="text-muted">
							1. Klik tombol <b>"Salin Pesan Alternatif"</b> untuk menyalin teks gabungan ke clipboard.<br />
							2. Klik <b>"Buka WhatsApp Web"</b> untuk mengirim langsung lewat aplikasi WA resmi tanpa kehilangan prospek.
						</p>
					</div>
				</div>

				<!-- Fitur 3: Penjadwalan Meeting & Opportunity Auto-Creation -->
				<div class="rounded-xl border border-line bg-surface p-5 shadow-sm space-y-3">
					<div class="flex items-center gap-2 font-semibold text-ink text-sm border-b border-line pb-2">
						<Icon name="calendar" class="text-purple-600" size={18} />
						Penjadwalan Meeting & Pembuatan Deal Otomatis
					</div>
					<p class="text-xs text-muted">
						Saat menjadwalkan rapat pertama dengan prospek baru (Opportunity baru):
					</p>
					<ul class="text-xs text-muted space-y-1 list-disc pl-4">
						<li>Isi nama deal pada kolom <b>Nama Deal Baru</b>. Backend otomatis membuat Deal baru berstatus <i>Demo</i> dengan nilai Rp 0.</li>
						<li>Untuk rapat lanjutan pada deal aktif, centang <i>"Pertemuan Lanjutan"</i> agar tidak membuat deal duplikat.</li>
					</ul>
				</div>

				<!-- Fitur 4: Otomatisasi First-Touch Broadcast -->
				<div class="rounded-xl border border-line bg-surface p-5 shadow-sm space-y-3">
					<div class="flex items-center gap-2 font-semibold text-ink text-sm border-b border-line pb-2">
						<Icon name="settings" class="text-orange-600" size={18} />
						Otomatisasi Broadcast WA Harian (`/automation`)
					</div>
					<ul class="text-xs text-muted space-y-1.5 list-disc pl-4">
						<li><b>Kuota Harian:</b> Maksimal 5 kontak prospek diproses secara otomatis setiap hari kerja (Senin - Jumat).</li>
						<li><b>Mode Penjadwalan:</b> Mode 1 Slot (5 prospek sekaligus) atau Mode 2 Slot (2 prospek di slot 1 & 3 prospek di slot 2).</li>
						<li><b>Syarat Aktif:</b> Harus memilih template pesan kategori <i>Leads</i> milik agen sendiri.</li>
					</ul>
				</div>
			</div>

			<!-- Section 3: Smart Reminders System -->
			<div class="rounded-xl border border-line bg-surface p-5 shadow-sm space-y-3">
				<div class="flex items-center gap-2 text-ink font-semibold text-sm border-b border-line pb-2">
					<Icon name="bell" size={18} class="text-brand" />
					Pusat Notifikasi Real-Time & Pengingat Pintar (Smart Reminders)
				</div>
				<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
					<div class="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-3 space-y-1">
						<div class="font-semibold text-amber-800 dark:text-amber-300">Lead Aging</div>
						<p class="text-amber-700 dark:text-amber-400">Kontak berstatus <i>Belum Dihubungi</i> lebih dari 7 hari.</p>
					</div>
					<div class="rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-950/20 p-3 space-y-1">
						<div class="font-semibold text-orange-800 dark:text-orange-300">Lead Stale</div>
						<p class="text-orange-700 dark:text-orange-400">Kontak <i>Sudah Dihubungi</i> tanpa catatan aktivitas baru selama 14 hari.</p>
					</div>
					<div class="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 p-3 space-y-1">
						<div class="font-semibold text-red-800 dark:text-red-300">Deal Stale</div>
						<p class="text-red-700 dark:text-red-400">Deal di pipeline tanpa perubahan tahap selama 14 hari berturut-turut.</p>
					</div>
					<div class="rounded-lg border border-purple-200 bg-purple-50 dark:bg-purple-950/20 p-3 space-y-1">
						<div class="font-semibold text-purple-800 dark:text-purple-300">Subscription Expiring</div>
						<p class="text-purple-700 dark:text-purple-400">Langganan produk pelanggan yang akan kedaluwarsa dalam 30 hari.</p>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- TAB BDM CONTENT -->
	{#if auth.role === 'bdm'}
		<div class="space-y-6">
			<div class="rounded-xl border border-line bg-surface p-5 shadow-sm space-y-4">
				<div class="flex items-center gap-2 text-brand font-semibold text-base border-b border-line pb-3">
					<Icon name="layout-kanban" size={20} />
					Panduan Manajemen BDM (Business Development Manager)
				</div>
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-xs">
					<div class="rounded-lg border border-line bg-surface-2 p-4 space-y-2">
						<div class="font-semibold text-ink text-sm flex items-center gap-2">
							<Icon name="layout-kanban" size={16} class="text-brand" />
							Kanban Deal Pipeline
						</div>
						<p class="text-muted">
							Kelola 7 tahap penjualan (`demo` s.d `win`/`lost`). Geser kartu deal (*drag & drop*). Deal berstatus `win` atau `lost` bersifat <b>immutable</b> (terkunci).
						</p>
					</div>
					<div class="rounded-lg border border-line bg-surface-2 p-4 space-y-2">
						<div class="font-semibold text-ink text-sm flex items-center gap-2">
							<Icon name="upload" size={16} class="text-brand" />
							Impor & Assignment Perusahaan
						</div>
						<p class="text-muted">
							Unduh template Excel di menu Perusahaan, unggah data prospek massal, lalu tugaskan (*assign / reassign*) perusahaan tersebut ke agen Telesales.
						</p>
					</div>
					<div class="rounded-lg border border-line bg-surface-2 p-4 space-y-2">
						<div class="font-semibold text-ink text-sm flex items-center gap-2">
							<Icon name="package" size={16} class="text-brand" />
							Katalog Produk Master
						</div>
						<p class="text-muted">
							Tambah dan perbarui produk master (`code`, `billing_model`, `vendor`). Kode produk bersifat permanen dan tidak dapat diubah setelah dibuat.
						</p>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- TAB ADMIN CONTENT -->
	{#if auth.role === 'admin'}
		<div class="space-y-6">
			<div class="rounded-xl border border-line bg-surface p-5 shadow-sm space-y-4">
				<div class="flex items-center gap-2 text-brand font-semibold text-base border-b border-line pb-3">
					<Icon name="users" size={20} />
					Panduan Penting Admin Sistem
				</div>
				<div class="grid gap-4 sm:grid-cols-2 text-xs">
					<div class="rounded-lg border border-line bg-surface-2 p-4 space-y-2">
						<div class="font-semibold text-ink text-sm">Manajemen Pengguna (User Management)</div>
						<p class="text-muted">
							Buat akun karyawan baru, tentukan peran (`admin`, `bdm`, `telesales`), ubah status menjadi `inactive` untuk memblokir akses login, atau reset password secara paksa.
						</p>
					</div>
					<div class="rounded-lg border border-line bg-surface-2 p-4 space-y-2">
						<div class="font-semibold text-ink text-sm">Reassign Massal & Verifikasi WA Manual</div>
						<p class="text-muted">
							Admin memiliki wewenang untuk memindahkan tugas perusahaan antar Telesales serta memicu pengecekan nomor WhatsApp secara manual.
						</p>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
