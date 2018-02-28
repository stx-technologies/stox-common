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
const {scheduleJob} = require('./schedule')
const {createMqConnections, RpcRouter} = require('./mq')
// const {initBlockchain} = require('./blockchain')

const defaultConfig = {
  clientRootDist: '',
  databaseUrl: '',
  // eslint-disable-next-line no-unused-vars
  models: (sequalize) => {},
  // eslint-disable-next-line no-unused-vars
  initRoutesFunc: (router, createEndpoint, secure) => {},
  apiServerConfig: undefined,
  jobs: [],
  queueConnectionConfig: null,
  consumerQueues: {},
  rpcQueues: {},
  blockchain: undefined,
}

// eslint-disable-next-line no-unused-vars
const noopBuilder = (builder) => {}

const noopServerConfigDefinition = {
  port: 0,
  version: 1,
  // eslint-disable-next-line no-unused-vars
  routes: (router, createEndpoint, secure) => {},
  cors: false,
  jwtSecret: '',
}

// eslint-disable-next-line no-unused-vars
const queueCallback = (message) => {}

const noopJobDefinition = {cron: '', job: () => {}}

class ServiceConfigurationBuilder {
  constructor() {
    this.config = Object.assign({}, defaultConfig)
  }

  static(clientRootDist) {
    this.config.clientRootDist = clientRootDist
  }

  db(databaseUrl, models) {
    this.config.databaseUrl = databaseUrl
    this.config.models = models
  }

  api(apiServerConfig/* = noopServerConfigDefinition */) {
    this.config.apiServerConfig = apiServerConfig
  }

  static toQueueSpec(listeners = {}) {
    return Object.entries(listeners).map(([method, handler]) => ({method, handler}))
  }

  addQueues(connectionConfig, {listeners, rpcListeners}) {
    this.config.queueConnectionConfig = connectionConfig
    this.config.consumerQueues = ServiceConfigurationBuilder.toQueueSpec(listeners)
    this.config.rpcQueues = ServiceConfigurationBuilder.toQueueSpec(rpcListeners)
  }

  addJob(name, {cron, job} = noopJobDefinition) {
    this.config.jobs.push({name, cron, job})
  }

  addJobs(jobs) {
    Object.entries(jobs).forEach(([name, jobConfig]) => this.addJob(name, jobConfig))
  }

  blockchain(web3Url, contractsDir) {
    this.config.blockchain = {web3Url, contractsDir}
  }
}

const initRouter = (initRoutes, jwtSecret) => {
  const router = new express.Router()
  if (jwtSecret) {
    router.use(jwtRequest(jwtSecret))
  }
  initRoutes(router, createApiEndpoint, jwtSecret && jwtSecure)
  return router
}

const initExpress = async (app, config = noopServerConfigDefinition, clientRootDist) => {
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

  return new Promise((resolve, reject) => {
    try {
      const server = app.listen(config.port, () => {
        logger.info({binding: server.address()}, 'http server started')
        resolve(app)
      })
    } catch (e) {
      logger.error(e)
      reject(e)
    }
  })
}

const initQueues = async (serviceName, {queueConnectionConfig, consumerQueues, rpcQueues}) => {
  const {mqConnections} = await createMqConnections(queueConnectionConfig)
  const {rpcServer, pubsubClient} = await mqConnections
  consumerQueues.forEach(({method, handler}) =>
    pubsubClient.subscribe(serviceName, method, handler))

  const rpcRouter = new RpcRouter()
  rpcQueues.forEach(({method, handler}) =>
    rpcRouter.respondTo(serviceName, method, handler))
  rpcServer.use(rpcRouter).start()
}

const createService = (serviceName, builderFunc = noopBuilder) => ({
  async start() {
    const configBuilder = new ServiceConfigurationBuilder()
    builderFunc(configBuilder)
    const {config} = configBuilder

    if (config.databaseUrl) {
      await dbInit(config.databaseUrl, config.models)
    }

    const app = express() // should this be inside apiServerConfig check?
    if (config.apiServerConfig) {
      await initExpress(app, config.apiServerConfig, config.clientRootDist)
    }

    if (config.queueConnectionConfig) {
      await initQueues(serviceName, config)
    }

    config.jobs.forEach(({name, cron, job}) => scheduleJob(name, cron, job))

    // if (config.blockchain) {
    //   await initBlockchain(config.blockchain.web3Url, config.blockchain.contractsDir)
    // }
  },
})

module.exports = {
  createService,
}
