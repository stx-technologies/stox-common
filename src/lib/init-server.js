const express = require('express')
const compression = require('compression')
const bodyParser = require('body-parser')
const expressStatusMonitor = require('express-status-monitor')
const {
  loggers: {logger, expressLogger},
  expressHelpers: {errorHandler, createApiEndpoint},
} = require('@welldone-software/node-toolbelt')
const fallback = require('express-history-api-fallback')
const lusca = require('lusca')
const cors = require('cors')
const {dbInit} = require('./db-connect')

const defaultExpressOptions = {
  enableCors: false,
  clientRoot: '',
}

const initRouter = (initRoutes) => {
  const router = new express.Router()
  initRoutes(router, createApiEndpoint)
  return router
}

const initExpress = (app, initRoutes, options = {}) => {
  const opts = {...defaultExpressOptions, ...options}
  if (opts.enableCors) {
    app.use(cors({credentials: true, origin: true}))
  }
  app.use(compression())
  app.use(bodyParser.json())
  app.use(expressLogger())
  if (opts.clientRoot) {
    app.use(lusca.xframe('SAMEORIGIN'))
    app.use(lusca.xssProtection(true))
  }
  app.set('trust proxy', 'loopback')
  app.disable('x-powered-by')
  app.use('/api/v1', initRouter(initRoutes))
  if (opts.clientRoot) {
    app.use(express.static(opts.clientRoot))
    app.use(fallback('index.html', {root: opts.clientRoot}))
  }
  app.use(expressStatusMonitor())
  app.use(errorHandler)
}

const initServer = async (port, databaseUrl, initRoutes, dbModel, options = defaultExpressOptions) => {
  const app = express()
  initExpress(app, initRoutes, options)
  await dbInit(databaseUrl, dbModel)
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
}

module.exports = {
  initServer,
  initExpress,
  initRouter,
}
