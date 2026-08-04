/**
 * Menjamin hanya request terbaru dalam satu alur UI yang boleh memperbarui state.
 * Request sebelumnya dibatalkan; pemeriksaan `isCurrent` tetap wajib karena server
 * dapat menyelesaikan mutasi walaupun koneksi browser sudah diabort.
 */
export class LatestRequest {
	#controller: AbortController | null = null;

	start(): AbortController {
		this.#controller?.abort();
		const controller = new AbortController();
		this.#controller = controller;
		return controller;
	}

	isCurrent(controller: AbortController): boolean {
		return this.#controller === controller && !controller.signal.aborted;
	}

	finish(controller: AbortController): boolean {
		if (this.#controller !== controller) return false;
		this.#controller = null;
		return true;
	}

	abort(): void {
		this.#controller?.abort();
		this.#controller = null;
	}
}

export function isAbortError(error: unknown): boolean {
	return error instanceof DOMException && error.name === 'AbortError';
}
