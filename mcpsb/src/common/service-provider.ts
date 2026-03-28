type SingletonCtor<T extends SingletonBase> = new (sp: ServiceProvider) => T;

export abstract class SingletonBase {
	public constructor(serviceProvider: ServiceProvider) {}
}

export class ServiceProvider {
	private instances = new Map<SingletonCtor<SingletonBase>, SingletonBase>();
	private factories = new Map<
		SingletonCtor<SingletonBase>,
		(sp: ServiceProvider) => SingletonBase
	>();

	public registerSingleton<T extends SingletonBase>(
		ctor: SingletonCtor<T>,
		factory?: (sp: ServiceProvider) => T,
	): void {
		this.factories.set(ctor, factory ?? (sp => new ctor(sp)));
	}

	public resolveSingleton<T extends SingletonBase>(ctor: SingletonCtor<T>): T {
		if (!this.instances.has(ctor)) {
			const factory = this.factories.get(ctor);
			if (!factory) {
				throw new Error(`${ctor.name} has not been registered`);
			}
			this.instances.set(ctor, factory(this));
		}
		return this.instances.get(ctor) as T;
	}
}
