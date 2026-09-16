targetScope = 'subscription'

@description('Short name used to create deterministic resource names.')
@minLength(1)
@maxLength(20)
param environmentName string = 'demo'

@description('Azure region used by the resource group, Static Web App, and Azure Maps account.')
param location string = 'westus2'

@description('Allow the local development server to call Azure Maps.')
param allowLocalhost bool = true

var resourceToken = uniqueString(subscription().id, location, environmentName)
var resourceGroupName = 'azrg${resourceToken}'

resource resourceGroup 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: resourceGroupName
  location: location
}

module routeAppResources './route-app.bicep' = {
  name: 'routeAppResources'
  scope: resourceGroup
  params: {
    resourceToken: resourceToken
    location: location
    allowLocalhost: allowLocalhost
  }
}

output resourceGroupName string = resourceGroup.name
output staticWebAppName string = routeAppResources.outputs.staticWebAppName
output staticWebAppUrl string = routeAppResources.outputs.staticWebAppUrl
output mapsAccountName string = routeAppResources.outputs.mapsAccountName
output azureMapsAllowedOrigins array = routeAppResources.outputs.azureMapsAllowedOrigins
