const {assignWith} = require('lodash')
const {loggers: {logger}} = require('@welldone-software/node-toolbelt')

const assignWithCustomizer = (objValue, srcValue) => (objValue === undefined ? srcValue : objValue)

const errSerializer = err =>
  (err instanceof Error
    ? assignWith(
      {
        name: err.name || err.constructor.name,
        message: err.message,
        stack: err.stack,
        context: err.context,
      },
      err.original || err,
      assignWithCustomizer
    )
    : err)

const logError = (err) => {
  const error = errSerializer(err)
  delete error.code
  logger.error(error)
}

module.exports = {
  logError,
}
