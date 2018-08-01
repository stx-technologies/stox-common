const context = require('../context')
const uuid = require('uuid')
const {sendRpc, subscribeRpcHandler, StompitClient, createStompitClientFactory} = require('./mq')
const {requestQueueName, responseQueueName, stripSlash} = require('./utils')
const {RpcError} = require('../errors')
const {oneLine} = require('common-tags')

const setRpcTimeout = (responseQueue, reject, timeout) => {
  if (timeout > 0) {
    setTimeout(
      () =>
        reject(new RpcError(oneLine`
      RPC response from ${responseQueue} took more then ${timeout} ms,
      timing out
    `)),
      timeout
    )
  }
}

class RpcClient extends StompitClient {
  /**
   * Create a QueueRpc API Client
   * @param {*} stompitClient an instance of the `stompit`
   * @requires stompit
   * {@link http://gdaws.github.io/node-stomp/api/}
   */
  constructor(stompitClient, {id, logger = context.logger} = {}) {
    super(stompitClient, logger, 'RpcClient')
    this.subscriptions = {}
    this.subscribers = {}
    this.methodToQueueName = {}
    this.id = id || uuid()

    this.logger.debug(
      {id: this.id},
      oneLine`
      Created RPC Client,
      response queues will be tagged with the following id
    `
    )
  }

  /**
   * @private
   */
  getSubscriber(destination) {
    return (correlationId) => {
      const subscriber = (this.subscribers[destination] || {})[correlationId]
      if (subscriber) {
        delete this.subscribers[destination][correlationId]
      }
      return subscriber
    }
  }

  /**
   * @private
   */
  ensureSubscriptionToResponse(destination) {
    if (this.subscriptions[destination]) {
      return
    }

    this.logger.debug({destination}, 'started listening to responses for destination')
    this.subscriptions[destination] = subscribeRpcHandler(
      this.client,
      this.logger,
      destination,
      this.getSubscriber(destination)
    )
  }

  /**
   * @private
   */
  subscribeCaller(responseQueue, correlationId, timeout) {
    return new Promise((resolve, reject) => {
      setRpcTimeout(responseQueue, reject, timeout)
      this.logger.debug({responseQueue, correlationId}, 'saving subscriber for method call')
      this.subscribers[responseQueue] = this.subscribers[responseQueue] || {}
      this.subscribers[responseQueue][correlationId] = {resolve, reject}
    })
  }

  /**
   * Calls a method and awaits a response from the server
   * @param {String} method name of the method
   * @param {Object|*} params parameters to call the method with
   * @param {Object} options optional metadata, f.e headers and timeout
   */
  call(method, params, options = {}) {
    method = stripSlash(method)
    const responseQueue = responseQueueName(method, this.id)
    const correlationId = uuid()

    this.ensureSubscriptionToResponse(responseQueue)
    this.logger.debug({method, params, options}, 'calling method')

    const {timeout, ...rpcOptions} = options
    const responsePromise = this.subscribeCaller(responseQueue, correlationId, timeout)

    sendRpc(
      this.client,
      params,
      requestQueueName(method),
      correlationId,
      responseQueue,
      rpcOptions,
      this.logger
    )

    return responsePromise
  }

  /**
   * Peacefully disconnect the stompit connection
   */
  disconnect() {
    this.logger.info('disconnecting client')
    Object.values(this.subscriptions).forEach(s => s.unsubscribe())
    this.subscriptions = {}
    this.subscribers = {}
    this.client.disconnect()
  }
}

/**
 * Create a {@link RpcClient} with given configuration and options
 * @param {String|Object} config configuration for the STOMP client
 * Can be either a connection string, or an object of the following form:
 * const connectOptions = {url: String} or
 * const connectOptions = {
 *   host: String,
 *   port: Number,
 *   connectHeaders: {
 *     login?: String,
 *     passcode?: String,
 *  },
 * }
 * @param {[Object]} options options for the wrapper client
 * @see {@link RpcClient#constructor} for available options
 */
RpcClient.connect = createStompitClientFactory(RpcClient)

module.exports = RpcClient
