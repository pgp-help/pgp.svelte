import '@testing-library/jest-dom';

/**
 * Mock the Web Animations API for Svelte transitions
 *
 * JSDOM (used by Vitest for DOM testing) doesn't implement the Web Animations API,
 * specifically the Element.prototype.animate() method. However, Svelte 5 uses this
 * API internally for transitions and animations. When Svelte components with transitions
 * are rendered in tests, they attempt to call element.animate() which throws:
 * "TypeError: element.animate is not a function"
 *
 * This mock provides a minimal implementation that:
 * - Returns an object with the expected properties (onfinish, cancel, finish)
 * - Prevents the TypeError from being thrown
 * - Allows Svelte transitions to complete without errors in the test environment
 *
 * Without this mock, any Svelte component using transitions (like fade, slide, etc.)
 * would cause unhandled errors during testing, even if the transitions themselves
 * aren't being tested.
 */
Object.defineProperty(Element.prototype, 'animate', {
	value: function () {
		return {
			onfinish: null,
			cancel: () => {},
			finish: () => {}
		};
	},
	writable: true
});
