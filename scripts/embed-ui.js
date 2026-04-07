/**
 * Build 후 dist의 UI HTML + JS + CSS를 하나의 HTML 문자열로 인라인하여
 * html-embed.generated.ts 로 출력합니다. (Figma iframe에서 외부 리소스 로드 불가 대응)
 */
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const dist = resolve(root, 'dist')

// Vite가 dist/ui.html 또는 dist/src/ui.html 로 출력할 수 있음
const htmlPath = existsSync(resolve(dist, 'ui.html'))
  ? resolve(dist, 'ui.html')
  : resolve(dist, 'src', 'ui.html')

if (!existsSync(htmlPath)) {
  console.error('ERROR: UI HTML을 찾을 수 없습니다. 먼저 "npm run build:ui" 를 실행하세요.')
  process.exit(1)
}

const htmlDir = dirname(htmlPath)
const outPath = resolve(root, 'html-embed.generated.ts')

let html = readFileSync(htmlPath, 'utf-8')

// <script type="module" src="../ui.js"> → 인라인
html = html.replace(/<script[^>]+src="([^"]+)"[^>]*><\/script>/gi, (tag, src) => {
  const jsPath = resolve(htmlDir, src)
  try {
    const jsContent = readFileSync(jsPath, 'utf-8')
    return `<script type="module">${jsContent}</script>`
  } catch (e) {
    console.warn('스크립트 인라인 실패:', src, e.message)
    return ''
  }
})

// <link rel="stylesheet" href="../ui-ui.css"> → 인라인
html = html.replace(/<link[^>]+href="([^"]+\.css)"[^>]*>/gi, (tag, href) => {
  const cssPath = resolve(htmlDir, href)
  try {
    const cssContent = readFileSync(cssPath, 'utf-8')
    return `<style>${cssContent}</style>`
  } catch (e) {
    console.warn('CSS 인라인 실패:', href, e.message)
    return tag
  }
})

const escaped = html
  .replace(/\\/g, '\\\\')
  .replace(/`/g, '\\`')
  .replace(/\$/g, '\\$')
  .replace(/\r\n/g, '\\n')
  .replace(/\n/g, '\\n')
  .replace(/\r/g, '\\n')

writeFileSync(outPath, `// Auto-generated. Do not edit.\nexport const __html__ = \`${escaped}\`;\n`, 'utf-8')
console.log('Generated html-embed.generated.ts')
