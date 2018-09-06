/*!
 * Copyright (c) 2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const DEFAULT_KEY_TIMEOUT = 60000;

export class KeyCache {
  constructor() {
    this.masterKey = null;
    this.expiration = {
      expires: null,
      timeout: 0,
      timerId: null
    };
  }

  async clear() {
    this.masterKey = null;
  }

  resetTimeout() {
    const {timeout} = this.expiration;
    clearTimeout(this.timerId);
    this.timerId = setTimeout(this.clear.bind(this), timeout);
  }

  update({masterKey, timeout = DEFAULT_KEY_TIMEOUT}) {
    this.masterKey = masterKey;
    this.expiration.timeout = timeout;
    this.resetTimeout();
  }
}
