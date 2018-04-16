# newrelic-alerts

This package allows for the creation of [newrelic alerts](https://docs.newrelic.com/docs/alerts/new-relic-alerts) based on [NRQL queries](https://docs.newrelic.com/docs/insights/nrql-new-relic-query-language/using-nrql/introduction-nrql).

## Usage

Ensure that the `NEWRELIC_API_KEY` environment variable has been set before running and that the key has **admin privileges**. See [here](https://docs.newrelic.com/docs/apis/rest-api-v2/getting-started/api-keys) for info on API keys.

Create a `.newrelicalerts` file in your project root (see the example file [here](#example-newrelicalerts-file)).

Run `newrelic-alerts` to generate the alert.

## Config options

All config options are required.

Param|Type|Meaning
---|---|---
`policies[]`|_Array_|An array of alert policies
`policies.name`|_String_|The name of the policy
`policies.notifcation`|_Object_|Details of the notification channel to associate with the policy
`policies.notification.url`|_String_|The url of an incoming slack web hook
`policies.notification.type`|_Enum(`slack`)_|The type of notification channel (slack is the only one currently supported)
`policies.notification.channel`|_String_|The slack channel name the policy should alert
`policies.condition`|_Object_|The condition that will trigger the alert
`policies.condition.description`|_String_|A human-friendly description of the condition
`policies.condition.threshold`|_Number_|The value the result of the NRQL query is compared against
`policies.condition.operator`|_Enum(`above`, `below`, `equal`)_|How the query result should be compared against the threshold
`policies.condition.duration`|_Number_|How long (in minutes) the query should meet the threshold before the alarm is triggered
`policies.condition.query`|_String_|A NRQL query

## Example `.newrelicalerts` file

```json
{
  "policies": [
    {
      "name": "Gone viral!",
      "notification": {
        "url": "https://hooks.slack.com/services/...",
        "type": "slack",
        "channel": "#my-channel"
      },
      "condition": {
        "description": "Greater than 800 page views for at least 2 minutes",
        "threshold": 800,
        "operator": "above",
        "duration": 2,
        "query": "SELECT count(*) FROM PageView"
      }
    }
  ]
}
```
