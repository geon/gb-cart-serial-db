import { describe, expect, test } from "vitest";
import type { WikipediaEntry } from "../importers/en.wikipedia.org/parse.ts";
import { publishedRelease, type ReleaseDraft } from "./build.ts";
import {
	addWikipedia,
	wikipediaTitleRegions,
	matchWikipedia,
	cartridgeFeature,
	releaseDates,
} from "./wikipedia.ts";
import { releaseLanguage, releaseRegions } from "./regions.ts";
import { titleKey } from "./title-key.ts";

function release(
	id: string,
	fields: Partial<ReleaseDraft> & { serials?: string[] } = {},
): ReleaseDraft {
	const { serials = [], ...rest } = fields;
	return {
		id,
		gameId: id,
		familyId: id,
		title: id,
		system: "dmg",
		titles: [],
		titleCandidates: [],
		cartridgeFeatures: [],
		releaseDates: [],
		developers: [],
		publishers: [],
		cartridgeSerials: serials.map((serial) => ({ serial, sources: [] })),
		romChipSerials: [],
		roms: [],
		languages: [],
		images: [],
		wikipediaArticles: [],
		records: {},
		romRegions: [],
		...rest,
	};
}

const tetris: WikipediaEntry = {
	list: "dmg",
	developers: [],
	publishers: [],
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
			release("DMG-TRA", { serials: ["DMG-TRA"], romRegions: ["World"] }),
		),
	).toEqual(["Japan"]);
	expect(releaseRegions(release("dmg-1", { romRegions: ["World"] }))).toEqual([
		"Japan",
		"North America",
		"Europe",
	]);
	expect(
		releaseRegions(release("DMG-104 CHN", { serials: ["DMG-104 CHN"] })),
	).toEqual([]);
});

test("releaseDates are the dates in the release's regions", () => {
	expect(
		releaseDates(release("DMG-TR", { serials: ["DMG-TR-UKV"] }), [tetris]),
	).toEqual([
		{ region: "Europe", date: "1990-09" },
		{ region: "Europe", date: "1990-09-28" },
	]);
	expect(
		releaseDates(release("DMG-TRA", { serials: ["DMG-TRA"] }), [tetris]),
	).toEqual([{ region: "Japan", date: "1989-06-14" }]);
	// All of them for a release of unknown regions.
	expect(releaseDates(release("x"), [tetris]).map(({ date }) => date)).toEqual([
		"1989-06-14",
		"1989-08",
		"1990-09",
		"1990-09-28",
		"1990-09-28",
	]);
	// PAL includes Australia, unless the row has an Australian date of its own.
	expect(
		releaseDates(release("DMG-TR", { serials: ["DMG-TR-AUS"] }), [tetris]),
	).toEqual([{ region: "Australia", date: "1990-09-28" }]);
	expect(
		releaseDates(release("DMG-TR", { serials: ["DMG-TR-AUS"] }), [
			{
				...tetris,
				releaseDates: [...tetris.releaseDates, { region: "AU", date: "1991" }],
			},
		]),
	).toEqual([{ region: "Australia", date: "1991" }]);
	expect(releaseDates(release("x"), [])).toEqual([]);
	// Dates without a region apply to every region.
	expect(
		releaseDates(release("AGB-AAAE", { serials: ["AGB-AAAE-USA"] }), [
			{ ...tetris, list: "agb", releaseDates: [{ date: "2002" }] },
		]),
	).toEqual([{ date: "2002" }]);
});

test("wikipediaTitleRegions: a title without regions is for the regions the other titles aren't", () => {
	expect(
		wikipediaTitleRegions([
			{ title: "Pokémon Emerald", regions: [] },
			{ title: "Pocket Monsters Emerald", regions: ["JP"] },
		]),
	).toEqual([["North America", "Europe", "Australia", "Korea"], ["Japan"]]);
	expect(wikipediaTitleRegions([{ title: "Tetris", regions: [] }])).toEqual([
		undefined,
	]);
});

test("releaseLanguage", () => {
	expect(
		releaseLanguage(
			release("DMG-APEI", { serials: ["DMG-APEI-ITA", "DMG-APEI-NITA-1"] }),
		),
	).toBe("it");
	expect(releaseLanguage(release("DMG-TRA", { serials: ["DMG-TRA"] }))).toBe(
		"ja",
	);
	expect(
		releaseLanguage(release("DMG-104 CHN", { serials: ["DMG-104 CHN"] })),
	).toBe("zh");
	// Several languages.
	expect(
		releaseLanguage(
			release("DMG-TR", { serials: ["DMG-TR-USA", "DMG-TR-NOE"] }),
		),
	).toBeUndefined();
});

test("cartridgeFeature", () => {
	expect(cartridgeFeature("Rumble Pak")).toEqual({ feature: "rumble" });
	expect(cartridgeFeature("Rumble Pak (JP only)")).toEqual({
		feature: "rumble",
		regions: ["Japan"],
	});
	expect(() => cartridgeFeature("Laser")).toThrow();
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
			developers: [],
			publishers: [],
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
				gameBoyColorEnhanced: true,
			}),
			release("dmg-2", { title: "Asteroids", licensing: "pirate" }),
		];
		const entry = (list: WikipediaEntry["list"]): WikipediaEntry => ({
			list,
			developers: [],
			publishers: [],
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
			developers: [],
			publishers: [],
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

test("addWikipedia adds what the matched rows say about the release's regions", () => {
	const row: WikipediaEntry = {
		...tetris,
		titles: [
			{ title: "Tetris", regions: [] },
			{ title: "Tetris DX", regions: ["NA"] },
		],
		publishers: [
			{ name: "Nintendo", regions: ["JP"] },
			{ name: "Nintendo of America", regions: ["NA"] },
		],
		cartridgeFeature: "Rumble Pak (JP only)",
	};
	const { releases } = addWikipedia(
		[
			release("DMG-TRA", {
				title: "Tetris",
				serials: ["DMG-TRA"],
				titleCandidates: [{ title: "Tetris", source: "no-intro.org" }],
			}),
		],
		[row],
	);
	expect(publishedRelease(releases[0]!)).toMatchObject({
		title: { title: "Tetris", sources: ["no-intro.org", "en.wikipedia.org"] },
		cartridgeFeatures: ["rumble"],
		releaseDates: [{ region: "Japan", date: "1989-06-14" }],
		publishers: ["Nintendo"],
		wikipediaArticles: [
			"https://en.wikipedia.org/wiki/Tetris_(Game_Boy_video_game)",
		],
	});
	expect(releases[0]!.records).toEqual({ "en.wikipedia.org": [row] });
});
