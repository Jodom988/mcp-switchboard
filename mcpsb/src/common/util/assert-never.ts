export function assertNever(_value: never): never {
	throw new Error('Value is expected to be never');
}
