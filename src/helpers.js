import chalk from 'chalk'

export const log = str => console.log(chalk.green(str))

export const err = str => {
  console.log(chalk.bold.red(str))
  process.exit(1)
}

export const findPolicy = (policies = [], policyName) =>
  policies.find(({ name }) => name === policyName)

export const accessMap = {
  slack: {
    isMatch: (channel, notificationChannel) =>
      channel.type === 'slack' &&
      channel.configuration.channel === notificationChannel.replace('#', ''),

    isValid: ({ type, url, channel }) =>
      type === 'slack' &&
      url.startsWith('https://hooks.slack.com/services/') &&
      channel.startsWith('#')
  }
}

export const findNotificationChannel = (
  channels,
  notificationType,
  notificationChannel
) =>
  channels.find(channel => {
    return accessMap[notificationType].isMatch(channel, notificationChannel)
  })
