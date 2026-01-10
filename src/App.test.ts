/// <reference types="vitest/globals" />
import { render, screen, fireEvent, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import * as openpgp from 'openpgp';
import App from './App.svelte';
import { keyStore } from './lib/pgp/keyStore.svelte';

describe('App', () => {
	let validPublicKey: string;
	let validPrivateKey: string;
	const passphrase = 'password123';

	beforeAll(async () => {
		// Generate a real test key pair
		const { publicKey, privateKey } = await openpgp.generateKey({
			type: 'ecc',
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			curve: 'ed25519' as any, //Squash type error
			userIDs: [{ name: 'Test User', email: 'test@example.com' }],
			passphrase
		});
		validPublicKey = publicKey;
		validPrivateKey = privateKey;
	});

	beforeEach(() => {
		window.history.replaceState({}, '', '/');
		keyStore.clear();
		vi.clearAllMocks();
	});

	it('renders the core interface', () => {
		render(App);
		// Check Header
		expect(screen.getByRole('link', { name: 'pgp.help' })).toBeInTheDocument();
		expect(screen.getByLabelText(/^Message/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/Encrypted Message/i)).toBeInTheDocument();
	});

	it('encrypts message with valid key', async () => {
		const user = userEvent.setup();
		render(App);

		const keyTextarea = screen.getByLabelText(/Public Key/i);
		const messageTextarea = screen.getByLabelText(/^Message/i);
		const outputTextarea = screen.getByLabelText(/Encrypted Message/i);

		// Use fireEvent for the key to simulate a paste/instant update
		await fireEvent.input(keyTextarea, { target: { value: validPublicKey } });

		// Wait for the key to be parsed and displayed (this confirms the app accepted the key)
		const mainArea = screen.getByRole('main', { name: 'PGP Workflow' });
		await within(mainArea).findByText('Public Key', { selector: 'legend' });

		await user.type(messageTextarea, 'Hello World');

		// Wait for the async encryption to complete
		await vi.waitFor(
			() => {
				const output = (outputTextarea as HTMLTextAreaElement).value;
				expect(output).toContain('-----BEGIN PGP MESSAGE-----');
				expect(output).toContain('-----END PGP MESSAGE-----');
			},
			{ timeout: 5000 }
		);
	});

	it('decrypts message with locked private key', async () => {
		const user = userEvent.setup();
		render(App);

		// Encrypt a message manually to test decryption
		const secretMessage = 'Top Secret Data';
		const encrypted = (await openpgp.encrypt({
			message: await openpgp.createMessage({ text: secretMessage }),
			encryptionKeys: await openpgp.readKey({ armoredKey: validPublicKey })
		})) as string;

		const keyTextarea = screen.getByLabelText(/Public Key/i);

		// Paste private key
		await fireEvent.input(keyTextarea, { target: { value: validPrivateKey } });

		// Wait for the key to be parsed and displayed
		const mainArea = screen.getByRole('main', { name: 'PGP Workflow' });
		await within(mainArea).findByText('Private Key', { selector: 'legend' });

		// Wait for unlock prompt
		const passwordInput = await screen.findByLabelText(/Unlock Private Key/i);
		const unlockButton = screen.getByRole('button', { name: /Unlock/i });

		await user.type(passwordInput, passphrase);
		await user.click(unlockButton);

		// Wait for unlock to complete (Unlocked badge appears)
		await screen.findByText((content, element) => {
			return element?.tagName.toLowerCase() === 'span' && content.includes('Unlocked');
		});

		// Switch to decrypt mode using the mode switching widget
		const decryptButton = screen.getByRole('button', { name: /Decrypt/i });
		await user.click(decryptButton);

		// Now input the encrypted message
		const messageTextarea = screen.getByLabelText(/Encrypted Message/i);
		const outputTextarea = screen.getByLabelText(/Decrypted Message/i);

		await fireEvent.input(messageTextarea, { target: { value: encrypted } });

		// Wait for the async decryption to complete
		await vi.waitFor(
			() => {
				expect(outputTextarea).toHaveValue(secretMessage);
			},
			{ timeout: 5000 }
		);
	});

	it('applies DaisyUI styling classes', () => {
		render(App);

		// Check that DaisyUI classes are present on key elements
		const textareas = screen.getAllByRole('textbox');
		expect(textareas.length).toBeGreaterThan(0);

		// Verify DaisyUI textarea class is applied
		textareas.forEach((textarea) => {
			expect(textarea).toHaveClass('textarea');
		});
	});
});
