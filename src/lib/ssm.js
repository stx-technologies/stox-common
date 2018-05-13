const awsParamStore = require('aws-param-store')
const dotenv = require('dotenv')
const {forEach, reject, find, camelCase} = require('lodash')

const newQuery = async (path, region) => awsParamStore.newQuery(path, {region}).execute()

const getEnvForService = async (name, env, region) => {
  if (!name || !env || !region) {
    throw new Error('name, env or region cannot be empty ')
  }

  const envVars = []
  const envKey = `/BC/${env.toUpperCase()}`
  const serviceKey = `${envKey}/${name.toUpperCase()}/CONFIG`
  const parameters = await newQuery(envKey, region)

  if (!parameters.length) {
    throw new Error(`no parameters in parameters store for name '${envKey}'`)
  }

  const serviceParams = find(parameters, p => p.Name === serviceKey)

  if (!serviceParams) {
    throw new Error(`no parameters in parameters store for name '${serviceKey}'`)
  }

  if (serviceParams) {
    const envParams = reject(parameters, p => p.Name === serviceKey)
    const params = dotenv.parse(serviceParams.Value)
    const getName = param =>
      param.Name.split('/')
        .slice(-1)
        .pop()

    forEach(params, (value, key) => {
      const parameter = find(envParams, e => getName(e) === key)
      const configKey = camelCase(key)
      if (!envVars[configKey]) {
        envVars[configKey] = parameter ? parameter.Value : value
      }
    })
  }

  return envVars
}

module.exports = {getEnvForService}
