import { parseLabelSerial } from "../serials.ts";
import type { Region, SourcedSerial } from "../release.ts";
import { regionLanguage } from "./languages.ts";

// What tells a release's regions and language: its label serials, and else its ROMs' No-Intro regions.
type ReleaseEvidence = {
	cartridgeSerials: readonly SourcedSerial[];
	/** No-Intro's regions of the release's ROMs, e.g. ["World"]. */
	romRegions: readonly string[];
};

// Regions of label serials, e.g. "USA" for DMG-TR-USA. Chinese, Asian and Brazilian releases have no dates in the lists.
const serialRegions: Record<string, Region> = {
	JPN: "Japan",
	USA: "North America",
	CAN: "North America",
	KOR: "Korea",
	AUS: "Australia",
	...Object.fromEntries(
		[
			...["EUR", "EUU", "EUB", "EURO", "UKV", "NOE", "FRG", "FRA", "FAH"],
			...["ESP", "SPA", "ESA", "ITA", "HOL", "SCN", "DAN", "GPS"],
			...["NEU5", "NEU6", "NEAI", "NUKV", "NNOE", "NFRA", "NFAH", "NESP"],
			...["NITA", "NHOL", "NHAU", "NFHU", "FHUG"],
		].map((region) => [region, "Europe"]),
	),
};

// Region letters of product codes, e.g. "J" for DMG-MQJ. See serials.ts.
const letterRegions: Record<string, Region> = {
	J: "Japan",
	A: "Japan",
	E: "North America",
	K: "Korea",
	U: "Australia",
	...Object.fromEntries(
		["P", "D", "F", "I", "S", "H", "X", "Y"].map((letter) => [
			letter,
			"Europe",
		]),
	),
};

const noIntroRegions: Record<string, readonly Region[]> = {
	Japan: ["Japan"],
	USA: ["North America"],
	Canada: ["North America"],
	Korea: ["Korea"],
	Australia: ["Australia"],
	World: ["Japan", "North America", "Europe"],
	...Object.fromEntries(
		[
			...["Europe", "Germany", "France", "Spain", "Italy", "Netherlands"],
			...["Sweden", "Denmark", "Greece", "United Kingdom"],
		].map((region) => [region, ["Europe"]]),
	),
};

// The regions a release was sold in, from its serials and product code, or else its ROMs: a ROM can be in several
// regions' releases, e.g. the "World" ROM of Tetris is in both DMG-TRA (Japan) and DMG-TR. Empty if nothing says.
export function releaseRegions(release: ReleaseEvidence): Region[] {
	const fromSerials = release.cartridgeSerials.flatMap(({ serial }) => {
		const parsed = parseLabelSerial(serial);
		if (parsed.kind !== "nintendo") {
			return [];
		}
		const byRegion =
			parsed.region === undefined ? undefined : serialRegions[parsed.region];
		const [, productCode] =
			parsed.code.match(/^[A-Z]{3}-([A-Z0-9]{3,4})$/) ?? [];
		const byLetter =
			productCode === undefined
				? undefined
				: letterRegions[productCode.at(-1)!];
		return [byRegion ?? byLetter ?? []].flat();
	});
	const fromRoms = release.romRegions.flatMap(
		(region) => noIntroRegions[region] ?? [],
	);
	return [...new Set(fromSerials.length ? fromSerials : fromRoms)];
}

// The language of a release sold in one language, by its serials' countries, e.g. "it" for DMG-APEI-ITA, "ja" for a
// release only sold in Japan, "zh" for the Chinese releases. Undefined for releases in several languages.
export function releaseLanguage(release: ReleaseEvidence): string | undefined {
	const serialLanguages = [
		...new Set(
			release.cartridgeSerials.flatMap(({ serial }) => {
				if (serial.endsWith(" CHN")) {
					return ["zh"];
				}
				const parsed = parseLabelSerial(serial);
				return parsed.kind === "nintendo"
					? [regionLanguage(parsed.region) ?? "several"]
					: [];
			}),
		),
	];
	const regions = releaseRegions(release);
	return serialLanguages.length === 1 && serialLanguages[0] !== "several"
		? serialLanguages[0]
		: regions.length === 1 && regions[0] === "Japan"
			? "ja"
			: regions.length === 1 && regions[0] === "Korea"
				? "ko"
				: undefined;
}
