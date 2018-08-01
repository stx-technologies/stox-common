const RpcClient = require('./client')
const RpcServer = require('./server')
const PubsubClient = require('./pubsub')
const RpcRouter = require('./router')
const {connectToStompit} = require('./mq')
const context = require('../context')
const {logError} = require('../errors')

const mq = {}

const defaultOptions = {
  timeout: 3000,
}

/**
 * Creates a MQ connection
 * @param {*} connectOptions {@link RpcClient#connect}
 */
const createMqConnections = ({pubsubClient, rpcClient}) => {
  const publish = (queue, content, headers = {}) => pubsubClient.publish(queue, content, headers)

  const subscribe = (queue, handler) => {
    const subscriptionPromise = pubsubClient.subscribe(queue, handler)
    return {
      unsubscribe: () => subscriptionPromise.then(s => s.unsubscribe()),
    }
  }
  const rpc = (method, body = {}, headers = {}) => rpcClient.call(method, body, {...defaultOptions, headers})

  Object.assign(mq, {rpc, publish, subscribe})
}

const initQueues = async ({queueConnectionConfig, consumerQueues, rpcQueues}) => {
  const stompit = await connectToStompit(queueConnectionConfig)
  stompit.on('error', (error) => {
    context.logger.error('Queue failed stopping service')
    logError(error)
    process.exit(1)
  })
  const rpcServer = new RpcServer(stompit)
  const pubsubClient = new PubsubClient(stompit)
  const rpcClient = new RpcClient(stompit)

  createMqConnections({pubsubClient, rpcClient})
  consumerQueues.forEach(({method, handler}) => pubsubClient.subscribe(method, handler))

  const rpcRouter = new RpcRouter()
  rpcQueues.forEach(({method, handler}) => rpcRouter.respondTo(method, handler))
  rpcServer.use(rpcRouter).start()
}

module.exports = {createMqConnections, initQueues, mq}
