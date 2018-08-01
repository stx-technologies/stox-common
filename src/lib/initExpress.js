const express = require('express')
const compression = require('compression')
const bodyParser = require('body-parser')
// const expressStatusMonitor = require('express-status-monitor')
const {
  jwt: {jwtRequest, jwtSecure},
  loggers: {expressLogger},
  expressHelpers: {createApiEndpoint},
} = require('@welldone-software/node-toolbelt')
const fallback = require('express-history-api-fallback')
const lusca = require('lusca')
const cors = require('cors')
const context = require('./context')
const {errorHandler} = require('./errors')

const initRouter = (initRoutes, jwtSecret) => {
  const router = new express.Router()
  if (jwtSecret) {
    router.use(jwtRequest(jwtSecret))
  }
  initRoutes(router, createApiEndpoint, jwtSecret && jwtSecure)
  return router
}

const initExpress = async (config, serviceName) => {
  const {logger} = context
  const app = express()
  if (config.cors) {
    app.use(cors({credentials: true, origin: true}))
  }
  app.use(compression())
  app.use(bodyParser.json())

  const apiLogger = expressLogger()
  Object.assign(apiLogger.logger, apiLogger.logger.child({name: serviceName}))
  app.use(apiLogger)

  if (config.clientRootDist) {
    app.use(lusca.xframe('SAMEORIGIN'))
    app.use(lusca.xssProtection(true))
    app.use(express.static(config.clientRootDist))
    app.use(fallback('index.html', {root: config.clientRootDist}))
  }
  app.set('trust proxy', 'loopback')
  app.disable('x-powered-by')
  app.use(`/api/v${config.version}`, initRouter(config.routes, config.jwtSecret))
  // app.use(expressStatusMonitor())
  app.use(errorHandler)

  return new Promise((resolve, reject) => {
    try {
      const server = app.listen(config.port, () => {
        logger.info({binding: server.address()}, 'HTTP_SERVER_STARTED')
        resolve(server)
      })
    } catch (e) {
      logger.error(e)
      reject(e)
    }
  })
}

module.exports = initExpress
