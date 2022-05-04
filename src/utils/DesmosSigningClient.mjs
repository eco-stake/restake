import { profileFromAny } from "@desmoslabs/desmjs";
import SigningClient from "./SigningClient.mjs";

function DesmosSigningClient(rpcUrl, defaultGasPrice, gasModifier, signer, key) {
  return SigningClient(rpcUrl, defaultGasPrice, gasModifier, signer, key, {
    accountParser: profileFromAny,
  })
}

export default DesmosSigningClient
