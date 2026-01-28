<script lang="ts">
	import { slide } from 'svelte/transition';
	import { type KeyWrapper } from './keyStore.svelte.js';
	import PGPKeyBadges from './PGPKeyBadges.svelte';
	import Avatar from '../ui/Avatar.svelte';

	interface Props {
		keys: KeyWrapper[];
		selectedWrapper?: KeyWrapper | null;
	}

	let { keys, selectedWrapper = $bindable() }: Props = $props();

	function getKeyName(wrapper: KeyWrapper) {
		const user = wrapper.key.getUserIDs()[0] || '<Unknown>';
		const match = user.match(/^(.*?)(?:\s+<([^>]+)>)?$/);
		return match ? match[1].trim() : user;
	}

	function getKeyEmail(wrapper: KeyWrapper) {
		const user = wrapper.key.getUserIDs()[0] || '<Unknown>';
		const match = user.match(/^(.*?)(?:\s+<([^>]+)>)?$/);
		return match && match[2] ? match[2].trim() : '';
	}

	function getKeySubtitle(wrapper: KeyWrapper) {
		const email = getKeyEmail(wrapper);
		if (email) {
			return email;
		}
		return wrapper.key.getId();
	}
</script>

<div class="space-y-2">
	{#if keys.length === 0}
		<div class="text-center p-4 text-base-content/60 text-sm">
			No keys found. Create or import one to get started.
		</div>
	{/if}
	{#each keys as wrapper (wrapper.key.getFingerprint())}
		{@const isSelected = selectedWrapper?.key.getFingerprint() === wrapper.key.getFingerprint()}
		{@const name = getKeyName(wrapper)}
		{@const email = getKeySubtitle(wrapper)}

		<div transition:slide={{ duration: 200 }}>
			<div
				class="card card-selectable p-3 {isSelected ? 'card-selected' : ''}"
				role="button"
				tabindex="0"
				onclick={() => (selectedWrapper = wrapper)}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') selectedWrapper = wrapper;
				}}
			>
				<div class="flex items-start gap-3">
					<!-- Avatar -->
					<Avatar cryptoKey={wrapper.key} size={40} />

					<!-- Name + badge + subtitle -->
					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-2">
							<span class="font-medium truncate text-sm" title={name}>{name}</span>
							<PGPKeyBadges keyWrapper={wrapper} />
						</div>

						{#if email}
							<div class="text-xs text-base-content/60 truncate" title={email}>
								{email}
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	{/each}
</div>
