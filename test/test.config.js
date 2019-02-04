/*
 * Copyright (c) 2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {config} = require('bedrock');
const path = require('path');

config.karma.suites['bedrock-web-data-hub'] = path.join('web', '**', '*.js');
