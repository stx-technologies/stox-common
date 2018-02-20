const Web3 = require('web3')
const fs = require('fs')
const path = require('path')
const {promisify} = require('util')

const asyncReaddir = promisify(fs.readdir)
const blockchain = {
  web3: {},
}

blockchain.initBlockchain = async (web3Url, contractsDir) => {
  const web3 = new Web3(new Web3.providers.HttpProvider(web3Url))
  Object.assign(blockchain.web3, web3)
  const files = await asyncReaddir(contractsDir)
  files.forEach((curr) => {
    const contractName = path.basename(curr, '.json')
    const name = `get${contractName}Contract`
    // eslint-disable-next-line
    const json = require(path.resolve(contractsDir, curr))
    blockchain[name] = contractAddress =>
      new blockchain.web3.eth.Contract(json, contractAddress)
  })
}

module.exports = blockchain
