const axios = require('axios')
const HttpError = require('standard-http-error')

const http = (baseURL) => {
  const ax = axios.create({
    baseURL,
    responseType: 'json',
  })

  const errorHandle = (err) => {
    if (!err.response) {
      return Promise.reject(new HttpError(502, err.code))
    }
    const response = err.response || {}
    const errCode = response.status || 500
    const errorData = response.data || 'request failed'
    const stack = (response.data && response.data.stack) || ''
    return Promise.reject(new HttpError(errCode, errorData, {stack}))
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
