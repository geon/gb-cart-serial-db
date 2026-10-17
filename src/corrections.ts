import { readFileSync } from "node:fs";

// Hand-written corrections of serials in the sources, in raw-data-sources/corrections/.
export type Correction = {
	/** The source's name in data-sources/, e.g. "no-intro.org". */
	source: string;
	/** The URL of the corrected record. */
	record: string;
	/** For readability only. */
	title: string;
	wrong: string;
	/** Null to remove the serial. */
	correct: string | null;
	reason: string;
	/** URLs supporting the correction, starting with the corrected record. */
	evidence: string[];
	/** When and where the correction was reported to the source, e.g. "2026-10-20 https://datomatic.no-intro.org/…". Null until reported. */
	reported: string | null;
};

export function loadLabelSerialCorrections(): Correction[] {
	return JSON.parse(
		readFileSync("raw-data-sources/corrections/label-serials.json", "utf-8"),
	) as Correction[];
}

export function correctSerials(
	corrections: readonly Correction[],
	source: string,
	record: string,
	serials: readonly string[],
): string[] {
	const relevant = corrections.filter(
		(correction) =>
			correction.source === source && correction.record === record,
	);
	return [
		...new Set(
			serials.flatMap((serial) => {
				const correction = relevant.find(({ wrong }) => wrong === serial);
				return correction
					? correction.correct === null
						? []
						: [correction.correct]
					: [serial];
			}),
		),
	];
}
