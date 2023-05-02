import _ from 'lodash'
import axios from 'axios'
import { timeStamp } from '../utils/Helpers.mjs'

class Health {
  constructor(config, opts) {
    const { address, uuid, name, api_key } = config || {}
    const { dryRun, networkName } = opts || {}
    console.log(networkName);
    this.address = address || 'https://hc-ping.com'
    this.uuid = uuid
    this.name = name || networkName
    this.api_key = api_key
    this.dryRun = dryRun
    this.logs = []
    this.pingUrl = this.getOrCreateHealthCheck();
  }

  getOrCreateHealthCheck(...args) {
    if (!this.api_key) return;

    let config = {
      headers: {
        "X-Api-Key": this.api_key,
      }
    }

    let data = {
      "name": this.name, "channels": "*", "timeout": 43200, "grace": 86400, "unique": ["name"]
    }

    try {
      var response = await axios.post([this.address, 'api/v2/checks/'].join('/'), data, config).then((res) => res.data.pingUrl);
    } catch (error) {
      timeStamp("Health Check creation failed: " + error);
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