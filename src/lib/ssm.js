const awsParamStore = require('aws-param-store')
const dotenv = require('dotenv')
const {forEach, reject, find, camelCase} = require('lodash')

const newQuery = async (path, region) => awsParamStore.newQuery(path, {region}).execute()

const getEnvForService = async (name, subsystemName, env, region) => {
  if (!name || !env || !region) {
    throw new Error('name, env or region cannot be empty ')
  }

  const envVars = []
  const envKey = `/BC/${env.toUpperCase()}`
  const serviceKey = `${envKey}/${name.toUpperCase()}/CONFIG`
  const parameters = await newQuery(envKey, region)

  console.log({parameters})

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

    forEach(params, (value, key) => {
      const parameter = find(envParams, e => {
        const subsystemKey = `${subsystemName.toUpperCase()}/${key}`
        const idx1 = e.Name.indexOf(subsystemKey)
        if (idx1 !== -1) {
          return e.Name.substr(idx1) === subsystemKey
        }

        return e.Name.split('/').slice(-1).pop() === key
      })
      const configKey = camelCase(key)

      if (!envVars[configKey]) {
        envVars[configKey] = parameter ? parameter.Value : value
      }
    })
  }

  console.log({config: envVars})

  return envVars
}

module.exports = {getEnvForService}
