# Marble Lab (vanilla JS)

Interactive marble pattern generator using a single nonlinear model (domain-warped FBM with cosine palette).

## Run locally
Open `index.html` in the browser (no build step).

## Deploy to Vercel
This can be deployed as a static site.

```bash
vercel init            # or vercel link
vercel --prod
```

## Controls
- Scale
- Distortion
- Complexity (octaves)
- Contrast
- Seed (表示のみ; ランダムボタンか再生成で更新)
- Dark/light vein strengths, blur sigma
- Regenerate / random seed / export PNG

## Notes
- The simulation grid runs at 220×220 and is scaled up; feel free to change `simSize` in `script.js`.
- Colors come from a tiny palette LUT for speed; tweak `palette` in `script.js` to re-theme.
# marble
