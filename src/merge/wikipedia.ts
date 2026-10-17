import type { WikipediaEntry } from "../importers/en.wikipedia.org/parse.ts";
import {
	groupRecords,
	mergeTitles,
	recordEntries,
	type ReleaseDraft,
} from "./build.ts";
import type {
	CartridgeFeature,
	GameSystem,
	Region,
	ReleaseDate,
} from "../release.ts";
import { titleKey } from "./title-key.ts";
import { titleLanguage } from "./languages.ts";
import { releaseLanguage, releaseRegions } from "./regions.ts";

// Adds what Wikipedia's lists of games say to the releases: release dates, developers, publishers, titles, cartridge
// features and the game's article. Wikipedia's rows have no serials, so they are matched to games by title and system
// after the games are grouped, and don't affect the grouping. Rows matching several games, e.g. a game and its Chinese
// release, are left out and reported, unless the games are of the same No-Intro family, e.g. Link's Awakening's DMG-ZL
// and DMG-ZC.
//
// A row is about a game, so each release only gets what the row says about its regions, e.g. the date 1989 for the
// Japanese Tetris and 1990 for the European, and the Japanese publisher only for the Japanese release. A release of
// unknown regions gets all of it.

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
	ES: ["Europe"],
	IT: ["Europe"],
	NL: ["Europe"],
	DK: ["Europe"],
	SW: ["Europe"],
	// Once, for a Dutch title.
	NE: ["Europe"],
	AU: ["Australia"],
	AUS: ["Australia"],
	KOR: ["Korea"],
	KR: ["Korea"],
};

const allRegions: readonly Region[] = [
	"Japan",
	"North America",
	"Europe",
	"Australia",
	"Korea",
];

// The systems of the games in each list. The Game Boy Color list also has the black cartridges, which fit all
// Game Boys.
const listSystems: Record<WikipediaEntry["list"], readonly GameSystem[]> = {
	dmg: ["dmg"],
	cgb: ["dmg", "cgb"],
	agb: ["agb"],
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
	releases: readonly ReleaseDraft[],
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
					({ system, gameBoyColorEnhanced }) =>
						system === "cgb" || gameBoyColorEnhanced,
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
	releases: readonly ReleaseDraft[],
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

// The regions of Wikipedia's region codes, e.g. ["Europe", "Australia"] for ["PAL"]. Undefined if the codes say nothing,
// e.g. no codes, or a code not in wikipediaRegions.
function regionsOfCodes(codes: readonly string[]): Region[] | undefined {
	const regions = codes.map((code) => wikipediaRegions[code]);
	return regions.length && regions.every((region) => region !== undefined)
		? [...new Set(regions.flat())]
		: undefined;
}

// Whether something said about the given regions applies to a release in the release regions.
function applies(
	regions: readonly Region[] | undefined,
	releaseRegions: readonly Region[],
): boolean {
	return (
		regions === undefined ||
		!releaseRegions.length ||
		regions.some((region) => releaseRegions.includes(region))
	);
}

// The game's release dates in the release's regions, earliest first, or all of them for a release of unknown regions.
export function releaseDates(
	release: ReleaseDraft,
	entries: readonly WikipediaEntry[],
): ReleaseDate[] {
	const regions = releaseRegions(release);
	const dates = entries.flatMap(({ releaseDates }) => {
		// A row's own Australian date replaces its PAL date there.
		const hasAustralia = releaseDates.some(
			({ region }) => region === "AU" || region === "AUS",
		);
		return releaseDates.flatMap(({ region, date }): ReleaseDate[] =>
			region === undefined
				? [{ date }]
				: (wikipediaRegions[region] ?? [])
						.filter(
							(dateRegion) =>
								!(
									hasAustralia &&
									dateRegion === "Australia" &&
									(region === "PAL" || region === "EU")
								) &&
								(!regions.length || regions.includes(dateRegion)),
						)
						.map((dateRegion) => ({ region: dateRegion, date })),
		);
	});
	return dates
		.filter(
			(date, index) =>
				dates.findIndex(
					(other) => other.region === date.region && other.date === date.date,
				) === index,
		)
		.sort(
			(a, b) =>
				a.date.localeCompare(b.date) ||
				(a.region ?? "").localeCompare(b.region ?? ""),
		);
}

// The names credited in the release's regions.
function credited(
	credits: readonly { name: string; regions: string[] }[],
	releaseRegions: readonly Region[],
): string[] {
	return credits
		.filter(({ regions }) => applies(regionsOfCodes(regions), releaseRegions))
		.map(({ name }) => name);
}

// The languages of the region codes of Wikipedia's titles, e.g. "de" for "DE". Japanese titles are in Latin letters.
const regionLanguages: Record<string, string> = {
	JP: "ja",
	NA: "en",
	US: "en",
	UK: "en",
	AU: "en",
	AUS: "en",
	DE: "de",
	FR: "fr",
	ES: "es",
	IT: "it",
	NL: "nl",
	NE: "nl",
	DK: "da",
	SW: "sv",
	KOR: "ko",
	KR: "ko",
};

// The language of a title's region codes, ignoring codes of several languages, e.g. "en" for ["NA", "PAL"].
function titleRegionLanguage(codes: readonly string[]): string | undefined {
	const languages = [
		...new Set(codes.flatMap((code) => regionLanguages[code] ?? [])),
	];
	return languages.length === 1 ? languages[0] : undefined;
}

// The regions of each of a row's titles. A title without regions is for the regions the other titles aren't, e.g.
// "Pokémon Emerald" for all but Japan when "Pocket Monsters Emerald" is for Japan. Undefined if nothing tells.
export function wikipediaTitleRegions(
	titles: WikipediaEntry["titles"],
): (Region[] | undefined)[] {
	const others = titles.flatMap(({ regions }) => regionsOfCodes(regions) ?? []);
	return titles.map(({ regions }) =>
		regions.length
			? regionsOfCodes(regions)
			: others.length
				? allRegions.filter((region) => !others.includes(region))
				: undefined,
	);
}

// The Game Boy Color list's "Cartridge feature" column, e.g. "Rumble Pak (JP only)".
export function cartridgeFeature(text: string): {
	feature: CartridgeFeature;
	regions?: Region[];
} {
	const [, name = text, only] = text.match(/^(.*?) \((Japan|JP) only\)$/) ?? [];
	const feature = (
		[
			[/^Rumble Pak$/, "rumble"],
			[/^Real-time clock$/, "realTimeClock"],
			[/^Tilt sensor$/, "tiltSensor"],
			[/^Infrared Receiver$/, "infrared"],
			[/^GBA Special Features$/, "gameBoyAdvanceFeatures"],
			[/sewing machines$/, "sewingMachine"],
		] as const
	).find(([pattern]) => pattern.test(name))?.[1];
	if (!feature) {
		throw new Error(`Unexpected cartridge feature: ${text}`);
	}
	return only ? { feature, regions: ["Japan"] } : { feature };
}

export function addWikipedia(
	releases: readonly ReleaseDraft[],
	entries: readonly WikipediaEntry[],
): {
	releases: ReleaseDraft[];
	ambiguous: { list: string; titles: string[]; gameIds: string[] }[];
} {
	const { gameIds, ambiguous } = matchWikipedia(releases, entries);
	const entriesOfGame = Map.groupBy(
		entries.flatMap((entry, index) =>
			gameIds[index]!.map((gameId) => ({ gameId, entry })),
		),
		({ gameId }) => gameId,
	);
	const gamesOutsideJapan = new Set(
		releases
			.filter((release) =>
				releaseRegions(release).some((region) => region !== "Japan"),
			)
			.map(({ gameId }) => gameId),
	);
	return {
		releases: releases.map((release) => {
			const gameEntries = (entriesOfGame.get(release.gameId) ?? []).map(
				({ entry }) => entry,
			);
			const regions = releaseRegions(release);
			// A title the row gives no regions for, e.g. "The Legend of Zelda: Link's Awakening", is the English title
			// of a game also sold outside Japan, not the title of its Japanese release.
			const onlyJapan =
				regions.length === 1 &&
				regions[0] === "Japan" &&
				gamesOutsideJapan.has(release.gameId);
			const language = releaseLanguage(release);
			const titleCandidates = [
				...release.titleCandidates,
				...gameEntries.flatMap(({ titles }) => {
					const titleRegions = wikipediaTitleRegions(titles);
					return titles.flatMap(({ title, regions: codes }, index) => {
						// A title without regions on a release sold outside Japan is the English title.
						const titleLanguageOfRegions =
							codes.length || !regions.some((region) => region !== "Japan")
								? titleRegionLanguage(codes)
								: "en";
						const tag = titleLanguage(title, titleLanguageOfRegions);
						// A release sold in one language only gets the titles in it, e.g. "La Gang del Bosco" for
						// the Italian Over the Hedge, not "Nos Voisins, les Hommes", though both are for Europe.
						const otherLanguage =
							language !== undefined &&
							tag !== undefined &&
							tag.split("-")[0] !== language;
						return applies(titleRegions[index], regions) &&
							!otherLanguage &&
							!(onlyJapan && titleRegions[index] === undefined)
							? [
									{
										title,
										...(tag !== undefined && { language: tag }),
										source: "en.wikipedia.org",
										official: true as const,
									},
								]
							: [];
					});
				}),
			];
			// Releases in several languages, e.g. DMG-TR, are named in English first.
			const titles = mergeTitles(titleCandidates, language ?? "en");
			const features = gameEntries.flatMap(({ cartridgeFeature: text }) => {
				if (text === undefined) {
					return [];
				}
				const { feature, regions: featureRegions } = cartridgeFeature(text);
				return applies(featureRegions, regions) ? [feature] : [];
			});
			const unique = (values: readonly string[]) => [...new Set(values)];
			return {
				...release,
				title: titles[0]!.title,
				titles,
				titleCandidates,
				cartridgeFeatures: [
					...new Set([...release.cartridgeFeatures, ...features]),
				],
				releaseDates: releaseDates(release, gameEntries),
				developers: unique(
					gameEntries.flatMap(({ developers }) =>
						credited(developers, regions),
					),
				),
				publishers: unique(
					gameEntries.flatMap(({ publishers }) =>
						credited(publishers, regions),
					),
				),
				wikipediaArticles: unique(
					gameEntries.flatMap(({ articleUrl }) => articleUrl ?? []),
				),
				records: groupRecords([
					...recordEntries(release.records),
					...gameEntries.map((entry) => ({
						source: "en.wikipedia.org" as const,
						entry,
					})),
				]),
			};
		}),
		ambiguous: ambiguous.map(({ entry, gameIds }) => ({
			list: entry.list,
			titles: entry.titles.map(({ title }) => title),
			gameIds,
		})),
	};
}
