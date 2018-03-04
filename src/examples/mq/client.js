const {loggers: {logger}} = require('@welldone-software/node-toolbelt')
const {mq, createMqConnections} = require('../../lib/mq')

logger.level = 'debug'

createMqConnections('localhost:61613')

mq.mqConnections.then(() => logger.info('connected'))

mq.rpc('/add', {number: 1})
  .then(response => logger.info(response, 'SUCCESS'))
  .catch(error => logger.error(error, 'RPC ERRORED'))

const subscription = mq.subscribe('request/add', (error, message) => {
  if (error) {
    logger.error({error}, 'subscribe handler error')
    return
  }

  logger.info({message}, 'received message in subscription')
})

mq.subscribe('request/add', (error, message) => {
  if (error) {
    logger.error({error}, 'subscribe handler error')
    return
  }

  logger.info({message}, 'dummy subscriber')
})

setTimeout(() => mq.publish('request/add', {number: 999}), 10000)

setTimeout(() => subscription.unsubscribe(), 20000)
