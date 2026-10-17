import { correctSerials, type Correction } from "../corrections.ts";
import { codeStem, parseLabelSerials } from "../serials.ts";
import type {
	NoIntroDat,
	NoIntroEntry,
} from "../importers/no-intro.org/parse.ts";
import type { GameBoyDatabaseComEntry } from "../importers/game-boy-database.com/parse.ts";
import type { SprintinglegsEntry } from "../importers/sprintinglegs/parse.ts";
import type { DmgpageEntry } from "../importers/dmgpage.com/parse.ts";
import type { GbhwdbCartridge } from "../importers/gbhwdb.gekkio.fi/parse.ts";
import type { GbxDumperEntry } from "../importers/github.com-mstroh76-GBxDumper/parse.ts";
import type { GeonEntry } from "../importers/github.com-geon/parse.ts";
import type {
	LibretroThumbnailsEntry,
	LibretroThumbnailsRepository,
} from "../importers/libretro-thumbnails/parse.ts";

export type Sources = {
	noIntro: readonly NoIntroEntry[];
	gameBoyDatabaseCom: readonly GameBoyDatabaseComEntry[];
	sprintinglegs: readonly SprintinglegsEntry[];
	dmgpage: readonly DmgpageEntry[];
	gbhwdb: readonly GbhwdbCartridge[];
	gbxDumper: readonly GbxDumperEntry[];
	geon: readonly GeonEntry[];
	libretroThumbnails: readonly LibretroThumbnailsEntry[];
};

// A link between two keys, and the source record that gives it.
export type Link = {
	from: string;
	to: string;
	source: string;
	record: string;
};

// Keys of the things being linked. A link to a stem (the product code without its region letter) is weaker evidence
// than the others, and is only followed when No-Intro doesn't contradict it.
export const keys = {
	record: (source: string, record: string) => `record:${source}:${record}`,
	crc32: (crc32: string) => `crc32:${crc32.toLowerCase()}`,
	romChip: (serial: string) => `rom-chip:${serial}`,
	romHeader: (dat: NoIntroDat, code: string) => `rom-header:${dat}:${code}`,
	labelSerial: (serial: string) => `label:${serial}`,
	code: (code: string) => `code:${code}`,
	stem: (stem: string) => `stem:${stem}`,
	noIntroName: (dat: NoIntroDat, name: string) =>
		`no-intro-name:${dat}:${libretroName(name)}`,
};

export function isStemKey(key: string): boolean {
	return key.startsWith("stem:");
}

const libretroDats: Record<LibretroThumbnailsRepository, NoIntroDat> = {
	"Nintendo_-_Game_Boy": "dmg",
	"Nintendo_-_Game_Boy_Color": "cgb",
	"Nintendo_-_Game_Boy_Advance": "agb",
};

// libretro-thumbnails file names replace these characters of the No-Intro name.
export function libretroName(noIntroName: string): string {
	return noIntroName.replace(/[&*/:`<>?\\|"]/g, "_");
}

const romChipPattern = /^((?:DMG|CGB|AGB|GBD)-([A-Z0-9]{2,5}))-(\d)$/;

// The code and stem of a ROM chip serial, e.g. "DMG-TRA" and "DMG-TR" for "DMG-TRA-1", or undefined if it isn't a Nintendo one.
export function romChipCode(
	serial: string,
): { code: string; stem: string } | undefined {
	const [, platformAndCode, code] = serial.match(romChipPattern) ?? [];
	return platformAndCode && code
		? {
				code: platformAndCode,
				stem: `${serial.slice(0, 3)}-${codeStem(code)}`,
			}
		: undefined;
}

// sprintinglegs lists ROM codes with the revision only when it isn't 0, e.g. "DMG-AWA", "DMG-MLA-1".
export function sprintinglegsRomChip(serial: string): string {
	return /-\d+$/.test(serial) ? serial : `${serial}-0`;
}

const headerCodePattern = /^[A-Z0-9]{3}[A-Z]$/;

export function sourceLinks(
	sources: Sources,
	corrections: readonly Correction[],
): Link[] {
	const link = (
		source: string,
		record: string,
		to: string,
		from = keys.record(source, record),
	): Link => ({ from, to, source, record });

	// serial -> code -> stem
	const codeLinks = (
		source: string,
		record: string,
		from: string,
		{ code, stem }: { code: string; stem: string },
	): Link[] => [
		link(source, record, keys.code(code), from),
		...(stem === code
			? []
			: [link(source, record, keys.stem(stem), keys.code(code))]),
	];

	const labelSerialLinks = (
		source: string,
		record: string,
		serials: readonly string[],
	): Link[] =>
		correctSerials(corrections, source, record, "cartridgeSerials", serials)
			.flatMap(parseLabelSerials)
			.flatMap((parsed) =>
				parsed.kind === "nintendo"
					? [
							link(source, record, keys.labelSerial(parsed.serial)),
							...codeLinks(
								source,
								record,
								keys.labelSerial(parsed.serial),
								parsed,
							),
						]
					: [],
			);

	const romChipLinks = (
		source: string,
		record: string,
		serials: readonly string[],
	): Link[] =>
		serials.flatMap((serial) => {
			const code = romChipCode(serial);
			return [
				link(source, record, keys.romChip(serial)),
				...(code ? codeLinks(source, record, keys.romChip(serial), code) : []),
			];
		});

	return [
		...sources.noIntro.flatMap((entry) => {
			const {
				url,
				dat,
				noIntroName,
				licensing,
				edition,
				cartridgeSerials,
				romChipSerials,
				romHeaderCodes,
				files,
			} = entry;
			const labels = correctSerials(
				corrections,
				"no-intro.org",
				url,
				"cartridgeSerials",
				cartridgeSerials,
			);
			return [
				link("no-intro.org", url, keys.noIntroName(dat, noIntroName)),
				...files.map(({ crc32 }) =>
					link("no-intro.org", url, keys.crc32(crc32)),
				),
				// Unlicensed and pirate cartridges often copy the serials of official releases, e.g. "Sonic 6 (USA) (Pirate)"
				// has Pokemon Gold's. Kiosk cartridges, e.g. the Pokemon distribution cartridges, reuse those of other games.
				// They are only linked by their ROM checksums.
				...(licensing === "licensed" && edition !== "Kiosk"
					? [
							...romChipLinks(
								"no-intro.org",
								url,
								correctSerials(
									corrections,
									"no-intro.org",
									url,
									"romChipSerials",
									romChipSerials,
								),
							),
							...labelSerialLinks("no-intro.org", url, cartridgeSerials),
							...romHeaderCodes
								// A few dumps have malformed header codes, e.g. "ANA5". When there are label serials, the
								// header code must agree with them, e.g. one Play-Yan dump has the header "AGSA" but the
								// label AGS-A-ZMAJ-JPN.
								.filter(
									(code) =>
										headerCodePattern.test(code) &&
										(!labels.length ||
											labels.some((label) => label.includes(code))),
								)
								.flatMap((code) => [
									link("no-intro.org", url, keys.romHeader(dat, code)),
									// Game Boy Advance cartridge serials contain the header code, e.g. AGB-AXPE-USA.
									...(dat === "agb"
										? codeLinks(
												"no-intro.org",
												url,
												keys.romHeader(dat, code),
												{
													code: `AGB-${code}`,
													stem: `AGB-${codeStem(code)}`,
												},
											)
										: []),
								]),
						]
					: []),
			];
		}),
		...sources.gameBoyDatabaseCom.flatMap(({ url, serial }) =>
			labelSerialLinks("game-boy-database.com", url, [serial]),
		),
		...sources.sprintinglegs.flatMap(({ url, serial }) =>
			romChipLinks("sprintinglegs", url, [sprintinglegsRomChip(serial)]),
		),
		...sources.dmgpage.flatMap(({ code }, index) =>
			labelSerialLinks("dmgpage.com", String(index), [code]),
		),
		...sources.gbhwdb.flatMap(
			({ url, romChipSerial, cartridgeSerial, crc32 }) => [
				...romChipLinks("gbhwdb.gekkio.fi", url, [romChipSerial]),
				...labelSerialLinks(
					"gbhwdb.gekkio.fi",
					url,
					cartridgeSerial ? [cartridgeSerial] : [],
				),
				...(crc32 ? [link("gbhwdb.gekkio.fi", url, keys.crc32(crc32))] : []),
			],
		),
		// GBxDumper's serials are built from the ROM header, so only its CRC32 is used.
		...sources.gbxDumper.map(({ crc32 }, index) =>
			link("github.com-mstroh76-GBxDumper", String(index), keys.crc32(crc32)),
		),
		...sources.geon.flatMap(({ serial }, index) =>
			labelSerialLinks("github.com-geon", String(index), [serial]),
		),
		...sources.libretroThumbnails.map(({ repository, name }) =>
			link(
				"libretro-thumbnails",
				`${repository}/${name}`,
				keys.noIntroName(libretroDats[repository], name),
			),
		),
	];
}
