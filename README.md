# Web Based Bedrock Data Hub Client _(bedrock-web-data-hub)_

> A Javascript library for Bedrock web apps, for interfacing with a remote Data Hub server

## Table of Contents

- [Background](#background)
- [Install](#install)
- [Usage](#usage)
- [API](#api)
- [Contribute](#contribute)
- [Commercial Support](#commercial-support)
- [License](#license)

## Background

This library is a client that Bedrock web apps can use to interface with
remote Data Hub servers (for example, it's used by the 
[Bedrock VC Store](https://github.com/digitalbazaar/bedrock-web-vc-store) lib).

It consists of two main classes:

1. `DataHubService` - stores and manages `DataHub` configs with a remote 
  [Data Hub storage server](https://github.com/digitalbazaar/bedrock-data-hub-storage).
  Used to create or fetch `DataHub` instances.
2. `DataHub` - provides a CRUD (+ find) interface to a specific Data Hub. Also
  ensures appropriate db indexes are set up, and provides some key management
  under the hood.

## Install

To install locally (for development):

```
git clone https://github.com/digitalbazaar/bedrock-web-data-hub.git
cd bedrock-web-data-hub
npm install
```

(Optional) Also install test dependencies:

```
cd test
npm install
cd ..
```

## Usage

### Creating and registering a DataHub config

First, create a `DataHubService` instance:

```js
import {AccountMasterKey, KmsService} from 'bedrock-web-kms';
import {DataHub, DataHubService} from 'bedrock-web-data-hub';

// Create a `DataHubService` instance (which can be used to create DataHub instances)
const dhs = new DataHubService();
```

Although you can use Data Hubs while doing your own key management, we
recommend that you set up a Key Management Service
([`bedrock-web-kms`](https://github.com/digitalbazaar/bedrock-web-kms)) instance
first.

Optional:

```js
// Create a Master Key (via a key management service)
const kmsService = new KmsService();
// TODO: Explain kmsPlugin and accountId
const masterKey = await AccountMasterKey.fromSecret({secret, accountId, kmsService, kmsPlugin});

// Use the Master Key to create KEK and HMAC keys
const kek = await masterKey.generateKey({type: 'kek'}); // Key Encryption Key
const hmac = await masterKey.generateKey({type: 'hmac'});

```

Now you can create and register a new `DataHub` configuration:

```js
const controller = 'account id goes here';

const primary = true; // TODO: Explain what a primary data hub is

const config = {
  sequence: 0,  // TODO: is sequence required?
  controller,
  primary,
  kek: {id: kek.id, algorithm: kek.algorithm},
  hmac: {id: hmac.id, algorithm: hmac.algorithm}
};

const remoteConfig = await dhs.create({config}); // sends a POST request to the remote service
const hub = new DataHub({config: remoteConfig, kek, hmac});
```

### Loading a saved DataHub config

If you have previously registered a DataHub config (via `create()`), and you
know its `id`, you can fetch its config via `get()`:

```js
// previously registered config
const {id} = await dhs.create({config});

// later, it can be fetched via the id
const remoteConfig = await dhs.get({id});
const hub = new DataHub({config: remoteConfig, kek, hmac});
```

If you know a controller/`accountId` but do not know a specific hub `id`, you can
request "primary registered data hub for a given account":

```js
const remoteConfig = await dhs.getPrimary({controller: accountId});
const hub = new DataHub({config: remoteConfig, kek, hmac});
```

### Using a DataHub instance for document storage

See the API section below.

## API

### `DataHub`

#### `constructor`

#### `insert`

#### `get`

#### `update`

#### `delete`

#### `find`

#### `ensureIndex`

#### `updateIndex`

## Contribute

See [the contribute file](https://github.com/digitalbazaar/bedrock/blob/master/CONTRIBUTING.md)!

PRs accepted.

If editing the Readme, please conform to the
[standard-readme](https://github.com/RichardLitt/standard-readme) specification.

## Commercial Support

Commercial support for this library is available upon request from
Digital Bazaar: support@digitalbazaar.com

## License

[Bedrock Non-Commercial License v1.0](LICENSE.md) © Digital Bazaar
