<script lang="ts">
	import { encryptMessage, decryptMessage } from './pgp.js';
	import CopyableTextarea from '../ui/CopyableTextarea.svelte';
	import PGPKey from './PGPKey.svelte';
	import RawKeyInput from './RawKeyInput.svelte';
	import type { Key } from 'openpgp';
	import CopyButtons from '../ui/CopyButtons.svelte';
	import KeySidebar from './KeySidebar.svelte';
	import { PGPMode, router } from '../router.svelte.js';
	import { keyStore } from './keyStore.svelte.js';
	import { untrack } from 'svelte';

	let { initialKey = '' } = $props<{
		initialKey?: string;
	}>();

	// Derived state from router
	let mode = $derived<PGPMode>(router.activeRoute.pgp.mode);
	let fingerprint = $derived(router.activeRoute.pgp.fingerprint);
	let keyParam = $derived(router.activeRoute.pgp.keyParam);

	// Derived selected key from store
	let selectedKey = $derived(fingerprint ? keyStore.getKey(fingerprint) : null);

	// The parsed OpenPGP key object (null if invalid/empty)
	let keyObject = $state<Key | null>(null);
	// The raw armored key string (bound to the textarea/input)
	// Initialize to empty string; will be updated by effect when initialKey changes
	let keyValue = $state('');
	// Reference to the PGPKey component instance (for calling methods like nudgeForDecryption)
	let pgpKeyComponent = $state<PGPKey | null>(null);
	// The input message to be encrypted or decrypted
	let message = $state('');
	// The result of the encryption or decryption operation
	let output = $state('');
	// Any error message from the operation (e.g. decryption failure)
	let error = $state('');

	$effect(() => {
		if (initialKey !== undefined && initialKey !== '') {
			keyValue = initialKey;
		}
	});

	// Sync keyValue from router state (fingerprint or keyParam)
	$effect(() => {
		const currentKeyValue = untrack(() => keyValue);

		// This effect runs when fingerprint or keyParam changes
		if (selectedKey) {
			const storedArmor = selectedKey.armor();
			if (currentKeyValue !== storedArmor) {
				keyValue = storedArmor;
				keyObject = selectedKey;
			} else if (keyObject?.getFingerprint() !== selectedKey.getFingerprint()) {
				keyObject = selectedKey;
			}
		} else if (keyParam) {
			if (currentKeyValue !== keyParam) {
				keyValue = keyParam;
			}
		} else {
			// If we navigated to root, clear key
			// Only clear if initialKey is not set (to avoid clearing on first load if passed via prop)
			if (!initialKey && currentKeyValue !== '') {
				keyValue = '';
				keyObject = null;
			}
		}
	});

	// When a valid key is parsed, save it and update URL if needed
	$effect(() => {
		if (keyObject) {
			const fp = keyObject.getFingerprint();

			keyStore.addKey(keyObject).then(() => {
				// If we are not already viewing this key (by fingerprint), navigate to it.
				if (fingerprint !== fp) {
					// Determine target mode
					let targetMode = mode;
					// Default to decrypt for private keys if not specified
					if (keyObject.isPrivate() && !router.activeRoute.pgp.mode) {
						targetMode = PGPMode.DECRYPT;
					}
					// Use untrack to avoid infinite loops
					untrack(() => router.openKey(fp, targetMode));
				}
			});
		}
	});

	// Update keyValue when keyObject changes (e.g. after decryption)
	$effect(() => {
		if (keyObject && keyObject.armor() !== keyValue) {
			// Only update if the key object is actually different from what we have in text
			// This happens when we decrypt a key, or when we select a key from the sidebar
			keyValue = keyObject.armor();
		}
	});

	let isPrivate = $derived(keyObject?.isPrivate() ?? false);

	// Helper to determine valid modes for current key
	let availableModes = $derived.by(() => {
		if (!keyObject) return [PGPMode.ENCRYPT];
		if (keyObject.isPrivate()) {
			return [PGPMode.ENCRYPT, PGPMode.DECRYPT];
		} else {
			return [PGPMode.ENCRYPT];
		}
	});

	// Ensure mode is valid for current key
	$effect(() => {
		if (keyObject && !availableModes.includes(mode)) {
			// If current mode is not available, switch to first available mode
			const newMode = availableModes[0] as PGPMode;
			// Use untrack to avoid infinite loops if router.setMode triggers this effect again
			untrack(() => router.setMode(newMode));
		}
	});

	// Expose key state for parent to observe
	export function getCurrentKey() {
		return { keyObject, keyValue };
	}

	let prevKeyObject = null;
	let prevMessage = '';

	$effect(() => {
		const k = keyObject;
		const m = message;

		const keyChanged = k?.getFingerprint() !== prevKeyObject?.getFingerprint();
		const messageChanged = m !== prevMessage;

		prevKeyObject = k;
		prevMessage = m;

		if (!k || !m) {
			output = '';
			error = '';
			return;
		}

		// Check if we need to decrypt the private key for the current operation
		if (mode === PGPMode.DECRYPT && k.isPrivate() && !k.isDecrypted()) {
			if (!keyChanged && !messageChanged) {
				//This is probably the user just locking the key again, so don't reset / nudge.
				return;
			}
			pgpKeyComponent?.nudgeForDecryption();
			output = '';
			error = 'Unlock the private key to proceed.';
			return; // Don't proceed until key is unlocked
		}

		error = '';

		// Use untrack to prevent this effect from re-running when output or error changes
		// This is important because we are setting output/error inside the promise callback
		// and we don't want to trigger the effect again.
		// Although output/error are not dependencies here, it's good practice.

		const processPromise = mode === PGPMode.DECRYPT ? decryptMessage(k, m) : encryptMessage(k, m);

		processPromise
			.then((result) => {
				// Check if the key and message are still the same
				// We need to access the current values of keyObject and message, but we can't use them directly
				// because they are reactive. We should use the captured k and m.
				// However, we also need to check if the component state has moved on.
				// The best way is to check if k and m match the current state.
				// But since we are in a promise, we need to be careful.

				// Actually, checking against the captured k and m is correct for ensuring we don't overwrite
				// with a stale result. But we also want to make sure we don't overwrite if the user has
				// cleared the input.

				if (keyObject === k && message === m) {
					output = result;
				}
			})
			.catch((err) => {
				if (keyObject === k && message === m) {
					error = err.message;
				}
			});
	});
</script>

{#snippet copyButtonsSnippet()}
	<CopyButtons value={message} />
{/snippet}

<aside aria-label="Sidebar">
	<KeySidebar />
</aside>

<main class="flex-1 overflow-y-auto p-4 sm:p-8" aria-label="PGP Workflow">
	<div class="container mx-auto max-w-4xl">
		<form class="space-y-6">
			<fieldset class="fieldset">
				<legend class="fieldset-legend">
					{#if isPrivate}
						Private Key
					{:else}
						Public Key
					{/if}
				</legend>
				{#if keyObject}
					<PGPKey bind:this={pgpKeyComponent} bind:key={keyObject} />
				{:else}
					<RawKeyInput
						bind:value={keyValue}
						label={isPrivate ? 'Private Key' : 'Public Key'}
						placeholder="Paste PGP Key (Armored)..."
						onKeyParsed={(k) => {
							keyObject = k;
						}}
					/>
				{/if}
			</fieldset>

			{#if availableModes.length > 1}
				<div class="divider"></div>
				<fieldset class="fieldset">
					<legend class="fieldset-legend">Mode</legend>
					<div class="form-control">
						<div class="join">
							{#each availableModes as availableMode (availableMode)}
								<button
									type="button"
									class="btn join-item {mode === availableMode ? 'btn-primary' : 'btn-outline'}"
									onclick={() => router.setMode(availableMode)}
								>
									{availableMode === PGPMode.ENCRYPT ? 'Encrypt' : 'Decrypt'}
								</button>
							{/each}
						</div>
					</div>
				</fieldset>
			{/if}

			<div class="divider"></div>

			{#if mode === PGPMode.ENCRYPT}
				<fieldset class="fieldset">
					<legend class="fieldset-legend">Message</legend>
					<CopyableTextarea
						bind:value={message}
						placeholder="Type your secret message..."
						label="Message"
						selectAllOnFocus={false}
						{error}
						buttons={copyButtonsSnippet}
					/>
				</fieldset>
				<fieldset class="fieldset">
					<legend class="fieldset-legend">Encrypted Message</legend>
					<CopyableTextarea
						value={output}
						readonly={true}
						placeholder="Encrypted output will appear here..."
						label="Encrypted Message"
						buttons={copyButtonsSnippet}
					/>
				</fieldset>
			{:else if mode === PGPMode.DECRYPT}
				<fieldset class="fieldset">
					<legend class="fieldset-legend">Encrypted Message</legend>
					<CopyableTextarea
						bind:value={message}
						placeholder="Paste encrypted message..."
						label="Encrypted Message"
						selectAllOnFocus={false}
						{error}
						buttons={copyButtonsSnippet}
					/>
				</fieldset>
				<fieldset class="fieldset">
					<legend class="fieldset-legend">Decrypted Message</legend>
					<CopyableTextarea
						value={output}
						readonly={true}
						placeholder="Decrypted output will appear here..."
						label="Decrypted Message"
						buttons={copyButtonsSnippet}
					/>
				</fieldset>
			{/if}
		</form>
	</div>
</main>
