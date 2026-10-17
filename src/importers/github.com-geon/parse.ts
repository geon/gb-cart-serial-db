import { parse } from "csv-parse/sync";

// Codes from cartridges in geon's (https://github.com/geon) own collection that didn't match any other list.
export type GeonEntry = {
	/** As printed on the cartridge, e.g. "DMG-H3-UKV", "DMG-LBA". */
	serial: string;
	/** e.g. "Micro Machines", "Lemmings レミングス". */
	title: string;
};

const serialPattern = /^(?:DMG|CGB|AGB)-[A-Z0-9]{2,4}(?:-[A-Z]{3})?(?:-\d+)?$/;

export function parseGeonCsv(csv: string): GeonEntry[] {
	const [header, ...rows] = parse(csv) as string[][];
	if (header?.join() !== "serial,title") {
		throw new Error(`Unexpected columns: ${header?.join()}`);
	}
	return rows.map((values) => {
		const [serial, title] = values;
		if (!(
			values.length === 2 &&
			serial &&
			serialPattern.test(serial) &&
			title
		)) {
			throw new Error(`Unexpected row: ${values.join()}`);
		}
		return { serial, title };
	});
}
