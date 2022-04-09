import React, { useEffect } from 'react';
import {
  Modal
} from 'react-bootstrap'

import { useSearchParams } from 'react-router-dom'

function About(props) {
  let [searchParams, setSearchParams] = useSearchParams();
  const aboutParam = searchParams.get('about')

  const show = props.show || aboutParam == 'restake'

  useEffect(() => {
    if (show && !aboutParam) {
      setSearchParams({ about: 'restake' })
    }
  }, [show, aboutParam]);

  function onHide(){
    setSearchParams({})
    props.onHide()
  }

  return (
    <>
      <Modal show={show} onHide={() => onHide()}>
        <Modal.Header closeButton>
          <Modal.Title>About REStake</Modal.Title>
        </Modal.Header>
        <Modal.Body className="small">
          <h5>How REStake works</h5>
          <p>REStake makes use of a new feature in Cosmos blockchains called Authz. This allows a validator (or any other wallet) to send certain pre-authorized transactions on your behalf.</p>
          <p>When you enable REStake you authorize the validator to send WithdrawDelegatorReward for any address, and Delegate for their own validator address. The validator cannot delegate to any other validators, and the authorisation expires automatically after one year and you can revoke at any time.</p>
          <h5>How to use REStake</h5>
          <ol>
            <li>Choose a network. Some don't support Authz yet but many do.</li>
            <li>Delegate to any validators who offers the REStake service.</li>
            <li>Enable REStake on the validators you want to compound rewards.</li>
            <li>Watch the countdown timer and profit!</li>
          </ol>
          <h5>Run REStake yourself</h5>
          <p>REStake is intended to be run by as many validators as possible, giving delegators the choice of who to auto-compound their rewards with. Ask your favourite validator to become an operator or run it yourself, it's easy!</p>
          <p>The project is entirely open source and instructions for running and contributing to REStake can be <a href="https://github.com/eco-stake/restake" target="_blank" rel="noreferrer">found on Github</a>.</p>
          <h5>ECO Stake 🌱</h5>
          <p>ECO Stake is a climate positive validator, but we care about the Cosmos ecosystem too. We built REStake to make it easy for all validators to run an autocompounder with Authz, and it's one of many projects we work on in the ecosystem. <a href="https://ecostake.com" target="_blank" rel="noreferrer">Delegate with us</a> to support more projects like this.</p>
        </Modal.Body>
      </Modal>
    </>
  );
}

export default About
