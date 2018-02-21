const {loggers: {logger}} = require('@welldone-software/node-toolbelt')
const {assignWith} = require('lodash')

const assignWithCustomizer = (objValue, srcValue) =>
  (objValue === undefined ? srcValue : objValue)

class DbError extends Error {
  constructor(baseError) {
    super(baseError)
    this.original = baseError.original
  }
  toJSON() {
    return assignWith(
      {
        name: this.constructor.name,
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
  if (err.toJSON) {
    return err.toJSON()
  } else if (err instanceof Error) {
    return assignWith(
      {
        name: err.name || err.constructor.name,
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

const logError = (err) => {
  const error = errSerializer(err)
  delete error.code
  logger.error(error)
}

module.exports = {
  logError,
  DbError,
}
