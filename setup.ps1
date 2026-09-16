# setup.ps1
Write-Host "Création de la structure de dossiers..." -ForegroundColor Green
# Autres dossiers
$otherDirs = @("pages", "services", "utils", "styles", "contexts")
foreach ($dir in $otherDirs) {
    $path = "src\$dir"
    if (-not (Test-Path $path)) {
        New-Item -ItemType Directory -Path $path -Force | Out-Null
        Write-Host "Cree : $path" -ForegroundColor Cyan
    } else {
        Write-Host "Existe deja : $path" -ForegroundColor Yellow
    }
}

Write-Host "Structure creee avec succes!" -ForegroundColor Green