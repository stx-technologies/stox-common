const awsParamStore = require('aws-param-store')
const dotenv = require('dotenv')
const {forEach, reject, find, camelCase} = require('lodash')

const newQuery = async (path, region) => awsParamStore.newQuery(path, {region}).execute()

const getEnvForService = async (name, subsystemName, env, region) => {
  if (!name || !env || !region) {
    throw new Error('name, env or region cannot be empty ')
  }

  const config = []
  const envKey = `/BC/${env.toUpperCase()}`
  const subsystemKey = `${envKey}/${subsystemName.toUpperCase()}`
  const serviceKey = `${envKey}/${name.toUpperCase()}/CONFIG`
  const parameters = await newQuery(envKey, region)

  if (!parameters.length) {
    throw new Error(`no parameters in parameters store for '${envKey}'`)
  }

  const serviceParams = find(parameters, p => p.Name === serviceKey)

  if (!serviceParams) {
    throw new Error(`no parameters in parameters store for '${serviceKey}'`)
  }

  const envParams = reject(parameters, p => p.Name === serviceKey)
  const parsedServiceParams = dotenv.parse(serviceParams.Value)

  forEach(parsedServiceParams, (value, key) => {
    const serviceSubsystemKey = `${subsystemKey}/${key}`
    let parameter = envParams.find(p => p.Name === serviceSubsystemKey)

    if (!parameter) {
      parameter = envParams.find(p => p.Name.split('/').splice(-1).pop() === key)
    }

    const configKey = camelCase(key)
    const configValue = parameter ? parameter.Value : value

    if (!config[configKey]) {
      config[configKey] = configValue.replace(/(\r\n\t|\n|\r\t)/gm, '')
    }
  })

  return config
}

module.exports = {getEnvForService}
