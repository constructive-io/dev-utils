# @interweb/node-api-client

<p align="center">
  <img src="https://raw.githubusercontent.com/constructive-io/dev-utils/refs/heads/main/docs/img/logo.svg" width="80"><br />
    Node.js API Client
  <br />
  <a href="https://github.com/constructive-io/dev-utils/actions/workflows/ci.yml">
    <img height="20" src="https://github.com/constructive-io/dev-utils/actions/workflows/ci.yml/badge.svg" />
  </a>
  <a href="https://github.com/constructive-io/dev-utils/blob/main/LICENSE">
    <img height="20" src="https://img.shields.io/badge/license-MIT-blue.svg"/>
  </a>
</p>

`@interweb/node-api-client` is a lightweight and flexible HTTP client for interacting with RESTful APIs in Node.js. It supports common HTTP methods such as GET, POST, PUT, PATCH, and DELETE, with customizable options for headers, query parameters, and timeouts.

## install

```sh
npm install @interweb/node-api-client
```

## Usage

Here's an example of how to use `@interweb/node-api-client`:

```js
import { APIClient, APIClientOptions } from '@interweb/node-api-client';

const options: APIClientOptions = {
  restEndpoint: 'http://localhost:8001/api'
};

const client = new APIClient(options);

// GET request
client.get('/endpoint')
  .then(response => console.log(response))
  .catch(error => console.error(error));

// GET request with query params
client.get('/endpoint', { search: 'value' })
  .then(response => console.log(response))
  .catch(error => console.error(error));

// POST request with JSON body
client.post('/endpoint', null, { key: 'value' })
  .then(response => console.log(response))
  .catch(error => console.error(error));
```