import _ from 'lodash'
import SignerProvider from "./SignerProvider.mjs"

export default class LeapSignerProvider extends SignerProvider {
  key = 'leap'
  label = 'Leap Wallet'
  keychangeEvent = 'leap_keystorechange'
  suggestChainSupport = false

  enable(network){
    this.setOptions({
      sign: { preferNoSetFee: true }
    })
    return super.enable(network)
  }

  setOptions(options){
    return _.merge(this.provider.defaultOptions, options)
  }

  getOptions(){
    return this.provider.defaultOptions
  }

  handleEnableError(network, error){
    switch (error?.message) {
      case `Invalid chain id`:
        throw new Error(`${network.prettyName} (${network.chainId}) is not supported`)
      default:
        super.handleEnableError(network, error)
    }
  }
}