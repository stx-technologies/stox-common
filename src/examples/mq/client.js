const {loggers: {logger}} = require('@welldone-software/node-toolbelt')
const {createMqConnections} = require('../../')

logger.level = 'debug'

const {rpc, subscribe, publish, mqConnections} = createMqConnections('localhost:61613')

mqConnections.then(() => logger.info('connected'))

rpc('/add', {number: 1})
  .then(response => logger.info(response, 'SUCCESS'))
  .catch(error => logger.error(error, 'RPC ERRORED'))

const subscription = subscribe('request/add', (error, message) => {
  if (error) {
    logger.error({error}, 'subscribe handler error')
    return
  }

  logger.info({message}, 'received message in subscription')
})

subscribe('request/add', (error, message) => {
  if (error) {
    logger.error({error}, 'subscribe handler error')
    return
  }

  logger.info({message}, 'dummy subscriber')
})

setTimeout(() => publish('request/add', {number: 999}), 10000)

setTimeout(() => subscription.unsubscribe(), 20000)
