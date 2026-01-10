import { SvelteURLSearchParams } from 'svelte/reactivity';

/**
 * Enum for PGP operation modes
 * Defines the available modes for PGP operations in the application
 */
export enum PGPMode {
	ENCRYPT = 'encrypt',
	DECRYPT = 'decrypt',
	SIGN = 'sign',
	VERIFY = 'verify'
}

export enum Pages {
	HOME = 'Home',
	GUIDE = 'Guide',
	GENERATE_KEY = 'GenerateKey'
}

class Router {
	// Raw state tracking window location
	raw = $state({
		path: window.location.pathname,
		search: window.location.search
	});

	constructor() {
		if (typeof window !== 'undefined') {
			window.addEventListener('popstate', () => {
				this.raw.path = window.location.pathname;
				this.raw.search = window.location.search;
			});
		}
	}

	// Derived state for high-level routing
	activeRoute = $derived.by(() => {
		const path = this.raw.path;
		const pathParts = path.split('/').filter(Boolean);
		const lastSegment = pathParts[pathParts.length - 1];

		let page: Pages = Pages.HOME;
		let fingerprint: string | null = null;
		let basePath = path;

		if (lastSegment === 'Guide') {
			page = Pages.GUIDE;
			basePath = '/' + pathParts.slice(0, -1).join('/');
		} else if (lastSegment === 'GenerateKey') {
			page = Pages.GENERATE_KEY;
			basePath = '/' + pathParts.slice(0, -1).join('/');
		} else if (lastSegment && /^[a-f0-9]{16,}$/i.test(lastSegment)) {
			fingerprint = lastSegment;
			basePath = '/' + pathParts.slice(0, -1).join('/');
		} else {
			basePath = path;
		}

		// Normalize basePath
		if (basePath.length > 1 && basePath.endsWith('/')) {
			basePath = basePath.slice(0, -1);
		}
		if (!basePath.startsWith('/')) basePath = '/' + basePath;

		// Parse query params
		const params = new SvelteURLSearchParams(this.raw.search);
		const keyParam = params.get('key');
		const mode = (params.get('mode') as PGPMode) || PGPMode.ENCRYPT;

		return {
			page,
			basePath,
			pgp: {
				fingerprint,
				keyParam,
				mode
			}
		};
	});

	// Navigation primitives
	navigate(url: string) {
		const u = new URL(url, window.location.origin);
		window.history.pushState({}, '', u.toString());
		this.raw.path = u.pathname;
		this.raw.search = u.search;
	}

	// Semantic Actions
	openPage(page: Pages) {
		const base = this.activeRoute.basePath === '/' ? '' : this.activeRoute.basePath;
		if (page === Pages.HOME) {
			this.navigate(`${base}/`);
		} else {
			this.navigate(`${base}/${page}`);
		}
	}

	openHome() {
		this.openPage(Pages.HOME);
	}

	openKey(fingerprint: string, mode?: PGPMode) {
		const currentMode =
			this.activeRoute.page === 'Home' ? this.activeRoute.pgp.mode : PGPMode.ENCRYPT;
		const targetMode = mode || currentMode;

		const search = new SvelteURLSearchParams();
		if (targetMode !== PGPMode.ENCRYPT) search.set('mode', targetMode);

		const base = this.activeRoute.basePath === '/' ? '' : this.activeRoute.basePath;
		const searchStr = search.toString();
		this.navigate(`${base}/${fingerprint}${searchStr ? '?' + searchStr : ''}`);
	}

	setMode(mode: PGPMode) {
		if (this.activeRoute.page !== 'Home') return;

		const { fingerprint, keyParam } = this.activeRoute.pgp;
		const search = new SvelteURLSearchParams();

		if (keyParam) search.set('key', keyParam);
		if (mode !== PGPMode.ENCRYPT) search.set('mode', mode);

		const base = this.activeRoute.basePath === '/' ? '' : this.activeRoute.basePath;
		const path = fingerprint ? `${base}/${fingerprint}` : `${base}/`;

		const searchStr = search.toString();
		this.navigate(`${path}${searchStr ? '?' + searchStr : ''}`);
	}
}

export const router = new Router();
