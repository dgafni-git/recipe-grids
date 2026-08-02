#!/usr/bin/env node
/**
 * Checks recipes.json for the mistakes that are easy to make by hand and
 * invisible in the browser: duplicate ids, references to recipes that don't
 * exist, `derivedFrom` pointing at an ingredient that isn't in the same grid,
 * and malformed tree nodes.
 *
 *   node validate.js
 *
 * Exits non-zero on error, so it works as a pre-commit hook or CI step.
 */

import { readFileSync } from 'node:fs';
import { buildCells, ingredients, references } from './src/grid.js';

const data = JSON.parse(readFileSync(new URL('./recipes.json', import.meta.url)));
const recipes = data.recipes || [];
const errors = [];
const warnings = [];

const ids = new Set();
for (const recipe of recipes) {
  const where = recipe.id || recipe.title || '(untitled)';

  if (!recipe.id) errors.push(`${where}: missing id`);
  else if (ids.has(recipe.id)) errors.push(`${where}: duplicate id`);
  else ids.add(recipe.id);

  if (!recipe.title) errors.push(`${where}: missing title`);
  if (!recipe.source) warnings.push(`${where}: no source recorded`);
  if (!recipe.tree) { errors.push(`${where}: missing tree`); continue; }

  // every node is either an operation with children, or an ingredient leaf
  (function walk(node, path) {
    const hasChildren = Array.isArray(node.children) && node.children.length > 0;
    if (hasChildren) {
      if (!node.op) errors.push(`${where} at ${path}: operation node has no "op"`);
      node.children.forEach((child, i) => walk(child, `${path}/${node.op || '?'}[${i}]`));
    } else if (!node.item) {
      errors.push(`${where} at ${path}: node is neither an operation nor an ingredient`);
    }
  })(recipe.tree, 'tree');

  const items = new Set(ingredients(recipe).map((leaf) => leaf.item));
  for (const leaf of ingredients(recipe)) {
    if (leaf.derivedFrom && !items.has(leaf.derivedFrom)) {
      errors.push(`${where}: derivedFrom "${leaf.derivedFrom}" is not an ingredient in this grid`);
    }
  }
}

for (const recipe of recipes) {
  for (const ref of references(recipe)) {
    if (!ids.has(ref)) {
      warnings.push(`${recipe.id}: ref "${ref}" has no recipe yet (renders as plain text)`);
    }
  }
  for (const old of recipe.supersedes || []) {
    if (ids.has(old)) errors.push(`${recipe.id}: supersedes "${old}", which still exists`);
  }
}

// dimensions, useful when a grid gets unexpectedly wide
const widest = recipes
  .map((r) => ({ id: r.id, ...buildCells(r.tree) }))
  .sort((a, b) => b.totalCols - a.totalCols)[0];

console.log(`${recipes.length} recipes, ${recipes.filter((r) => r.component).length} components`);
if (widest) console.log(`widest grid: ${widest.id} (${widest.rows}×${widest.totalCols})`);

warnings.forEach((w) => console.log(`  warn  ${w}`));
errors.forEach((e) => console.error(`  ERROR ${e}`));

if (errors.length) {
  console.error(`\n${errors.length} error(s)`);
  process.exit(1);
}
console.log('\nok');
