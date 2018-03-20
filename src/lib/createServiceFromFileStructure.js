/* eslint-disable global-require,import/no-dynamic-require */
const requireAll = require('require-all')
const path = require('path')
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
    contractsInput || path.resolve(dirname, '../../common/src/services/blockchain/contracts')

    const {databaseUrl, mqConnectionUrl, web3Url} = config

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
      builder.blockchain(web3Url, fs.existsSync(contractsDir) ? contractsDir : undefined)
    }

    if (mqConnectionUrl) {
      const listeners = requireFile('queues/listeners')
      const rpcListeners = requireFile('queues/rpcListeners')
      builder.addQueues(mqConnectionUrl, {listeners, rpcListeners})
    }
  }
  const name = nameInput || require(path.resolve(dirname, '../package.json')).name

  return createService(name, builderFunc)
}
