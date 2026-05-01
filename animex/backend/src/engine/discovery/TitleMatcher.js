/**
 * Normalizes title for loose comparison.
 * Removes all non-alphanumeric characters and lowercases.
 */
function normalize(title) {
  if (!title) return '';
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/**
 * Checks if two metadata inputs have matching canonical titles
 */
function isTitleMatch(t1, t2) {
  return normalize(t1) === normalize(t2);
}

module.exports = {
  normalize,
  isTitleMatch
};
