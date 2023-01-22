export const PROPOSAL_STATUSES = {
  '': 'All',
  'PROPOSAL_STATUS_DEPOSIT_PERIOD': 'Deposit Period',
  'PROPOSAL_STATUS_VOTING_PERIOD': 'Voting Period',
  'PROPOSAL_STATUS_PASSED': 'Passed',
  'PROPOSAL_STATUS_REJECTED': 'Rejected',
  'PROPOSAL_STATUS_FAILED': 'Failed'
}

const Proposal = (data) => {
  let { proposal_id, content, messages } = data
  if(!proposal_id && data.id) proposal_id = data.id
  if(!content && messages?.length) content = messages[0].content
  const { title, description } = content || {}
  const type = content && content['@type']

  const fixedDescription = description && description.split(/\\n/).join('\n')
  const statusHuman = PROPOSAL_STATUSES[data.status]
  const typeHuman = type ? type.split('.').reverse()[0] : 'Unknown'

  const isDeposit = data.status === 'PROPOSAL_STATUS_DEPOSIT_PERIOD'
  const isVoting = data.status === 'PROPOSAL_STATUS_VOTING_PERIOD'

  return {
    ...data,
    proposal_id,
    content,
    title,
    type,
    fixedDescription,
    statusHuman,
    typeHuman,
    isDeposit,
    isVoting
  }
}

export default Proposal;
