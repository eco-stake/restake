export const VOTE_CHOICES = {
  'VOTE_OPTION_YES': 'Yes',
  'VOTE_OPTION_NO': 'No',
  'VOTE_OPTION_ABSTAIN': 'Abstain',
  'VOTE_OPTION_NO_WITH_VETO': 'No with Veto'
}

export const VOTE_VALUES = {
  'VOTE_OPTION_YES': 1,
  'VOTE_OPTION_NO': 3,
  'VOTE_OPTION_NO_WITH_VETO': 4,
  'VOTE_OPTION_ABSTAIN': 2
}

const Vote = (data) => {

  const optionHuman = VOTE_CHOICES[data.option]
  const optionValue = VOTE_VALUES[data.option]

  return {
    ...data,
    optionHuman,
    optionValue
  }
}

export default Vote;
