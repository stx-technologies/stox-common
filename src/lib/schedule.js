const schedule = require('node-schedule')
const {logError} = require('./errors')
const context = require('./context')

const jobs = {}
const scheduleJob = (name, spec, func) => {
  let promise = null
  const job = jobs[name]
  context.logger.info({job: name}, 'JOB_STARTED')

  if (!job) {
    jobs[name] = schedule.scheduleJob(spec, async () => {
      if (!promise) {
        context.logger.info('JOB_IN_CYCLE')

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
    context.logger.info({name}, 'JOB_STOPPED')
    job.cancel()
  }
}

module.exports = {
  scheduleJob,
  cancelJob,
}
