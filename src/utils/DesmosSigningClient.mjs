import { profileFromAny } from "@desmoslabs/desmjs";
import SigningClient from "./SigningClient.mjs";

function DesmosSigningClient(rpcUrl, defaultGasPrice, signer, key) {
  return SigningClient(rpcUrl, defaultGasPrice, signer, key, {
    accountParser: profileFromAny,
  })
}

export default DesmosSigningClient
