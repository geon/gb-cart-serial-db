import { isStemKey, type Link } from "./links.ts";
import { connectedSets, members } from "./union-find.ts";

// A stem whose groups are in different No-Intro families, and so weren't merged.
export type StemContradiction = {
	stem: string;
	/** The record keys of each group the stem would have merged. */
	groups: string[][];
};

// Groups the linked keys into games.
//
// First, keys are grouped by the strong links: ROM checksums, ROM chip serials, label serials, codes and header codes.
// Then groups sharing a stem (the product code without its region letter, e.g. "DMG-APA" for the English "DMG-APAE"
// and German "DMG-APAD" Pokemon Red) are merged, unless No-Intro puts them in different families. Such stems are only
// followed when confirmed by hand.
export function groupGames(
	links: readonly Link[],
	// The No-Intro family of a record key, if it is a No-Intro record.
	familyOf: (recordKey: string) => string | undefined,
	confirmedStems: ReadonlySet<string>,
	// Product codes that aren't the same game as the rest of their stem, e.g. "DMG-MQJ".
	separateCodes: ReadonlySet<string> = new Set(),
	// The titles of a record key.
	titlesOf: (recordKey: string) => readonly string[] = () => [],
): {
	gameOf: Map<string, string>;
	contradictions: StemContradiction[];
	unverified: StemContradiction[];
} {
	const strongLinks = links.filter(({ to }) => !isStemKey(to));
	const stemLinks = links.filter(
		({ from, to }) =>
			isStemKey(to) && !separateCodes.has(from.replace(/^code:/, "")),
	);

	const strongGroupOf = connectedSets(
		strongLinks.map(({ from, to }) => [from, to] as const),
	);
	const strongGroupMembers = members(strongGroupOf);
	const titleWordsOf = (group: string) => [
		...new Set(
			(strongGroupMembers.get(group) ?? [])
				.flatMap(titlesOf)
				.flatMap(titleWords),
		),
	];
	const familiesOf = (group: string) =>
		new Set(
			(strongGroupMembers.get(group) ?? [])
				.map(familyOf)
				.filter((family) => family !== undefined),
		);

	// For each stem, the groups it may merge: all of them, or, when No-Intro puts them in different families and the stem
	// isn't confirmed, only the groups of the same family. Groups without a No-Intro entry join a family only when there is
	// just one.
	const stems = [...new Set(stemLinks.map(({ to }) => to))];
	const verdicts = stems.map((stem) => {
		const groups = [
			...new Set(
				stemLinks
					.filter(({ to }) => to === stem)
					.map(({ from }) => strongGroupOf.get(from) ?? from),
			),
		];
		const groupFamilies = groups.map((group) => ({
			group,
			family: [...familiesOf(group)].sort().join(" "),
		}));
		const families = [
			...new Set(
				groupFamilies.map(({ family }) => family).filter((family) => family),
			),
		];
		const confirmed = confirmedStems.has(stem.slice("stem:".length));
		const merges =
			confirmed || families.length <= 1
				? [groups]
				: families.map((family) =>
						groupFamilies
							.filter((groupFamily) => groupFamily.family === family)
							.map(({ group }) => group),
					);
		// Groups without a No-Intro entry can't be checked against its families. Those whose titles share no word with
		// the others are merged, since localized titles often differ, e.g. Mega Man II and Rockman World 2, but listed for
		// review, e.g. Maerchen Club (DMG-MQJ) with Super Mario Land 2 (DMG-MQ).
		const unverified = confirmed
			? []
			: merges.flatMap((groups) => {
					const anchored = groups.filter((group) => familiesOf(group).size);
					const anchor = anchored.length ? anchored : groups.slice(0, 1);
					const anchorWords = new Set(anchor.flatMap(titleWordsOf));
					return groups.filter(
						(group) =>
							!anchor.includes(group) &&
							!titleWordsOf(group).some((word) => anchorWords.has(word)),
					);
				});
		return {
			stem,
			groups,
			merges,
			unverified,
			contradicted: !confirmed && families.length > 1,
		};
	});

	const gameOf = connectedSets([
		...strongLinks.map(({ from, to }) => [from, to] as const),
		...verdicts.flatMap(({ merges }) =>
			merges.flatMap(([first, ...rest]) =>
				rest.map((group) => [first!, group] as const),
			),
		),
	]);

	const recordsOf = (group: string) =>
		(strongGroupMembers.get(group) ?? []).filter((key) =>
			key.startsWith("record:"),
		);

	return {
		gameOf,
		unverified: verdicts
			.filter(({ unverified }) => unverified.length)
			.map(({ stem, merges }) => ({
				stem: stem.slice("stem:".length),
				groups: merges.flat().map(recordsOf),
			})),
		contradictions: verdicts
			.filter(({ contradicted }) => contradicted)
			.map(({ stem, groups }) => ({
				stem: stem.slice("stem:".length),
				groups: groups.map((group) =>
					(strongGroupMembers.get(group) ?? []).filter((key) =>
						key.startsWith("record:"),
					),
				),
			})),
	};
}

const minorWords = new Set(
	"the of and no de le la les der die das el game boy gb gbc gba for in a an to".split(
		" ",
	),
);

// Words of a title, for comparing titles in different languages, e.g. "Addams Family, The" and "Addams Family (the)".
function titleWords(title: string): string[] {
	return title
		.normalize("NFKC")
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.split(/[^\p{L}\p{N}]+/u)
		.filter((word) => word.length > 1 && !minorWords.has(word));
}
