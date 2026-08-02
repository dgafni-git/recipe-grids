/**
 * Grid layout engine.
 *
 * A recipe tree is turned into table cells. Every ingredient is a leaf and
 * becomes one row; every operation node becomes one merged cell spanning all
 * the ingredients beneath it. Column position is distance from the deepest
 * operation, so the first thing you do sits leftmost and the last spans the
 * whole table.
 *
 * The only shape this can't draw is a step whose output feeds two different
 * branches — see `derivedFrom` in the schema for how that's handled instead.
 */

export function leafCount(node) {
  return node.children && node.children.length
    ? node.children.reduce((sum, child) => sum + leafCount(child), 0)
    : 1;
}

export function buildCells(tree) {
  const leaves = [];
  let maxDepth = 0;

  (function scan(node, depth) {
    if (node.children && node.children.length) {
      maxDepth = Math.max(maxDepth, depth);
      node.children.forEach((child) => scan(child, depth + 1));
    } else {
      leaves.push(node);
    }
  })(tree, 0);

  const totalCols = maxDepth + 2; // ingredient column + one per operation depth
  const cells = [];

  (function place(node, depth, rowStart) {
    const myCol = 1 + (maxDepth - depth);
    let row = rowStart;
    let runStart = -1;
    let runLength = 0;

    const flushRun = () => {
      if (runLength && myCol - 1 > 0) {
        cells.push({
          row: runStart, col: 1,
          rowspan: runLength, colspan: myCol - 1,
          kind: 'blank',
        });
      }
      runStart = -1;
      runLength = 0;
    };

    node.children.forEach((child) => {
      if (child.children && child.children.length) {
        flushRun();
        place(child, depth + 1, row);
      } else {
        cells.push({
          row, col: 0, rowspan: 1, colspan: 1,
          kind: 'ingredient', node: child,
        });
        if (runStart < 0) runStart = row;
        runLength += 1;
      }
      row += leafCount(child);
    });
    flushRun();

    cells.push({
      row: rowStart, col: myCol,
      rowspan: leafCount(node), colspan: 1,
      kind: 'operation', node,
      from: rowStart, to: rowStart + leafCount(node) - 1,
    });
  })(tree, 0, 0);

  return { cells, rows: leaves.length, totalCols };
}

/** Flat list of every ingredient leaf, in grid row order. */
export function ingredients(recipe) {
  const out = [];
  (function walk(node) {
    if (node.children) node.children.forEach(walk);
    else out.push(node);
  })(recipe.tree);
  return out;
}

/** Ids of other recipes this one references. */
export function references(recipe) {
  return ingredients(recipe).map((leaf) => leaf.ref).filter(Boolean);
}
