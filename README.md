# Recipe Grids

Recipes stored as dependency grids rather than prose: ingredients stack down the left, and merged cells to the right show exactly what gets combined with what, in what order. The final step spans the whole table.

The format makes structure visible that a numbered method hides — which branches are independent, which ingredient enters twice, which prep is a dead end that never joins the main flow.

## Running it

The app is static, no build step. But browsers block `fetch` from `file://`, so it needs to be served:

```
npm start          # python3 -m http.server 8000
```

Then open <http://localhost:8000>. Any static host works — GitHub Pages, Netlify, an S3 bucket. Push the folder as-is.

```
npm run validate   # check recipes.json before committing
```

## Layout

```
index.html        page shell
recipes.json      all recipe data — the source of truth
src/grid.js       layout engine: tree → table cells with rowspans
src/app.js        index, search, detail view, cross-links
src/styles.css    
validate.js       checks ids, refs, tree shape
skill/SKILL.md    the authoring spec — how to turn a recipe into a tree
```

`recipes.json` is the only file you edit to add a recipe. Everything else is machinery.

## The data

```jsonc
{
  "recipes": [
    {
      "id": "tadka-dal",              // kebab-case slug, stable, used by refs
      "title": "Tadka Dal",
      "source": "George Brown College — Indian Cooking 1",
      "url": "https://…",             // optional
      "component": true,              // optional — files it under Components
      "supersedes": ["old-slug"],     // optional — retires a renamed entry
      "yield": "4 portions",
      "timeActive": "20 min",
      "timeTotal": "50 min",
      "tags": ["indian", "lentils"],
      "prep": ["Keep the pot below a boil"],   // full-width banner rows
      "tree": { }
    }
  ]
}
```

### Trees

Two node types. An operation has `op` and `children`; an ingredient is a leaf.

```jsonc
{ "op": "fold in", "detail": "until glossy", "note": "…", "children": [ ] }
{ "item": "unsalted butter", "us": "4 oz", "metric": "115 g" }
```

Children are listed in the order they're added. Each operation node becomes one cell spanning every ingredient beneath it, so **ingredients combined in one step must be adjacent** — reordering the source's ingredient list is the main work of authoring an entry.

`detail` carries times, temperatures and speeds. It should state a total, never chain durations: "stir 40 seconds, then cook 7 minutes" reads as 7:40 when the stirring is the first stretch of the 7 minutes.

`note` becomes a numbered footnote. Three per recipe is plenty.

### Cross-references

An ingredient can point at another recipe:

```jsonc
{ "item": "dashi stock", "us": "400 mL", "ref": "dashi" }
```

It renders as a link if that id exists and as plain text otherwise, so setting a `ref` speculatively costs nothing — it wires itself up when the component gets added. The referenced recipe lists everything pointing at it under **Used in**.

### Ingredients the recipe produces

A tree can't show one step feeding two branches, which is what happens when soaking mushrooms yields both mushrooms and soaking liquid. Give the by-product its own row pointing home:

```jsonc
{ "item": "shiitake soaking liquid", "us": "1/4 cup",
  "derivedFrom": "dried shiitake mushroom",
  "derivedLabel": "from the shiitake soak" }
```

`derivedFrom` matches another leaf's `item` exactly, within the same recipe. Make sure the producing step is a visible cell rather than buried in a `detail`.

## Adding a recipe

1. Read `skill/SKILL.md` — it covers the judgment calls: how to reorder ingredients, when to split one ingredient across two rows, what belongs in a banner row versus a footnote.
2. Append the object to `recipes.json`.
3. `npm run validate`.
4. Commit.

The same spec is packaged as a Claude skill. Zip the `skill/` directory and upload it under Customize → Skills, and Claude will produce conforming JSON from a photographed page or a link.

## Notes on the design

Grids get wide, and that's information rather than a defect. A recipe built in one pan — sear, roast, season, fold, fold — produces a near-diagonal staircase with almost as many columns as rows, because nothing converges. Gohan is 2 rows by 9 columns: two ingredients, eight operations. Don't collapse steps to narrow the table.

The palette is light-only by design. Operation labels rotate vertical below 640px so wide grids fit a phone.
