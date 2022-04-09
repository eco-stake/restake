import React, { useEffect } from 'react';
import {
  Modal
} from 'react-bootstrap'

import { useSearchParams } from 'react-router-dom'

function AboutLedger(props) {
  let [searchParams, setSearchParams] = useSearchParams();
  const aboutParam = searchParams.get('about')

  const { network, validator } = props
  const { daemon_name, chain_id, node_home, codebase } = network.chain.chainData
  const { git_repo, binaries } = codebase || {}

  const address = validator?.restake.address || <kbd>GrantAddress</kbd>

  const show = props.show || (aboutParam == 'ledger' && network.authzSupport)

  useEffect(() => {
    if (show && !aboutParam) {
      setSearchParams({ about: 'ledger' })
    }
  }, [show, aboutParam]);

  function onHide(){
    setSearchParams({})
    props.onHide()
  }

  const content = (
    <>
      <h5>How to use a Ledger with {validator ? validator.name : 'REStake'}</h5>
      <p>Right now there is a limitation in Cosmos SDK which prevents using a Ledger device with the REStake UI. It is possible though to send a slightly modified version of the grants using the {network.prettyName} CLI client.</p>
      <p>The commands needed are detailed below thanks to the awesome <a href="https://twitter.com/gjermundbjaanes" target="_blank">@gjermundbjaanes</a> who put together <a href="https://gjermund.tech/blog/making-ledger-work-on-restake/" target="_blank">a more detailed guide and CLI tool</a> to make the process easier.</p>
      <p>{!validator ? <span>You can find <strong>validator specific instructions</strong> in a tab on the validator's page, with their REStake address pre-filled.</span> : `${validator.name}'s REStake address has been pre-filled below.`} Instructions are specific to the Network you have selected.</p>
      <p><strong>You should only attempt this if you have a basic understanding of using a command line tool.</strong></p>
      <h5>Download CLI client for {network.prettyName}</h5>
      <p>Skip this step if you've already installed <code>{daemon_name || network.prettyName}</code>.</p>
      {
        binaries && (
          <>
            <h6>Install from pre-built binaries</h6>
            <p>Download one of the pre-built binaries and use that instead of building from source.</p>
            <p>The binary <strong>may not have been built with ledger support</strong> so you might still need the source method.</p>
            <p>
              {Object.entries(binaries).map(([key, item]) => {
                return (
                  <span key={key}><strong>{key}:</strong> <a href={item} target="_blank">{item}</a><br /></span>
                )
              })}</p>
            <h6>Alternative install from source</h6>
          </>
        )
      }
      {
        git_repo
          ? (
            <>
              <p>Clone and install the <code>{daemon_name || network.prettyName}</code> CLI client from <a href={git_repo} target="_blank">{git_repo}</a>. The standard Tendermint installation process is detailed below, but you might need to check the documentation for project specific install.</p>
              <pre className="pre-scrollable text-wrap"><code>
                <p>git clone {git_repo} restake_{network.name}</p>
                <p>cd restake_{network.name}</p>
                <p>make install</p>
              </code></pre>
            </>
          ) : (
            <p>Download and install the <code>{daemon_name || network.prettyName}</code> CLI client from the project's documentation.</p>
          )
      }
      <h5>Add Ledger as a key</h5>
      <p>Skip this step if you already have your ledger setup with <code>{daemon_name || network.prettyName}</code>.</p>
      <p>Add your Ledger as a new key. The below example will use the key name <kbd>ledger</kbd> and the default install directory{node_home ? <>(<code>{node_home}</code>)</> : ''}.</p>
      <p>Make sure your Ledger is plugged in, unlocked and the Cosmos app is open.</p>
      <pre className="text-wrap"><code>
        <p>{daemon_name ? daemon_name : <kbd>DaemonName</kbd>} keys add <kbd>ledger</kbd> --ledger --keyring-backend file</p>
      </code></pre>
      <h5>Grant permission to withdraw delegator rewards</h5>
      <p>Next you need to grant the first of two permissions required for REStake to function. This is the <code>WithdrawDelegatorReward</code> grant and is identical to the one the REStake UI would set.</p>
      {!validator && <p>Make sure you enter your validator's REStake address in place of {address}. You can find instructions in a tab on the validator's page with their address pre-filled.</p>}
      {validator && <p>{validator.name}'s REStake address has been pre-filled below (<code>{address}</code>).</p>}
      <pre className="text-wrap"><code>
        <p>{daemon_name ? daemon_name : <kbd>DaemonName</kbd>} tx authz grant {address} generic --msg-type /cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward --from <kbd>ledger</kbd> --ledger --chain-id {chain_id} --node https://rpc.cosmos.directory:443/{network.name} --keyring-backend file --gas auto --gas-prices {network.gasPrice} --gas-adjustment 1.5</p>
      </code></pre>
      <h5>Grant permission to delegate rewards</h5>
      <p>Finally you need to grant the final permission to allow the validator to send <code>Delegate</code> messages. This is different to the REStake UI which also limits the validator address the address can delegate to. The REStake script will handle this difference and it doesn't present much of a security problem.</p>
      {!validator && <p>Make sure you enter your validator's REStake address in place of {address}. You can find instructions in a tab on the validator's page with their address pre-filled.</p>}
      {validator && <p>{validator.name}'s REStake address has been pre-filled below (<code>{address}</code>).</p>}
      <pre className="text-wrap"><code>
        <p>{daemon_name ? daemon_name : <kbd>DaemonName</kbd>} tx authz grant {address} generic --msg-type /cosmos.staking.v1beta1.MsgDelegate --from <kbd>ledger</kbd> --ledger --chain-id {chain_id} --node https://rpc.cosmos.directory:443/{network.name} --keyring-backend file --gas auto --gas-prices {network.gasPrice} --gas-adjustment 1.5</p>
      </code></pre>
      <h5>Fin.</h5>
      <p>That's it! <strong>So long as you have an active delegation with them,</strong> your validator should now pick up your ledger's address as a valid REStake user if they're running the latest version. If you don't see the restaking happening, reach out to them to update.</p>
      <p>The UI will show the current state of your grant with the validator, you just won't be able to revoke.</p>
      <p>We will make sure the UI supports these grant types once Ledger integration is possible.</p>
      <p>For more detailed instructions check out <a href="https://twitter.com/gjermundbjaanes" target="_blank">@gjermundbjaanes</a>'s awesome <a href="https://gjermund.tech/blog/making-ledger-work-on-restake/" target="_blank">guide and helper tool</a>.</p>
      <hr />
      <h5>Revoke permissions</h5>
      <p>Revoking the grants is just another command. You need to revoke each permission individually.</p>
      {!validator && <p>Make sure you enter your validator's REStake address in place of {address}. You can find instructions in a tab on the validator's page with their address pre-filled.</p>}
      {validator && <p>{validator.name}'s REStake address has been pre-filled below (<code>{address}</code>).</p>}
      <pre className="text-wrap"><code>
        <p>{daemon_name ? daemon_name : <kbd>DaemonName</kbd>} tx authz revoke {address} /cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward --from <kbd>ledger</kbd> --ledger --chain-id {chain_id} --node https://rpc.cosmos.directory:443/{network.name} --keyring-backend file --gas auto --gas-prices {network.gasPrice} --gas-adjustment 1.5</p>
        <p>{daemon_name ? daemon_name : <kbd>DaemonName</kbd>} tx authz revoke {address} /cosmos.staking.v1beta1.MsgDelegate --from <kbd>ledger</kbd> --ledger --chain-id {chain_id} --node https://rpc.cosmos.directory:443/{network.name} --keyring-backend file --gas auto --gas-prices {network.gasPrice} --gas-adjustment 1.5</p>
      </code></pre>
    </>
  )

  if(props.modal === false) return <div className="small">{content}</div>;

  return (
    <>
      <Modal size="lg" show={show} onHide={() => onHide()}>
        <Modal.Header closeButton>
          <Modal.Title>Ledger</Modal.Title>
        </Modal.Header>
        <Modal.Body className="small">
          {content}
        </Modal.Body>
      </Modal>
    </>
  );
}

export default AboutLedger
