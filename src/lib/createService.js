const db = require('./dbInit')
const initExpress = require('./initExpress')
const {scheduleJob} = require('./schedule')
const {initQueues, mq} = require('./mq')

const defaultConfig = {
  clientRootDist: '',
  databaseUrl: '',
  // eslint-disable-next-line no-unused-vars
  models: (sequalize) => {},
  // eslint-disable-next-line no-unused-vars
  initRoutesFunc: (router, createEndpoint, secure) => {},
  jobs: [],
  apis: [],
  queueConnectionConfig: null,
  consumerQueues: {},
  rpcQueues: {},
}

// eslint-disable-next-line no-unused-vars
const queueCallback = (message) => {}
// eslint-disable-next-line no-unused-vars
const noopJobDefinition = {cron: '', job: () => {}}

// eslint-disable-next-line no-unused-vars
const noopServerConfigDefinition = {
  port: 0,
  version: 1,
  // eslint-disable-next-line no-unused-vars
  routes: (router, createEndpoint, secure) => {},
  cors: false,
  jwtSecret: '',
  clientRootDist: '',
}

class ServiceConfigurationBuilder {
  constructor(builderFunc) {
    this.config = Object.assign({}, defaultConfig)
    builderFunc(this)
  }

  db(databaseUrl, models) {
    this.config.databaseUrl = databaseUrl
    this.config.models = models
  }

  /**
   * @param {noopServerConfigDefinition} apiServerConfig
   */
  addApi(apiServerConfig) {
    this.config.apis.push(apiServerConfig)
  }

  static toQueueSpec(listeners = {}) {
    return Object.entries(listeners).map(([method, handler]) => ({method, handler}))
  }

  addQueues(connectionConfig, {listeners, rpcListeners} = {}) {
    this.config.queueConnectionConfig = connectionConfig
    this.config.consumerQueues = ServiceConfigurationBuilder.toQueueSpec(listeners)
    this.config.rpcQueues = ServiceConfigurationBuilder.toQueueSpec(rpcListeners)
  }

  /**
   * @param {noopJobDefinition} jobDefintion
   */
  addJob(name, {cron, job}) {
    this.config.jobs.push({name, cron, job})
  }

  addJobs(jobs) {
    Object.entries(jobs).forEach(([name, jobConfig]) => this.addJob(name, jobConfig))
  }
}

/**
 * @callback builderCallback
 * @param {ServiceConfigurationBuilder} builder
 */
// eslint-disable-next-line no-unused-vars
const noopBuilder = (builder) => {}

/**
 * @param {String} serviceName
 * @param {noopBuilder} builderFunc
 */
const createService = (serviceName, builderFunc) => ({
  async start() {
    const configBuilder = new ServiceConfigurationBuilder(builderFunc)
    const {config} = configBuilder
    if (config.databaseUrl) {
      await db.dbInit(config.databaseUrl, config.models)
    }

    await Promise.all(config.apis.map(apiServerConfig => initExpress(apiServerConfig)))

    if (config.queueConnectionConfig) {
      await initQueues(serviceName, config)
    }

    config.jobs.forEach(({name, cron, job}) => scheduleJob(name, cron, job))

    return {
      mq,
      db,
    }
  },
})

module.exports = {
  createService,
}
