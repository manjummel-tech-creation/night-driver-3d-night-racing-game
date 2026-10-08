#!/bin/bash
# usage: build.sh [test]
cd "$(dirname "$0")"
OUT=${2:-game.html}
{ cat head.html
cat <<'H'
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/shaders/CopyShader.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/shaders/LuminosityHighPassShader.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/EffectComposer.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/RenderPass.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/ShaderPass.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/UnrealBloomPass.js"></script>
<script>
(() => {
H
for f in js/00-core.js js/10-world.js js/11-world2.js js/12-heights.js js/20-render.js js/30-terrain.js js/40-places.js js/42-places2.js js/45-boot-world.js js/50-car.js js/52-cockpit.js js/55-support.js js/60-traffic.js js/70-police.js js/75-audio.js js/78-weather.js js/80-game.js js/81-jukai.js js/82-secrets.js js/83-lore.js js/84-heist.js js/85-hud.js js/86-perf.js js/87-net.js; do cat $f; done
if [ "$1" = "test" ]; then cat js/99-testhook.js; fi
printf '})();\n</script>\n</body>\n</html>\n'
} > "$OUT"
echo "built $OUT $(wc -c < "$OUT") bytes"
