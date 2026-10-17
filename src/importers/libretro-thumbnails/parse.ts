// Images in the libretro-thumbnails repositories, e.g. https://github.com/libretro-thumbnails/Nintendo_-_Game_Boy,
// named after the No-Intro name of the ROM.
export type LibretroThumbnailsEntry = {
	repository: LibretroThumbnailsRepository;
	/** The No-Intro name, with the characters &*\/:`<>?\|" replaced by "_" as in the file names, e.g. "Tetris (World) (Rev 1)". */
	name: string;
	/** Front of the box. */
	boxArtUrl?: string;
	/** Screenshot of the title screen. */
	titleScreenshotUrl?: string;
	/** Screenshot of gameplay. */
	gameplayScreenshotUrl?: string;
};

export type LibretroThumbnailsRepository =
	| "Nintendo_-_Game_Boy"
	| "Nintendo_-_Game_Boy_Color"
	| "Nintendo_-_Game_Boy_Advance";

// The GitHub API's git tree of a commit, e.g. https://api.github.com/repos/libretro-thumbnails/Nintendo_-_Game_Boy/git/trees/<commit>?recursive=1
export type GitTree = {
	sha: string;
	truncated: boolean;
	tree: { path: string; mode: string; type: string }[];
};

const folders = {
	Named_Boxarts: "boxArtUrl",
	Named_Titles: "titleScreenshotUrl",
	Named_Snaps: "gameplayScreenshotUrl",
} as const;

// Logos aren't used.
const ignoredPaths = /^(?:\.gitignore$|Named_Logos\/)/;
const symlinkMode = "120000";

export function parseLibretroThumbnailsTree(
	repository: LibretroThumbnailsRepository,
	tree: GitTree,
	// Symlink path -> target, relative to the symlink's folder.
	symlinks: Readonly<Record<string, string>>,
): LibretroThumbnailsEntry[] {
	if (tree.truncated) {
		throw new Error("Truncated tree");
	}
	const blobs = tree.tree.filter(
		({ type, path }) => type === "blob" && !ignoredPaths.test(path),
	);
	const paths = new Set(blobs.map(({ path }) => path));

	const images = blobs.map(({ path, mode }) => {
		const [, folder, name] = path.match(/^([^/]+)\/([^/]+)\.png$/) ?? [];
		if (!(folder && name && folder in folders)) {
			throw new Error(`Unexpected path: ${path}`);
		}
		const target = mode === symlinkMode ? `${folder}/${symlinks[path]}` : path;
		if (!paths.has(target)) {
			throw new Error(`Missing symlink target for ${path}: ${target}`);
		}
		return {
			name,
			key: folders[folder as keyof typeof folders],
			url: `https://raw.githubusercontent.com/libretro-thumbnails/${repository}/${tree.sha}/${encodeURIComponent(target).replaceAll("%2F", "/")}`,
		};
	});

	const names = [...new Set(images.map(({ name }) => name))].sort();
	return names.map((name) => ({
		repository,
		name,
		...Object.fromEntries(
			images
				.filter((image) => image.name === name)
				.map(({ key, url }) => [key, url]),
		),
	}));
}
