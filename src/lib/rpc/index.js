const {loggers: {logger}} = require('@welldone-software/node-toolbelt')
const RpcClient = require('./client')
const {RpcError} = require('../errors')
const RpcServer = require('./server')
const RpcRouter = require('./router')

RpcServer.Router = RpcRouter

const defaultOptions = {
  timeout: 3000,
}

/**
 * Creates a MQ connection
 * @param {*} connectOptions {@link RpcClient#connect}
 */
const createRpcConnection = (connectOptions) => {
  const clientPromise = RpcClient.connect(connectOptions, {logger})
    .catch((e) => {
      const error = new RpcError(e)
      logger.error(error, 'failed to connect to ActiveMQ')
      return Promise.reject(error)
    })

  const publish =
    (queue, content, headers = {}) =>
      clientPromise.then(client =>
        client.publish(queue, content, headers))

  const subscribe = (queue, handler) => {
    const subscriptionPromise = clientPromise.then(client =>
      client.subscribe(queue, handler))
    return {
      unsubscribe: () => subscriptionPromise.then(s => s.unsubscribe()),
    }
  }

  const rpc =
    (queueName, method, body = {}, headers = {}) =>
      clientPromise.then(client =>
        client.call(method, body, {...defaultOptions, headers}))
  return {rpc, publish, subscribe, clientPromise}
}

module.exports = {createRpcConnection, RpcServer}
