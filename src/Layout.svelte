<script lang="ts">
	import { router, Pages } from './lib/router.svelte.js';

	function handleHome(e: MouseEvent) {
		e.preventDefault();
		router.openHome();
	}

	function handleGuide(e: MouseEvent) {
		e.preventDefault();
		router.openPage(Pages.GUIDE);
	}
</script>

<div class="h-screen flex flex-col overflow-hidden">
	<div class="navbar bg-base-200 flex-none z-10">
		<div class="navbar-start">
			<a class="btn btn-ghost text-xl" href="/" onclick={handleHome}>pgp.help</a>
		</div>
		<div class="navbar-center hidden sm:flex">
			<p class="text-sm opacity-80">Simple secure client-side encryption</p>
		</div>
		<div class="navbar-end">
			<a class="btn btn-ghost btn-sm" href="/Guide" onclick={handleGuide}> Guide </a>
		</div>
	</div>

	<div class="flex flex-1 overflow-hidden">
		<slot />
	</div>
	<footer class="footer footer-center p-4 mt-8 text-base-content/50">
		<aside>
			<p>
				View source on
				<a
					class="link link-hover link-primary"
					href="https://github.com/pgp-help/pgp.svelte"
					rel="noopener"
				>
					GitHub
				</a>
			</p>
		</aside>
	</footer>
</div>
