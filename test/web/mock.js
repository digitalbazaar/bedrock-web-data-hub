/*!
 * Copyright (c) 2018-2019 Digital Bazaar, Inc. All rights reserved.
 */
import Pretender from 'pretender';
import {DataHub, DataHubService} from 'bedrock-web-data-hub';
import {MockStorage} from 'bedrock-web-mock-data-hub-storage';
import {MockKmsService} from 'bedrock-web-mock-kms-http';
import {AccountMasterKey, KmsService} from 'bedrock-web-kms';

export const mock = {};

// const staticMasterKey = {
//   unprotected: {
//     alg: 'PBES2-HS512+A256KW',
//     p2c: 4096,
//     p2s: 'd7l6Ub5T0eZlpWjhSGI3Q19DtcogEkHg1hN8JzORj4U'
//   },
//   encrypted_key:
//     'HrLOox-iCFlwCsQIWAWJ7UCuzjt2jdzOv92rEFNYymNX0XiIE_k8U-' +
//     'z_Y3kCc_xqQ_wob904Q3XJxwzsO6xla7plr54MVh0N'
// };

// const staticDoc = {
//   id: 'lcm5RDZGuDmxlFZSc0k468LcfiY0viSxm7UIBFPKKVk',
//   attributes: [],
//   jwe: {
//     unprotected: {
//       alg: 'A256KW',
//       enc: 'A256GCM'
//     },
//     encrypted_key: 'BZHh3ExmG56fJtGbb3L_tfJe9WNQHaDK1XmmO807pjoFuuDktdqfUQ',
//     iv: 'PcpoGFRyHYBuPIu1',
//     ciphertext: 'RR1VJiV16uxzjbyaprspvAuuso2J2AnB8GgbQvu07D56IA',
//     tag: 'SHj-mrvbuLWLLTWW8EQ_8w'
//   }
// };

mock.init = async () => {
  // create mock server
  const server = mock.server = new Pretender();
  // FIXME: there is special behavior here that the Mock* classes rely on;
  // we need to clean that up
  server.prepareHeaders = function(headers) {
    if(headers) {
      if(headers.json) {
        headers['content-type'] = 'application/json';
        delete headers.json;
      }
    } else {
      headers = {};
    }
    return headers;
  };
  server.prepareBody = function(body, headers) {
    if(headers && headers['content-type'] === 'application/json') {
      return (body && typeof body !== 'string') ?
        JSON.stringify(body) : '{"message": "mock server error"}';
    }
    return body;
  };

  // mock backend for KMS
  mock.kms = new MockKmsService({server});

  // mock data hub storage
  mock.dataHubStorage = new MockStorage({server});

  // only init keys once
  if(!mock.keys) {
    // create mock keys
    mock.keys = {};

    // account master key for using KMS
    const accountId = 'test';
    const secret = 'bcrypt of password';
    const kmsService = new KmsService();
    mock.keys.master = await AccountMasterKey.fromSecret(
      {secret, accountId, kmsService, kmsPlugin: 'mock'});

    // create KEK and HMAC keys for creating data hubs
    mock.keys.kek = await mock.keys.master.generateKey({type: 'kek'});
    mock.keys.hmac = await mock.keys.master.generateKey({type: 'hmac'});
  }
};

mock.createDataHub = async () => {
  const dhs = new DataHubService();
  const {kek, hmac} = mock.keys;
  const config = await dhs.create({
    config: {
      kek: {id: kek.id, algorithm: kek.algorithm},
      hmac: {id: hmac.id, algorithm: hmac.algorithm}
    }
  });
  return new DataHub({config, kek, hmac});
};
