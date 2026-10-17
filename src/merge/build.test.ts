import { describe, expect, test } from "vitest";
import type { NoIntroEntry } from "../importers/no-intro.org/parse.ts";
import { buildGames, gbhwdbPhotoUrl, mergeTitles, titleCase } from "./build.ts";
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
			cartridgeSerials: ["DMG-TR-USA", "DMG-TRA"],
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
			language: "English",
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
	gbxDumper: [],
	geon: [],
	libretroThumbnails: [
		{
			repository: "Nintendo_-_Game_Boy",
			name: "Tetris (World) (Rev 1)",
			titleScreenshotUrl: "https://example.com/title.png",
		},
	],
};

describe("buildGames", () => {
	test("merges the sources into a game", () => {
		const { gameOf } = groupGames(
			sourceLinks(sources, []),
			() => undefined,
			new Set(),
		);
		const [game, ...rest] = buildGames(sources, [], gameOf);
		expect(rest).toEqual([]);
		expect(game).toMatchObject({
			id: "DMG-TRA",
			title: "Tetris",
			titles: [
				{
					title: "Tetris",
					languages: ["de", "en", "ja-Latn"],
					sources: [
						"no-intro.org",
						"game-boy-database.com",
						"sprintinglegs",
						"gbhwdb.gekkio.fi",
					],
				},
			],
			cartridgeSerials: [
				{
					serial: "DMG-TR-NOE",
					sources: ["game-boy-database.com", "gbhwdb.gekkio.fi"],
				},
				{ serial: "DMG-TR-USA", sources: ["no-intro.org"] },
				{ serial: "DMG-TRA", sources: ["no-intro.org"] },
			],
			romChipSerials: ["DMG-TRA-0", "DMG-TRA-1"],
			boxImageUrls: ["https://www.game-boy-database.com/vizu/2046.jpg"],
			cartridgePhotoUrls: [
				"https://gbhwdb.gekkio.fi/static/DMG-TRA-1/max-m-1_01_front.jpg",
			],
			earliestManufacturingDate: { year: 1989, week: 52 },
		});
		expect(game).not.toHaveProperty("licensing");
		expect(game!.system).toBe("dmg");
		expect(game!.versions.map(({ url }) => url)).toEqual([
			"https://datomatic.no-intro.org/index.php?page=show_record&s=46&n=1382",
			"https://datomatic.no-intro.org/index.php?page=show_record&s=46&n=1383",
		]);
		expect(game!.versions[0]).not.toHaveProperty("noIntroName");
		expect(game!.versions[0]).not.toHaveProperty("revision");
		expect(game!.versions[1]).toMatchObject({
			revision: "Rev 1",
			crc32s: ["46df91ad"],
			titleScreenshotUrl: "https://example.com/title.png",
		});
		expect(game!.versions[1]).not.toHaveProperty("gameBoyColorEnhanced");
		expect(game!.versions[1]).not.toHaveProperty("superGameBoyEnhanced");
		expect(game!.links.at(-1)).toEqual({
			source: "pricecharting.com",
			url: "https://www.pricecharting.com/search-products?type=prices&q=Tetris",
			label: "Search",
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
			{ title: "Square Deal", languages: ["en"], sources: ["sprintinglegs"] },
		]);
		expect(mergeTitles([{ title: "TETRIS", source: "sprintinglegs" }])).toEqual(
			[{ title: "Tetris", languages: [], sources: ["sprintinglegs"] }],
		);
	});
});

test("titleCase", () => {
	expect(titleCase("THE LEGEND OF ZELDA II")).toBe("The Legend of Zelda II");
	expect(titleCase("NBA JAM 99")).toBe("NBA Jam 99");
	expect(titleCase("STOP THAT ROACH!")).toBe("Stop That Roach!");
	expect(titleCase("DISNEY'S ALADDIN")).toBe("Disney's Aladdin");
	expect(titleCase("IRIDION 3-D")).toBe("Iridion 3-D");
	expect(titleCase("R-TYPE DX")).toBe("R-Type DX");
	expect(titleCase("4 IN 1 FUN PAK: VOL.Ⅱ")).toBe("4 in 1 Fun Pak: Vol.Ⅱ");
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
				language: "Japanese",
			},
		],
	};
	const { gameOf } = groupGames(
		sourceLinks(japanese, []),
		() => undefined,
		new Set(),
	);
	const [game] = buildGames(japanese, [], gameOf);
	expect(game!.titles).toEqual([
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
				language: "German",
			},
		],
	};
	const { gameOf } = groupGames(
		sourceLinks(german, []),
		() => undefined,
		new Set(),
	);
	const [game] = buildGames(german, [], gameOf);
	expect(game!.titles).toEqual([
		{
			title: "102 Dalmatians : Puppies to the Rescue",
			languages: [],
			sources: ["sprintinglegs"],
		},
	]);
});

test("marks unlicensed and pirate games", () => {
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
	const { gameOf } = groupGames(
		sourceLinks(pirate, []),
		() => undefined,
		new Set(),
	);
	expect(buildGames(pirate, [], gameOf)[0]).toMatchObject({
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
	const { gameOf } = groupGames(
		sourceLinks(color, []),
		() => undefined,
		new Set(),
	);
	const games = buildGames(color, [], gameOf);
	const dual = games.find(({ title }) => title === "Dual")!;
	const only = games.find(({ title }) => title === "Only")!;
	expect(dual.system).toBe("dmg");
	expect(dual.versions[0]).toMatchObject({
		gameBoyColorEnhanced: true,
		superGameBoyEnhanced: true,
	});
	expect(only.system).toBe("cgb");
	expect(only.versions[0]).not.toHaveProperty("gameBoyColorEnhanced");
});

test("takes the system from the serials when there is no No-Intro version", () => {
	const serialsOnly: Sources = {
		...sources,
		noIntro: [],
		sprintinglegs: [],
		gbhwdb: [],
		libretroThumbnails: [],
	};
	const { gameOf } = groupGames(
		sourceLinks(serialsOnly, []),
		() => undefined,
		new Set(),
	);
	const [game] = buildGames(serialsOnly, [], gameOf);
	expect(game!.versions).toEqual([]);
	expect(game!.system).toBe("dmg");
});
