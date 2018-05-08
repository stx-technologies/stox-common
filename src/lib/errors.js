const serviceContext = require('./context')
const {assignWith} = require('lodash')

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

const logError = (err) => {
  const error = errSerializer(err)
  delete error.code
  serviceContext.logger.error(error)
}

module.exports = {
  logError,
  DbError,
  RpcError,
  errSerializer,
}
