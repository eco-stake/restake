import SignerProvider from "./SignerProvider.mjs"

export default class LeapSignerProvider extends SignerProvider {
  key = 'leap'
  label = 'Leap Wallet'
  keychangeEvent = 'leap_keystorechange'
  suggestChainSupport = true

  enable(network){
    if (network.gasPricePrefer) {
      this.setOptions({
        sign: { preferNoSetFee: true }
      })
    }
    return super.enable(network)
  }

  suggestChain(network){
    throw new Error(`${network.prettyName} (${network.chainId}) is not supported`)
  }

  setOptions(options){
    return this.provider.defaultOptions = options
  }

  getOptions(){
    return this.provider.defaultOptions
  }
}