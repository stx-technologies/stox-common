const db = require('./dbInit')
const initExpress = require('./initExpress')
const {scheduleJob} = require('./schedule')
const {initQueues, mq} = require('./mq')
const blockchain = require('./blockchain')

const defaultConfig = {
  clientRootDist: '',
  databaseUrl: '',
  models: (sequalize) => {}, // eslint-disable-line no-unused-vars
  initRoutesFunc: (router, createEndpoint, secure) => {}, // eslint-disable-line no-unused-vars
  jobs: [],
  apis: [],
  queueConnectionConfig: null,
  consumerQueues: {},
  rpcQueues: {},
  web3Url: '',
  contractsDirPath: '',
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
    if (!databaseUrl || !models) {
      throw new Error('ServiceConfigurationBuilder.db missing required param')
    }
    this.config.databaseUrl = databaseUrl
    this.config.models = models
  }

  blockchain(web3Url, contractsDirPath) {
    if (!web3Url || !contractsDirPath) {
      throw new Error('ServiceConfigurationBuilder.blockchain missing required param')
    }
    this.config.web3Url = web3Url
    this.config.contractsDirPath = contractsDirPath
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
    if (!connectionConfig) {
      throw new Error('ServiceConfigurationBuilder.addQueues missing required param')
    }
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
const createService = async (serviceName, builderFunc) => {
  const {config} = new ServiceConfigurationBuilder(builderFunc)

  if (config.databaseUrl && config.models) {
    await db.dbInit(config.databaseUrl, config.models)
  }

  if (config.web3Url && config.contractsDirPath) {
    blockchain.init(config.web3Url, config.contractsDirPath)
  }

  if (config.queueConnectionConfig) {
    await initQueues(config)
  }

  await Promise.all(config.apis.map(apiServerConfig => initExpress(apiServerConfig)))
  config.jobs.forEach(({name, cron, job}) => scheduleJob(name, cron, job))

  return {
    mq,
    db,
    blockchain,
  }
}

module.exports = {
  createService,
}
