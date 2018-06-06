const axios = require('axios')
const HttpError = require('standard-http-error')

const http = (baseURL) => {
  const ax = axios.create({
    baseURL,
    responseType: 'json',
  })

  const errorHandle = (err) => {
    if (err.code === 'ECONNREFUSED') {
      return Promise.reject(new HttpError(502, 'ECONNREFUSED'))
    }
    const response = err.response || {}
    const errCode = response.status || 500
    const errorMsg = (response.data && response.data.message) || 'request failed'
    const stack = (response.data && response.data.stack) || ''
    return Promise.reject(new HttpError(errCode, errorMsg, {stack}))
  }
  const get = (url, params = {}) => {
    const query =
      Object.entries(params).reduce((str, [key, value]) => `${str}${str && '&'}${key}=${value}`, '')
    return ax.get(`${url}${query && '?'}${query}`)
      .then(res => res.data)
      .catch(errorHandle)
  }

  return ['post', 'delete', 'put'].reduce((caller, method) => {
    caller[method] = (...args) =>
      ax[method](...args)
        .then(res => res.data)
        .catch(errorHandle)
    return caller
  }, {get})
}

module.exports = http
