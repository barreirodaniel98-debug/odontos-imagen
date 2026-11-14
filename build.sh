#!/bin/bash
# Arma "odontOS Imagen.app" (arm64) desde node_modules/electron y la copia al escritorio
set -e
cd "$(dirname "$0")"
N="odontOS Imagen"
rm -rf dist && mkdir -p dist
cp -R node_modules/electron/dist/Electron.app "dist/$N.app"
R="dist/$N.app/Contents"
mkdir -p "$R/Resources/app/node_modules"
cp main.js preload.js vdc.js index.html package.json "$R/Resources/app/"
cp -R node_modules/dicom-parser node_modules/jpeg-lossless-decoder-js "$R/Resources/app/node_modules/"
mkdir -p "$R/Resources/app/node_modules/@cornerstonejs" && cp -R node_modules/@cornerstonejs/codec-openjpeg "$R/Resources/app/node_modules/@cornerstonejs/"
rm -f "$R/Resources/default_app.asar"
rm -f "$R/Resources/electron.icns"; cp icono.icns "$R/Resources/icono.icns"
mv "$R/MacOS/Electron" "$R/MacOS/$N"
P="$R/Info.plist"
plutil -replace CFBundleExecutable -string "$N" "$P"
plutil -replace CFBundleName -string "$N" "$P"
plutil -replace CFBundleDisplayName -string "$N" "$P"
plutil -replace CFBundleIdentifier -string "app.odontos.imagen" "$P"
plutil -replace CFBundleIconFile -string "icono.icns" "$P"
DOC='[{"CFBundleTypeName":"Caso odontOS Imagen","CFBundleTypeExtensions":["oim","vdc"],"CFBundleTypeIconFile":"icono.icns","CFBundleTypeRole":"Editor","LSHandlerRank":"Owner"}]'
plutil -replace CFBundleDocumentTypes -json "$DOC" "$P" 2>/dev/null || plutil -insert CFBundleDocumentTypes -json "$DOC" "$P"
codesign --force --deep --sign - "dist/$N.app" >/dev/null 2>&1
rm -rf "$HOME/Desktop/$N.app" "$HOME/Desktop/Visor dental.app"
cp -R "dist/$N.app" "$HOME/Desktop/$N.app" && xattr -cr "$HOME/Desktop/$N.app"
echo "Listo: ~/Desktop/$N.app"
