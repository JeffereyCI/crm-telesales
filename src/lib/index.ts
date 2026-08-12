// Barrel `$lib` — titik impor utama layer fondasi.
//
// Contoh: import { login, listCompanies, auth, can, toMessage } from '$lib';

// Konstanta & enum
export * from './constants/enums';

// Tipe kontrak API
export type * from './types/api';

// Store
export { auth } from './stores/auth.svelte';
export { theme } from './stores/theme.svelte';
export { ui } from './stores/ui.svelte';

// HTTP client & error
export { api, ApiError, downloadFile } from './api/client';

// Endpoint per resource
export * as authApi from './api/auth';
export * as usersApi from './api/users';
export * as companiesApi from './api/companies';
export * as contactsApi from './api/contacts';
export * as leadsApi from './api/leads';
export * as reportsApi from './api/reports';
export * as meetingsApi from './api/meetings';
export * as meetingTemplatesApi from './api/meeting-templates';
export * as chatTemplatesApi from './api/chat-templates';
export * as productsApi from './api/products';
export * as dealsApi from './api/deals';
export * as implementationProjectsApi from './api/implementation-projects';
export * as notificationsApi from './api/notifications';
export * as quickChatApi from './api/quick-chat';

// Util
export * from './utils/format';
export * from './utils/errors';
export * from './utils/rbac';
export * from './utils/pipeline';
export * from './utils/latest-request';
export * as validate from './utils/validation';
export * as sanitize from './utils/sanitize';
export { decodeToken, isTokenExpired } from './utils/jwt';
