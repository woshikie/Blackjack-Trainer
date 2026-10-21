// UI regression: the Practice/Live switch must stay tappable at mobile widths.
// Regression origin: without flex-wrap on .topbar, the overflow:hidden
// mode-switch collapsed to ~2px on narrow screens and taps hit other controls.
import { chromium, devices } from 'playwright'
import { spawn } from 'node:child_process'

const BASE = 'http://localhost:4173/Blackjack-Trainer/'
const failures = []
function fail(message) {
  failures.push(message)
  console.error('FAIL:', message)
}

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const res = await fetch(BASE)
      if (res.ok) return
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  fail('vite preview never came up')
}

const preview = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'ignore' })
const stopPreview = () => preview.kill()
process.on('exit', stopPreview)
try {
  await waitForServer()
  const browser = await chromium.launch()

  for (const [label, contextOptions] of [
    ['mobile-375', { ...devices['iPhone 13'], viewport: { width: 375, height: 667 } }],
    ['mobile-320', { ...devices['iPhone 13'], viewport: { width: 320, height: 568 } }],
    ['desktop-1280', { ...devices['Desktop Chrome'], hasTouch: true }],
  ]) {
    const context = await browser.newContext(contextOptions)
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (err) => errors.push(err.message))

    await page.goto(BASE, { waitUntil: 'networkidle' })
    await page.evaluate(() => localStorage.clear())
    await page.reload({ waitUntil: 'networkidle' })

    const modeSwitch = page.locator('.mode-switch')
    const box = await modeSwitch.boundingBox()
    if (!box) fail(`${label}: mode switch missing`)
    else if (box.width < 80) fail(`${label}: mode switch collapsed to ${box.width}px wide`)
    else console.log(`${label}: mode switch ${Math.round(box.width)}px wide — ok`)

    // Real touch taps: Live on…
    await modeSwitch.locator('.mode', { hasText: 'Live' }).tap()
    await modeSwitch.locator('.mode', { hasText: 'Live' }).waitFor({ state: 'visible' })
    const liveShown = (await page.locator('.live-companion').count()) === 1
    const practiceChromeHidden = (await page.locator('.bank-controls').count()) === 0
    if (!liveShown) fail(`${label}: Live view not shown after tapping Live`)
    if (!practiceChromeHidden) fail(`${label}: practice chrome still visible in live mode`)

    // …in live mode (no bank controls) the topbar is at its most cramped:
    // the title must never paint over the switch
    const overlap = await page.evaluate(() => {
      const title = document.querySelector('.topbar h1')?.getBoundingClientRect()
      const modeSwitch = document.querySelector('.mode-switch')?.getBoundingClientRect()
      if (!title || !modeSwitch) return false
      return !(
        title.right < modeSwitch.left ||
        modeSwitch.right < title.left ||
        title.bottom < modeSwitch.top ||
        modeSwitch.bottom < title.top
      )
    })
    if (overlap) fail(`${label}: topbar title overlaps the mode switch in live mode`)

    // …and Practice back
    await modeSwitch.locator('.mode', { hasText: 'Practice' }).tap()
    await modeSwitch.locator('.mode', { hasText: 'Practice' }).waitFor({ state: 'visible' })
    const practiceBack = (await page.locator('.bank-controls').count()) === 1
    if (!practiceBack) fail(`${label}: practice view did not return`)

    if (errors.length > 0) fail(`${label}: page errors ${JSON.stringify(errors)}`)
    await context.close()
  }

  await browser.close()
} finally {
  stopPreview()
}

if (failures.length > 0) {
  console.error(`${failures.length} failure(s)`)
  process.exit(1)
}
console.log('ui test: all checks passed')
