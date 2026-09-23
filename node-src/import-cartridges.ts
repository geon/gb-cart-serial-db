import { writeFileSync } from "fs";
import { importNoIntro } from "./importers/import-no-intro.js";
import { importGbdb } from "./importers/import-gbdb.js";
import { importDe } from "./importers/import-de.js";
import { importGbhwdb } from "./importers/import-gbhwdb.js";
import { uniqueBy } from "./unique-by.js";
import { importGbxDumper } from "./importers/import-gbxDumper.js";
import { importSprintinglegs } from "./importers/import-sprintinglegs.js";

function main() {
	const cartridges = uniqueBy(
		[
			//
			...importNoIntro(),
			...importGbdb(),
			...importGbhwdb(),
			...importNoIntro(),
			...importDe(),
			...importGbxDumper(),
			...importSprintinglegs(),
		],
		(x) => x.code,
	);

	const jsonPath = "public/cartridges.json";
	writeFileSync(jsonPath, JSON.stringify(cartridges, null, "\t"));
}

main();
