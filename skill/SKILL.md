---
name: recipe-grid
description: Convert any recipe into a dependency-grid table — ingredients as rows, merged cells showing which ones combine in what order — and file it in the user's searchable recipe archive. Use this whenever the user shares a recipe link, pastes a recipe, photographs one, or asks to "grid," "add to my recipes," "archive," or "reformat" a recipe. Also use when they want to search, browse, or re-open recipes they've already saved. Reach for it even when the request is casual ("can you save this one too?") — if a recipe is going in or coming out of the archive, this skill runs.
---

# Recipe Grid

Turn a recipe's prose method into a single table you can read at a glance: ingredients stacked down the left, and merged cells to the right showing exactly what gets combined with what, in what order. The whole method becomes structure instead of paragraphs.

The output is one accumulating artifact — a searchable archive that keeps every recipe processed so far.

## Workflow

1. **Get the recipe.** `web_fetch` the link. If the fetch fails or returns a paywall/JS shell, `web_search` for the recipe title plus a distinctive ingredient to find another copy, and say which source you used. If the user pasted text or an image, work from that.
2. **Extract** ingredients (with quantities) and the method.
3. **Build the tree** — the real work. See below.
4. **Render** by copying `assets/archive-template.html` and injecting the recipe JSON.
5. **Save** to `/mnt/user-data/outputs/recipe-grids.html` and `present_files` it.

Keep the filename `recipe-grids.html` every time. The archive lives in browser storage under a fixed key, so a re-rendered file picks up everything saved before it.

## Building the tree

Every ingredient is a leaf. Every action that combines or transforms things is a node, and its children are exactly the things going into it, listed in the order they're added. The final cooking step is the root, so it spans the whole grid.

```js
{op: "mix", detail: "until glossy", note: "…", children: [ … ]}   // action node
{item: "unsalted butter", us: "4 oz", metric: "115 g"}            // ingredient leaf
```

Rules that matter:

- **Reorder the ingredients.** Source recipes almost never list them in an order that groups cleanly. Anything combined in one step must end up adjacent, because a merged cell can only span contiguous rows. This reordering is the main thing the skill does that a copy-paste can't.
- **Solo prep gets its own node.** Butter that's melted before anything joins it is a `melt` node with one child. Same for toasting nuts, softening gelatin, browning butter.
- **Nest chronologically.** Each new step wraps the previous one plus whatever's being added. Depth equals time.
- **Keep verbs short** — two or three words, lowercase: `mix`, `fold in`, `whisk`, `simmer`, `knead`, `chill`. Temperatures, times, and speeds go in `detail`, not in the verb.
- **`detail` states the total, never a chain of durations.** "Stir 40 seconds, then cook 7 minutes" reads as 7:40 when the stirring is usually the first stretch of the 7 minutes. Put the total in `detail` and the technique in a `note`.
- **Split an ingredient used twice** into two leaves with the divided quantity (`2 Tbs, divided` becomes two rows of 1 Tbs), so each lands in the step that uses it.
- **Sub-components converge.** A frosting, a sauce, a streusel — each is its own branch that meets the main branch at whatever step joins them. One tree, not two grids. Only split into separate grids when two components genuinely never touch.
- **Prep steps that precede everything** — greasing a pan, preheating, bringing eggs to room temperature — go in the `prep` array as full-width rows on top. A constraint governing every step of the recipe belongs there too ("Keep the pot below a boil from start to finish"): a footnote hangs off one cell, but a banner row sits over the whole grid, which is where a rule that can ruin the dish at any stage should live.
- **`note` sparingly**, for the one or two steps where technique decides the outcome ("stop when the custard coats a spoon"). These become numbered footnotes. Three per recipe is plenty.
- **Don't collapse steps to narrow the grid.** A recipe built in one pan — sear, roast, season, brown, fold, fold — produces a near-diagonal staircase with almost as many columns as rows, and that's correct. It's the grid reporting that nothing converges. Keep single-child nodes that mark a real change (moving to the oven, dropping to low heat) and keep repeated actions separate when the source repeats them. Width is not a defect to engineer away.

### Worked example

The linear method "melt butter; stir in sugar, vanilla, and espresso; beat in eggs; fold in the dry ingredients; bake" becomes a spine five nodes deep:

```js
tree: {op:"bake", detail:"350°F (170°C), 30–40 min", children:[
  {op:"fold in", children:[
    {op:"mix", children:[
      {op:"mix", children:[
        {op:"melt", children:[{item:"unsalted butter", us:"4 oz", metric:"115 g"}]},
        {item:"sugar", us:"1 cup", metric:"200 g"},
        {item:"vanilla extract", us:"1/4 tsp", metric:"2.5 mL"},
        {item:"fresh brewed espresso", us:"4 Tbs", metric:"60 mL", note:"One shot; very strong coffee also works."}
      ]},
      {item:"large eggs", us:"2", metric:"100 g"}
    ]},
    {item:"all-purpose flour", us:"1/2 cup", metric:"80 g"},
    {item:"cocoa powder", us:"1/3 cup", metric:"80 g"},
    {item:"baking soda", us:"1/4 tsp", metric:"1.3 g"},
    {item:"table salt", us:"1/4 tsp", metric:"1.5 g"}
  ]}
]}
```

The dry ingredients sit at the end because they enter last, and the template draws the merged blank cell beside them automatically. Nothing about column widths or `rowspan` needs to be worked out by hand — the template computes all of it from the tree.

## Units

Give both systems on every quantity: `us` and `metric`, rendered as `4 oz (115 g)`. Convert whatever the source omits. Weigh-based conversions for baking ingredients should use standard densities (flour 120 g/cup, granulated sugar 200 g/cup, cocoa 85 g/cup, butter 227 g/cup), and round to something a scale can actually hit. Counts like eggs go in `us` with the gram weight in `metric`; leave `metric` off where a conversion would be silly (1 bay leaf).

## Components and chaining

Some recipes are inputs to other recipes — stocks, sauces, pickles, ramen eggs, spice pastes. Mark these `component: true` and they file under a separate **Components** heading on the index instead of mixing in with finished dishes.

When a recipe calls for something that could be a component, give that ingredient leaf a `ref` pointing at the component's `id`:

```js
{item: "ajitama (ramen eggs)", us: "2", ref: "ajitama-ramen-eggs"}
```

The template links it only if a recipe with that `id` is actually in the archive; otherwise it renders as ordinary text. So set `ref` whenever a component plausibly exists — a wrong guess costs nothing and a right one wires itself up the moment the component gets added. Slugs must be predictable for this to work: kebab-case the dish's common name (`chicken-stock`, `ajitama-ramen-eggs`, `nuoc-cham`).

The component's own page lists every recipe that references it under **Used in**, so the chain is walkable from both directions.

## Ingredients produced by the recipe itself

A grid is a tree, so one step feeding two different branches is a shape it can't draw. This comes up whenever a preparation yields two things that go separate ways — soaking dried mushrooms gives you both the mushrooms and the soaking liquid, blanching gives you the vegetable and sometimes the cooking water, rendering gives you the meat and the fat.

Give the produced ingredient its own row and point it back at its origin:

```js
{item: "shiitake soaking liquid", us: "1/4 cup", metric: "60 mL",
 derivedFrom: "dried shiitake mushroom", derivedLabel: "from the shiitake soak"}
```

`derivedFrom` matches another leaf's `item` exactly. The row renders with a pointer under the name; tapping it jumps to and highlights the source row. Make sure the operation that produces it is a visible cell — split `soak, destem and slice` into a `soak` node wrapping a `destem and slice` node, so the grid shows the soak happening rather than burying it in a `detail`.

Don't solve this by silently listing the by-product as if it were bought. Someone reading the grid needs to know they're not shopping for it.

## The rest of the record

```js
{
  id: "espresso-brownies",        // kebab-case slug, stable — re-adding updates in place
  title: "Espresso Brownies",
  source: "Smitten Kitchen",      // publication or author
  url: "https://…",               // always include when there's a link
  yield: "16 squares",
  timeActive: "15 min",
  timeTotal: "1 hr",
  tags: ["dessert", "chocolate"], // 2–4, lowercase; these drive filtering
  prep: ["Butter and flour an 8×8-in pan", "Preheat oven to 350°F (170°C)"],
  supersedes: ["old-slug"],       // optional — retires an entry this one replaces
  tree: { … }
}
```

Use `supersedes` when a recipe's slug changes (a marinade stub becoming the full dish, say). Without it the archive keeps both.

When you complete a partial recipe with steps the source didn't record, say so in a footnote on the final cell. The person needs to know which parts came from their page and which came from you.

Keep every field terse enough to sit on one line in the interface. If a time isn't stated, estimate it from the method and don't flag the estimate in the record.

`source` is a search term, so name both the work and the person: `"Budget Bytes — Beth Moncel"`, `"The Last Schmaltz — Anthony Rose"`. For a book or a photographed page there's no `url` — leave it out rather than linking to a retailer. When a recipe is itself adapted from someone else, credit the book in `source` and note the original author in a footnote.

## Rendering

Copy the template, then replace the `/* INJECT_RECIPES */` marker with the new recipe objects:

```bash
cp assets/archive-template.html /mnt/user-data/outputs/recipe-grids.html
```

Only put **newly added** recipes in `PENDING_RECIPES`. Previously saved ones load from storage on their own; re-listing them isn't harmful but isn't necessary. When exactly one recipe is pending, the artifact opens straight to it; otherwise it opens on the index.

Don't restructure the template's CSS or layout engine to suit a particular recipe. If a recipe won't fit the format, that's a signal about the recipe, not the template — say so.

Three details in the template are load-bearing and were arrived at by fixing real breakage. Leave them alone:

- **The archive is light-only.** It declares `color-scheme: light` and ships no dark palette. A dark variant was tried and rejected — pale green on near-black is what the format looks worst as.
- **The page surface is painted by `body::before`,** not by `body` itself, because the host container overrides `body`'s background and strands the text on black.
- **Operation labels rotate vertical below 640px.** Horizontal verbs push the grid past the right edge of a phone and the last steps get clipped.

## Working from someone else's recipe

Quantities and the sequence of operations are facts, and the grid is a genuine restatement of them — but the source's prose is not yours to move. Write every verb and note fresh in the grid's own clipped register; never lift sentences, headnotes, or descriptive phrasing from the page. Always record `source` and `url` so the archive points back to whoever developed the recipe.

## After rendering

Say what changed in one or two lines — which recipe was added, anything you reordered or inferred, and any judgment call worth a second opinion (an ambiguous step, a missing temperature, a conversion you rounded). Then stop. The grid is the deliverable; it doesn't need narrating step by step.
