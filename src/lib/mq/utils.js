const {kebabCase, camelCase} = require('lodash')
const connectionString = require('connection-string')

const requestQueueName = method => `request/${method}`
const responseQueueName = (method, id) => `response/${id}/${method}`

const makeHeaderParser = keyMapper => headers =>
  Object.keys(headers).reduce((acc, key) => {
    acc[keyMapper(key)] = headers[key]
    return acc
  }, {})

const toStompHeaders = makeHeaderParser(kebabCase)
const fromStompHeaders = makeHeaderParser(camelCase)

const stripSlash = method => (method[0] === '/' ? method.substr(1) : method)

const parseConnectionString = (path) => {
  const {
    hostname: host,
    port = 61613,
    user: login,
    password: passcode,
  } = connectionString(path)
  return {host, port, connectHeaders: {login, passcode}}
}

const toConnectionConfig = configOrConnectionString =>
  (typeof configOrConnectionString === 'string'
    ? parseConnectionString(configOrConnectionString)
    : configOrConnectionString)

module.exports = {
  requestQueueName,
  responseQueueName,
  toStompHeaders,
  fromStompHeaders,
  stripSlash,
  toConnectionConfig,
}
