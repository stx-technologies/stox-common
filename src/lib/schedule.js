const schedule = require('node-schedule')
const {loggers: {logger}} = require('@welldone-software/node-toolbelt')
const {logError} = require('./errors')

const jobs = {}
const scheduleJob = (name, spec, func) => {
  logger.info({name, spec}, 'STARTED')

  let promise = null
  const job = jobs[name]

  if (!job) {
    jobs[name] = schedule.scheduleJob(spec, async () => {
      if (!promise) {
        logger.info({name}, 'IN_CYCLE')

        promise = func()
          .then(() => {
            promise = null
          })
          .catch((e) => {
            logError(e)
            promise = null
          })
      }
    })
  }
}

const cancelJob = (name) => {
  const job = jobs[name]

  if (job) {
    logger.info({name}, 'STOPPED')
    job.cancel()
  }
}

module.exports = {
  scheduleJob,
  cancelJob,
}
