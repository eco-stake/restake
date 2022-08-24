import SignerProvider from "./SignerProvider.mjs";

export default class FalconSignerProvider extends SignerProvider {
  enable(network){
    const { chainId } = network
    return this.provider.connect(chainId)
  }

  suggestChain(network){
    return this.provider.importZone(network.suggestChain())
  }
}