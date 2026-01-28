<script lang="ts">
	import PGPWorkflow from '../lib/pgp/PGPWorkflow.svelte';
	import GenerateKey from '../lib/pgp/GenerateKey.svelte';
	import { keyStore, type KeyWrapper, PersistenceType } from '../lib/pgp/keyStore.svelte';
	import { router, Pages } from './router.svelte';
	import { type CryptoKey } from '../lib/pgp/crypto';

	let { selectedKeyWrapper = $bindable(null) }: { selectedKeyWrapper: KeyWrapper | null } =
		$props();

	let isGenerateKeyPage = $derived(router.activeRoute.page === Pages.GENERATE_KEY);
	let keyValue = $state<string>('');

	$effect(() => {
		const keyParam = router.activeRoute.pgp.keyParam;
		const selectedFingerprint = router.activeRoute.pgp.fingerprint;

		if (keyParam) {
			keyValue = keyParam;
		} else if (keyStore.isLoaded && selectedFingerprint) {
			const wrapper = keyStore.getKey(selectedFingerprint);
			if (wrapper) {
				selectedKeyWrapper = wrapper;
			} else {
				// Fingerprint not found in store, navigate home
				console.warn('Fingerprint not found in store, navigating home:', selectedFingerprint);
				router.openHome();
			}
		} else if (!selectedFingerprint) {
			selectedKeyWrapper = null;
		}
	});

	function handleNewKey(key: CryptoKey) {
		keyStore.addKey({ key, persisted: PersistenceType.DEFAULT }).then(() => {
			router.openKey(key);
		});
	}
</script>

<main class="flex-1 overflow-y-auto p-6 sm:p-8" aria-label="PGP Workflow">
	{#if isGenerateKeyPage}
		<GenerateKey onKeyGenerated={handleNewKey} onCancel={() => router.openHome()} />
	{:else}
		<PGPWorkflow bind:keyWrapper={selectedKeyWrapper} onKeyParsed={handleNewKey} {keyValue} />
	{/if}
</main>
