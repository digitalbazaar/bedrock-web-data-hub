/*
 * Copyright (c) 2018 Digital Bazaar, Inc. All rights reserved.
 */

const {config} = require('bedrock');
const path = require('path');

config.karma.suites['bedrock-web-private-remote-storage'] =
  path.join('web', '**', '*.js');
