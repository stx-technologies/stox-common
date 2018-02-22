const express = require('express')
const compression = require('compression')
const bodyParser = require('body-parser')
const expressStatusMonitor = require('express-status-monitor')
const {
  jwtMiddlewares: {jwtRequest},
  loggers: {logger, expressLogger},
  expressHelpers: {errorHandler, createApiEndpoint},
} = require('@welldone-software/node-toolbelt')
const fallback = require('express-history-api-fallback')
const lusca = require('lusca')
const cors = require('cors')
const {dbInit} = require('./dbConnect')

const defaultConfig = {
  cors: false,
  clientRootDist: '',
  databaseUrl: '',
  models: () => {},
  initRoutesFunc: (router, createApiEndpoint) => {},
  jwtSecret: '',
}
const defaultBuilder = (builder = Builder()) => {}

const initRouter = (initRoutes, jwtSecret = '') => {
  const router = new express.Router()
  if (jwtSecret) {
    router.use(jwtRequest(jwtSecret))
  }
  initRoutes(router, createApiEndpoint)
  return router
}

const Builder = config => ({
  enableCors() {
    config.cors = true
  },
  static(clientRootDist) {
    config.clientRootDist = clientRootDist
  },
  initDb(databaseUrl, models) {
    config.databaseUrl = databaseUrl
    config.models = models
  },
  initRoutes(initRoutesFunc, jwtSecret = '') {
    config.initRoutesFunc = initRoutesFunc
    config.jwtSecret = jwtSecret
  },
})

const initExpress = (app, config = defaultConfig) => {
  if (config.cors) {
    app.use(cors({credentials: true, origin: true}))
  }
  app.use(compression())
  app.use(bodyParser.json())
  app.use(expressLogger())
  if (config.clientRootDist) {
    app.use(lusca.xframe('SAMEORIGIN'))
    app.use(lusca.xssProtection(true))
    app.use(express.static(config.clientRootDist))
    app.use(fallback('index.html', {root: config.clientRootDist}))
  }
  app.set('trust proxy', 'loopback')
  app.disable('x-powered-by')
  app.use('/api/v1', initRouter(config.initRoutesFunc, config.jwtSecret))
  app.use(expressStatusMonitor())
  app.use(errorHandler)
}

const createServer = (port, builderFunc = defaultBuilder) => ({
  async start() {
    const config = Object.assign({}, defaultConfig)
    builderFunc(Builder(config))
    const app = express()
    initExpress(app, config)
    if (config.databaseUrl) {
      await dbInit(config.databaseUrl, defaultConfig.models)
    }
    return new Promise((resolve, reject) => {
      try {
        const server = app.listen(port, () => {
          logger.info({binding: server.address()}, 'http server started')
          resolve(app)
        })
      } catch (e) {
        logger.error(e)
        reject(e)
      }
    })
  },
})

module.exports = {
  createServer,
}
