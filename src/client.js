const {loggers: {logger}} = require('@welldone-software/node-toolbelt')
const {createRpcConnection} = require('.')

const {rpc, clientPromise} = createRpcConnection('localhost:61613')

logger.level = 'debug'

clientPromise.then(() => logger.info('connected'))

rpc('/add', {number: 1})
  .then(response => logger.info(response, 'SUCCESS'))
  .catch(error => logger.error(error, 'RPC ERRORED'))
