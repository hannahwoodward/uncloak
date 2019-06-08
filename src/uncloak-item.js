export class UncloakItem {
  constructor( node, options ) {
    node.removeAttribute( 'data-uncloak-new' );

    this.callbacks = options.callbacks || { create: [], load: [], uncloak: [] };
    this.cloaked = true;
    this.delayTimer = {
      y0: 0,
      y1: null
    };
    this.delayType = node.getAttribute( 'data-uncloak-delay-type' ) || null;
    this.delayTypes = options.delayTypes || {};
    this.lazyContent = node.querySelectorAll( '[data-uncloak-src], [data-uncloak-srcset]' );
    this.lazyContentLoadStatus = -1, // NB: -1 => unloaded, 1 => loading, 2 => loaded
    this.node = node;
    this.offsetFraction = node.getAttribute( 'data-uncloak-offset' ) || 1;
  }

  create() {
    this.runCallbacks( 'create' );
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

    if ( this.inViewport( rect, 1.5 ) ) {
      this.handleLazyContent( rect );
    }
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
    setTimeout( doUncloak(), final_delay );
  }

  // BOUNDS helpers
  inViewport( rect, fraction = this.offsetFraction ) {
    // y bounds
    const top_vis = ( rect.top <= this.getVH( fraction ) );
    const bot_vis = ( rect.bottom > 0 ? rect.bottom > this.getVH( 1 - fraction ) : true );

    // x bounds
    const right_vis = ( Math.floor( rect.right ) <= this.getVW( fraction ) );
    const left_vis = ( rect.left > 0 ? rect.left > this.getVW( 1 - fraction ) : true );

    return top_vis && bot_vis && right_vis && left_vis;
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
  handleLazyContent( rect ) {
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
          if ( this.inViewport( rect ) ) {
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
    return ( this.lazyContent.length === 0 || this.lazyContentLoadStatus === 2 );
  }

  // GET helpers
  getRect() {
    // needed for IE10/11 which is sometimes slow to get these vals
    let bounds = {};
    try {
      const rect = this.node.getBoundingClientRect();
      bounds.top = rect.top;
      bounds.bottom = rect.bottom;
      bounds.left = rect.left;
      bounds.right = rect.right;
    } catch ( e ) {
      bounds = { top: 0, bottom: 0, left: 0, right: 0 };
    }
    return bounds;
  }
  getVH( frac = 1 ) {
    return ( window.innerHeight || document.documentElement.clientHeight ) * frac;
  }
  getVW( frac = 1 ) {
    return ( window.innerWidth || document.documentElement.clientWidth ) * frac;
  }
}
