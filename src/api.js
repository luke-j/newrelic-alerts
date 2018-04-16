import axios from 'axios'

import { log } from './helpers'

const client = axios.create({
  baseURL: 'https://api.newrelic.com/v2/',
  headers: {
    'X-Api-Key': process.env.NEWRELIC_API_KEY,
    'Content-Type': 'application/json'
  }
})

export const fetchPolicies = async () => {
  log('Fetching policies')

  const { data } = await client.get('alerts_policies.json')
  const { policies } = data

  return policies
}

export const createPolicy = async name => {
  log(`Creating policy "${name}"`)

  const { data } = await client.post('alerts_policies.json', {
    policy: { incident_preference: 'PER_POLICY', name }
  })
  const {
    policy: { id }
  } = data

  return id
}

export const updatePolicy = async (policyId, name) => {
  log(`Updating policy "${name}"`)

  const { data } = await client.put(`alerts_policies/${policyId}.json`, {
    policy: { incident_preference: 'PER_POLICY', name }
  })
  const {
    policy: { id }
  } = data

  return id
}

export const removeStaleNotificationAssociation = async (
  policyId,
  channels
) => {
  log('Removing stale notification channel associations')

  const channelsToRemove = channels.filter(channel =>
    channel.links.policy_ids.includes(policyId)
  )
  const removePolicyAssociation = async channelId =>
    await client.delete('alerts_policy_channels.json', {
      params: {
        policy_id: policyId,
        channel_id: channelId
      }
    })

  channelsToRemove.forEach(({ id }) => removePolicyAssociation(id))
}

export const fetchNotificationChannels = async () => {
  log('Fetching notification channels')

  const { data } = await client.get('alerts_channels.json')
  const { channels } = data

  return channels
}

export const createNotificationChannel = async (name, url, type, channel) => {
  log(`Creating ${type} notification channel`)

  const { data } = await client.post('alerts_channels.json', {
    channel: {
      name: channel,
      type,
      configuration: {
        url,
        channel: channel.replace('#', '')
      }
    }
  })
  const { channels } = data

  return channels.pop().id
}

export const associateChannelWithPolicy = async (policyId, channelId) => {
  log('Associating policy with notification channel')

  const { data } = await client.put('alerts_policy_channels.json', null, {
    params: {
      policy_id: policyId,
      channel_ids: channelId
    }
  })
  const {
    policy: { id }
  } = data

  return id
}

export const removePolicyConditions = async policyId => {
  log('Removing stale policy conditions')

  const { data } = await client.get('alerts_nrql_conditions.json', {
    params: { policy_id: policyId }
  })
  const { nrql_conditions: conditions } = data
  const deleteCondition = async conditionId =>
    client.delete(`alerts_conditions/${conditionId}.json`)

  conditions.forEach(({ id }) => deleteCondition(id))
}

export const createNRQLCondition = async (
  policyId,
  { description, duration, operator, threshold, query }
) => {
  log('Creating and associating NRQL condition for policy')

  const { data } = await client.post(
    `alerts_nrql_conditions/policies/${policyId}.json`,
    {
      nrql_condition: {
        name: description,
        enabled: true,
        terms: [
          {
            duration,
            operator,
            priority: 'critical',
            threshold,
            time_function: 'all'
          }
        ],
        value_function: 'single_value',
        nrql: {
          query,
          since_value: 5
        }
      }
    }
  )
  const {
    nrql_condition: { id }
  } = data

  return id
}
