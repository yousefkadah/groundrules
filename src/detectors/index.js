'use strict';

/** The ordered detector registry. Order controls the order signals appear in. */
const LaravelDetector = require('./LaravelDetector');
const NodeTsDetector = require('./NodeTsDetector');
const VueDetector = require('./VueDetector');
const PythonDetector = require('./PythonDetector');
const GoDetector = require('./GoDetector');
const RailsDetector = require('./RailsDetector');
const RustDetector = require('./RustDetector');
const DotnetDetector = require('./DotnetDetector');

module.exports = [
  new LaravelDetector(),
  new NodeTsDetector(),
  new VueDetector(),
  new PythonDetector(),
  new GoDetector(),
  new RailsDetector(),
  new RustDetector(),
  new DotnetDetector(),
];
