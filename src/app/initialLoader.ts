import { resources } from './imageResources'
import { currentSiteRoute, finishInitialLoading, prepareStartup, resourceProgress } from './siteLoading'

const wait = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, ms))
async function waitForPaintedPage() {
  const deadline = performance.now() + 60000
  while (!document.querySelector('#root .react-route')) {
    if (performance.now() > deadline) throw new Error('Page did not mount')
    await wait(50)
  }
  // All home images are made eager independently of scroll; internal albums only
  // decode their eager/visible entry images, not the whole album behind the gate.
  const images = [...document.querySelectorAll<HTMLImageElement>(
    '#root img[loading="eager"], #root .persistent-site-logo img')]
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  await Promise.all(images.map(image => {
    // A previous network error remains on an existing DOM img even when a
    // separate preloader has retried successfully; reattach that cached URL.
    if (image.complete && !image.naturalWidth) image.src = image.currentSrc || image.src
    return image.decode()
  }))
  await document.fonts.ready
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
}

export async function dismissInitialLoader() {
  const loader = document.getElementById('site-loader')
  if (!loader) { finishInitialLoading('degraded'); return }
  const label = document.getElementById('site-loader-label')!
  const progress = document.getElementById('site-loader-progress') as HTMLProgressElement
  const actions = document.getElementById('site-loader-actions')!
  const retryButton = document.getElementById('site-loader-retry') as HTMLButtonElement
  const continueButton = document.getElementById('site-loader-continue') as HTMLButtonElement
  let slow = false
  let domFailed = false
  let retry = false
  let completed = false
  let disposeProgress: () => void = () => undefined
  const slowTimer = window.setTimeout(() => { slow = true; actions.hidden = false; continueButton.disabled = !document.querySelector('#root .react-route') }, 10000)
  try {
    for (;;) {
      const pending = prepareStartup(currentSiteRoute(), retry)
      const update = () => {
        const state = resourceProgress(pending.ids)
        progress.max = Math.max(state.total, 1)
        progress.value = state.ready
        label.textContent = domFailed || state.failed
          ? `Не всё удалось загрузить. Готово ${state.ready} из ${state.total}.`
          : `Подготовка сайта · ${state.ready} из ${state.total}`
        actions.hidden = !slow && !domFailed && state.failed === 0
        continueButton.disabled = !document.querySelector('#root .react-route')
        retryButton.hidden = !domFailed && state.failed === 0
      }
      disposeProgress()
      disposeProgress = resources.subscribe(update)
      update()
      const choice = new Promise<'retry' | 'continue'>(resolve => {
        retryButton.onclick = () => resolve('retry')
        continueButton.onclick = () => resolve('continue')
      })
      const readiness = pending.finished.then(async success => {
        if (!success) return false
        try { await waitForPaintedPage(); return true }
        catch { domFailed = true; update(); return false }
      })
      const result = await Promise.race([readiness, choice])
      if (result === true) { completed = true; break }
      const action = result === false ? await choice : result
      if (action === 'continue') break
      retry = true
      domFailed = false
    }
  } finally {
    window.clearTimeout(slowTimer)
    disposeProgress()
    retryButton.onclick = continueButton.onclick = null
    document.documentElement.removeAttribute('data-site-loading')
    finishInitialLoading(completed ? 'ready' : 'degraded')
    loader.classList.add('is-hidden')
    window.setTimeout(() => loader.remove(), 440)
  }
}
