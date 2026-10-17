import { loadSerialCorrections } from "../corrections.ts";

// Writes the corrections that haven't been reported yet, grouped by source, as text to send to each source.

const unreported = loadSerialCorrections().filter(
	({ reported }) => reported === null,
);
const sources = [...new Set(unreported.map(({ source }) => source))];

for (const source of sources) {
	const corrections = unreported.filter(
		(correction) => correction.source === source,
	);
	console.log(`# ${source}: ${corrections.length} serial corrections\n`);
	for (const {
		title,
		record,
		field,
		wrong,
		correct,
		reason,
		evidence,
	} of corrections) {
		const what =
			field === "romChipSerials" ? "ROM chip serial" : "Cartridge serial";
		console.log(`## ${title}\n`);
		console.log(`${record}\n`);
		console.log(
			correct === null
				? `Remove ${what.toLowerCase()} ${wrong}.`
				: `${what} ${wrong} should be ${correct}.`,
		);
		console.log(`\n${reason}\n`);
		const links = evidence.filter((url) => url !== record);
		if (links.length) {
			console.log(`Evidence:\n${links.map((url) => `- ${url}`).join("\n")}\n`);
		}
	}
}
