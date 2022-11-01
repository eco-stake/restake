import AlertMessage from './AlertMessage';

function OperatorLastRestakeAlert(props) {
  const { operator, lastExec } = props

  function showWarning() {
    if (!operator || lastExec == null)
      return;

    const missedRuns = operator.missedRunCount(lastExec);
    return missedRuns > Math.min(30, operator.runsPerDay() * 2);
  }

  if (!showWarning()) return null

  return (
    <AlertMessage variant="danger" dismissible={false}>
      This validator has not REStaked recently.
    </AlertMessage>
  )
}

export default OperatorLastRestakeAlert