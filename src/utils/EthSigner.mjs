import * as BytesUtils from "@ethersproject/bytes";
import { keccak256 } from "@ethersproject/keccak256";
import { encodeSecp256k1Signature } from '@cosmjs/amino';
import { makeSignBytes } from "@cosmjs/proto-signing";

function EthSigner(signer, ethSigner){
  async function signDirect(_address, signDoc){
    const signature = await ethSigner
      ._signingKey()
      .signDigest(keccak256(makeSignBytes(signDoc)));
    const splitSignature = BytesUtils.splitSignature(signature);
    const result = BytesUtils.arrayify(
      BytesUtils.concat([splitSignature.r, splitSignature.s])
    );
    const pubkey = (await getAccounts())[0].pubkey
    return {
      signed: signDoc,
      signature: encodeSecp256k1Signature(pubkey, result)
    }
  }

  function getAccounts(){
    return signer.getAccounts()
  }

  return {
    signer,
    ethSigner,
    signDirect,
    getAccounts
  }
}

export default EthSigner