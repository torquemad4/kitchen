# Clousto — User Guide

For **Karl and Maria**. What the app does, how the week runs, and what to do when
something looks wrong.

**Where it lives:** `kitchen.torquemada.uk` — behind Cloudflare Access, so you sign in
with your own email. **The URL never changes.** Bookmark it once.

Built for the phone, because that is what goes to the shop, but it works on a laptop
too.

> ⚠️ **What works today vs what is planned.** Parts of the weekly routine below are not
> built yet and are marked 🔴. They are here so the shape of the system is clear, not
> because they work. Anything unmarked works now.

---

## The week at a glance

| when | what | where |
|---|---|---|
| First day of the week | Build the menu | Cowork chat |
| Then | Choose your dinners, then lock | App → **Choose** |
| Then | Shop | App → **Shop** |
| After shopping | Photo of the receipt | 🔴 Cowork chat |
| Each evening | Cook | App → **Recipes** → Cook mode |

---

## 1. Building the week ✅

Done in a **Cowork conversation**, not the app.

Clousto looks at what the pantry holds, writes three new recipes into the library,
and offers **three options for each day** — weighted towards using up what is already
in the house, and against Clophie's standing macro targets. It then checks every
ingredient for availability, store by store, in this order:

**Aldi → Lidl → Tesco → Morrisons → M&S**

Everything is written into the app at the end of the conversation. Nothing is live
until that write happens.

✅ **This ran for the first time on 7 September 2026**, for the week of the 8th.

---

## 2. Choosing dinners — the **Choose** tab

Each dinner slot offers three options. One is pre-selected as the default; picking a
different one updates everything downstream — the shopping list, the totals and the
Recipes tab all follow.

**Both phones stay in step.** Picks and ticks sync between you. If you and Maria change
the same thing at the same time, the most recent change wins.

✅ **Your picks build the list.** Each option carries its own ingredients, so swapping a
dinner changes what goes in the trolley and what it costs. Choosing is not cosmetic.

### Locking the week

When you are both happy, **lock it**. Everything you did not choose disappears — Choose,
Slots and Shop all narrow to the week you actually settled on. Unlock if you change your
mind. The lock syncs like a pick, so you both lock together.

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

### The list is checked against the pantry

The quantities come from the dinners you picked, then get measured against what the
house holds. **What is checked live is whether you still actually have the things the
week assumed.**

There is nothing to read and nothing to decide: **if something has run out since the
week was built, it is simply on your list**, with its size and its price like every
other line. If it has not, it is not. No warnings, no "check this one", no maybes.

Only *out* puts something back on the list. "Running low" does not — the week already
knew roughly how much was there, and low usually agrees with that rather than
contradicting it.

---

## 4. The receipt 🔴 NOT BUILT

After shopping, photograph the receipt and drop it into a Clousto chat. Everything on
it is added to the pantry, and the real total is recorded against what was predicted.

This is what keeps the pantry honest in the "things came into the house" direction.

⚠️ **Until it is built the pantry drifts**, and the only correction is telling Clousto
out loud what is actually in the house — which is how the week of 8 September was
built.

---

## 5. Cooking — the **Recipes** tab

**One recipe at a time.** A second row of tabs picks which; it opens on whatever is
being cooked today, dinner first. Change a dinner on **Choose** and this tab follows.

Each card carries the **full recipe, verbatim** — every step and every ingredient, plus
the research behind it and the notes on storing and reheating.

> ⭐ **The bold in the steps is not decoration.** It marks the things that ruin the dish
> — *"Big chunks, not dice"*, *"Crowding is the single most common ruin of this dish"*.
> If a card ever looks shortened, something is wrong; see §7.

### Cook mode

**The button is there when the dish has a cook card, and absent when it does not.**
Eight recipes have one, and everything you are cooking this week is covered. The rest
give you the full written method on the card instead, which is what the kitchen ran on
before cook mode existed.

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

A table of what is in the house: **Item · Amount · Certainty · Checked.**

It lists what we have. Things we are out of are not on it — an empty jar is not stock,
and a list of absences is not something you can shop or cook from.

- **Certainty** is how the amount is known: photographed, counted, at-the-pan, recalled
  or inferred. Photographed and counted are worth more than recalled and inferred.
- **`unmeasured`** means *nobody has looked*. It does not mean "probably fine".
- ⚠️ **Checked is a date, not a promise.** On 3 September two pastes recorded as held on
  18 August turned out to be gone — discovered at the pan, mid-recipe. The count was
  correct when it was made; nothing had decremented it since. That is what the receipt
  step (§4) and the cook confirm (§5) are for.

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

**Half the app has disappeared.**
The week is locked. Everything you did not choose is hidden on purpose — unlock on
**Choose** to see the options again.

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
