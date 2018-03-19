const Web3 = require('web3')
const fs = require('fs')
const path = require('path')
const context = require('./context')

const blockchain = {
  web3: {},
}

blockchain.init = (web3Url, contractsDirPath) => {
  const web3 = new Web3(new Web3.providers.HttpProvider(web3Url))
  const contracts = fs.readdirSync(contractsDirPath).reduce((obj, curr) => {
    const contractName = path.basename(curr, '.json')
    const name = `get${contractName}Contract`
    // eslint-disable-next-line
    const json = require(path.resolve(contractsDirPath, curr))
    obj[name] = contractAddress => new web3.eth.Contract(json, contractAddress)

    return obj
  }, {})
  Object.assign(blockchain, {...contracts})
  Object.assign(blockchain.web3, web3)
  context.logger.info('BLOCKCHAIN_CONNECTED_SUCCESSFULLY')
}

module.exports = blockchain
