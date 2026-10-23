<#
  Helper de autenticacion para los scripts de aprovisionamiento de Dataverse.
  Usa el mismo registro de aplicacion que Power Platform CLI (ya autorizado por
  el usuario via 'pac auth create'), con flujo de device code + refresh token,
  porque 'pac auth token' solo emite tokens para https://api.powerplatform.com
  y la Web API de Dataverse necesita un token con audiencia = URL del org.

  Uso: . .\auth.ps1 ; $token = Get-DataverseToken
#>

$script:DvTenantId = "030a22ff-38fa-4ef1-8820-3d5e0ff18dcb"
$script:DvClientId = "9cee029c-6210-4654-90bb-17e6e9d36617"
$script:DvOrgUrl = "https://org642a1b00.crm4.dynamics.com"
$script:DvTokenCache = "$env:TEMP\dv-token-cache.json"

function Request-DataverseDeviceCode {
    $body = @{ client_id = $script:DvClientId; scope = "$script:DvOrgUrl/.default offline_access" }
    $dc = Invoke-RestMethod -Method Post -Uri "https://login.microsoftonline.com/$script:DvTenantId/oauth2/v2.0/devicecode" -Body $body
    Write-Host "Abre $($dc.verification_uri) e introduce el codigo: $($dc.user_code)"
    $deadline = (Get-Date).AddSeconds($dc.expires_in)
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds $dc.interval
        try {
            $tokBody = @{
                grant_type  = "urn:ietf:params:oauth:grant-type:device_code"
                client_id   = $script:DvClientId
                device_code = $dc.device_code
            }
            $tok = Invoke-RestMethod -Method Post -Uri "https://login.microsoftonline.com/$script:DvTenantId/oauth2/v2.0/token" -Body $tokBody
            Save-DataverseTokenCache -Token $tok
            return $tok
        } catch {
            $err = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
            if ($err.error -eq "authorization_pending") { continue }
            throw
        }
    }
    throw "Device code expiro sin autorizacion."
}

function Save-DataverseTokenCache {
    param($Token)
    $expiresAt = (Get-Date).AddSeconds([int]$Token.expires_in - 60)
    [pscustomobject]@{
        access_token  = $Token.access_token
        refresh_token = $Token.refresh_token
        expires_at    = $expiresAt.ToString("o")
    } | ConvertTo-Json | Set-Content -Path $script:DvTokenCache -Encoding utf8
}

function Get-DataverseToken {
    if (Test-Path $script:DvTokenCache) {
        $cache = Get-Content $script:DvTokenCache -Raw | ConvertFrom-Json
        if ((Get-Date) -lt [datetime]$cache.expires_at) {
            return $cache.access_token
        }
        try {
            $body = @{
                grant_type    = "refresh_token"
                client_id     = $script:DvClientId
                refresh_token = $cache.refresh_token
                scope         = "$script:DvOrgUrl/.default offline_access"
            }
            $tok = Invoke-RestMethod -Method Post -Uri "https://login.microsoftonline.com/$script:DvTenantId/oauth2/v2.0/token" -Body $body
            Save-DataverseTokenCache -Token $tok
            return $tok.access_token
        } catch {
            Write-Host "No se pudo refrescar el token, se necesita reautorizar."
        }
    }
    $tok = Request-DataverseDeviceCode
    return $tok.access_token
}

function Get-DataverseHeaders {
    param([switch]$WithSolution, [string]$SolutionUniqueName = "PeopleFlow")
    $h = @{
        Authorization    = "Bearer $(Get-DataverseToken)"
        Accept           = "application/json"
        "OData-MaxVersion" = "4.0"
        "OData-Version"    = "4.0"
        "Content-Type"     = "application/json; charset=utf-8"
    }
    if ($WithSolution) { $h["MSCRM.SolutionUniqueName"] = $SolutionUniqueName }
    return $h
}
