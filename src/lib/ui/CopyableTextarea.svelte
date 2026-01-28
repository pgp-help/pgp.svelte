<script lang="ts">
	// This component renders a textarea with a built-in "Copy to Clipboard" button.
	// It also includes logic to auto-select all text when the textarea is focused,
	// making it easier for users to copy the content manually if needed.

	const BASE_PATH = import.meta.env.BASE_URL || '/';
	import MiniActionButton from './MiniActionButton.svelte';
	import CopyIcon from './icons/CopyIcon.svelte';
	import MarkdownIcon from './icons/MarkdownIcon.svelte';
	import ShareIcon from './icons/ShareIcon.svelte';
	import LinkIcon from './icons/LinkIcon.svelte';

	import { isAGEKeyString } from '../pgp/age';

	let {
		value = $bindable(''),
		readonly = false,
		placeholder = '',
		label = '',
		id = '',
		selectAllOnFocus = true,
		fixed = false,
		error = '',
		rows = 8,
		class: className = '',
		buttons = false
	} = $props<{
		value?: string;
		readonly?: boolean;
		placeholder?: string;
		label?: string;
		id?: string;
		selectAllOnFocus?: boolean;
		fixed?: boolean;
		error?: string;
		rows?: number;
		class?: string;
		buttons?: boolean;
	}>();

	let errorId = $derived(error ? `${id || 'textarea'}-error` : undefined);

	let textareaElement = $state<HTMLTextAreaElement>();

	let cols = $derived(
		fixed && value ? Math.max(...value.split('\n').map((l) => l.length)) + 0 : undefined
	);

	let isPublicKey = $derived(
		value &&
			(value.includes('-----BEGIN PGP PUBLIC KEY BLOCK-----') ||
				(isAGEKeyString(value) && value.startsWith('age1')))
	);

	async function copyToClipboard() {
		try {
			await navigator.clipboard.writeText(value || '');
		} catch (err) {
			console.error('Failed to copy text: ', err);
		}
	}

	// Basic markdown is easy enough to hand-crank, it's reddit markdown that's a pain. So focus on that.
	// async function copyToClipboardMarkdown() {
	// 	const markdownValue = '```\n' + (value || '') + '\n```';
	// 	try {
	// 		await navigator.clipboard.writeText(markdownValue);
	// 	} catch (err) {
	// 		console.error('Failed to copy text: ', err);
	// 	}
	// }

	async function copyToClipboardReddit() {
		const redditValue = (value || '')
			.split('\n')
			.map((line) => '    ' + line)
			.join('\n');
		try {
			await navigator.clipboard.writeText(redditValue);
		} catch (err) {
			console.error('Failed to copy text: ', err);
		}
	}

	async function copyLink() {
		const baseUrl = window.location.origin + BASE_PATH; // See also router.svelte.ts
		const url = new URL(baseUrl);
		if (value) url.searchParams.set('key', value);
		try {
			await navigator.clipboard.writeText(url.toString());
		} catch (err) {
			console.error('Failed to copy link: ', err);
		}
	}

	$effect(() => {
		// Watch for visibility changes:
		if (!fixed || !textareaElement) return;

		const observer = new ResizeObserver(() => {
			// Fires when:
			// - Value changes (content grows)
			// - Collapse opens (element becomes visible)
			// - Window resizes
			adjustHeight();
		});

		observer.observe(textareaElement);
		return () => observer.disconnect();
	});

	$effect(() => {
		// Adjust height when value changes:
		if (!fixed || !textareaElement) return;
		if (value === undefined) return;
		adjustHeight();
	});

	function adjustHeight() {
		if (!textareaElement) return; //defensive

		// Skip if element or any ancestor has display: none
		if (textareaElement.offsetParent === null) return;

		textareaElement.style.height = 'auto';
		textareaElement.style.height = textareaElement.scrollHeight + 'px';
	}

	function handleFocus() {
		if (!selectAllOnFocus) return;

		// Select all text when the textarea gains focus - a QoL improvement
		if (textareaElement) {
			textareaElement.select();
			// Use setTimeout to override browser's default scroll-to-selection behavior
			// 10ms delay is usually enough to beat the browser's native scroll-to-cursor
			setTimeout(() => {
				if (textareaElement) {
					textareaElement.setSelectionRange(0, textareaElement.value.length, 'backward');
					textareaElement.scrollTop = 0;
				}
			}, 10);
		}
	}

	function handleMouseDown() {
		if (!selectAllOnFocus) return;

		// If the textarea is not currently focused, we want the subsequent 'mouseup'
		// to NOT clear the selection we are about to make in 'handleFocus'.
		// We mark this state to handle it in 'handleMouseUp'.
		if (textareaElement && document.activeElement !== textareaElement) {
			textareaElement.dataset.preventMouseUp = 'true';
		}
	}

	function handleMouseUp(event: MouseEvent) {
		if (!selectAllOnFocus) return;

		// If we flagged this interaction in 'handleMouseDown', prevent the default
		// behavior (which would be to place the cursor and deselect the text).
		// This ensures the 'select()' from 'handleFocus' persists on the first click.
		if (textareaElement && textareaElement.dataset.preventMouseUp === 'true') {
			event.preventDefault();
			delete textareaElement.dataset.preventMouseUp;
		}
	}
</script>

<div class="relative w-full">
	<textarea
		{id}
		bind:this={textareaElement}
		bind:value
		{cols}
		{rows}
		{readonly}
		{placeholder}
		class="textarea textarea-code w-full whitespace-nowrap {fixed
			? 'resize-none'
			: ''} {className} {error ? 'border-error' : ''}"
		style={fixed ? 'height: auto; overflow-y: hidden;' : ''}
		aria-label={label}
		aria-invalid={error ? 'true' : undefined}
		aria-describedby={errorId}
		onfocus={handleFocus}
		onmousedown={handleMouseDown}
		onmouseup={handleMouseUp}
	></textarea>
	{#if error}
		<div class="label">
			<span id={errorId} class="label-text-alt text-error">{error}</span>
		</div>
	{/if}
	{#if buttons && value}
		<div class="fab fab-down absolute">
			<!-- a focusable div with tabindex is necessary to work on all browsers. role="button" is necessary for accessibility -->
			<div tabindex="0" role="button" class="btn btn-mini" title="Share"><ShareIcon /></div>

			<!-- buttons that show up when FAB is open -->
			<div>
				<MiniActionButton secondary label="Copy" feedback="Copied!" onclick={copyToClipboard}>
					<CopyIcon />
				</MiniActionButton>
			</div>
			<div>
				<MiniActionButton
					secondary
					label="Copy (Markdown)"
					feedback="Copied!"
					onclick={copyToClipboardReddit}
				>
					<MarkdownIcon />
				</MiniActionButton>
				<!-- I did consider having a separate markdown / reddit-markdown button, but it's too much clutter -->
			</div>
			{#if isPublicKey}
				<div>
					<MiniActionButton secondary label="Copy Link" feedback="Copied!" onclick={copyLink}>
						<LinkIcon />
					</MiniActionButton>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.textarea-code {
		font-family: monospace;
	}
</style>
