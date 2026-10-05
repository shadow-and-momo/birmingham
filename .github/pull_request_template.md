**What this changes**

**Why**
Link the issue if there is one, for example "Fixes #12".

**How I checked it**
- [ ] `npm test` passes
- [ ] I tried it on the preview link Firebase posted on this pull request

**Does it change how games are saved?**
If yes, bump `STATE_VERSION` in `public/js/engine.js` so old saved games aren't loaded by mistake.
