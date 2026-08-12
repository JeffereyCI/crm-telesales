/**
 * Helper RBAC sisi-klien — MENIRU matriks role di backend (cmd/api/main.go).
 *
 * ⚠️ Ini hanya untuk UX (menyembunyikan menu/aksi yang pasti ditolak server).
 * Otorisasi sebenarnya 100% ditegakkan backend via RBACMiddleware + query scoping.
 *
 * Ringkas:
 *  - admin     : HANYA User Management.
 *  - bdm       : Companies (CRUD/assign/import), Leads (master view), Reports tim.
 *  - telesales : Contacts (CRUD + status + meeting), Reports pribadi.
 *  - companies (read) & response-status & export & reassign: dibagi (lihat tabel).
 */
import type { Role } from '$lib/constants/enums';

export interface NavItem {
	label: string;
	href: string;
	icon?: string; // nama ikon lucide (opsional)
}

/** Menu sidebar per role — dipakai komponen layout. */
export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
	admin: [{ label: 'Manajemen User', href: '/users', icon: 'users' }],
	bdm: [
		{ label: 'Dashboard', href: '/dashboard', icon: 'layout-dashboard' },
		{ label: 'Account & Lead', href: '/companies', icon: 'building-2' },
		{ label: 'Pipeline', href: '/pipeline', icon: 'layout-kanban' },
		{ label: 'Kontak', href: '/contacts', icon: 'contact-2' },
		{ label: 'Template Agenda', href: '/meeting-templates', icon: 'notebook-tabs' },
		{ label: 'Produk', href: '/products', icon: 'package' },
		{ label: 'Template Chat', href: '/chat-templates', icon: 'message-square' },
		{ label: 'Laporan', href: '/reports', icon: 'bar-chart-3' }
	],
	telesales: [
		{ label: 'Dashboard', href: '/dashboard', icon: 'layout-dashboard' },
		{ label: 'Account & Lead', href: '/companies', icon: 'building-2' },
		{ label: 'Pipeline', href: '/pipeline', icon: 'layout-kanban' },
		{ label: 'Kontak', href: '/contacts', icon: 'contact-2' },
		{ label: 'Laporan', href: '/reports', icon: 'bar-chart-3' },
		{ label: 'Template Chat', href: '/chat-templates', icon: 'message-square' },
		{ label: 'Automation', href: '/automation', icon: 'settings' }
	]
};

/** Aksi granular yang dipetakan ke role yang diizinkan backend. */
export const PERMISSIONS = {
	// Users — admin only
	manageUsers: ['admin'],
	// Companies tulis — bdm only
	createCompany: ['bdm'],
	editCompany: ['bdm'],
	deleteCompany: ['bdm'],
	importCompany: ['bdm'],
	assignCompany: ['bdm'],
	reassignCompany: ['admin', 'bdm'],
	// Companies baca — bdm + telesales
	viewCompanies: ['bdm', 'telesales'],
	// Leads master view — bdm + telesales (telesales di-scope ke assigned_to oleh backend)
	viewLeads: ['bdm', 'telesales'],
	// Master Produk — bdm tulis, keduanya baca (telesales butuh utk form meeting/kanban)
	manageProducts: ['bdm'],
	viewProducts: ['bdm', 'telesales'],
	// Deals / Pipeline — bdm edit (drag & harga), telesales read-only
	editDeal: ['bdm'],
	viewPipeline: ['bdm', 'telesales'],
	// Contacts — telesales only (tulis)
	manageContacts: ['telesales'],
	updateActionStatus: ['telesales'],
	scheduleMeeting: ['bdm', 'telesales'],
	manageMeetingTemplates: ['bdm'],
	// Response status & activities — bdm + telesales
	updateResponseStatus: ['bdm', 'telesales'],
	viewActivities: ['bdm', 'telesales'],
	// Chat Template
	manageChatTemplates: ['bdm', 'telesales'],
	useQuickChat: ['bdm', 'telesales'],
	manageLeadAutomation: ['telesales'],
	// Reports
	viewPersonalReport: ['telesales'],
	viewTeamReport: ['bdm'],
	exportReport: ['bdm', 'telesales']
} satisfies Record<string, Role[]>;

export type Permission = keyof typeof PERMISSIONS;

/** True bila `role` boleh melakukan `action`. */
export function can(role: Role | null | undefined, action: Permission): boolean {
	if (!role) return false;
	return (PERMISSIONS[action] as readonly Role[]).includes(role);
}

/** Route landing default per role setelah login. */
export function defaultRoute(role: Role): string {
	return role === 'admin' ? '/users' : '/dashboard';
}
