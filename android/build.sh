#!/usr/bin/env bash
# Builds the APK straight from the SDK tools.
#
# No Gradle on purpose: the app has no external dependencies (MediaSession is
# in the framework), and a Gradle sync would pull a couple of gigabytes onto a
# disk that does not have them to spare.
set -euo pipefail

SDK="${ANDROID_HOME:-$HOME/android-sdk}"
API=34
BT="$SDK/build-tools/34.0.0"
AJAR="$SDK/platforms/android-$API/android.jar"
OUT="build"
PKG=cl.tecnologicachile.muxterm

[ -f "$AJAR" ] || { echo "falta android.jar para API $API"; exit 1; }

rm -rf "$OUT"; mkdir -p "$OUT/classes" "$OUT/dex" res/raw

# The root CA muxterm's certificate chains to, bundled so the app trusts the
# server without depending on the phone's user store. Public cert only.
CA="${MUXTERM_CA:-/opt/muxterm/certs/rootCA.pem}"
[ -f "$CA" ] || CA="../certs/rootCA.pem"
[ -f "$CA" ] || { echo "no encuentro rootCA.pem (usa MUXTERM_CA=ruta)"; exit 1; }
cp "$CA" res/raw/muxterm_ca.pem

echo "1/5  recursos"
"$BT/aapt2" compile --dir res -o "$OUT/res.zip"
"$BT/aapt2" link -o "$OUT/base.apk" -I "$AJAR" "$OUT/res.zip" \
  --manifest AndroidManifest.xml --min-sdk-version 26 --target-sdk-version $API \
  --version-code 2 --version-name 0.2

# Only a JRE is on PATH here; the JDK lives elsewhere.
JAVAC="$(command -v javac || true)"
[ -n "$JAVAC" ] || for c in /opt/java/bin/javac /usr/lib/jvm/*/bin/javac; do
  [ -x "$c" ] && JAVAC="$c" && break
done
[ -n "$JAVAC" ] || { echo "no encuentro javac"; exit 1; }

echo "2/5  compilando java  ($JAVAC)"
"$JAVAC" -nowarn -Xlint:-options -source 8 -target 8 -bootclasspath "$AJAR" -classpath "$AJAR" \
  -d "$OUT/classes" $(find src -name '*.java')

echo "3/5  dex"
"$BT/d8" --lib "$AJAR" --min-api 26 --output "$OUT/dex" \
  $(find "$OUT/classes" -name '*.class')

echo "4/5  empaquetando"
( cd "$OUT/dex" && zip -q -u "../base.apk" classes.dex )
"$BT/zipalign" -f 4 "$OUT/base.apk" "$OUT/aligned.apk"

echo "5/5  firmando"
KS="$OUT/../debug.keystore"
if [ ! -f "$KS" ]; then
  keytool -genkeypair -keystore "$KS" -storepass android -keypass android \
    -alias muxterm -dname "CN=muxterm" -validity 10000 -keyalg RSA -keysize 2048 2>/dev/null
fi
"$BT/apksigner" sign --ks "$KS" --ks-pass pass:android --key-pass pass:android \
  --out "$OUT/muxterm.apk" "$OUT/aligned.apk"

rm -f "$OUT/base.apk" "$OUT/aligned.apk" "$OUT/res.zip"
echo
echo "listo: $(pwd)/$OUT/muxterm.apk  ($(du -h "$OUT/muxterm.apk" | cut -f1))"
