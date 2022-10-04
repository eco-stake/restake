export default class SignerProvider {
  suggestChainSupport = true

  constructor(provider){
    this.provider = provider
  }

  available(){
    return !!this.provider
  }

  connected(){
    return this.available()
  }

  async connect(network){
    try {
      await this.enable(network)
      return await this.getKey(network)
    } catch (e) {
      if(!this.suggestChainSupport){
        throw(e)
      }
      try {
        await this.suggestChain(network)
        return await this.getKey(network)
      } catch (s) {
        throw(s)
      }
    }
  }

  disconnect(){
  }

  enable(network){
    const { chainId } = network
    return this.provider.enable(chainId)
  }

  getKey(network){
    const { chainId } = network
    return this.provider.getKey(chainId)
  }

  getSigner(network){
    const { chainId } = network
    return this.provider.getOfflineSignerAuto(chainId)
  }

  suggestChain(network){
    if(this.suggestChainSupport){
      return this.provider.experimentalSuggestChain(network.suggestChain())
    }else{
      throw new Error(`${network.prettyName} (${network.chainId}) is not supported`)
    }
  }

  setOptions(options){
    return {}
  }

  getOptions(){
    return {}
  }
}