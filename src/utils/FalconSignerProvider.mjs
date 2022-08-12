import SignerProvider from "./SignerProvider.mjs";

export default class FalconSignerProvider extends SignerProvider {
  enable(network){
    const { chainId } = network
    return this.provider.connect(chainId)
  }

  getSigner(network){
    const { chainId } = network
    return this.provider.getOfflineSigner(chainId)
  }

  getKey(network){
  }

  suggestChain(network){
    return this.provider.importZone(network.suggestChain())
  }
}