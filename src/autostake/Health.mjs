import _ from 'lodash'
import axios from 'axios'
import { createLogger } from '../utils/Helpers.mjs'

class Health {
  constructor(config, opts) {
    const { address, apiAddress, uuid, name, apiKey, timeout, gracePeriod } = config || {}
    const { dryRun, networkName } = opts || {}
    this.address = address || 'https://hc-ping.com'
    this.apiAddress = apiAddress || 'https://healthchecks.io'
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

    this.logger = createLogger('health')
  }

  started(onlyOperators, ...args) {
    if (!onlyOperators) {
        this.logger.info(args.join(' '))
    }
      if (this.uuid) this.logger.info('Starting health', { path: [this.address, this.uuid].join('/') })
    return this.ping('start', [args.join(' ')])

  }

  success(...args) {
    this.logger.info(args.join(' '))
    return this.ping(undefined, [...this.logs, args.join(' ')])
  }

  failed(...args) {
    this.logger.warn(args.join(' '))
    return this.ping('fail', [...this.logs, args.join(' ')])
  }

  log(...args) {
    this.logger.info(args.join(' '))
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
      await axios.post([this.apiAddress, 'api/v2/checks/'].join('/'), data, config).then((res) => {
        this.uuid = res.data.ping_url.split('/')[4]
      });
    } catch (error) {
      this.logger.error('Health Check creation failed', { error })
    }
  }

  async sendLog() {
    await this.ping('log', this.logs)
    this.logs = []
  }

  async ping(action, logs) {
    if (!this.uuid) return
    if (this.dryRun) return this.logger.info('DRYRUN: Skipping health check ping')

    return axios.request({
      method: 'POST',
      url: _.compact([this.address, this.uuid, action]).join('/'),
      data: logs.join("\n")
    }).catch(error => {
      this.logger.error('Health ping failed', { error })
    })
  }
}

export default Health
