import type { Correction } from "../corrections.ts";
import { correctSerials } from "../corrections.ts";
import { parseLabelSerial, parseLabelSerials } from "../serials.ts";
import type { NoIntroDat } from "../importers/no-intro.org/parse.ts";
import type { GbhwdbDate } from "../importers/gbhwdb.gekkio.fi/parse.ts";
import { connectedSets, members } from "./union-find.ts";
import { assignReleases } from "./releases.ts";
import {
	dmgpageLanguage,
	languageTags,
	noIntroLanguage,
	regionLanguage,
	sprintinglegsLanguage,
	nonLatinScript,
	titleLanguage,
} from "./languages.ts";
import {
	keys,
	libretroName,
	romChipCode,
	sprintinglegsRomChip,
	type Sources,
} from "./links.ts";

// A release: a cartridge as a collector tells them apart, one per product code on the label, e.g. "DMG-TRA" (Japan) and
// "DMG-TR" (the rest of the world) for Tetris. Its country and reprint serials, e.g. DMG-TR-USA and DMG-TR-NOE-1, are
// variants of it. See releases.ts.
export type Release = {
	/** The product code, e.g. "DMG-TR", or for releases without one, the ROM, e.g. "dmg-1383", or a ROM chip code. */
	id: string;
	/** Releases of the same game, in other regions and languages, have the same gameId: the game's most common product code, e.g. "DMG-TR". */
	gameId: string;
	/** Releases of related games, e.g. reskins like Mickey Mouse and Bugs Bunny Crazy Castle, have the same familyId: the smallest gameId of the family. From No-Intro's parent/clone groups. */
	familyId: string;
	title: string;
	/** From No-Intro: "unlicensed", e.g. Sachen, or "pirate", e.g. bootlegs. Omitted for licensed releases, and for releases not in No-Intro, which the other sources list as official. */
	licensing?: "unlicensed" | "pirate";
	/** The cartridge's system, as in Nintendo's serials: "dmg" fits all Game Boys, "cgb" only the Game Boy Color and Advance, "agb" only the Advance. From No-Intro, or else the serials, or else the sprintinglegs list. */
	system?: GameSystem;
	/** Every title in the sources, with its languages, if any source says, and the sources using it. See languages.ts. */
	titles: Title[];
	/** Serials printed on cartridge labels, e.g. "DMG-TR-USA-1". */
	cartridgeSerials: { serial: string; sources: string[] }[];
	/** The ROMs in No-Intro, e.g. both revisions of the Japanese Tetris. */
	roms: Rom[];
	/** Codes printed on ROM chips, e.g. "DMG-TRA-1". */
	romChipSerials: string[];
	/** Front of the box, from game-boy-database.com. */
	boxImageUrls: string[];
	/** Photos of the front of documented cartridges, from gbhwdb.gekkio.fi. */
	cartridgePhotoUrls: string[];
	/** The earliest manufacturing date printed on a documented cartridge's board or ROM chip, from gbhwdb.gekkio.fi. The release is on or after it. */
	earliestManufacturingDate?: GbhwdbDate;
	/** From Wikipedia's lists of games: the year the release came out in its regions, or else the game's first year, e.g. 1989 for the Japanese Tetris and 1990 for the European. See wikipedia.ts. */
	releaseYear?: number;
	/** The source records of the release. The label tells records from the same source apart, e.g. their serial. */
	links: { source: string; url: string; label: string }[];
};

export type Title = {
	title: string;
	/** e.g. ["en"], ["ja"], ["ja-Latn"], ["ja-x-translated"]. Empty if no source says. */
	languages: string[];
	sources: string[];
};

export type GameSystem = "dmg" | "cgb" | "agb";

export type Rom = {
	/** DAT-o-MATIC record page. */
	url: string;
	/** A Game Boy cartridge with Game Boy Color enhancements, e.g. the black cartridges. */
	gameBoyColorEnhanced?: true;
	superGameBoyEnhanced?: true;
	/** From No-Intro, e.g. "Rev 1", "v1.1". Omitted for the first release. */
	revision?: string;
	regions: string[];
	languages: string[];
	crc32s: string[];
	cartridgeSerials: string[];
	romChipSerials: string[];
	boxArtUrl?: string;
	titleScreenshotUrl?: string;
	gameplayScreenshotUrl?: string;
};

// What is known about a source record, tagged with its game.
type SourceRecord = {
	game: string | undefined;
	source: string;
	url?: string;
	label: string;
	titles: { title: string; language?: string }[];
	/** Lower is preferred for the game's title. */
	titlePreference: number;
	rom?: Rom;
	/** For No-Intro records: a key of the ROM, e.g. "dmg-1383", and its regions. */
	romKey?: { key: string; regions: readonly string[] };
	/** For No-Intro records: the parent/clone group. */
	family?: string;
	/** Unlicensed, pirate and kiosk cartridges, whose serials can't be trusted to identify a release. */
	untrusted?: true;
	system?: GameSystem;
	/** The system of the list a source has the record in. */
	listedSystem?: GameSystem;
	licensing?: "licensed" | "unlicensed" | "pirate";
	cartridgeSerials?: string[];
	romChipSerials?: string[];
	boxImageUrl?: string;
	cartridgePhotoUrl?: string;
	dates?: GbhwdbDate[];
};

// The No-Intro region an entry is preferred for as the game's title, best first.
const titleRegions = ["World", "USA", "Europe", "Japan"];

export function buildReleases(
	sources: Sources,
	corrections: readonly Correction[],
	gameOf: ReadonlyMap<string, string>,
): Release[] {
	const gameOfRecord = (source: string, record: string) =>
		gameOf.get(keys.record(source, record));

	const libretro = new Map(
		sources.libretroThumbnails.map((entry) => [
			`${entry.repository}/${entry.name}`,
			entry,
		]),
	);
	const libretroRepositories: Record<NoIntroDat, string> = {
		dmg: "Nintendo_-_Game_Boy",
		cgb: "Nintendo_-_Game_Boy_Color",
		agb: "Nintendo_-_Game_Boy_Advance",
	};

	// Corrected and normalized, with other publishers' codes as written, e.g. Sachen's "4B-002", and without rejected values.
	const labelSerials = (
		source: string,
		record: string,
		serials: readonly string[],
	) =>
		correctSerials(corrections, source, record, "cartridgeSerials", serials)
			.flatMap(parseLabelSerials)
			.flatMap((parsed) => (parsed.kind === "rejected" ? [] : [parsed.serial]));
	const romChipSerials = (
		source: string,
		record: string,
		serials: readonly string[],
	) => correctSerials(corrections, source, record, "romChipSerials", serials);

	const records: SourceRecord[] = [
		...sources.noIntro.map((entry) => ({
			game: gameOfRecord("no-intro.org", entry.url),
			source: "no-intro.org",
			url: entry.url,
			label: entry.noIntroName,
			titles: [
				titleIn(entry.title, noIntroLanguage(entry.regions, entry.languages)),
			],
			titlePreference:
				(entry.parentUrl === undefined ? 0 : 10) +
				Math.min(
					...entry.regions.map((region) =>
						titleRegions.includes(region) ? titleRegions.indexOf(region) : 5,
					),
				),
			rom: noIntroRom(
				entry,
				labelSerials("no-intro.org", entry.url, entry.cartridgeSerials),
				romChipSerials("no-intro.org", entry.url, entry.romChipSerials),
				libretro.get(
					`${libretroRepositories[entry.dat]}/${libretroName(entry.noIntroName)}`,
				),
			),
			romKey: {
				key: `${entry.dat}-${new URL(entry.url).searchParams.get("n")}`,
				regions: entry.regions,
			},
			family: entry.parentUrl ?? entry.url,
			...((entry.licensing !== "licensed" || entry.edition === "Kiosk") && {
				untrusted: true,
			}),
			system: noIntroSystem(entry),
			licensing: entry.licensing,
			cartridgeSerials: labelSerials(
				"no-intro.org",
				entry.url,
				entry.cartridgeSerials,
			),
			romChipSerials: romChipSerials(
				"no-intro.org",
				entry.url,
				entry.romChipSerials,
			),
		})),
		...sources.gameBoyDatabaseCom.map((entry) => ({
			game: gameOfRecord("game-boy-database.com", entry.url),
			source: "game-boy-database.com",
			url: entry.url,
			label: entry.serial,
			titles: [
				titleIn(entry.title, regionLanguage(serialRegion(entry.serial))),
			],
			titlePreference: 20,
			cartridgeSerials: labelSerials("game-boy-database.com", entry.url, [
				entry.serial,
			]),
			boxImageUrl: entry.boxImageUrl,
		})),
		...sources.sprintinglegs.map((entry) => ({
			game: gameOfRecord("sprintinglegs", entry.url),
			source: "sprintinglegs",
			url: entry.url,
			label: entry.serial,
			titles: [
				// sprintinglegs' language is the language of the game's text. Its titles are often in English for
				// every region, e.g. "102 DALMATIANS" for the German, French and Spanish releases, so titles in Latin
				// letters aren't tagged by it. It does tell kanji-only titles, e.g. "役満", apart from Chinese ones.
				titleIn(
					entry.title,
					nonLatinScript.test(entry.title)
						? sprintinglegsLanguage(entry.language)
						: undefined,
				),
				...(entry.translatedTitle === undefined
					? []
					: [
							{
								title: entry.translatedTitle,
								language: translated(
									titleLanguage(entry.title, undefined)?.replace(
										/-Latn$/,
										"",
									) ?? sprintinglegsLanguage(entry.language),
								),
							},
						]),
			],
			titlePreference: 30,
			// Only a last resort for the system: the Game Boy list also has the Game Boy Color enhanced cartridges.
			listedSystem: entry.list,
			romChipSerials: romChipCode(sprintinglegsRomChip(entry.serial))
				? [sprintinglegsRomChip(entry.serial)]
				: [],
		})),
		...sources.dmgpage.map((entry, index) => ({
			game: gameOfRecord("dmgpage.com", String(index)),
			source: "dmgpage.com",
			// The entries are lines in one blog post.
			url: "https://dmgpage.com/2014/11/28/dmg-codes-spielanleitungenmodule/",
			label: entry.code,
			titles: [titleIn(entry.title, dmgpageLanguage(entry.regions))],
			titlePreference: 40,
			cartridgeSerials: labelSerials("dmgpage.com", String(index), [
				entry.code,
			]),
		})),
		...sources.gbhwdb.map((entry) => ({
			game: gameOfRecord("gbhwdb.gekkio.fi", entry.url),
			source: "gbhwdb.gekkio.fi",
			url: entry.url,
			label: entry.cartridgeSerial ?? entry.romChipSerial,
			titles: [{ title: entry.noIntroName.replace(/ \(.*$/, "") }],
			titlePreference: 50,
			cartridgeSerials: entry.cartridgeSerial
				? labelSerials("gbhwdb.gekkio.fi", entry.url, [entry.cartridgeSerial])
				: [],
			romChipSerials: [entry.romChipSerial],
			cartridgePhotoUrl: gbhwdbPhotoUrl(entry.url),
			dates: [entry.boardDate, entry.romChipDate].filter(
				(date) => date !== undefined,
			),
		})),
		...sources.geon.map((entry, index) => ({
			game: gameOfRecord("github.com-geon", String(index)),
			source: "github.com-geon",
			label: entry.serial,
			titles: [{ title: entry.title }],
			titlePreference: 60,
			cartridgeSerials: labelSerials("github.com-geon", String(index), [
				entry.serial,
			]),
		})),
	];

	const recordsByGame = members(
		new Map(
			records.flatMap((record, index) =>
				record.game === undefined
					? []
					: [[String(index), record.game] as const],
			),
		),
	);
	const codesByGame = members(
		new Map(
			[...gameOf]
				.filter(([key]) => key.startsWith("code:"))
				.map(([key, game]) => [key.slice("code:".length), game] as const),
		),
	);
	const crc32sByGame = members(
		new Map(
			[...gameOf]
				.filter(([key]) => key.startsWith("crc32:"))
				.map(([key, game]) => [key.slice("crc32:".length), game] as const),
		),
	);

	const games = [...recordsByGame].map(([game, indices]) => {
		const gameRecords = indices.map((index) => records[Number(index)]!);
		return { game, gameRecords, id: gameId(game, gameRecords) };
	});

	// The game's most common product code on cartridge labels and ROM chips, or else a ROM checksum, or else a source's URL.
	function gameId(game: string, gameRecords: readonly SourceRecord[]): string {
		const serials = gameRecords.flatMap((record) => [
			...(record.cartridgeSerials ?? []),
			...(record.romChipSerials ?? []),
		]);
		const mostCommonCode = (codesByGame.get(game) ?? [])
			.map((code) => ({
				code,
				count: serials.filter(
					(serial) => serial === code || serial.startsWith(`${code}-`),
				).length,
			}))
			.sort(
				(a, b) => b.count - a.count || a.code.localeCompare(b.code),
			)[0]?.code;
		return (
			mostCommonCode ??
			(crc32sByGame.has(game)
				? `crc32:${crc32sByGame.get(game)!.sort()[0]}`
				: // No code or ROM checksum, e.g. a No-Intro entry without a dump, or an e-Reader.
					[...gameRecords]
						.sort((a, b) => a.titlePreference - b.titlePreference)
						.find(({ url }) => url)!.url!)
		);
	}

	// Games are related through No-Intro's parent/clone groups.
	const familyOfGame = connectedSets(
		games.flatMap(({ id, gameRecords }) => [
			[`game:${id}`, `game:${id}`] as const,
			...gameRecords.flatMap(({ family }) =>
				family ? [[`game:${id}`, `family:${family}`] as const] : [],
			),
		]),
	);
	const familyMembers = members(familyOfGame);
	const familyIdOf = (gameId: string) =>
		(familyMembers.get(familyOfGame.get(`game:${gameId}`)!) ?? [])
			.filter((key) => key.startsWith("game:"))
			.map((key) => key.slice("game:".length))
			.sort()[0]!;

	return games
		.flatMap(({ id: gameId, gameRecords }) => {
			const { recordReleases, serialRelease } = assignReleases(
				gameRecords.map(
					({ cartridgeSerials, romChipSerials, romKey, untrusted }) => ({
						cartridgeSerials,
						romChipSerials,
						...(romKey && { rom: romKey }),
						...(untrusted && { untrusted }),
					}),
				),
				gameId,
			);
			const releaseIds = [...new Set(recordReleases.flat())];
			return releaseIds.map((releaseId) =>
				buildRelease(
					releaseId,
					gameId,
					familyIdOf(gameId),
					gameRecords.filter((_, index) =>
						recordReleases[index]!.includes(releaseId),
					),
					serialRelease,
				),
			);
		})
		.sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
}

function buildRelease(
	id: string,
	gameId: string,
	familyId: string,
	releaseRecords: readonly SourceRecord[],
	serialRelease: (serial: string) => string | undefined,
): Release {
	const byPreference = [...releaseRecords].sort(
		(a, b) => a.titlePreference - b.titlePreference,
	);
	const titles = mergeTitles(
		byPreference.flatMap(({ source, titles }) =>
			titles.map((title) => ({ ...title, source })),
		),
	);
	// A ROM in several releases, e.g. Tetris Rev 1 under DMG-TR and DMG-TRA, only brings the serials of this release.
	const serialsOf = (record: SourceRecord) =>
		(record.cartridgeSerials ?? []).filter(
			(serial) => !record.rom || serialRelease(serial) === id,
		);
	const serials = [...new Set(releaseRecords.flatMap(serialsOf))].sort();
	const dates = releaseRecords.flatMap((record) => record.dates ?? []);
	const earliest = dates.sort(compareDates)[0];
	const licensings = new Set(releaseRecords.map(({ licensing }) => licensing));
	const licensing = licensings.has("pirate")
		? "pirate"
		: licensings.has("unlicensed")
			? "unlicensed"
			: undefined;
	const system =
		mostCommon(releaseRecords.flatMap((record) => record.system ?? [])) ??
		mostCommon(
			releaseRecords
				.flatMap((record) => [
					...(record.cartridgeSerials ?? []),
					...(record.romChipSerials ?? []),
				])
				.flatMap((serial) => serialSystems[serial.slice(0, 3)] ?? []),
		) ??
		mostCommon(releaseRecords.flatMap((record) => record.listedSystem ?? []));

	return {
		id,
		gameId,
		familyId,
		title: titles[0]!.title,
		...(licensing && { licensing }),
		...(system && { system }),
		titles,
		cartridgeSerials: serials.map((serial) => ({
			serial,
			sources: [
				...new Set(
					releaseRecords
						.filter((record) => serialsOf(record).includes(serial))
						.map(({ source }) => source),
				),
			],
		})),
		roms: releaseRecords.flatMap(({ rom }) => (rom ? [rom] : [])),
		romChipSerials: [
			...new Set(
				releaseRecords.flatMap((record) => record.romChipSerials ?? []),
			),
		].sort(),
		boxImageUrls: [
			...new Set(
				releaseRecords.flatMap(({ boxImageUrl }) =>
					boxImageUrl ? [boxImageUrl] : [],
				),
			),
		],
		cartridgePhotoUrls: releaseRecords.flatMap(({ cartridgePhotoUrl }) =>
			cartridgePhotoUrl ? [cartridgePhotoUrl] : [],
		),
		...(earliest && { earliestManufacturingDate: earliest }),
		links: [
			...releaseRecords.flatMap(({ source, url, label }) =>
				url ? [{ source, url, label }] : [],
			),
			{
				source: "pricecharting.com",
				url: `https://www.pricecharting.com/search-products?type=prices&q=${encodeURIComponent(titles[0]!.title)}`,
				label: "Search",
			},
		],
	};
}

// No-Intro's Game Boy Color list also has the Game Boy cartridges with Color enhancements, the black cartridges.
function noIntroSystem(entry: Sources["noIntro"][number]): GameSystem {
	return entry.dat === "cgb" && entry.specialTags.includes("GB Compatible")
		? "dmg"
		: entry.dat;
}

const serialSystems: Record<string, GameSystem> = {
	DMG: "dmg",
	// The Pocket Camera and Printer, e.g. GBD-PCAJ.
	GBD: "dmg",
	CGB: "cgb",
	AGB: "agb",
};

function mostCommon<T>(values: readonly T[]): T | undefined {
	const counts = new Map<T, number>();
	for (const value of values) {
		counts.set(value, (counts.get(value) ?? 0) + 1);
	}
	return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
}

function noIntroRom(
	entry: Sources["noIntro"][number],
	cartridgeSerials: string[],
	romChipSerials: string[],
	images: Sources["libretroThumbnails"][number] | undefined,
): Rom {
	const gameBoyColorEnhanced =
		entry.dat === "cgb" && entry.specialTags.includes("GB Compatible");
	const superGameBoyEnhanced = entry.specialTags.some((tag) =>
		tag.includes("SGB Enhanced"),
	);
	return {
		url: entry.url,
		...(gameBoyColorEnhanced && { gameBoyColorEnhanced }),
		...(superGameBoyEnhanced && { superGameBoyEnhanced }),
		...(entry.versions.length && { revision: entry.versions.join(" ") }),
		regions: entry.regions,
		languages: [...new Set(entry.languages.flatMap(languageTags))],
		crc32s: entry.files.map(({ crc32 }) => crc32),
		cartridgeSerials,
		romChipSerials,
		...(images?.boxArtUrl && { boxArtUrl: images.boxArtUrl }),
		...(images?.titleScreenshotUrl && {
			titleScreenshotUrl: images.titleScreenshotUrl,
		}),
		...(images?.gameplayScreenshotUrl && {
			gameplayScreenshotUrl: images.gameplayScreenshotUrl,
		}),
	};
}

function titleIn(
	title: string,
	language: string | undefined,
): { title: string; language?: string } {
	const tag = titleLanguage(title, language);
	return tag === undefined ? { title } : { title, language: tag };
}

// A translation made by the source, e.g. "ja-x-translated" for an English translation of a Japanese title.
function translated(language: string | undefined): string {
	return language === undefined ? "x-translated" : `${language}-x-translated`;
}

function serialRegion(serial: string): string | undefined {
	const parsed = parseLabelSerial(serial);
	return parsed.kind === "nintendo" ? parsed.region : undefined;
}

// e.g. https://gbhwdb.gekkio.fi/cartridges/DMG-TRA-1/max-m-1.html -> https://gbhwdb.gekkio.fi/static/DMG-TRA-1/max-m-1_01_front.jpg
export function gbhwdbPhotoUrl(cartridgeUrl: string): string {
	return cartridgeUrl
		.replace("/cartridges/", "/static/")
		.replace(/\.html$/, "_01_front.jpg");
}

// Approximate: weeks are converted to months.
function compareDates(a: GbhwdbDate, b: GbhwdbDate): number {
	const month = (date: GbhwdbDate) =>
		date.month ?? (date.week === undefined ? 1 : Math.ceil(date.week / 4.35));
	return a.year - b.year || month(a) - month(b);
}

const lowercaseWords = new Set(
	"a an and as at but by for from in into of on or the to vs with".split(" "),
);
// Kept in upper case.
const acronyms = new Set(
	"GB GBA GBC DX SGB CGB NBA NFL NHL NCAA MLB PGA FIFA UEFA WWF WWE WCW ECW UFC TV USA UK EU F1 BMX ATV GP GT NES SNES DS NY TNT ESPN MTV ABC CD DVD SD HD KO ID UFO NASCAR WTA ATP".split(
		" ",
	),
);

// e.g. "THE LEGEND OF ZELDA II" -> "The Legend of Zelda II". Roman numerals, words with digits and known acronyms keep
// their case.
export function titleCase(title: string): string {
	return title.replace(/[\p{L}\p{N}']+/gu, (word, offset: number) => {
		const bare = word.replace(/[.']/g, "");
		if (
			/\d/.test(word) ||
			/^[IVXLC]+$/.test(bare) ||
			acronyms.has(bare) ||
			!/[A-Z]/.test(word)
		) {
			return word;
		}
		const lower = word.toLowerCase();
		return offset > 0 && lowercaseWords.has(lower)
			? lower
			: lower.charAt(0).toUpperCase() + lower.slice(1);
	});
}

// Merges titles that only differ in case, accents, punctuation or spacing, e.g. "007 - Everything or Nothing" and
// "007 Everything Or Nothing", and drops titles in all caps that are close to another title, e.g.
// "JAMES BOND 007 : EVERYTHING OR NOTHING", since they are mostly from ROM headers. All caps titles that aren't close are
// kept, in title case, since they are often a title from another region, e.g. "Square Deal" for "Cadillac II".
export function mergeTitles(
	// Best first.
	titles: readonly { title: string; language?: string; source: string }[],
): Title[] {
	const isAllCaps = (title: string) =>
		title === title.toUpperCase() && /[A-Z]/.test(title);
	const normalized = (title: string) =>
		title
			.normalize("NFKD")
			.replace(/[\u0300-\u036f]/g, "")
			.toLowerCase()
			.replace(/&/g, " and ")
			.replace(/[^\p{L}\p{N}]+/gu, " ")
			.trim();
	const words = (title: string) => normalized(title).split(" ").filter(Boolean);
	const isClose = (allCaps: string, other: string) => {
		const otherWords = new Set(words(other));
		const allCapsWords = words(allCaps);
		return (
			normalized(allCaps).replaceAll(" ", "") ===
				normalized(other).replaceAll(" ", "") ||
			allCapsWords.filter((word) => otherWords.has(word)).length * 2 >=
				allCapsWords.length
		);
	};

	// Mixed case is preferred over all caps, then the given order.
	const ordered = [
		...titles.filter(({ title }) => !isAllCaps(title)),
		...titles.filter(({ title }) => isAllCaps(title)),
	];
	const kept = ordered.filter(
		({ title }, index) =>
			!ordered
				.slice(0, index)
				.some(
					(earlier) =>
						normalized(earlier.title).replaceAll(" ", "") ===
							normalized(title).replaceAll(" ", "") ||
						(isAllCaps(title) &&
							!isAllCaps(earlier.title) &&
							isClose(title, earlier.title)),
				),
	);
	// Each title's sources go to the first kept title it matches.
	const keptFor = (title: string) =>
		kept.find(
			(candidate) =>
				normalized(candidate.title).replaceAll(" ", "") ===
					normalized(title).replaceAll(" ", "") ||
				(isAllCaps(title) &&
					!isAllCaps(candidate.title) &&
					isClose(title, candidate.title)),
		) ?? kept.find((candidate) => candidate.title === title)!;
	return kept.map((candidate) => ({
		// All caps titles are mostly from ROM headers, and look nicer in title case.
		title: isAllCaps(candidate.title)
			? titleCase(candidate.title)
			: candidate.title,
		languages: [
			...new Set(
				titles
					.filter(({ title }) => keptFor(title) === candidate)
					.flatMap(({ language }) => (language ? [language] : [])),
			),
		].sort(),
		sources: [
			...new Set(
				titles
					.filter(({ title }) => keptFor(title) === candidate)
					.map(({ source }) => source),
			),
		],
	}));
}
