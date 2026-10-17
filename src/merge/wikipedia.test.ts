import { describe, expect, test } from "vitest";
import type { WikipediaEntry } from "../importers/en.wikipedia.org/parse.ts";
import type { Release, Rom } from "./build.ts";
import {
	addWikipedia,
	matchWikipedia,
	releaseRegions,
	releaseYear,
} from "./wikipedia.ts";
import { titleKey } from "./title-key.ts";

function release(
	id: string,
	fields: Partial<Release> & { serials?: string[] } = {},
): Release {
	const { serials = [], ...rest } = fields;
	return {
		id,
		gameId: id,
		familyId: id,
		title: id,
		system: "dmg",
		titles: [],
		cartridgeSerials: serials.map((serial) => ({ serial, sources: [] })),
		roms: [],
		romChipSerials: [],
		boxImageUrls: [],
		cartridgePhotoUrls: [],
		links: [
			{
				source: "pricecharting.com",
				url: "https://example.com",
				label: "Search",
			},
		],
		...rest,
	};
}

function rom(regions: string[], fields: Partial<Rom> = {}): Rom {
	return {
		url: "https://example.com/rom",
		regions,
		languages: [],
		crc32s: [],
		cartridgeSerials: [],
		romChipSerials: [],
		...fields,
	};
}

const tetris: WikipediaEntry = {
	list: "dmg",
	titles: [{ title: "Tetris", regions: [] }],
	articleUrl: "https://en.wikipedia.org/wiki/Tetris_(Game_Boy_video_game)",
	releaseDates: [
		{ region: "JP", date: "1989-06-14" },
		{ region: "NA", date: "1989-08" },
		{ region: "PAL", date: "1990-09-28" },
		{ region: "UK", date: "1990-09" },
	],
};

test("titleKey", () => {
	expect(titleKey("Takahashi Meijin no Bōken Jima II")).toBe(
		titleKey("Takahashi Meijin no Bouken Jima 2"),
	);
	expect(titleKey("The Legend of Zelda: Link's Awakening")).toBe(
		titleKey("Legend of Zelda, The - Link's Awakening"),
	);
	expect(titleKey("Tom & Jerry")).toBe(titleKey("Tom and Jerry"));
	expect(titleKey("Tetris")).not.toBe(titleKey("Tetris 2"));
});

test("releaseRegions", () => {
	expect(
		releaseRegions(
			release("DMG-TR", { serials: ["DMG-TR-USA", "DMG-TR-NOE-1"] }),
		),
	).toEqual(["North America", "Europe"]);
	// The product code's region letter, when the serial has no region.
	expect(
		releaseRegions(
			release("DMG-TRA", { serials: ["DMG-TRA"], roms: [rom(["World"])] }),
		),
	).toEqual(["Japan"]);
	expect(releaseRegions(release("dmg-1", { roms: [rom(["World"])] }))).toEqual([
		"Japan",
		"North America",
		"Europe",
	]);
	expect(
		releaseRegions(release("DMG-104 CHN", { serials: ["DMG-104 CHN"] })),
	).toEqual([]);
});

test("releaseYear takes the earliest year in the release's regions", () => {
	expect(
		releaseYear(release("DMG-TR", { serials: ["DMG-TR-UKV"] }), [tetris]),
	).toBe(1990);
	expect(
		releaseYear(release("DMG-TRA", { serials: ["DMG-TRA"] }), [tetris]),
	).toBe(1989);
	// Else the earliest year of the game.
	expect(releaseYear(release("x"), [tetris])).toBe(1989);
	expect(
		releaseYear(release("DMG-TR", { serials: ["DMG-TR-AUS"] }), [tetris]),
	).toBe(1989);
	expect(releaseYear(release("x"), [])).toBeUndefined();
	// Dates without a region apply to every region.
	expect(
		releaseYear(release("AGB-AAAE", { serials: ["AGB-AAAE-USA"] }), [
			{ ...tetris, list: "agb", releaseDates: [{ date: "2002" }] },
		]),
	).toBe(2002);
});

describe("matchWikipedia", () => {
	test("matches by any title on the list's systems", () => {
		const releases = [
			release("DMG-T3", {
				titles: [
					{
						title: "Takahashi Meijin no Bouken Jima II",
						languages: [],
						sources: [],
					},
				],
			}),
			release("AGB-T3", {
				system: "agb",
				titles: [{ title: "Adventure Island", languages: [], sources: [] }],
			}),
		];
		const entry: WikipediaEntry = {
			list: "dmg",
			titles: [
				{ title: "Adventure Island", regions: [] },
				{ title: "Takahashi Meijin no Boken Jima II", regions: ["JP"] },
			],
			releaseDates: [],
		};
		expect(matchWikipedia(releases, [entry]).gameIds).toEqual([["DMG-T3"]]);
	});

	test("prefers licensed games and games whose Color support fits the list", () => {
		const releases = [
			release("DMG-AN", { title: "Asteroids" }),
			release("DMG-AARE", {
				title: "Asteroids",
				roms: [rom(["USA"], { gameBoyColorEnhanced: true })],
			}),
			release("dmg-2", { title: "Asteroids", licensing: "pirate" }),
		];
		const entry = (list: WikipediaEntry["list"]): WikipediaEntry => ({
			list,
			titles: [{ title: "Asteroids", regions: [] }],
			releaseDates: [],
		});
		expect(
			matchWikipedia(releases, [entry("dmg"), entry("cgb")]).gameIds,
		).toEqual([["DMG-AN"], ["DMG-AARE"]]);
	});

	test("matches several games of the same family, but not unrelated games", () => {
		const releases = [
			release("DMG-ZL", { title: "Link's Awakening" }),
			release("DMG-ZC", { title: "Link's Awakening", familyId: "DMG-ZL" }),
			release("DMG-BB", { title: "Crazy Castle" }),
			release("DMG-M2", { title: "Crazy Castle" }),
		];
		const entry = (title: string): WikipediaEntry => ({
			list: "dmg",
			titles: [{ title, regions: [] }],
			releaseDates: [],
		});
		const { gameIds, ambiguous } = matchWikipedia(releases, [
			entry("Link's Awakening"),
			entry("Crazy Castle"),
		]);
		expect(gameIds).toEqual([["DMG-ZL", "DMG-ZC"], []]);
		expect(ambiguous.map(({ gameIds }) => gameIds)).toEqual([
			["DMG-BB", "DMG-M2"],
		]);
	});
});

test("addWikipedia adds the year and links before the search links", () => {
	const { releases } = addWikipedia(
		[release("DMG-TRA", { title: "Tetris", serials: ["DMG-TRA"] })],
		[tetris],
	);
	expect(releases[0]).toMatchObject({
		releaseYear: 1989,
		links: [
			{
				source: "en.wikipedia.org",
				url: "https://en.wikipedia.org/wiki/List_of_Game_Boy_games",
				label: "List",
			},
			{
				source: "en.wikipedia.org",
				url: "https://en.wikipedia.org/wiki/Tetris_(Game_Boy_video_game)",
				label: "Article",
			},
			{
				source: "pricecharting.com",
				url: "https://example.com",
				label: "Search",
			},
		],
	});
});
