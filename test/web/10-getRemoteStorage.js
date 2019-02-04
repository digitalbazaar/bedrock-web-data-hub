/*!
 * Copyright (c) 2018 Digital Bazaar, Inc. All rights reserved.
 */
import {store, MemoryEngine} from 'bedrock-web-store';
import {getRemoteStorage} from 'bedrock-web-data-hub';
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

  it('should get RemoteStorage for accountId `static`', async () => {
    const remoteStorage = await getRemoteStorage({accountId: 'static'});
    remoteStorage.getMasterKey.should.be.a('function');
  });
});
