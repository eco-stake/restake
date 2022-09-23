import WalletConnect from "@walletconnect/client";
import { KeplrWalletConnectV1 } from "@keplr-wallet/wc-client";

import SignerProvider from "./SignerProvider.mjs"

export default class KeplrMobileSignerProvider extends SignerProvider {
  key = 'keplr-mobile'
  label = 'Keplr Mobile'
  keychangeEvent = 'keplr_keystorechange'

  constructor({ qrcodeModal }){
    super()
    this.qrcodeModal = qrcodeModal
    this.connector = new WalletConnect({
      bridge: "https://bridge.walletconnect.org", // Required
      signingMethods: [
        "keplr_enable_wallet_connect_v1",
        "keplr_sign_amino_wallet_connect_v1",
      ],
      qrcodeModal: this.qrcodeModal,
    });
  }

  available(){
    return true
  }

  connected(){
    return this.connector.connected
  }

  suggestChain(network){
  }

  async enable(network){
    await this.createSession()
    await this.provider.enable(network.chainId)
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
            this.provider = new KeplrWalletConnectV1(this.connector);
            resolve();
          }
        });
      });
    } else {
      this.provider = new KeplrWalletConnectV1(this.connector);
      return Promise.resolve(this.provider);
    }
  }
}