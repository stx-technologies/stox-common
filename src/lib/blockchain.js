const Web3 = require('web3')
const fs = require('fs')
const path = require('path')
const context = require('./context')
const HttpProvider = require('./http-provider')

const blockchain = {
  web3: {},
}

blockchain.init = (web3Url, contractsDirPath, contractsBinDirPath) => {
  const web3 = new Web3(new HttpProvider(web3Url))
  Object.assign(blockchain.web3, web3)

  if (contractsDirPath) {
    const contracts = fs.readdirSync(contractsDirPath).reduce((obj, curr) => {
      const contractName = path.basename(curr, '.json')
      const name = `get${contractName}Contract`
      // eslint-disable-next-line
      const json = require(path.resolve(contractsDirPath, curr))
      obj[name] = contractAddress => new web3.eth.Contract(json, contractAddress)

      return obj
    }, {})
    Object.assign(blockchain, {...contracts})
  }

  if (contractsBinDirPath) {
    const contracts = fs.readdirSync(contractsBinDirPath).reduce((obj, curr) => {
      const contractName = path.basename(curr, '.bin')
      const name = `get${contractName}ContractBin`
      // eslint-disable-next-line
      const binary = fs.readFileSync(path.resolve(contractsBinDirPath, curr), {encoding: 'utf8'}).trim()
      obj[name] = () => binary

      return obj
    }, {})
    Object.assign(blockchain, {...contracts})
  }

  context.logger.info('BLOCKCHAIN_CONNECTED_SUCCESSFULLY')
}

module.exports = blockchain
