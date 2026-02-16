$ErrorActionPreference = 'Stop'
$backendProject = Join-Path (Join-Path $PSScriptRoot '..') 'backend.csproj'

try {
    dotnet ef --version | Out-Null
}
catch {
    Write-Host "dotnet-ef nao encontrado. Instale com: dotnet tool install --global dotnet-ef" -ForegroundColor Red
    exit 1
}

Write-Host "Aplicando migrations pendentes no banco..."
dotnet ef database update --project $backendProject --startup-project $backendProject
