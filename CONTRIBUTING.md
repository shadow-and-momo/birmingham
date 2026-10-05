# Contributing

Thanks for helping make the game better. Here's how changes get from an idea to the live site.

## The flow

1. **Start with an issue.** Use the templates: **Rule challenge** if the game breaks a real rule, **Bug** if something's broken, **Idea** for anything new. Check whether someone has already opened one.
2. **Make a branch** from `main`, named for what you're doing, like `fix-farm-brewery` or `add-nudge`.
3. **Make your change** and run `npm test`.
4. **Open a pull request** into `main` and fill in the template. Mention the issue ("Fixes #12").
   Add a line for your change under **Unreleased** in `CHANGELOG.md`.
5. **Try the preview.** Firebase posts a preview link on your pull request within a few minutes. Play a few turns on it to make sure it works.
6. **Get a review.** At least one other person approves before merging.
7. **Merge.** The site updates automatically a few minutes later.

`main` is protected, so nobody can push straight to the live site.

## Where things live

- **Rules data** (towns, spaces, links, tiles, merchants): `public/js/data.js`
- **How rules are applied** (building, selling, coal, beer, scoring, turn order): `public/js/engine.js`
- **Online play**: `public/js/net.js`
- **Looks**: `public/css/style.css`, and the map drawing functions in `engine.js` (`mapSVG`, `bgArt`)

## Things to be careful with

- **Saved games.** Online games are stored as a snapshot of the game state. If your change alters what's in that snapshot (new fields the engine relies on, renamed fields, changed structures), bump `STATE_VERSION` in `engine.js`. Games saved under the old version will then ask the host to start fresh instead of breaking.
- **Deploying mid-game.** Merging while friends are playing updates the site under them. Prefer merging between games.
- **Hidden hands.** The app is trust-based; please don't build features that reveal other players' cards.
- **Artwork.** Use original art only. Don't add the published game's board, card art or logos.

## Testing online play locally

```
npm run serve
```

Then open http://127.0.0.1:5000/?emu=1 in two different browsers (or one normal and one private window) to play against yourself without touching the real database.
