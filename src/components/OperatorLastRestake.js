import {
  QuestionCircle
} from 'react-bootstrap-icons'

import TooltipIcon from './TooltipIcon'

function OperatorLastRestake(props) {
  const { operator, lastExec } = props

  function classname() {
    if (!operator || lastExec == null)
      return;

    const missedRuns = operator.missedRunCount(lastExec);
    const warning = missedRuns > Math.min(20, operator.runsPerDay());
    const error = missedRuns > Math.min(30, operator.runsPerDay() * 2);
    return error ? 'text-danger' : warning ? 'text-warning' : 'text-success';
  }

  return (
    <div className="d-flex align-items-center">
      <span>{lastExec != null ? <span className={classname(operator, lastExec)}>{lastExec ? lastExec?.fromNow() : 'Not recently'}</span> : <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>}</span>
      <TooltipIcon icon={<QuestionCircle className="ms-2" />} identifier={operator.address} tooltip="Based on the last REStake transaction sent by this validator for any of their users. Not every run generates a transaction." />
    </div>
  )
}

export default OperatorLastRestake