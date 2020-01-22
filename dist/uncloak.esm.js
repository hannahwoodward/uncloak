class UncloakItem {
  constructor(node, instance, options) {
    node.removeAttribute('data-uncloak-new');

    this.callbacks = { init: [], uncloak: [] };
    for (const key in this.callbacks) {
      if (key in options.callbacks) {
        this.callbacks[key] = options.callbacks[key];
      }
    }
    this.cloaked = true;
    this.uncloakReady = false;
    this.delayTimer = {
      y0: 0,
      y1: null
    };
    this.delayType = node.getAttribute('data-uncloak-delay-type') || null;
    this.delayTypes = options.delayTypes || {};
    this.instance = instance;
    this.lazyContent = node.hasAttribute('data-uncloak-ignore-lazy') ? [] : node.querySelectorAll('[data-uncloak-src], [data-uncloak-srcset]');
    this.lazyContentLoadStatus = (this.lazyContent[0] ? -1 : 2); // NB: -1 => unloaded, 1 => loading, 2 => loaded
    this.node = node;
    this.threshold = parseFloat(node.getAttribute('data-uncloak-threshold')) || 0;

    this.lazyContentObserver = null;
  }

  init() {
    if (this.lazyContent[0]) {
      this.lazyContentObserver = new IntersectionObserver(entries => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          this.loadLazyContent();

          // images only need loading once, so stop observing once loaded
          this.lazyContentObserver.disconnect();
        }
      }, {
        rootMargin: '50%'
      });

      this.lazyContentObserver.observe(this.node);
    }

    this.runCallbacks('init');
  }

  process(base_delay) {
    if (this.cloaked) {
      // only calculate delay if item has a delay type and hasn't already been calculated
      if (this.delayType !== null && this.delayTimer.y1 === null) {
        this.delayTimer = {
          y0: performance.now(),
          y1: this.createDelayTimeout(base_delay, this.delayType)
        };
        base_delay++;
      }
      if (this.mediaLoaded()) {
        this.uncloak();
      } else {
        // set uncloak ready status for when images have finished loading
        this.uncloakReady = true;
      }
    }

    return base_delay
  }

  uncloak() {
    if (!this.cloaked) {
      return
    }

    this.cloaked = false; // only trigger uncloak once
    const dy = (performance.now() - this.delayTimer.y0);
    const final_delay = this.delayTimer.y1 - dy;
    const doUncloak = () => {
      this.node.classList.remove('uncloak--cloaked');
      this.runCallbacks('uncloak');
    };

    if (final_delay <= 0) {
      doUncloak();
      return
    }
    setTimeout(doUncloak, final_delay);
  }

  reset(reobserve = true) {
    this.cloaked = true;
    this.delayTimer = {
      y0: 0,
      y1: null
    };
    this.node.classList.add('uncloak--cloaked');
    // re-observe node in Uncloak instance
    if (reobserve) {
      this.instance.nodeObserver.observe(this.node);
    }
  }

  // CALLBACK helper
  runCallbacks(type) {
    const cb = this.callbacks[type];
    if (!cb || !cb.length) {
      return
    }
    for (let i = 0; i < cb.length; i++) {
      cb[i](this);
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
    this.lazyContentLoadStatus = 1;
    let left_to_load = this.lazyContent.length;

    const loaded = (element) => {
      return () => {
        element.removeEventListener('load', loaded, false);
        element.removeAttribute('data-uncloak-src');
        element.removeAttribute('data-uncloak-srcset');
        left_to_load -= 1;
        if (left_to_load === 0) {
          this.lazyContentLoadStatus = 2;
          if (this.uncloakReady) {
            this.uncloak();
          }
        }
      }
    };

    for (let i = 0; i < this.lazyContent.length; i++) {
      const el = this.lazyContent[i];
      const lazy_srcset = el.getAttribute('data-uncloak-srcset') || null;
      if (lazy_srcset) {
        el.srcset = lazy_srcset;
      }
      if (el.hasAttribute('data-uncloak-src')) {
        el.src = el.getAttribute('data-uncloak-src');
      }
      el.addEventListener('load', loaded(el), false);
    }
  }
  mediaLoaded() {
    return (this.lazyContentLoadStatus === 2)
  }
}

class VideoPlayer {
  constructor(options, auto_init) {
    this.container = options.container;
    this.video = options.video || options.container.querySelector('video');

    this.autoplay = options.autoplay || 0;
    this.error = false;
    this.isResponsive = false;
    this.loadStatus = 0; // 0 = not loaded, 1 = loading, 2 = loaded
    this.promise = null;
    this.requiresResize = this.container.hasAttribute('data-video-resize');
    this.sources = [];

    this.callbacks = {
      durationchange: [],
      firstPlay: [],
      playing: [],
      error: []
    };

    if (auto_init) {
      this.init();
    }
  }

  init() {
    if (this.loadStatus > 0) {
      return
    }

    this.loadStatus = 1;

    this.extractSources();

    if (!this.video.src) {
      this.setSrc();
    }

    this.video.addEventListener('loadedmetadata', () => {
      this.video.currentTime = 0.1;
      if (this.requiresResize) {
        this.resizeVideo();
      }
    }, false);

    this.video.addEventListener('durationchange', () => {
      this.loadStatus = 2;
      this.video.setAttribute('muted', '');
      this.runCallbacks('durationchange');
      if (this.autoplay) {
        this.play();
      }
    }, false);

    const firstPlayHook = () => {
      this.container.classList.add('video-loaded');
      this.runCallbacks('firstPlay');
      this.video.removeEventListener('playing', firstPlayHook, false);
    };
    this.video.addEventListener('playing', firstPlayHook, false);
    this.video.addEventListener('playing', () => {
      this.runCallbacks('playing');
    }, false);

    this.video.addEventListener('error', () => {
      this.disable();
    }, false);
  }

  disable() {
    this.container.classList.add('video-disabled');
    this.error = true;
    this.runCallbacks('error');
  }

  extractSources() {
    let sources = this.video.getAttribute('data-video-srcset') || null;
    if (sources !== null) {
      const srcset_regex = /^\s*(.+)\s+(\d+)([wh])?\s*$/;
      sources = sources.split(',');
      for (let i = 0; i < sources.length; i++) {
        const source = sources[i].match(srcset_regex);
        if (source) {
          this.sources.push({
            src: source[1],
            width: parseInt(source[2])
          });
        }
      }

      // sort sources by smallest -> largest widths
      this.sources.sort((a, b) => {
        return a.width - b.width
      });

    } else {
      sources = this.video.getAttribute('data-video-src');
      if (sources) {
        this.sources.push({ src: sources });
        this.video.removeAttribute('data-video-src');
      }

    }

    this.isResponsive = (this.sources.length > 1);
  }

  play() {
    if (this.isLoading() || !this.video.paused || this.promise !== null) {
      return
    }
    if (this.loadStatus === 0) {
      this.init();
    }

    const play_promise = this.video.play();
    if (play_promise !== undefined) {
      this.promise = play_promise;
      play_promise.then(() => {
        this.promise = null;
      }).catch(() => {
        if (this.promise.status && this.promise.status === 'rejected') {
          this.disable();
        }
      });
    }

    // on older versions of ios, durationchange event gets hits but media doesn't play
    // set a timeout for these devices and slow connections
    setTimeout(() => {
      if (this.video.paused) {
        this.disable();
      }
    }, 100);
  }

  pause() {
    if (this.pauseReady()) {
      this.video.pause();
    }
  }

  pauseReady() {
    return (!this.video.paused && this.promise === null && this.loadStatus === 2)
  }

  reset() {
    if (this.pauseReady()) {
      this.video.pause();
      this.video.currentTime = 0.1;
    }
  }

  setSrc() {
    // nb safari 11 gets angry when setting source if video not muted
    // so muted attribute should be set in html
    if (this.isResponsive) {
      const width = this.container.clientWidth;
      const current_src = this.video.src.replace(/(https?:)/, '');
      const is_paused = this.video.paused;

      // sources are ordered small to large, so we want the next
      // largest source after the container width
      for (let i = 0; i < this.sources.length; i++) {
        if (width <= this.sources[i].width || i === this.sources.length - 1) {
          if (current_src !== this.sources[i].src) {
            this.video.src = this.sources[i].src;
            if (!is_paused) {
              this.play();
            }
          }
          return
        }
      }
    }

    this.video.src = this.sources[0].src;
  }

  addCallback(type, fx) {
    this.callbacks[type].push(fx);
  }

  runCallbacks(type) {
    const cb = this.callbacks[type];
    if (!cb.length) {
      return
    }

    for (let i = 0; i < cb.length; i++) {
      cb[i]();
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
    const video_ratio = this.video.videoHeight / this.video.videoWidth;
    const container_ratio = this.container.offsetHeight / this.container.offsetWidth;
    if (video_ratio <= container_ratio) {
      this.video.style.height = '100%';
      this.video.style.width = 'auto';
      return
    }
    this.video.style.height = 'auto';
    this.video.style.width = '100%';
  }
}

class UncloakVideoItem extends UncloakItem {
  constructor(node, instance, options) {
    super(node, instance, options);

    this.videoPlayer = null;
    this.videoAutoplay = !node.hasAttribute('data-uncloak-video-manual');

    if (typeof VideoPlayer !== 'undefined') {
      const container = node.querySelector('.' + node.getAttribute('data-uncloak-video'));
      this.videoPlayer = new VideoPlayer({ container: container, autoplay: 0 }, false);

      this.videoPlayer.addCallback('error', () => {
        this.loadLazyContent();
        this.uncloak();
      });

      if (this.videoAutoplay) {
        this.videoPlayer.addCallback('firstPlay', () => {
          this.uncloak();
        });

        const play = () => {
          this.toggleVideoPlay(true);
        };

        this.callbacks.uncloak.push(play);
      }
    }
  }

  init() {
    this.lazyContentObserver = new IntersectionObserver(entries => {
      const entry = entries[0];

      if (!this.videoPlayer.isDisabled()) {
        this.toggleVideoPlay(entry.isIntersecting);
        return
      }

      // Only handle lazy content if video is not working
      this.loadLazyContent();

      // can stop observing if we no longer need to play/pause video
      this.lazyContentObserver.disconnect();
    }, {
      rootMargin: '10%'
    });

    this.lazyContentObserver.observe(this.videoPlayer.container);
    this.runCallbacks('init');
  }

  // MEDIA helpers
  mediaLoaded() {
    return (!this.videoPlayer.isDisabled() || this.lazyContentLoadStatus === 2)
  }

  toggleVideoPlay(should_play) {
    if (should_play) {
      this.videoPlayer.play();
      return
    }
    this.videoPlayer.pause();
  }
}

class Uncloak {
  constructor(options) {
    this.items = [];
    this.hasResizeListener = false;
    this.nodeObserver = null;

    // Sent to UncloakItem
    this.itemOptions = {
      delayTypes: {},
      callbacks: {}
    };

    if (options && options.itemOptions) {
      for (const key in this.itemOptions) {
        if (options.itemOptions[key]) {
          this.itemOptions[key] = options.itemOptions[key] || {};
        }
      }
    }

    this.init();
  }

  init() {
    if (!('IntersectionObserver' in window)) {
      console.error('uncloak: IntersectionObserver not supported in this browser.');
    }

    this.nodeObserver = new IntersectionObserver(entries => {
      let base_delay = 0;
      for (let i = 0; i < entries.length; i++) {
        const b_rect = entries[i].boundingClientRect;
        // browsers give negative result if entry covers the screen, so test to see if it covers the screen
        // use document.body.clientWidth instead of window.innerWidth for IE scrollbars
        const is_intersecting = entries[i].isIntersecting || entries[i].intersectionRatio > 0 || (b_rect.top <= window.innerHeight && b_rect.left <= 0 && b_rect.width >= document.body.clientWidth && b_rect.height >= window.innerHeight);

        if (is_intersecting) {
          const uncloak_item = this.getItemByNode(entries[i].target);
          const item_height = b_rect.height;
          const viewport_visibility_threshold = (uncloak_item.threshold * entries[i].rootBounds.height);
          const item_can_reach_threshold = (item_height >= viewport_visibility_threshold);
          const should_reveal_item = item_can_reach_threshold ? entries[i].intersectionRect.height >= viewport_visibility_threshold : is_intersecting;

          if (should_reveal_item) {
            base_delay = uncloak_item.process(base_delay);
            this.nodeObserver.unobserve(entries[i].target);
          }
        }
      }
    }, {
      rootMargin: '10% 0%',
      threshold: [ 0.1, 0.2, 0.3, 0.5, 0.6, 0.7, 0.8, 0.9 ]
    });

    // initial load
    this.findNewItems();
  }

  findNewItems(raw_elements = document.querySelectorAll('[data-uncloak-new]')) {
    if (!raw_elements[0]) {
      return
    }

    const offset = this.items.length;
    let should_add_resize_listener = false;
    for (let i = 0; i < raw_elements.length; i++) {
      const raw_el = raw_elements[i];
      const true_index = offset + i;
      let uncloak_item;

      if (raw_el.hasAttribute('data-uncloak-video')) {
        uncloak_item = new UncloakVideoItem(raw_el, this, this.itemOptions);
        should_add_resize_listener = true;
      } else {
        uncloak_item = new UncloakItem(raw_el, this, this.itemOptions);
      }

      raw_el.id = 'uncloak-' + true_index;
      uncloak_item.init();
      this.nodeObserver.observe(raw_el);
      this.items.push(uncloak_item);
    }

    if (should_add_resize_listener && !this.hasResizeListener) {
      this.hasResizeListener = true;
      const update_videos = () => {
        for (let i = 0; i < this.items.length; i++) {
          if ('videoPlayer' in this.items[i]) {
            if (this.items[i].videoPlayer.isResponsive) {
              this.items[i].videoPlayer.setSrc();
            }
            if (this.items[i].videoPlayer.requiresResize) {
              this.items[i].videoPlayer.resizeVideo();
            }
          }
        }
      };

      window.addEventListener('orientationchange', update_videos);
      window.addEventListener('resize', update_videos);
    }
  }

  getItemByNode(node) {
    const index = node.id.split('-')[1];
    return this.items[index]
  }
}

export default Uncloak;
