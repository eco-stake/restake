export default class SignerProvider {
  suggestChainSupport = true

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
    if(this.suggestChainSupport){
      return this.provider.experimentalSuggestChain(network.suggestChain())
    }else{
      throw new Error(`${network.prettyName} is not supported`)
    }
  }

  setOptions(options){
    return {}
  }

  getOptions(){
    return {}
  }
}