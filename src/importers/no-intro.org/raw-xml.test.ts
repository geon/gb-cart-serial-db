import { describe, expect, test } from "vitest";
import { parseRawXml } from "./raw-xml.ts";

const header = `<header>
	<version>20260919-114245</version>
	<author>No-Intro</author>
	<url>https://www.no-intro.org</url>
	<trademarks>Trademarks.</trademarks>
	<piracy>Piracy.</piracy>
</header>`;

function xml(...games: string[]) {
	return `<?xml version="1.0" encoding="utf-8"?>
${header}
<datafile>
	${games.join("\n")}
</datafile>`;
}

const tetris = `<game name="Tetris (World) (Rev 1)">
	<archive number="0001" clone="P" name="Tetris" region="World" languages="En" version1="Rev 1"/>
	<source>
		<details id="1" section="Trusted Dump" d_date="2009-01-01" region="Japan" dumper="Someone" project="No-Intro" originalformat="Default"/>
		<serials media_serial1="DMG-TRA-1" pcb_serial="DMG-AAA-03"/>
		<file id="10" extension="gb" size="32768" crc32="46df91ad" md5="982ed5d2b12a0377eb14bcdc4123744e" sha1="74591cc9501af93873f9a5d3eb12da12c0723bbc" format="Default"/>
	</source>
	<release>
		<details id="2" dirname="Tetris_GB" nfoname="tetris" nfo_size="100" nfo_crc32="00000000" originalformat="Default" date="2000-01-01" group="Group" region="World" origin="Scene"/>
		<serials/>
		<file id="10" extension="gb" size="32768" crc32="46df91ad" md5="982ed5d2b12a0377eb14bcdc4123744e" sha1="74591cc9501af93873f9a5d3eb12da12c0723bbc" format="Default"/>
	</release>
</game>`;

const file = {
	id: "10",
	extension: "gb",
	size: "32768",
	crc32: "46df91ad",
	md5: "982ed5d2b12a0377eb14bcdc4123744e",
	sha1: "74591cc9501af93873f9a5d3eb12da12c0723bbc",
	format: "Default",
};

describe("parseRawXml", () => {
	test("keeps elements and attributes as in the XML, decoding entities", () => {
		expect(
			parseRawXml(
				xml(tetris.replace('name="Tetris"', 'name="Tetris &amp; Co"')),
			),
		).toEqual([
			{
				name: "Tetris (World) (Rev 1)",
				archive: {
					number: "0001",
					clone: "P",
					name: "Tetris & Co",
					region: "World",
					languages: "En",
					version1: "Rev 1",
				},
				sources: [
					{
						details: {
							id: "1",
							section: "Trusted Dump",
							d_date: "2009-01-01",
							region: "Japan",
							dumper: "Someone",
							project: "No-Intro",
							originalformat: "Default",
						},
						serials: { media_serial1: "DMG-TRA-1", pcb_serial: "DMG-AAA-03" },
						files: [file],
					},
				],
				releases: [
					{
						details: {
							id: "2",
							dirname: "Tetris_GB",
							nfoname: "tetris",
							nfo_size: "100",
							nfo_crc32: "00000000",
							originalformat: "Default",
							date: "2000-01-01",
							group: "Group",
							region: "World",
							origin: "Scene",
						},
						serials: {},
						files: [file],
					},
				],
			},
		]);
	});

	test("throws on unexpected content", () => {
		const source = /<source>[\s\S]*<\/source>/.exec(tetris)![0];
		const release = /<release>[\s\S]*<\/release>/.exec(tetris)![0];
		const variants = [
			tetris.replace('clone="P"', 'clone="P" unknown="x"'),
			tetris.replace('region="World" languages="En"', 'region="World"'),
			tetris.replace("<release>", "<release><extra/>"),
			tetris.replace("</source>", "</source>text"),
			tetris.replace(source + "\n\t" + release, release + source),
		];
		for (const variant of variants) {
			expect(() => parseRawXml(xml(variant))).toThrow();
		}
		expect(() => parseRawXml(header)).toThrow();
	});
});
