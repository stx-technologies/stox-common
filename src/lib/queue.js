const stompit = require('stompit')
const {loggers: {logger}} = require('@welldone-software/node-toolbelt')

const toConnectionObject = (connectionUrl) => {
  const [host, port] = connectionUrl.split(':')
  return {
    host,
    port,
    connectHeaders: {
      host: '',
      login: '',
      passcode: '',
    },
  }
}

const connect = connectionManager =>
  new Promise((resolve, reject) =>
    connectionManager.connect((error, client) => (error ? reject(error) : resolve(client))))

const getMessageBody = msg =>
  new Promise((resolve, reject) =>
    msg.readString('utf-8', (error, body) => (error ? reject(error) : resolve(body))))

const init = async (connectionUrl) => {
  const servers = [toConnectionObject(connectionUrl)]

  const connectionManager = new stompit.ConnectFailover(servers, {maxReconnects: 10})
  const connection = await connect(connectionManager)
  const channel = new stompit.Channel(connectionManager)

  // process.once('SIGINT', () => connection.disconnect())

  return {channel, connection}
}

const makeTaskConsumer = async (consumerFn, connectionUrl, queueName) => {
  const {connection, channel} = await init(connectionUrl)
  const subscribeHeaders = {
    destination: queueName,
    ack: 'client-individual',
    'activemq.prefetchSize': 1,
    persistent: true,
  }
  await channel.subscribe(subscribeHeaders, async (subscriptionError, message) => {
    if (subscriptionError) {
      logger.error('Error on subscription', subscriptionError)
      await channel.nack(message)
      return
    }

    try {
      const msgJson = await getMessageBody(message)
      const msgObj = JSON.parse(msgJson)
      await consumerFn(msgObj)
      await channel.ack(message)
    } catch (err) {
      logger.error('Error consuming message', err)
    }
  })
  return {
    close: async () => connection.close(),
  }
}

const makeTaskProducer = async (connUrl, queueName) => {
  const {connection, channel} = await init(connUrl)
  return {
    send: async (msgObj) => {
      const msgJson = JSON.stringify(msgObj)
      channel.send(queueName, Buffer.from(msgJson))
    },
    close: async () => connection.close(),
  }
}

module.exports = {
  makeTaskConsumer,
  makeTaskProducer,
}
