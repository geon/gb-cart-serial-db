import { Fragment } from "react/jsx-runtime";
import cartridges from "../public/cartridges.json";
// import type { Cartridge } from "./Cartridge";
import _myGames from "../assets/my-games.txt?raw";
import { isDefined } from "./is-defined";

const cartsByCode = Object.fromEntries(
	cartridges.map((cart) => [cart.code, cart]),
);
const myGames = _myGames
	.split("\n")
	.map((code) => cartsByCode[code])
	.filter(isDefined);

export function App() {
	return (
		<>
			{/* <input list="cartridges" placeholder="Cartridge Serial" />
			<datalist id="cartridges">
				{cartridges.map((cartridge) => (
					<option value={cartridge.code}>
						{cartridge.titles.map((title) => (
							<p>{title}</p>
						))}
					</option>
				))}
			</datalist> */}
			<ul>
				{myGames.map((cartridge) => (
					<li key={cartridge.code}>
						<div>{cartridge.code}</div>
						<div>
							{cartridge.titles.map((title) => (
								<Fragment key={title}>
									{title}
									<br />
								</Fragment>
							))}
						</div>
					</li>
				))}
			</ul>
		</>
	);
}
