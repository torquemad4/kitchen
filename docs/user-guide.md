# Clousto — User Guide

For **Karl and Maria**. What the app does, how the week runs, and what to do when
something looks wrong.

**Where it lives:** `kitchen.torquemada.uk` — behind Cloudflare Access, so you sign in
with your own email. **The URL never changes.** Bookmark it once.

> ⚠️ **What works today vs what is planned.** Parts of the weekly routine below are not
> built yet and are marked 🔴. They are here so the shape of the system is clear, not
> because they work. Anything unmarked works now.

---

## The week at a glance

| when | what | where |
|---|---|---|
| First day of the week | Build the menu | 🔴 Cowork chat |
| Then | Choose your dinners | App → **Choose** |
| Then | Shop | App → **Shop** |
| After shopping | Photo of the receipt | 🔴 Cowork chat |
| Each evening | Cook | App → **Recipes** → Cook mode |

---

## 1. Building the week 🔴 NOT BUILT

Done in a **Cowork conversation**, not the app.

Clousto looks at what the pantry holds, writes three new recipes into the library,
and offers **three options for each day** — weighted towards using up what is already
in the house, and against Clophie's standing macro targets. It then checks every
ingredient for availability, store by store, in this order:

**Aldi → Lidl → Tesco → Morrisons → M&S**

Everything is written into the app at the end of the conversation. Nothing is live
until that write happens.

---

## 2. Choosing dinners — the **Choose** tab

Each dinner slot offers three options. One is pre-selected as the default; picking a
different one updates everything downstream — the shopping list, the totals and the
Recipes tab all follow.

**Both phones stay in step.** Picks and ticks sync between you. If you and Maria change
the same thing at the same time, the most recent change wins.

🔴 **Once picks are locked in**, the app will diff the chosen recipes against the pantry
and build the shopping list from only what is missing. Today the list comes from the
week that was published — see the note in §3.

---

## 3. Shopping — the **Shop** tab

The list is grouped by aisle, in the order you walk the shop. Tap a line to tick it.
The running total updates as you go.

- ✅ **It works with no signal.** Ticks are saved on the phone first and sent when the
  connection comes back. Aldi's signal is the reason this exists. A queued tick shows
  in the bar at the top; it is not lost.
- ✅ **Both phones, at once.** You will not silently overwrite each other.
- **Held stock** is shown so you do not re-buy something already in the house.
- 🔒 The **emergency-meal floor** — 2 tins tuna, 200 g pasta, some cheese — is added to
  the list as a requirement, so the cart can never leave the house below it. In
  practice this is a cheese rule; tuna and pasta are always well above their floor.

⚠️ **Today the list is built from the week document published at the start of the week**,
including a snapshot of the pantry taken at that moment. It is not yet a live diff
against the pantry table.

---

## 4. The receipt 🔴 NOT BUILT

After shopping, photograph the receipt and drop it into a Clousto chat. Everything on
it is added to the pantry, and the real total is recorded against what was predicted.

This is what keeps the pantry honest in the "things came into the house" direction.

---

## 5. Cooking — the **Recipes** tab

Only what is actually being cooked is shown. Change a dinner on **Choose** and this tab
follows.

Each card carries the **full recipe, verbatim** — every step and every ingredient, plus
the research behind it and the notes on storing and reheating.

> ⭐ **The bold in the steps is not decoration.** It marks the things that ruin the dish
> — *"Big chunks, not dice"*, *"Crowding is the single most common ruin of this dish"*.
> If a card ever looks shortened, something is wrong; see §7.

### Cook mode

Tap **Cook mode** on a card. It runs in four phases, in the order a kitchen needs them:
what to get out, what to get ready, what to do before the heat goes on, then the steps
one at a time. Each step has its own timer.

🔴 **At the start**, cook mode will ask up to **three** quick questions about things it
has not had eyes on in a while — spices, rice, pasta. Rough answers are fine and are
the point; "about half" is more useful than a guess at grams.

🔴 **At the end**, it will ask you to confirm the dish was actually cooked, with an
optional comments box. Confirming records the cook and takes the ingredients out of the
pantry.

---

## 6. The **Pantry** tab

Everything in the house, grouped by category, weakest evidence first.

Each line shows **how it is known** and **when** — photographed, counted, at-the-pan,
recalled, or inferred. That grading is the point of the tab, not decoration.

- **`unmeasured`** means *nobody has looked*. It does not mean "probably fine" and it
  does not mean "out".
- **Weak evidence** (recalled, inferred) means the line came from conversation, not
  observation. Conversation-derived baselines have undercounted **seven times out of
  seven** in the food categories.
- ⚠️ **Check the date before you cook from a line.** On 3 September two pastes recorded
  as held on 18 August turned out to be gone — discovered at the pan, mid-recipe. The
  count was correct when it was made; nothing had decremented it since.

---

## 7. When something looks wrong

**The page shows a red bar and nothing else.**
Deliberate. If the week cannot be loaded it says so rather than showing a stale or
empty shopping list — a plausible wrong list in an aisle is worse than an obvious
error. Pull down to retry.

**A tick did not save.**
Look at the bar at the top. If it says changes are pending, they are queued and will
send. If it says error or offline, they are still safe on the phone. Nothing is
discarded silently.

**A recipe looks shortened, or a step is missing.**
Report it. This has happened before and it matters: week 2 was cooked from a compressed
card, lost the peppers from the stir-fry and the lemon from the salmon, and got rated
"fine" — the dish was not bad, **the card was the defect**.

**The Recipes tab says a card is not written yet.**
Uncommon now — every recipe in the library carries its full method, including the
alternatives you did not pick. If you still see it, the dish is in the week but could
not be matched to a library recipe. The card still tells you enough to shop and to know
what matters.

**An ingredient is not in the shop.**
Some things genuinely are not stocked. Known: Aldi carries no fish sauce at all; capers
come and go; suet was searched for and not found; no Sichuan peppercorns and no ya cai.
🔴 These will move into the availability table so the list stops asking for them.

---

## 8. Standing rules worth knowing

- **Only sweet thing in the house:** bourbon biscuits, with coffee. Plus sugar for
  guests' coffee. No snacks, sweets, soft drinks or alcohol except when visitors are
  here. This is a deliberate precommitment — the item list is also a *not*-buy list.
- **Coffee is quality-gated and channel-agnostic.** Never substitute down.
- **No new spices or dried herbs at all.** The only trigger for a spice purchase is a
  recipe calling for something genuinely absent.
- **Never buy hot sauce.** It is the most over-supplied category in the house.
- **Compatibility-constrained, never substitute:** razor heads, toothbrush heads, the
  descaler for the Stilo, and the poop bags that must fit the scoop's dispenser.
- **Sachets are a better inventory unit than jars** — a sachet is one recipe's worth.
