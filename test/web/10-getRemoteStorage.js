/*!
 * Copyright (c) 2018 Digital Bazaar, Inc. All rights reserved.
 */
import {store, MemoryEngine} from 'bedrock-web-store';
import {getRemoteStorage} from 'bedrock-web-private-remote-storage';
import {mock} from './mock.js';

const password = 'password';

describe('getRemoteStorage', () => {
  before(() => {
    store.setEngine({engine: new MemoryEngine()});
    mock.init();
  });

  it('should get RemoteStorage for accountId `test`', async () => {
    const remoteStorage = await getRemoteStorage({accountId: 'test'});
    remoteStorage.getMasterKey.should.be.a('function');
  });

  it('should create a master key', async () => {
    const remoteStorage = await getRemoteStorage({accountId: 'test'});
    const result = await remoteStorage.createMasterKey({password});
    result.should.equals(true);
    remoteStorage.keyCache.masterKey.kek.should.be.instanceof(CryptoKey);
    remoteStorage.keyCache.masterKey.hmac.should.be.instanceof(CryptoKey);
  });

  it('should fail to create another master key', async () => {
    const remoteStorage = await getRemoteStorage({accountId: 'test'});
    let err;
    try {
      await remoteStorage.createMasterKey({password});
    } catch(e) {
      err = e;
    }
    should.exist(err);
    err.name.should.equal('DuplicateError');
  });

  it('should insert a document', async () => {
    const remoteStorage = await getRemoteStorage({accountId: 'test'});
    const doc = {id: 'foo', someKey: 'someValue'};
    await remoteStorage.insert({doc});
  });

  it('should get a document', async () => {
    const remoteStorage = await getRemoteStorage({accountId: 'test'});
    const expected = {id: 'foo', someKey: 'someValue'};
    const doc = await remoteStorage.get({id: expected.id});
    doc.should.deep.equal(expected);
  });

  it('should fail to get a non-existant document', async () => {
    const remoteStorage = await getRemoteStorage({accountId: 'test'});
    let err;
    try {
      await remoteStorage.get({id: 'doesNotExist'});
    } catch(e) {
      err = e;
    }
    should.exist(err);
    err.name.should.equal('NotFoundError');
  });

  it('should fail to insert a duplicate document', async () => {
    const remoteStorage = await getRemoteStorage({accountId: 'test'});
    const doc = {id: 'foo', someKey: 'someOtherValue'};
    let err;
    try {
      await remoteStorage.insert({doc});
    } catch(e) {
      err = e;
    }
    should.exist(err);
    err.name.should.equal('DuplicateError');
  });

  it('should update an existing document', async () => {
    const remoteStorage = await getRemoteStorage({accountId: 'test'});
    const doc = {id: 'foo', someKey: 'someNewValue'};
    await remoteStorage.update({doc});
    const updated = await remoteStorage.get({id: doc.id});
    updated.should.deep.equal(doc);
  });

  it('should insert a document with attributes', async () => {
    const remoteStorage = await getRemoteStorage({accountId: 'test'});
    remoteStorage.ensureIndex({attribute: 'indexedKey'});
    const doc = {id: 'hasAttributes1', indexedKey: 'value1'};
    await remoteStorage.insert({doc});
  });

  it('should find a document that has an attribute', async () => {
    const remoteStorage = await getRemoteStorage({accountId: 'test'});
    const expected = {id: 'hasAttributes1', indexedKey: 'value1'};
    const docs = await remoteStorage.find({has: 'indexedKey'});
    docs.should.be.an('array');
    docs.length.should.equal(1);
    docs[0].should.deep.equal(expected);
  });

  it('should insert another document with attributes', async () => {
    const remoteStorage = await getRemoteStorage({accountId: 'test'});
    const doc = {id: 'hasAttributes2', indexedKey: 'value2'};
    await remoteStorage.insert({doc});
  });

  it('should find two documents with an attribute', async () => {
    const remoteStorage = await getRemoteStorage({accountId: 'test'});
    const expected = [
      {id: 'hasAttributes1', indexedKey: 'value1'},
      {id: 'hasAttributes2', indexedKey: 'value2'}
    ];
    const docs = await remoteStorage.find({has: 'indexedKey'});
    docs.should.be.an('array');
    docs.length.should.equal(2);
    docs.should.deep.include(expected[0]);
    docs.should.deep.include(expected[1]);
  });

  it('should find a document that has an attribute value', async () => {
    const remoteStorage = await getRemoteStorage({accountId: 'test'});
    const expected = {id: 'hasAttributes1', indexedKey: 'value1'};
    const docs = await remoteStorage.find({equals: {indexedKey: 'value1'}});
    docs.should.be.an('array');
    docs.length.should.equal(1);
    docs[0].should.deep.equal(expected);
  });

  it('should find two documents with attribute values', async () => {
    const remoteStorage = await getRemoteStorage({accountId: 'test'});
    const expected = [
      {id: 'hasAttributes1', indexedKey: 'value1'},
      {id: 'hasAttributes2', indexedKey: 'value2'}
    ];
    const docs = await remoteStorage.find({
      equals: [{indexedKey: 'value1'}, {indexedKey: 'value2'}]});
    docs.should.be.an('array');
    docs.length.should.equal(2);
    docs.should.deep.include(expected[0]);
    docs.should.deep.include(expected[1]);
  });

  it('should get RemoteStorage for accountId `static`', async () => {
    const remoteStorage = await getRemoteStorage({accountId: 'static'});
    remoteStorage.getMasterKey.should.be.a('function');
  });

  it('should fail to create another master key for `static`', async () => {
    const remoteStorage = await getRemoteStorage({accountId: 'static'});
    let err;
    try {
      await remoteStorage.createMasterKey({password});
    } catch(e) {
      err = e;
    }
    should.exist(err);
    err.name.should.equal('DuplicateError');
  });

  it('should get RemoteStorage for accountId `static`', async () => {
    const remoteStorage = await getRemoteStorage({accountId: 'static'});
    remoteStorage.getMasterKey.should.be.a('function');
  });

  it('should fail to get a document without a master key', async () => {
    const remoteStorage = await getRemoteStorage({accountId: 'static'});
    const expected = {id: 'foo', someKey: 'someValue'};
    let err;
    try {
      await remoteStorage.get({id: expected.id});
    } catch(e) {
      err = e;
    }
    should.exist(err);
    err.message.should.equal('Master key not found.');
  });

  it('should fail to insert a document with no master key', async () => {
    const remoteStorage = await getRemoteStorage({accountId: 'static'});
    const doc = {id: 'bar', someKey: 'someValue'};
    let err;
    try {
      await remoteStorage.insert({doc});
    } catch(e) {
      err = e;
    }
    should.exist(err);
    err.message.should.equal('Master key not found.');
  });

  it('should insert a document after unwrapping master key', async () => {
    const remoteStorage = await getRemoteStorage({accountId: 'static'});
    const doc = {id: 'bar', someKey: 'someValue'};
    remoteStorage.on('masterKeyRequest', event => {
      event.respondWith((async () => {
        const masterKey = await remoteStorage.getMasterKey({password});
        return {masterKey};
      })());
    });
    await remoteStorage.insert({doc});
  });

  it('should get an inserted document', async () => {
    const remoteStorage = await getRemoteStorage({accountId: 'static'});
    const expected = {id: 'bar', someKey: 'someValue'};
    const doc = await remoteStorage.get({id: expected.id});
    doc.should.deep.equal(expected);
  });

  it('should get a static document', async () => {
    const remoteStorage = await getRemoteStorage({accountId: 'static'});
    const expected = {id: 'foo', someKey: 'someValue'};
    const doc = await remoteStorage.get({id: expected.id});
    doc.should.deep.equal(expected);
  });
});
