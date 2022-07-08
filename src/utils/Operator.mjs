import moment from 'moment'
import parse from 'parse-duration'

const Operator = (network, data) => {
  const { address } = data
  const botAddress = data.restake.address
  const runTime = data.restake.run_time
  const minimumReward = data.restake.minimum_reward

  function runsPerDay(max) {
    let runs = 0
    if(Array.isArray(runTime)){
      runs = runTime.length
    }else{
      if(runTime.startsWith('every')){
        const interval = parse(runTime.replace('every ', ''))
        runs = (1000 * 60 * 60 * 24) / interval
      }else{
        runs = 1
      }
    }
    return max && runs > max ? max : runs
  }

  function runTimes() {
    if(Array.isArray(runTime)) return runTime
    return [runTime]
  }

  function runTimesString(){
    let string = ''
    if (runTimes().length > 1 || !runTimes()[0].startsWith('every')) {
      string = 'at '
    }
    return string + runTimes().join(', ')
  }

  function frequency() {
    if(Array.isArray(runTime)){
      return runTime.length + 'x per day'
    }else{
      if(runTime.startsWith('every')){
        return runTime.replace('every ', '')
      }
      return 'daily'
    }
  }

  function nextRun() {
    if (!runTime) return

    if (Array.isArray(runTime)) {
      return runTime
        .map(el => nextRunFromRuntime(el))
        .sort((a, b) => a.valueOf() - b.valueOf())
        .find(el => el.isAfter());
    } else {
      if(runTime.startsWith('every')){
        return nextRunFromInterval(runTime)
      }
      return nextRunFromRuntime(runTime)
    }
  }

  function nextRunFromInterval(runTime){
    const interval = parse(runTime.replace('every ', ''))
    const diff = moment().startOf('day').diff()
    const ms = interval + diff % interval
    return moment().add(ms, 'ms')
  }

  function nextRunFromRuntime(runTime) {
    const date = moment.utc(runTime, 'HH:mm:ss')
    return date.isAfter() ? date : date.add(1, 'day')
  }

  return {
    address,
    botAddress,
    runTime,
    minimumReward,
    moniker: data.description?.moniker,
    description: data.description,
    data,
    nextRun,
    frequency,
    runTimes,
    runTimesString,
    runsPerDay
  }
}

export default Operator;
