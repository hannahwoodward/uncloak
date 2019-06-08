/* global VideoPlayer */
// import { VideoPlayer } from './video-player.js';
import { UncloakItem } from './uncloak-item.js';

export class UncloakVideoItem extends UncloakItem {
  constructor( node, options ) {
    super( node, options );

    this.promise = null;
    this.videoPlayer = null;

    if ( typeof VideoPlayer !== 'undefined' ) {
      const container = node.querySelector( '.' + node.getAttribute( 'data-uncloak-video' ) );
      this.videoPlayer = new VideoPlayer( { container: container, autoplay: 0 }, false );
      this.videoPlayer.addCallback( 'firstPlay', () => {
        this.uncloak();
      } );
      this.videoPlayer.addCallback( 'error', () => {
        this.handleLazyContent( { top: 0, left: 0, right: 0, bottom: 0 } );
        this.uncloak();
      } );
    }
  }

  process( base_delay ) {
    const bounds = this.getRect();
    const in_uncloakable_bounds = this.inViewport( bounds, this.offsetFraction );

    this.load( bounds );
    if ( in_uncloakable_bounds && this.cloaked ) {
      // only calculate delay if item has a delay type and hasn't already been calculated
      if ( this.delayType !== null && this.delayTimer.y1 === null ) {
        this.delayTimer = {
          y0: performance.now(),
          y1: this.createDelayTimeout( base_delay, this.delayType )
        };
        base_delay++;
      }
      if ( this.imagesLoaded() ) {
        this.uncloak();
      }
    }

    return base_delay;
  }

  load( rect ) {
    this.runCallbacks( 'load' );

    if ( !this.videoPlayer.isDisabled() ) {
      this.toggleVideoPlay( this.inViewport( rect, 1.25 ) );
      return;
    }

    // Only handle lazy content if video is not working
    if ( this.inViewport( rect, 1.5 ) ) {
      this.handleLazyContent( rect );
    }
  }

  // MEDIA helpers
  toggleVideoPlay( should_play ) {
    if ( should_play ) {
      this.videoPlayer.play();
      return;
    }
    this.videoPlayer.pause();
  }
}
