const stompit = require('stompit')
const {loggers: {logger}} = require('@welldone-software/node-toolbelt')
const {RpcError} = require('../errors')
const {requestQueueName, toConnectionConfig} = require('./utils')
const {respondToRpc, parseMessage} = require('./mq')

const mergeRouters = routers =>
  routers.reduce(
    (allHandlers, router) =>
      Object.keys(router.methodHandlers).reduce((acc, method) => {
        const origin = requestQueueName(method)
        if (acc[origin]) {
          throw new RpcError('handler for method already defined', {method})
        }
        acc[origin] = router.methodHandlers[method]
        return acc
      }, allHandlers),
    {}
  )

const subscribeHandler = (client, origin, handler) =>
  client.subscribe({destination: origin}, (subscriptionError, message) => {
    if (subscriptionError) {
      logger.error(subscriptionError, 'subscription error')
      return
    }

    parseMessage(message)
      .then((body) => {
        logger.info({headers: message.headers, body}, 'received message')
        return body
      })
      .then(body => respondToRpc(client, message, handler, body))
      .then(({headers, response}) =>
        logger.info({headers, response, origin}, 'handled method'))
      .catch(error => logger.error({error, origin}, 'error handling method'))
  })

const subscribeHandlers = (client, handlers) =>
  Object.entries(handlers).reduce((acc, [origin, handler]) => {
    const subscription = subscribeHandler(client, origin, handler)
    acc[subscription.getId()] = subscription
    return acc
  }, {})

class RpcServer {
  constructor() {
    this.routers = []
    this.subscriptions = {}
  }

  use(router) {
    this.routers.push(router)
  }

  start(configOrConnectionString) {
    const config = toConnectionConfig(configOrConnectionString)

    return new Promise((resolve, reject) => {
      stompit.connect(config, (connectionError, client) => {
        if (connectionError) {
          reject(new RpcError(
            'failed to connect to ActiveMQ',
            {config, connectionError}
          ))
          return
        }

        const handlers = mergeRouters(this.routers)
        logger.info(
          Object.keys(handlers),
          'Listening for the following methods'
        )
        this.subscriptions = subscribeHandlers(client, handlers)
        resolve(config)
      })
    })
  }
}

module.exports = RpcServer
