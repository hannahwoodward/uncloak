export class VideoPlayer {
  constructor(options, auto_init) {
    this.container = options.container
    this.video = options.video || options.container.querySelector('video')

    this.promise = null
    this.loadStatus = 0 // 0 = not loaded, 1 = loading, 2 = loaded
    this.error = false
    this.requiresResize = this.container.hasAttribute('data-video-resize')
    this.autoplay = options.autoplay || 0

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
    if (!this.video.src) {
      // nb safari 11 gets angry when setting source if video not muted
      // so muted attribute should be set in html
      this.video.src = this.video.getAttribute('data-src')
      this.video.removeAttribute('data-src')
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

  disable() {
    this.container.classList.add('video-disabled')
    this.error = true
    this.runCallbacks('error')
  }

  pause() {
    if (this.pauseReady()) {
      this.video.pause()
    }
  }

  reset() {
    if (this.pauseReady()) {
      this.video.pause()
      this.video.currentTime = 0.1
    }
  }

  pauseReady() {
    return (!this.video.paused && this.promise === null && this.loadStatus === 2)
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
