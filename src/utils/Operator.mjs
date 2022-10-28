import moment from 'moment'
import parse from 'parse-duration'

const Operator = (network, data) => {
  const { address } = data
  const botAddress = data.restake.address
  let runTime = data.restake.run_time
  runTime = runTime && Array.isArray(runTime) ? runTime : [runTime?.split(',')].flat()
  const minimumReward = data.restake.minimum_reward

  function missedRunCount(lastExec){
    if(lastExec === false) return 9999
    let count = 0
    let times = runTimes().reverse()
    let date = times[0]
    while(date && date.isAfter(lastExec)){
      times.forEach(time => {
        if(time.isBefore() && time.isAfter(lastExec)){
          count++
        }
      })
      times = runTimes(date.subtract(1, 'day').startOf('day')).reverse()
      date = times[0]
    }
    return count
  }

  function isInterval(){
    return runTime.length === 1 && runTime[0].startsWith('every')
  }

  function runTimes(start) {
    if (!runTime) return []
    start = start || moment().startOf('day')

    return runTime.map(time => {
      if(time.startsWith('every')){
        let date = start.clone()
        const interval = parse(time.replace('every ', ''))
        return [...Array(Math.floor(parse('1d') / interval))].map((_, i) => {
          let current = date.clone()
          date.add(interval, 'ms')
          return current
        })
      }else{
        let date = start.clone()
        let [hours, minutes, seconds] = time.split(':')
        if(parseInt(hours) >= 24) hours = 0
        date.utc(true).add({hours, minutes, seconds}) 
        return date
      }
    }).flat().sort((a, b) => a.valueOf() - b.valueOf())
  }

  function runsPerDay(max) {
    let runs = runTimes().length
    return max && runs > max ? max : runs
  }

  function runTimesString(){
    if (!isInterval()) {
      if(runTime.length > 1){
        return `at ${runTime.join(', ')}`
      }else{
        return `at ${runTime.join(', ')} every day`
      }
    }
    return runTime.join(', ')
  }

  function frequency() {
    if(runTime.length > 1 && !isInterval()){
      return runTime.length + 'x daily'
    }else{
      if(isInterval()){
        return runTime[0].replace('every ', '')
      }
      return 'daily'
    }
  }

  function nextRun() {
    const today = runTimes()
    const tomorrow = runTimes(moment().startOf('day').add(1, 'day'))
    return [
      ...today,
      ...tomorrow
    ].find(el => el.isAfter())
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
    runsPerDay,
    missedRunCount
  }
}

export default Operator;
