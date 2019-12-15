import { VideoPlayer } from './video-player.js'
import { UncloakItem } from './uncloak-item.js'

export class UncloakVideoItem extends UncloakItem {
  constructor(node, instance, options) {
    super(node, instance, options)

    this.videoPlayer = null
    this.videoAutoplay = !node.hasAttribute('data-uncloak-video-manual')

    if (typeof VideoPlayer !== 'undefined') {
      const container = node.querySelector('.' + node.getAttribute('data-uncloak-video'))
      this.videoPlayer = new VideoPlayer({ container: container, autoplay: 0 }, false)

      this.videoPlayer.addCallback('error', () => {
        this.loadLazyContent()
        this.uncloak()
      })

      if (this.videoAutoplay) {
        this.videoPlayer.addCallback('firstPlay', () => {
          this.uncloak()
        })

        const play = () => {
          this.toggleVideoPlay(true)
        }

        this.callbacks.uncloak.push(play)
      }
    }
  }

  init() {
    this.lazyContentObserver = new IntersectionObserver(entries => {
      const entry = entries[0]

      if (!this.videoPlayer.isDisabled()) {
        this.toggleVideoPlay(entry.isIntersecting)
        return
      }

      // Only handle lazy content if video is not working
      this.loadLazyContent()

      // can stop observing if we no longer need to play/pause video
      this.lazyContentObserver.disconnect()
    }, {
      rootMargin: '10%'
    })

    this.lazyContentObserver.observe(this.videoPlayer.container)
    this.runCallbacks('init')
  }

  // MEDIA helpers
  mediaLoaded() {
    return (!this.videoPlayer.isDisabled() || this.lazyContentLoadStatus === 2)
  }

  toggleVideoPlay(should_play) {
    if (should_play) {
      this.videoPlayer.play()
      return
    }
    this.videoPlayer.pause()
  }
}
