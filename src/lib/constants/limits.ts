/**
 * Batas panjang input per-field — MENIRU tag `binding:"max=..."` backend
 * (internal/dto/*.go). Dipakai sebagai atribut `maxlength` di input agar
 * pembatasan terjadi di tingkat UI (selain validasi & sanitasi saat submit).
 *
 * Untuk field tanpa batas eksplisit di backend (address/agenda/notes), dipakai
 * batas wajar agar tidak mengirim payload berlebihan.
 */
export const LIMITS = {
	// Users
	userName: 100, // name 2..100
	email: 150, // email field
	password: 72, // praktis maks bcrypt; min 8 ditegakkan validasi

	// Companies
	companyName: 200, // name 2..200
	industry: 100,
	phone: 20,
	website: 255,
	address: 500, // multiline (tanpa batas eksplisit backend)

	// Contacts
	contactName: 100, // name 2..100
	jobTitle: 100,

	// Meeting
	location: 255,
	agenda: 500, // multiline

	// Catatan aktivitas (action/response/reassign)
	notes: 500
} as const;
