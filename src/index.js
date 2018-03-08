const {createService} = require('./lib/createService')
const schedule = require('./lib/schedule')
const errors = require('./lib/errors')
const http = require('./lib/http')
const errorHandle = require('./utils/errorHandle')
const promiseSerial = require('./utils/promise')

const utils = {
  errorHandle,
  promiseSerial,
}

module.exports = {
  createService,
  schedule,
  errors,
  http,
  utils,
}
