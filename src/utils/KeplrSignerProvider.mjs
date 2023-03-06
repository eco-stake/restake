import _ from 'lodash'
import SignerProvider from "./SignerProvider.mjs"

export default class KeplrSignerProvider extends SignerProvider {
  key = 'keplr'
  label = 'Keplr Extension'
  keychangeEvent = 'keplr_keystorechange'

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
}