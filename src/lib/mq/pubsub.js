const {loggers: {logger: wdLogger}} = require('@welldone-software/node-toolbelt')
const {
  createStompitClientFactory,
  StompitClient,
  subscribeToQueue,
  sendFrame,
} = require('./mq')
const {RpcError} = require('../errors')


class PubsubClient extends StompitClient {
  /**
   * Create a PubsubClient
   * @param {*} stompitClient an instance of the `stompit`
   * @requires stompit
   * {@link http://gdaws.github.io/node-stomp/api/}
   */
  constructor(stompitClient, {logger = wdLogger} = {}) {
    super(stompitClient, logger, 'PubsubClient')
    this.subscriptions = {}
  }

  /**
   * Subscribe to messages from a certain queue
   * @param {*} queue queue to subscribe to
   * @param {*} handler callback to handle messages. {@link mq#subscribeToQueue}
   * Node style callback, of `(err, response)`.
   * `response` can be destructured to `{body, headers}`
   * @return subscription, on which you can call `unsubscribe`
   */
  subscribe(queue, handler) {
    if (typeof handler !== 'function') {
      const type = Object.prototype.toString.call(handler)
      throw new RpcError(`PubsubClient.subscribe() requires a callback but got a ${type}`)
    }
    this.logger.info(`subscribing to ${queue}`)
    return subscribeToQueue(this.client, queue, handler)
  }

  /**
   * Publishes a message to given queue
   * @param {String} queue queue to send the message to
   * @param {Object|String} content content of the message to send
   * @param {[Object]} additionalHeaders optional - additional headers to send as metadata
   */
  publish(queue, content, additionalHeaders = {}) {
    const headers = {...additionalHeaders, destination: queue}
    this.logger.info({content, headers}, 'publishing message')
    sendFrame(this.client, content, headers)
  }
}

/**
 * Create a {@link PubsubClient} with given configuration and options
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
 * @see {@link PubsubClient#constructor} for available options
 */
PubsubClient.connect = createStompitClientFactory(PubsubClient)

module.exports = PubsubClient
