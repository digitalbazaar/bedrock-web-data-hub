/*!
 * Copyright (c) 2018 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

import {store} from 'bedrock-web-store';
import {RemoteStorage} from './RemoteStorage.js';

/**
 * Gets an API to access the remote storage for an account.
 *
 * @param accountId the ID of the account.
 *
 * @return a Promise that resolves to a `RemoteStorage` instance.
 */
export const getRemoteStorage = async ({accountId}) => {
  if(!(accountId && typeof accountId === 'string')) {
    throw new TypeError('"accountId" must be a non-empty string.');
  }
  const id = `remoteStore.${accountId}`;
  try {
    const remoteStorage = new RemoteStorage({accountId});
    await store.create({id, object: remoteStorage});
    return remoteStorage;
  } catch(e) {
    if(e.name === 'DuplicateError') {
      return store.get({id});
    }
    throw e;
  }
};
