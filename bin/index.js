#!/usr/bin/env node
'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var chalk = _interopDefault(require('chalk'));
var axios = _interopDefault(require('axios'));
var findConfig = _interopDefault(require('find-config'));

const log = str => console.log(chalk.green(str));

const err = str => {
  console.log(chalk.bold.red(str));
  process.exit(1);
};

const findPolicy = (policies = [], policyName) =>
  policies.find(({ name }) => name === policyName);

const accessMap = {
  slack: {
    isMatch: (channel, notificationChannel) =>
      channel.type === 'slack' &&
      channel.configuration.channel === notificationChannel.replace('#', ''),

    isValid: ({ type, url, channel }) =>
      type === 'slack' &&
      url.startsWith('https://hooks.slack.com/services/') &&
      channel.startsWith('#')
  }
};

const findNotificationChannel = (
  channels,
  notificationType,
  notificationChannel
) =>
  channels.find(channel => {
    return accessMap[notificationType].isMatch(channel, notificationChannel)
  });

const client = axios.create({
  baseURL: 'https://api.newrelic.com/v2/',
  headers: {
    'X-Api-Key': process.env.NEWRELIC_API_KEY,
    'Content-Type': 'application/json'
  }
});

const fetchPolicies = async () => {
  log('Fetching policies');

  const { data } = await client.get('alerts_policies.json');
  const { policies } = data;

  return policies
};

const createPolicy = async name => {
  log(`Creating policy "${name}"`);

  const { data } = await client.post('alerts_policies.json', {
    policy: { incident_preference: 'PER_POLICY', name }
  });
  const {
    policy: { id }
  } = data;

  return id
};

const updatePolicy = async (policyId, name) => {
  log(`Updating policy "${name}"`);

  const { data } = await client.put(`alerts_policies/${policyId}.json`, {
    policy: { incident_preference: 'PER_POLICY', name }
  });
  const {
    policy: { id }
  } = data;

  return id
};

const removeStaleNotificationAssociation = async (
  policyId,
  channels
) => {
  log('Removing stale notification channel associations');

  const channelsToRemove = channels.filter(channel =>
    channel.links.policy_ids.includes(policyId)
  );
  const removePolicyAssociation = async channelId =>
    await client.delete('alerts_policy_channels.json', {
      params: {
        policy_id: policyId,
        channel_id: channelId
      }
    });

  channelsToRemove.forEach(({ id }) => removePolicyAssociation(id));
};

const fetchNotificationChannels = async () => {
  log('Fetching notification channels');

  const { data } = await client.get('alerts_channels.json');
  const { channels } = data;

  return channels
};

const createNotificationChannel = async (name, url, type, channel) => {
  log(`Creating ${type} notification channel`);

  const { data } = await client.post('alerts_channels.json', {
    channel: {
      name: channel,
      type,
      configuration: {
        url,
        channel: channel.replace('#', '')
      }
    }
  });
  const { channels } = data;

  return channels.pop().id
};

const associateChannelWithPolicy = async (policyId, channelId) => {
  log('Associating policy with notification channel');

  const { data } = await client.put('alerts_policy_channels.json', null, {
    params: {
      policy_id: policyId,
      channel_ids: channelId
    }
  });
  const {
    policy: { id }
  } = data;

  return id
};

const removePolicyConditions = async policyId => {
  log('Removing stale policy conditions');

  const { data } = await client.get('alerts_nrql_conditions.json', {
    params: { policy_id: policyId }
  });
  const { nrql_conditions: conditions } = data;
  const deleteCondition = async conditionId =>
    client.delete(`alerts_conditions/${conditionId}.json`);

  conditions.forEach(({ id }) => deleteCondition(id));
};

const createNRQLCondition = async (
  policyId,
  { description, duration, operator, threshold, query }
) => {
  log('Creating and associating NRQL condition for policy');

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
  );
  const {
    nrql_condition: { id }
  } = data;

  return id
};

const config = JSON.parse(findConfig.read('.newrelicalerts'));

if (!config) {
  err('Could not find .newrelicalerts config file');
}

if (!process.env.NEWRELIC_API_KEY) {
  err('No available NEWRELIC_API_KEY env var');
}
(async function() {
  const policies = await fetchPolicies();
  const notificationChannels = await fetchNotificationChannels();

  const getPolicyId = async (policies, name) => {
    const existingPolicy = findPolicy(policies, name);

    if (existingPolicy) {
      return updatePolicy(existingPolicy.id, name)
    }

    return createPolicy(name)
  };

  const getNotificationId = async (name, notification) => {
    const existingNotificationChannel = findNotificationChannel(
      notificationChannels,
      notification.type,
      notification.channel
    );

    if (existingNotificationChannel) {
      return existingNotificationChannel.id
    }

    return createNotificationChannel(
      name,
      notification.url,
      notification.type,
      notification.channel
    )
  };

  config.policies.forEach(
    async ({ name, notification = {}, condition = {} }) => {
      if (!accessMap[notification.type]) {
        err('Invalid notification type');
      }

      if (!accessMap[notification.type].isValid(notification)) {
        err(`Policy "${name}" requires a valid notification object`);
      }

      log(`Creating newrelic alert: "${name}"`);

      try {
        const policyId = await getPolicyId(policies, name);
        const notificationId = await getNotificationId(name, notification);

        await removePolicyConditions(policyId);
        await removeStaleNotificationAssociation(policyId, notificationChannels);

        associateChannelWithPolicy(policyId, notificationId);
        createNRQLCondition(policyId, condition);
      } catch (error) {
        err(error);
      }
    }
  );
})();
