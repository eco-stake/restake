import SignerProvider from "./SignerProvider.mjs"

export default class KeplrSignerProvider extends SignerProvider {
  enable(network){
    if (network.gasPricePrefer) {
      this.setOptions({
        sign: { preferNoSetFee: true }
      })
    }
    return super.enable(network)
  }

  setOptions(options){
    return this.provider.defaultOptions = options
  }

  getOptions(){
    return this.provider.defaultOptions
  }
}