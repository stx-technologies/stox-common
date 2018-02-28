const express = require('express')
const compression = require('compression')
const bodyParser = require('body-parser')
const expressStatusMonitor = require('express-status-monitor')
const {
  jwt: {jwtRequest, jwtSecure},
  loggers: {logger, expressLogger},
  expressHelpers: {errorHandler, createApiEndpoint},
} = require('@welldone-software/node-toolbelt')
const fallback = require('express-history-api-fallback')
const lusca = require('lusca')
const cors = require('cors')
const {dbInit} = require('./dbConnect')
const {makeTaskConsumer} = require('./queue')
const {scheduleJob} = require('./schedule')
const {RpcServer} = require('./rpc')
const {initBlockchain} = require('./blockchain')

const defaultConfig = {
  clientRootDist: '',
  databaseUrl: '',
  models: () => {},
  initRoutesFunc: (router, createApiEndpoint, secure) => {},
  apiServerConfig: undefined,
  jobs: [],
  consumerQueues: {},
  rpcQueues: {},
  blockchain: undefined,
}
const defaultBuilder = (builder = Builder()) => {}

const apiServerConfigDefinition = {
  port: 0,
  version: 1,
  routes: (router, createApiEndpoint, secure) => {},
  cors: false,
  jwtSecret: '',
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
  addConsumerQueue(name, connectionUrl, cb = queueCallback) {
    config.consumerQueues[name] = {cb, connectionUrl}
  },
  addConsumerQueues(queues, connectionUrl) {
    Object.entries(queues).forEach(([name, cb]) => {
      config.consumerQueues[name] = {cb, connectionUrl}
    })
  },
  addRpcQueue(name, initRoutes, connectionConfig) {
    config.rpcQueues[name] = {initRoutes, connectionConfig}
  },
  addRpcQueues(queues, connectionConfig) {
    Object.entries(queues).forEach(([name, initRoutes]) => {
      config.rpcQueues[name] = {initRoutes, connectionConfig}
    })
  },
  addJob(name, jobConfig = jobConfigDefinition) {
    config.jobs.push({name, cron: jobConfig.cron, func: jobConfig.job})
  },
  addJobs(jobs) {
    Object.entries(jobs).forEach(([name, jobConfig]) => {
      config.jobs.push({name, cron: jobConfig.cron, func: jobConfig.job})
    })
  },
  blockchain(web3Url, contractsDir) {
    config.blockchain = {web3Url, contractsDir}
  },
})

const initRouter = (initRoutes, jwtSecret) => {
  const router = new express.Router()
  if (jwtSecret) {
    router.use(jwtRequest(jwtSecret))
  }
  initRoutes(router, createApiEndpoint, jwtSecret && jwtSecure)
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

const addRpcRoute = (router, queueName, routePath, cb) => {
  router.respondTo(`${queueName}/${routePath}`, cb)
}

const createService = (serviceName, builderFunc = defaultBuilder) => ({
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
    await Promise.all(Object.entries(config.consumerQueues).map(([name, {cb, connectionUrl}]) =>
      makeTaskConsumer(cb, connectionUrl, name)))

    await Promise.all(Object.entries(config.rpcQueues)
      .map(([name, {initRoutes, connectionConfig}]) => {
        const server = new RpcServer()
        const router = new RpcServer.Router()
        initRoutes(addRpcRoute.bind(null, router, name))
        server.use(router)
        return server.start(connectionConfig)
      }))

    config.jobs.forEach(({name, cron, func}) => scheduleJob(name, cron, func))

    if (config.blockchain) {
      await initBlockchain(config.blockchain.web3Url, config.blockchain.contractsDir)
    }
  },
})

module.exports = {
  createService,
}
