# Changelog

## 1.4.0

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
