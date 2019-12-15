export class VideoPlayer {
  constructor(options, auto_init) {
    this.container = options.container
    this.video = options.video || options.container.querySelector('video')

    this.autoplay = options.autoplay || 0
    this.error = false
    this.isResponsive = false
    this.loadStatus = 0 // 0 = not loaded, 1 = loading, 2 = loaded
    this.promise = null
    this.requiresResize = this.container.hasAttribute('data-video-resize')
    this.sources = []

    this.callbacks = {
      durationchange: [],
      firstPlay: [],
      playing: [],
      error: []
    }

    if (auto_init) {
      this.init()
    }
  }

  init() {
    if (this.loadStatus > 0) {
      return
    }

    this.loadStatus = 1

    this.extractSources()

    if (!this.video.src) {
      this.setSrc()
    }

    this.video.addEventListener('loadedmetadata', () => {
      this.video.currentTime = 0.1
      if (this.requiresResize) {
        this.resizeVideo()
      }
    }, false)

    this.video.addEventListener('durationchange', () => {
      this.loadStatus = 2
      this.video.setAttribute('muted', '')
      this.runCallbacks('durationchange')
      if (this.autoplay) {
        this.play()
      }
    }, false)

    const firstPlayHook = () => {
      this.container.classList.add('video-loaded')
      this.runCallbacks('firstPlay')
      this.video.removeEventListener('playing', firstPlayHook, false)
    }
    this.video.addEventListener('playing', firstPlayHook, false)
    this.video.addEventListener('playing', () => {
      this.runCallbacks('playing')
    }, false)

    this.video.addEventListener('error', () => {
      this.disable()
    }, false)
  }

  disable() {
    this.container.classList.add('video-disabled')
    this.error = true
    this.runCallbacks('error')
  }

  extractSources() {
    let sources = this.video.getAttribute('data-video-srcset') || null
    if (sources !== null) {
      const srcset_regex = /^\s*(.+)\s+(\d+)([wh])?\s*$/
      sources = sources.split(',')
      for (let i = 0; i < sources.length; i++) {
        const source = sources[i].match(srcset_regex)
        if (source) {
          this.sources.push({
            src: source[1],
            width: parseInt(source[2])
          })
        }
      }

      // sort sources by smallest -> largest widths
      this.sources.sort((a, b) => {
        return a.width - b.width
      })

    } else {
      sources = this.video.getAttribute('data-video-src')
      if (sources) {
        this.sources.push({ src: sources })
        this.video.removeAttribute('data-video-src')
      }

    }

    this.isResponsive = (this.sources.length > 1)
  }

  play() {
    if (this.isLoading() || !this.video.paused || this.promise !== null) {
      return
    }
    if (this.loadStatus === 0) {
      this.init()
    }

    const play_promise = this.video.play()
    if (play_promise !== undefined) {
      this.promise = play_promise
      play_promise.then(() => {
        this.promise = null
      }).catch(() => {
        if (this.promise.status && this.promise.status === 'rejected') {
          this.disable()
        }
      })
    }

    // on older versions of ios, durationchange event gets hits but media doesn't play
    // set a timeout for these devices and slow connections
    setTimeout(() => {
      if (this.video.paused) {
        this.disable()
      }
    }, 100)
  }

  pause() {
    if (this.pauseReady()) {
      this.video.pause()
    }
  }

  pauseReady() {
    return (!this.video.paused && this.promise === null && this.loadStatus === 2)
  }

  reset() {
    if (this.pauseReady()) {
      this.video.pause()
      this.video.currentTime = 0.1
    }
  }

  setSrc() {
    // nb safari 11 gets angry when setting source if video not muted
    // so muted attribute should be set in html
    if (this.isResponsive) {
      const width = this.container.clientWidth
      const current_src = this.video.src.replace(/(https?:)/, '')
      const is_paused = this.video.paused

      // sources are ordered small to large, so we want the next
      // largest source after the container width
      for (let i = 0; i < this.sources.length; i++) {
        if (width <= this.sources[i].width || i === this.sources.length - 1) {
          if (current_src !== this.sources[i].src) {
            this.video.src = this.sources[i].src
            if (!is_paused) {
              this.play()
            }
          }
          return
        }
      }
    }

    this.video.src = this.sources[0].src
  }

  addCallback(type, fx) {
    this.callbacks[type].push(fx)
  }

  runCallbacks(type) {
    const cb = this.callbacks[type]
    if (!cb.length) {
      return
    }

    for (let i = 0; i < cb.length; i++) {
      cb[i]()
    }
  }

  isDisabled() {
    return this.error
  }

  isPaused() {
    return this.video.paused
  }

  isLoaded() {
    return (this.loadStatus === 2)
  }

  isLoading() {
    return (this.loadStatus === 1)
  }

  resizeVideo() {
    const video_ratio = this.video.videoHeight / this.video.videoWidth
    const container_ratio = this.container.offsetHeight / this.container.offsetWidth
    if (video_ratio <= container_ratio) {
      this.video.style.height = '100%'
      this.video.style.width = 'auto'
      return
    }
    this.video.style.height = 'auto'
    this.video.style.width = '100%'
  }
}
