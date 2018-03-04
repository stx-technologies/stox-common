const RpcClient = require('./client')
const RpcServer = require('./server')
const PubsubClient = require('./pubsub')
const RpcRouter = require('./router')
const {connectToStompit} = require('./mq')

const mq = {}

const defaultOptions = {
  timeout: 3000,
}

/**
 * Creates a MQ connection
 * @param {*} connectOptions {@link RpcClient#connect}
 */
const createMqConnections = (connectOptions, options = {}) => {
  const mqConnections = connectToStompit(connectOptions)
    .then(stompit => ({
      rpcClient: new RpcClient(stompit, options.rpcClient),
      rpcServer: new RpcServer(stompit, options.rpcServer),
      pubsubClient: new PubsubClient(stompit, options.pubsubClient),
    }))

  const publish =
    (queue, content, headers = {}) =>
      mqConnections.then(({pubsubClient}) =>
        pubsubClient.publish(queue, content, headers))

  const subscribe = (queue, handler) => {
    const subscriptionPromise =
      mqConnections.then(({pubsubClient}) => pubsubClient.subscribe(queue, handler))
    return {
      unsubscribe: () => subscriptionPromise.then(s => s.unsubscribe()),
    }
  }

  const rpc =
    (method, body = {}, headers = {}) =>
      mqConnections.then(({rpcClient}) =>
        rpcClient.call(method, body, {...defaultOptions, headers}))

  Object.assign(mq, {rpc, publish, subscribe, mqConnections})

  return mq
}

const initQueues = async (serviceName, {queueConnectionConfig, consumerQueues, rpcQueues}) => {
  const {mqConnections} = await createMqConnections(queueConnectionConfig)
  const {rpcServer, pubsubClient} = await mqConnections
  consumerQueues.forEach(({method, handler}) =>
    pubsubClient.subscribe(serviceName, method, handler))

  const rpcRouter = new RpcRouter()
  rpcQueues.forEach(({method, handler}) => rpcRouter.respondTo(serviceName, method, handler))
  rpcServer.use(rpcRouter).start()
}

module.exports = {createMqConnections, initQueues, mq}
