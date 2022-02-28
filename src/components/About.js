import {
  Modal
} from 'react-bootstrap'

function About(props) {
  return (
    <>
      <Modal show={props.show} onHide={() => props.onHide()}>
        <Modal.Header closeButton>
          <Modal.Title>About REStake</Modal.Title>
        </Modal.Header>
        <Modal.Body className="small">
          <h5>How REStake works</h5>
          <p>REStake makes use of a new feature in Cosmos blockchains called Authz. This allows a validator (or any other wallet) to send certain pre-authorised transactions on your behalf.</p>
          <p>When you enable REStake you authorise the operator to send WithdrawDelegatorReward for any address, and Delegate for the validators you specify. The operator cannot delegate to any other validators, and the authorisation expires automatically after one year.</p>
          <h5>How to use REStake</h5>
          <ol>
            <li>Choose a network and operator who will carry out the REStake</li>
            <li>Delegate to the operator so they can find you</li>
            <li>Enable REStake on the validators you want to compound rewards</li>
            <li>Update REStake to apply the new Authz grants</li>
            <li>Watch the countdown timer and.. profit!</li>
          </ol>
          <h5>Run REStake yourself</h5>
          <p>REStake is intended to be run by many validators, giving delegators the choice of operator for many different networks. It's also easy to run as a user if you want your own private REStake</p>
          <p>The project is entirely open source and instructions for running and contributing to REStake can be <a href="https://github.com/eco-stake/restake" target="_blank" rel="noreferrer">found on Github</a>.</p>
          <h5>ECO Stake 🌱</h5>
          <p>ECO Stake is a climate positive validator, but we care about the Cosmos ecosystem too. We built REStake to make it easy for all validators to run an autocompounder with Authz, and it's one of many projects we work on in the ecosystem. <a href="https://ecostake.com" target="_blank" rel="noreferrer">Delegate with us</a> to support more projects like this.</p>
        </Modal.Body>
      </Modal>
    </>
  );
}

export default About
