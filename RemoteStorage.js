/*!
 * Copyright (c) 2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

import axios from 'axios';
import {KeyCache} from './KeyCache.js';
import {MasterKey} from './MasterKey.js';

export class RemoteStorage {
  constructor({
    accountId,
    baseUrl = '/private-storage'
  } = {}) {
    this.accountId = accountId;
    this.indexes = new Set();
    this.keyCache = new KeyCache();
    this._listener = null;
    const root = `${baseUrl}/${encodeURIComponent(accountId)}`;
    const documents = `${root}/documents`;
    this.urls = {
      masterKey: `${root}/master-key`,
      documents,
      query: `${root}/query`
    };
  }

  /**
   * Creates a master key for the remote storage. If one already exists,
   * a `DuplicateError` is thrown.
   *
   * @param password a password to use to protect the master key.
   *
   * @return a Promise that resolves to true once the operation completes.
   */
  async createMasterKey({password}) {
    const masterKey = await MasterKey.generate();
    const wrapped = await masterKey.wrapWithPassword({password});
    try {
      await axios.put(this.urls.masterKey, wrapped, {
        headers: {'If-None-Match': '*'}
      });
      this.keyCache.update({masterKey});
      return true;
    } catch(e) {
      const {response = {}} = e;
      if(response.status === 304) {
        const err = new Error('Duplicate error.');
        err.name = 'DuplicateError';
        throw err;
      }
      throw e;
    }
  }

  /**
   * Changes the password on the master key.
   *
   * @param password the new password to use to protect the master key.
   *
   * @return a Promise that resolves to true once the operation completes.
   */
  async changeMasterKeyPassword({password}) {
    const masterKey = await this._getMasterKey();
    const wrapped = await masterKey.wrapWithPassword({password});
    await axios.post(this.urls.masterKey, wrapped);
    this.keyCache.resetTimeout();
    return true;
  }

  /**
   * Gets the wrapped (password-encrypted) master key and unwraps it
   * using the given password.
   *
   * @param password the password to use to unwrap the master key.
   *
   * @return a Promise that resolves to the MasterKey instance.
   */
  async getMasterKey({password}) {
    const response = await axios.get(this.urls.masterKey);
    const jwe = response.data;
    return MasterKey.unwrapWithPassword({password, jwe});
  }

  async ensureIndex({attribute}) {
    if(typeof attribute !== 'string') {
      throw new TypeError('"attribute" must be a string.');
    }
    this.indexes.add(attribute);
  }

  async insert({doc}) {
    const encrypted = await this._encrypt(doc);
    try {
      await axios.post(this.urls.documents, encrypted);
      return true;
    } catch(e) {
      const {response = {}} = e;
      if(response.status === 409) {
        const err = new Error('Duplicate error.');
        err.name = 'DuplicateError';
        throw err;
      }
      throw e;
    }
  }

  async update({doc}) {
    const encrypted = await this._encrypt(doc);
    const url = `${this.urls.documents}/${encodeURIComponent(encrypted.id)}`;
    const response = await axios.post(url, encrypted);
    return response.data;
  }

  async delete({id}) {
    const url = `${this.urls.documents}/${encodeURIComponent(id)}`;
    const response = await axios.delete(url);
    return response.data;
  }

  async get({id}) {
    const masterKey = await this._getMasterKey();
    id = await this._blindId({id, masterKey});
    const url = `${this.urls.documents}/${encodeURIComponent(id)}`;
    const response = await axios.get(url);
    return this._decrypt(response.data);
  }

  async find({equals, has}) {
    // TODO: validate `equals` ... an array of objects w/key value pairs
    // TODO: validate `has` ... an array of strings
    // TODO: ensure ONLY `equals` or `has` is present

    const masterKey = await this._getMasterKey();

    const query = {};

    // blind `equals` and `has`
    if(equals) {
      if(!Array.isArray(equals)) {
        equals = [equals];
      }
      query.equals = await Promise.all(equals.map(async equal => {
        const result = {};
        for(const key in equal) {
          const value = equal[key];
          const attr = await this._blindAttribute({key, value, masterKey});
          result[attr.name] = attr.value;
        }
        return result;
      }));
    }
    if(has) {
      if(!Array.isArray(has)) {
        has = [has];
      }
      query.has = await Promise.all(
        has.map(key => masterKey.blind({data: key})));
    }

    // get results and decrypt them
    const response = await axios.post(this.urls.query, query);
    const encryptedDocs = response.data;
    return Promise.all(encryptedDocs.map(this._decrypt.bind(this)));
  }

  on(event, listener) {
    if(event !== 'masterKeyRequest') {
      throw new Error('"event" must be "masterKeyRequest".');
    }
    // TODO: support more than one listener
    if(this._listener) {
      throw new Error('Only one listener is permitted.');
    }
    this._listener = listener;
  }

  async _blindAttribute({key, value, masterKey}) {
    value = JSON.stringify({key: value});
    const attrName = await masterKey.blind({data: key});
    const attrValue = await masterKey.blind({data: value});
    return {name: attrName, value: attrValue};
  }

  async _blindId({id, masterKey}) {
    return masterKey.blind({data: id});
  }

  async _createAttributes({doc, masterKey}) {
    const attributes = [];
    for(const key in doc) {
      if(this.indexes.has(key)) {
        attributes.push(await this._blindAttribute(
          {key, value: doc[key], masterKey}));
      }
    }
    return attributes;
  }

  async _decrypt(encryptedDoc) {
    // validate `encryptedDoc`
    if(!(encryptedDoc && typeof encryptedDoc === 'object' &&
      typeof encryptedDoc.id === 'string' &&
      encryptedDoc.jwe && typeof encryptedDoc.jwe === 'object')) {
      throw new TypeError(
        '"encryptedDoc" must be an object with "id" and "jwe" properties.');
    }

    // decrypt doc
    const masterKey = await this._getMasterKey();
    const {jwe} = encryptedDoc;
    return masterKey.decryptObject({jwe});
  }

  async _encrypt(doc) {
    const masterKey = await this._getMasterKey();

    // create encrypted doc ID, attributes, and jwe
    const [id, attributes, jwe] = await Promise.all([
      this._blindId({id: doc.id, masterKey}),
      this._createAttributes({doc, masterKey}),
      masterKey.encryptObject({obj: doc})
    ]);

    // return encrypted document
    const encryptedDocument = {id, attributes, jwe};
    return encryptedDocument;
  }

  async _getMasterKey() {
    // return master key from cache if available
    if(this.keyCache.masterKey) {
      this.keyCache.resetTimeout();
      return this.keyCache.masterKey;
    }

    // get master key via `MasterKeyRequest` event
    if(!this._listener) {
      throw new Error('Master key not found.');
    }
    let result = Promise.resolve();
    const event = {
      name: 'MasterKeyRequest',
      accountId: this.accountId,
      async respondWith(promise) {
        result = promise;
      }
    };
    this._listener(event);
    const {masterKey, timeout} = await result;
    if(!(masterKey instanceof MasterKey)) {
      throw new TypeError('"masterKey" must be a MasterKey instance.');
    }

    // update cache
    this.keyCache.update({masterKey, timeout});
    return this.keyCache.masterKey;
  }
}
