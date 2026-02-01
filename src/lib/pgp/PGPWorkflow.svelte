<script lang="ts">
	import { encryptMessage, decryptMessage, signMessage, verifySignature } from './crypto';
	import { isAGEEncryptedMessage } from './crypto';
	import KeyDetails from './KeyDetails.svelte';
	import RawKeyInput from './RawKeyInput.svelte';
	import { type KeyWrapper } from './keyStore.svelte.js';
	import { type CryptoKey, KeyType, OperationType } from './crypto';
	import { untrack } from 'svelte';
	import CopyButtons from '../ui/CopyButtons.svelte';
	import SelectableText from '../ui/SelectableText.svelte';
	import KeyText from '../ui/KeyText.svelte';

	interface Props {
		keyWrapper: KeyWrapper | null;
		onKeyParsed: (key: CryptoKey) => void;
		keyValue?: string;
	}
	let { keyWrapper = $bindable(), onKeyParsed, keyValue = $bindable('') }: Props = $props();

	let keyObject = $derived(keyWrapper?.key ?? null);

	// Reference to the KeyDetails component instance (for calling methods like nudgeForDecryption)
	let pgpKeyComponent = $state<KeyDetails | null>(null);
	// Reference to the RawKeyInput component instance (for calling focus method)
	let rawKeyInputComponent = $state<RawKeyInput | null>(null);
	// Reference to the input message textarea
	let inputMessageRef = $state<HTMLTextAreaElement | null>(null);
	// The input message to be encrypted or decrypted
	let message = $state('');
	// The result of the encryption or decryption operation
	let output = $state('');
	// Any error message from the operation (e.g. decryption failure)
	let error = $state('');
	let verificationStatus = $state<'valid' | 'invalid' | null>(null);
	let signerIdentity = $state<string | null>(null);

	$effect(() => {
		if (keyWrapper) {
			keyValue = '';
		}
	});

	// Flush output when key changes
	$effect(() => {
		void keyObject;
		output = '';
		error = '';
		verificationStatus = null;
		signerIdentity = null;
	});

	// Focus input message when key changes
	$effect(() => {
		if (keyObject) {
			inputMessageRef?.focus();
		} else {
			rawKeyInputComponent?.focus();
		}
	});

	let isPrivate = $derived(keyObject?.isPrivate() ?? false);
	let isAGE = $derived(keyObject?.type === KeyType.AGE);
	let isEncryptedMessage = $derived(
		message.trim().startsWith('-----BEGIN PGP MESSAGE-----') || isAGEEncryptedMessage(message)
	);
	let isSignedMessage = $derived(message.trim().startsWith('-----BEGIN PGP SIGNED MESSAGE-----'));

	let currentOperation = $derived.by(() => {
		if (message.trim() === '') return null;

		if (isPrivate) {
			// Private Key: Decrypt or Sign
			if (isAGE) {
				// AGE is mainly for encryption/decryption, signatures not supported
				return OperationType.Decrypt;
			}
			return isEncryptedMessage ? OperationType.Decrypt : OperationType.Sign;
		} else {
			// Public Key: Encrypt or Verify
			if (isAGE) {
				return OperationType.Encrypt;
			}
			return isSignedMessage ? OperationType.Verify : OperationType.Encrypt;
		}
	});

	$effect(() => {
		// Wrap async logic in a non-async function to comply with $effect requirements.
		// $effect callbacks must return void or a cleanup function, not a Promise.
		const currentMessage = message;

		// If we are in ENCRYPT mode (Public Key) and we have a private key available
		if (!isPrivate && keyWrapper?.masterKey) {
			if (
				currentMessage.trim().startsWith('-----BEGIN PGP MESSAGE-----') ||
				(isAGE && isAGEEncryptedMessage(currentMessage))
			) {
				keyWrapper = keyWrapper.masterKey;
				output = '';
			}
		}
	});

	$effect(() => {
		void verificationStatus; // To trigger the event
		const k = untrack(() => keyObject);

		if (verificationStatus) {
			signerIdentity = k.getUserIDs()[0] || '<unknown>';
		}
	});

	$effect(() => {
		const k = keyObject;
		const m = message;
		const currentIsPrivate = isPrivate;
		const op = currentOperation;

		verificationStatus = null;

		if (!k || !m) {
			output = '';
			error = '';
			return;
		}

		// Check if we need to decrypt the private key for the current operation
		if (currentIsPrivate && k.isPrivate() && !k.isDecrypted()) {
			pgpKeyComponent?.nudgeForDecryption();
			output = '';
			error = 'Unlock the private key to proceed.';
			return; // Don't proceed until key is unlocked
		}

		error = '';

		let processPromise: Promise<string | boolean>;

		if (op === OperationType.Decrypt) {
			processPromise = decryptMessage(k, m);
		} else if (op === OperationType.Sign) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			processPromise = signMessage(k as any, m);
		} else if (op === OperationType.Verify) {
			processPromise = verifySignature(k, m);
		} else {
			processPromise = encryptMessage(k, m);
		}

		processPromise
			.then((result) => {
				if (isPrivate === currentIsPrivate && keyObject === k && message === m) {
					if (op === OperationType.Verify) {
						console.log('verified ok');
						verificationStatus = 'valid';
						output = '';
					} else {
						output = result as string;
					}
				}
			})
			.catch((err) => {
				if (isPrivate === currentIsPrivate && keyObject === k && message === m) {
					if (op === OperationType.Verify) {
						console.log('verified failed: ', err);
						verificationStatus = 'invalid';
						error = err.message;
					} else {
						error = err.message;
					}
				}
			});
	});
</script>

{#snippet idleMessage()}
	{#if isPrivate}
		<!-- If I hold a private key, I can encrypt for myself (using public) -->
		Will Encrypt or Verify with <KeyText isPrivate={true} />
	{:else}
		<!-- If I hold a public key, I can verify signatures (using public) -->
		Will Verify Signature from <KeyText isPrivate={false} />
	{/if}
{/snippet}

{#snippet activeMessage()}
	{#if currentOperation === OperationType.Encrypt}
		Encrypting with <KeyText {isPrivate} />
	{:else if currentOperation === OperationType.Decrypt}
		Decrypting with <KeyText isPrivate={true} />
	{:else if currentOperation === OperationType.Sign}
		Signing with <KeyText isPrivate={true} /> to prove identity
	{:else if currentOperation === OperationType.Verify}
		Verifying Signature with <KeyText isPrivate={false} />
	{/if}
{/snippet}

<div class="container mx-auto max-w-4xl space-y-6">
	<div class="space-y-6">
		<!-- Key Section -->
		{#if keyWrapper}
			<KeyDetails bind:this={pgpKeyComponent} bind:keyWrapper />
		{:else}
			<RawKeyInput bind:this={rawKeyInputComponent} value={keyValue} {onKeyParsed} />
		{/if}

		<!-- IO Fields -->
		<div data-testid="io_fields">
			<!-- Input Message -->
			<div class="mt-4">
				<div
					class="card-field w-full shadow-sm"
					data-state={error
						? 'error'
						: verificationStatus === 'valid'
							? 'success'
							: //EverificationStatus === 'invalid' is basically error.
								undefined}
				>
					<div class="card-field-header">
						<!-- Connect label to input manually -->
						<label for="input-message">Input Message</label>
					</div>

					<div class="card-field-body">
						<textarea
							id="input-message"
							bind:this={inputMessageRef}
							bind:value={message}
							aria-label="Input Message"
							aria-invalid={!!error}
							aria-errormessage={error ? 'input-error' : undefined}
							class="textarea textarea-ghost h-[30vh] w-full resize-y font-mono border-none focus:outline-none focus:bg-transparent"
							placeholder={isPrivate
								? 'Type message to sign...\n or Paste encrypted message to decrypt...'
								: 'Type your secret message...\n or Paste signed message to verify...'}
						></textarea>
					</div>

					{#if error}
						<div id="input-error" class="card-field-footer">
							{error}
						</div>
					{:else if verificationStatus === 'valid'}
						<div data-state="error" id="input-error" class="card-field-footer">
							Signature verified!
						</div>
					{:else if keyWrapper != null}
						<div class="card-field-footer">
							<span>
								{#if !currentOperation}
									{@render idleMessage()}
								{:else}
									{@render activeMessage()}
								{/if}
							</span>
						</div>
					{/if}
				</div>
			</div>

			<!-- Output Section -->
			{#if currentOperation !== OperationType.Verify}
				{@const outputTitle = isPrivate
					? currentOperation !== OperationType.Sign
						? 'Decrypted Output'
						: 'Signed Message'
					: 'Encrypted Output'}
				{@const outputPlaceholder = isPrivate
					? 'Signed / Decrypted message will appear here...'
					: 'Encrypted output will appear here...'}

				<div class="mt-4">
					<div class="card-field w-full shadow-sm">
						<div class="card-field-header">
							<label for="output-message">{outputTitle}</label>
							<!-- Actions just sit in the header flex container -->
							<CopyButtons value={output} />
						</div>

						<div class="card-field-body max-h-[30vh] overflow-y-auto" data-readonly="true">
							<SelectableText
								id="output-message"
								aria-label={outputTitle}
								value={output}
								placeholder={outputPlaceholder}
							/>
						</div>
					</div>
				</div>
			{:else if verificationStatus === 'valid'}
				<div role="alert" class="alert alert-success mt-4">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="stroke-current shrink-0 h-6 w-6"
						fill="none"
						viewBox="0 0 24 24"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
						/></svg
					>
					<div class="flex flex-col">
						<span class="font-bold">Signature Verified!</span>
						{#if signerIdentity}
							<span class="text-sm opacity-80">Signed by: {signerIdentity}</span>
						{/if}
					</div>
				</div>
			{:else if verificationStatus === 'invalid'}
				<div role="alert" class="alert alert-error mt-4">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="stroke-current shrink-0 h-6 w-6"
						fill="none"
						viewBox="0 0 24 24"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
						/></svg
					>
					<span>Verification Failed: {error}</span>
				</div>
			{/if}
		</div>
	</div>
</div>
