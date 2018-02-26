const stompit = require('stompit')
const {promisify} = require('util')

let client
const subscribeQueue = (queueName, handler) =>
  new Promise((resolve, reject) => {
    const subscribeHeaders = {
      destination: queueName,
      ack: 'client-individual',
    }
    client.subscribe(subscribeHeaders, (subscriptionError, message) => {
      if (subscriptionError) {
        reject(subscriptionError)
        return
      }

      message.readString('utf-8', (messageError, body) => {
        if (messageError) {
          reject(messageError)
          return
        }

        resolve(handler(JSON.parse(body)))

        client.ack(message)
      })
    })
  })

const sendToQueue = (destination, message) => {
  const frame = client.send({
    destination,
    'content-type': 'application/json',
  })
  frame.write(JSON.stringify(message))
  frame.end()
}

const queueInit = async ({host, port, user: login, password: passcode}, initQueueRoutes) => {
  const connectOptions = {
    host,
    port,
    connectHeaders: {
      host: '/',
      login,
      passcode,
    },
  }
  client = await promisify(stompit.connect)(connectOptions)
  if (initQueueRoutes) {
    initQueueRoutes(subscribeQueue)
  }
}

module.exports = {
  sendToQueue,
  queueInit,
}
