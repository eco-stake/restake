export default class SignerProvider {
  constructor(provider){
    this.provider = provider
  }

  available(){
    return !!this.provider
  }

  connected(){
    return this.available()
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