# WoD 20th Anniversary Character Sheet

A free, zero-dependency, client-side interactive character sheet and Storyteller dice roller web application for **World of Darkness 20th Anniversary Edition** tabletop roleplaying games.

**Live App:** [wod20-charsheet-tool.vercel.app](https://wod20-charsheet-tool.vercel.app/)

---

## What It Does

* **Six Complete Game Lines:** Switch seamlessly between **Mortal / Hunter**, **Vampire (V20)**, **Werewolf (W20)**, **Mage (M20)**, **Changeling (C20)**, and **Wraith (Wr20)**, each with its own color theme and splat-specific traits.
* **Multi-Character Roster:** Save, switch, rename, duplicate, and delete multiple PC and NPC sheets across any game line in your browser, with full-roster `.json` backup export and import.
* **On-Screen Classic Parchment & Dark Themes:** Toggle between the default low-light Obsidian Dark theme and a low-glare **Classic Parchment** theme for bright tabletop environments—while keeping Print / PDF exports crisp black ink on white paper.
* **Interactive Character Sheets:** Track Attributes, Abilities, Specialties, Backgrounds, Powers, Merits, Flaws, Combat gear, and character portraits—with toggleable **5-Dot** and **10-Dot** (Elder & Mythic) scaling, dynamic rows, and automatic **Wound Penalty** calculation.
* **Built-In Storyteller Dice Roller:** Click any Attribute, Ability, Pool, or Advantage on the sheet to build a d10 pool automatically. Supports Specialty double-success 10s, Willpower spending (with one-click sheet box tracking), automatic Wound Penalty syncing, Botch vs. Failure detection, Discord-ready roll copying, and a roll history that survives a reload (and can be cleared).
* **3D Dice:** The roller throws real-looking d10s (canvas, no libraries) that land on the rolled values and colour by result. A full-screen roller lives at `dice3d.html` and opens with the sheet's current pool. The animation can be turned off, and it stays still for people who set "reduce motion".
* **Find & Quick Rolls:** Press `/` (or Ctrl/Cmd+K) to jump to any trait; Shift+Enter rolls it. Right-click or long-press a trait for Roll now / with Specialty / with Willpower. A sticky mini-header keeps health, Willpower and Initiative within reach.
* **Undo & Keyboard:** Undo the last dot or box change with the toolbar button or Ctrl/Cmd+Z. Dots and boxes work from the keyboard: Tab to a dot, Enter/Space to set it, arrow keys to step, Home/End for empty/full.
* **Quick Start:** Make a character the quick and dirty way. Pick one of 12 roles (Bruiser, Face, Sneak, Scholar, Investigator, Survivor, Soldier, Mystic, Artist, Leader, Healer, Tech) and a style (Jack of all trades, Well-rounded or Specialist), and every Attribute and Ability dot is placed. You choose the powers, Backgrounds and Freebies.
* **Two-Tab Character Guide & Sample Sheets:** Includes a slide-out reference drawer with **`Creation & XP`** (a live creation-points counter that never blocks a dot: it counts Freebie Points while a character fits its starting dots, then switches to an estimate of the XP spent beyond creation; plus Freebie and XP cost tables) and **`Dot Scale`** (0–5 **Standard Scale** and a 10-Dot Mode-synced 6–10 **Elder & Mythic** scale), plus 18 pre-built sample characters across all six game lines.
* **Serverless URL Sharing & Print/PDF Export:** Compresses your entire character sheet into a shareable URL (`#v3~`) with no backend database required, and prints clean PDFs (Full = 3 pages, Compact = 2, A4 or Letter; long text wraps instead of being cut off) with a clickable link back to the interactive sheet.
* **Local Auto-Save & Offline PWA:** Automatically saves progress in your browser (`localStorage`), supports `.json` file export/import (including drag-and-drop), and works offline once installed or cached.

---

## Project Layout

```
index.html                 Sheet markup (dot/box containers are stored compactly, see hydrate.js)
dice3d.html                Full-screen 3D dice roller
sw.js                      Offline service worker (cache name is stamped by tools/stamp-sw.mjs)
vercel.json                Security headers only (no build settings)
assets/js/rules.js         Every rule number: creation, freebie and XP costs, forms, wound track, generation table
assets/js/guide.js         Builds the Creation & XP guide drawer from rules.js
assets/js/dice.js          Storyteller dice and initiative resolution (pure, unit-tested)
assets/js/dice3d.js        Canvas 3D d10 renderer used by the roller and dice3d.html
assets/js/dice3d-page.js   The full-screen 3D roller page
assets/js/import-guard.js  Shape and size checks for imported .json files
assets/js/creation.js      Creation Points counter, Freebie and XP estimates (pure, unit-tested)
assets/js/quickstart.js    Quick Start roles and dot placement (pure, unit-tested)
assets/js/ux.js            Mini-header, search, roll menu, saved-time badge, backup reminder
assets/css/refresh.css     Interface layer (pills, segmented tabs, tokens, phone layout)
assets/css/print.css       Paper layout: 3-page Full / 2-page Compact, wrapped fields, page breaks
assets/js/print-prep.js    Makes print-only text copies of fields so nothing is cut off on paper
assets/js/share-codec.js   Binary / base79 primitives behind the #v3~ share links
assets/js/hydrate.js       Expands compact dot/box containers at load
assets/js/app.js           Sheet state, roster, UI wiring
assets/js/sampleCharacters.js   18 sample characters
tools/stamp-sw.mjs         Derives the service-worker cache name from file contents
tests/                     node:test suites
```

## Development

No dependencies. Serve the folder with any static server.

```
npm test        # unit tests (Node 18+)
npm run stamp   # re-stamp sw.js cache name; run this before every deploy
```

## Rules Data

All rule numbers live in `assets/js/rules.js`. Entries still checked only against secondary sources are listed in its `UNVERIFIED` array; confirm them against your books and delete the entry once confirmed.

Scope: V20, W20, M20, C20 and Wr20, plus the V20 supplement *Hunters Hunted II* for the Mortal / Hunter sheet.

---

## Dark Pack Agreement

[![World of Darkness Dark Pack Logo](./assets/img/dark_pack_logo.png)](https://www.paradoxinteractive.com/games/world-of-darkness/community/dark-pack-agreement)

Portions of the materials are the copyrights and trademarks of Paradox Interactive AB, and are used with permission. All rights reserved. For more information please visit [worldofdarkness.com](https://worldofdarkness.com).

This is an unofficial fan creation and not official World of Darkness material. It is not affiliated with or endorsed by Paradox Interactive. In accordance with Paradox Interactive's [Dark Pack Agreement](https://www.paradoxinteractive.com/games/world-of-darkness/community/dark-pack-agreement), this tool is strictly non-commercial and free for everyone to use.

**Removal on request.** The Dark Pack licence is revocable and Paradox Interactive may change its terms with 30 days' notice. If Paradox Interactive (or anyone acting for them) asks me to change, remove or take down any part of this project, or the whole project, I will do so promptly and without argument. Just write to the contact below. The agreement is re-read whenever it changes.

## Contact

Questions, corrections, or a request from Paradox Interactive to remove or change anything: **theapples1344@gmail.com**

Forks and copies of this project are not run by me. If you host your own copy, the Dark Pack Agreement applies to you directly (see [DISCLAIMER.md](./DISCLAIMER.md)).

## Security

The app has no server and no outside code (no libraries, fonts, ads or trackers). A strict Content Security Policy only allows the site's own scripts. Character text is always shown as text, never as HTML. Imported files and share links are size-checked and cleaned before use. A portrait on another website, from someone else's link or file, loads only after you agree. `vercel.json` stops other sites from embedding the app.

## Privacy

The app has no server, accounts, analytics or cookies. Characters, roll history and settings stay in your browser (`localStorage`) unless you export them or share a link. A share link carries the character inside the link itself. The web host keeps standard access logs (such as IP addresses), as all web hosting does. A portrait added by link is loaded from that website, which can see your IP address; uploaded portraits stay on your device.

