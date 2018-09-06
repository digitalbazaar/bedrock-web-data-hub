/*!
 * Copyright (c) 2018 Digital Bazaar, Inc. All rights reserved.
 */
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

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
  const mock = new MockAdapter(axios);

  const storages = {};

  storages.test = new MockStorage({accountId: 'test', mock});

  storages.static = new MockStorage({accountId: 'static', mock});
  storages.static.masterKey = staticMasterKey;
  storages.static.store(staticDoc);
};

class MockStorage {
  constructor({accountId, mock}) {
    this.accountId = accountId;
    this.masterKey = null;
    this.documents = new Map();
    this.indexes = {
      equals: new Map(),
      has: new Map()
    };

    const root = `/private-storage/${accountId}`;
    const routes = {
      documents: `${root}/documents`,
      masterKey: `${root}/master-key`,
      query: `${root}/query`
    };

    mock.onPut(routes.masterKey).reply(config => {
      // TODO: check headers for `If-None-Match: *`
      // TODO: support replacing master key?
      if(this.masterKey) {
        return [304];
      }
      this.masterKey = JSON.parse(config.data);
      return [200];
    });

    mock.onGet(routes.masterKey).reply(() => {
      if(!this.masterKey) {
        return [404];
      }
      return [200, JSON.stringify(this.masterKey)];
    });

    mock.onPost(routes.documents).reply(config => {
      const encryptedDoc = JSON.parse(config.data);
      if(this.documents.has(encryptedDoc.id)) {
        return [409];
      }
      this.store(encryptedDoc);
      const location =
        `http://localhost:9876/${routes.documents}/${encryptedDoc.id}`;
      return [201, undefined, {location}];
    });

    const docIdRoute = new RegExp(
      `/private-storage/${accountId}/documents/([-_A-Za-z0-9]+)`);

    mock.onPost(docIdRoute).reply(config => {
      const encryptedDoc = JSON.parse(config.data);
      const [, id] = config.url.match(docIdRoute);
      if(id !== encryptedDoc.id) {
        return [400];
      }
      this.store(encryptedDoc);
      return [200];
    });

    mock.onGet(docIdRoute).reply(config => {
      const [, id] = config.url.match(docIdRoute);
      if(!this.documents.has(id)) {
        return [404];
      }
      return [200, JSON.stringify(this.documents.get(id))];
    });

    mock.onPost(routes.query).reply(config => {
      const query = JSON.parse(config.data);
      const results = [];
      if(query.equals) {
        for(const equals of query.equals) {
          let matches = null;
          for(const key in equals) {
            const value = equals[key];
            const docs = this.find(
              {index: this.indexes.equals, key: key + '=' + value});
            if(!matches) {
              // first result
              matches = docs;
            } else {
              // remove any docs from `matches` that are not in `docs`
              matches = matches.filter(x => docs.includes(x));
              if(matches.length === 0) {
                break;
              }
            }
          }
          (matches || []).forEach(x => {
            if(!results.includes(x)) {
              results.push(x);
            }
          });
        }
      }

      if(query.has) {
        let matches = null;
        for(const key of query.has) {
          const docs = this.find({index: this.indexes.has, key});
          if(!matches) {
            // first result
            matches = docs;
          } else {
            // remove any docs from `matches` that are not in `docs`
            matches = matches.filter(x => docs.includes(x));
            if(matches.length === 0) {
              break;
            }
          }
        }
        results.push(...(matches || []));
      }

      return [200, results];
    });
  }

  store(encryptedDoc) {
    this.documents.set(encryptedDoc.id, encryptedDoc);
    for(const attribute of encryptedDoc.attributes) {
      this.addToIndex({
        index: this.indexes.equals,
        key: attribute.name + '=' + attribute.value,
        encryptedDoc
      });
      this.addToIndex({
        index: this.indexes.has,
        key: attribute.name,
        encryptedDoc
      });
    }
  }

  addToIndex({index, key, encryptedDoc}) {
    let docSet = index.get(key);
    if(!docSet) {
      docSet = new Set();
      index.set(key, docSet);
    }
    docSet.add(encryptedDoc);
  }

  find({index, key}) {
    let docSet = index.get(key);
    if(!docSet) {
      return [];
    }
    return [...docSet];
  }
}
