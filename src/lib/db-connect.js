const Sequelize = require('sequelize')
const {loggers: {logger}} = require('@welldone-software/node-toolbelt')
const {promisify} = require('util')

const asyncTimeout = promisify(setTimeout)

const db = {}

const connect = async (pgurl = null, sequelizeModels) => {
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

const dbInit = async (pgurl = null, dbModel) => {
  try {
    return await connect(pgurl, dbModel)
  } catch (error) {
    logger.error(error)
    await asyncTimeout(30000)
    logger.info('retrying...')
    return dbInit(pgurl)
  }
}

db.dbInit = dbInit

module.exports = db
