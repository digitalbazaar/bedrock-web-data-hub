/*!
 * Copyright (c) 2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

import axios from 'axios';
import {KeyCache} from './KeyCache.js';
import {MasterKey} from './MasterKey.js';

export class RemoteStorage {
  constructor({accountId, baseUrl = '/private-storage'} = {}) {
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
   * Gets the wrapped (password-encrypted) master key from and unwraps it
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

  /**
   * Ensures that future documents inserted or updated using this
   * RemoteStorage instance will be indexed according to the given
   * attribute, provided that they contain that attribute.
   *
   * @param attribute the attribute name.
   */
  ensureIndex({attribute}) {
    if(typeof attribute !== 'string') {
      throw new TypeError('"attribute" must be a string.');
    }
    this.indexes.add(attribute);
  }

  /**
   * Inserts a document into remote storage if it does not already exist. If
   * a document matching its ID already exists, a `DuplicateError` is thrown.
   *
   * @param doc the document to insert.
   *
   * @return a Promise that resolves to `true` once the operation completes.
   */
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

  /**
   * Updates a document in remote storage. If the document does not already
   * exist, it is created.
   *
   * @param doc the document to update.
   *
   * @return a Promise that resolves to `true` once the operation completes.
   */
  async update({doc}) {
    const encrypted = await this._encrypt(doc);
    const url = `${this.urls.documents}/${encodeURIComponent(encrypted.id)}`;
    await axios.put(url, encrypted);
    return true;
  }

  /**
   * Deletes a document from remote storage.
   *
   * @param doc the document to delete.
   *
   * @return a Promise that resolves to `true` if the document was deleted
   *         and `false` if it did not exist.
   */
  async delete({id}) {
    const url = await this._getEncryptedDocUrl(id);
    try {
      await axios.delete(url);
    } catch(e) {
      const {response = {}} = e;
      if(response.status === 404) {
        return false;
      }
      throw e;
    }
    return true;
  }

  /**
   * Gets a document from remote storage by its ID.
   *
   * @param id the ID of the document to get.
   *
   * @return a Promise that resolves to the document.
   */
  async get({id}) {
    const url = await this._getEncryptedDocUrl(id);
    let response;
    try {
      response = await axios.get(url);
    } catch(e) {
      response = e.response || {};
      if(response.status === 404) {
        const err = new Error('Document not found');
        err.name = 'NotFoundError';
        throw err;
      }
      throw e;
    }
    return this._decrypt(response.data);
  }

  /**
   * Finds documents based on their attributes. Currently, matching can be
   * performed using an `equals` or a `has` filter (but not both at once).
   *
   * The `equals` filter is an object with key-value attribute pairs. Any
   * document that matches *all* key-value attribute pairs will be returned. If
   * equals is an array, it may contain multiple such filters -- whereby the
   * results will be all documents that matched any one of the filters.
   *
   * The `has` filter is a string representing the attribute name or an
   * array of such strings. If an array is used, then the results will only
   * contain documents that possess *all* of the attributes listed.
   *
   * @param [equals] an object with key-value attribute pairs to match or an
   *          array of such objects.
   * @param [has] a string with an attribute name to match or an array of
   *          such strings.
   *
   * @return a Promise that resolves to the matching documents.
   */
  async find({equals, has}) {
    // validate params
    if(equals === undefined && has === undefined) {
      throw new Error('Either "equals" or "has" must be defined.');
    }
    if(equals !== undefined && has !== undefined) {
      throw new Error('Only one of "equals" or "has" may be defined at once.');
    }
    if(equals !== undefined) {
      if(Array.isArray(equals)) {
        if(!equals.every(x => (x && typeof x === 'object'))) {
          throw new TypeError('"equals" must be an array of objects.');
        }
      } else if(!(equals && typeof equals === 'object')) {
        throw new TypeError(
          '"equals" must be an object or an array of objects.');
      }
    }
    if(has !== undefined) {
      if(Array.isArray(has)) {
        if(!has.every(x => (x && typeof x === 'string'))) {
          throw new TypeError('"has" must be an array of strings.');
        }
      } else if(typeof has !== 'string') {
        throw new TypeError('"has" must be a string or an array of strings.');
      }
    }

    const masterKey = await this._getMasterKey();

    const query = {};

    if(equals) {
      // blind `equals`
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
    } else if(has !== undefined) {
      // blind `has`
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

  /**
   * Adds a `masterKeyRequest` event listener. This listener is responsible
   * for providing the master key when the `masterKeyRequest` event is
   * emitted. It is provided by passing a promise to `event.responseWith`
   * that resolves to: `{masterKey, timeout}` where `timeout` is an optional
   * timeout (in milliseconds) for caching the key. Once the timeout expires,
   * the event will be emitted again should the master key be required for
   * any operation.
   *
   * @param event the name of the event ("masterKeyRequest").
   * @param listener a function that receives an `event` object when the
   *          `masterKeyRequest` event is emitted.
   *
   * @return this RemoteStorage instance for chaining.
   */
  on(event, listener) {
    if(event !== 'masterKeyRequest') {
      throw new Error('"event" must be "masterKeyRequest".');
    }
    // TODO: support more than one listener
    if(this._listener) {
      throw new Error('Only one listener is permitted.');
    }
    this._listener = listener;
    return this;
  }

  // helper that blinds attributes using the master key
  async _blindAttribute({key, value, masterKey}) {
    value = JSON.stringify({key: value});
    const attrName = await masterKey.blind({data: key});
    const attrValue = await masterKey.blind({data: value});
    return {name: attrName, value: attrValue};
  }

  // helper that blinds a document ID using the master key
  async _blindId({id, masterKey}) {
    return masterKey.blind({data: id});
  }

  // helper that gets an encrypted document URL from a document ID
  async _getEncryptedDocUrl(id) {
    const masterKey = await this._getMasterKey();
    id = await this._blindId({id, masterKey});
    return `${this.urls.documents}/${encodeURIComponent(id)}`;
  }

  // helper that creates blinded attributes using the master key
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

  // helper that decrypts an encrypted doc to a clear doc
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
    const doc = await masterKey.decryptObject({jwe});
    if(!(doc && typeof doc === 'object' && typeof doc.id === 'string')) {
      throw new Error('Invalid decrypted document.');
    }
    return doc;
  }

  // helper that creates an encrypted doc using a clear doc, including
  // blinding its ID and any attributes for indexing
  async _encrypt(doc) {
    if(!(doc && typeof doc === 'object' && typeof doc.id === 'string')) {
      throw new TypeError(
        '"doc" must be an object with an "id" string property.');
    }

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

  // helper that gets the master key for use in operations such as inserting
  // docs, updating docs, etc. -- it will emit the `masterKeyRequest` event
  // if no master key is cached and use then cache the result
  async _getMasterKey() {
    // return master key from cache if available
    if(this.keyCache.masterKey) {
      this.keyCache.resetTimeout();
      return this.keyCache.masterKey;
    }

    // get master key via `MasterKeyRequest` event
    if(!this._listener) {
      const err = new Error('Master key not found.');
      err.name = 'NotFoundError';
      throw err;
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
