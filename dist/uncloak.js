(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = global || self, global.Uncloak = factory());
}(this, function () { 'use strict';

  var UncloakItem = function UncloakItem(node, instance, options) {
    node.removeAttribute('data-uncloak-new');

    this.callbacks = { init: [], uncloak: [] };
    for (var key in this.callbacks) {
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
  };

  UncloakItem.prototype.init = function init () {
      var this$1 = this;

    if (this.lazyContent[0]) {
      this.lazyContentObserver = new IntersectionObserver(function (entries) {
        var entry = entries[0];
        if (entry.isIntersecting) {
          this$1.loadLazyContent();

          // images only need loading once, so stop observing once loaded
          this$1.lazyContentObserver.disconnect();
        }
      }, {
        rootMargin: '50%'
      });

      this.lazyContentObserver.observe(this.node);
    }

    this.runCallbacks('init');
  };

  UncloakItem.prototype.process = function process (base_delay) {
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
  };

  UncloakItem.prototype.uncloak = function uncloak () {
      var this$1 = this;

    if (!this.cloaked) {
      return
    }

    this.cloaked = false; // only trigger uncloak once
    var dy = (performance.now() - this.delayTimer.y0);
    var final_delay = this.delayTimer.y1 - dy;
    var doUncloak = function () {
      this$1.node.classList.remove('uncloak--cloaked');
      this$1.runCallbacks('uncloak');
    };

    if (final_delay <= 0) {
      doUncloak();
      return
    }
    setTimeout(doUncloak, final_delay);
  };

  UncloakItem.prototype.reset = function reset (reobserve) {
      if ( reobserve === void 0 ) reobserve = true;

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
  };

  // CALLBACK helper
  UncloakItem.prototype.runCallbacks = function runCallbacks (type) {
    var cb = this.callbacks[type];
    if (!cb || !cb.length) {
      return
    }
    for (var i = 0; i < cb.length; i++) {
      cb[i](this);
    }
  };

  // DELAY helper
  UncloakItem.prototype.createDelayTimeout = function createDelayTimeout (factor, type) {
    // requires user to input their own delay functions
    if (!this.delayTypes) {
      return 0
    }
    return (this.delayTypes[type](factor) || 0)
  };


  // MEDIA helpers
  UncloakItem.prototype.loadLazyContent = function loadLazyContent () {
      var this$1 = this;

    if (this.mediaLoaded() || this.lazyContentLoadStatus === 1) {
      return
    }
    this.lazyContentLoadStatus = 1;
    var left_to_load = this.lazyContent.length;

    var loaded = function (element) {
      return function () {
        element.removeEventListener('load', loaded, false);
        element.removeAttribute('data-uncloak-src');
        element.removeAttribute('data-uncloak-srcset');
        left_to_load -= 1;
        if (left_to_load === 0) {
          this$1.lazyContentLoadStatus = 2;
          if (this$1.uncloakReady) {
            this$1.uncloak();
          }
        }
      }
    };

    for (var i = 0; i < this.lazyContent.length; i++) {
      var el = this.lazyContent[i];
      var lazy_srcset = el.getAttribute('data-uncloak-srcset') || null;
      if (lazy_srcset) {
        el.srcset = lazy_srcset;
      }
      el.src = el.getAttribute('data-uncloak-src');
      el.addEventListener('load', loaded(el), false);
    }
  };
  UncloakItem.prototype.mediaLoaded = function mediaLoaded () {
    return (this.lazyContentLoadStatus === 2)
  };

  var VideoPlayer = function VideoPlayer(options, auto_init) {
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
  };

  VideoPlayer.prototype.init = function init () {
      var this$1 = this;

    if (this.loadStatus > 0) {
      return
    }

    this.loadStatus = 1;

    this.extractSources();

    if (!this.video.src) {
      this.setSrc();
    }

    this.video.addEventListener('loadedmetadata', function () {
      this$1.video.currentTime = 0.1;
      if (this$1.requiresResize) {
        this$1.resizeVideo();
      }
    }, false);

    this.video.addEventListener('durationchange', function () {
      this$1.loadStatus = 2;
      this$1.video.setAttribute('muted', '');
      this$1.runCallbacks('durationchange');
      if (this$1.autoplay) {
        this$1.play();
      }
    }, false);

    var firstPlayHook = function () {
      this$1.container.classList.add('video-loaded');
      this$1.runCallbacks('firstPlay');
      this$1.video.removeEventListener('playing', firstPlayHook, false);
    };
    this.video.addEventListener('playing', firstPlayHook, false);
    this.video.addEventListener('playing', function () {
      this$1.runCallbacks('playing');
    }, false);

    this.video.addEventListener('error', function () {
      this$1.disable();
    }, false);
  };

  VideoPlayer.prototype.disable = function disable () {
    this.container.classList.add('video-disabled');
    this.error = true;
    this.runCallbacks('error');
  };

  VideoPlayer.prototype.extractSources = function extractSources () {
    var sources = this.video.getAttribute('data-video-srcset') || null;
    if (sources !== null) {
      var srcset_regex = /^\s*(.+)\s+(\d+)([wh])?\s*$/;
      sources = sources.split(',');
      for (var i = 0; i < sources.length; i++) {
        var source = sources[i].match(srcset_regex);
        if (source) {
          this.sources.push({
            src: source[1],
            width: parseInt(source[2])
          });
        }
      }

      // sort sources by smallest -> largest widths
      this.sources.sort(function (a, b) {
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
  };

  VideoPlayer.prototype.play = function play () {
      var this$1 = this;

    if (this.isLoading() || !this.video.paused || this.promise !== null) {
      return
    }
    if (this.loadStatus === 0) {
      this.init();
    }

    var play_promise = this.video.play();
    if (play_promise !== undefined) {
      this.promise = play_promise;
      play_promise.then(function () {
        this$1.promise = null;
      }).catch(function () {
        if (this$1.promise.status && this$1.promise.status === 'rejected') {
          this$1.disable();
        }
      });
    }

    // on older versions of ios, durationchange event gets hits but media doesn't play
    // set a timeout for these devices and slow connections
    setTimeout(function () {
      if (this$1.video.paused) {
        this$1.disable();
      }
    }, 100);
  };

  VideoPlayer.prototype.pause = function pause () {
    if (this.pauseReady()) {
      this.video.pause();
    }
  };

  VideoPlayer.prototype.pauseReady = function pauseReady () {
    return (!this.video.paused && this.promise === null && this.loadStatus === 2)
  };

  VideoPlayer.prototype.reset = function reset () {
    if (this.pauseReady()) {
      this.video.pause();
      this.video.currentTime = 0.1;
    }
  };

  VideoPlayer.prototype.setSrc = function setSrc () {
    // nb safari 11 gets angry when setting source if video not muted
    // so muted attribute should be set in html
    if (this.isResponsive) {
      var width = this.container.clientWidth;
      var current_src = this.video.src.replace(/(https?:)/, '');
      var is_paused = this.video.paused;

      // sources are ordered small to large, so we want the next
      // largest source after the container width
      for (var i = 0; i < this.sources.length; i++) {
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
  };

  VideoPlayer.prototype.addCallback = function addCallback (type, fx) {
    this.callbacks[type].push(fx);
  };

  VideoPlayer.prototype.runCallbacks = function runCallbacks (type) {
    var cb = this.callbacks[type];
    if (!cb.length) {
      return
    }

    for (var i = 0; i < cb.length; i++) {
      cb[i]();
    }
  };

  VideoPlayer.prototype.isDisabled = function isDisabled () {
    return this.error
  };

  VideoPlayer.prototype.isPaused = function isPaused () {
    return this.video.paused
  };

  VideoPlayer.prototype.isLoaded = function isLoaded () {
    return (this.loadStatus === 2)
  };

  VideoPlayer.prototype.isLoading = function isLoading () {
    return (this.loadStatus === 1)
  };

  VideoPlayer.prototype.resizeVideo = function resizeVideo () {
    var video_ratio = this.video.videoHeight / this.video.videoWidth;
    var container_ratio = this.container.offsetHeight / this.container.offsetWidth;
    if (video_ratio <= container_ratio) {
      this.video.style.height = '100%';
      this.video.style.width = 'auto';
      return
    }
    this.video.style.height = 'auto';
    this.video.style.width = '100%';
  };

  var UncloakVideoItem = /*@__PURE__*/(function (UncloakItem) {
    function UncloakVideoItem(node, instance, options) {
      var this$1 = this;

      UncloakItem.call(this, node, instance, options);

      this.videoPlayer = null;
      this.videoAutoplay = !node.hasAttribute('data-uncloak-video-manual');

      if (typeof VideoPlayer !== 'undefined') {
        var container = node.querySelector('.' + node.getAttribute('data-uncloak-video'));
        this.videoPlayer = new VideoPlayer({ container: container, autoplay: 0 }, false);

        this.videoPlayer.addCallback('error', function () {
          this$1.loadLazyContent();
          this$1.uncloak();
        });

        if (this.videoAutoplay) {
          this.videoPlayer.addCallback('firstPlay', function () {
            this$1.uncloak();
          });

          var play = function () {
            this$1.toggleVideoPlay(true);
          };

          this.callbacks.uncloak.push(play);
        }
      }
    }

    if ( UncloakItem ) UncloakVideoItem.__proto__ = UncloakItem;
    UncloakVideoItem.prototype = Object.create( UncloakItem && UncloakItem.prototype );
    UncloakVideoItem.prototype.constructor = UncloakVideoItem;

    UncloakVideoItem.prototype.init = function init () {
      var this$1 = this;

      this.lazyContentObserver = new IntersectionObserver(function (entries) {
        var entry = entries[0];

        if (!this$1.videoPlayer.isDisabled()) {
          this$1.toggleVideoPlay(entry.isIntersecting);
          return
        }

        // Only handle lazy content if video is not working
        this$1.loadLazyContent();

        // can stop observing if we no longer need to play/pause video
        this$1.lazyContentObserver.disconnect();
      }, {
        rootMargin: '10%'
      });

      this.lazyContentObserver.observe(this.videoPlayer.container);
      this.runCallbacks('init');
    };

    // MEDIA helpers
    UncloakVideoItem.prototype.mediaLoaded = function mediaLoaded () {
      return (!this.videoPlayer.isDisabled() || this.lazyContentLoadStatus === 2)
    };

    UncloakVideoItem.prototype.toggleVideoPlay = function toggleVideoPlay (should_play) {
      if (should_play) {
        this.videoPlayer.play();
        return
      }
      this.videoPlayer.pause();
    };

    return UncloakVideoItem;
  }(UncloakItem));

  var Uncloak = function Uncloak(options) {
    this.items = [];
    this.hasResizeListener = false;
    this.nodeObserver = null;

    // Sent to UncloakItem
    this.itemOptions = {
      delayTypes: {},
      callbacks: {}
    };

    if (options && options.itemOptions) {
      for (var key in this.itemOptions) {
        if (options.itemOptions[key]) {
          this.itemOptions[key] = options.itemOptions[key] || {};
        }
      }
    }

    this.init();
  };

  Uncloak.prototype.init = function init () {
      var this$1 = this;

    if (!('IntersectionObserver' in window)) {
      console.error('uncloak: IntersectionObserver not supported in this browser.');
    }

    this.nodeObserver = new IntersectionObserver(function (entries) {
      var base_delay = 0;
      for (var i = 0; i < entries.length; i++) {
        var b_rect = entries[i].boundingClientRect;
        // browsers give negative result if entry covers the screen, so test to see if it covers the screen
        // use document.body.clientWidth instead of window.innerWidth for IE scrollbars
        var is_intersecting = entries[i].isIntersecting || entries[i].intersectionRatio > 0 || (b_rect.top <= window.innerHeight && b_rect.left <= 0 && b_rect.width >= document.body.clientWidth && b_rect.height >= window.innerHeight);

        if (is_intersecting) {
          var uncloak_item = this$1.getItemByNode(entries[i].target);
          var item_height = b_rect.height;
          var viewport_visibility_threshold = (uncloak_item.threshold * entries[i].rootBounds.height);
          var item_can_reach_threshold = (item_height >= viewport_visibility_threshold);
          var should_reveal_item = item_can_reach_threshold ? entries[i].intersectionRect.height >= viewport_visibility_threshold : is_intersecting;

          if (should_reveal_item) {
            base_delay = uncloak_item.process(base_delay);
            this$1.nodeObserver.unobserve(entries[i].target);
          }
        }
      }
    }, {
      rootMargin: '10% 0%',
      threshold: [ 0.1, 0.2, 0.3, 0.5, 0.6, 0.7, 0.8, 0.9 ]
    });

    // initial load
    this.findNewItems();
  };

  Uncloak.prototype.findNewItems = function findNewItems (raw_elements) {
      var this$1 = this;
      if ( raw_elements === void 0 ) raw_elements = document.querySelectorAll('[data-uncloak-new]');

    if (!raw_elements[0]) {
      return
    }

    var offset = this.items.length;
    var should_add_resize_listener = false;
    for (var i = 0; i < raw_elements.length; i++) {
      var raw_el = raw_elements[i];
      var true_index = offset + i;
      var uncloak_item = (void 0);

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
      var update_videos = function () {
        for (var i = 0; i < this$1.items.length; i++) {
          if ('videoPlayer' in this$1.items[i]) {
            if (this$1.items[i].videoPlayer.isResponsive) {
              this$1.items[i].videoPlayer.setSrc();
            }
            if (this$1.items[i].videoPlayer.requiresResize) {
              this$1.items[i].videoPlayer.resizeVideo();
            }
          }
        }
      };

      window.addEventListener('orientationchange', update_videos);
      window.addEventListener('resize', update_videos);
    }
  };

  Uncloak.prototype.getItemByNode = function getItemByNode (node) {
    var index = node.id.split('-')[1];
    return this.items[index]
  };

  return Uncloak;

}));
