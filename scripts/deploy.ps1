[CmdletBinding()]
param(
	[string] $Location = "westus2",

	[string] $EnvironmentName = "demo",

	[switch] $ExcludeLocalhost
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-NativeCommand {
	param(
		[Parameter(Mandatory)]
		[string] $Executable,

		[Parameter(Mandatory)]
		[string[]] $CommandArguments
	)

	& $Executable @CommandArguments
	if ($LASTEXITCODE -ne 0) {
		throw "$Executable exited with code $LASTEXITCODE."
	}
}

foreach ($commandName in @("az", "swa")) {
	if (-not (Get-Command $commandName -ErrorAction SilentlyContinue)) {
		throw "Required command '$commandName' was not found."
	}
}

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$templateFile = Join-Path $repositoryRoot "infra/main.bicep"
$parametersFile = Join-Path $repositoryRoot "infra/main.parameters.json"
$routeAppDirectory = Join-Path $repositoryRoot "route-app"
$allowLocalhost = (-not $ExcludeLocalhost.IsPresent).ToString().ToLowerInvariant()
$parameterFileArgument = "@$parametersFile"

Invoke-NativeCommand az @("account", "show", "--output", "none")
Invoke-NativeCommand az @("provider", "register", "--namespace", "Microsoft.Web", "--wait")
Invoke-NativeCommand az @("provider", "register", "--namespace", "Microsoft.Maps", "--wait")

$deploymentArguments = @(
	"--location", $Location,
	"--template-file", $templateFile,
	"--parameters", $parameterFileArgument,
	"environmentName=$EnvironmentName",
	"location=$Location",
	"allowLocalhost=$allowLocalhost"
)

Invoke-NativeCommand az (@("deployment", "sub", "what-if") + $deploymentArguments)
$deploymentJson = Invoke-NativeCommand az (@(
	"deployment", "sub", "create",
	"--name", "route-app-$EnvironmentName",
	"--query", "properties.outputs",
	"--output", "json"
) + $deploymentArguments)
$deploymentOutputs = $deploymentJson | ConvertFrom-Json

$resourceGroupName = $deploymentOutputs.resourceGroupName.value
$staticWebAppName = $deploymentOutputs.staticWebAppName.value
$staticWebAppUrl = $deploymentOutputs.staticWebAppUrl.value
$mapsAccountName = $deploymentOutputs.mapsAccountName.value

$mapsKey = Invoke-NativeCommand az @(
	"maps", "account", "keys", "list",
	"--resource-group", $resourceGroupName,
	"--name", $mapsAccountName,
	"--query", "primaryKey",
	"--output", "tsv"
)
$deploymentToken = Invoke-NativeCommand az @(
	"staticwebapp", "secrets", "list",
	"--resource-group", $resourceGroupName,
	"--name", $staticWebAppName,
	"--query", "properties.apiKey",
	"--output", "tsv"
)

if ([string]::IsNullOrWhiteSpace($mapsKey) -or [string]::IsNullOrWhiteSpace($deploymentToken)) {
	throw "Azure Maps key or Static Web Apps deployment token could not be retrieved."
}

$stagingDirectory = Join-Path ([System.IO.Path]::GetTempPath()) "route-app-$([guid]::NewGuid().ToString('N'))"
$previousDeploymentToken = $env:SWA_CLI_DEPLOYMENT_TOKEN

try {
	New-Item -ItemType Directory -Path $stagingDirectory | Out-Null
	Copy-Item -Path (Join-Path $routeAppDirectory "*") -Destination $stagingDirectory -Recurse -Force

	$runtimeConfig = @{ azureMapsKey = $mapsKey.Trim() } | ConvertTo-Json -Compress
	"window.ROUTE_APP_CONFIG = $runtimeConfig;" |
		Set-Content -Path (Join-Path $stagingDirectory "config.js") -Encoding utf8

	$env:SWA_CLI_DEPLOYMENT_TOKEN = $deploymentToken.Trim()
	Invoke-NativeCommand swa @("deploy", $stagingDirectory, "--env", "production")
}
finally {
	if ($null -eq $previousDeploymentToken) {
		Remove-Item Env:SWA_CLI_DEPLOYMENT_TOKEN -ErrorAction SilentlyContinue
	}
	else {
		$env:SWA_CLI_DEPLOYMENT_TOKEN = $previousDeploymentToken
	}

	Remove-Item -Path $stagingDirectory -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Output "Deployment completed: $staticWebAppUrl"