import { describe, expect, test } from "vitest";
import { datomaticRecordUrl, parseNoIntroXml } from "./parse.ts";

function xml(...games: string[]) {
	return `<?xml version="1.0" encoding="utf-8"?>
<header>
	<version>20260919-114245</version>
	<author>No-Intro</author>
	<url>https://www.no-intro.org</url>
	<trademarks>Trademarks.</trademarks>
	<piracy>Piracy.</piracy>
</header>
<datafile>
	${games.join("\n")}
</datafile>`;
}

function game(archiveAttributes: string, dumps = "") {
	return `<game name="Name (USA, Europe)">
		<archive number="0001" name="Name" region="USA, Europe" languages="En,Fr" ${archiveAttributes}/>
		${dumps}
	</game>`;
}

function source(serials: string, files: string, mediaTitle = "") {
	return `<source>
		<details id="1" section="Trusted Dump" d_date="2009-01-01" region="USA" dumper="Someone" project="No-Intro" originalformat="Default" ${mediaTitle}/>
		<serials ${serials}/>
		${files}
	</source>`;
}

function release(serials: string, files: string) {
	return `<release>
		<details id="2" dirname="Name_GB" nfoname="name" nfo_size="100" nfo_crc32="00000000" originalformat="Default" date="2000-01-01" group="Group" region="World" origin="Scene"/>
		<serials ${serials}/>
		${files}
	</release>`;
}

function file(crc32: string, extra = "") {
	return `<file id="10" extension="gb" size="32768" crc32="${crc32}" md5="982ed5d2b12a0377eb14bcdc4123744e" sha1="74591cc9501af93873f9a5d3eb12da12c0723bbc" format="Default" ${extra}/>`;
}

describe("parseNoIntroXml", () => {
	test("cleans up an entry", () => {
		const entries = parseNoIntroXml(
			xml(
				game(
					'clone="1319" name_alt="Alt Name" version1="Rev 1" additional="Kiosk" special1="SGB Enhanced, GB Compatible" special2="NP" licensed="2"',
				),
			),
			"dmg",
		);
		expect(entries).toEqual([
			{
				url: "https://datomatic.no-intro.org/index.php?page=show_record&s=46&n=0001",
				dat: "dmg",
				noIntroName: "Name (USA, Europe)",
				title: "Name",
				alternativeTitle: "Alt Name",
				printedTitles: [],
				regions: ["USA", "Europe"],
				languages: ["En", "Fr"],
				versions: ["Rev 1"],
				edition: "Kiosk",
				specialTags: ["SGB Enhanced", "GB Compatible", "NP"],
				licensing: "pirate",
				parentUrl:
					"https://datomatic.no-intro.org/index.php?page=show_record&s=46&n=1319",
				cartridgeSerials: [],
				romChipSerials: [],
				romHeaderCodes: [],
				files: [],
			},
		]);
	});

	test("uses defaults for missing attributes", () => {
		const [entry] = parseNoIntroXml(
			xml(game('clone="P"').replace('languages="En,Fr"', 'languages="nolang"')),
			"agb",
		);
		expect(entry).toMatchObject({
			languages: [],
			versions: [],
			specialTags: [],
			licensing: "licensed",
		});
		expect(entry).not.toHaveProperty("parentUrl");
		expect(entry).not.toHaveProperty("edition");
	});

	test("merges dumps into unique serials, header codes, printed titles and good files", () => {
		const [entry] = parseNoIntroXml(
			xml(
				game(
					"",
					[
						source(
							'media_serial1="DMG-MQ-USA" pcb_serial="DMG-DECN-02" romchip_serial1="DMG-MQE-0 (9247)"',
							file("d5ec24e4"),
							'media_title="Printed"',
						),
						source(
							'media_serial1="DMG-MQ-USA" romchip_serial1="TOSHIBA 9249EAI TC531001CF DMG-MQE-1 C1 N511 JAPAN" romchip_serial2="DMG-A08-01"',
							file("d5ec24e4", 'serial="!none"'),
						),
						source(
							'media_serial1="DMG-MQ-FAH" media_serial2="DMG-MQ-NOE"',
							file("00000001", 'bad="1"'),
						),
						release(
							'media_serial1="DMG-MQ-UKV"',
							file("00000002", 'serial="MQEE"'),
						),
					].join(""),
				),
			),
			"dmg",
		);
		expect(entry).toMatchObject({
			printedTitles: ["Printed"],
			cartridgeSerials: [
				"DMG-MQ-USA",
				"DMG-MQ-FAH",
				"DMG-MQ-NOE",
				"DMG-MQ-UKV",
			],
			romChipSerials: ["DMG-MQE-0", "DMG-MQE-1"],
			romHeaderCodes: ["MQEE"],
			files: [
				{ crc32: "d5ec24e4", size: 32768 },
				{ crc32: "00000002", size: 32768 },
			],
		});
	});

	test("leaves out entries that aren't physical official releases", () => {
		const excluded = [
			'physical="0"',
			'aftermarket="1"',
			'devstatus="Beta"',
			'bios="1"',
		];
		expect(
			parseNoIntroXml(
				xml(...excluded.map((attributes) => game(attributes))),
				"dmg",
			),
		).toEqual([]);
	});

	test("throws on unexpected values", () => {
		for (const attributes of [
			'licensed="1"',
			'aftermarket="0"',
			'physical="1"',
		]) {
			expect(() => parseNoIntroXml(xml(game(attributes)), "dmg")).toThrow();
		}
	});

	test("builds DAT-o-MATIC record URLs", () => {
		expect(datomaticRecordUrl("dmg", "1317")).toBe(
			"https://datomatic.no-intro.org/index.php?page=show_record&s=46&n=1317",
		);
		expect(datomaticRecordUrl("cgb", "0604")).toBe(
			"https://datomatic.no-intro.org/index.php?page=show_record&s=47&n=0604",
		);
		expect(datomaticRecordUrl("agb", "x436")).toBe(
			"https://datomatic.no-intro.org/index.php?page=show_record&s=23&n=x436",
		);
	});
});
