import SignerProvider from "./SignerProvider.mjs";

export default class FalconSignerProvider extends SignerProvider {
  key = 'falcon'
  label = 'Falcon Wallet'

  enable(network){
    const { chainId } = network
    return this.provider.connect(chainId)
  }

  suggestChain(network){
    return this.provider.importZone(network.suggestChain())
  }
}