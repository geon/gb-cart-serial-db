export function mapRecord<TKey extends string, TIn, TOut>(
	record: Readonly<Record<TKey, TIn>>,
	transform: (value: TIn, key: TKey) => TOut,
): Record<TKey, TOut> {
	return Object.fromEntries(
		Object.entries(record).map(([key, value]) => [
			key,
			transform(value as TIn, key as TKey),
		]),
	) as Readonly<Record<TKey, TOut>>;
}
