const {RpcError} = require('../errors')
const {subscriptionParameters, validateHandlerIsFunction} = require('./utils')

class RpcRouter {
  constructor() {
    this.methodHandlers = {}
  }

  /**
   * Adds a handler to respond to an RPC.
   * @param {String} baseOrMethod base name for the queue, or the name of the method
   * @param {String} methodOrHandler name of the method, or tha handler
   * @param {Function} handlerOrNothing callback to handle the request.
   *  May be sync or async
   */
  respondTo(baseOrMethod, methodOrHandler, handlerOrNothing) {
    const [methodQueue, handler] =
      subscriptionParameters(baseOrMethod, methodOrHandler, handlerOrNothing)

    validateHandlerIsFunction('RpcRouter.respondTo()', handler)

    if (this.methodHandlers[methodQueue]) {
      throw new RpcError(`handler for method ${methodOrHandler} already defined in this router`)
    }

    this.methodHandlers[methodQueue] = handler
  }
}

module.exports = RpcRouter
