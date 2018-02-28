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

  const rpc =
    (queueName, method, body = {}, headers = {}) =>
      clientPromise.then(client =>
        client.call(`${queueName}/${method}`, body, {...defaultOptions, headers}))
  return {rpc, clientPromise}
}

module.exports = {createRpcConnection, RpcServer}
