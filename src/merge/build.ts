import type { Correction, MisprintedSerial } from "../corrections.ts";
import { correctSerials } from "../corrections.ts";
import { parseLabelSerial, parseLabelSerials } from "../serials.ts";
import type { NoIntroEntry } from "../importers/no-intro.org/parse.ts";
import type { GameBoyDatabaseComEntry } from "../importers/game-boy-database.com/parse.ts";
import type { SprintinglegsEntry } from "../importers/sprintinglegs/parse.ts";
import type { DmgpageEntry } from "../importers/dmgpage.com/parse.ts";
import type { GbhwdbCartridge } from "../importers/gbhwdb.gekkio.fi/parse.ts";
import type { GbxDumperEntry } from "../importers/github.com-mstroh76-GBxDumper/parse.ts";
import type { LibretroThumbnailsEntry } from "../importers/libretro-thumbnails/parse.ts";
import type { WikipediaEntry } from "../importers/en.wikipedia.org/parse.ts";
import { connectedSets, members } from "./union-find.ts";
import { assignReleases, releaseCode } from "./releases.ts";
import { matchLibretro } from "./libretro.ts";
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
	romChipCode,
	sprintinglegsRomChip,
	type Sources,
} from "./links.ts";
import type {
	CartridgeFeature,
	GameSystem,
	Image,
	Release,
	Rom as PublishedRom,
	SourcedSerial,
	Title,
} from "../release.ts";
import { releaseLanguage } from "./regions.ts";

// The source entries a release was built from, by source, as in data-sources/. Only used while merging, to tell which
// entries are in no release (database/unmatched.json).
export type Records = {
	"no-intro.org"?: NoIntroEntry[];
	"game-boy-database.com"?: GameBoyDatabaseComEntry[];
	sprintinglegs?: SprintinglegsEntry[];
	"dmgpage.com"?: DmgpageEntry[];
	"gbhwdb.gekkio.fi"?: GbhwdbCartridge[];
	"github.com-mstroh76-GBxDumper"?: GbxDumperEntry[];
	"libretro-thumbnails"?: LibretroThumbnailsEntry[];
	"en.wikipedia.org"?: WikipediaEntry[];
};

// A source entry, tagged with its source.
type RecordEntry = {
	[Source in keyof Records]-?: {
		source: Source;
		entry: NonNullable<Records[Source]>[number];
	};
}[keyof Records];

// A title as a source gives it, before merging.
export type TitleCandidate = {
	title: string;
	language?: string;
	source: string;
	/** A title as printed or released, e.g. No-Intro's printed titles and Wikipedia's titles, rather than a catalogue's form of it, e.g. No-Intro's "Legend of Zelda, The - Link's Awakening". */
	official?: true;
};

// A title merged from the sources' titles, with all the languages they tag it with.
export type MergedTitle = {
	title: string;
	languages: string[];
	sources: string[];
};

// A release while merging, with what the later steps need.
export type ReleaseDraft = Omit<
	Release,
	"title" | "titleLatin" | "titleTranslated" | "localizedTitles"
> & {
	/** The first of the titles, to sort and match by. */
	title: string;
	/** Every title, best first, published as `title`, `titleLatin`, `titleTranslated` and `localizedTitles`. */
	titles: MergedTitle[];
	/** The titles of the sources, best first, merged into `titles`. */
	titleCandidates: TitleCandidate[];
	/** No-Intro's regions of the release's ROMs, e.g. ["World"] for Tetris Rev 1. */
	romRegions: string[];
	records: Records;
};

// The release as published, in the order of `Release`.
export function publishedRelease(draft: ReleaseDraft): Release {
	return {
		id: draft.id,
		gameId: draft.gameId,
		familyId: draft.familyId,
		...titleFields(draft.titles, releaseLanguage(draft)),
		...(draft.system && { system: draft.system }),
		...(draft.licensing && { licensing: draft.licensing }),
		...(draft.gameBoyColorEnhanced && { gameBoyColorEnhanced: true }),
		...(draft.superGameBoyEnhanced && { superGameBoyEnhanced: true }),
		cartridgeFeatures: draft.cartridgeFeatures,
		languages: draft.languages,
		releaseDates: draft.releaseDates,
		developers: draft.developers,
		publishers: draft.publishers,
		cartridgeSerials: draft.cartridgeSerials,
		romChipSerials: draft.romChipSerials,
		roms: draft.roms,
		images: draft.images,
		wikipediaArticles: draft.wikipediaArticles,
	};
}

// What a release takes from a No-Intro entry and its libretro-thumbnails images.
type Rom = {
	id: string;
	gameBoyColorEnhanced?: true;
	superGameBoyEnhanced?: true;
	cartridgeFeatures: CartridgeFeature[];
	regions: string[];
	languages: string[];
	images: Image[];
	/** The libretro-thumbnails entry of the ROM, and the GBxDumper entries with one of its CRC32s. */
	related: RecordEntry[];
};

// What is known about a source record, tagged with its game.
type SourceRecord = {
	game: string | undefined;
	source: string;
	url?: string;
	record: RecordEntry;
	titles: Omit<TitleCandidate, "source">[];
	/** Lower is preferred for the game's title. */
	titlePreference: number;
	rom?: Rom;
	/** For No-Intro records: a key of the ROM, e.g. "dmg-1383", and its regions. */
	romKey?: {
		key: string;
		regions: readonly string[];
		headerCodes: readonly string[];
	};
	/** For No-Intro records: the parent/clone group. */
	family?: string;
	/** Unlicensed, pirate and kiosk cartridges, whose serials can't be trusted to identify a release. */
	untrusted?: true;
	system?: GameSystem;
	/** The system of the list a source has the record in. */
	listedSystem?: GameSystem;
	licensing?: "licensed" | "unlicensed" | "pirate";
	cartridgeSerials?: string[];
	/** The cartridge serials added by raw-data-sources/corrections/added-serials.json, credited to it, not the source. */
	addedSerials?: string[];
	romChipSerials?: string[];
	boxImageUrl?: string;
	cartridgePhoto?: { url: string; page: string };
	/** A page about the record's serial. */
	link?: string;
};

// The No-Intro region an entry is preferred for as the game's title, best first.
const titleRegions = ["World", "USA", "Europe", "Japan"];

export function buildReleases(
	sources: Sources,
	corrections: readonly Correction[],
	gameOf: ReadonlyMap<string, string>,
	misprints: readonly MisprintedSerial[] = [],
): ReleaseDraft[] {
	const gameOfRecord = (source: string, record: string) =>
		gameOf.get(keys.record(source, record));

	const { imagesOf } = matchLibretro(
		sources.noIntro,
		sources.libretroThumbnails,
	);
	const gbxDumperByCrc32 = Map.groupBy(sources.gbxDumper, ({ crc32 }) =>
		crc32.toLowerCase(),
	);

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

	const addedSerials = (source: string, url: string | undefined) =>
		corrections.flatMap((correction) =>
			correction.wrong === null &&
			correction.correct !== null &&
			correction.field === "cartridgeSerials" &&
			correction.source === source &&
			correction.record === url
				? [correction.correct]
				: [],
		);
	const sourceRecords: SourceRecord[] = [
		...sources.noIntro.map((entry) => ({
			game: gameOfRecord("no-intro.org", entry.url),
			source: "no-intro.org",
			url: entry.url,
			record: { source: "no-intro.org" as const, entry },
			// The alternative titles are a mix of translations, transliterations and titles in Japanese script, and
			// the printed titles often have several languages, so only their script tells their language.
			titles: [
				titleIn(entry.title, noIntroLanguage(entry.regions, entry.languages)),
				...(entry.alternativeTitle === undefined
					? []
					: [titleIn(entry.alternativeTitle, undefined)]),
				...entry.printedTitles.map((title) => ({
					...titleIn(title, undefined),
					official: true as const,
				})),
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
				imagesOf(entry.url),
				entry.files.flatMap(
					({ crc32 }) => gbxDumperByCrc32.get(crc32.toLowerCase()) ?? [],
				),
			),
			romKey: {
				key: romId(entry),
				regions: entry.regions,
				headerCodes: entry.romHeaderCodes,
			},
			family: entry.parentUrl ?? entry.url,
			...((entry.licensing !== "licensed" || entry.edition === "Kiosk") && {
				untrusted: true as const,
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
			record: { source: "game-boy-database.com" as const, entry },
			link: entry.url,
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
			record: { source: "sprintinglegs" as const, entry },
			link: entry.url,
			titles: [
				// sprintinglegs' language is the language of the game's text. Its titles are often in English for
				// every region, e.g. "102 DALMATIANS" for the German, French and Spanish releases, so titles in Latin
				// letters aren't tagged by it. It does tell kanji-only titles, e.g. "役満", apart from Chinese ones.
				// Its titles in Japanese, Chinese or Korean script are as on the label.
				nonLatinScript.test(entry.title)
					? {
							...titleIn(
								entry.title,
								sprintinglegsLanguage(entry.languageFreetext),
							),
							official: true as const,
						}
					: titleIn(entry.title, undefined),
				...(entry.translatedTitle === undefined
					? []
					: [
							{
								title: entry.translatedTitle,
								language: translated(
									titleLanguage(entry.title, undefined)?.replace(
										/-Latn$/,
										"",
									) ?? sprintinglegsLanguage(entry.languageFreetext),
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
			record: { source: "dmgpage.com" as const, entry },
			titles: [
				{
					...titleIn(entry.title, dmgpageLanguage(entry.regions)),
					official: true as const,
				},
			],
			titlePreference: 40,
			cartridgeSerials: labelSerials("dmgpage.com", String(index), [
				entry.code,
			]),
		})),
		...sources.gbhwdb.map((entry) => ({
			game: gameOfRecord("gbhwdb.gekkio.fi", entry.url),
			source: "gbhwdb.gekkio.fi",
			url: entry.url,
			record: { source: "gbhwdb.gekkio.fi" as const, entry },
			titles: [{ title: entry.noIntroName.replace(/ \(.*$/, "") }],
			titlePreference: 50,
			cartridgeSerials: entry.cartridgeSerial
				? labelSerials("gbhwdb.gekkio.fi", entry.url, [entry.cartridgeSerial])
				: [],
			romChipSerials: [entry.romChipSerial],
			cartridgePhoto: { url: gbhwdbPhotoUrl(entry.url), page: entry.url },
		})),
	];
	const records = sourceRecords.map((record) => {
		const added = addedSerials(record.source, record.url);
		return added.length ? { ...record, addedSerials: added } : record;
	});

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

	// Game Boy Advance ROMs without a label serial are keyed by their header code, e.g. AGB-BKCJ, unless another game has
	// that code on a label or in a ROM header, e.g. AAMJ in both Akumajou Dracula (Japan) and its Chinese pirate.
	const headerKey = ({ romKey, untrusted }: SourceRecord) =>
		!untrusted &&
		romKey?.key.startsWith("agb-") &&
		romKey.headerCodes.length === 1
			? `AGB-${romKey.headerCodes[0]}`
			: undefined;
	const gamesOfCode = Map.groupBy(
		games.flatMap(({ game, gameRecords }) =>
			gameRecords.flatMap((record) =>
				[
					headerKey(record),
					...(record.untrusted ? [] : (record.cartridgeSerials ?? [])).map(
						releaseCode,
					),
				].flatMap((code) => (code === undefined ? [] : [{ code, game }])),
			),
		),
		({ code }) => code,
	);
	const releaseKey = (record: SourceRecord) => {
		const key = headerKey(record);
		return key !== undefined &&
			new Set(gamesOfCode.get(key)!.map(({ game }) => game)).size === 1
			? key
			: undefined;
	};

	const drafts = games.flatMap(({ id: gameId, gameRecords }) => {
		const { recordReleases, serialRelease } = assignReleases(
			gameRecords.map((record) => ({
				cartridgeSerials: record.cartridgeSerials,
				romChipSerials: record.romChipSerials,
				...(record.romKey && {
					rom: { ...record.romKey, releaseKey: releaseKey(record) },
				}),
				...(record.untrusted && { untrusted: record.untrusted }),
			})),
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
				misprints,
			),
		);
	});
	return withChipCodeIds(drafts).sort(
		(a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id),
	);
}

// Releases keyed by a ROM number, e.g. "dmg-1383", which changes when the merge rules change, take the product code
// of their ROM chips instead, e.g. "DMG-AFJ" for DMG-AFJ-0, when they have one and no other release has it.
export function withChipCodeIds<
	Draft extends { id: string; romChipSerials: readonly SourcedSerial[] },
>(drafts: readonly Draft[]): Draft[] {
	const ids = new Set(drafts.map(({ id }) => id));
	const chipCode = ({ id, romChipSerials }: Draft) => {
		if (!/^(dmg|cgb|agb)-x?\d+$/.test(id)) {
			return undefined;
		}
		const codes = [
			...new Set(
				romChipSerials.map(({ serial }) => serial.replace(/-\d$/, "")),
			),
		];
		return codes.length === 1 && /^(DMG|CGB|AGB)-[A-Z0-9]{2,4}$/.test(codes[0]!)
			? codes[0]
			: undefined;
	};
	const codes = drafts.map(chipCode);
	return drafts.map((draft, index) => {
		const code = codes[index];
		return code !== undefined &&
			!ids.has(code) &&
			codes.indexOf(code) === codes.lastIndexOf(code)
			? { ...draft, id: code }
			: draft;
	});
}

function buildRelease(
	id: string,
	gameId: string,
	familyId: string,
	releaseRecords: readonly SourceRecord[],
	serialRelease: (serial: string) => string | undefined,
	misprints: readonly MisprintedSerial[],
): ReleaseDraft {
	const byPreference = [...releaseRecords].sort(
		(a, b) => a.titlePreference - b.titlePreference,
	);
	const titleCandidates = byPreference.flatMap(({ source, titles }) =>
		titles.map((title) => ({ ...title, source })),
	);
	// A ROM in several releases, e.g. Tetris Rev 1 under DMG-TR and DMG-TRA, only brings the serials of this release.
	const serials = sourcedSerials(
		releaseRecords.flatMap((record) =>
			(record.cartridgeSerials ?? [])
				.filter((serial) => !record.rom || serialRelease(serial) === id)
				.map((serial) =>
					record.addedSerials?.includes(serial)
						? { serial, source: "corrections/added-serials.json" }
						: { serial, source: record.source, page: record.link },
				),
		),
	);
	// Misprinted serials are in the release of the serial they should have been.
	const misprinted: SourcedSerial[] = misprints
		.filter(({ misprintOf }) =>
			serials.some(({ serial }) => serial === misprintOf),
		)
		.map(({ serial, misprintOf }) => ({
			serial,
			sources: ["corrections/misprinted-serials.json"],
			misprintOf,
		}));
	const chipSerials = sourcedSerials(
		releaseRecords.flatMap(({ romChipSerials, source, link }) =>
			(romChipSerials ?? []).map((serial) => ({ serial, source, page: link })),
		),
	);
	const romRegions = [
		...new Set(releaseRecords.flatMap(({ rom }) => (rom ? rom.regions : []))),
	];
	const titles = mergeTitles(
		titleCandidates,
		releaseLanguage({ cartridgeSerials: serials, romRegions }) ?? "en",
	);
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
	const roms = releaseRecords.flatMap(({ rom }) => (rom ? [rom] : []));
	const gameBoyColorEnhanced = roms.some((rom) => rom.gameBoyColorEnhanced);
	const superGameBoyEnhanced = roms.some((rom) => rom.superGameBoyEnhanced);
	const images: Image[] = [
		...releaseRecords.flatMap(({ source, cartridgePhoto }) =>
			cartridgePhoto
				? [
						{
							kind: "cartridgePhoto" as const,
							url: cartridgePhoto.url,
							source,
							page: cartridgePhoto.page,
						},
					]
				: [],
		),
		...releaseRecords.flatMap(({ source, boxImageUrl }) =>
			boxImageUrl ? [{ kind: "box" as const, url: boxImageUrl, source }] : [],
		),
		...(["boxArt", "titleScreen", "gameplay"] as const).flatMap((kind) =>
			roms.flatMap((rom) => rom.images.filter((image) => image.kind === kind)),
		),
	];

	return {
		id,
		gameId,
		familyId,
		title: titles[0]!.title,
		titles,
		titleCandidates,
		...(system && { system }),
		...(licensing && { licensing }),
		...(gameBoyColorEnhanced && { gameBoyColorEnhanced }),
		...(superGameBoyEnhanced && { superGameBoyEnhanced }),
		cartridgeFeatures: [
			...new Set(roms.flatMap(({ cartridgeFeatures }) => cartridgeFeatures)),
		],
		languages: [...new Set(roms.flatMap(({ languages }) => languages))],
		releaseDates: [],
		developers: [],
		publishers: [],
		cartridgeSerials: [...serials, ...misprinted].sort((a, b) =>
			a.serial.localeCompare(b.serial),
		),
		romChipSerials: chipSerials,
		roms: roms.map(({ id }) => id),
		images: images.filter(
			(image, index) =>
				images.findIndex(({ url }) => url === image.url) === index,
		),
		wikipediaArticles: [],
		records: groupRecords([
			...releaseRecords.map(({ record }) => record),
			...roms.flatMap(({ related }) => related),
		]),
		romRegions,
	};
}

// Each serial once, sorted, with its sources in the order given.
function sourcedSerials(
	serials: readonly { serial: string; source: string; page?: string }[],
): SourcedSerial[] {
	return [...Map.groupBy(serials, ({ serial }) => serial)]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([serial, given]) => {
			const pages = [...new Set(given.flatMap(({ page }) => page ?? []))];
			return {
				serial,
				sources: [...new Set(given.map(({ source }) => source))],
				...(pages.length && { pages }),
			};
		});
}

// The entries of the records, tagged with their source.
export function recordEntries(records: {
	readonly [Source in keyof Records]?: readonly NonNullable<
		Records[Source]
	>[number][];
}): RecordEntry[] {
	return Object.entries(records).flatMap(([source, entries]) =>
		(entries as RecordEntry["entry"][]).map(
			(entry) => ({ source, entry }) as RecordEntry,
		),
	);
}

// The entries by source, in the order of `Records`, each entry once.
export function groupRecords(entries: readonly RecordEntry[]): Records {
	const order: (keyof Records)[] = [
		"no-intro.org",
		"game-boy-database.com",
		"sprintinglegs",
		"dmgpage.com",
		"gbhwdb.gekkio.fi",
		"github.com-mstroh76-GBxDumper",
		"libretro-thumbnails",
		"en.wikipedia.org",
	];
	const bySource = Map.groupBy(entries, ({ source }) => source);
	return Object.fromEntries(
		order.flatMap((source) => {
			const sourceEntries = bySource.get(source);
			return sourceEntries
				? [[source, [...new Set(sourceEntries.map(({ entry }) => entry))]]]
				: [];
		}),
	) as Records;
}

// No-Intro's Game Boy Color list also has the Game Boy cartridges with Color enhancements, the black cartridges.
export function noIntroSystem(entry: Sources["noIntro"][number]): GameSystem {
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
	images: Sources["libretroThumbnails"][number] | undefined,
	gbxDumper: readonly GbxDumperEntry[],
): Rom {
	const gameBoyColorEnhanced =
		entry.dat === "cgb" && entry.specialTags.includes("GB Compatible");
	const superGameBoyEnhanced = entry.specialTags.some((tag) =>
		tag.includes("SGB Enhanced"),
	);
	return {
		id: romId(entry),
		...(gameBoyColorEnhanced && { gameBoyColorEnhanced }),
		...(superGameBoyEnhanced && { superGameBoyEnhanced }),
		cartridgeFeatures: entry.edition === "Rumble Version" ? ["rumble"] : [],
		regions: entry.regions,
		languages: [...new Set(entry.languages.flatMap(languageTags))],
		images: (
			[
				["boxArt", images?.boxArtUrl],
				["titleScreen", images?.titleScreenshotUrl],
				["gameplay", images?.gameplayScreenshotUrl],
			] as const
		).flatMap(([kind, url]) =>
			url ? [{ kind, url, source: "libretro-thumbnails" }] : [],
		),
		related: [
			...(images
				? [{ source: "libretro-thumbnails" as const, entry: images }]
				: []),
			...gbxDumper.map((entry) => ({
				source: "github.com-mstroh76-GBxDumper" as const,
				entry,
			})),
		],
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

// Merges titles that only differ in case, accents, punctuation, spacing or the place of the article, e.g.
// "007 - Everything or Nothing" and "007 Everything Or Nothing", or "Legend of Zelda, The - Link's Awakening" and "The
// Legend of Zelda: Link's Awakening", and drops titles in all caps that are close to another title, e.g.
// "JAMES BOND 007 : EVERYTHING OR NOTHING", since they are mostly from ROM headers. All caps titles that aren't close are
// kept, since they are often a title from another region, e.g. "SQUARE DEAL" for "Cadillac II".
//
// Real titles first, preferring the release's language, e.g. "ja" for a release only sold in Japan: titles as printed
// or released, then catalogue forms, then the sources' romanizations and translations, which aren't titles of the
// release but help finding it. A merged title keeps the spelling of its best candidate.
export function mergeTitles(
	// Best first.
	candidates: readonly TitleCandidate[],
	releaseLanguage?: string,
): MergedTitle[] {
	const isAllCaps = (title: string) =>
		title === title.toUpperCase() && /[A-Z]/.test(title);
	const normalized = (title: string) =>
		title
			// The article in front, e.g. "Legend of Zelda, The - Link's Awakening" and game-boy-database.com's
			// "Legend of Zelda Link's Awakening (the)".
			.replace(/^(.+?), (the|an?)(?= - |: |$)/i, "$2 $1")
			.replace(/^(.+?) \((the|an?)\)(?=$| )/i, "$2 $1")
			.normalize("NFKD")
			.replace(/[\u0300-\u036f]/g, "")
			.toLowerCase()
			.replace(/&/g, " and ")
			.replace(/[^\p{L}\p{N}]+/gu, " ")
			.trim();
	const same = (a: string, b: string) =>
		normalized(a).replaceAll(" ", "") === normalized(b).replaceAll(" ", "");
	const words = (title: string) => normalized(title).split(" ").filter(Boolean);
	const isClose = (allCaps: string, other: string) => {
		const otherWords = new Set(words(other));
		const allCapsWords = words(allCaps);
		return (
			same(allCaps, other) ||
			allCapsWords.filter((word) => otherWords.has(word)).length * 2 >=
				allCapsWords.length
		);
	};

	const isTranslation = (language: string | undefined) =>
		language?.endsWith("x-translated") ?? false;
	// A title in Latin letters from a Japanese, Chinese or Korean release, e.g. No-Intro's, is tagged "ja-Latn" etc. by
	// its region, but is as often in English, e.g. "Astro Rabby", or mixed, e.g. "Puyo Puyo Gaiden: Puyo Wars". It is
	// only romanized when a source's translation of the title in Japanese, Chinese or Korean script differs from it,
	// e.g. "Zelda no Densetsu - Yume o Miru Shima" for "The Legend of Zelda: A Dreaming Island"; else the language is
	// unknown. Even a matching translation doesn't tell, since sprintinglegs' "translations" are sometimes romanized.
	const translations = candidates.filter(({ language }) =>
		isTranslation(language),
	);
	const titles = candidates.map((candidate): TitleCandidate =>
		candidate.language?.endsWith("-Latn") &&
		!(
			translations.length &&
			!translations.some(({ title }) => same(title, candidate.title))
		)
			? { ...candidate, language: undefined }
			: candidate,
	);
	const isMadeUp = ({ language }: TitleCandidate) =>
		isTranslation(language) || (language?.endsWith("-Latn") ?? false);
	const inReleaseLanguage = ({ language }: TitleCandidate) =>
		releaseLanguage !== undefined &&
		language?.split("-")[0] === releaseLanguage;
	const rank = (candidate: TitleCandidate) => [
		isMadeUp(candidate) ? 1 : 0,
		candidate.official ? 0 : 1,
		inReleaseLanguage(candidate) ? 0 : 1,
		isAllCaps(candidate.title) ? 1 : 0,
	];
	const ordered = titles
		.map((candidate, index) => ({ candidate, index, rank: rank(candidate) }))
		.sort(
			(a, b) =>
				a.rank.reduce((result, value, i) => result || value - b.rank[i]!, 0) ||
				a.index - b.index,
		)
		.map(({ candidate }) => candidate);

	const matches = (kept: string, title: string) =>
		same(kept, title) ||
		(isAllCaps(title) && !isAllCaps(kept) && isClose(title, kept));
	const kept = ordered.filter(
		({ title }, index) =>
			!ordered.slice(0, index).some((earlier) => matches(earlier.title, title)),
	);
	// Each title's candidates go to the first kept title it matches.
	const keptFor = (title: string) =>
		kept.find((candidate) => matches(candidate.title, title)) ??
		kept.find((candidate) => candidate.title === title)!;
	return kept.map((candidate) => {
		const group = titles.filter(({ title }) => keptFor(title) === candidate);
		// A translation that is also a real title isn't only a translation.
		const languages = group
			.flatMap(({ language }) => (language ? [language] : []))
			.filter(
				(language) =>
					!isTranslation(language) ||
					group.every((other) => isTranslation(other.language)),
			);
		return {
			title: candidate.title,
			languages: [...new Set(languages)].sort(),
			sources: [...new Set(group.map(({ source }) => source))],
		};
	});
}

// No-Intro's DAT and archive number, e.g. "dmg-1383".
export function romId(entry: NoIntroEntry): string {
	return `${entry.dat}-${new URL(entry.url).searchParams.get("n")}`;
}

// The special tags database/roms.json keeps: Super Game Boy and Game Boy Color support are in the release.
const releaseTags = new Set([
	"SGB Enhanced",
	"GB Compatible",
	"CGB+SGB Enhanced",
]);

// The ROM of a No-Intro entry, with GBxDumper's data on its files.
export function publishedRom(
	entry: NoIntroEntry,
	gbxDumper: readonly GbxDumperEntry[],
	otherDumps: readonly GbxDumperEntry[] = [],
): PublishedRom {
	return {
		id: romId(entry),
		name: entry.noIntroName,
		url: entry.url,
		regions: entry.regions,
		languages: [...new Set(entry.languages.flatMap(languageTags))],
		versions: entry.versions,
		...(entry.edition !== undefined && { edition: entry.edition }),
		tags: entry.specialTags.filter((tag) => !releaseTags.has(tag)),
		headerCodes: entry.romHeaderCodes,
		files: entry.files.map(({ crc32, size }) => {
			const dump = gbxDumper.find(
				(dump) => dump.crc32.toLowerCase() === crc32.toLowerCase(),
			);
			return {
				crc32,
				size,
				...(dump && { internalName: dump.internalName }),
				...(dump?.saveType !== undefined && { saveType: dump.saveType }),
				...(dump?.saveSize !== undefined && { saveSize: dump.saveSize }),
			};
		}),
		...(otherDumps.length && {
			otherDumps: otherDumps.map((dump) => ({
				crc32: dump.crc32,
				size: dump.romSize,
				internalName: dump.internalName,
				...(dump.saveType !== undefined && { saveType: dump.saveType }),
				...(dump.saveSize !== undefined && { saveSize: dump.saveSize }),
			})),
		}),
	};
}

// The published title fields of a release's titles, best first (see mergeTitles). `language` is the release's, when it
// is sold in one language.
export function titleFields(
	titles: readonly MergedTitle[],
	language: string | undefined,
): Pick<
	Release,
	"title" | "titleLatin" | "titleTranslated" | "localizedTitles"
> {
	const isTranslation = ({ languages }: MergedTitle) =>
		languages.length > 0 &&
		languages.every((tag) => tag.endsWith("x-translated"));
	const isRomanized = ({ languages }: MergedTitle) =>
		languages.some((tag) => tag.endsWith("-Latn"));
	const real = titles.filter(
		(title) => !isTranslation(title) && !isRomanized(title),
	);
	const preferred = language ?? "en";
	// A title's language: the preferred one if it is in it, else its only one.
	const published = (title: MergedTitle, tag?: string): Title => {
		const tags = title.languages.filter((tag) => !tag.endsWith("x-translated"));
		const chosen =
			tag ??
			tags.find((tag) => tag === preferred) ??
			(tags.length === 1 ? tags[0] : undefined);
		return {
			title: title.title,
			...(chosen !== undefined && { language: chosen }),
			sources: title.sources,
		};
	};

	const first =
		real[0] ?? titles.find((title) => !isTranslation(title)) ?? titles[0]!;
	const latin = nonLatinScript.test(first.title)
		? titles.find(
				(title) =>
					title !== first &&
					!isTranslation(title) &&
					!nonLatinScript.test(title.title),
			)
		: undefined;
	const translation = titles.find(
		(title) => title !== first && isTranslation(title),
	);
	// The best title in each language, for a release sold in several.
	const localized =
		language === undefined
			? [...new Set(real.flatMap(({ languages }) => languages))].map((tag) =>
					published(
						real.find(({ languages }) => languages.includes(tag))!,
						tag,
					),
				)
			: [];
	return {
		title: published(first),
		...(latin && { titleLatin: published(latin) }),
		...(translation && {
			titleTranslated: { ...published(translation), language: "en" },
		}),
		...(new Set(localized.map(({ title }) => title)).size > 1 && {
			localizedTitles: localized,
		}),
	};
}

// GBxDumper's dumps whose CRC32 No-Intro doesn't have, by the No-Intro ROM they are dumps of: the only ROM with the
// header code in the dump's serial, e.g. ADBJ in AGB-ADBJ-JPN, or else the only one of those with the dump's size.
// GBxDumper's serials are built from the header code, so this is the dump's header code.
export function otherDumpsByRom(
	noIntro: readonly NoIntroEntry[],
	gbxDumper: readonly GbxDumperEntry[],
): Map<string, GbxDumperEntry[]> {
	const crc32s = new Set(
		noIntro.flatMap(({ files }) =>
			files.map(({ crc32 }) => crc32.toLowerCase()),
		),
	);
	const byHeaderCode = Map.groupBy(
		noIntro.flatMap((entry) =>
			entry.romHeaderCodes.map((code) => ({ code, entry })),
		),
		({ code }) => code,
	);
	const matches = gbxDumper.flatMap((dump) => {
		if (crc32s.has(dump.crc32.toLowerCase())) {
			return [];
		}
		const candidates = (byHeaderCode.get(dump.serial.split("-")[1]!) ?? []).map(
			({ entry }) => entry,
		);
		const sameSize = candidates.filter(({ files }) =>
			files.some(({ size }) => size === dump.romSize),
		);
		const rom =
			candidates.length === 1
				? candidates[0]
				: sameSize.length === 1
					? sameSize[0]
					: undefined;
		return rom ? [{ romId: romId(rom), dump }] : [];
	});
	return new Map(
		[...Map.groupBy(matches, ({ romId }) => romId)].map(([id, matches]) => [
			id,
			matches.map(({ dump }) => dump),
		]),
	);
}
