import { writeFileSync } from "fs";
import { importNoIntro } from "./importers/import-no-intro.js";
import { importGbdb } from "./importers/import-gbdb.js";
import { importDe } from "./importers/import-de.js";
import { importGbhwdb } from "./importers/import-gbhwdb.js";
import { importGbxDumper } from "./importers/import-gbxDumper.js";
import { importSprintinglegs } from "./importers/import-sprintinglegs.js";
import { groupBy } from "./group-by.js";
import { uniqueBy } from "./unique-by.js";
import { mapRecord } from "./map-record.js";
import { importGeon } from "./importers/import-geon.js";

function main() {
	const importers = {
		importNoIntro,
		importGbdb,
		importGbhwdb,
		importDe,
		importGbxDumper,
		importSprintinglegs,
		importGeon,
	};

	const cartsByImporter = mapRecord(importers, (x) => x());

	const cartridges = Object.entries(
		groupBy(Object.values(cartsByImporter).flat(), (x) => x.code),
	).map(([code, group]) => ({
		code,
		titles: uniqueBy(
			group.map((x) => x.title),
			(x) => x,
		),
	}));

	const jsonPath = "public/cartridges.json";
	writeFileSync(jsonPath, JSON.stringify(cartridges, null, "\t"));

	const htmlPath = "public/cartridges.html";
	writeFileSync(
		htmlPath,
		`<html>
			<table>
				<td>Serial</td>
				<td>Titles</td>
				${cartridges
					.map(
						(cartridge) => `
							<tr>
								<td>${cartridge.code}</td>
								<td>${cartridge.titles.join("<br/>")}</td>
							</tr>`,
					)
					.join("\n")}
			<table>
		</html>`,
	);

	const serialsBySource = mapRecord(
		cartsByImporter,
		(carts) => new Set(carts.map((cart) => cart.code)),
	);

	const numSerialsBySource = mapRecord(serialsBySource, (x) => x.size);

	const numUniqueSerialsBySource = mapRecord(
		serialsBySource,
		(serials, sourceName) =>
			difference(
				serials,
				union(Object.values({ ...serialsBySource, [sourceName]: new Set() })),
			).size,
	);

	const numUniqueSerials = union(Object.values(serialsBySource)).size;

	console.log("numCartsByImporter", numSerialsBySource);
	console.log("numUniqueSerialsBySource", numUniqueSerialsBySource);
	console.log("numUniqueSerials", numUniqueSerials);
}

function union<T>(sets: readonly ReadonlySet<T>[]): Set<T> {
	const _union = new Set<T>();
	for (const set of sets) {
		for (const elem of set) {
			_union.add(elem);
		}
	}
	return _union;
}

// function intersection(setA, setB) {
//   const _intersection = new Set();
//   for (const elem of setB) {
//     if (setA.has(elem)) {
//       _intersection.add(elem);
//     }
//   }
//   return _intersection;
// }

function difference<T>(setA: ReadonlySet<T>, setB: ReadonlySet<T>): Set<T> {
	const _difference = new Set(setA);
	for (const elem of setB) {
		_difference.delete(elem);
	}
	return _difference;
}

main();
