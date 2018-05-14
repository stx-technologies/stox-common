/* eslint-disable global-require,import/no-dynamic-require */
const requireAll = require('require-all')
const path = require('path')
const {createService} = require('./createService')
const {getEnvForService} = require('./ssm')
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

module.exports = async (dirname, env, region) => {
  const {name} = require(path.resolve(dirname, '../package.json'))
  const subsystemName = require(path.resolve(dirname, '../../../package.json')).name

  const requireFile = requireFromDirname(dirname)
  const config = requireFile('config.js')

  if (env && region){
    const ssmConfig = await getEnvForService(name, subsystemName, env, region)
    Object.assign(config, ssmConfig)
  }

  if (!config) {
    throw new Error('cannot get service config')
  }

  const models = requireFile('../../common/src/db/models.js')
  const contractsDir = path.resolve(dirname, '../../common/src/services/blockchain/contracts')
  const contractsBinDir = path.resolve(dirname, '../../common/src/services/blockchain/contractsBin')
  const {databaseUrl, mqConnectionUrl, web3Url} = config

  const builderFunc = (builder) => {
    const api = requireFile('api.js')
    if (api) {
      builder.addApi(api)
    }

    const apis = requireFile('apis')
    if (apis) {
      builder.addApis(Object.values(apis))
    }

    if (databaseUrl && models) {
      builder.db(databaseUrl, models)
    }

    const jobs = requireFile('jobs')
    if (jobs) {
      builder.addJobs(jobs)
    }

    if (web3Url) {
      builder.blockchain(
        web3Url,
        fs.existsSync(contractsDir) ? contractsDir : undefined,
        fs.existsSync(contractsBinDir) ? contractsBinDir : undefined
      )
    }

    if (mqConnectionUrl) {
      const listeners = requireFile('queues/listeners')
      const rpcListeners = requireFile('queues/rpcListeners')
      builder.addQueues(mqConnectionUrl, {listeners, rpcListeners})
    }
  }

  return createService(name, builderFunc)
}
