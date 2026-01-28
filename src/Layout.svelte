<script lang="ts">
	import AppIcon from './lib/ui/icons/AppIcon.svelte';
	import { fade } from 'svelte/transition';
	import { router, Pages } from './routes/router.svelte';

	let { hasSidebar = false, sidebar, children } = $props();
	let isMobileMenuOpen = $state(false);

	const toggleMobileMenu = () => (isMobileMenuOpen = !isMobileMenuOpen);
</script>

<!--
  Root wrapper:
  - min-h-screen: page at least full height
  - md:grid: use grid layout on desktop
  - md:grid-cols-[20rem_1fr]: sidebar 20rem wide + main column
  - md:grid-rows-[5rem_1fr]: top header row (5rem) + content row
-->
<div class="min-h-screen grid grid-rows-[5rem_1fr] md:grid-cols-[20rem_1fr]">
	<!-- Top-left: Brand (desktop) -->
	<button
		class="hidden md:flex items-center gap-x-3 px-6 border-b border-base-300 bg-base-200 cursor-pointer"
		onclick={() => router.openHome()}
		aria-label="pgp.help"
	>
		<AppIcon />
		<div class="text-lg font-bold">
			pgp.<span class="text-primary">help</span>
		</div>
	</button>

	<!-- Top-right: Title -->
	<header class="h-20 flex items-center px-6 sm:px-8 border-b border-base-300 md:col-start-2">
		<div class="ml-4">
			<h1 class="text-2xl font-bold text-base-content">Encryption tool</h1>
			<p class="text-sm text-base-content/70">Secure messaging with OpenPGP</p>
		</div>

		<!-- Mobile brand -->
		<button
			class="flex items-center gap-x-3 md:hidden cursor-pointer ml-auto"
			onclick={() => router.openHome()}
			aria-label="pgp.help"
		>
			<AppIcon />
			<div class="text-lg font-bold">
				pgp.<span class="text-primary">help</span>
			</div>
		</button>

		<!-- Guide link (desktop) -->
		<div class="hidden md:flex ml-auto">
			<button class="btn btn-ghost" onclick={() => router.openPage(Pages.GUIDE)}>Guide</button>
		</div>
	</header>

	<!-- Bottom-left: Sidebar (desktop only, always present but may be empty) -->
	<aside class="hidden md:block bg-base-200 border-r border-base-300">
		{@render sidebar()}
	</aside>

	<!-- Bottom-right: Main content -->
	<main class="md:col-start-2 overflow-hidden">
		{@render children()}
	</main>
</div>

<!-- Mobile FAB + overlay only if sidebar exists -->
{#if hasSidebar}
	<div class="md:hidden fixed bottom-6 right-6 z-50">
		<button class="btn btn-lg btn-circle btn-primary" onclick={toggleMobileMenu}>
			{#if isMobileMenuOpen}
				<span class="text-xl">✕</span>
			{:else}
				<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 6h16M4 12h16M4 18h16"
					/>
				</svg>
			{/if}
		</button>
	</div>

	{#if isMobileMenuOpen}
		<!-- Dim backdrop for mobile when menu is open -->
		<div
			class="md:hidden fixed inset-0 bg-black/50 z-30"
			transition:fade={{ duration: 200 }}
			onclick={toggleMobileMenu}
			role="button"
			tabindex="0"
			onkeydown={(e) => {
				if (e.key === 'Escape') toggleMobileMenu();
			}}
		></div>

		<!-- Sidebar overlay -->
		<aside class="md:hidden fixed inset-y-0 left-0 w-80 max-w-[85vw] z-50 bg-base-200 border-r">
			{@render sidebar()}
		</aside>
	{/if}
{/if}
