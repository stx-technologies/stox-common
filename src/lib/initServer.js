const express = require('express')
const compression = require('compression')
const bodyParser = require('body-parser')
const expressStatusMonitor = require('express-status-monitor')
const {
  // jwt: {jwtRequest, jwtSecure},
  loggers: {logger, expressLogger},
  expressHelpers: {errorHandler, createApiEndpoint},
} = require('@welldone-software/node-toolbelt')
const fallback = require('express-history-api-fallback')
const lusca = require('lusca')
const cors = require('cors')
const {dbInit} = require('./dbConnect')
const {makeTaskConsumer} = require('./queue')
const {scheduleJob} = require('./schedule')

const defaultConfig = {
  clientRootDist: '',
  databaseUrl: '',
  models: () => {},
  initRoutesFunc: (router, createApiEndpoint, secure) => {},
  apiServerConfig: undefined,
  jobs: [],
  queues: [],
}
const defaultBuilder = (builder = Builder()) => {}

const apiServerConfigDefinition = {
  port: 0,
  version: 1,
  routes: (router, createApiEndpoint, secure) => {},
  cors: false,
  // jwtSecret: '',
}
const queueCallback = (message) => {}
const jobConfigDefinition = {
  cron: '',
  job: () => {},
}

const Builder = config => ({
  static(clientRootDist) {
    config.clientRootDist = clientRootDist
  },
  db(databaseUrl, models) {
    config.databaseUrl = databaseUrl
    config.models = models
  },
  api(apiServerConfig = apiServerConfigDefinition) {
    config.apiServerConfig = apiServerConfig
  },
  addQueue(name, connectionUrl, cb = queueCallback) {
    config.queues.push({name, cb, connectionUrl})
  },
  addJob(name, jobConfig = jobConfigDefinition) {
    config.jobs.push({name, cron: jobConfig.cron, func: jobConfig.job})
  },
})

const initRouter = (initRoutes, jwtSecret) => {
  const router = new express.Router()
  // if (jwtSecret) {
  //   router.use(jwtRequest(jwtSecret))
  // }
  initRoutes(router, createApiEndpoint) // , jwtSecure)
  return router
}

const initExpress = (app, config = apiServerConfigDefinition, clientRootDist) => {
  if (config.cors) {
    app.use(cors({credentials: true, origin: true}))
  }
  app.use(compression())
  app.use(bodyParser.json())
  app.use(expressLogger())
  if (clientRootDist) {
    app.use(lusca.xframe('SAMEORIGIN'))
    app.use(lusca.xssProtection(true))
    app.use(express.static(clientRootDist))
    app.use(fallback('index.html', {root: clientRootDist}))
  }
  app.set('trust proxy', 'loopback')
  app.disable('x-powered-by')
  app.use(`/api/v${config.version}`, initRouter(config.routes, config.jwtSecret))
  app.use(expressStatusMonitor())
  app.use(errorHandler)
}

const createServer = (port, builderFunc = defaultBuilder) => ({
  async start() {
    const config = Object.assign({}, defaultConfig)
    builderFunc(Builder(config))
    const app = express()
    if (config.databaseUrl) {
      await dbInit(config.databaseUrl, config.models)
    }
    if (config.apiServerConfig) {
      initExpress(app, config.apiServerConfig, config.clientRootDist)
      await new Promise((resolve, reject) => {
        try {
          const server = app.listen(config.apiServerConfig.port, () => {
            logger.info({binding: server.address()}, 'http server started')
            resolve(app)
          })
        } catch (e) {
          logger.error(e)
          reject(e)
        }
      })
    }
    await Promise.all(config.queues.map(({name, cb, connectionUrl}) =>
      makeTaskConsumer(cb, connectionUrl, name)))

    config.jobs.forEach(({name, cron, func}) => scheduleJob(name, cron, func))
  },
})

module.exports = {
  createServer,
}
