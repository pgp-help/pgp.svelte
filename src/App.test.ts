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

	it('renders core interface', () => {
		render(App);
		// Check Header - pgp.help is now a button, not a link
		// There are two buttons (desktop and mobile), so use getAllByRole
		expect(screen.getAllByRole('button', { name: /pgp\.help/i }).length).toBeGreaterThan(0);
		expect(screen.getByLabelText(/Message/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/Encrypted Output/i)).toBeInTheDocument();
	});

	it('encrypts message with valid key', async () => {
		const user = userEvent.setup();
		render(App);

		const keyTextarea = screen.getByLabelText(/Public Key/i);
		const messageTextarea = screen.getByLabelText(/Message/i);
		const outputTextarea = screen.getByLabelText(/Encrypted Output/i);

		// Use fireEvent for key to simulate a paste/instant update
		await fireEvent.input(keyTextarea, { target: { value: validPublicKey } });

		// Wait for key to be parsed and displayed (this confirms app accepted key)
		const mainArea = screen.getByRole('main', { name: 'PGP Workflow' });
		await within(mainArea).findByText('Public Key', { selector: 'fieldset-legend' });

		await user.type(messageTextarea, 'Hello World');

		// Wait for async encryption to complete
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

		const keyTextarea = await screen.findByLabelText(/Public Key/i);

		// Paste private key
		await fireEvent.input(keyTextarea, { target: { value: validPrivateKey } });

		// Wait for key to be parsed and displayed
		const mainArea = screen.getByRole('main', { name: 'PGP Workflow' });
		await within(mainArea).findByText('Private Key', { selector: 'fieldset-legend' });

		// Wait for unlock prompt
		const passwordInput = await screen.findByLabelText(/Unlock Private Key/i);
		const unlockButton = screen.getByRole('button', { name: /Unlock/i });

		await user.type(passwordInput, passphrase);
		await user.click(unlockButton);

		// Wait for unlockButton to go away
		await vi.waitFor(() => {
			expect(unlockButton).not.toBeInTheDocument();
		});

		// Should automatically be in decrypt mode because it's a private key
		// Now input the encrypted message
		const messageTextarea = screen.getByLabelText(/Input Message/i);

		await fireEvent.input(messageTextarea, { target: { value: encrypted } });

		// This will switch modes...
		await vi.waitFor(() => {
			expect(screen.getByLabelText(/Decrypted Output/i)).toBeInTheDocument();
		});

		// Wait for async decryption to complete
		const outputTextarea = screen.getByLabelText(/Decrypted Output/i);

		await vi.waitFor(() => {
			expect(outputTextarea).toHaveValue(secretMessage);
		});
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
