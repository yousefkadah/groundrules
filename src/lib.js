'use strict';

// Back-compat shim. The engine now lives in the layered src/ modules
// (models · detectors · strategies · services · cli). This re-exports the
// stable functional facade from src/index.js.
module.exports = require('./index');
