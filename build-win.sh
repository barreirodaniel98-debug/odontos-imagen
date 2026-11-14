#!/bin/bash
# Arma "odontOS Imagen (Windows).zip" (x64, versión portable) en el escritorio. Se hace desde el Mac; no se puede probar aquí.
set -e; cd "$(dirname "$0")"
N="odontOS Imagen"; V=$(node -p "require('./node_modules/electron/package.json').version")
Z=$(node -e "require('@electron/get').downloadArtifact({version:'$V',platform:'win32',arch:'x64',artifactName:'electron'}).then(p=>console.log(p))")
rm -rf dist-win; mkdir -p "dist-win/$N"; unzip -q "$Z" -d "dist-win/$N"
D="dist-win/$N"; mv "$D/electron.exe" "$D/$N.exe"; rm -f "$D/resources/default_app.asar"
A="$D/resources/app"; mkdir -p "$A/node_modules/@cornerstonejs"
cp main.js preload.js vdc.js index.html package.json "$A/"
cp -R node_modules/dicom-parser node_modules/jpeg-lossless-decoder-js "$A/node_modules/"
cp -R node_modules/@cornerstonejs/codec-openjpeg "$A/node_modules/@cornerstonejs/"
printf 'Abra "odontOS Imagen.exe".\r\nSi Windows muestra "protegió su PC", pulse "Más información" y luego "Ejecutar de todos modos" (la app aún no está firmada).\r\n' > "$D/LEEME.txt"
rm -f "$HOME/Desktop/$N (Windows).zip"; (cd dist-win && zip -qr "$HOME/Desktop/$N (Windows).zip" "$N")
rm -rf dist-win; echo "Listo: ~/Desktop/$N (Windows).zip"
