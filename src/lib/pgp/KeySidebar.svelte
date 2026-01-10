<script lang="ts">
	import { keyStore } from './keyStore.svelte.js';
	import KeyListItem from './KeyListItem.svelte';
	import { router, Pages } from '../router.svelte.js';
	import { slide } from 'svelte/transition';

	let selectedFingerprint = $derived(router.activeRoute.pgp.fingerprint);

	function handleNewKey(e: Event) {
		e.preventDefault();
		router.openHome();
	}

	function handleSelectKey(e: Event, fingerprint: string) {
		e.preventDefault();
		router.openKey(fingerprint);
	}
</script>

<div class="h-full flex flex-col bg-base-100 border-r border-base-300 w-64">
	<div class="p-4 border-b border-base-300 space-y-2">
		<button class="btn btn-primary w-full" onclick={handleNewKey}>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-5 w-5 mr-2"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
			</svg>
			Import Key
		</button>
		<button class="btn btn-outline w-full" onclick={() => router.openPage(Pages.GENERATE_KEY)}>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-5 w-5 mr-2"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
				/>
			</svg>
			Generate Key
		</button>
	</div>

	<div class="flex-1 overflow-y-auto p-2 space-y-1">
		{#if keyStore.keys.length === 0}
			<div class="text-center p-4 text-base-content/50 text-sm">
				No keys found. Create or import one to get started.
			</div>
		{/if}
		{#each keyStore.keys as key (key.getFingerprint())}
			<div class="flex flex-col" transition:slide={{ duration: 200 }}>
				<a
					href="/pgp.svelte/{key.getFingerprint()}"
					class="block group"
					onclick={(e) => handleSelectKey(e, key.getFingerprint())}
				>
					<KeyListItem {key} isSelected={selectedFingerprint === key.getFingerprint()} />
				</a>
			</div>
		{/each}
	</div>
</div>
