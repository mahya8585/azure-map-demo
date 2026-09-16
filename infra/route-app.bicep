targetScope = 'resourceGroup'

param location string
param mapsLocation string
param mapsAccountName string
param staticWebAppName string
param allowLocalhost bool

resource staticWebApp 'Microsoft.Web/staticSites@2025-03-01' = {
  name: staticWebAppName
  location: location
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    allowConfigFileUpdates: true
    publicNetworkAccess: 'Enabled'
    stagingEnvironmentPolicy: 'Disabled'
    buildProperties: {
      appLocation: 'route-app'
      apiLocation: ''
      outputLocation: ''
      skipGithubActionWorkflowGeneration: true
    }
  }
}

var staticWebAppOrigin = 'https://${staticWebApp.properties.defaultHostname}'
var allowedOrigins = allowLocalhost
  ? [staticWebAppOrigin, 'http://localhost:8000']
  : [staticWebAppOrigin]

resource mapsAccount 'Microsoft.Maps/accounts@2023-06-01' = {
  name: mapsAccountName
  location: mapsLocation
  kind: 'Gen2'
  sku: {
    name: 'G2'
  }
  properties: {
    cors: {
      corsRules: [
        {
          allowedOrigins: allowedOrigins
        }
      ]
    }
    disableLocalAuth: false
  }
}

output staticWebAppName string = staticWebApp.name
output staticWebAppUrl string = staticWebAppOrigin
output mapsAccountName string = mapsAccount.name
output azureMapsAllowedOrigins array = allowedOrigins
