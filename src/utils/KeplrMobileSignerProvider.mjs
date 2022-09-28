import WalletConnect from "@walletconnect/client";
import { KeplrWalletConnectV1 } from "@keplr-wallet/wc-client";

import SignerProvider from "./SignerProvider.mjs"

export default class KeplrMobileSignerProvider extends SignerProvider {
  key = 'keplr-mobile'
  label = 'Keplr Mobile'
  keychangeEvent = 'keplr_keystorechange'

  constructor({ connectModal }){
    super()
    this.connectModal = connectModal
    this.connector = new WalletConnect({
      bridge: "https://bridge.walletconnect.org", // Required
      signingMethods: [
        "keplr_enable_wallet_connect_v1",
        "keplr_sign_amino_wallet_connect_v1",
      ],
      qrcodeModal: this.connectModal,
    });
    this.provider = new KeplrWalletConnectV1(this.connector);
  }

  available(){
    return true
  }

  connected(){
    return this.connector.connected
  }

  suggestChain(network){
    throw new Error(`${network.prettyName} (${network.chainId}) is not supported`)
  }

  async enable(network){
    this.connectModal.open()
    try {
      await this.createSession()
      await this.provider.enable(network.chainId)
    } finally {
      this.connectModal.close()
    }
  }

  async disconnect(){
    return this.provider?.clearSaved()
  }

  async forceDisconnect(){
    try {
      this.disconnect()
      this.connector.killSession()
    } catch (error) {
      console.log(error)
    }
  }

  getSigner(network){
    const { chainId } = network
    // return this.provider.getOfflineSignerAuto(chainId) // no signDirect support currently
    return this.provider.getOfflineSignerOnlyAmino(chainId)
  }

  async createSession(){
    // Check if connection is already established
    if (!this.connector.connected) {
      // create new session
      this.connector.createSession();

      return new Promise((resolve, reject) => {
        this.connector.on("connect", (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    } else {
      return Promise.resolve();
    }
  }
}