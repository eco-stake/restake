import SigningClient from "./SigningClient.mjs"

export const messageTypes = [
  '/cosmos.gov.v1beta1.MsgVote',
  '/cosmos.gov.v1beta1.MsgDeposit',
  '/cosmos.gov.v1beta1.MsgSubmitProposal',
  '/cosmos.bank.v1beta1.MsgSend',
  '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward',
  '/cosmos.distribution.v1beta1.MsgWithdrawValidatorCommission',
  '/cosmos.staking.v1beta1.MsgDelegate',
  '/cosmos.staking.v1beta1.MsgUndelegate',
  '/cosmos.staking.v1beta1.MsgBeginRedelegate',
  '/cosmos.authz.v1beta1.MsgGrant',
  '/cosmos.authz.v1beta1.MsgRevoke',
  'Custom'
]

class Wallet {
  constructor(network, signer, key){
    this.network = network
    this.signingClient = SigningClient(network, signer)
    this.signer = signer
    this.key = key
    this.name = key?.name
    this.grants = []
  }

  hasPermission(address, action){
    if(address === this.address) return true
    if(this.getIsNanoLedger()) return false // Ledger Authz disabled for now

    let message = messageTypes.find(el => {
      return el.split('.').slice(-1)[0].replace('Msg', '') === action
    })
    message = message || action
    return this.grants.some(grant => {
      return grant.granter === address && 
        grant.authorization["@type"] === "/cosmos.authz.v1beta1.GenericAuthorization" &&
        grant.authorization.msg === message
    })
  }

  async getAddress(){
    this.address = this.address || await this.getAccountAddress()

    return this.address
  }

  async getAccountAddress(){
    if(this.signer.getAddress){
      return this.signer.getAddress()
    }else{
      const accounts = await this.getAccounts();
      return accounts[0].address;
    }
  }

  getAccounts(){
    return this.signer.getAccounts()
  }

  getIsNanoLedger() {
    if(!this.key) return false
    return this.key.isNanoLedger;
  }
}

export default Wallet