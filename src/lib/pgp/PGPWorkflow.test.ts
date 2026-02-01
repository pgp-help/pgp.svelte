/// <reference types="vitest/globals" />
import { render, screen, fireEvent, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import * as openpgp from 'openpgp';
import PGPPage from '../../routes/PGPPage.svelte';
import { keyStore } from './keyStore.svelte';
import { router } from '../../routes/router.svelte';

describe('PGPWorkflow', () => {
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

	beforeEach(async () => {
		router.openHome();
		await keyStore.clear();
		vi.clearAllMocks();
	});

	it('encrypts message with public key', async () => {
		const user = userEvent.setup();
		render(PGPPage);

		const keyTextarea = screen.getByLabelText(/Key/i);
		const messageTextarea = screen.getByLabelText(/Input Message/i);
		const outputTextarea = screen.getByLabelText(/Encrypted Output/i);

		await fireEvent.input(keyTextarea, { target: { value: validPublicKey } });

		// Wait for key to be parsed
		const mainArea = screen.getByRole('main', { name: 'PGP Workflow' });
		await within(mainArea).findByRole('heading', { name: /Test User/ });

		await user.type(messageTextarea, 'Hello World');

		await waitFor(
			() => {
				expect(outputTextarea).toHaveTextContent('-----BEGIN PGP MESSAGE-----');
			},
			{ timeout: 5000 }
		);
	});

	it('decrypts message with private key', async () => {
		const user = userEvent.setup();
		render(PGPPage);

		const secretMessage = 'Top Secret Data';
		const encrypted = (await openpgp.encrypt({
			message: await openpgp.createMessage({ text: secretMessage }),
			encryptionKeys: await openpgp.readKey({ armoredKey: validPublicKey })
		})) as string;

		const keyTextarea = screen.getByLabelText(/Key/i);

		await fireEvent.input(keyTextarea, { target: { value: validPrivateKey } });

		// Wait for key to be parsed and recognized as private
		const mainArea = screen.getByRole('main', { name: 'PGP Workflow' });
		await within(mainArea).findByRole('heading', { name: /Private Key/i });

		// Unlock
		const passwordInput = await screen.findByLabelText(/Unlock Private Key/i);
		const unlockButton = screen.getByRole('button', { name: /Unlock/i });

		await user.type(passwordInput, passphrase);
		await user.click(unlockButton);

		// Wait for the unlockButton to go away
		await vi.waitFor(() => {
			expect(unlockButton).not.toBeInTheDocument();
		});

		// Should be in decrypt mode automatically because it is a private key
		const messageTextarea = screen.getByLabelText(/Input Message/i);

		await fireEvent.input(messageTextarea, { target: { value: encrypted } });

		const outputTextarea = await screen.findByLabelText(/Decrypted Output/i);

		await waitFor(() => {
			expect(outputTextarea).toHaveTextContent(secretMessage);
		});
	});

	it('allows switching to public key from private key', async () => {
		const user = userEvent.setup();
		render(PGPPage);

		const keyTextarea = screen.getByLabelText(/Key/i);
		await fireEvent.input(keyTextarea, { target: { value: validPrivateKey } });

		const mainArea = screen.getByRole('main', { name: 'PGP Workflow' });
		await within(mainArea).findByRole('heading', { name: /Private Key/i });

		// Focus on the key card to make the switch button visible
		const keyCard = mainArea.querySelector('.card-field');
		if (keyCard) {
			fireEvent.focusIn(keyCard);
		}

		// Wait for the switch button to appear
		const switchButton = await screen.findByRole('button', { name: /Switch to Public Key/i });
		await user.click(switchButton);

		// Should now be in Encrypt mode (Public Key)
		expect(screen.getByLabelText(/Input Message/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/Encrypted Output/i)).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: /Public Key/i })).toBeInTheDocument();
	});

	it('automatically switches to private key (decrypt mode) when pasting encrypted message', async () => {
		const user = userEvent.setup();
		render(PGPPage);

		// Encrypt a message
		const secretMessage = 'Auto Switch Test';
		const encrypted = (await openpgp.encrypt({
			message: await openpgp.createMessage({ text: secretMessage }),
			encryptionKeys: await openpgp.readKey({ armoredKey: validPublicKey })
		})) as string;

		const keyTextarea = screen.getByLabelText(/Key/i);
		await fireEvent.input(keyTextarea, { target: { value: validPrivateKey } });

		const mainAreaDecrypt = screen.getByRole('main', { name: 'PGP Workflow' });
		await within(mainAreaDecrypt).findByRole('heading', { name: /Private Key/i });

		// Unlock
		const passwordInput = await screen.findByLabelText(/Unlock Private Key/i);
		const unlockButton = screen.getByRole('button', { name: /Unlock/i });
		await user.type(passwordInput, passphrase);
		await user.click(unlockButton);

		// Wait for the unlockButton to go away
		await vi.waitFor(() => {
			expect(unlockButton).not.toBeInTheDocument();
		});

		// Focus on the key card to make the switch button visible
		const keyCard = mainAreaDecrypt.querySelector('.card-field');
		if (keyCard) {
			fireEvent.focus(keyCard);
		}

		// Switch to Public Key manually to test auto-switch back
		const switchButton = screen.getByRole('button', { name: /Switch to Public Key/i });
		await user.click(switchButton);

		// Ensure we are in Encrypt mode
		const messageTextarea = screen.getByLabelText(/Input Message/i);

		// Paste encrypted message into the "Message" box (which is for plaintext in Encrypt mode)
		await fireEvent.input(messageTextarea, { target: { value: encrypted } });

		// It should detect the armor and switch to Private Key (Decrypt mode)
		// In Decrypt mode, the input label becomes "Encrypted Message" and output "Decrypted Output"

		await waitFor(() => {
			expect(screen.getByLabelText(/Decrypted Output/i)).toBeInTheDocument();
		});

		// And it should decrypt
		const outputTextarea = screen.getByLabelText(/Decrypted Output/i);
		await waitFor(() => {
			expect(outputTextarea).toHaveTextContent(secretMessage);
		});
	});

	it('should render errors', async () => {
		const user = userEvent.setup();
		render(PGPPage);

		const mainArea = screen.getByRole('main', { name: 'PGP Workflow' });
		const keyTextarea = within(mainArea).getByLabelText(/Key/i);
		await fireEvent.input(keyTextarea, { target: { value: validPrivateKey } });
		await within(mainArea).findByRole('heading', { name: /Private Key/i });

		// Unlock
		const passwordInput = await screen.findByLabelText(/Unlock Private Key/i);
		const unlockButton = screen.getByRole('button', { name: /Unlock/i });
		await user.type(passwordInput, passphrase);
		await user.click(unlockButton);
		await vi.waitFor(() => {
			expect(unlockButton).not.toBeInTheDocument();
		});

		// Focus on the key card to make the switch button visible
		const keyCard = mainArea.querySelector('.card-field');
		if (keyCard) {
			fireEvent.focus(keyCard);
		}

		// Switch to Public Key manually to test auto-switch back
		const switchButton = screen.getByRole('button', { name: /Switch to Public Key/i });
		await user.click(switchButton);

		// Ensure we are in Encrypt mode (Public Key)
		await waitFor(() => {
			expect(screen.getByLabelText(/Input Message/i)).toBeInTheDocument();
		});

		const encrypted = `
-----BEGIN PGP MESSAGE-----

wVQDXGUnwVbEXG4ZaWqXPiQ9gKb5HDPBPYUu5e6sUawh+iV/HOaHtXeWZ3sp
CVWmsZfRmSol3WnkpmGHs2fwXxGZEdJMtuOA1O1c97Ir/4L2+UlCSeLSMgF+
ULngoExa449ozHYCiJwbyVvXJWLgSamPDL+yGxunifP7uOyPa0wOGL5c4Ny6
El/w
=vbML
-----END PGP MESSAGE-----`;
		const messageTextarea = within(mainArea).getByLabelText(/Input Message/i);

		// Pasting a ciphertext should switch to Decrypt mode:
		await fireEvent.input(messageTextarea, { target: { value: encrypted } });

		await waitFor(() => {
			expect(screen.getByLabelText(/Decrypted Output/i)).toBeInTheDocument();
		});

		// Should show error because decryption will fail (bad data)
		// Note: The error message might take a moment
		await waitFor(() => {
			expect(messageTextarea).toBeInvalid();

			expect(messageTextarea).toHaveAttribute('aria-errormessage', 'input-error');
			expect(document.getElementById('input-error')).toBeInTheDocument();
		});
	});

	it('switches between public and private keys', async () => {
		const user = userEvent.setup();
		render(PGPPage);

		const keyTextarea = screen.getByLabelText(/Key/i);
		await fireEvent.input(keyTextarea, { target: { value: validPrivateKey } });

		const mainArea = screen.getByRole('main', { name: 'PGP Workflow' });
		await within(mainArea).findByRole('heading', { name: /Private Key/i });

		// Unlock
		const passwordInput = await screen.findByLabelText(/Unlock Private Key/i);
		const unlockButton = screen.getByRole('button', { name: /Unlock/i });
		await user.type(passwordInput, passphrase);
		await user.click(unlockButton);

		// Wait for the unlockButton to go away
		await vi.waitFor(() => {
			expect(unlockButton).not.toBeInTheDocument();
		});

		// Should be in sign/decrypt mode (private key with no message)
		// Check the input placeholder which indicates sign/decrypt mode
		const inputMessage = screen.getByLabelText(/Input Message/i);
		expect(inputMessage.getAttribute('placeholder')).toMatch(/Type message to sign/);

		// Focus on the key card to make the switch button visible
		const keyCard = mainArea.querySelector('.card-field');
		if (keyCard) {
			fireEvent.focus(keyCard);
		}

		// Switch to Public Key
		const switchToPublicButton = await screen.findByRole('button', {
			name: /Switch to Public Key/i
		});
		await user.click(switchToPublicButton);

		// Should now be in Encrypt mode (Public Key)
		// Check the input placeholder which indicates encrypt/verify mode
		expect(inputMessage.getAttribute('placeholder')).toMatch(/Type your secret message/);
		expect(screen.getByRole('heading', { name: /Public Key/i })).toBeInTheDocument();

		// Focus on the key card again to make the switch button visible
		if (keyCard) {
			fireEvent.focus(keyCard);
		}

		// Switch to Private Key
		const switchToPrivateButton = await screen.findByRole('button', {
			name: /Switch to Private Key/i
		});
		await user.click(switchToPrivateButton);

		// Should be back in sign/decrypt mode (private key with no message)
		expect(inputMessage.getAttribute('placeholder')).toMatch(/Type message to sign/);
		expect(screen.getByRole('heading', { name: /Private Key/i })).toBeInTheDocument();
	});
});
