'use strict';

/**
 * Parse a leading `--- ... ---` YAML-ish frontmatter block into a flat object.
 * Only supports the simple `key: value` lines that SKILL.md files use.
 */
function parseFrontmatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: md };
  const data = {};
  for (const line of m[1].split('\n')) {
    const mm = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (mm) data[mm[1]] = mm[2].replace(/^["']|["']$/g, '');
  }
  return { data, body: m[2] };
}

module.exports = { parseFrontmatter };
