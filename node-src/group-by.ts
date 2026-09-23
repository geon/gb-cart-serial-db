type OneOrMore<T> = readonly [T, ...ReadonlyArray<T>];
type MutableOneOrMore<T> = [T, ...Array<T>];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Grouped<Key extends keyof any, Value> = Record<
	Key,
	OneOrMore<Value>
>;
export function groupBy<Key extends string | number, Value>(
	items: ReadonlyArray<Value>,
	keySelector: (item: Value) => Key,
): Grouped<Key, Value> {
	const grouped: Partial<Record<Key, MutableOneOrMore<Value>>> = {};
	for (const item of items) {
		const key = keySelector(item);
		const value = item;
		const keyItems = grouped[key];
		if (!keyItems) {
			grouped[key] = [value];
		} else {
			keyItems.push(value);
		}
	}
	return grouped as ReturnType<typeof groupBy<Key, Value>>;
}
