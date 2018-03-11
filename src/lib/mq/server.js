const {loggers: {logger: wdLogger}} = require('@welldone-software/node-toolbelt')
const {RpcError} = require('../errors')
const {requestQueueName} = require('./utils')
const {respondToRpc, parseMessage, StompitClient, createStompitClientFactory} = require('./mq')

class RpcServer extends StompitClient {
  constructor(stompitClient, {logger = wdLogger} = {}) {
    super(stompitClient, logger, 'RpcServer')
    this.routers = []
    this.subscriptions = {}
  }

  use(router) {
    this.routers.push(router)
    return this
  }

  static mergeRouters(routers) {
    return routers.reduce(
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
  }

  subscribeHandler(origin, handler) {
    return this.client.subscribe({destination: origin}, (subscriptionError, message) => {
      if (subscriptionError) {
        this.logger.error(subscriptionError, 'subscription error')
        return
      }

      parseMessage(message)
        .then((body) => {
          this.logger.info({headers: message.headers, body}, 'received message')
          return body
        })
        .then(body => respondToRpc(this.client, message, handler, body))
        .then(({headers, response}) =>
          this.logger.info({headers, response, origin}, 'handled method'))
        .catch(error => this.logger.error({error, origin}, 'error handling method'))
    })
  }

  subscribeHandlers(handlers) {
    this.subscriptions = Object.entries(handlers).reduce((acc, [origin, handler]) => {
      const subscription = this.subscribeHandler(origin, handler)
      acc[origin] = subscription
      return acc
    }, {})
  }

  start() {
    const handlers = RpcServer.mergeRouters(this.routers)
    this.logger.info(Object.keys(handlers), 'Listening for the following methods')
    this.subscribeHandlers(handlers)
  }
}

RpcServer.connect = createStompitClientFactory(RpcServer)

module.exports = RpcServer
