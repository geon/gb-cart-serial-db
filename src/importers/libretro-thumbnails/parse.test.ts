import { describe, expect, test } from "vitest";
import { parseLibretroThumbnailsTree, type GitTree } from "./parse.ts";

const sha = "f033af49af2d9761d6821aff479bb0ba5feea5e3";
const base = `https://raw.githubusercontent.com/libretro-thumbnails/Nintendo_-_Game_Boy/${sha}`;

function tree(entries: GitTree["tree"]): GitTree {
	return { sha, truncated: false, tree: entries };
}

const file = (path: string) => ({ path, mode: "100644", type: "blob" });
const symlink = (path: string) => ({ path, mode: "120000", type: "blob" });

describe("parseLibretroThumbnailsTree", () => {
	test("groups images by name and resolves symlinks", () => {
		expect(
			parseLibretroThumbnailsTree(
				"Nintendo_-_Game_Boy",
				tree([
					file(".gitignore"),
					{ path: "Named_Titles", mode: "040000", type: "tree" },
					file("Named_Titles/Tetris (World) (Rev 1).png"),
					file("Named_Snaps/Tetris (World) (Rev 1).png"),
					file("Named_Boxarts/Tetris (World) (Rev 1).png"),
					symlink("Named_Boxarts/Tetris (World).png"),
					file("Named_Logos/Tetris (World) (Rev 1).png"),
				]),
				{ "Named_Boxarts/Tetris (World).png": "Tetris (World) (Rev 1).png" },
			),
		).toEqual([
			{
				repository: "Nintendo_-_Game_Boy",
				name: "Tetris (World)",
				boxArtUrl: `${base}/Named_Boxarts/Tetris%20(World)%20(Rev%201).png`,
			},
			{
				repository: "Nintendo_-_Game_Boy",
				name: "Tetris (World) (Rev 1)",
				titleScreenshotUrl: `${base}/Named_Titles/Tetris%20(World)%20(Rev%201).png`,
				gameplayScreenshotUrl: `${base}/Named_Snaps/Tetris%20(World)%20(Rev%201).png`,
				boxArtUrl: `${base}/Named_Boxarts/Tetris%20(World)%20(Rev%201).png`,
			},
		]);
	});

	test("throws on unexpected content", () => {
		const parse = (entries: GitTree["tree"], symlinks = {}) =>
			parseLibretroThumbnailsTree(
				"Nintendo_-_Game_Boy",
				tree(entries),
				symlinks,
			);
		expect(() => parse([file("Named_Covers/Tetris.png")])).toThrow();
		expect(() => parse([file("Named_Titles/Tetris.jpg")])).toThrow();
		expect(() => parse([symlink("Named_Titles/Tetris.png")])).toThrow();
		expect(() =>
			parseLibretroThumbnailsTree(
				"Nintendo_-_Game_Boy",
				{ ...tree([]), truncated: true },
				{},
			),
		).toThrow();
	});
});
