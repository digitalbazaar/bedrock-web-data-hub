/*!
 * Copyright (c) 2018-2019 Digital Bazaar, Inc. All rights reserved.
 */
import {DataHub} from 'bedrock-web-data-hub';
import {mock} from './mock.js';

describe('DataHub', () => {
  before(async () => {
    await mock.init();
  });
  after(async () => {
    mock.server.shutdown();
  });

  it('should create a data hub', async () => {
    const dataHub = await mock.createDataHub();
    const result = dataHub instanceof DataHub;
    result.should.equals(true);
  });

  it('should ensure two new indexes', async () => {
    const dataHub = await mock.createDataHub();
    const {indexHelper} = dataHub;
    const indexCount = indexHelper.indexes.size;
    dataHub.ensureIndex({attribute: ['index1', 'index2']});
    indexHelper.indexes.should.be.a('Set');
    indexHelper.indexes.size.should.equal(indexCount + 2);
    indexHelper.indexes.has('index1').should.equal(true);
    indexHelper.indexes.has('index2').should.equal(true);
  });

  it('should insert a document', async () => {
    const dataHub = await mock.createDataHub();
    const doc = {id: 'foo', content: {someKey: 'someValue'}};
    const encrypted = await dataHub.insert({doc});
    should.exist(encrypted);
    encrypted.should.be.an('object');
    encrypted.id.should.equal('foo');
    encrypted.sequence.should.equal(0);
    encrypted.indexed.should.be.an('array');
    encrypted.indexed.length.should.equal(1);
    encrypted.indexed[0].should.be.an('object');
    encrypted.indexed[0].sequence.should.equal(0);
    encrypted.indexed[0].hmac.should.be.an('object');
    encrypted.indexed[0].hmac.should.deep.equal({
      id: dataHub.indexHelper.hmac.id,
      algorithm: dataHub.indexHelper.hmac.algorithm
    });
    encrypted.indexed[0].attributes.should.be.an('array');
    encrypted.jwe.should.be.an('object');
    encrypted.jwe.protected.should.be.a('string');
    encrypted.jwe.recipients.should.be.an('array');
    encrypted.jwe.recipients.length.should.equal(1);
    encrypted.jwe.recipients[0].should.be.an('object');
    encrypted.jwe.recipients[0].header.should.deep.equal({
      kid: dataHub.kek.id,
      alg: dataHub.kek.algorithm
    });
    encrypted.jwe.iv.should.be.a('string');
    encrypted.jwe.ciphertext.should.be.a('string');
    encrypted.jwe.tag.should.be.a('string');
    encrypted.content.should.deep.equal({someKey: 'someValue'});
  });

  it('should get a document', async () => {
    const dataHub = await mock.createDataHub();
    const doc = {id: 'foo', content: {someKey: 'someValue'}};
    await dataHub.insert({doc});
    const expected = {id: 'foo', content: {someKey: 'someValue'}};
    const encrypted = await dataHub.get({id: expected.id});
    encrypted.should.be.an('object');
    encrypted.id.should.equal('foo');
    encrypted.sequence.should.equal(0);
    encrypted.indexed.should.be.an('array');
    encrypted.indexed.length.should.equal(1);
    encrypted.indexed[0].should.be.an('object');
    encrypted.indexed[0].sequence.should.equal(0);
    encrypted.indexed[0].hmac.should.be.an('object');
    encrypted.indexed[0].hmac.should.deep.equal({
      id: dataHub.indexHelper.hmac.id,
      algorithm: dataHub.indexHelper.hmac.algorithm
    });
    encrypted.indexed[0].attributes.should.be.an('array');
    encrypted.jwe.should.be.an('object');
    encrypted.jwe.protected.should.be.a('string');
    encrypted.jwe.recipients.should.be.an('array');
    encrypted.jwe.recipients.length.should.equal(1);
    encrypted.jwe.recipients[0].should.be.an('object');
    encrypted.jwe.recipients[0].header.should.deep.equal({
      kid: dataHub.kek.id,
      alg: dataHub.kek.algorithm
    });
    encrypted.jwe.iv.should.be.a('string');
    encrypted.jwe.ciphertext.should.be.a('string');
    encrypted.jwe.tag.should.be.a('string');
    encrypted.content.should.deep.equal(expected.content);
  });

  it('should fail to get a non-existent document', async () => {
    const dataHub = await mock.createDataHub();
    let err;
    try {
      await dataHub.get({id: 'doesNotExist'});
    } catch(e) {
      err = e;
    }
    should.exist(err);
    err.name.should.equal('NotFoundError');
  });

  it('should fail to insert a duplicate document', async () => {
    const dataHub = await mock.createDataHub();
    const doc = {id: 'foo', content: {someKey: 'someValue'}};
    await dataHub.insert({doc});

    let err;
    try {
      await dataHub.insert({doc});
    } catch(e) {
      err = e;
    }
    should.exist(err);
    err.name.should.equal('DuplicateError');
  });

  it('should upsert a document', async () => {
    const dataHub = await mock.createDataHub();
    const doc = {id: 'foo', content: {someKey: 'someValue'}};
    const encrypted = await dataHub.update({doc});
    should.exist(encrypted);
    encrypted.should.be.an('object');
    encrypted.id.should.equal('foo');
    encrypted.sequence.should.equal(0);
    encrypted.indexed.should.be.an('array');
    encrypted.indexed.length.should.equal(1);
    encrypted.indexed[0].should.be.an('object');
    encrypted.indexed[0].sequence.should.equal(0);
    encrypted.indexed[0].hmac.should.be.an('object');
    encrypted.indexed[0].hmac.should.deep.equal({
      id: dataHub.indexHelper.hmac.id,
      algorithm: dataHub.indexHelper.hmac.algorithm
    });
    encrypted.indexed[0].attributes.should.be.an('array');
    encrypted.jwe.should.be.an('object');
    encrypted.jwe.protected.should.be.a('string');
    encrypted.jwe.recipients.should.be.an('array');
    encrypted.jwe.recipients.length.should.equal(1);
    encrypted.jwe.recipients[0].should.be.an('object');
    encrypted.jwe.recipients[0].header.should.deep.equal({
      kid: dataHub.kek.id,
      alg: dataHub.kek.algorithm
    });
    encrypted.jwe.iv.should.be.a('string');
    encrypted.jwe.ciphertext.should.be.a('string');
    encrypted.jwe.tag.should.be.a('string');
    encrypted.content.should.deep.equal({someKey: 'someValue'});
  });

  it('should update an existing document', async () => {
    const dataHub = await mock.createDataHub();
    const doc = {id: 'foo', content: {someKey: 'someValue'}};
    const version1 = await dataHub.insert({doc});
    version1.content = {someKey: 'aNewValue'};
    await dataHub.update({doc: version1});
    const version2 = await dataHub.get({id: doc.id});
    should.exist(version2);
    version2.should.be.an('object');
    version2.id.should.equal('foo');
    version2.sequence.should.equal(1);
    version2.indexed.should.be.an('array');
    version2.indexed.length.should.equal(1);
    version2.indexed[0].should.be.an('object');
    version2.indexed[0].sequence.should.equal(1);
    version2.indexed[0].hmac.should.be.an('object');
    version2.indexed[0].hmac.should.deep.equal({
      id: dataHub.indexHelper.hmac.id,
      algorithm: dataHub.indexHelper.hmac.algorithm
    });
    version2.indexed[0].attributes.should.be.an('array');
    version2.jwe.should.be.an('object');
    version2.jwe.protected.should.be.a('string');
    version2.jwe.recipients.should.be.an('array');
    version2.jwe.recipients.length.should.equal(1);
    version2.jwe.recipients[0].should.be.an('object');
    version2.jwe.recipients[0].header.should.deep.equal({
      kid: dataHub.kek.id,
      alg: dataHub.kek.algorithm
    });
    version2.jwe.iv.should.be.a('string');
    version2.jwe.ciphertext.should.be.a('string');
    version2.jwe.tag.should.be.a('string');
    version2.content.should.deep.equal({someKey: 'aNewValue'});
  });

  /*it('should delete an existing document', async () => {
    const remoteStorage = await getRemoteStorage({accountId: 'test'});
    const result = await remoteStorage.delete({id: 'foo'});
    result.should.equal(true);
  });

  it('should fail to get a deleted document', async () => {
    const remoteStorage = await getRemoteStorage({accountId: 'test'});
    let err;
    try {
      await remoteStorage.get({id: 'foo'});
    } catch(e) {
      err = e;
    }
    should.exist(err);
    err.name.should.equal('NotFoundError');
  });

  it('should fail to delete a non-existent document', async () => {
    const remoteStorage = await getRemoteStorage({accountId: 'test'});
    const result = await remoteStorage.delete({id: 'foo'});
    result.should.equal(false);
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
  });*/
});
