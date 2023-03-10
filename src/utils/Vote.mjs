import { equal } from 'mathjs'

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

  let option = data.option
  let optionHuman = VOTE_CHOICES[data.option]
  let optionValue = VOTE_VALUES[data.option]

  if(!optionValue && data.options?.length){
    option = data.options.find(el => equal(el.weight, 1))?.option
    optionHuman = option ? VOTE_CHOICES[option] : 'Multiple'
    optionValue = option ? VOTE_VALUES[option] : null // doesn't support multiple right now
  }

  return {
    ...data,
    option,
    optionHuman,
    optionValue
  }
}

export default Vote;
