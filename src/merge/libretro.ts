import type {
	NoIntroDat,
	NoIntroEntry,
} from "../importers/no-intro.org/parse.ts";
import type {
	LibretroThumbnailsEntry,
	LibretroThumbnailsRepository,
} from "../importers/libretro-thumbnails/parse.ts";
import { libretroName } from "./links.ts";

// Matches the libretro-thumbnails images to No-Intro entries by name. The repositories name the images after the
// No-Intro name, but some names are older than the No-Intro export, e.g. "Aerostar (Japan)" for "Aerostar (Japan) (En)",
// "Megaman Zero 2 (USA)" for "Mega Man Zero 2 (USA)". Entries without an image of the exact name get the image whose
// title is the same, ignoring case, spaces and punctuation, and whose tags are all in the No-Intro name, starting with
// the same regions. Only one-to-one matches are made.

export type LibretroMatch = {
	repository: LibretroThumbnailsRepository;
	libretroName: string;
	noIntroName: string;
};

const repositories: Record<NoIntroDat, LibretroThumbnailsRepository> = {
	dmg: "Nintendo_-_Game_Boy",
	cgb: "Nintendo_-_Game_Boy_Color",
	agb: "Nintendo_-_Game_Boy_Advance",
};

// The title and parenthesized tags of a name, e.g. "megamanzero2" and ["usa"] for "Megaman Zero 2 (USA)". Names with
// bracketed tags, e.g. "[Hack by …]", "[b]", aren't No-Intro names and get no title.
export function nameParts(name: string): { title: string; tags: string[] } {
	const [, title = "", tags = ""] =
		name.match(/^([^([]*?)\s*((?:\([^)]*\)\s*)*)$/) ?? [];
	const normalized = (text: string) =>
		text
			.normalize("NFKD")
			.toLowerCase()
			.replace(/[^\p{L}\p{N}]+/gu, "");
	return {
		title: normalized(title),
		tags: [...tags.matchAll(/\(([^)]*)\)/g)].map(([, tag]) => normalized(tag!)),
	};
}

export function matchLibretro(
	noIntro: readonly NoIntroEntry[],
	libretro: readonly LibretroThumbnailsEntry[],
): {
	/** The images of a No-Intro entry, by its URL. */
	imagesOf: (noIntroUrl: string) => LibretroThumbnailsEntry | undefined;
	/** The matches made by title and tags, not the exact name. */
	fuzzyMatches: LibretroMatch[];
} {
	const byName = new Map(
		libretro.map((entry) => [`${entry.repository}/${entry.name}`, entry]),
	);
	const exactName = (entry: NoIntroEntry) =>
		`${repositories[entry.dat]}/${libretroName(entry.noIntroName)}`;
	const exact = new Map(
		noIntro.flatMap((entry) => {
			const images = byName.get(exactName(entry));
			return images ? [[entry.url, images] as const] : [];
		}),
	);

	const used = new Set(exact.values());
	const unmatchedImages = libretro.filter((entry) => !used.has(entry));
	const unmatchedEntries = noIntro.filter((entry) => !exact.has(entry.url));
	const fits = (entry: NoIntroEntry, images: LibretroThumbnailsEntry) => {
		if (repositories[entry.dat] !== images.repository) {
			return false;
		}
		const entryParts = nameParts(entry.noIntroName);
		const imageParts = nameParts(images.name);
		return (
			imageParts.title !== "" &&
			imageParts.title === entryParts.title &&
			imageParts.tags[0] === entryParts.tags[0] &&
			imageParts.tags.every((tag) => entryParts.tags.includes(tag))
		);
	};
	const imagesByTitle = Map.groupBy(
		unmatchedImages,
		(images) => `${images.repository}/${nameParts(images.name).title}`,
	);
	const entriesByTitle = Map.groupBy(
		unmatchedEntries,
		(entry) =>
			`${repositories[entry.dat]}/${nameParts(entry.noIntroName).title}`,
	);
	const fuzzy = unmatchedEntries.flatMap((entry) => {
		const title = `${repositories[entry.dat]}/${nameParts(entry.noIntroName).title}`;
		const [images, ...others] = (imagesByTitle.get(title) ?? []).filter(
			(images) => fits(entry, images),
		);
		return images &&
			!others.length &&
			(entriesByTitle.get(title) ?? []).filter((other) => fits(other, images))
				.length === 1
			? [{ entry, images }]
			: [];
	});

	const images = new Map([
		...exact,
		...fuzzy.map(({ entry, images }) => [entry.url, images] as const),
	]);
	return {
		imagesOf: (noIntroUrl) => images.get(noIntroUrl),
		fuzzyMatches: fuzzy.map(({ entry, images }) => ({
			repository: images.repository,
			libretroName: images.name,
			noIntroName: entry.noIntroName,
		})),
	};
}
