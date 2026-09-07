# Clousto — canonical ingredient vocabulary

✅ **Reviewed and signed off by Karl, 7 September 2026. Live in D1.**
125 proposed → **7 dropped, 1 split, 117 kept → 119 rows** in the `ingredients` table.

> This page is the draft as it went for review, kept for the record. The live vocabulary
> is the `ingredients` table; where the two differ, the table wins. What the review
> changed — including the `pepper` collision that was one word from shipping — is written
> up in [`architecture.md`](architecture.md) §4.

**Dropped:** `bread_wm` and `pb` (kept as *aliases*, because published weeks still speak
them), `eggs`, `onions`, `tinned_tuna`, `ground_black_pepper`, `red_wine`.
**Split:** `salt_pepper` → `salt` + `black_pepper`.

This is the `ingredients` table proposed in [`architecture.md`](architecture.md) §4 —
the key that joins a recipe ingredient to a pantry row to a shop product, and the thing
that currently does not exist. Stages B, C, D and E all depend on it.

> ⚠️ **This is a draft to be red-penned, not a decision.** It was assembled mechanically
> from three sources and the joins between them are exactly where judgement is needed.
> Rows marked 🔴 are ones I could not settle and should not settle alone.

## How it was built, and the one rule that constrained it

⭐ **Where a pack key already exists, it wins.** `weeks.doc` already keys its structured
ingredient maps (`dinUse`, `sunUse`, `use`, `held`, `floor`) on pack keys, and every
published week speaks that vocabulary. Inventing prettier keys would mean migrating
published weeks for no functional gain.

| source | entries |
|---|--:|
| buyable packs in the current week | 54 |
| held-only keys (stock with no pack this week) | 11 |
| pantry rows with no matching pack | 29 |
| ⭐ freed from inside the five food *bundle* rows | 31 |
| **total** | **125** |

**17 pack↔pantry pairs were merged** — the same ingredient recorded twice
under different names. Those merges are listed at the end and are worth checking first,
because a wrong merge silently conflates two ingredients.

`in recipes` counts how many of the 36 library recipes mention it. **A count of 0 is not
a problem** — it means the item is held but nothing currently cooks with it, which is the
orphan signal the pantry already tracks.


## chilled  (34)

| key | name | pack | pantry row | in recipes | notes |
|---|---|---|---|--:|---|
| `lemon` | Lemons | `lemon` | — | 26 |  |
| `onion` | Onions | `onion` | — | 23 |  |
| `carrot` | Carrots | `carrot` | — | 14 |  |
| `spring_onion` | Spring onions | `spring_onion` | — | 8 |  |
| `celery` | Celery | `celery` | — | 8 |  |
| `cheddar` | Extra mature cheddar | `cheddar` | `extra-mature-cheddar` | 6 |  |
| `egg` | Eggs | `egg` | — | 5 |  |
| `cucumber` | Cucumber | `cucumber` | — | 4 |  |
| `pepper` | Mixed peppers | `pepper` | — | 4 |  |
| `salmon` | Salmon fillets | `salmon` | — | 4 |  |
| `greek0` | Greek style fat free yoghurt | `greek0` | `greek-style-yoghurt` | 4 |  |
| `potato` | Potatoes | `potato` | — | 3 |  |
| `chicken_br` | Chicken breast fillets | `chicken_br` | — | 3 |  |
| `mince5` | Beef lean steak mince 5% | `mince5` | — | 3 |  |
| `milk_semi` | Milk | `milk_semi` | — | 3 |  |
| `broccoli` | Broccoli | `broccoli` | `broccoli` | 2 |  |
| `cauliflower` | Cauliflower | `cauliflower` | — | 2 |  |
| `basa` | Basa fillets | `basa` | — | 2 |  |
| `bacon` | Smoked streaky bacon | `bacon` | — | 2 |  |
| `ham` | Cooked ham | `ham` | `cooked-ham` | 2 |  |
| `feta` | Feta | `feta` | — | 2 |  |
| `chicken_th` | Chicken thigh fillets | `chicken_th` | — | 1 |  |
| `halloumi` | Halloumi | `halloumi` | — | 1 |  |
| `banana` | Bananas | `banana` | — | — |  |
| `apple` | Pink Lady apples | `apple` | — | — |  |
| `lettuce` | Sweet gem lettuce | `lettuce` | — | — |  |
| `vine_tom` | Sweet vine tomatoes | `vine_tom` | — | — |  |
| `sardine` | Sardines in tomato sauce | `sardine` | `sardines-in-tomato-sauce` | — |  |
| `beef_stew` | Stewing beef | `beef_stew` | — | — |  |
| `milk_skim` | Milk | `milk_skim` | — | — |  |
| `oat_milk` | Oat milk | `oat_milk` | — | — |  |
| `eggs` | Eggs | — | `eggs` | — | ⚠️ ambiguous vs egg,noodles,tagliatelle |
| `onions` | Onions | — | `onions` | — | ⚠️ ambiguous vs spring_onion,onion |
| `sweet_potatoes` | Sweet potatoes | — | `sweet-potatoes` | — |  |

## bakery  (5)

| key | name | pack | pantry row | in recipes | notes |
|---|---|---|---|--:|---|
| `bagel` | Bagels | `bagel` | — | 1 |  |
| `bread_seed` | Multiseed wholemeal loaf | `bread_seed` | — | — |  |
| `bread_wm` | Bread | `bread_wm` | — | — |  |
| `malt_loaf` | Malt loaf | `malt_loaf` | — | — |  |
| `bread` | Bread | — | `bread-sliced-loaf` | — | ⚠️ ambiguous vs bread_seed,bread_wm |

## dry goods  (33)

| key | name | pack | pantry row | in recipes | notes |
|---|---|---|---|--:|---|
| `olive_oil` | Olive oil | `olive_oil` | `olive-oil` | 25 |  |
| `rice` | Chinese rice wine | — | `rice` | 14 |  |
| `flour` | Plain flour | — | `plain-flour` | 12 |  |
| `almond` | Flaked almonds | — | `flaked-almonds` | 11 |  |
| `sultana` | Sultanas | — | `sultanas` | 8 |  |
| `chickpea` | Chickpea | — | — | 8 |  |
| `sesame_oil` | Toasted sesame oil | `sesame_oil` | `toasted-sesame-oil` | 6 |  |
| `capers` | Capers | `capers` | — | 6 |  |
| `couscous` | Couscous | — | `couscous` | 6 |  |
| `peanut_butter` | Peanut butter | — | `peanut-butter` | 6 |  |
| `tom_tin` | Chopped tomatoes | `tom_tin` | — | 5 |  |
| `panko` | Panko breadcrumbs | — | `panko-breadcrumbs` | 5 |  |
| `honey` | Honey | — | `honey` | 4 |  |
| `noodles` | Egg noodles | `noodles` | — | 2 |  |
| `tagliatelle` | Egg tagliatelle | `tagliatelle` | — | 2 |  |
| `fusilli` | Fusilli | `fusilli` | — | 2 |  |
| `stout` | Stout | `stout` | — | 2 |  |
| `tom_puree` | Tomato double concentrate | `tom_puree` | — | 1 |  |
| `butterbean` | Butter beans | `butterbean` | — | 1 |  |
| `kidney` | Red kidney beans | `kidney` | — | 1 |  |
| `mayo` | Mayonnaise | `mayo` | — | 1 |  |
| `suet` | Shredded suet | `suet` | — | 1 |  |
| `bulgur` | Bulgur wheat | — | `bulgur-wheat` | 1 |  |
| `oats` | Porridge oats | `oats` | `porridge-oats` | — |  |
| `whey` | Whey protein | `whey` | — | — |  |
| `protein_bar` | Protein bars | `protein_bar` | — | — |  |
| `peanuts` | Salted peanuts | `peanuts` | — | — |  |
| `sweetcorn` | Sweetcorn | `sweetcorn` | — | — |  |
| `tuna` | Tuna chunks in spring water | `tuna` | — | — |  |
| `pb` | Pb | — | — | — |  |
| `fava` | Greek fava | — | `greek-fava-lemnian-lathyrus-ochrus` | — |  |
| `bourbon_biscuits` | Bourbon biscuits | — | `bourbon-biscuits` | — |  |
| `coffee_beans` | Coffee beans | — | `coffee-beans` | — |  |

## pasta & grains  (3)

| key | name | pack | pantry row | in recipes | notes |
|---|---|---|---|--:|---|
| `pasta` | Pasta | — | `pasta-dried` | 6 |  |
| `egg_noodles` | Egg noodles | — | `egg-noodles` | — | ⚠️ ambiguous vs egg,noodles |
| `gnocchi` | Gnocchi | — | `gnocchi` | — |  |

## pulses & tinned  (2)

| key | name | pack | pantry row | in recipes | notes |
|---|---|---|---|--:|---|
| `red_lentils` | Red lentils | — | `red-lentils` | 8 |  |
| `tinned_tuna` | Tinned tuna | — | `tinned-tuna` | 2 |  |

## oils & condiments  (3)

| key | name | pack | pantry row | in recipes | notes |
|---|---|---|---|--:|---|
| `salt_pepper` | Salt & pepper | — | `salt-pepper` | 5 |  |
| `cooking_oil` | Cooking oil | — | `cooking-oil-sunflower` | — |  |
| `hot_sauce` | Hot sauce | — | `hot-sauce-bottles` | — |  |

## sauces & sachets  (17)

| key | name | pack | pantry row | in recipes | notes |
|---|---|---|---|--:|---|
| `tomato_paste` | Tomato paste | — | — | 29 | 🔴 currently inside "Pastes" ⚠️ a PASTE sachet — not tinned tomatoes (tom_tin) |
| `ginger_garlic_paste` | Ginger & garlic paste | — | — | 21 | 🔴 currently inside "Pastes" |
| `roasted_garlic_paste` | Roasted garlic paste | — | — | 12 | 🔴 currently inside "Pastes" |
| `sriracha` | Sriracha | — | `sriracha` | 10 |  |
| `chicken_stock` | Chicken stock | — | — | 10 | 🔴 currently inside "Stocks & thickeners" |
| `soy_sauce` | Soy sauce | — | `soy-sauce` | 8 |  |
| `balsamic_vinegar` | Balsamic vinegar | — | — | 7 | 🔴 currently inside "Vinegars & cooking wines" |
| `cornflour` | Cornflour | — | — | 6 | 🔴 currently inside "Stocks & thickeners" |
| `white_wine_vinegar` | White wine vinegar | — | — | 6 | 🔴 currently inside "Vinegars & cooking wines" |
| `mint_sauce` | Mint sauce | — | `mint-sauce` | 4 |  |
| `cider_vinegar` | Cider vinegar | — | — | 4 | 🔴 currently inside "Vinegars & cooking wines" |
| `vegetable_stock` | Vegetable stock | — | — | 4 | 🔴 currently inside "Stocks & thickeners" |
| `creamed_coconut` | Creamed coconut | — | `creamed-coconut` | 2 |  |
| `mirin` | Mirin | — | — | 2 | 🔴 currently inside "Vinegars & cooking wines" |
| `fish_sauce` | Fish sauce | — | `fish-sauce` | — |  |
| `red_wine` | Red wine | — | — | — | 🔴 currently inside "Pastes" 🔴 AMBIGUOUS — appears in BOTH "Pastes" (red wine paste 10 g) and "Vinegars & cooking wines" (red wine vinegar ×1). Two different things; needs splitting. |
| `tamarind` | Tamarind | — | — | — | 🔴 currently inside "Pastes" |

## spices  (28)

| key | name | pack | pantry row | in recipes | notes |
|---|---|---|---|--:|---|
| `smoked_paprika` | Smoked paprika | — | — | 17 | 🔴 currently inside "One-shot flavour bases" |
| `cumin_seeds` | Cumin seeds | — | `cumin-seeds` | 12 |  |
| `chilli_powder` | Chilli powder | — | — | 12 | 🔴 currently inside "Other spice jars" |
| `cayenne` | Cayenne | — | — | 10 | 🔴 currently inside "Other spice jars" |
| `saffron` | Saffron | — | — | 10 | 🔴 currently inside "One-shot flavour bases" |
| `oregano` | Oregano | — | `oregano` | 8 |  |
| `ras_el_hanout` | Ras el hanout | — | `ras-el-hanout` | 8 |  |
| `bay` | Bay leaves | — | — | 8 | 🔴 currently inside "Other spice jars" |
| `garam_masala` | Garam masala | — | `garam-masala` | 6 |  |
| `ground_cinnamon` | Ground cinnamon | — | — | 6 | 🔴 currently inside "Other spice jars" |
| `harissa` | Harissa | — | — | 6 | 🔴 currently inside "Other spice jars" |
| `thyme` | Thyme | — | — | 6 | 🔴 currently inside "Other spice jars" |
| `ground_turmeric` | Ground turmeric | — | `ground-turmeric` | 5 |  |
| `ground_ginger` | Ground ginger | — | `ground-ginger` | 4 |  |
| `rosemary` | Rosemary | — | `rosemary` | 4 |  |
| `baharat` | Baharat | — | — | 4 | 🔴 currently inside "One-shot flavour bases" |
| `ground_coriander` | Ground coriander | — | — | 3 | 🔴 currently inside "One-shot flavour bases" |
| `chilli_flakes` | Chilli flakes | — | — | 2 | 🔴 currently inside "One-shot flavour bases" |
| `greek_herbs` | Greek herbs | — | — | 2 | 🔴 currently inside "Other spice jars" |
| `ground_black_pepper` | Ground black pepper | — | — | 2 | 🔴 currently inside "Other spice jars" |
| `mixed_herbs` | Mixed herbs | — | `mixed-herbs` | — |  |
| `peri_peri_spice_mix` | Peri Peri spice mix | — | `peri-peri-spice-mix` | — |  |
| `cardamoms_whole` | Cardamoms whole | — | — | — | 🔴 currently inside "Other spice jars" |
| `curry_powder` | Curry powder | — | — | — | 🔴 currently inside "One-shot flavour bases" |
| `dried_basil` | Dried basil | — | — | — | 🔴 currently inside "Other spice jars" |
| `fennel_seeds` | Fennel seeds | — | — | — | 🔴 currently inside "One-shot flavour bases" |
| `ground_cumin` | Ground cumin | — | — | — | 🔴 currently inside "Other spice jars" |
| `ground_sumac` | Ground sumac | — | — | — | 🔴 currently inside "One-shot flavour bases" |

## ⭐ The pack ↔ pantry merges — check these first

Each of these was two records of one ingredient. A wrong merge conflates two different things and would mis-decrement both.

| canonical key | pack | pantry row |
|---|---|---|
| `almond` | `almond` | `flaked-almonds` |
| `broccoli` | `broccoli` | `broccoli` |
| `bulgur` | `bulgur` | `bulgur-wheat` |
| `cheddar` | `cheddar` | `extra-mature-cheddar` |
| `couscous` | `couscous` | `couscous` |
| `fava` | `fava` | `greek-fava-lemnian-lathyrus-ochrus` |
| `flour` | `flour` | `plain-flour` |
| `greek0` | `greek0` | `greek-style-yoghurt` |
| `ham` | `ham` | `cooked-ham` |
| `honey` | `honey` | `honey` |
| `oats` | `oats` | `porridge-oats` |
| `olive_oil` | `olive_oil` | `olive-oil` |
| `panko` | `panko` | `panko-breadcrumbs` |
| `rice` | `rice` | `rice` |
| `sardine` | `sardine` | `sardines-in-tomato-sauce` |
| `sesame_oil` | `sesame_oil` | `toasted-sesame-oil` |
| `sultana` | `sultana` | `sultanas` |

## 🔴 Still unresolved from recipe prose — 71 distinct, 84 mentions

These appear in a recipe's ingredient line but did not match any entry above. Most are wording variants (`large onion`, `flat-leaf parsley`); some are genuinely missing and need adding.

| mentions | as written in the recipe |
|--:|---|
| 6 | parsley |
| 3 | sugar |
| 2 | coconut milk |
| 2 | beef mince 20% fat |
| 2 | spaghetti |
| 2 | pork loin steaks |
| 2 | bone-in chicken thighs |
| 2 | super-firm tofu |
| 1 | diced beef |
| 1 | baking powder |
| 1 | worcestershire |
| 1 | beef brisket |
| 1 | dried apricots |
| 1 | chicken breast sliced |
| 1 | chorizo |
| 1 | firm tofu |
| 1 | ½ red pepper |
| 1 | dark chocolate |
| 1 | lime |
| 1 | chicken legs |
| 1 | smoked bacon lardons |
| 1 | chestnut mushrooms |
| 1 | merlot |
| 1 | thumb ginger |
| 1 | green chilli |
| 1 | baby plum tomatoes |
| 1 | black olives |
| 1 | pinch cinnamon |
| 1 | salt for brining |
| 1 | salamousas φαβα λημνου  500 g |
| 1 | greek yoghurt 0% fat |
| 1 | large pepper |
| 1 | roasted peanuts |
| 1 | milk & butter |
| 1 | farfalle |
| 1 | lemnian fava |
| 1 | ½ eating apple |
| 1 | ¼ white cabbage |
| 1 | sardines in oil |
| 1 | anchovy fillets |
| 1 | fennel bulb |
| 1 | raisins |
| 1 | flat-leaf parsley |
| 1 | wholegrain mustard |
| 1 | salt for dry-brining |
| 1 | sweet potato |
| 1 | greens |
| 1 | red + 1 green pepper |
| 1 | whole milk |
| 1 | nutmeg |
| 1 | dry white wine |
| 1 | passata |
| 1 | parmesan |
| 1 | tagliatelle or rigatoni |
| 1 | bone-in skin-on chicken thighs |
| 1 | sweet potato cubed |
| 1 | peppers chunked |
| 1 | sweet potato in wedges |
| 1 | baby spinach |
| 1 | chicken breast diced ~1 cm |

## What I could not decide

1. **`red_wine`** appears inside *both* `Pastes` (a 10 g red-wine paste sachet) and
   `Vinegars & cooking wines` (red wine vinegar). Two different products; the vocabulary
   needs two keys and I do not know which recipes mean which.
2. **Generic vs specific.** Recipes say `oil`, `milk`, `yoghurt`, `cheese`. The house
   holds sunflower *and* olive oil, skimmed *and* semi-skimmed *and* oat milk, Greek 0%
   *and* Greek style. A recipe saying "oil" has to resolve to one of them before a
   decrement can be correct.
3. **Whether the five food bundles get split.** Everything marked 🔴 *currently inside*
   depends on it. Until they are split those ingredients cannot be decremented or checked.
4. **Proteins by cut.** `chicken_br`, `chicken_th` and `chicken_legs` are three different
   pack keys and recipes say all of "chicken", "chicken breast", "bone-in skin-on chicken
   thighs". Some of this is genuinely ambiguous in the source text.
