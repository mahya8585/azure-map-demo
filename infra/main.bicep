targetScope = 'subscription'

@description('Name of the resource group.')
param resourceGroupName string = 'maps-demo'

@description('Azure region used by the resource group and Static Web App.')
param location string = 'eastus2'

@description('Azure region used by the Azure Maps account.')
param mapsLocation string = 'eastus'

@description('Name of the Azure Maps account.')
param mapsAccountName string = 'maps'

@description('Name of the Static Web App.')
param staticWebAppName string = 'route-app'

@description('Allow the local development server to call Azure Maps.')
param allowLocalhost bool = true

resource resourceGroup 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: resourceGroupName
  location: location
}

module routeAppResources './route-app.bicep' = {
  name: 'routeAppResources'
  scope: resourceGroup
  params: {
    location: location
    mapsLocation: mapsLocation
    mapsAccountName: mapsAccountName
    staticWebAppName: staticWebAppName
    allowLocalhost: allowLocalhost
  }
}

output resourceGroupName string = resourceGroup.name
output staticWebAppName string = routeAppResources.outputs.staticWebAppName
output staticWebAppUrl string = routeAppResources.outputs.staticWebAppUrl
output mapsAccountName string = routeAppResources.outputs.mapsAccountName
output azureMapsAllowedOrigins array = routeAppResources.outputs.azureMapsAllowedOrigins
