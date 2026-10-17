import { parseLabelSerial } from "../serials.ts";
import { connectedSets, members } from "./union-find.ts";

// Assigns a game's records to its releases: the cartridges a collector tells apart, one per product code on the label,
// e.g. "DMG-TRA" (Japan) and "DMG-TR" (the rest of the world) for Tetris. The country and reprint serials of a code,
// e.g. DMG-TR-USA and DMG-TR-NOE-1, are variants of the same release.

export type ReleaseRecord = {
	/** Cleaned label serials. */
	cartridgeSerials?: readonly string[];
	romChipSerials?: readonly string[];
	/** For No-Intro records: a key of the ROM, and its regions. */
	rom?: { key: string; regions: readonly string[] };
	/** Unlicensed, pirate and kiosk cartridges reuse codes, e.g. Sachen's "4B-001" is on several multicarts, and a Pokemon distribution cartridge has GetBackers' AGB-AGBJ-JPN, so their releases are keyed by their ROM. */
	untrusted?: boolean;
};

// The release key of a label serial: its product code, e.g. "DMG-TR" for DMG-TR-USA-1, or another publisher's code as
// written, e.g. Sachen's "4B-002".
export function releaseCode(serial: string): string | undefined {
	// The GB Memory cartridge holds games written to it at kiosks; its serial isn't a release.
	if (serial === "DMG-MMSA-JPN") {
		return undefined;
	}
	const parsed = parseLabelSerial(serial);
	return parsed.kind === "nintendo"
		? parsed.code
		: parsed.kind === "other"
			? parsed.serial
			: undefined;
}

const isChinese = (code: string) => code.endsWith(" CHN");

// The region letter of a product code, e.g. "J" for DMG-MQJ, "A" for DMG-TRA, and undefined for 2 character codes like
// DMG-TR, which have none. See serials.ts.
function regionLetter(code: string): string | undefined {
	const [, productCode] = code.match(/^[A-Z]{3}-([A-Z0-9]{3,4})$/) ?? [];
	return productCode?.at(-1);
}

// Region letters of product codes that fit No-Intro's regions. Codes without a region letter are western.
const regionLetters: Record<string, readonly (string | undefined)[]> = {
	Japan: ["J", "A"],
	USA: ["E", undefined],
	Canada: ["E", undefined],
	Europe: ["P", "X", "Y", "D", "F", "S", "I", "H", "U", undefined],
	Germany: ["D", "P", undefined],
	France: ["F", "P", undefined],
	Spain: ["S", "P", undefined],
	Italy: ["I", "P", undefined],
	Netherlands: ["H", "P", undefined],
	Sweden: ["P", "X", undefined],
	Scandinavia: ["P", "X", undefined],
	Australia: ["U", "P", undefined],
	Korea: ["K"],
};

// The release keys of each record, in order. A ROM is in every release whose code is on its labels; other records are in
// one. Records are assigned to existing releases when the evidence allows, else they get a release of their own, keyed
// by their ROM or ROM chip code, or the given fallback key.
export function assignReleases(
	records: readonly ReleaseRecord[],
	fallbackKey: string,
): {
	recordReleases: string[][];
	/** The release of a label serial, e.g. "DMG-TR" for both DMG-TR-USA and DMG-104 CHN. */
	serialRelease: (serial: string) => string | undefined;
} {
	const codesOf = (record: ReleaseRecord) =>
		record.untrusted
			? []
			: [
					...new Set(
						(record.cartridgeSerials ?? []).flatMap(
							(serial) => releaseCode(serial) ?? [],
						),
					),
				];

	// Chinese releases join the release they share a ROM with, preferably a western one, e.g. DMG-104 CHN with DMG-TR.
	const codeLinks = records.flatMap((record) => {
		const codes = codesOf(record);
		const others = codes
			.filter((code) => !isChinese(code))
			.sort(
				(a, b) =>
					Number(["J", "A"].includes(regionLetter(a) ?? "")) -
						Number(["J", "A"].includes(regionLetter(b) ?? "")) ||
					a.localeCompare(b),
			);
		return [
			...codes.map((code) => [code, code] as const),
			...(record.rom && others[0]
				? codes.filter(isChinese).map((code) => [code, others[0]!] as const)
				: []),
		];
	});
	const groupOfCode = connectedSets(codeLinks);
	const groups = members(groupOfCode);
	// A group's key: its non Chinese code, if any.
	const groupKey = new Map(
		[...groups].map(([group, codes]) => [
			group,
			[...codes].sort(
				(a, b) =>
					Number(isChinese(a)) - Number(isChinese(b)) || a.localeCompare(b),
			)[0]!,
		]),
	);
	const keyOfCode = (code: string) => groupKey.get(groupOfCode.get(code)!)!;
	const keys = [...new Set(groupKey.values())];

	const byRegion = (regions: readonly string[]) =>
		keys.filter((key) =>
			regions.some((region) =>
				(regionLetters[region] ?? []).includes(regionLetter(key)),
			),
		);

	// No-Intro ROMs first, so that ROM chip serials can follow them.
	const romKeys = records.map((record) => {
		if (!record.rom) {
			return undefined;
		}
		const codes = codesOf(record);
		if (codes.length) {
			return codes.map(keyOfCode);
		}
		// The release of each of its regions, e.g. DMG-HTA and DMG-HT for Hatris (Japan, USA), unless a region has several.
		const perRegion = record.rom.regions.map((region) => byRegion([region]));
		const keys = [...new Set(perRegion.flat())];
		return keys.length && perRegion.every((keys) => keys.length <= 1)
			? keys
			: [record.rom.key];
	});

	const recordReleases = records.map((record, index): string[] => {
		const romKey = romKeys[index];
		if (romKey) {
			return [...new Set(romKey)];
		}
		const codes = codesOf(record);
		if (codes.length) {
			return [keyOfCode(codes[0]!)];
		}
		const chips = record.romChipSerials ?? [];
		const sameRom = records.findIndex(
			(other, otherIndex) =>
				romKeys[otherIndex] &&
				other.romChipSerials?.some((chip) => chips.includes(chip)),
		);
		if (sameRom !== -1) {
			return [romKeys[sameRom]![0]!];
		}
		// e.g. "DMG-TRA" for the ROM chip DMG-TRA-1.
		const chipCodes = chips.map((chip) => chip.replace(/-\d$/, ""));
		const sameCode = keys.find((key) => chipCodes.includes(key));
		if (sameCode) {
			return [sameCode];
		}
		// The same region letter, e.g. DMG-AFJ-0 for DMG-AFJ, or else a western chip, e.g. DMG-MQE-1, for the western
		// release without region letter, e.g. DMG-MQ.
		const chipLetters = chipCodes
			.map(regionLetter)
			.filter((letter) => letter !== undefined);
		const sameRegion = keys.filter((key) =>
			chipLetters.includes(regionLetter(key) ?? ""),
		);
		const western = chipLetters.some((letter) => letter !== "J")
			? keys.filter((key) => regionLetter(key) === undefined)
			: [];
		const byRegion = sameRegion.length ? sameRegion : western;
		if (byRegion.length === 1) {
			return [byRegion[0]!];
		}
		if (keys.length === 1) {
			return [keys[0]!];
		}
		return [chipCodes[0] ?? fallbackKey];
	});

	return {
		recordReleases,
		serialRelease: (serial) => {
			const code = releaseCode(serial);
			return code !== undefined && groupOfCode.has(code)
				? keyOfCode(code)
				: undefined;
		},
	};
}
