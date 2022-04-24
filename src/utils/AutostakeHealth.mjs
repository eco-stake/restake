import _ from 'lodash'
import axios from 'axios'
import { timeStamp } from './Helpers.mjs'

class AutostakeHealth {
  constructor(config) {
    const { address, uuid } = config || {}
    this.address = address || 'https://hc-ping.com'
    this.uuid = uuid
    this.config = config
  }

  started(...args){
    timeStamp(...args)
    if(this.uuid) timeStamp('Starting health', [this.address, this.uuid].join('/'))
    this.ping('start', ...args)
  }

  error(...args){
    timeStamp(...args)
    this.errors = [...(this.errors || []), "\n", ...args]
  }

  complete(...args){
    timeStamp(...args)
    if(this.errors){
      this.ping('fail', ...[...this.errors, "\n", ...args])
    }else{
      this.ping(undefined, ...args)
    }
  }

  success(...args){
    timeStamp(...args)
    this.ping(undefined, ...args)
  }

  failed(...args){
    timeStamp(...args)
    this.ping('fail', ...args)
  }

  ping(action, ...args){
    if(!this.uuid) return

    axios.request({
      method: 'POST',
      url: _.compact([this.address, this.uuid, action]).join('/'), 
      data: args.join(' ')
    }).catch(error => {
      timeStamp('Health ping failed', error.message)
    })
  }
}

export default AutostakeHealth