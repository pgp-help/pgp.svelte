import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { keyStore, KeyStore } from './keyStore.svelte';
import { generateKeyPair, getKeyDetails } from './pgp';

describe('KeyStore', () => {
	let privateKeyArmor: string;
	let publicKeyArmor: string;
	let otherKeyArmor: string;

	beforeAll(async () => {
		// Generate real keys for testing
		const key1 = await generateKeyPair('Test User', 'test@example.com');
		privateKeyArmor = key1.privateKey;
		publicKeyArmor = key1.publicKey;

		const key2 = await generateKeyPair('Other User', 'other@example.com');
		otherKeyArmor = key2.publicKey;
	});

	beforeEach(() => {
		keyStore.clear();
	});

	it('adds a key', async () => {
		const key = await getKeyDetails(publicKeyArmor);
		await keyStore.addKey(key);
		expect(keyStore.keys).toHaveLength(1);
		expect(keyStore.keys[0].getFingerprint()).toBe(key.getFingerprint());
	});

	it('prevents duplicates when adding same key twice', async () => {
		const key = await getKeyDetails(publicKeyArmor);
		await keyStore.addKey(key);
		await keyStore.addKey(key);
		expect(keyStore.keys).toHaveLength(1);
	});

	it('upgrades public key to private key', async () => {
		const pub = await getKeyDetails(publicKeyArmor);
		const priv = await getKeyDetails(privateKeyArmor);

		await keyStore.addKey(pub);
		expect(keyStore.keys[0].isPrivate()).toBe(false);

		await keyStore.addKey(priv);
		expect(keyStore.keys).toHaveLength(1);
		expect(keyStore.keys[0].isPrivate()).toBe(true);
	});

	it('ignores public key if private key exists', async () => {
		const pub = await getKeyDetails(publicKeyArmor);
		const priv = await getKeyDetails(privateKeyArmor);

		await keyStore.addKey(priv);
		expect(keyStore.keys[0].isPrivate()).toBe(true);

		await keyStore.addKey(pub);
		expect(keyStore.keys).toHaveLength(1);
		expect(keyStore.keys[0].isPrivate()).toBe(true);
	});

	it('handles multiple distinct keys', async () => {
		const k1 = await getKeyDetails(publicKeyArmor);
		const k2 = await getKeyDetails(otherKeyArmor);

		await keyStore.addKey(k1);
		await keyStore.addKey(k2);
		expect(keyStore.keys).toHaveLength(2);
	});

	it('deduplicates on load if storage is corrupted', async () => {
		// Manually corrupt storage to have duplicates
		const duplicates = [publicKeyArmor, publicKeyArmor];
		localStorage.setItem('pgp-keys-simple', JSON.stringify(duplicates));

		// Create a new KeyStore instance to trigger load()
		const newStore = new KeyStore();

		// Wait for async load
		await new Promise((resolve) => setTimeout(resolve, 50));

		expect(newStore.keys).toHaveLength(1);
		expect(newStore.keys[0].getFingerprint()).toBeDefined();
	});

	it('retrieves public key from private key when requested', async () => {
		const priv = await getKeyDetails(privateKeyArmor);
		await keyStore.addKey(priv);

		const fp = priv.getFingerprint();

		// Default behavior (returns private)
		const k1 = keyStore.getKey(fp);
		expect(k1?.isPrivate()).toBe(true);
		expect(k1?.getFingerprint()).toBe(fp);

		// Request public
		const k2 = keyStore.getKey(fp, 'public');
		expect(k2?.isPrivate()).toBe(false);
		expect(k2?.getFingerprint()).toBe(fp);

		// Request private (explicit)
		const k3 = keyStore.getKey(fp, 'private');
		expect(k3?.isPrivate()).toBe(true);
		expect(k3?.getFingerprint()).toBe(fp);
	});

	it('deletes a key', async () => {
		const key = await getKeyDetails(publicKeyArmor);
		await keyStore.addKey(key);
		expect(keyStore.keys).toHaveLength(1);

		keyStore.deleteKey(key.getFingerprint());
		expect(keyStore.keys).toHaveLength(0);
	});
});
