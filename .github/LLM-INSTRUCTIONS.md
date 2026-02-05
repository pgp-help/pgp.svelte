# LLM Instructions for pgp-svelte-wsl

This document provides essential information for AI assistants to efficiently contribute to this project.

## Project Overview

**pgp.help** is a privacy-focused, client-side PGP encryption web application built with Svelte 5. All cryptographic operations happen locally in the browser with no external communication (enforced by CSP).

### Core Purpose

- Encrypt/decrypt messages using PGP
- Sign/verify messages
- Generate and manage PGP key pairs
- All operations are client-side only (no data leaves the browser)

## Technology Stack

- **Framework**: Svelte 5 with Runes (reactive state management)
- **Build Tool**: Vite (using rolldown-vite fork)
- **Language**: TypeScript (with JSDoc support)
- **Styling**: Tailwind CSS v4 + DaisyUI
- **Crypto Library**: OpenPGP.js v6.3.0
- **Testing**: Vitest + Testing Library
- **Code Quality**: ESLint, Prettier, Husky (pre-commit hooks)

## Project Structure

```
src/
├── App.svelte              # Root component (routing logic)
├── Layout.svelte           # Main layout wrapper
├── app.css                 # Tailwind v4 config + global styles
├── routes/
│   ├── router.svelte.ts    # Router using Svelte runes
│   ├── PGPPage.svelte      # Main PGP operations page
│   ├── Guide.svelte        # User guide/documentation
│   └── Test.svelte         # Test/demo page
├── lib/
│   ├── pgp/                # PGP core functionality
│   │   ├── pgp.ts          # OpenPGP.js wrapper functions
│   │   ├── keyStore.svelte.ts  # Reactive key storage (localStorage + memory)
│   │   ├── types.ts        # TypeScript type definitions
│   │   ├── PGPWorkflow.svelte  # Main encrypt/decrypt UI
│   │   ├── GenerateKey.svelte  # Key generation UI
│   │   ├── KeyList.svelte      # Display all keys
│   │   ├── PGPKey.svelte       # Single key component
│   │   └── ...             # Other PGP components
│   └── ui/                 # Reusable UI components
│       ├── CopyableTextarea.svelte
│       ├── MiniActionButton.svelte
│       └── icons/          # SVG icon components
└── assets/
    └── keys/               # Pre-bundled public keys (e.g., pgphelp.pem)
```

## Key Architecture Patterns

### 1. Svelte 5 Runes

This project uses **Svelte 5 runes** for state management:

- `$state` - reactive state
- `$derived` - computed values
- `$effect` - side effects
- `$props()` - component props

**Example:**

```typescript
class Router {
	#raw = $state({ path: '/', search: '' });
	activeRoute = $derived.by(() => {
		/* compute route */
	});
}
```

### 2. Key Storage (keyStore.svelte.ts)

The `KeyStore` class manages PGP keys with multiple persistence strategies:

**Persistence Types:**

- `LOCAL_STORAGE` - Persisted across sessions
- `MEMORY` - Session-only (not saved)
- `ASSET` - Pre-bundled keys from `/src/assets/keys/`
- `LEGACY` - Old format (openpgp-public-keys/private-keys)
- `DEFAULT` - Respects user's persistence preference

**Key Points:**

- Keys are deduplicated by fingerprint
- Private keys take precedence over public keys
- Asset keys are auto-loaded at startup
- Uses lazy loading pattern (`loadPromise`)

### 3. Routing (router.svelte.ts)

Custom router using Svelte runes and browser History API:

**Routes:**

- `/` - Home (Pages.HOME)
- `/Guide` - User guide (Pages.GUIDE)
- `/GenerateKey` - Key generation (variant of Home that generates a keypair)

**Query Params:**

- `?key=<armored_key>` - Import a key from URL
- `?fp=<fingerprint>` - Select a key by fingerprint

**Important:** Uses `BASE_PATH` for GitHub Pages deployment (supports sub-paths).

### 4. CSP (Content Security Policy)

The app has a **strict CSP** that blocks all external connections:

- Defined in `index.html` `<meta>` tag
- Relaxed in dev mode for Vite HMR (see `vite.config.ts`)
- Tests verify CSP compliance (`src/csp.test.ts`)

### 5. PGP Operations (pgp.ts)

Main wrapper around OpenPGP.js:

**Core Functions:**

- `getKeyDetails(armor: string): Promise<Key>` - Parse armored key
- `encryptMessage(message, publicKeys)` - Encrypt with public keys
- `decryptMessage(message, privateKey, passphrase)` - Decrypt
- `signMessage(message, privateKey, passphrase)` - Sign
- `verifyMessage(message, publicKeys)` - Verify signature

## Development Workflow

### Setup

```bash
npm install         # Install dependencies
npm run dev         # Start dev server (http://localhost:5173)
npm run build       # Production build
npm run preview     # Preview production build
```

### Testing

```bash
npm test            # Run all tests
npm run test -- --ui  # Interactive test UI
npm run lint        # ESLint + Prettier check
npm run format      # Auto-format code
```

### Pre-commit Hooks

Husky + lint-staged runs on commit:

- Prettier formatting
- ESLint checks
- Only staged files are checked

## Common Tasks

### Adding a New Route

1. Add to `Pages` enum in `router.svelte.ts`
2. Create component in `src/routes/`
3. Add conditional rendering in `App.svelte`
4. Update router logic if needed

### Adding a New Key

1. Place `.pem` file in `src/assets/keys/`
2. Keys are auto-loaded via Vite's `import.meta.glob`
3. They appear with `PersistenceType.ASSET`

### Adding PGP Functionality

1. Add low-level OpenPGP.js wrapper in `src/lib/pgp/pgp.ts`
2. Create Svelte component for UI in `src/lib/pgp/`
3. Add tests (`*.test.ts` file)
4. Integrate into `PGPWorkflow.svelte` or create new workflow

### Styling with Tailwind v4

- Main config is in `src/app.css` (CSS-based, not JS)
- Use DaisyUI component classes (e.g., `btn`, `card`, `badge`)
- Custom theme colors defined in `:root` CSS

## Testing Guidelines

### Test File Naming

- Co-located with source: `Component.svelte` → `Component.test.ts`
- Uses Vitest + Testing Library

### Test Setup

- Global setup in `src/setupTests.ts`
- Extends matchers with `@testing-library/jest-dom`
- Uses `happy-dom` for DOM environment

### Writing Tests

```typescript
import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import Component from './Component.svelte';

describe('Component', () => {
	it('should render', () => {
		render(Component);
		expect(screen.getByText('Hello')).toBeInTheDocument();
	});
});
```

## Important Notes

### DO:

- ✅ Use Svelte 5 runes (`$state`, `$derived`, `$effect`)
- ✅ ALWAYS include comments, even if they seem basic. If in doubt, over-explain.
- ✅ Write tests for new features
- ✅ Follow existing code style (Prettier handles this)
- ✅ Keep CSP strict (no external requests)
- ✅ Make components reactive and self-contained

### DON'T:

- ❌ Use Svelte 4 patterns (stores, `$:` reactive statements)
- ❌ Add external API calls or CDN dependencies
- ❌ Break CSP (tests will fail)
- ❌ Commit without running `npm run lint`
- ❌ Store sensitive data (all crypto is client-side)

## Debugging Tips

### Router Issues

- Check browser console for router logs
- Verify `BASE_PATH` is correct for deployment
- Use `sessionStorage.redirect` for 404 handling

### Key Storage Issues

- Check localStorage: `pgp-keys-simple`, `pgp-persist-default`
- Legacy keys in `openpgp-public-keys`, `openpgp-private-keys`
- Clear storage: `localStorage.clear()`

### CSP Errors

- Dev mode auto-relaxes CSP for HMR
- Production CSP is strict (see `index.html`)
- Use `npm run preview` to test production CSP

### Test Failures

- Run single test: `npm test -- Component.test.ts`
- Watch mode: `npm test -- --watch`
- Coverage: `npm test -- --coverage`

## Deployment

### GitHub Pages

- Uses `/.github/workflows/deploy.yml`
- Builds to `/pgp-svelte-wsl/` sub-path (BASE_URL)
- `404.html` handles client-side routing

### Build Configuration

- Source maps enabled in production
- Vite uses `rolldown-vite` fork (faster builds)
- MPA mode for separate 404.html page

## File Locations Quick Reference

| Need to...       | File                             |
| ---------------- | -------------------------------- |
| Add route        | `src/routes/router.svelte.ts`    |
| Modify layout    | `src/Layout.svelte`              |
| Change styles    | `src/app.css`                    |
| Add PGP function | `src/lib/pgp/pgp.ts`             |
| Manage keys      | `src/lib/pgp/keyStore.svelte.ts` |
| Update CSP       | `index.html`                     |
| Configure build  | `vite.config.ts`                 |
| Add dependencies | `package.json`                   |

## Getting Help

- **OpenPGP.js Docs**: https://openpgpjs.org/
- **Svelte 5 Docs**: https://svelte.dev/docs
- **DaisyUI Components**: https://daisyui.com/components/

## Code Style Examples

### Component Props (Svelte 5)

```typescript
interface Props {
	title: string;
	optional?: boolean;
}

let { title, optional = false }: Props = $props();
```

### Reactive State

```typescript
let count = $state(0);
let doubled = $derived(count * 2);

$effect(() => {
	console.log('Count changed:', count);
});
```

### Event Handlers

```typescript
<button onclick={() => count++}>Click</button>
```

---

**Last Updated**: 2026-01-18
**Project Version**: 0.0.0
**License**: MIT
