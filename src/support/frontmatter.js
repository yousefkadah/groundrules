'use strict';

/**
 * Parse a leading `--- ... ---` frontmatter block into a flat object.
 * Tolerates a UTF-8 BOM and CRLF line endings (Windows-authored SKILL.md files).
 */
function parseFrontmatter(md) {
  const text = md.charCodeAt(0) === 0xFEFF ? md.slice(1) : md;
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: text };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const mm = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (mm) data[mm[1]] = mm[2].replace(/^["']|["']$/g, '');
  }
  return { data, body: m[2] };
}

module.exports = { parseFrontmatter };
