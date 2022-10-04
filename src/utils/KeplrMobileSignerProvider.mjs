import WalletConnect from "@walletconnect/client";
import { KeplrWalletConnectV1 } from "@keplr-wallet/wc-client";

import SignerProvider from "./SignerProvider.mjs"

export default class KeplrMobileSignerProvider extends SignerProvider {
  key = 'keplr-mobile'
  label = 'Keplr Mobile'
  keychangeEvent = 'keplr_keystorechange'
  suggestChainSupport = false

  constructor({ connectModal }) {
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
  }

  available() {
    return true
  }

  connected() {
    return this.connector.connected
  }

  async connect(network) {
    let key
    try {
      this.connectModal.open()
      key = await super.connect(network)
      this.connectModal.close()
      return key
    } catch (error) {
      this.connectModal.close()
      throw(error)
    }
  }

  async enable(network) {
    await this.createSession()
    await this.provider.enable(network.chainId)
  }

  async disconnect() {
    return this.provider?.clearSaved()
  }

  async forceDisconnect() {
    try {
      this.disconnect()
      this.connector.killSession()
    } catch (error) {
      console.log(error)
    }
  }

  getSigner(network) {
    const { chainId } = network
    // return this.provider.getOfflineSignerAuto(chainId) // no signDirect support currently
    return this.provider.getOfflineSignerOnlyAmino(chainId)
  }

  async createSession() {
    if (!this.connector.connected) {
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
      return Promise.resolve();
    }
  }
}