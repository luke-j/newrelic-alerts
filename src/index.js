import findConfig from 'find-config'

import {
  fetchPolicies,
  fetchNotificationChannels,
  createPolicy,
  updatePolicy,
  createNotificationChannel,
  associateChannelWithPolicy,
  removePolicyConditions,
  createNRQLCondition,
  removeStaleNotificationAssociation
} from './api'
import {
  log,
  err,
  accessMap,
  findPolicy,
  findNotificationChannel
} from './helpers'

const config = JSON.parse(findConfig.read('.newrelicalerts'))

if (!config) {
  err('Could not find .newrelicalerts config file')
}

if (!process.env.NEWRELIC_API_KEY) {
  err('No available NEWRELIC_API_KEY env var')
}

;(async function() {
  const policies = await fetchPolicies()
  const notificationChannels = await fetchNotificationChannels()

  const getPolicyId = async (policies, name) => {
    const existingPolicy = findPolicy(policies, name)

    if (existingPolicy) {
      return updatePolicy(existingPolicy.id, name)
    }

    return createPolicy(name)
  }

  const getNotificationId = async (name, notification) => {
    const existingNotificationChannel = findNotificationChannel(
      notificationChannels,
      notification.type,
      notification.channel
    )

    if (existingNotificationChannel) {
      return existingNotificationChannel.id
    }

    return createNotificationChannel(
      name,
      notification.url,
      notification.type,
      notification.channel
    )
  }

  config.policies.forEach(
    async ({ name, notification = {}, condition = {} }) => {
      if (!accessMap[notification.type]) {
        err('Invalid notification type')
      }

      if (!accessMap[notification.type].isValid(notification)) {
        err(`Policy "${name}" requires a valid notification object`)
      }

      log(`Creating newrelic alert: "${name}"`)

      try {
        const policyId = await getPolicyId(policies, name)
        const notificationId = await getNotificationId(name, notification)

        await removePolicyConditions(policyId)
        await removeStaleNotificationAssociation(policyId, notificationChannels)

        associateChannelWithPolicy(policyId, notificationId)
        createNRQLCondition(policyId, condition)
      } catch (error) {
        err(error)
      }
    }
  )
})()
