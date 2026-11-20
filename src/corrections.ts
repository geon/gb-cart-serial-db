import { readFileSync } from "node:fs";

// Hand-written corrections of serials in the sources, in raw-data-sources/corrections/.
export type Correction = {
	/** The source's name in data-sources/, e.g. "no-intro.org". */
	source: string;
	/** The URL of the corrected record. */
	record: string;
	/** For readability only. */
	title: string;
	/** Which list of serials in the record is corrected. */
	field: SerialField;
	/** Null to add `correct`, a serial the record lacks (raw-data-sources/corrections/added-serials.json). */
	wrong: string | null;
	/** Null to remove the serial. */
	correct: string | null;
	reason: string;
	/** URLs supporting the correction, other than the corrected record itself. */
	evidence: string[];
	/** When and where the correction was reported to the source, e.g. "2026-10-20 https://datomatic.no-intro.org/…". Null until reported. */
	reported: string | null;
};

export type SerialField = "cartridgeSerials" | "romChipSerials";

// A label serial a source's record lacks, e.g. one read on photos of the cartridge: added to the record's label serials.
export type AddedSerial = {
	/** The source's name in data-sources/, e.g. "no-intro.org". */
	source: string;
	/** The URL of the record it is added to. */
	record: string;
	/** For readability only. */
	title: string;
	serial: string;
	reason: string;
	/** URLs, or photos in the gameboy-labels repository as "gameboy-labels:<path>". */
	evidence: string[];
	/** As in Correction. */
	reported: string | null;
};

export function loadSerialCorrections(): Correction[] {
	const added = JSON.parse(
		readFileSync("raw-data-sources/corrections/added-serials.json", "utf-8"),
	) as AddedSerial[];
	const corrections = [
		...(JSON.parse(
			readFileSync("raw-data-sources/corrections/serials.json", "utf-8"),
		) as Correction[]),
		...added.map(({ serial, ...rest }): Correction => ({
			...rest,
			field: "cartridgeSerials",
			wrong: null,
			correct: serial,
		})),
	];
	for (const { record, evidence } of corrections) {
		if (evidence.includes(record)) {
			throw new Error(`The corrected record isn't evidence: ${record}`);
		}
	}
	return corrections;
}

export function correctSerials(
	corrections: readonly Correction[],
	source: string,
	record: string,
	field: SerialField,
	serials: readonly string[],
): string[] {
	const relevant = corrections.filter(
		(correction) =>
			correction.source === source &&
			correction.record === record &&
			correction.field === field,
	);
	return [
		...new Set([
			...serials.flatMap((serial) => {
				const correction = relevant.find(({ wrong }) => wrong === serial);
				return correction
					? correction.correct === null
						? []
						: [correction.correct]
					: [serial];
			}),
			// Added serials.
			...relevant.flatMap(({ wrong, correct }) =>
				wrong === null && correct !== null ? [correct] : [],
			),
		]),
	];
}

// Serials printed wrong on real labels, e.g. "DMT-DT-USA" on a run of DuckTales (USA) labels. Unlike a source's typo, they
// are kept as label serials of the release of the serial they should have been, so lookup by serial finds them.
export type MisprintedSerial = {
	/** As printed on the label. */
	serial: string;
	/** The serial it should have been, e.g. "DMG-DT-USA". */
	misprintOf: string;
	/** For readability only. */
	title: string;
	reason: string;
	/** URLs, or photos in the gameboy-labels repository as "gameboy-labels:<path>". */
	evidence: string[];
};

export function loadMisprintedSerials(): MisprintedSerial[] {
	return JSON.parse(
		readFileSync(
			"raw-data-sources/corrections/misprinted-serials.json",
			"utf-8",
		),
	) as MisprintedSerial[];
}

// Product code stems confirmed to be the same game, although No-Intro puts its games in different families.
export type SameGameStem = {
	stem: string;
	/** For readability only. */
	titles: string[];
	reason: string;
	evidence: string[];
};

export function loadSameGameStems(): SameGameStem[] {
	return JSON.parse(
		readFileSync("raw-data-sources/corrections/same-game-stems.json", "utf-8"),
	) as SameGameStem[];
}

// Product codes that aren't the same game as the rest of their stem, although nothing contradicts it, e.g. "DMG-MQJ".
export type SeparateCode = {
	code: string;
	/** For readability only. */
	titles: string[];
	reason: string;
	evidence: string[];
};

export function loadSeparateCodes(): SeparateCode[] {
	return JSON.parse(
		readFileSync("raw-data-sources/corrections/separate-codes.json", "utf-8"),
	) as SeparateCode[];
}
