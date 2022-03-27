import moment from 'moment'
import parse from 'parse-duration'

const Operator = (data, validatorData) => {

  function runsPerDay() {
    const { runTime } = data
    if(Array.isArray(runTime)){
      return runTime.length
    }else{
      if(runTime.startsWith('every')){
        const interval = parse(runTime.replace('every ', ''))
        return (1000 * 60 * 60 * 24) / interval
      }
      return 1
    }
  }

  function runTimes() {
    if(Array.isArray(data.runTime)) return data.runTime
    return [data.runTime]
  }

  function runTimesString(){
    let string = ''
    if (runTimes().length > 1 || !runTimes()[0].startsWith('every')) {
      string = 'at '
    }
    return string + runTimes().join(', ')
  }

  function frequency() {
    if(Array.isArray(data.runTime)){
      return data.runTime.length + 'x per day'
    }else{
      if(data.runTime.startsWith('every')){
        return data.runTime.replace('every ', '')
      }
      return 'daily'
    }
  }

  function nextRun() {
    if (!data.runTime) return

    if (Array.isArray(data.runTime)) {
      return data.runTime
        .map(el => nextRunFromRuntime(el))
        .sort((a, b) => a.valueOf() - b.valueOf())
        .find(el => el.isAfter());
    } else {
      if(data.runTime.startsWith('every')){
        return nextRunFromInterval(data.runTime)
      }
      return nextRunFromRuntime(data.runTime)
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
    address: data.address,
    botAddress: data.botAddress,
    moniker: validatorData && validatorData.description.moniker,
    description: validatorData && validatorData.description,
    validatorData,
    data,
    nextRun,
    frequency,
    runTimes,
    runTimesString,
    runsPerDay
  }
}

export default Operator;
