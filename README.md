# Birmingham

A private online version of an industrial-era network-building board game, made for playing with friends. Build industries, connect towns with canals and then railways, and sell goods for points across two eras.

**Play:** https://brass-birmingham-5d8f7.web.app

## How to play online

1. Open the link, enter your name, and choose 2, 3 or 4 players. You're the host.
2. Tap **Copy invite link** and send it to your friends. They open it, enter their names and tap **Sit here**.
3. Mark any empty seats as bots if you like. Seats still open when you press **Start game** become bots.
4. Bots take their turns from the host's browser, so the host keeps the game open while bots are playing.
5. Games save after every move. Come back later on the same device with the same link.

The home screen also has **Play offline on this device**: you against bots, or pass-and-play.

### Handy features

- **Tile values** (top left) opens a chart of every tile: cost, what it needs, and what it's worth once flipped (VP, income, link points), with how many you have left.
- **Map style** switches between Poster, Survey map, Blueprint and Transit looks. It's a personal setting and doesn't affect other players.
- Hover (or tap) a town, merchant or route on the map to see what's there, what it scores, and what you can build.
- After tapping **Build**, tap a highlighted town to build there.
- The coach gives short tips on your turn, and a polite nudge appears if a turn has gone two minutes without a move.

## How the code is organised

| File | What's in it |
| --- | --- |
| `public/index.html` | The page itself |
| `public/css/style.css` | All styling, including the map |
| `public/js/data.js` | Towns, building spaces, connections, merchants, industry tiles (checked against the real player mat), the card deck for each player count, markets. **Most rule fixes go here.** |
| `public/js/engine.js` | Rules engine, bots, coach, map drawing and controls |
| `public/js/net.js` | Firebase sign-in, lobby, seats and game syncing |
| `tests/engine.test.mjs` | Plays full bot games to check nothing is broken |
| `firestore.rules` | Database security rules |

There's no build step: the files in `public/` are served as they are.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). In short: open an issue, make a branch, open a pull request, check the preview link, get a review, merge. Merging to `main` publishes to the live site automatically.

## Running it yourself

Requires Node.js 20 or newer and the Firebase CLI (`npm install -g firebase-tools`).

```
npm test        # run the engine tests
npm run serve   # run the site and a local database on your computer
```

With `npm run serve`, open http://127.0.0.1:5000/?emu=1. The `?emu=1` makes the app use the local database instead of the real one, so you can test online play in two browser windows without touching live games.

## Deploying by hand

Normally merging to `main` deploys automatically. To deploy manually:

```
firebase deploy                    # site and database rules
firebase deploy --only firestore   # just the database rules
```

## Notes

- Hands are trust-based: all cards are in the shared game data, and the app only shows each player their own.
- The Firebase web config in `public/js/net.js` is meant to be public; security comes from `firestore.rules`.
