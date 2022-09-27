import SignerProvider from "./SignerProvider.mjs"

export default class LeapSignerProvider extends SignerProvider {
  key = 'leap'
  label = 'Leap Wallet'
  keychangeEvent = 'leap_keystorechange'

  enable(network){
    if (network.gasPricePrefer) {
      this.setOptions({
        sign: { preferNoSetFee: true }
      })
    }
    return super.enable(network).then(result => {
      // Leap returns error instead of throwing
      if(result instanceof Error){
        throw result
      }
    })
  }

  suggestChain(network){
    throw new Error(`${network.prettyName} is not supported currently`)
  }

  setOptions(options){
    return this.provider.defaultOptions = options
  }

  getOptions(){
    return this.provider.defaultOptions
  }
}