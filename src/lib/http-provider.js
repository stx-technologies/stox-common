const HttpError = require('standard-http-error')
const web3 = require('web3')
const {errors} = require('web3-core-helpers')

const {HttpProvider} = web3.providers

class FixedHttpProvider extends HttpProvider {

  send(payload, callback) {
    const _this = this
    const request = this._prepareRequest()

    request.onreadystatechange = function () {
      if (request.readyState === 4 && request.timeout !== 1) {
        let result = request.responseText
        let error = null
        if (request.status === 0 || request.status >= 400) {
          _this.connected = false
          error = new HttpError(request.status, {responseText: result, reason: 'bcNodeError'})
        } else {
          try {
            result = JSON.parse(result)
          } catch (e) {
            error = errors.InvalidResponse(request.responseText)
          }
          _this.connected = true
        }
        callback(error, result)
      }
    }

    request.ontimeout = function () {
      _this.connected = false
      callback(errors.ConnectionTimeout(this.timeout))
    }

    try {
      request.send(JSON.stringify(payload))
    } catch (error) {
      this.connected = false
      callback(errors.InvalidConnection(this.host))
    }
  }
}


module.exports = FixedHttpProvider
