const Sequelize = require('sequelize')
const {loggers: {logger}} = require('@welldone-software/node-toolbelt')
const {promisify} = require('util')

const asyncTimeout = promisify(setTimeout)

const connect = async (pgurl = null, sequelizeModels, db) => {
  logger.info('initializing database connection...')

  if (db.sequelize) {
    throw new Error('database already initialized.')
  }

  const sequelizeInstance = new Sequelize(pgurl, {
    pool: {
      max: 5,
      min: 0,
      acquire: 60000,
      idle: 10000,
    },
    logging: false,
  })

  await sequelizeInstance.authenticate()
  logger.info('database connection established successfully.')

  sequelizeModels(sequelizeInstance)

  db.sequelize = sequelizeInstance

  Object.assign(db, sequelizeInstance.models)
}
let retryCount = 0
const dbInit = async (pgurl = null, dbModel, db) => {
  const maxRetries = 20
  try {
    return await connect(pgurl, dbModel, db)
  } catch (error) {
    logger.error(error)
    retryCount++

    if (maxRetries < retryCount) {
      throw error
    } else {
      await asyncTimeout(3000)
      logger.info('retrying...')
      return dbInit(pgurl, dbModel, db)
    }
  }
}

module.exports = dbInit
