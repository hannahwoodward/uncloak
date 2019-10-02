export class UncloakItem {
  constructor( node, options ) {
    node.removeAttribute( 'data-uncloak-new' );

    this.callbacks = options.callbacks || { init: [], uncloak: [] };
    this.cloaked = true;
    this.uncloakReady = false;
    this.delayTimer = {
      y0: 0,
      y1: null
    };
    this.delayType = node.getAttribute( 'data-uncloak-delay-type' ) || null;
    this.delayTypes = options.delayTypes || {};
    this.lazyContent = node.hasAttribute( 'data-uncloak-ignore-lazy' ) ? [] : node.querySelectorAll( '[data-uncloak-src], [data-uncloak-srcset]' );
    this.lazyContentLoadStatus = ( this.lazyContent[0] ? -1 : 2 ), // NB: -1 => unloaded, 1 => loading, 2 => loaded
    this.node = node;
    this.threshold = parseFloat( node.getAttribute( 'data-uncloak-threshold' ) ) || 0;

    this.lazyContentObserver = null;
  }

  init() {
    if ( this.lazyContent[0] ) {
      this.lazyContentObserver = new IntersectionObserver( entries => {
        const entry = entries[0];
        if ( entry.isIntersecting ) {
          this.loadLazyContent();

          // images only need loading once, so stop observing once loaded
          this.lazyContentObserver.disconnect();
        }
      }, {
        rootMargin: '50%'
      } );

      this.lazyContentObserver.observe( this.node );
    }

    this.runCallbacks( 'init' );
  }

  process( base_delay ) {
    if ( this.cloaked ) {
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
      } else {
        // set uncloak ready status for when images have finished loading
        this.uncloakReady = true;
      }
    }

    return base_delay;
  }

  uncloak() {
    if ( !this.cloaked ) {
      return;
    }
    this.cloaked = false; // only trigger uncloak once
    const dy = ( performance.now() - this.delayTimer.y0 );
    const final_delay = this.delayTimer.y1 - dy;
    const doUncloak = () => {
      this.node.classList.remove( 'uncloak--cloaked' );
      this.runCallbacks( 'uncloak' );
    };

    if ( final_delay <= 0 ) {
      doUncloak();
      return;
    }
    setTimeout( doUncloak, final_delay );
  }

  reset() {
    this.cloaked = true
    this.delayTimer = {
      y0: 0,
      y1: null
    }
    this.node.classList.add( 'uncloak--cloaked' )
  }

  // CALLBACK helper
  runCallbacks( type ) {
    const cb = this.callbacks[type];
    if ( !cb || !cb.length ) {
      return;
    }
    for ( let i = 0; i < cb.length; i++ ) {
      cb[i]( this );
    }
  }

  // DELAY helper
  createDelayTimeout( factor, type ) {
    // requires user to input their own delay functions
    if ( !this.delayTypes ) {
      return 0;
    }
    return ( this.delayTypes[type]( factor ) || 0 );
  }


  // MEDIA helpers
  loadLazyContent() {
    if ( this.imagesLoaded() || this.lazyContentLoadStatus === 1 ) {
      return;
    }
    this.lazyContentLoadStatus = 1;
    let left_to_load = this.lazyContent.length;

    const loaded = ( element ) => {
      return () => {
        element.removeEventListener( 'load', loaded, false );
        element.removeAttribute( 'data-uncloak-src' );
        element.removeAttribute( 'data-uncloak-srcset' );
        left_to_load -= 1;
        if ( left_to_load === 0 ) {
          this.lazyContentLoadStatus = 2;
          if ( this.uncloakReady ) {
            this.uncloak();
          }
        }
      };
    };

    for ( let i = 0; i < this.lazyContent.length; i++ ) {
      const el = this.lazyContent[i];
      const lazy_srcset = el.getAttribute( 'data-uncloak-srcset' ) || null;
      if ( lazy_srcset ) {
        el.srcset = lazy_srcset;
      }
      el.src = el.getAttribute( 'data-uncloak-src' );
      el.addEventListener( 'load', loaded( el ), false );
    }
  }
  imagesLoaded() {
    return ( this.lazyContentLoadStatus === 2 );
  }
}
