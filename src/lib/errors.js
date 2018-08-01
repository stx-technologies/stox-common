const serviceContext = require('./context')
const {assignWith} = require('lodash')
const HttpError = require('standard-http-error')
const {escapeRegExp} = require('lodash')

const stackFileRegex = new RegExp(`${escapeRegExp(process.cwd())}`, 'ig')

const assignWithCustomizer = (objValue, srcValue) => (objValue === undefined ? srcValue : objValue)

class DbError extends Error {
  constructor(baseError) {
    super(baseError)
    this.original = baseError.original
  }
  toJSON() {
    return assignWith(
      {
        name: serviceContext.serviceName,
        errorName: this.constructor.name,
        message: this.message,
        stack: this.stack,
        context: this.context,
      },
      this.original,
      assignWithCustomizer
    )
  }
}

const errSerializer = (err) => {
  if (err && err.toJSON) {
    return err.toJSON()
  } else if (err instanceof Error) {
    return assignWith(
      {
        name: serviceContext.serviceName,
        errorName: err.name || err.constructor.name,
        message: err.message,
        stack: err.stack,
        context: err.context,
      },
      err.original || err,
      assignWithCustomizer
    )
  }

  return err
}

class RpcError extends Error {
  constructor(msg, context) {
    super(msg)
    this.context = context
  }
}

const logError = (err, msg) => {
  const error = errSerializer(err)
  serviceContext.logger.error(error, msg)
}

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const status =
    err.httpErrorCode ||
    err.status ||
    (err instanceof HttpError && err.code) ||
    500
  res.status(status).send({
    ...err,
    message: err.message,
    stack:
      process.env.NODE_ENV === 'production'
        ? undefined
        : (err.stack || '').replace(stackFileRegex, ''),
  })
  res.emit('error', err) // pino.js handle error log in this way
}

module.exports = {
  logError,
  DbError,
  RpcError,
  errSerializer,
  errorHandler,
}
