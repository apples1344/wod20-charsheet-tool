# Changelog

## 1.7.1

- "Start a character" card: the × now hides it for this visit only, so it can't be lost by accident. A separate "Don't show this again" link under the options is the only lasting choice.
- New **⋮ → Show start tips** brings the card back at any time, even on a sheet that already has something on it. It also undoes a "don't show again" (including the × from 1.6.0–1.7.0, which used to hide the card for good).

## 1.7.0

Help for first-time players that stays out of the way of experienced ones. One switch, **⋮ → Beginner Hints**, turns the on-sheet help off (and back on); the Glossary tab is always there.

**Glossary**
- A new **Glossary** tab in the Guide: 29 terms in plain language (Freebie Points, Priorities, Specialty, Difficulty, Botch, Wound penalty, Storyteller approval…), plus the terms of the game line you have open.
- A small, faint **?** beside the headings and labels it explains (Attributes, Backgrounds, Willpower, Health, Blood Pool, Spheres, Arete, Glamour, Pathos and so on): 13 to 17 per sheet. Click it for a short definition; "All terms in the Guide" jumps to that entry. Clicking the ? on a rollable pool never adds it to the dice.

**Trait hints**
- Hover over a trait name for a one-line hint after a short pause (about two-thirds of a second, so quick clicking never triggers it). On phones the same hint shows in the long-press roll menu.
- Every one of the 261 fixed traits across the six sheets has one, including words that mean different things per line (Time in Mage vs Changeling, Nature as a Changeling Realm).
- All definitions and hints are this project's own short wording, not text from the books.

**Creation guide**
- A "Next:" line under the steps says what to do now: "Next: Attributes. Split 6 / 4 / 3 dots across Physical, Social and Mental, in any order", "Next: Advantages. Backgrounds 5 left.", "Next: spend the last 3 Freebie Points…". It disappears when creation is done or the sheet is past it into XP.

**Dice results don't rely on colour**
- Each die shows a symbol and its own border: ✓ success (solid), ★ 10 (double), ✗ 1 (dashed), miss (dotted). Screen readers hear "7, success" / "1, cancels one success".
- The 3D dice show the same symbols under each die once they land. The full-screen roller lists them in the result line too.
- A one-line legend sits under the result (hidden with Beginner Hints off).

**Plain labels for the dangerous buttons**
- "Clear Active Sheet" is now **Erase this character…**, and its dialog says your other characters are kept.
- "Reset Entire Website" is now **Erase all characters & settings…**, and its dialog says exactly what goes and points to Export Roster first.

## 1.6.0

**Layout**
- Only the top row (title, section tabs, actions) stays pinned while you scroll. The setup row (Game Line, Character, Samples, Quick Start) now scrolls with the page, so on a laptop the pinned area drops from about 145px to 92px.
- On wide screens the pinned bars line up with the sheet's column. On mid-size screens (769–1180px) the top bar stays on one line; below 960px Share URL becomes an icon.
- The setup row fits on one line from 1000px up: shorter labels ("Character" instead of "Character Slot"), and the Samples label is kept for screen readers only, since the list already says "Load a sample character…".
- Phones: the Dice and Guide buttons join the bottom tab bar instead of floating over the sheet. The dice panel and Guide open just above the bar, and toasts no longer sit on top of the buttons.

**New players**
- A blank sheet shows a "Start a character" card with three choices: Quick Start, Load a sample, or From scratch (opens the Guide and puts the cursor in Name). It hides as soon as the sheet has anything on it, returns on a new blank slot, and × hides it for good.

**Polish**
- Empty Specialty slots no longer show a cut-off "Spe" on every row. With a mouse they appear when you point at the row; on touch screens the full word "Spec" fits.
- Section rules are lighter and fade at the ends.
- The save badge says "Saved just now" and then "All changes saved", instead of "Saved 11 min ago", which read as if something had gone wrong. The exact time is in its tooltip.
- Toasts appear above the Dice/Guide dock on desktop instead of covering it.
- Parchment theme: the wound label in the pinned strip ("Healthy") is now readable.

Printing is unchanged: all 18 samples still print 3 pages (Full) and 2 pages (Compact) on A4 and Letter.

## 1.5.1

- Dice: new "Animate" switch in the sheet's roller and "Animate dice" on the full-screen page (one shared setting). It starts from the device's reduce-motion setting, which is why dice tumbled on some devices and simply appeared on others; turn it on to always see the tumble.
- Quick tabs (Traits, Mechanics, Gear, Bio) no longer land with the section title hidden under the name/health strip. On phones, where that strip can wrap to two lines, the page re-checks once scrolling stops.

## 1.5.0

**Quick Start (quick and dirty creation)**
- Pick a role and a style, and the sheet places every Attribute and Ability priority dot for you, in the role's order. There are 12 roles: Bruiser, Face, Sneak, Scholar, Investigator, Survivor, Soldier, Mystic, Artist, Leader, Healer and Tech. The styles are Jack of all trades, Well-rounded and Specialist. Virtues and the fixed starting pools are set too: Humanity/Path and Willpower for Mortals and Vampires; Arete and Willpower for Mage; Willpower, Corpus and Pathos for Wraith.
- What makes a character yours is left to you: powers, Backgrounds, Freebie Points, name and story. A message lists exactly what's left, and the Creation guide opens to track it.
- Opens from the "Quick Start" button next to Samples, the ⋮ menu, or the Creation Points guide on a blank sheet. A filled sheet is never overwritten: a new roster slot is made.
- The roles are this project's own generic types, not archetypes or text from the books. All 216 combinations of role, style and game line are unit-tested to give a legal starting sheet (all dots placed, nothing over, 0 Freebies used).

**Security**
- Share links get the same limits as imported files: at most 60 rows per table, dots capped at 10, text length capped. A crafted 24-character link could previously build 200,000 rows and freeze the page, and a bloated sheet was saved into the roster.
- Compressed share links may unpack to at most 1 MB.
- A portrait hosted on another website, arriving in someone else's link or file, is no longer loaded automatically. The portrait box asks first, because loading it shows that website your IP address.
- New `vercel.json` sends security headers: no embedding in other sites (`frame-ancestors 'none'`, `X-Frame-Options`), `nosniff`, no referrer, and camera/microphone/location turned off. It contains no build settings.
- Exported `.json` files now say "not official World of Darkness material", matching the Dark Pack Agreement wording.

**Fixes**
- The print dialog describes the current layouts (Full = 3 pages, Compact = 2).

## 1.4.0

**Deploy**
- The service-worker stamp script is now `npm run stamp` (was `npm run build`). With a `build` script, Vercel runs it as a framework build and then fails looking for a `public` folder; without one it serves the folder as static files.

**Creation Points: Freebies, then XP**
- While a character fits its starting dots and Freebie Points, the counter shows Freebies as before ("12 / 15 Freebies").
- Once past the Freebies, it switches to an XP estimate: "≈ 113 XP beyond creation" in the header, `+N XP` on each Attribute, Ability and Advantage group, an XP step in the step bar, and an "XP beyond creation" breakdown in place of the Freebie list. It no longer shows numbers like "305 Freebies over".
- The estimate uses the game line's XP table and the cheapest possible order (starting dots and Freebies cover the dots that would cost the most XP). Where the sheet can't tell the rate (Clan Disciplines, Affinity Sphere, in-Breed Gifts) the cheaper one is assumed and named. Rows with no XP price in the line (most Backgrounds, Wraith Passions and Fetters) are marked "Storyteller". Mage Backgrounds are marked "ST approval".
- The Freebie count now charges Abilities above 3 (no Ability goes above 3 with starting dots), so the Freebie and XP numbers agree.
- Sample: Clara Okafor (Starter) drops Etiquette 1 so she still fits her 15 Freebies under that rule.

**Legal / contact**
- README and DISCLAIMER: a contact address (theapples1344@gmail.com) and a plain promise to change, remove or take down any part of the project, or all of it, promptly if Paradox Interactive asks.

## 1.3.1 — Print / PDF

- Nothing is cut off on paper any more: long names, concepts, motleys, specialties, Advantage names, Merit/Combat cells and the History, Description and notes boxes all wrap to fit their text.
- Full layout is three pages for every game line (sheet; Mechanics with Backgrounds & Gear; Description & History). Compact is two. Checked on A4 and US Letter for all 18 samples and for blank sheets.
- Sections no longer split across pages, and headings always stay with their content.
- An empty portrait prints as a light dashed frame instead of a solid black box. Blank notes boxes print faint ruled lines to write on.
- The browser's own date/URL header and footer no longer print (the sheet supplies its own margins). Firefox and Safari may still add them; untick "Headers and footers" there.
- Lighter, ink-saving look: thinner rules, smaller headings, an outlined "Open interactive character sheet" link, and a compact licence notice (Dark Pack logo and full notice kept).
- Parchment theme prints on plain white.
- Samples: the Starter / Developed / Legendary tier is now a roster tag instead of being written into Concept, Motley, Life or Other Traits.

## 1.3.0

**Creation Points (guide drawer)**
- Attribute and Ability priorities are shown as a choice: "Any order you like: 7 · 5 · 3 across Physical, Social and Mental". Each group shows the dots spent and which priority it currently counts as ("your 7 group"), so nothing reads as a fixed 6/4/3 or 13/9/5 split. Untouched groups say "not started".
- Step bar: Concept, Attributes, Abilities, Advantages, Freebies (to do / in progress / done / over).
- Freebie Points estimate, worked out from everything above the starting dots (Attributes ×5, Abilities ×2, each Advantage at its cost, Willpower/Humanity/Path where the starting value is known, Merits, Flaws up to 7). Collapsible breakdown. Wraith Passions and Fetters are told apart by row name ("Fetter: …").
- Abilities above 3 are flagged as needing Freebies.

**Interface**
- Pill-shaped buttons and selects; secondary buttons are ghost buttons.
- Top bar: Game Line, Character Slot and Samples sit in one rounded strip; "Presets" renamed "Samples"; Print moved into the ⋮ menu.
- Section tabs are a segmented control with a sliding highlight.
- Softer cards, panels and dialogs (shared radius, border and shadow tokens for both themes); dots have a little depth and press feedback; data fields use the sans-serif face.

**Usability**
- Sticky mini-header once you scroll past the name: character name, wound level, a health track you can click (right-click heals), temporary Willpower −/+, and Initiative / Roll WP buttons.
- Find anything: press `/` or Ctrl/Cmd+K, or the magnifier. Enter jumps to the trait; Shift+Enter rolls it.
- Roll menu: right-click (long-press on phones, or Shift+F10) a trait or pool for Roll now / with Specialty / with Willpower / Add to pool.
- Roster: search (name, game line, tag), sort (recent, my order, name, game line), drag or ▲▼ to reorder, tags, and "As NPC" copies tagged NPC.
- Save badge shows "Saved just now / 5 min ago". After about 150 saves, or two weeks without a backup, a banner offers a roster backup.
- Print dialog: Full or Compact layout, with or without Description & History and the portrait (a 5-page Tremere sample prints on 3 compact pages). The browser's own preview still opens.
- Phones: section tabs move to a bottom bar, larger dot and box targets, and no sideways scrolling.

**Legal**
- The link-preview image carries the Dark Pack logo and the required notice.
- README: removal-on-request note and a Privacy section; one-line privacy note in the footer.

## 1.2.0

**Rules**
- Wraith XP: Arcanos raise cost is current rating × 3 (no separate Guild rate). New and raised Passions, Fetters and Backgrounds are "Special (Storyteller approval)".
- Sample characters audited against creation dots + Freebie Points. Fixed the starters that overspent: Leo Navarro (Mortal, 2 over), Devon Park (Werewolf: Homid Gnosis is 1; 8 over), Clara Okafor (Mage, 8 over), Zara Al-Mansoor (Changeling, 1 over). Archmage Quintessence lowered to 17 so Quintessence + Paradox fits the 20-box wheel. A test now checks the tagged starters.

**Legal / Dark Pack**
- Footer, README and DISCLAIMER now state "not official World of Darkness material".
- The Dark Pack logo is no longer used as the app icon; new neutral icons (192, 512, maskable) and a link-preview card.

**Features**
- 3D dice in the roller (toggle, remembered) and a full-screen 3D roller page (`dice3d.html`).
- Undo for dot and box changes (toolbar button, Ctrl/Cmd+Z).
- Roll history survives a reload (25 rolls, with times); Clear empties it.
- Creation-points counter in the guide drawer (collapsible; remembers its state and shows "N over" when collapsed): shows starting dots used per category and marks anything above as "over" without blocking it.
- Storage failure is now shown as a persistent "Not Saved — Back Up" badge; clicking it downloads a roster backup.
- Portrait uploads are stored at 400 px JPEG; a note under the link field explains that linked images reveal your IP to that site; only https, data and blob images are loaded.

**Accessibility**
- Dots and boxes: arrow keys, Home/End, `aria-pressed`, a named group per trait, and a focus ring that shows on filled dots and on the parchment theme.

**Modernization**
- Content-Security-Policy and `no-referrer`; inline event handlers removed.
- Description, Open Graph and Twitter metadata; dark `theme-color`.
- Manifest: `id`, real PNG icons including maskable, `categories`, `shortcuts` (Dice, 3D Dice, Roster).
- Service worker: stale-while-revalidate, and an "A new version is ready — Reload" banner instead of a silent swap.
- `.json` import: 5 MB limit, unknown game lines rejected, foreign keys dropped, dots clamped, unsafe portrait URLs removed. Old `#v1~`/`#v2~` share links go through the same checks.
- Modals are native `<dialog>` elements; `structuredClone` replaces JSON deep copies; toasts sit in the top layer so they show above dialogs.

## 1.1.0

**Rules**
- Changeling: Realm freebie cost 3 → 2 per dot (confirmed by maintainer).
- Wraith: Pathos starting value now notes the maximum of 10 (confirmed by maintainer); New Arcanos 7 XP and starting Corpus 10 confirmed.
- Mage: freebie Quintessence stays 1 per 4 points (confirmed); no maximum shown.
- Wraith: Catharsis badge now follows the Wr20 wording: it appears when temporary Angst *exceeds* permanent Willpower, and describes it as an opportunity for the Shadow rather than automatic.
- Initiative: new "Apply Wound Penalty to Initiative" option (on by default, remembered between sessions), separate from the dice-pool wound toggle.

**Fixes**
- Changeling wound badge always showed 0 for the Chimerical track (wrong arguments to `getTrackPenaltyIndex`).
- README said Specialty "exploding 10s"; the roller (correctly) counts a 10 as two successes.

**Housekeeping**
- All rule data moved to `assets/js/rules.js`; the guide drawer is generated from it.
- `app.js` split: `dice.js`, `guide.js`, `share-codec.js`, `hydrate.js`, `rules.js`.
- `index.html` reduced from 432 KB to about 260 KB (dot/box containers expanded at load; expanded output verified identical to the previous markup).
- Service-worker cache name is now derived from file contents (`npm run build`).
- Added unit tests (dice, share codec, rules, markup).
- Share links (`#v3~`) and `.json` exports are unchanged and remain compatible.
