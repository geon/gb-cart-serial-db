import { describe, expect, test } from "vitest";
import type { NoIntroEntry } from "../importers/no-intro.org/parse.ts";
import type { Correction } from "../corrections.ts";
import {
	buildReleases,
	gbhwdbPhotoUrl,
	mergeTitles,
	otherDumpsByRom,
	publishedRelease,
	publishedRom,
	titleFields,
	withChipCodeIds,
} from "./build.ts";
import { groupGames } from "./games.ts";
import { sourceLinks, type Sources } from "./links.ts";

function noIntroEntry(
	entry: Partial<NoIntroEntry> &
		Pick<NoIntroEntry, "url" | "noIntroName" | "title">,
): NoIntroEntry {
	return {
		dat: "dmg",
		printedTitles: [],
		regions: ["World"],
		languages: ["En"],
		versions: [],
		specialTags: [],
		licensing: "licensed",
		cartridgeSerials: [],
		romChipSerials: [],
		romHeaderCodes: [],
		files: [],
		...entry,
	};
}

const sources: Sources = {
	noIntro: [
		noIntroEntry({
			url: "https://datomatic.no-intro.org/index.php?page=show_record&s=46&n=1382",
			noIntroName: "Tetris (Japan) (En)",
			title: "Tetris",
			regions: ["Japan"],
			parentUrl:
				"https://datomatic.no-intro.org/index.php?page=show_record&s=46&n=1383",
			cartridgeSerials: ["DMG-TRA"],
			romChipSerials: ["DMG-TRA-0"],
			files: [{ crc32: "63f9407d", size: 32768 }],
		}),
		noIntroEntry({
			url: "https://datomatic.no-intro.org/index.php?page=show_record&s=46&n=1383",
			noIntroName: "Tetris (World) (Rev 1)",
			title: "Tetris",
			versions: ["Rev 1"],
			cartridgeSerials: ["DMG-TR-USA", "DMG-TRA", "none"],
			romChipSerials: ["DMG-TRA-1"],
			files: [{ crc32: "46df91ad", size: 32768 }],
		}),
	],
	gameBoyDatabaseCom: [
		{
			id: 2046,
			url: "https://www.game-boy-database.com/game-TR-2046-NOE.html",
			boxImageUrl: "https://www.game-boy-database.com/vizu/2046.jpg",
			fullsets: ["NOE"],
			serial: "DMG-TR-NOE",
			title: "Tetris",
			versionCount: 1,
		},
	],
	sprintinglegs: [
		{
			id: 3,
			url: "https://www.sprintinglegs.com/gbdb/gamedata?id=3",
			list: "dmg",
			serial: "DMG-TRA-1",
			title: "TETRIS",
			languageFreetext: "English",
		},
	],
	dmgpage: [],
	gbhwdb: [
		{
			url: "https://gbhwdb.gekkio.fi/cartridges/DMG-TRA-1/max-m-1.html",
			romChipSerial: "DMG-TRA-1",
			cartridgeSerial: "DMG-TR-NOE",
			noIntroName: "Tetris (World) (Rev 1)",
			boardDate: { year: 1990, month: 3 },
			romChipDate: { year: 1989, week: 52 },
		},
	],
	gbxDumper: [
		{
			internalName: "TETRIS",
			serial: "DMG-TR-USA",
			romSize: 32768,
			crc32: "46DF91AD",
		},
	],
	libretroThumbnails: [
		{
			repository: "Nintendo_-_Game_Boy",
			name: "Tetris (World) (Rev 1)",
			titleScreenshotUrl: "https://example.com/title.png",
		},
	],
};

function build(sources: Sources) {
	const { gameOf } = groupGames(
		sourceLinks(sources, []),
		() => undefined,
		new Set(),
	);
	return buildReleases(sources, [], gameOf);
}

describe("buildReleases", () => {
	test("makes a release per product code, with its serials, images and records", () => {
		const releases = build(sources);
		expect(releases.map(({ id }) => id).sort()).toEqual(["DMG-TR", "DMG-TRA"]);
		const western = releases.find(({ id }) => id === "DMG-TR")!;
		const japanese = releases.find(({ id }) => id === "DMG-TRA")!;
		expect(western.gameId).toBe(japanese.gameId);
		expect(western.familyId).toBe(japanese.familyId);

		expect(publishedRelease(western)).toEqual({
			id: "DMG-TR",
			gameId: "DMG-TRA",
			familyId: "DMG-TRA",
			title: {
				title: "Tetris",
				language: "en",
				sources: [
					"no-intro.org",
					"game-boy-database.com",
					"sprintinglegs",
					"gbhwdb.gekkio.fi",
				],
			},
			system: "dmg",
			cartridgeFeatures: [],
			languages: ["en"],
			// Added from Wikipedia later.
			releaseDates: [],
			developers: [],
			publishers: [],
			// Only this release's serials of the ROM, not DMG-TRA.
			cartridgeSerials: [
				{
					serial: "DMG-TR-NOE",
					sources: ["game-boy-database.com", "gbhwdb.gekkio.fi"],
					pages: ["https://www.game-boy-database.com/game-TR-2046-NOE.html"],
				},
				{ serial: "DMG-TR-USA", sources: ["no-intro.org"] },
			],
			romChipSerials: [
				{
					serial: "DMG-TRA-1",
					sources: ["no-intro.org", "sprintinglegs", "gbhwdb.gekkio.fi"],
					pages: ["https://www.sprintinglegs.com/gbdb/gamedata?id=3"],
				},
			],
			roms: ["dmg-1383"],
			images: [
				{
					kind: "cartridgePhoto",
					url: "https://gbhwdb.gekkio.fi/static/DMG-TRA-1/max-m-1_01_front.jpg",
					source: "gbhwdb.gekkio.fi",
					page: "https://gbhwdb.gekkio.fi/cartridges/DMG-TRA-1/max-m-1.html",
				},
				{
					kind: "box",
					url: "https://www.game-boy-database.com/vizu/2046.jpg",
					source: "game-boy-database.com",
				},
				{
					kind: "titleScreen",
					url: "https://example.com/title.png",
					source: "libretro-thumbnails",
				},
			],
			wikipediaArticles: [],
		});
		// Every source entry the release was built from, to tell which are in no release.
		expect(western.records).toEqual({
			"no-intro.org": [sources.noIntro[1]],
			"game-boy-database.com": sources.gameBoyDatabaseCom,
			sprintinglegs: sources.sprintinglegs,
			"gbhwdb.gekkio.fi": sources.gbhwdb,
			"github.com-mstroh76-GBxDumper": sources.gbxDumper,
			"libretro-thumbnails": sources.libretroThumbnails,
		});
		expect(western.romRegions).toEqual(["World"]);

		// Both ROM revisions were sold in Japan as DMG-TRA.
		expect(japanese.roms).toEqual(["dmg-1382", "dmg-1383"]);
		expect(japanese.cartridgeSerials).toEqual([
			{ serial: "DMG-TRA", sources: ["no-intro.org"] },
		]);
		expect(japanese.titles).toEqual([
			{
				title: "Tetris",
				// Not "ja-Latn": a title in Latin letters from a Japanese release isn't necessarily romanized.
				languages: ["en"],
				sources: ["no-intro.org"],
			},
		]);
	});
});

test("publishedRom adds GBxDumper's data to the files, and leaves out the tags the release has", () => {
	expect(
		publishedRom(
			{ ...sources.noIntro[1]!, specialTags: ["SGB Enhanced", "NP"] },
			sources.gbxDumper,
		),
	).toEqual({
		id: "dmg-1383",
		name: "Tetris (World) (Rev 1)",
		url: "https://datomatic.no-intro.org/index.php?page=show_record&s=46&n=1383",
		regions: ["World"],
		languages: ["en"],
		versions: ["Rev 1"],
		tags: ["NP"],
		headerCodes: [],
		files: [{ crc32: "46df91ad", size: 32768, internalName: "TETRIS" }],
	});
});

describe("titleFields", () => {
	const title = (title: string, languages: string[]) => ({
		title,
		languages,
		sources: ["s"],
	});
	test("adds a Latin title and a translation to a title in Japanese script", () => {
		expect(
			titleFields(
				[
					title("ゼルダの伝説　夢をみる島", ["ja"]),
					title("Zelda no Densetsu - Yume o Miru Shima", ["ja-Latn"]),
					title("The Legend of Zelda: A Dreaming Island", ["ja-x-translated"]),
				],
				"ja",
			),
		).toEqual({
			title: {
				title: "ゼルダの伝説　夢をみる島",
				language: "ja",
				sources: ["s"],
			},
			titleLatin: {
				title: "Zelda no Densetsu - Yume o Miru Shima",
				language: "ja-Latn",
				sources: ["s"],
			},
			titleTranslated: {
				title: "The Legend of Zelda: A Dreaming Island",
				language: "en",
				sources: ["s"],
			},
		});
	});
	test("lists the titles in each language of a release sold in several, if they differ", () => {
		expect(
			titleFields(
				[
					title("Pokémon Emerald", ["en"]),
					title("Pokémon: Smaragd-Edition", ["de"]),
				],
				undefined,
			),
		).toEqual({
			title: { title: "Pokémon Emerald", language: "en", sources: ["s"] },
			localizedTitles: [
				{ title: "Pokémon Emerald", language: "en", sources: ["s"] },
				{ title: "Pokémon: Smaragd-Edition", language: "de", sources: ["s"] },
			],
		});
		expect(titleFields([title("Tetris", ["de", "en"])], undefined)).toEqual({
			title: { title: "Tetris", language: "en", sources: ["s"] },
		});
	});
});

test("gbhwdbPhotoUrl", () => {
	expect(
		gbhwdbPhotoUrl(
			"https://gbhwdb.gekkio.fi/cartridges/DMG-TRA-1/max-m-1.html",
		),
	).toBe("https://gbhwdb.gekkio.fi/static/DMG-TRA-1/max-m-1_01_front.jpg");
});

describe("mergeTitles", () => {
	test("puts real titles first, in the release's language, and romanizations and translations last", () => {
		expect(
			mergeTitles(
				[
					{
						title: "Zelda no Densetsu - Yume o Miru Shima",
						language: "ja-Latn",
						source: "no-intro.org",
					},
					{
						title: "The Legend of Zelda: A Dreaming Island",
						language: "ja-x-translated",
						source: "sprintinglegs",
					},
					{
						title: "The Legend of Zelda: Link's Awakening",
						source: "en.wikipedia.org",
						official: true,
					},
					{
						title: "ゼルダの伝説　夢をみる島",
						language: "ja",
						source: "sprintinglegs",
						official: true,
					},
				],
				"ja",
			).map(({ title }) => title),
		).toEqual([
			"ゼルダの伝説　夢をみる島",
			"The Legend of Zelda: Link's Awakening",
			"Zelda no Densetsu - Yume o Miru Shima",
			"The Legend of Zelda: A Dreaming Island",
		]);
	});

	test("merges catalogue forms with the article moved, keeping the real title's spelling", () => {
		expect(
			mergeTitles([
				{
					title: "Legend of Zelda, The - Link's Awakening",
					source: "no-intro.org",
				},
				{
					title: "Legend of Zelda Link's Awakening (the)",
					source: "game-boy-database.com",
				},
				{
					title: "The Legend of Zelda: Link's Awakening",
					source: "en.wikipedia.org",
					official: true,
				},
			]),
		).toEqual([
			{
				title: "The Legend of Zelda: Link's Awakening",
				languages: [],
				sources: ["no-intro.org", "game-boy-database.com", "en.wikipedia.org"],
			},
		]);
	});

	test("tells romanized titles of Japanese releases by the sources' translations", () => {
		const titles = (translation: string | undefined) =>
			mergeTitles([
				{
					title: "Mario Kart Advance",
					language: "ja-Latn",
					source: "no-intro.org",
				},
				...(translation === undefined
					? []
					: [
							{
								title: translation,
								language: "ja-x-translated",
								source: "sprintinglegs",
							},
						]),
			]).map(({ title, languages }) => ({ title, languages }));
		// A translation that is also a real title isn't only a translation.
		// A matching translation doesn't tell: sprintinglegs' are sometimes romanized. A translation that is also a
		// real title isn't only a translation.
		expect(titles("Mario Kart Advance")).toEqual([
			{ title: "Mario Kart Advance", languages: [] },
		]);
		expect(titles("Mario Kart Go")).toEqual([
			{ title: "Mario Kart Advance", languages: ["ja-Latn"] },
			{ title: "Mario Kart Go", languages: ["ja-x-translated"] },
		]);
		// Without a translation, nothing tells.
		expect(titles(undefined)).toEqual([
			{ title: "Mario Kart Advance", languages: [] },
		]);
	});

	test("merges near-identical titles and drops close all caps titles", () => {
		expect(
			mergeTitles([
				{
					title: "007 - Everything or Nothing",
					language: "en",
					source: "no-intro.org",
				},
				{
					title: "JAMES BOND 007 : EVERYTHING OR NOTHING",
					language: "en",
					source: "sprintinglegs",
				},
				{ title: "007 Everything Or Nothing", source: "sprintinglegs" },
			]),
		).toEqual([
			{
				title: "007 - Everything or Nothing",
				languages: ["en"],
				sources: ["no-intro.org", "sprintinglegs"],
			},
		]);
		expect(
			mergeTitles([
				{ title: "ALLEY WAY", language: "en", source: "sprintinglegs" },
				{ title: "Alleyway", language: "de", source: "game-boy-database.com" },
			]),
		).toEqual([
			{
				title: "Alleyway",
				languages: ["de", "en"],
				sources: ["sprintinglegs", "game-boy-database.com"],
			},
		]);
	});

	test("keeps all caps titles that aren't close, and lone ones", () => {
		expect(
			mergeTitles([
				{ title: "Cadillac II", source: "no-intro.org" },
				{ title: "SQUARE DEAL", language: "en", source: "sprintinglegs" },
			]),
		).toEqual([
			{ title: "Cadillac II", languages: [], sources: ["no-intro.org"] },
			{ title: "SQUARE DEAL", languages: ["en"], sources: ["sprintinglegs"] },
		]);
		expect(mergeTitles([{ title: "TETRIS", source: "sprintinglegs" }])).toEqual(
			[{ title: "TETRIS", languages: [], sources: ["sprintinglegs"] }],
		);
	});
});

test("tags sprintinglegs titles and translations with their language", () => {
	const japanese: Sources = {
		...sources,
		noIntro: [],
		gameBoyDatabaseCom: [],
		gbhwdb: [],
		libretroThumbnails: [],
		sprintinglegs: [
			{
				id: 2,
				url: "https://www.sprintinglegs.com/gbdb/gamedata?id=2",
				list: "dmg",
				serial: "GBD-PCAJ",
				title: "ポケットカメラ",
				translatedTitle: "Pocket camera",
				languageFreetext: "Japanese",
			},
		],
	};
	const [release] = build(japanese);
	expect(release!.titles).toEqual([
		{ title: "ポケットカメラ", languages: ["ja"], sources: ["sprintinglegs"] },
		{
			title: "Pocket camera",
			languages: ["ja-x-translated"],
			sources: ["sprintinglegs"],
		},
	]);
});

test("doesn't tag sprintinglegs titles in Latin letters by the game's language", () => {
	const german: Sources = {
		...sources,
		noIntro: [],
		gameBoyDatabaseCom: [],
		gbhwdb: [],
		libretroThumbnails: [],
		sprintinglegs: [
			{
				id: 2481,
				url: "https://www.sprintinglegs.com/gbdb/gamedata?id=2481",
				list: "cgb",
				serial: "CGB-B99D",
				title: "102 DALMATIANS : PUPPIES TO THE RESCUE",
				languageFreetext: "German",
			},
		],
	};
	const [release] = build(german);
	expect(release!.titles).toEqual([
		{
			title: "102 DALMATIANS : PUPPIES TO THE RESCUE",
			languages: [],
			sources: ["sprintinglegs"],
		},
	]);
});

test("marks unlicensed and pirate releases", () => {
	const pirate: Sources = {
		...sources,
		noIntro: [
			{
				...sources.noIntro[1]!,
				url: "https://datomatic.no-intro.org/index.php?page=show_record&s=46&n=9999",
				noIntroName: "Tetris (World) (Pirate)",
				licensing: "pirate",
				files: [{ crc32: "00000000", size: 32768 }],
			},
		],
		gameBoyDatabaseCom: [],
		sprintinglegs: [],
		gbhwdb: [],
		libretroThumbnails: [],
	};
	expect(build(pirate)[0]).toMatchObject({
		licensing: "pirate",
	});
});

test("sets the system of Color games by whether they also run on the Game Boy", () => {
	const color: Sources = {
		...sources,
		noIntro: [
			{
				...sources.noIntro[1]!,
				url: "https://example.com/dual",
				noIntroName: "Dual (USA) (SGB Enhanced) (GB Compatible)",
				title: "Dual",
				dat: "cgb",
				specialTags: ["SGB Enhanced", "GB Compatible"],
				cartridgeSerials: ["DMG-AAAE-USA"],
				romChipSerials: [],
				files: [{ crc32: "00000001", size: 32768 }],
			},
			{
				...sources.noIntro[1]!,
				url: "https://example.com/only",
				noIntroName: "Only (USA)",
				title: "Only",
				dat: "cgb",
				cartridgeSerials: ["CGB-BBBE-USA"],
				romChipSerials: [],
				files: [{ crc32: "00000002", size: 32768 }],
			},
		],
		gameBoyDatabaseCom: [],
		sprintinglegs: [],
		gbhwdb: [],
		libretroThumbnails: [],
	};
	const releases = build(color);
	const dual = releases.find(({ title }) => title === "Dual")!;
	const only = releases.find(({ title }) => title === "Only")!;
	expect(dual.system).toBe("dmg");
	expect(dual).toMatchObject({
		gameBoyColorEnhanced: true,
		superGameBoyEnhanced: true,
	});
	expect(only.system).toBe("cgb");
	expect(only).not.toHaveProperty("gameBoyColorEnhanced");
});

test("takes the system from the serials when there is no No-Intro ROM", () => {
	const serialsOnly: Sources = {
		...sources,
		noIntro: [],
		sprintinglegs: [],
		gbhwdb: [],
		libretroThumbnails: [],
	};
	const [release] = build(serialsOnly);
	expect(release!.romRegions).toEqual([]);
	expect(release!.system).toBe("dmg");
});

test("keeps misprinted serials in the release of the serial they should have been", () => {
	const { gameOf } = groupGames(
		sourceLinks(sources, []),
		() => undefined,
		new Set(),
	);
	const releases = buildReleases(sources, [], gameOf, [
		{
			serial: "DMT-TR-USA",
			misprintOf: "DMG-TR-USA",
			title: "Tetris",
			reason: "",
			evidence: [],
		},
	]);
	const serials = (id: string) =>
		releases.find((release) => release.id === id)!.cartridgeSerials;
	expect(serials("DMG-TR")).toContainEqual({
		serial: "DMT-TR-USA",
		sources: ["corrections/misprinted-serials.json"],
		misprintOf: "DMG-TR-USA",
	});
	expect(serials("DMG-TRA").map(({ serial }) => serial)).not.toContain(
		"DMT-TR-USA",
	);
});

test("adds label serials a ROM lacks, credited to the corrections, which then name its release", () => {
	const url =
		"https://datomatic.no-intro.org/index.php?page=show_record&s=23&n=0398";
	const withRom: Sources = {
		...sources,
		noIntro: [
			noIntroEntry({
				url,
				dat: "agb",
				noIntroName: "Advance GT2 (Japan) (En)",
				title: "Advance GT2",
				regions: ["Japan"],
				romHeaderCodes: ["A2GJ"],
				files: [{ crc32: "11111111", size: 8388608 }],
			}),
		],
	};
	const corrections: Correction[] = [
		{
			source: "no-intro.org",
			record: url,
			title: "Advance GT2 (Japan) (En)",
			field: "cartridgeSerials",
			wrong: null,
			correct: "AGB-A2GJ-JPN",
			reason: "",
			evidence: [],
			reported: null,
		},
	];
	const { gameOf } = groupGames(
		sourceLinks(withRom, corrections),
		() => undefined,
		new Set(),
	);
	const release = buildReleases(withRom, corrections, gameOf).find(
		({ title }) => title === "Advance GT2",
	)!;
	expect(release.id).toBe("AGB-A2GJ");
	expect(release.cartridgeSerials).toEqual([
		{ serial: "AGB-A2GJ-JPN", sources: ["corrections/added-serials.json"] },
	]);
});

test("withChipCodeIds names releases keyed by a ROM number after their ROM chip, when no other release has it", () => {
	const chip = (serial: string) => ({ serial, sources: ["gbhwdb.gekkio.fi"] });
	expect(
		withChipCodeIds([
			{ id: "cgb-1", romChipSerials: [chip("CGB-BFIB-0"), chip("CGB-BFIB-1")] },
			{ id: "dmg-2", romChipSerials: [chip("DMG-AFJ-0")] },
			{ id: "DMG-AFJ", romChipSerials: [] },
			{ id: "dmg-3", romChipSerials: [chip("DMG-X1-0"), chip("DMG-X2-0")] },
			{ id: "DMG-TR", romChipSerials: [chip("DMG-TRA-1")] },
		]).map(({ id }) => id),
	).toEqual(["CGB-BFIB", "dmg-2", "DMG-AFJ", "dmg-3", "DMG-TR"]);
});

test("otherDumpsByRom puts GBxDumper's unknown dumps with the only ROM of their header code, or of its size", () => {
	const rom = (n: number, code: string, size: number) =>
		noIntroEntry({
			url: `https://datomatic.no-intro.org/index.php?page=show_record&s=23&n=${n}`,
			noIntroName: `ROM ${n}`,
			title: `ROM ${n}`,
			dat: "agb",
			romHeaderCodes: [code],
			files: [{ crc32: `0000000${n}`, size }],
		});
	const dump = (serial: string, crc32: string, romSize: number) => ({
		internalName: "GAME",
		serial,
		crc32,
		romSize,
	});
	const byRom = otherDumpsByRom(
		[
			rom(1, "ADBJ", 4194304),
			rom(2, "AG7J", 4194304),
			rom(3, "AG7J", 8388608),
			rom(4, "AXXE", 4194304),
			rom(5, "AXXE", 4194304),
		],
		[
			dump("AGB-ADBJ-JPN", "aaaaaaaa", 8388608),
			dump("AGB-ADBJ-JPN", "00000001", 4194304),
			dump("AGB-AG7J-JPN", "bbbbbbbb", 8388608),
			dump("AGB-AXXE-USA", "cccccccc", 4194304),
			dump("AGB-AZZE-USA", "dddddddd", 4194304),
		],
	);
	expect(
		Object.fromEntries(
			[...byRom].map(([id, dumps]) => [id, dumps.map(({ crc32 }) => crc32)]),
		),
	).toEqual({ "agb-1": ["aaaaaaaa"], "agb-3": ["bbbbbbbb"] });
});
