import { UncloakItem } from './uncloak-item.js'
import { UncloakVideoItem } from './uncloak-video-item.js'

export default class Uncloak {
  constructor(options) {
    this.items = []
    this.hasResizeListener = false
    this.nodeObserver = null
    this.isIE = (typeof document !== 'undefined' && document.documentMode)

    // Sent to UncloakItem
    this.itemOptions = {
      delayTypes: {},
      callbacks: {}
    }

    if (options && options.itemOptions) {
      for (const key in this.itemOptions) {
        if (options.itemOptions[key]) {
          this.itemOptions[key] = options.itemOptions[key] || {}
        }
      }
    }

    this.init()
  }

  init() {
    if (!('IntersectionObserver' in window)) {
      console.error('uncloak: IntersectionObserver not supported in this browser.')
    }

    this.nodeObserver = new IntersectionObserver(entries => {
      entries.reduce((base_delay, entry) => {
        let should_reveal_item = false
        let uncloak_item = null

        // Use try/catch as some browsers report entry.rootBounds as null in iframe
        try {
          const b_rect = entry.boundingClientRect
          // browsers give negative result if entry covers the screen, so test to see if it covers the screen
          // use document.body.clientWidth instead of window.innerWidth for IE scrollbars
          const is_intersecting = entry.isIntersecting || entry.intersectionRatio > 0 || (b_rect.top <= window.innerHeight && b_rect.left <= 0 && b_rect.width >= document.body.clientWidth && b_rect.height >= window.innerHeight)

          if (!is_intersecting) {
            return base_delay
          }

          uncloak_item = this.getItemByNode(entry.target)
          const item_height = b_rect.height
          const viewport_visibility_threshold = (uncloak_item.threshold * entry.rootBounds.height)
          const item_can_reach_threshold = (item_height >= viewport_visibility_threshold)
          should_reveal_item = item_can_reach_threshold ? entry.intersectionRect.height >= viewport_visibility_threshold : is_intersecting
        } catch (e) {
          // Silently fail, just reveal item
          should_reveal_item = true
          uncloak_item = this.getItemByNode(entry.target)
        }

        if (should_reveal_item && uncloak_item) {
          base_delay = uncloak_item.process(base_delay)
          this.nodeObserver.unobserve(entry.target)
        }

        return base_delay
      }, 0)
    }, {
      rootMargin: '10% 0%',
      threshold: [ 0.1, 0.2, 0.3, 0.5, 0.6, 0.7, 0.8, 0.9 ]
    })

    // initial load
    this.findNewItems()
  }

  findNewItems(raw_elements = document.querySelectorAll('[data-uncloak-new]')) {
    if (!raw_elements[0]) {
      return
    }

    const offset = this.items.length
    let should_add_resize_listener = false
    for (let i = 0; i < raw_elements.length; i++) {
      const raw_el = raw_elements[i]
      const true_index = offset + i
      let uncloak_item

      if (raw_el.hasAttribute('data-uncloak-video')) {
        uncloak_item = new UncloakVideoItem(raw_el, this, this.itemOptions)
        should_add_resize_listener = true
      } else {
        uncloak_item = new UncloakItem(raw_el, this, this.itemOptions)
      }

      raw_el.id = 'uncloak-' + true_index
      uncloak_item.init()
      this.nodeObserver.observe(raw_el)
      this.items.push(uncloak_item)
    }

    if (should_add_resize_listener && !this.hasResizeListener) {
      this.hasResizeListener = true
      const update_videos = () => {
        for (let i = 0; i < this.items.length; i++) {
          if ('videoPlayer' in this.items[i]) {
            if (this.items[i].videoPlayer.isResponsive) {
              this.items[i].videoPlayer.setSrc()
            }
            if (this.items[i].videoPlayer.requiresResize) {
              this.items[i].videoPlayer.resizeVideo()
            }
          }
        }
      }

      window.addEventListener('orientationchange', update_videos)
      window.addEventListener('resize', update_videos)
    }
  }

  getItemByNode(node) {
    const index = node.id.split('-')[1]
    return this.items[index]
  }
}
