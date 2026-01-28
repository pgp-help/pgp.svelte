<script lang="ts">
	import { encryptMessage, decryptMessage, signMessage, verifySignature } from './crypto';
	import { isAGEEncryptedMessage } from './crypto';
	import CopyableTextarea from '../ui/CopyableTextarea.svelte';
	import KeyDetails from './KeyDetails.svelte';
	import RawKeyInput from './RawKeyInput.svelte';
	import { type KeyWrapper } from './keyStore.svelte.js';
	import { type CryptoKey, KeyType } from './crypto';
	import { untrack } from 'svelte';

	const OperationType = {
		Encrypt: 'encrypt',
		Decrypt: 'decrypt',
		Sign: 'sign',
		Verify: 'verify'
	} as const;

	type OperationType = (typeof OperationType)[keyof typeof OperationType];

	interface Props {
		keyWrapper: KeyWrapper | null;
		onKeyParsed: (key: CryptoKey) => void;
		keyValue?: string;
	}
	let { keyWrapper = $bindable(), onKeyParsed, keyValue = $bindable('') }: Props = $props();

	let keyObject = $derived(keyWrapper?.key ?? null);

	$effect(() => {
		if (keyWrapper) {
			keyValue = '';
		}
	});

	// Reference to the KeyDetails component instance (for calling methods like nudgeForDecryption)
	let pgpKeyComponent = $state<KeyDetails | null>(null);
	// The input message to be encrypted or decrypted
	let message = $state('');
	// The result of the encryption or decryption operation
	let output = $state('');
	// Any error message from the operation (e.g. decryption failure)
	let error = $state('');
	let verificationStatus = $state<'valid' | 'invalid' | null>(null);
	let signerIdentity = $state<string | null>(null);

	let isPrivate = $derived(keyObject?.isPrivate() ?? false);
	let isAGE = $derived(keyObject?.type === KeyType.AGE);
	let isEncryptedMessage = $derived(
		message.trim().startsWith('-----BEGIN PGP MESSAGE-----') || isAGEEncryptedMessage(message)
	);
	let isSignedMessage = $derived(message.trim().startsWith('-----BEGIN PGP SIGNED MESSAGE-----'));

	let currentOperation = $derived.by(() => {
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

<div class="container mx-auto max-w-4xl space-y-6">
	<form class="space-y-6">
		<fieldset class="fieldset">
			<fieldset-legend class="fieldset-legend">
				{#if isPrivate}
					Private Key
				{:else}
					Public Key
				{/if}
			</fieldset-legend>
			{#if keyWrapper}
				<KeyDetails bind:this={pgpKeyComponent} bind:keyWrapper />
			{:else}
				<RawKeyInput
					bind:value={keyValue}
					label={isPrivate ? 'Private Key' : 'Public Key'}
					placeholder="Paste PGP Key (Armored)..."
					{onKeyParsed}
				/>
			{/if}
		</fieldset>

		<div data-testid="io_fields">
			{#if !isPrivate}
				{#if currentOperation === OperationType.Verify}
					{#if verificationStatus === 'valid'}
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
				{/if}
			{/if}
			<fieldset class="fieldset">
				<fieldset-legend class="fieldset-legend"> Input Message </fieldset-legend>
				<CopyableTextarea
					bind:value={message}
					placeholder={isPrivate
						? 'Type message to sign...\n or Paste encrypted message to decrypt...'
						: 'Type your secret message...\n or Paste signed message to verify...'}
					label="Input Message"
					selectAllOnFocus={false}
					fixed={currentOperation == OperationType.Verify}
					{error}
					buttons={true}
				/>
			</fieldset>
			{#if !isPrivate}
				{#if currentOperation !== OperationType.Verify}
					<fieldset class="fieldset mt-4">
						<fieldset-legend class="fieldset-legend">Encrypted Output</fieldset-legend>
						<CopyableTextarea
							value={output}
							readonly={true}
							fixed={true}
							placeholder="Encrypted output will appear here..."
							label="Encrypted Output"
							buttons={true}
						/>
					</fieldset>
				{/if}
			{:else}
				<fieldset class="fieldset mt-4">
					<fieldset-legend class="fieldset-legend">
						{currentOperation === OperationType.Decrypt ? 'Decrypted Output' : 'Signed Message'}
					</fieldset-legend>
					<CopyableTextarea
						value={output}
						readonly={true}
						fixed={true}
						placeholder="Signed / Decrypted message will appear here..."
						label={currentOperation === OperationType.Decrypt
							? 'Decrypted Output'
							: 'Signed Message'}
						buttons={true}
					/>
				</fieldset>
			{/if}
		</div>

		<!-- Message Input and Output -->
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
			<!-- Input Column (takes 2 cols on large screens) -->
			<div class="lg:col-span-2 flex flex-col gap-3">
				<label class="text-sm font-semibold text-base-content flex items-center gap-2">
					<i class="fa-regular fa-file-lines text-primary"></i> Message
				</label>
				<CopyableTextarea
					bind:value={message}
					placeholder={isPrivate
						? 'Type message to sign...\n or Paste encrypted message to decrypt...'
						: 'Type your secret message...\n or Paste signed message to verify...'}
					label=""
					selectAllOnFocus={false}
					fixed={currentOperation == OperationType.Verify}
					{error}
					buttons={true}
					class="flex-1 min-h-96 rounded-xl p-4 font-mono text-sm text-base-content resize-none focus:outline-none placeholder:text-base-content/50"
				/>
			</div>

			<!-- Output Column (fixed width on large screens) -->
			<div class="lg:col-span-1 flex flex-col gap-3">
				<label class="text-sm font-semibold text-base-content flex items-center gap-2">
					<i class="fa-solid fa-lock text-success"></i> Output
				</label>
				<div
					class="flex-1 min-h-96 card-panel rounded-xl overflow-hidden flex flex-col bg-base-200"
				>
					<!-- Toolbar -->
					<div
						class="h-10 bg-base-300 border-b border-base-300 flex items-center justify-between px-3"
					>
						<span class="text-xs font-mono text-base-content/60">RESULT</span>
						<button
							class="text-xs text-primary hover:text-primary/80 flex items-center gap-1 font-medium"
						>
							<i class="fa-regular fa-copy"></i> Copy
						</button>
					</div>
					<!-- Output Content -->
					<div class="flex-1 p-4 overflow-auto">
						<code class="font-mono text-xs text-base-content/70 block whitespace-pre-wrap break-all"
							>{output}</code
						>
					</div>
				</div>
			</div>
		</div>
	</form>
</div>
