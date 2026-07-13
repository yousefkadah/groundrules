'use strict';

/** A canonical section: a stable `key` (filename in .ai/) and a display `title`. */
class Section {
  constructor(key, title) {
    this.key = key;
    this.title = title;
  }
}

module.exports = Section;
