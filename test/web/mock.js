/*!
 * Copyright (c) 2018 Digital Bazaar, Inc. All rights reserved.
 */
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import {MockStorage} from 'bedrock-web-mock-private-remote-storage';

export const mock = {};

const staticMasterKey = {
  unprotected: {
    alg: 'PBES2-HS512+A256KW',
    p2c: 4096,
    p2s: 'd7l6Ub5T0eZlpWjhSGI3Q19DtcogEkHg1hN8JzORj4U'
  },
  encrypted_key:
    'HrLOox-iCFlwCsQIWAWJ7UCuzjt2jdzOv92rEFNYymNX0XiIE_k8U-' +
    'z_Y3kCc_xqQ_wob904Q3XJxwzsO6xla7plr54MVh0N'
};

const staticDoc = {
  id: 'lcm5RDZGuDmxlFZSc0k468LcfiY0viSxm7UIBFPKKVk',
  attributes: [],
  jwe: {
    unprotected: {
      alg: 'A256KW',
      enc: 'A256GCM'
    },
    encrypted_key: 'BZHh3ExmG56fJtGbb3L_tfJe9WNQHaDK1XmmO807pjoFuuDktdqfUQ',
    iv: 'PcpoGFRyHYBuPIu1',
    ciphertext: 'RR1VJiV16uxzjbyaprspvAuuso2J2AnB8GgbQvu07D56IA',
    tag: 'SHj-mrvbuLWLLTWW8EQ_8w'
  }
};

mock.init = () => {
  const mockAdapter = new MockAdapter(axios);

  const storages = {};

  storages.test = new MockStorage({accountId: 'test', mockAdapter});

  storages.static = new MockStorage({accountId: 'static', mockAdapter});
  storages.static.masterKey = staticMasterKey;
  storages.static.store(staticDoc);
};
