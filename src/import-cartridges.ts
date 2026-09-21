import { readFileSync, writeFileSync } from "fs";
import { parse } from "csv-pipe";
import type { Cartridge } from "./Cartridge.js";
import type { CartridgesCsvRow } from "./CartridgesCsvRow.js";

function main() {
    const csvPath = "assets/cartridges.csv";
    const cartridges = parse<CartridgesCsvRow>(readFileSync(csvPath)).map(
        (row): Cartridge => ({
            code: row.code,
            title: row.title,
        }),
    );

    const jsonPath = "public/cartridges.csv";
    writeFileSync(jsonPath, JSON.stringify(cartridges, null, "\t"));
}

main();
