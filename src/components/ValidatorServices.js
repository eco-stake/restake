import {
  OverlayTrigger, 
  Tooltip
} from 'react-bootstrap'

import StakingRewardsIcon from '../assets/staking-rewards.svg'
import StakingRewardsWhiteIcon from '../assets/staking-rewards-white.svg'
import StakingRewardsVerifiedIcon from '../assets/staking-rewards-verified.svg'
import StakingRewardsVerifiedWhiteIcon from '../assets/staking-rewards-verified-white.svg'
import Cosmostation from '../assets/cosmostation.svg'
import PingPub from '../assets/ping-pub.svg'
import NodesGuru from '../assets/nodes-guru.svg'

function ValidatorServices(props) {
  const { validator, network, theme } = props

  const services = []

  if(validator.services?.staking_rewards){
    let verified = validator.services.staking_rewards.verified
    let icon = verified ? StakingRewardsVerifiedIcon : StakingRewardsIcon
    if(theme === 'dark') icon = verified ? StakingRewardsVerifiedWhiteIcon : StakingRewardsWhiteIcon
    services.push({
      key: 'stakingrewards',
      tooltip: <span>Staking Rewards <br />{verified ? 'Verified' : ''} Provider</span>,
      icon: icon,
      url: `https://www.stakingrewards.com/savings/${validator.services.staking_rewards.slug}`
    })
  }

  const mintscan = network.chain.explorers?.find(el => el.kind === 'mintscan')
  if(mintscan){
    services.push({
      key: 'mintscan',
      tooltip: 'Mintscan Profile',
      icon: Cosmostation,
      url: `${mintscan.url}/validators/${validator.address}`
    })
  }

  const ping = network.chain.explorers?.find(el => el.kind === 'ping.pub')
  if(ping){
    services.push({
      key: 'pingpub',
      tooltip: 'Ping.pub Profile',
      icon: PingPub,
      url: `${ping.url}/staking/${validator.address}`
    })
  }

  const guru = network.chain.explorers?.find(el => el.kind === 'explorers.guru')
  if(guru){
    services.push({
      key: 'nodesguru',
      tooltip: '[NG] Explorers Profile',
      icon: NodesGuru,
      url: `${guru.url}/validator/${validator.address}`
    })
  }

  const showServices = services.filter(el => !props.show || props.show.includes(el.key))

  if(!showServices.length) return null

  return (
    <div className="d-flex gap-2 align-items-center">
      {showServices.map(service => {
        return (
          <OverlayTrigger
            placement="top"
            rootClose={true}
            key={service.key}
            overlay={
              <Tooltip id={`tooltip-${service.key}`}>{service.tooltip}</Tooltip>
            }
          >
            <a href={service.url} target="_blank">
              <img src={service.icon} height={20} className="d-block" />
            </a>
          </OverlayTrigger>
        )
      })}
    </div>
  );
}

export default ValidatorServices
