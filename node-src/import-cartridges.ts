import { writeFileSync } from "fs";
import { importNoIntro } from "./importers/import-no-intro.js";
import { importGbdb } from "./importers/import-gbdb.js";
import { importDe } from "./importers/import-de.js";

export function uniqueBy<T>(
	array: readonly T[],
	keySelector: (element: T) => string | number,
): T[] {
	const seen = new Set();
	return array.filter((element) => {
		const key = keySelector(element);
		const unseen = !seen.has(key);
		seen.add(key);
		return unseen;
	});
}

function main() {
	const cartridges = uniqueBy(
		[
			//
			...importNoIntro(),
			...importGbdb(),
			...importNoIntro(),
			...importDe(),
		],
		(x) => x.code,
	);

	const jsonPath = "public/cartridges.json";
	writeFileSync(jsonPath, JSON.stringify(cartridges, null, "\t"));
}

main();
