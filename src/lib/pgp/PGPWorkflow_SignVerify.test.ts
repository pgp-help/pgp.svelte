import { render, screen, fireEvent, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import * as openpgp from 'openpgp';
import PGPPage from '../../routes/PGPPage.svelte';
import { keyStore } from './keyStore.svelte';
import { router } from '../../routes/router.svelte';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

describe('PGPWorkflow Sign/Verify', () => {
	let validPublicKey: string;
	let validPrivateKey: string;
	const passphrase = 'password123';

	beforeAll(async () => {
		const { publicKey, privateKey } = await openpgp.generateKey({
			type: 'ecc',
			curve: 'ed25519',
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

	it('signs message with private key when message is not encrypted', async () => {
		const user = userEvent.setup();
		render(PGPPage);

		const keyTextarea = screen.getByLabelText(/Public Key/i);
		await fireEvent.input(keyTextarea, { target: { value: validPrivateKey } });

		await screen.findByText('Private Key', { selector: 'fieldset-legend' });

		// Unlock
		const passwordInput = await screen.findByLabelText(/Unlock Private Key/i);
		const unlockButton = screen.getByRole('button', { name: /Unlock/i });
		await user.type(passwordInput, passphrase);
		await user.click(unlockButton);
		await waitFor(() => expect(unlockButton).not.toBeInTheDocument());

		// Input plaintext message
		const messageTextarea = screen.getByLabelText(/Input Message/i);

		await fireEvent.input(messageTextarea, { target: { value: 'Hello Signed World' } });

		// Should produce signed output
		const outputTextarea = screen.getByLabelText(/Signed Message/i);

		await waitFor(() => {
			const output = (outputTextarea as HTMLTextAreaElement).value;
			expect(output).toContain('-----BEGIN PGP SIGNED MESSAGE-----');
		});
	});

	it('verifies signed message with public key', async () => {
		//const user = userEvent.setup();
		render(PGPPage);

		// Create a signed message
		const privateKeyObj = await openpgp.readPrivateKey({ armoredKey: validPrivateKey });
		const decryptedPrivateKey = await openpgp.decryptKey({ privateKey: privateKeyObj, passphrase });
		const message = await openpgp.createCleartextMessage({ text: 'Verify Me' });
		const signedMessage = (await openpgp.sign({
			message,
			signingKeys: decryptedPrivateKey
		})) as string;

		const keyTextarea = screen.getByLabelText(/Public Key/i);
		await fireEvent.input(keyTextarea, { target: { value: validPublicKey } });

		// Input signed message
		const messageTextarea = screen.getByLabelText(/Input Message/i);
		await fireEvent.input(messageTextarea, { target: { value: signedMessage } });

		const io_fields = screen.getByTestId('io_fields');

		// Should show verification banner
		// We look for success text or class
		await waitFor(() => {
			expect(within(io_fields).getByText(/Signature Verified/i)).toBeInTheDocument();
		});
	});
});
