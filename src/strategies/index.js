'use strict';

/** Maps an adapter `kind` to its render strategy instance. */
const InlineAdapterStrategy = require('./InlineAdapterStrategy');
const ImportAdapterStrategy = require('./ImportAdapterStrategy');
const CursorMdcStrategy = require('./CursorMdcStrategy');

module.exports = {
  inline: new InlineAdapterStrategy(),
  import: new ImportAdapterStrategy(),
  mdc: new CursorMdcStrategy(),
};
