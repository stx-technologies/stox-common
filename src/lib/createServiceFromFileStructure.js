/* eslint-disable global-require,import/no-dynamic-require */
const requireAll = require('require-all')
const path = require('path')
const {loggers: {logger}} = require('@welldone-software/node-toolbelt')
const {createService} = require('./createService')
const fs = require('fs')

const requireFromDirname = dirname => (name) => {
  const pathToRequre = path.resolve(dirname, name)
  if (fs.existsSync(pathToRequre)) {
    if (fs.lstatSync(pathToRequre).isDirectory()) {
      return requireAll(pathToRequre)
    }
    return require(pathToRequre)
  }
  return undefined
}

module.exports = (
  dirname,
  {models: modelsInput, contractsDir: contractsInput, name: nameInput} = {}
) => {
  const builderFunc = (builder) => {
    const requireFile = requireFromDirname(dirname)

    const config = requireFile('config.js')

    if (!config) {
      throw new Error('Cannot initialize service without config.js')
    }

    const models = modelsInput || requireFile('../../common/src/db/models.js')
    const contractsDir =
    contractsInput || path.resolve(dirname, '../../common/src/blockchain/contracts')

    const {databaseUrl, mqConnectionUrl, web3Url} = config

    logger.info('Adding configuration to service')

    const api = requireFile('api.js')
    if (api) {
      logger.info(api, 'Api:')
      builder.addApi(api)
    }

    const apis = requireFile('apis')
    if (apis) {
      logger.info(apis, 'Apis:')
      builder.addApis(Object.values(apis))
    }

    if (databaseUrl && models) {
      logger.info({databaseUrl}, 'Database:')
      builder.db(databaseUrl, models)
    }

    const jobs = requireFile('jobs')
    if (jobs) {
      logger.info({jobs}, 'Jobs:')
      builder.addJobs(jobs)
    }

    if (web3Url && fs.existsSync(contractsDir)) {
      logger.info(web3Url, contractsDir, 'Blockchain:')
      builder.blockchain(web3Url, contractsDir)
    }

    if (mqConnectionUrl) {
      const listeners = requireFile('queues/listeners')
      const rpcListeners = requireFile('queues/rpcListeners')
      logger.info({mqConnectionUrl, listeners, rpcListeners}, 'Queues:')
      builder.addQueues(mqConnectionUrl, {listeners, rpcListeners})
    }
  }
  const name = nameInput || require(path.resolve(dirname, '../package.json')).name

  logger.info(`Creating service ${name}`)
  return createService(name, builderFunc).catch(logger.error)
}
