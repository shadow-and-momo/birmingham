# Changelog

All notable changes to the game, newest first. Each pull request should add its changes under **Unreleased**.

## Unreleased

### Added
- **Progress track.** A rail beside the map showing every player's VP (hex) and income (coin) on one shared 0–99 track, like the board. Each income level is a shaded band with its £ printed faintly, so you can read income at a glance. Markers are all the same size and spread out when players share or neighbour a space; hover one for the exact figures. A tiny VP/£ key sits at the bottom, and the rail follows each map style. It starts hidden: a small button in the top-left corner of the map opens and closes it, and each device remembers your choice. Not shown on phones.
- **Second rail points.** When choosing the beer for a second rail, the screen shows what the rail is worth if the era ended now, on each option, including when using a brewery's last beer flips it and adds link points.
- **Canal era score screen.** "Halfway there": each player's canal-era points as a bar split into canal links and face-up tiles (tap a segment for every link and tile), plus what changes now: canals removed, your level 1 tiles that are removed (named), merchant beer refilled, and a new hand with your income.
- **Show all points** on the final standings. A bar for each player split into canal links, canal tiles, rail links, rail tiles (and merchant bonuses), in the board's colours. Tap a segment to list every link and tile in it with its points.
- **Overbuilding.** Replace your own tile with a higher level of the same industry, or another player's coal mine or ironworks with a higher level when there's none of that resource left on the board or in the market. Overbuild options are labelled in the build list. Bots overbuild too.
- **Sound effects** for building, links and sales (softer for other players' moves), and a **chime when your turn starts**.
- **Sound effects setting** below the map key: on/off, remembered on each device.
- **Market display**: the coal and iron markets are shown as two rows of dots (black for coal, orange for iron) with prices underneath. Bought cubes leave an empty outline, taken from left to right, and sold cubes fill back in.
- **Coach and hints as a start-of-game choice.** Off by default; turn them on in the New game screen, or the host turns them on in the online lobby. Locked once the game starts.
- **Space setting ("Brass: Belt").** A Classic/Space choice that renames everything with a sci-fi theme (freight lanes and hyperlanes, helium-3, alloy and food, credits), swaps in new industry icons, and adds a Deep space map style. Rules, counts, costs and connections are unchanged. Each player picks their own setting.
- **Devious bots.** Bots look ahead at their next two actions and the next player's likely reply, and play to beat whoever is leading. They don't see other players' hands. Bot strength (Devious or Normal) is chosen at setup, or by the host in the online lobby.
- **Final standings screen.** Everyone ranked from winner down with medals, canal and rail era scores, bonuses, income and cash; ties broken by income, then cash. Includes **View the board** and **Show final standings**.
- **Tile values chart.** A **Tile values** window listing every tile's cost, needs, beer to sell, and what it's worth once flipped (VP, income, link points), with how many you have left and which is next.
- **Full game log.** A **View full game log** link that opens every entry in a window. Online games keep up to 900 entries.
- **Choosing your space** when a tile fits more than one shared space in a town, by list or by tapping the space on the map.
- **Choosing your beer** for second rails and single-beer sales, from merchant barrels or any brewery you're allowed to use.
- **Tap a town to build** after choosing Build. Towns where your hand can build are outlined.
- **Develop one, then optionally a second** tile, with each option showing the tile removed, the next tile up, and where the iron comes from.
- **Beer needed to sell** shown on face-down goods tiles, in town popups, and in build and sell options.
- **Link points shown everywhere**: on face-up tiles, in link and town popups, in build and develop options, and on second rail choices.
- **Town card icons** showing which industries that town allows, faded when you can't build them right now.
- **Map styles**: Poster, Survey map, Blueprint, Transit and Deep space.
- **Player colours** (blue, red, orange, magenta) chosen at setup or in the online lobby, then locked for the game.
- **Old-timey bot names** generated each game, with a "bot" tag on their panels.
- **Polite nudge** when a turn has gone two minutes without a move.
- **10-second undo** after your turn passes when other people are playing. The next player can't move until it runs out. When you're the only person (just bots), undo has no time limit.
- **Random starting turn order**, shown at the top of the game log.
- **Saved-game version number**, so an update that changes how games are stored asks the host to start fresh instead of breaking.
- Automated tests for full 2-, 3- and 4-player games, the card deck and the player mats.

### Changed
- Warrington's merchant sits a little lower so it clears the track button.
- **Player panels have depth.** A soft drop shadow, with the current player's panel lifted slightly higher.
- **Round number** beside Your actions: "Round 3 of 8 | 1 action left".
- **Spending on each player panel.** "spent £12" sits on the cash line of every panel (whoever spends least goes first next round), replacing the separate Spent this round line.
- **Tidier sidebars.** "Actions left" now sits beside Your actions, and "cards left in deck" beside Your hand, split by a grooved divider. The era/round line and the "Bots run in your browser" note are gone, and the game code and invite link moved to the bottom of the left column.
- **Your next tiles** uses grooved row lines and subtle dividers between columns.
- **Settings as dropdowns**: Sound effects, Setting and Map style sit side by side as compact dropdowns in the left column.
- **Clearer icons**: the coal mine is now a mine cart, the ironworks an anvil, and the cotton mill a factory with a sawtooth weaving-shed roof, so they don't get confused with the ironworks and brewery.
- **Tile summaries show what tiles produce** (for example "makes 3 coal") in Your next tiles and develop options.
- **New game** (or **Lobby** / **Leave** online) moved to the bottom of the left column; the Tile values button left the header (the chart opens from **All tile values** beside Your next tiles).
- **Your actions** heading above the action buttons, and subtle grooved dividers between the markets, spending, game log and settings in the left column, and between your actions, hand and next tiles in the right column.
- **Layout**: on wide screens the map key sits in the right column above the rules, and the latest moves and full game log link sit in the left column above the Setting and Map style controls.
- **Full player mats.** Each player now has the real 45 tiles, with counts, costs, VP, income, link points, beer and resource output checked against the physical player mat.
- **Official card deck** for each player count, from the card distribution card (40, 54 and 64 cards; 10, 9 and 8 rounds per era).
- **Poster map** redesigned in a bold print style: rounded shapes, light dot texture on the dark green, offset shadows, tree shadows and slowly turning sun rays. Open canal routes are brighter.
- **Your hand** split into industry and town cards, duplicates grouped, newly drawn cards after a **New** divider.
- **Player panels** listed in this round's turn order, tagged 1st to 4th.
- **Your next tiles** shows each industry's icon on one line.
- **Hint** uses the same look-ahead as the devious bots.
- **Nottingham** moved lower on the map so its link from Derby is clear.
- Code split into separate files (`data.js`, `engine.js`, `net.js`, `style.css`) to make contributing easier.

### Fixed
- **Negative income shortfall (rulebook p.6).** If you can't pay negative income, you now remove your own industry tiles for half their cost (rounded down), stopping once it's covered and keeping any extra; only what's still unpaid costs VP. People choose which tiles (play waits for them, online too); bots choose automatically.
- **VP can't go below 0** when losing points to a shortfall.
- **You choose which ironworks your iron comes from** when building or developing (any ironworks, not just yours).
- **You choose between equally close coal mines** for builds and rails.
- **You choose each beer for a sale**, including whether to use the merchant's barrel, so 2-beer sales can draw from different breweries.
- **Choosing which merchant to sell to.** A good connected to more than one buyer now lists every merchant (with its beer bonus), instead of only the one with the most beer. Selling pottery from Coventry can go to Oxford or Gloucester.
- The game code and invite link now always sit at the bottom of the left column, and the page itself is never cached, so updates show up straight away.
- **Gloucester's free develop** now lets you choose which tile to remove (or skip it), instead of picking automatically. Bots still choose for themselves.
- **Lightbulb rule**: pottery I and III can't be developed, including by Gloucester's free develop.
- **Rail-only tiles**: brewery IV and pottery V can't be built in the canal era.
- Your own breweries now say "your" in online games instead of showing your name.
- The second develop no longer ends silently when you can't afford the iron.
- Legend icons and route samples are readable in dark mode.
- The card popup no longer gets stuck over the controls, and doesn't appear on touch screens.

## Initial release

- Online play for 2 to 4 players with any mix of people and bots, using Firebase sign-in and a shared game record.
- Lobby with invite links, seats and bots; turn-by-turn play that saves after every move.
- Offline play on one device, against bots or pass-and-play.
- The full map of towns, connections, farm breweries and merchants, with random merchant tiles by player count.
- Canal and rail eras with real rules for coal, iron, beer, selling, loans, the income track, turn order and scoring.
- Coach tips, hints and undo.
