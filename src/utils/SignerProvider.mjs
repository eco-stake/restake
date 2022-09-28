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

  async connect(network){
    try {
      await this.enable(network)
      return await this.getKey(network)
    } catch (e) {
      try {
        await this.suggestChain(network)
        return await this.getKey(network)
      } catch (s) {
        throw(e)
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
    return this.provider.experimentalSuggestChain(network.suggestChain())
  }

  setOptions(options){
    return {}
  }

  getOptions(){
    return {}
  }
}