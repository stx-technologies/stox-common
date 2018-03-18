const Sequelize = require('sequelize')
const {promisify} = require('util')
const context = require('./context')

const asyncTimeout = promisify(setTimeout)

const db = {}

const connect = async (pgurl = null, sequelizeModels) => {
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

  sequelizeModels(sequelizeInstance)

  db.sequelize = sequelizeInstance

  Object.assign(db, sequelizeInstance.models)
}
let retryCount = 0
const dbInit = async (pgurl = null, dbModel) => {
  const {logger} = context
  const maxRetries = 20
  try {
    return await connect(pgurl, dbModel)
  } catch (error) {
    logger.error(error)
    retryCount++

    if (maxRetries < retryCount) {
      throw error
    } else {
      await asyncTimeout(3000)
      logger.info('retrying...')
      return dbInit(pgurl, dbModel)
    }
  }
}

db.dbInit = dbInit

module.exports = db
