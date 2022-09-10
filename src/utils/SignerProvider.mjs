export default class SignerProvider {
  constructor(provider){
    this.provider = provider
  }

  connected(){
    return !!this.provider
  }

  enable(network){
    const { chainId } = network
    return this.provider.enable(chainId)
  }

  getSigner(network){
    const { chainId } = network
    return this.provider.getOfflineSignerAuto(chainId)
  }

  getKey(network){
    const { chainId } = network
    return this.provider.getKey(chainId)
  }

  suggestChain(network){
    return this.provider.experimentalSuggestChain(network.suggestChain())
  }

  setOptions(options){
    return {}
  }

  getOptions(){
    return {}
  }
}