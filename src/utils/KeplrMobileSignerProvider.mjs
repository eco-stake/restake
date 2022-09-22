import { Keplr } from "@keplr-wallet/types";
import WalletConnect from "@walletconnect/client";
import { KeplrQRCodeModalV1 } from "@keplr-wallet/wc-qrcode-modal";
import { KeplrWalletConnectV1 } from "@keplr-wallet/wc-client";

import SignerProvider from "./SignerProvider.mjs"

export default class KeplrMobileSignerProvider extends SignerProvider {
  key = 'keplr-mobile'
  label = 'Keplr Mobile'
  keychangeEvent = 'keplr_keystorechange'

  connected(){
    return true
  }

  suggestChain(network){
  }

  async enable(network){
    const connector = new WalletConnect({
      bridge: "https://bridge.walletconnect.org", // Required
      signingMethods: [
        "keplr_enable_wallet_connect_v1",
        "keplr_sign_amino_wallet_connect_v1",
      ],
      qrcodeModal: new KeplrQRCodeModalV1(),
    });

    // Check if connection is already established
    if (!connector.connected) {
      // create new session
      connector.createSession();

      return new Promise((resolve, reject) => {
        connector.on("connect", (error) => {
          if (error) {
            reject(error);
          } else {
            this.provider = new KeplrWalletConnectV1(connector);
            resolve(this.provider);
          }
        });
      });
    } else {
      this.provider = new KeplrWalletConnectV1(connector);
      return Promise.resolve(this.provider);
    }
  }
}