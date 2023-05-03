import _ from 'lodash'
import axios from 'axios'
import { timeStamp } from '../utils/Helpers.mjs'

class Health {
  constructor(config, opts) {
    const { address, uuid, name, apiKey, timeout, gracePeriod } = config || {}
    const { dryRun, networkName } = opts || {}
    this.address = address || 'https://hc-ping.com'
    this.name = name || networkName
    this.gracePeriod = gracePeriod || 86400   // default 24 hours
    this.timeout = timeout || 86400           // default 24 hours
    this.uuid = uuid
    this.apiKey = apiKey
    this.dryRun = dryRun
    this.logs = []
    this.getOrCreateHealthCheck()

    if (address) {
      // This is necessary as the default provider - hc-ping.com - has a built in ping mechanism
      // whereas providing self-hosted addresses do NOT. 
      // https://healthchecks.selfhosted.com/ping/{uuid} rather than https://hc-ping.com/{uuid}
      this.address = this.address + "/ping"
    }
  }

  started(...args) {
    timeStamp(...args)
    if (this.uuid) timeStamp('Starting health', [this.address, this.uuid].join('/'))
    return this.ping('start', [args.join(' ')])
  }

  success(...args) {
    timeStamp(...args)
    return this.ping(undefined, [...this.logs, args.join(' ')])
  }

  failed(...args) {
    timeStamp(...args)
    return this.ping('fail', [...this.logs, args.join(' ')])
  }

  log(...args) {
    timeStamp(...args)
    this.logs = [...this.logs, args.join(' ')]
  }

  addLogs(logs) {
    this.logs = this.logs.concat(logs)
  }

  async getOrCreateHealthCheck(...args) {
    if (!this.apiKey) return;

    let config = {
      headers: {
        "X-Api-Key": this.apiKey,
      }
    }

    let data = {
      "name": this.name, "channels": "*", "timeout": this.timeout, "grace": this.gracePeriod, "unique": ["name"]
    }

    try {
      await axios.post([this.address, 'api/v2/checks/'].join('/'), data, config).then((res) => {
        this.uuid = res.data.ping_url.split('/')[4]
      });
    } catch (error) {
      timeStamp("Health Check creation failed: " + error)
    }
  }

  async sendLog() {
    await this.ping('log', this.logs)
    this.logs = []
  }

  async ping(action, logs) {
    if (!this.uuid) return
    if (this.dryRun) return timeStamp('DRYRUN: Skipping health check ping')

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