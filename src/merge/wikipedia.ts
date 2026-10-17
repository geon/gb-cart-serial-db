import type { WikipediaEntry } from "../importers/en.wikipedia.org/parse.ts";
import { parseLabelSerial } from "../serials.ts";
import type { GameSystem, Release } from "./build.ts";
import { titleKey } from "./title-key.ts";

// Adds release years from Wikipedia's lists of games to the releases. Wikipedia's rows have no serials, so they are
// matched to games by title and system after the games are grouped, and don't affect the grouping. Rows matching
// several games, e.g. a game and its Chinese release, are left out and reported, unless the games are of the same
// No-Intro family, e.g. Link's Awakening's DMG-ZL and DMG-ZC.
//
// The regions here only pick the year of each release, e.g. 1989 for the Japanese Tetris and 1990 for the European,
// and aren't in the database.

type Region = "Japan" | "North America" | "Europe" | "Australia" | "Korea";

// The lists' "PAL" and "EU" are "much of Europe and Australia" (Game Boy Color list) and "Territories including much of
// Europe, Australia, New Zealand, and parts of Asia" (Game Boy Advance list). The Game Boy list doesn't say.
const wikipediaRegions: Record<string, readonly Region[]> = {
	JP: ["Japan"],
	NA: ["North America"],
	US: ["North America"],
	PAL: ["Europe", "Australia"],
	EU: ["Europe", "Australia"],
	UK: ["Europe"],
	DE: ["Europe"],
	FR: ["Europe"],
	AU: ["Australia"],
	AUS: ["Australia"],
	KOR: ["Korea"],
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
export function releaseRegions(release: Release): Region[] {
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
	const fromRoms = release.roms.flatMap(({ regions }) =>
		regions.flatMap((region) => noIntroRegions[region] ?? []),
	);
	return [...new Set(fromSerials.length ? fromSerials : fromRoms)];
}

// The systems of the games in each list. The Game Boy Color list also has the black cartridges, which fit all
// Game Boys.
const listSystems: Record<WikipediaEntry["list"], readonly GameSystem[]> = {
	dmg: ["dmg"],
	cgb: ["dmg", "cgb"],
	agb: ["agb"],
};

const listUrls: Record<WikipediaEntry["list"], string> = {
	dmg: "https://en.wikipedia.org/wiki/List_of_Game_Boy_games",
	cgb: "https://en.wikipedia.org/wiki/List_of_Game_Boy_Color_games",
	agb: "https://en.wikipedia.org/wiki/List_of_Game_Boy_Advance_games",
};

type GameSummary = {
	system: GameSystem | undefined;
	familyIds: Set<string>;
	titleKeys: Set<string>;
	licensed: boolean;
	color: boolean;
	chineseOnly: boolean;
};

function summarizeGames(
	releases: readonly Release[],
): Map<string, GameSummary> {
	const byGame = Map.groupBy(releases, ({ gameId }) => gameId);
	return new Map(
		[...byGame].map(([gameId, gameReleases]) => [
			gameId,
			{
				system: gameReleases.find(({ system }) => system)?.system,
				familyIds: new Set(gameReleases.map(({ familyId }) => familyId)),
				titleKeys: new Set(
					gameReleases.flatMap(({ title, titles }) => [
						titleKey(title),
						...titles.map(({ title }) => titleKey(title)),
					]),
				),
				licensed: gameReleases.some(({ licensing }) => !licensing),
				color: gameReleases.some(
					({ system, roms }) =>
						system === "cgb" ||
						roms.some(({ gameBoyColorEnhanced }) => gameBoyColorEnhanced),
				),
				chineseOnly: gameReleases.every(({ id }) => id.endsWith(" CHN")),
			},
		]),
	);
}

// The candidates the predicate keeps, or all of them if it keeps none.
function prefer<T>(candidates: T[], predicate: (candidate: T) => boolean): T[] {
	const preferred = candidates.filter(predicate);
	return preferred.length ? preferred : candidates;
}

// The games of each entry: the games with one of its titles on the list's systems, preferring licensed games, games
// with releases outside China, and games whose Color support fits the list. Empty if none, or several unrelated games
// remain.
export function matchWikipedia(
	releases: readonly Release[],
	entries: readonly WikipediaEntry[],
): {
	gameIds: string[][];
	ambiguous: { entry: WikipediaEntry; gameIds: string[] }[];
} {
	const games = summarizeGames(releases);
	const gamesByKey = Map.groupBy(
		[...games].flatMap(([gameId, game]) =>
			[...game.titleKeys].map((key) => ({
				key: `${game.system}/${key}`,
				gameId,
			})),
		),
		({ key }) => key,
	);
	const matches = entries.map((entry) => {
		const found = [
			...new Set(
				listSystems[entry.list].flatMap((system) =>
					entry.titles.flatMap(({ title }) =>
						(gamesByKey.get(`${system}/${titleKey(title)}`) ?? []).map(
							({ gameId }) => gameId,
						),
					),
				),
			),
		];
		const game = (gameId: string) => games.get(gameId)!;
		const narrowed = [
			(gameId: string) => game(gameId).licensed,
			(gameId: string) => !game(gameId).chineseOnly,
			(gameId: string) =>
				entry.list === "agb" || game(gameId).color === (entry.list === "cgb"),
		].reduce(prefer, found);
		const families = new Set(
			narrowed.flatMap((gameId) => [...game(gameId).familyIds]),
		);
		return {
			entry,
			gameIds: families.size > 1 ? [] : narrowed,
			found: narrowed,
		};
	});
	return {
		gameIds: matches.map(({ gameIds }) => gameIds),
		ambiguous: matches
			.filter(({ gameIds, found }) => !gameIds.length && found.length)
			.map(({ entry, found }) => ({ entry, gameIds: found })),
	};
}

// The earliest year in the release's regions, or else the earliest year of the game, e.g. for a release without known
// regions.
export function releaseYear(
	release: Release,
	entries: readonly WikipediaEntry[],
): number | undefined {
	const regions = releaseRegions(release);
	// The regions of each date. A row's own Australian date replaces its PAL date there.
	const dates = entries.flatMap(({ releaseDates }) => {
		const hasAustralia = releaseDates.some(
			({ region }) => region === "AU" || region === "AUS",
		);
		return releaseDates.map(({ region, date }) => ({
			date,
			regions:
				region === undefined
					? undefined
					: (wikipediaRegions[region] ?? []).filter(
							(dateRegion) =>
								!(
									hasAustralia &&
									dateRegion === "Australia" &&
									(region === "PAL" || region === "EU")
								),
						),
		}));
	});
	const years = (dates: readonly { date: string }[]) =>
		dates.map(({ date }) => Number(date.slice(0, 4)));
	const inRegions = dates.filter(
		({ regions: dateRegions }) =>
			dateRegions === undefined ||
			dateRegions.some((region) => regions.includes(region)),
	);
	const [year] = [...years(inRegions.length ? inRegions : dates)].sort(
		(a, b) => a - b,
	);
	return year;
}

export function addWikipedia(
	releases: readonly Release[],
	entries: readonly WikipediaEntry[],
): {
	releases: Release[];
	ambiguous: { list: string; titles: string[]; gameIds: string[] }[];
} {
	const { gameIds, ambiguous } = matchWikipedia(releases, entries);
	const entriesOfGame = Map.groupBy(
		entries.flatMap((entry, index) =>
			gameIds[index]!.map((gameId) => ({ gameId, entry })),
		),
		({ gameId }) => gameId,
	);
	return {
		releases: releases.map((release) => {
			const gameEntries = (entriesOfGame.get(release.gameId) ?? []).map(
				({ entry }) => entry,
			);
			const wikipediaLinks = gameEntries.flatMap((entry) => [
				{
					source: "en.wikipedia.org",
					url: listUrls[entry.list],
					label: "List",
				},
				...(entry.articleUrl
					? [
							{
								source: "en.wikipedia.org",
								url: entry.articleUrl,
								label: "Article",
							},
						]
					: []),
			]);
			// Before the search links, e.g. pricecharting.com.
			const isSearch = ({ label }: { label: string }) => label === "Search";
			const year = releaseYear(release, gameEntries);
			return {
				...release,
				...(year !== undefined && { releaseYear: year }),
				links: [
					...release.links.filter((link) => !isSearch(link)),
					...wikipediaLinks.filter(
						(link, index) =>
							wikipediaLinks.findIndex(({ url }) => url === link.url) === index,
					),
					...release.links.filter(isSearch),
				],
			};
		}),
		ambiguous: ambiguous.map(({ entry, gameIds }) => ({
			list: entry.list,
			titles: entry.titles.map(({ title }) => title),
			gameIds,
		})),
	};
}
