const {createService} = require('./lib/createService')
const schedule = require('./lib/schedule')
const errors = require('./lib/errors')
const http = require('./lib/http')
const errorHandle = require('./utils/errorHandle')
const promiseSerial = require('./utils/promise')

const utils = {
  createService,
  schedule,
  errors,
  http,
  errorHandle,
  promiseSerial,
}

module.exports = {
  utils,
}
