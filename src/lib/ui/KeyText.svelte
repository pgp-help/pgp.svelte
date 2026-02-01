<script lang="ts">
	import IconPrivate from './icons/privkey.svelte';
	import IconPublic from './icons/pubkey.svelte';

	let {
		isPrivate = false,
		colourText = false, // Default to true
		class: className = '',
		text = null,
		...rest
	} = $props();

	// 1. Determine Logic
	const CurrentIcon = $derived(isPrivate ? IconPrivate : IconPublic);
	const textLabel = $derived.by(() => {
		if (text) {
			return text;
		}
		let ret = isPrivate ? 'Private Key' : 'Public Key';
		return ret;
	});

	// 2. Resolve Colors
	// We map the abstract state to a specific CSS Class
	const activeColorClass = $derived(isPrivate ? 'text-error' : 'text-primary');
</script>

<!-- wrapper gets generic class + user input class -->
<span class="key-text-wrapper {className} {colourText ? activeColorClass : ''}" {...rest}>
	<!-- ICON: Always colored -->
	<span class="icon-frame {activeColorClass}">
		<CurrentIcon />
	</span>
	{textLabel}
</span>

<style>
	.key-text-wrapper {
		display: inline-flex;
		align-items: baseline;
		white-space: nowrap;
		gap: 0.15em;
	}

	.icon-frame {
		display: flex;
		align-items: baseline;
		justify-content: center;
		width: 1.25em;
		height: 1.25em;
		flex-shrink: 0;
		transform: translateY(0.2em);
	}

	/* 
       If you are using Tailwind/DaisyUI, the :global overrides above might
       conflict if not careful. Alternatively, use a style attribute for hard debugging:
    */
</style>
