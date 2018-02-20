const express = require('express')
const compression = require('compression')
const bodyParser = require('body-parser')
const expressStatusMonitor = require('express-status-monitor')
const {
  loggers: {logger, expressLogger},
  expressHelpers: {errorHandler},
} = require('@welldone-software/node-toolbelt')
const fallback = require('express-history-api-fallback')
const lusca = require('lusca')
const cors = require('cors')
const {dbInit} = require('./db-connect')

const initExpress = (app, apiRouter, enableCors = false, clientRoot) => {
  if (enableCors) {
    app.use(cors({credentials: true, origin: true}))
  }
  app.use(compression())
  app.use(bodyParser.json())
  app.use(expressLogger())
  if (clientRoot) {
    app.use(lusca.xframe('SAMEORIGIN'))
    app.use(lusca.xssProtection(true))
  }
  app.set('trust proxy', 'loopback')
  app.disable('x-powered-by')
  app.use('/api/v1', apiRouter)
  if (clientRoot) {
    app.use(express.static(clientRoot))
    app.use(fallback('index.html', {root: clientRoot}))
  }
  app.use(expressStatusMonitor())
  app.use(errorHandler)
}

const initServer = async (port, databaseUrl, apiRouter, dbModel) => {
  const app = express()
  initExpress(app, apiRouter)
  await dbInit(databaseUrl, dbModel)
  return new Promise((resolve, reject) => {
    try {
      const server = app.listen(port, () => {
        logger.info({binding: server.address()}, 'http server started')
        resolve(app)
      })
    } catch (e) {
      logger.error(e)
      reject(e)
    }
  })
}

module.exports = {
  initServer,
  initExpress,
}
