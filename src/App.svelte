<script lang="ts">
	import Layout from './Layout.svelte';
	import PGPWorkflow from './lib/pgp/PGPWorkflow.svelte';
	import GenerateKey from './lib/pgp/GenerateKey.svelte';
	import Guide from './routes/Guide.svelte';
	import { router, Pages } from './lib/router.svelte.js';
</script>

<Layout>
	{#if router.activeRoute.page === Pages.GUIDE}
		<Guide />
	{:else if router.activeRoute.page === Pages.GENERATE_KEY}
		<GenerateKey />
	{:else}
		<PGPWorkflow />
	{/if}
</Layout>
