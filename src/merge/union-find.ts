// Groups keys into connected sets, given links between pairs of keys.
export function connectedSets(
	links: readonly (readonly [string, string])[],
): Map<string, string> {
	const parents = new Map<string, string>();
	const find = (key: string): string => {
		const parent = parents.get(key) ?? key;
		if (parent === key) {
			return key;
		}
		const root = find(parent);
		parents.set(key, root);
		return root;
	};
	for (const [a, b] of links) {
		const rootA = find(a);
		const rootB = find(b);
		if (rootA !== rootB) {
			parents.set(rootA < rootB ? rootB : rootA, rootA < rootB ? rootA : rootB);
		}
	}
	// Key -> the smallest key in its set.
	return new Map(
		[...new Set(links.flat())].map((key) => [key, find(key)] as const),
	);
}

// Set -> its keys, from the result of connectedSets.
export function members(
	setOf: ReadonlyMap<string, string>,
): Map<string, string[]> {
	const sets = [...new Set(setOf.values())];
	const keysBySet = new Map<string, string[]>(sets.map((set) => [set, []]));
	for (const [key, set] of setOf) {
		keysBySet.get(set)!.push(key);
	}
	return keysBySet;
}
