/*!
 * Copyright (c) 2018-2019 Digital Bazaar, Inc. All rights reserved.
 */
import {DataHubService} from 'bedrock-web-data-hub';
import {mock} from './mock.js';

describe('DataHubService', () => {
  before(async () => {
    await mock.init();
  });
  after(async () => {
    mock.server.shutdown();
  });

  it('should create data hub storage', async () => {
    const dhs = new DataHubService();
    const {kek, hmac} = mock.keys;
    const config = await dhs.create({
      config: {
        kek: {id: kek.id, algorithm: kek.algorithm},
        hmac: {id: hmac.id, algorithm: hmac.algorithm}
      }
    });
    config.should.be.an('object');
    config.id.should.be.a('string');
    config.kek.should.be.an('object');
    config.hmac.should.be.an('object');
  });

  // TODO: add more tests: get, getPrimary, getAll, update, setStatus
});
