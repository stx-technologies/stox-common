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
  const get = (url, params = {}) => {
    const query =
      Object.entries(params).reduce((str, [key, value]) => `${str}${str && '&'}${key}=${value}`, '')
    return ax.get(`${url}${query && '?'}${query}`)
      .then(res => res.data)
      .catch(errorHandle)
  }

  return ['post', 'delete', 'put'].reduce((caller, method) => {
    if (!(method in caller)) {
      caller[method] = (...args) =>
        ax[method](...args)
          .then(res => res.data)
          .catch(errorHandle)
    }
    return caller
  }, {get})
}

module.exports = http
