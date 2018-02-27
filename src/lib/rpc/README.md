# RPC

this part of the library is responsible for handling RPC in MQs.

`index.js` exports a method called `createRpcConnection`.

## Initialization:

```javascript
const {createRpcConnection} = require('stox-common')

const {rpc, clientPromise} = createRpcConnection(<options>)
```

where `<options>` can be either a string, or an object of the following structure:

```typescript
const connectOptions: String = 'connection string'
// or
const connectOptions = {url: String}
// or
const connectOptions = {
  host: String,
  port: Number,
  connectHeaders: {
    login?: String,
    passcode?: String,
 },
}
```

* **rpc** - method for making an RPC, basically like axios methods
* **clientPromise** - if access to the underlying client(`RpcClient`) is needed, this promise returns the client

# Creating an API module

```javascript

// ------------------- bc-wallet.js -------------------

const {createRpcConnection} = require('stox-common')
const {rpc} = createRpcConnection('localhost:61613')

// template:

const apiMethod =
  (param1, ..., paramN, header1, ..., headerN) =>
    rpc('/method/name', {param1, ..., paramN}, {header1, ... headerN})

// examples:

const createWallet = ethWalletAddress => rpc('/wallets/create', {ethWalletAddress}) // RPC returns new wallet address

// ------------------- router.js -------------------

const {createWallet} = require('app/api')

router.put(
  '/wallets',
  _(({body: ethWalletAddress}) => createWallet(ethWalletAddress)))

// ------------------- some-other-module.js -------------------

const {createWallet} = require('app/api')

const somethingNeedsMeToCreateAWallet = async (ethWalletAddress) => {
  try {
    const walletAddress = await createWallet(ethWalletAddress)
    logger.info({ethWalletAddress, walletAddress}, 'successfully created a wallet')
    return walletAddress
  } catch (e) {
    logger.error({e}, 'failed to create a wallet')
  }
}

```