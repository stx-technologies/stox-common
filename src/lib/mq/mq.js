const serviceContext = require('../context')
const {RpcError} = require('../errors')
const stompit = require('stompit')
const {toStompHeaders, fromStompHeaders, toConnectionConfig} = require('./utils')
const {promisify} = require('util')
const context = require('../context')

const asyncTimeout = promisify(setTimeout)

const parseMessage = message =>
  new Promise((resolve, reject) =>
    message.readString('utf-8', (messageParseError, body) => {
      if (messageParseError) {
        reject(messageParseError)
        return
      }
      resolve(JSON.parse(body))
    }))

const sendFrame = (client, message, headers) => {
  const stompHeaders = toStompHeaders(headers)
  const frame = client.send(stompHeaders)
  frame.write(JSON.stringify(message))
  frame.end()
}

/**
 * Subscribes a specific queue
 * @param {StopmitClient} client stompit client
 * @param {String} destination queue to subscribe to
 * @param {Function(error: *, ({headers: Object, body: Object|String})): void} handler
 * node style callback, parameters are `(err, response)`.
 * `response` consists of `body` and `headers`
 * @return subscription object, which you can call `unsubscribe` on
 */
const subscribeToQueue = (client, destination, handler) =>
  client.subscribe({destination}, async (subscriptionError, message) => {
    try {
      if (subscriptionError) {
        throw new RpcError('subscription error', subscriptionError)
      }

      const headers = fromStompHeaders(message.headers)
      headers.ok = headers.ok !== 'false'
      await new Promise((resolve, reject) => {
        // eslint-disable-next-line consistent-return
        message.readString('utf-8', async (messageError, responseContent) => {
          try {
            if (messageError) {
              throw new RpcError('message parse error', messageError)
            }

            const body = JSON.parse(responseContent)
            const response = {headers, body}
            resolve(await handler(response))
          } catch (e) {
            reject(e)
          }
        })
      })
    } catch (error) {
      serviceContext.logger.error(error, `Error in queue handler: ${destination}`)
    }
  })

const subscribeRpcHandler = (client, rpcLogger, destination, getSubscriber) =>
  client.subscribe({destination}, (subscriptionError, message) => {
    if (subscriptionError) {
      throw new RpcError('subscription error', subscriptionError)
    }

    const headers = fromStompHeaders(message.headers)
    const subscriber = getSubscriber(headers.correlationId)

    if (!subscriber) {
      rpcLogger.error(
        {destination, correlationId: headers.correlationId},
        'no subscriber for message'
      )
      return
    }

    message.readString('utf-8', (messageError, responseContent) => {
      if (messageError) {
        subscriber.reject(new RpcError('message parse error', messageError))
      }

      const body = JSON.parse(responseContent)
      const response = {headers, body}
      if (headers.ok === 'false') {
        subscriber.reject(response)
      } else {
        subscriber.resolve(response)
      }
    })
  })

/**
 * Sends a message and awaits a response
 * @param {*} client stompit client instance
 * @param {(Object|String)} content message to send
 * @param {String} destinationQueue queue to which the message will be sent to
 * @param {String} correlationId unique identifier to distinguish between
 *  different calls to the same method
 * @param {String} responseQueue queue to which the response to the message
 *  will be sent
 * @param {{headers: Object}} [options] options to customize the request
 *  headers:
 *    custom headers to send with the request.
 *    headers will always contain the `` header,
 *    which is `aplication-json` by default
 * @param logger logger to use for logging(will always use debug level)
 * @returns {Promise<{headers: Object, body: *}>} the response received,
 * comprised of the headers and the body
 */
const sendRpc = (
  client,
  content,
  destinationQueue,
  correlationId,
  responseQueue,
  {headers = {}} = {},
  rpcLogger
) => {
  const sendHeaders = {
    ...headers,
    destination: destinationQueue,
    replyTo: responseQueue,
    correlationId,
  }

  rpcLogger.debug({sendHeaders, content}, 'sending frame')
  sendFrame(client, content, sendHeaders)
}

const toResponseHeaders = (requestHeaders) => {
  const {replyTo: destination, ...rest} = fromStompHeaders(requestHeaders)
  if (!destination) {
    return [['replay-to'], rest]
  }
  return [false, {...rest, destination}]
}

/**
 * Responds to a RPC made via `sendRpc`
 * @param {*} client stompit client instance
 * @param {stream.Readable} message message from queue
 * @returns {Promise<{headers: Object, body: *}>} the response sent,
 *  comprised of the headers and the body
 */
const respondToRpc = (client, message, handler, body) =>
  new Promise((resolve, reject) => {
    const [missingHeaders, headers] = toResponseHeaders(message.headers)
    if (missingHeaders) {
      reject(new RpcError('Rpc request is missing required headers', {
        missingHeaders,
        headers,
        body,
      }))
      return
    }
    Promise.resolve()
      .then(() => handler({body, headers}))
      .then((response) => {
        response = response || 'success'
        const successHeaders = {...headers, ok: true}
        sendFrame(client, response, successHeaders)
        resolve({headers: successHeaders, response})
      })
      .catch((handlerError) => {
        const {message: errorMessage, context: errorContext} = handlerError
        const failureHeaders = {...headers, ok: false}
        sendFrame(client, {message: errorMessage, context: errorContext}, failureHeaders)
        reject(handlerError)
      })
  })

class StompitClient {
  constructor(stompitClient, rpcLogger, subLoggerName) {
    this.client = stompitClient
    const {serviceName} = serviceContext
    this.logger = rpcLogger.child({name: `${serviceName ? `${serviceName}/` : ''}${subLoggerName}`})
    this.logger.debug(`intialized stopmit client: ${subLoggerName}`)
  }

  on(type, listener) {
    this.logger.debug(`listening to "${type}" event on stompit client`)
    this.client.on(type, listener)
    return this
  }
}

const connectToStompit = async (configOrConnectionString) => {
  const config = toConnectionConfig(configOrConnectionString)
  const maxRetries = 20
  let retryCount = 0

  const {logger} = context

  while (retryCount < maxRetries) {
    try {
      const connection = await new Promise((resolve, reject) =>
        stompit.connect(config, (error, stompitClient) => {
          if (error) {
            reject(new RpcError('failed to connect to ActiveMQ', {config, error}))
            return
          }
          resolve(stompitClient)
        }))

      return connection
    } catch (error) {
      logger.error(error)
      logger.info('retrying...')
      await asyncTimeout(3000)
      retryCount++
    }
  }

  throw new RpcError('Could not connect to ActiveMQ', {config})
}

const createStompitClientFactory = ClientType => (configOrConnectionString, options) =>
  connectToStompit(configOrConnectionString).then(client => new ClientType(client, options))

module.exports = {
  StompitClient,
  createStompitClientFactory,
  connectToStompit,
  subscribeRpcHandler,
  subscribeToQueue,
  parseMessage,
  sendFrame,
  sendRpc,
  respondToRpc,
}
