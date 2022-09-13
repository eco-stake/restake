import _ from 'lodash'
import axios from 'axios'
import { timeStamp } from '../utils/Helpers.mjs'

class Health {
  constructor(config, opts) {
    const { address, uuid } = config || {}
    const { dryRun } = opts || {}
    this.address = address || 'https://hc-ping.com'
    this.uuid = uuid
    this.dryRun = dryRun
    this.logs = []
  }

  started(...args){
    timeStamp(...args)
    if(this.uuid) timeStamp('Starting health', [this.address, this.uuid].join('/'))
    return this.ping('start', [args.join(' ')])
  }

  success(...args){
    timeStamp(...args)
    return this.ping(undefined, [...this.logs, args.join(' ')])
  }

  failed(...args){
    timeStamp(...args)
    return this.ping('fail', [...this.logs, args.join(' ')])
  }

  log(...args){
    timeStamp(...args)
    this.logs = [...this.logs, args.join(' ')]
  }

  addLogs(logs){
    this.logs = this.logs.concat(logs)
  }

  async sendLog(){
    await this.ping('log', this.logs)
    this.logs = []
  }

  async ping(action, logs){
    if(!this.uuid) return
    if(this.dryRun) return timeStamp('DRYRUN: Skipping health check ping')

    return axios.request({
      method: 'POST',
      url: _.compact([this.address, this.uuid, action]).join('/'), 
      data: logs.join("\n")
    }).catch(error => {
      timeStamp('Health ping failed', error.message)
    })
  }
}

export default Health