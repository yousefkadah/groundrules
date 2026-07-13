'use strict';

/** A tool adapter target: where to write, and which render strategy to use. */
class Adapter {
  constructor({ id, path, kind, default: isDefault }) {
    this.id = id;
    this.path = path;
    this.kind = kind;
    this.default = !!isDefault;
  }
}

module.exports = Adapter;
