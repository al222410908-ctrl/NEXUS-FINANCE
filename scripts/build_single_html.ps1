# Genera backend/web/index.html autocontenido: CSS, React y app incrustados.
# Uso:  powershell -ExecutionPolicy Bypass -File scripts/build_single_html.ps1
param()
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$web = Join-Path $root "backend\web"

$css = Get-Content -Raw (Join-Path $web "styles.css")
$libs = @("react.min.js", "react-dom.min.js", "htm.min.js", "chart.min.js") | ForEach-Object {
  Get-Content -Raw (Join-Path $web "vendor\$_")
}
$app = Get-Content -Raw (Join-Path $web "app.js")

$head = @'
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>Nexus Finance</title>
  <meta name="theme-color" content="#0F172A" />
  <meta name="description" content="Panel de finanzas personales Nexus" />
  <link rel="manifest" href="/manifest.webmanifest" />
  <link rel="icon" href="/icons/icon-192.png" />
  <link rel="apple-touch-icon" href="/icons/icon-192.png" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="Nexus" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <script>
    // Limpia copias viejas guardadas (service worker y caché) para que el panel siempre se vea actual.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then(function (rs) { rs.forEach(function (r) { r.unregister(); }); });
    }
    if ("caches" in window) {
      caches.keys().then(function (keys) { keys.forEach(function (k) { caches.delete(k); }); });
    }
  </script>
  <style>
'@

$mid = @'

  </style>
</head>
<body>
  <div id="root"><p class="boot">Cargando panel&hellip;</p></div>
  <script>
'@

$tail = @'

  </script>
</body>
</html>
'@

$out = $head + $css + $mid + ($libs -join "`n") + "`n" + $app + $tail
[System.IO.File]::WriteAllText((Join-Path $web "index.html"), $out, (New-Object System.Text.UTF8Encoding $false))
Write-Output ("index.html generado: " + $out.Length + " bytes")