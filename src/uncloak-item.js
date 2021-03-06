export class UncloakItem {
  constructor(node, instance, options) {
    node.removeAttribute('data-uncloak-new')

    this.callbacks = { init: [], uncloak: [] }
    for (const key in this.callbacks) {
      if (key in options.callbacks) {
        this.callbacks[key] = options.callbacks[key]
      }
    }

    this.cloaked = true
    this.uncloakReady = false
    this.delayTimer = {
      y0: 0,
      y1: null
    }
    this.delayType = node.getAttribute('data-uncloak-delay-type') || null
    this.delayTypes = options.delayTypes || {}
    this.instance = instance
    this.lazyContent = node.hasAttribute('data-uncloak-ignore-lazy') ? [] : Array.from(node.querySelectorAll('[data-uncloak-src], [data-uncloak-srcset], [data-uncloak-picture]')).filter(el => !el.hasAttribute('data-uncloak-ignore'))
    this.lazyContentLoadStatus = (this.lazyContent[0] ? -1 : 2) // NB: -1 => unloaded, 1 => loading, 2 => loaded
    this.node = node
    this.threshold = parseFloat(node.getAttribute('data-uncloak-threshold')) || 0

    this.lazyContentObserver = null
  }

  init() {
    if (this.lazyContent[0]) {
      this.lazyContentObserver = new IntersectionObserver(entries => {
        const entry = entries[0]
        if (entry.isIntersecting) {
          this.loadLazyContent()

          // images only need loading once, so stop observing once loaded
          this.lazyContentObserver.disconnect()
        }
      }, {
        rootMargin: '50%'
      })

      this.lazyContentObserver.observe(this.node)
    }

    this.runCallbacks('init')
  }

  process(base_delay) {
    if (this.cloaked) {
      // only calculate delay if item has a delay type and hasn't already been calculated
      if (this.delayType !== null && this.delayTimer.y1 === null) {
        this.delayTimer = {
          y0: performance.now(),
          y1: this.createDelayTimeout(base_delay, this.delayType)
        }
        base_delay++
      }
      if (this.mediaLoaded()) {
        this.uncloak()
      } else {
        // set uncloak ready status for when images have finished loading
        this.uncloakReady = true
      }
    }

    return base_delay
  }

  uncloak() {
    if (!this.cloaked) {
      return
    }

    this.cloaked = false // only trigger uncloak once
    const dy = (performance.now() - this.delayTimer.y0)
    const final_delay = this.delayTimer.y1 - dy
    const doUncloak = () => {
      this.node.classList.remove('uncloak--cloaked')
      this.runCallbacks('uncloak')
    }

    if (final_delay <= 0) {
      doUncloak()
      return
    }
    setTimeout(doUncloak, final_delay)
  }

  reset(reobserve = true) {
    this.cloaked = true
    this.delayTimer = {
      y0: 0,
      y1: null
    }
    this.node.classList.add('uncloak--cloaked')
    // re-observe node in Uncloak instance
    if (reobserve) {
      this.instance.nodeObserver.observe(this.node)
    }
  }

  // CALLBACK helper
  runCallbacks(type) {
    const cb = this.callbacks[type]
    if (!cb || !cb.length) {
      return
    }
    for (let i = 0; i < cb.length; i++) {
      cb[i](this)
    }
  }

  // DELAY helper
  createDelayTimeout(factor, type) {
    // requires user to input their own delay functions
    if (!this.delayTypes) {
      return 0
    }
    return (this.delayTypes[type](factor) || 0)
  }


  // MEDIA helpers
  loadLazyContent() {
    if (this.mediaLoaded() || this.lazyContentLoadStatus === 1) {
      return
    }

    this.lazyContentLoadStatus = 1
    let left_to_load = this.lazyContent.length

    const loaded = (root_element, listener_element) => {
      return () => {
        listener_element.removeEventListener('load', loaded, false)
        root_element.removeAttribute('data-uncloak-src')
        root_element.removeAttribute('data-uncloak-srcset')
        root_element.removeAttribute('data-uncloak-ie-src')
        root_element.removeAttribute('data-uncloak-alt')
        root_element.removeAttribute('data-uncloak-class')
        root_element.removeAttribute('data-uncloak-picture')
        left_to_load -= 1
        if (left_to_load === 0) {
          this.lazyContentLoadStatus = 2
          if (this.uncloakReady) {
            this.uncloak()
          }
        }
      }
    }

    for (let i = 0; i < this.lazyContent.length; i++) {
      const el = this.lazyContent[i]
      const lazy_srcset = el.getAttribute('data-uncloak-srcset') || null
      let listener_el = el

      if (lazy_srcset) {
        el.srcset = lazy_srcset
      }
      if (el.hasAttribute('data-uncloak-src')) {
        el.src = el.getAttribute('data-uncloak-src')
      }

      if (el.hasAttribute('data-uncloak-picture')) {
        const img = document.createElement('img')
        listener_el = img

        if (this.instance.isIE && el.hasAttribute('data-uncloak-ie-src')) {
          img.src = el.getAttribute('data-uncloak-ie-src')
        }

        if (el.hasAttribute('data-uncloak-alt')) {
          img.alt = el.getAttribute('data-uncloak-alt')
        }

        if (el.hasAttribute('data-uncloak-class')) {
          img.className = el.getAttribute('data-uncloak-class')
        }

        el.appendChild(img)
      }

      listener_el.addEventListener('load', loaded(el, listener_el), false)
    }
  }
  mediaLoaded() {
    return (this.lazyContentLoadStatus === 2)
  }
}
