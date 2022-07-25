import React, { useState, useEffect } from 'react';
import _ from 'lodash'
import {
  OverlayTrigger, 
  Tooltip,
  Spinner
} from 'react-bootstrap'
import { Link } from 'react-router-dom'
import NetworkImage from './NetworkImage'

function ValidatorNetworks(props) {
  const { validator, registryData, network, networks } = props
  const [networkLoading, setNetworkLoading] = useState()

  useEffect(() => {
    if(network){
      setNetworkLoading(null)
    }
  }, [network]);

  if(!registryData?.chains) return null

  const validatorNetworks = _.uniqBy(_.compact(registryData.chains.map(chain => {
    const chainNetwork = networks[chain.name]
    if(chainNetwork){
      const active = network.path === chainNetwork.path
      return {
        key: chain.name,
        name: chainNetwork.prettyName,
        image: <NetworkImage network={chainNetwork} height={20} width={20} className={active ? 'border border-2 border-info' : ''} />,
        path: `/${chainNetwork.path}/${chain.address}`,
        active
      }
    }
  })), 'key').sort((a, b) => a.name > b.name ? 1 : -1)

  return (
    <div className="d-flex flex-wrap gap-1 align-items-center">
      {validatorNetworks.map(validatorNetwork => {
        return (
          <OverlayTrigger
            placement="top"
            rootClose={true}
            key={validatorNetwork.key}
            overlay={
              <Tooltip id={`tooltip-${validatorNetwork.key}`}>{validatorNetwork.name}</Tooltip>
            }
          >
            <Link to={validatorNetwork.path} onClick={() => !validatorNetwork.active && setNetworkLoading(validatorNetwork.path)}>
              {validatorNetwork.image}
            </Link>
          </OverlayTrigger>
        )
      })}
      {networkLoading && (
        <Spinner size="sm" animation="border" role="status" className="mt-1">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      )}
    </div>
  );
}

export default ValidatorNetworks
