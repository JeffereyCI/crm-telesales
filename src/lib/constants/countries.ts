/**
 * Daftar kode negara (dial code) untuk input telepon.
 * Default Indonesia (+62). Dipakai PhoneField untuk dropdown yang bisa dicari.
 * Disusun ringkas: negara relevan B2B/telesales ID + negara besar.
 */
export interface Country {
	code: string; // ISO-2
	name: string;
	dial: string; // diawali '+'
	flag: string; // emoji bendera
}

export const COUNTRIES: Country[] = [
	{ code: 'ID', name: 'Indonesia', dial: '+62', flag: '🇮🇩' },
	{ code: 'SG', name: 'Singapura', dial: '+65', flag: '🇸🇬' },
	{ code: 'MY', name: 'Malaysia', dial: '+60', flag: '🇲🇾' },
	{ code: 'TH', name: 'Thailand', dial: '+66', flag: '🇹🇭' },
	{ code: 'VN', name: 'Vietnam', dial: '+84', flag: '🇻🇳' },
	{ code: 'PH', name: 'Filipina', dial: '+63', flag: '🇵🇭' },
	{ code: 'BN', name: 'Brunei', dial: '+673', flag: '🇧🇳' },
	{ code: 'KH', name: 'Kamboja', dial: '+855', flag: '🇰🇭' },
	{ code: 'MM', name: 'Myanmar', dial: '+95', flag: '🇲🇲' },
	{ code: 'LA', name: 'Laos', dial: '+856', flag: '🇱🇦' },
	{ code: 'TL', name: 'Timor Leste', dial: '+670', flag: '🇹🇱' },
	{ code: 'CN', name: 'Tiongkok', dial: '+86', flag: '🇨🇳' },
	{ code: 'HK', name: 'Hong Kong', dial: '+852', flag: '🇭🇰' },
	{ code: 'TW', name: 'Taiwan', dial: '+886', flag: '🇹🇼' },
	{ code: 'JP', name: 'Jepang', dial: '+81', flag: '🇯🇵' },
	{ code: 'KR', name: 'Korea Selatan', dial: '+82', flag: '🇰🇷' },
	{ code: 'IN', name: 'India', dial: '+91', flag: '🇮🇳' },
	{ code: 'AE', name: 'Uni Emirat Arab', dial: '+971', flag: '🇦🇪' },
	{ code: 'SA', name: 'Arab Saudi', dial: '+966', flag: '🇸🇦' },
	{ code: 'QA', name: 'Qatar', dial: '+974', flag: '🇶🇦' },
	{ code: 'AU', name: 'Australia', dial: '+61', flag: '🇦🇺' },
	{ code: 'NZ', name: 'Selandia Baru', dial: '+64', flag: '🇳🇿' },
	{ code: 'US', name: 'Amerika Serikat', dial: '+1', flag: '🇺🇸' },
	{ code: 'CA', name: 'Kanada', dial: '+1', flag: '🇨🇦' },
	{ code: 'GB', name: 'Inggris', dial: '+44', flag: '🇬🇧' },
	{ code: 'DE', name: 'Jerman', dial: '+49', flag: '🇩🇪' },
	{ code: 'FR', name: 'Prancis', dial: '+33', flag: '🇫🇷' },
	{ code: 'NL', name: 'Belanda', dial: '+31', flag: '🇳🇱' },
	{ code: 'IT', name: 'Italia', dial: '+39', flag: '🇮🇹' },
	{ code: 'ES', name: 'Spanyol', dial: '+34', flag: '🇪🇸' },
	{ code: 'CH', name: 'Swiss', dial: '+41', flag: '🇨🇭' },
	{ code: 'SE', name: 'Swedia', dial: '+46', flag: '🇸🇪' },
	{ code: 'RU', name: 'Rusia', dial: '+7', flag: '🇷🇺' },
	{ code: 'TR', name: 'Turki', dial: '+90', flag: '🇹🇷' },
	{ code: 'ZA', name: 'Afrika Selatan', dial: '+27', flag: '🇿🇦' },
	{ code: 'BR', name: 'Brasil', dial: '+55', flag: '🇧🇷' }
];

export const DEFAULT_COUNTRY: Country = COUNTRIES[0]; // Indonesia +62

/** Cari country dari nilai telepon tersimpan (cocokkan dial code terpanjang dulu). */
export function matchCountry(phone: string | null | undefined): Country {
	const v = (phone ?? '').replace(/\s/g, '');
	if (!v.startsWith('+')) return DEFAULT_COUNTRY;
	const byLongest = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
	return byLongest.find((c) => v.startsWith(c.dial)) ?? DEFAULT_COUNTRY;
}
