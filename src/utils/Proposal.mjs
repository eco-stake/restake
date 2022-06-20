export const PROPOSAL_STATUSES = {
  '': 'All',
  'PROPOSAL_STATUS_DEPOSIT_PERIOD': 'Deposit Period',
  'PROPOSAL_STATUS_VOTING_PERIOD': 'Voting Period',
  'PROPOSAL_STATUS_PASSED': 'Passed',
  'PROPOSAL_STATUS_REJECTED': 'Rejected',
  'PROPOSAL_STATUS_FAILED': 'Failed'
}

const Proposal = (data) => {

  const { title, description } = data.content
  const type = data.content['@type']

  const fixedDescription = description.split(/\\n/).join('\n')
  const statusHuman = PROPOSAL_STATUSES[data.status]
  const typeHuman = type.split('.').reverse()[0]

  const isDeposit = data.status === 'PROPOSAL_STATUS_DEPOSIT_PERIOD'
  const isVoting = data.status === 'PROPOSAL_STATUS_VOTING_PERIOD'

  return {
    ...data,
    type,
    fixedDescription,
    statusHuman,
    typeHuman,
    isDeposit,
    isVoting
  }
}

export default Proposal;
