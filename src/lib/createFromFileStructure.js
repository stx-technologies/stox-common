/* eslint-disable global-require,import/no-dynamic-require */
const requireAll = require('require-all')
const path = require('path')
const {loggers: {logger}} = require('@welldone-software/node-toolbelt')
const {createService} = require('./createService')
const fs = require('fs')

const objectCreators = dirname => (name) => {
  const pathToRequre = path.resolve(dirname, name)
  if (fs.existsSync(pathToRequre)) {
    if (fs.lstatSync(pathToRequre).isDirectory()) {
      return requireAll(pathToRequre)
    }
    return require(pathToRequre)
  }
  return undefined
}

module.exports = (name, dirname, {models, contractsDir}) => {
  const builderFunc = (builder) => {
    const createObjectFromName = objectCreators(dirname)

    const config = createObjectFromName('config.js')

    if (!config) {
      throw new Error('Cannot initialize service without config.js')
    }
    const {databaseUrl, mqConnectionUrl, web3Url} = config

    logger.info('Adding configuration to service')

    const api = createObjectFromName('api.js')
    if (api) {
      logger.info('Api:', api)
      builder.addApi(api)
    }

    if (databaseUrl && models) {
      logger.info('Database:', {databaseUrl})
      builder.db(databaseUrl, models)
    }

    const jobs = createObjectFromName('jobs')
    if (jobs) {
      logger.info('Jobs:', {jobs})
      builder.addJobs(jobs)
    }
    if (web3Url && contractsDir) {
      logger.info('Blockchain: ', web3Url, contractsDir)
      builder.blockchain(web3Url, contractsDir)
    }
    if (mqConnectionUrl) {
      const listeners = createObjectFromName('queues/listeners')
      const rpcListeners = createObjectFromName('queues/rpcListeners')
      logger.info('Queues: ', {mqConnectionUrl, listeners, rpcListeners})
      builder.addQueues(mqConnectionUrl, {listeners, rpcListeners})
    }
  }

  return createService(name, builderFunc)
}
