/*!
 * Copyright (c) 2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

import {base64url} from './base64url.js';

export class MasterKey {
  /**
   * Creates a new instance of a MasterKey. This function should never be
   * called directly. Use one of these methods to create a MasterKey instance:
   *
   * `MasterKey.generate`
   * `MasterKey.unwrapWithPassword`
   * `MasterKey.unwrapWithBiometric`
   *
   * @param key the master HMAC CryptoKey used to derive other keys for
   *          encryption, decryption, and blinding operations.
   *
   * @return a new MasterKey instance.
   */
  constructor({key}) {
    this.master = key;
    this.kek = null;
    this.hmac = null;
  }

  /**
   * Encrypts a Uint8Array of data. The data will be encrypted using a randomly
   * generated 256-bit AES-GCM content encryption key (CEK). The CEK is
   * then wrapped using a 256-bit AES-KW key encryption key (KEK). The KEK is
   * derived from the master HMAC key.
   *
   * @param data the Uint8Array of data to encrypt.
   *
   * @return a Promise that resolves to a JWE.
   */
  async encrypt({data}) {
    data = _strToUint8Array(data);

    // generate content encryption key
    const cek = await crypto.subtle.generateKey(
      {name: 'AES-GCM', length: 256},
      // key must be extractable in order to be wrapped
      true,
      ['encrypt']);

    // wrap content encryption key with `kek`
    const wrapped = await crypto.subtle.wrapKey('raw', cek, this.kek, 'AES-KW');

    // encrypt data
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const tagBytes = 16;
    const tagLength = tagBytes * 8;
    const encrypted = new Uint8Array(await crypto.subtle.encrypt(
      {name: 'AES-GCM', iv, tagLength}, cek, data));
    // split ciphertext and tag
    const ciphertext = encrypted.subarray(0, encrypted.length - tagBytes);
    const tag = encrypted.subarray(encrypted.length - tagBytes);

    // represent encrypted data as JWE
    const header = {
      alg: 'A256KW',
      enc: 'A256GCM'
    };
    const jwe = {
      unprotected: header,
      encrypted_key: base64url.encode(new Uint8Array(wrapped)),
      iv: base64url.encode(iv),
      ciphertext: base64url.encode(ciphertext),
      tag: base64url.encode(tag)
    };
    return jwe;
  }

  /**
   * Encrypts an object. The object will be serialized to JSON and passed
   * to `encrypt`.
   *
   * @param obj the object to encrypt.
   *
   * @return a Promise that resolves to a JWE.
   */
  async encryptObject({obj}) {
    return this.encrypt({data: JSON.stringify(obj)});
  }

  /**
   * Decrypts a JWE. The only JWEs currently supported use an `alg` of `A256KW`
   * and `enc` of `A256GCM`. These parameters refer to data that has been
   * encrypted using a 256-bit AES-GCM content encryption key CEK that has
   * been wrapped using a 256-bit AES-KW key encryption key KEK. The KEK
   * is derived from the master HMAC key.
   *
   * @param jwe the JWE to decrypt.
   *
   * @return a Promise that resolves to a UInt8Array of data.
   */
  async decrypt({jwe}) {
    if(!(jwe && typeof jwe === 'object')) {
      throw new TypeError('"jwe" must be an object.');
    }
    // validate header
    const header = jwe.unprotected;
    if(!(header && typeof header === 'object' &&
      header.alg === 'A256KW' && header.enc === 'A256GCM')) {
      throw new Error('Invalid or unsupported JWE header.');
    }
    // validate encrypted_key and data
    if(typeof jwe.encrypted_key !== 'string') {
      throw new Error('Invalid or missing "encrypted_key".');
    }
    if(typeof jwe.iv !== 'string') {
      throw new Error('Invalid or missing "iv".');
    }
    if(typeof jwe.ciphertext !== 'string') {
      throw new Error('Invalid or missing "ciphertext".');
    }
    if(typeof jwe.tag !== 'string') {
      throw new Error('Invalid or missing "tag".');
    }

    // use `kek` to unwrap encrypted key to get content encryption key
    const wrapped = base64url.decode(jwe.encrypted_key);
    const cek = await crypto.subtle.unwrapKey(
      'raw', wrapped, this.kek, 'AES-KW', 'AES-GCM', false, ['decrypt']);

    // decrypt `ciphertext`
    const ciphertext = base64url.decode(jwe.ciphertext);
    const iv = base64url.decode(jwe.iv);
    const tag = base64url.decode(jwe.tag);
    const tagLength = tag.length * 8;
    const encrypted = new Uint8Array(ciphertext.length + tag.length);
    encrypted.set(ciphertext);
    encrypted.set(tag, ciphertext.length);
    const decrypted = new Uint8Array(await crypto.subtle.decrypt(
      {name: 'AES-GCM', iv, tagLength}, cek, encrypted));
    return decrypted;
  }

  /**
   * Decrypts a JWE that must contain an encrypted object. This method will
   * call `decrypt` and then `JSON.parse` the resulting decrypted UTF-8 data.
   *
   * @param jwe the JWE to decrypt.
   *
   * @return a Promise that resolves to an object.
   */
  async decryptObject({jwe}) {
    const data = await this.decrypt({jwe});
    return JSON.parse(new TextDecoder().decode(data));
  }

  /**
   * Blinds the given String or Uint8Array of data using an HMAC key that is
   * derived from the master HMAC key.
   *
   * @param data the String or Uint8Array of data to blind.
   *
   * @return a Promise that resolves to a base64url-encoded HMAC signature.
   */
  async blind({data}) {
    data = _strToUint8Array(data);
    const signature = new Uint8Array(
      await crypto.subtle.sign('HMAC', this.hmac, data));
    return base64url.encode(signature);
  }

  /**
   * Wraps (encrypts) the master HMAC key using password-based encryption.
   * This method will derive a 256-bit AES-KW key from a password using
   * PBKDF2 and use it to wrap the master HMAC key. The resulting wrapped
   * key is represented as a JWE with an `encrypted_key`.
   *
   * @param password the password to use.
   *
   * @return a Promise that resolves to an encrypted key JWE.
   */
  async wrapWithPassword({password}) {
    // get password key to derive with
    const passwordKey = await _passwordToKey(password);

    // derive wrapping key
    const salt = crypto.getRandomValues(new Uint8Array(32));
    const iterations = 4096;
    const wrappingKey = await crypto.subtle.deriveKey(
      {name: 'PBKDF2', salt, iterations, hash: 'SHA-512'},
      passwordKey,
      {name: 'AES-KW', length: 256},
      false,
      ['wrapKey']);

    // wrap master key
    const wrapped = await crypto.subtle.wrapKey(
      'raw', this.master, wrappingKey, 'AES-KW');

    // represent master key as JWE
    const header = {
      alg: 'PBES2-HS512+A256KW',
      p2c: iterations,
      p2s: base64url.encode(salt)
    };
    const jwe = {
      unprotected: header,
      encrypted_key: base64url.encode(new Uint8Array(wrapped))
    };
    return jwe;
  }

  async wrapWithBiometric() {
    throw new Error('Not implemented.');
  }

  /**
   * Generates a new MasterKey instance.
   *
   * @return a Promise that resolves to a MasterKey instance.
   */
  static async generate() {
    // master key is an HMAC key
    const key = await crypto.subtle.generateKey(
      {name: 'HMAC', hash: {name: 'SHA-256'}},
      // master key must be extractable in order to wrap it
      true,
      ['sign']);
    const master = new MasterKey({key});
    await master._init();
    return master;
  }

  /**
   * Unwraps (decrypts) an encrypted key JWE using password-based encryption.
   * The JWE must contain an encrypted HMAC master key. This method will derive
   * a 256-bit AES-KW key from a password using PBKDF2 and use it to unwrap the
   * master HMAC key. A `MasterKey` instance is returned as a result of this
   * operation.
   *
   * @param password the password to use.
   *
   * @return a Promise that resolves to a MasterKey instance.
   */
  static async unwrapWithPassword({password, jwe}) {
    if(!(jwe && typeof jwe === 'object')) {
      throw new TypeError('"jwe" must be an object.');
    }
    // validate header
    const header = jwe.unprotected;
    if(!(header && typeof header === 'object' &&
      header.alg === 'PBES2-HS512+A256KW' &&
      typeof header.p2s === 'string' &&
      Number.isInteger(header.p2c))) {
      throw new Error('Invalid or unsupported JWE header.');
    }
    // validate encrypted_key
    if(typeof jwe.encrypted_key !== 'string') {
      throw new Error('Invalid or missing "encrypted_key".');
    }

    // get password key to derive with
    const passwordKey = await _passwordToKey(password);

    // derive unwrapping key
    const salt = base64url.decode(header.p2s);
    const iterations = header.p2c;
    const unwrappingKey = await crypto.subtle.deriveKey(
      {name: 'PBKDF2', salt, iterations, hash: 'SHA-512'},
      passwordKey,
      {name: 'AES-KW', length: 256},
      false,
      ['unwrapKey']);

    // unwrap master key
    const wrapped = base64url.decode(jwe.encrypted_key);
    const key = await crypto.subtle.unwrapKey(
      'raw', wrapped, unwrappingKey,
      'AES-KW', {name: 'HMAC', hash: {name: 'SHA-256'}},
      // master key must be extractable in order to be wrapped
      true,
      ['sign']);

    const master = new MasterKey({key});
    await master._init();
    return master;
  }

  static async unwrapWithBiometric() {
    throw new Error('Not implemented.');
  }

  // derive the `kek` and `hmac` keys from the master HMAC CryptoKey
  async _init() {
    this.kek = await this._deriveKey('kek');
    this.hmac = await this._deriveKey('hmac');
  }

  // derive a key of `type` from the master HMAC CryptoKey
  async _deriveKey(type) {
    let key;
    const typeData = new TextEncoder().encode(type);
    let keyData;
    try {
      keyData = new Uint8Array(await crypto.subtle.sign(
        {name: 'HMAC'}, this.master, typeData));
      let algorithm;
      let usages;
      if(type === 'kek') {
        algorithm = {name: 'AES-KW', length: 256};
        usages = ['wrapKey', 'unwrapKey'];
      } else {
        algorithm = {name: 'HMAC', hash: {name: 'SHA-256'}};
        usages = ['sign', 'verify'];
      }
      key = await crypto.subtle.importKey(
        'raw', keyData, algorithm, false, usages);
    } finally {
      if(keyData) {
        keyData.fill(0);
      }
    }
    return key;
  }
}

// encode a password string into a Uint8Array of UTF-8 bytes
async function _passwordToKey(password) {
  if(typeof password !== 'string') {
    throw new TypeError('"password" must be a string.');
  }

  // get password key to derive with
  const passwordData = new TextEncoder().encode(password);
  try {
    return crypto.subtle.importKey(
      'raw', passwordData, {name: 'PBKDF2'}, false, ['deriveKey']);
  } finally {
    passwordData.fill(0);
  }
}

function _strToUint8Array(data) {
  if(typeof data === 'string') {
    // convert data to Uint8Array
    return new TextEncoder().encode(data);
  }
  if(!(data instanceof Uint8Array)) {
    throw new TypeError('"data" be a string or Uint8Array.');
  }
  return data;
}
