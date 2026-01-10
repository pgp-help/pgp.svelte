/// <reference types="vitest/globals" />
import { render, screen, fireEvent } from '@testing-library/svelte';
import GenerateKey from './GenerateKey.svelte';
import { router } from '../router.svelte.js';
import { keyStore } from './keyStore.svelte.js';
import * as pgp from './pgp';

import type { Key } from 'openpgp';

// Mock dependencies
vi.mock('../router.svelte.js', () => ({
	router: {
		openHome: vi.fn(),
		openKey: vi.fn()
	}
}));

vi.mock('./keyStore.svelte.js', () => ({
	keyStore: {
		addKey: vi.fn()
	}
}));

vi.mock('./pgp', () => ({
	generateKeyPair: vi.fn(),
	getKeyDetails: vi.fn()
}));

vi.mock('./KeySidebar.svelte', () => ({
	default: vi.fn(() => ({ $$: {} }))
}));

describe('GenerateKey', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders the generation form', () => {
		render(GenerateKey);

		expect(screen.getByText('Generate New PGP Key')).toBeInTheDocument();
		expect(screen.getByLabelText('Name')).toBeInTheDocument();
		expect(screen.getByLabelText('Email')).toBeInTheDocument();
		expect(screen.getByLabelText(/Passphrase/)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Generate Key' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
	});

	it('generates key and navigates to key view on success', async () => {
		const mockKeyPair = {
			privateKey: 'mock-private-key',
			publicKey: 'mock-public-key',
			revocationCertificate: 'mock-rev-cert'
		};

		vi.mocked(pgp.generateKeyPair).mockResolvedValue(mockKeyPair);
		vi.mocked(pgp.getKeyDetails).mockResolvedValue({ getFingerprint: () => 'mock-fp' } as Key);

		render(GenerateKey);

		await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Test User' } });
		await fireEvent.input(screen.getByLabelText('Email'), {
			target: { value: 'test@example.com' }
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Generate Key' }));

		// Wait for async operations to complete
		await vi.waitFor(() => {
			expect(pgp.generateKeyPair).toHaveBeenCalledWith('Test User', 'test@example.com', '');
			expect(keyStore.addKey).toHaveBeenCalled();
			expect(router.openKey).toHaveBeenCalledWith('mock-fp');
		});
	});

	it('handles generation errors', async () => {
		vi.mocked(pgp.generateKeyPair).mockRejectedValue(new Error('Generation failed'));

		render(GenerateKey);

		await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'Test User' } });
		await fireEvent.input(screen.getByLabelText('Email'), {
			target: { value: 'test@example.com' }
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Generate Key' }));

		await screen.findByText('Generation failed');
	});

	it('navigates home when cancel is clicked', async () => {
		render(GenerateKey);

		await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

		expect(router.openHome).toHaveBeenCalled();
	});
});
