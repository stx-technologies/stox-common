const blockchain = require('./lib/blockchain')
const db = require('./lib/db-connect')
const {initServer} = require('./lib/init-server')

module.exports = {
  initServer,
  blockchain,
  db,
}
