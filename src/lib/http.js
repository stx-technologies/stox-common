const axios = require('axios')
const {exceptions: {UnexpectedError}} = require('@welldone-software/node-toolbelt')

const http = (baseURL, errorMsg = 'request failed') => {
  const ax = axios.create({
    baseURL,
    responseType: 'json',
  })
  const errorHandle = (err) => {
    const error = Object.assign(err, {
      config: undefined,
      request: undefined,
      response: err.response && err.response.data,
    })

    return Promise.reject(new UnexpectedError(errorMsg, error))
  }

  return ['post', 'get', 'delete', 'put'].reduce((caller, method) => {
    caller[method] = (...args) =>
      ax[method](...args)
        .then(res => res.data)
        .catch(errorHandle)
    return caller
  }, {})
}

module.exports = http
