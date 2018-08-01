const {loggers: {logger}} = require('@welldone-software/node-toolbelt')
const {RpcError} = require('../../lib/errors')
const RpcRouter = require('../../lib/mq/router')
const RpcServer = require('../../lib/mq/server')

/**
 * This is the same server from https://github.com/gioragutt/stx-amq-poc
 * except is uses the modules in this library.
 *
 * You can use the given client from here, or the client from the repo above.
 */

const tryParseNumber = (number, method) => {
  // eslint-disable-next-line no-restricted-globals
  if ((!number && number !== 0) || isNaN(number)) {
    throw new RpcError(`Invalid number sent to ${method}`, {number})
  }

  return Number.parseFloat(number)
}

class Database {
  constructor() {
    this.list = new Set()
  }

  get items() {
    return `[${Array.from(this.list).join(', ')}]`
  }

  add(number) {
    number = tryParseNumber(number, 'ADD')
    if (this.list.has(number)) {
      logger.debug(`${number} already in the list`)
      return `${number} already in the list`
    }

    logger.info(`Adding ${number} to the list`)
    this.list.add(number)
    return this.items
  }

  remove(number) {
    number = tryParseNumber(number, 'REMOVE')
    if (!this.list.has(number)) {
      logger.debug(`${number} not in the list`)
      return `${number} not in the list`
    }

    logger.info(`Removing ${number} from the list`)
    this.list.delete(number)
    return this.items
  }

  query() {
    const result = this.items
    logger.debug({result}, 'query result')
    return result
  }

  clear() {
    logger.info('Clearing the list')
    this.list.clear()
    return this.items
  }
}

const db = new Database()

const readWriteRouter = new RpcRouter()
readWriteRouter.respondTo('/add', ({body: {number}}) => db.add(number))
readWriteRouter.respondTo('/remove', ({body: {number}}) => db.remove(number))
readWriteRouter.respondTo('/clear', () => db.clear())

const readOnlyRouter = new RpcRouter()
readOnlyRouter.respondTo('/query', () => db.query())
readOnlyRouter.respondTo('/echo', ({body: {message}}) => message)

RpcServer.connect('localhost:61613').then((rpcServer) => {
  logger.info('connected')
  rpcServer
    .use(readWriteRouter)
    .use(readOnlyRouter)
    .start()
})
