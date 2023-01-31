export const PROPOSAL_STATUSES = {
  '': 'All',
  'PROPOSAL_STATUS_DEPOSIT_PERIOD': 'Deposit Period',
  'PROPOSAL_STATUS_VOTING_PERIOD': 'Voting Period',
  'PROPOSAL_STATUS_PASSED': 'Passed',
  'PROPOSAL_STATUS_REJECTED': 'Rejected',
  'PROPOSAL_STATUS_FAILED': 'Failed'
}

const Proposal = (data) => {
  let { proposal_id, content, messages, metadata } = data
  if(!proposal_id && data.id) proposal_id = data.id

  let title, description, typeHuman
  if(metadata){
    metadata = JSON.parse(metadata)
    title = metadata.title
    description = metadata.summary
  }

  if(messages){
    content = messages.find(el => el['@type'] === '/cosmos.gov.v1.MsgExecLegacyContent')?.content
    messages = messages.filter(el => el['@type'] !== '/cosmos.gov.v1.MsgExecLegacyContent')
    typeHuman = messages.map(el => el['@type'].split('.').reverse()[0]).join(', ')
  }
  
  if(content){
    title = title || content.title
    description = description || content.description
    typeHuman = typeHuman || (content['@type'] ? content['@type'].split('.').reverse()[0] : 'Unknown')
  }

  const statusHuman = PROPOSAL_STATUSES[data.status]

  const isDeposit = data.status === 'PROPOSAL_STATUS_DEPOSIT_PERIOD'
  const isVoting = data.status === 'PROPOSAL_STATUS_VOTING_PERIOD'

  return {
    ...data,
    proposal_id,
    title,
    typeHuman,
    statusHuman,
    description,
    content,
    metadata,
    messages,
    isDeposit,
    isVoting
  }
}

export default Proposal;
