import { describe, it, expect } from 'vitest';
import { ServiceProvider, SingletonBase } from './service-provider';

namespace TestServices {
	export class LeafService extends SingletonBase {
		public connected = false;

		constructor(sp: ServiceProvider) {
			super(sp);
			this.connected = true;
		}
	}

	export class ItermService extends SingletonBase {
		private readonly leaf: LeafService;

		constructor(sp: ServiceProvider) {
			super(sp);
			this.leaf = sp.resolveSingleton(LeafService);
		}
	}

	export class RootService extends SingletonBase {
		private readonly iterm: ItermService;
		private readonly leaf: LeafService;

		constructor(sp: ServiceProvider) {
			super(sp);
			this.iterm = sp.resolveSingleton(ItermService);
			this.leaf = sp.resolveSingleton(LeafService);
		}
	}
}

describe('ServiceProvider', () => {
	it('resolves a registered singleton', () => {
		const sp = new ServiceProvider();
		sp.registerSingleton(TestServices.LeafService);
		const leaf = sp.resolveSingleton(TestServices.LeafService);
		expect(leaf).toBeInstanceOf(TestServices.LeafService);
		expect(leaf.connected).toBe(true);
	});

	it('returns the same instance on repeated resolves', () => {
		const sp = new ServiceProvider();
		sp.registerSingleton(TestServices.LeafService);
		const a = sp.resolveSingleton(TestServices.LeafService);
		const b = sp.resolveSingleton(TestServices.LeafService);
		expect(a).toBe(b);
	});

	it('resolves transitive dependencies', () => {
		const sp = new ServiceProvider();
		sp.registerSingleton(TestServices.LeafService);
		sp.registerSingleton(TestServices.ItermService);
		const iterm = sp.resolveSingleton(TestServices.ItermService);
		expect(iterm).toBeInstanceOf(TestServices.ItermService);
	});

	it('shares the same instance across services', () => {
		const sp = new ServiceProvider();
		sp.registerSingleton(TestServices.LeafService);
		sp.registerSingleton(TestServices.ItermService);
		sp.registerSingleton(TestServices.RootService);
		const leaf = sp.resolveSingleton(TestServices.LeafService);
		const root = sp.resolveSingleton(TestServices.RootService);
		expect(root).toBeInstanceOf(TestServices.RootService);
		expect(root['leaf']).toBe(leaf);
	});

	it('uses a custom factory when provided', () => {
		const sp = new ServiceProvider();
		sp.registerSingleton(TestServices.LeafService, () => {
			const leaf = new TestServices.LeafService(sp);
			leaf.connected = false; // e.g. override for testing
			return leaf;
		});
		const leaf = sp.resolveSingleton(TestServices.LeafService);
		expect(leaf.connected).toBe(false);
	});

	it('throws when resolving an unregistered singleton', () => {
		const sp = new ServiceProvider();
		expect(() => sp.resolveSingleton(TestServices.LeafService)).toThrow(
			'LeafService has not been registered',
		);
	});
});
