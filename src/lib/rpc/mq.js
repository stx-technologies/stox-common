const {RpcError} = require('../errors')
const {
  toStompHeaders,
  fromStompHeaders,
} = require('./utils')

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
  client.subscribe({destination}, (subscriptionError, message) => {
    if (subscriptionError) {
      handler(new RpcError('subscription error', subscriptionError))
      return
    }

    const headers = fromStompHeaders(message.headers)
    headers.ok = headers.ok !== 'false'
    message.readString('utf-8', (messageError, responseContent) => {
      if (messageError) {
        handler(new RpcError('message parse error', messageError))
        return
      }

      const body = JSON.parse(responseContent)
      const response = {headers, body}
      handler(null, response)
    })
  })

const subscribeRpcHandler = (client, logger, destination, getSubscriber) =>
  client.subscribe({destination}, (subscriptionError, message) => {
    if (subscriptionError) {
      throw new RpcError('subscription error', subscriptionError)
    }

    const headers = fromStompHeaders(message.headers)
    const subscriber = getSubscriber(headers.correlationId)

    if (!subscriber) {
      logger.error({destination, correlationId: headers.correlationId}, 'no subscriber for message')
      return
    }

    message.readString('utf-8', (messageError, responseContent) => {
      if (messageError) {
        subscriber.reject(new RpcError('message parse error', messageError))
        return
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
  logger,
) => {
  const sendHeaders = {
    ...headers,
    destination: destinationQueue,
    replyTo: responseQueue,
    correlationId,
  }

  logger.debug({sendHeaders, content}, 'sending frame')
  sendFrame(client, content, sendHeaders)
}

const responseHeaders = (requestHeaders) => {
  const {'reply-to': destination, ...rest} = requestHeaders
  return {...rest, destination}
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
    const headers = fromStompHeaders(responseHeaders(message.headers))
    Promise.resolve()
      .then(() => handler({body, headers}))
      .then((response) => {
        response = response || 'success'
        const successHeaders = {...headers, ok: true}
        sendFrame(client, response, successHeaders)
        resolve({headers: successHeaders, response})
      })
      .catch((handlerError) => {
        const {message: errorMessage, context} = handlerError
        const failureHeaders = {...headers, ok: false}
        sendFrame(client, {message: errorMessage, context}, failureHeaders)
        reject(handlerError)
      })
  })

module.exports = {
  subscribeRpcHandler,
  subscribeToQueue,
  parseMessage,
  sendFrame,
  sendRpc,
  respondToRpc,
}
