<script lang="ts">
	import { generateKeyPair, getKeyDetails } from './pgp';
	import { router } from '../router.svelte.js';
	import { keyStore } from './keyStore.svelte.js';
	import KeySidebar from './KeySidebar.svelte';

	let name = $state('');
	let email = $state('');
	let passphrase = $state('');
	let isGenerating = $state(false);
	let error = $state('');

	let isPassphraseComplex = $derived(passphrase.length >= 8);

	async function handleGenerate(e: Event) {
		e.preventDefault();

		isGenerating = true;
		error = '';

		try {
			const keyPair = await generateKeyPair(name, email, passphrase);

			// Automatically add the generated keys to the store
			const privateKeyObj = await getKeyDetails(keyPair.privateKey);
			await keyStore.addKey(privateKeyObj);

			router.openKey(privateKeyObj.getFingerprint());
		} catch (err) {
			error = (err as Error).message;
		} finally {
			isGenerating = false;
		}
	}
</script>

<aside aria-label="Sidebar">
	<KeySidebar />
</aside>

<main class="flex-1 overflow-y-auto p-4 sm:p-8" aria-label="Generate Key">
	<div class="container mx-auto max-w-2xl">
		<h1 class="text-2xl font-bold mb-6">Generate New PGP Key</h1>

		<form class="space-y-4" onsubmit={handleGenerate}>
			<div class="form-control w-full">
				<label class="label" for="name">
					<span class="label-text">Name</span>
				</label>
				<input
					type="text"
					id="name"
					bind:value={name}
					placeholder="John Doe"
					class="input input-bordered w-full"
					required
					disabled={isGenerating}
				/>
			</div>

			<div class="form-control w-full">
				<label class="label" for="email">
					<span class="label-text">Email</span>
				</label>
				<input
					type="email"
					id="email"
					bind:value={email}
					placeholder="john@example.com"
					class="input input-bordered w-full"
					required
					disabled={isGenerating}
				/>
			</div>

			<div class="form-control w-full">
				<label class="label" for="passphrase">
					<span class="label-text">Passphrase (Optional but Recommended)</span>
				</label>

				<div
					class="alert {isPassphraseComplex
						? 'alert-success opacity-70'
						: 'alert-warning'} text-sm py-2 mb-2 transition-all"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="stroke-current shrink-0 h-5 w-5"
						fill="none"
						viewBox="0 0 24 24"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
						/></svg
					>
					<span>
						{isPassphraseComplex
							? 'Passphrase strength is good.'
							: 'The security of your key depends heavily on the complexity of your passphrase.'}
					</span>
				</div>

				<input
					type="password"
					id="passphrase"
					bind:value={passphrase}
					placeholder="Enter a strong passphrase..."
					class="input input-bordered w-full"
					disabled={isGenerating}
				/>
			</div>

			{#if error}
				<div class="alert alert-error">
					<span>{error}</span>
				</div>
			{/if}

			<div class="flex justify-end gap-2 mt-6">
				<button
					type="button"
					class="btn btn-ghost"
					onclick={() => router.openHome()}
					disabled={isGenerating}>Cancel</button
				>
				<button type="submit" class="btn btn-primary" disabled={isGenerating}>
					{#if isGenerating}
						<span class="loading loading-spinner"></span>
						Generating...
					{:else}
						Generate Key
					{/if}
				</button>
			</div>
		</form>
	</div>
</main>
