# Changelog

All notable changes to the game, newest first. Each pull request should add its changes under **Unreleased**.

## Unreleased

### Added
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
- **6-second undo** after your turn passes to the next player, with a countdown.
- **Random starting turn order**, shown at the top of the game log.
- **Saved-game version number**, so an update that changes how games are stored asks the host to start fresh instead of breaking.
- Automated tests for full 2-, 3- and 4-player games, the card deck and the player mats.

### Changed
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
