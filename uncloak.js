// req VideoPlayer – nb reveal delay does not work with play reveal hook
// window.supportsPassive = false;
// try {
// 	window.addEventListener( 'test', null, {
// 		get passive() {
// 			window.supportsPassive = true;
// 		}
// 	} );
// } catch ( e ) {
// 	//
// }
const USE_CAPTURE  = window.supportsPassive ? { capture: false, passive: true } : false;

class Uncloak {
	constructor() {
		this.items = [];
		this.progVars = { m: 250, c: 0 }; // form: y = mx + c

		// initial load
		this.ready = false;
		this.init();
	}

	init() {
		this.findNewItems();
		this.ready = true;

		const processItems = () => {
			if ( !this.ready ) return;

			this.ready = false;
			let base_delay = 0;
			for ( let i = 0; i < this.items.length; i++ ) {
				base_delay = this.processItem( this.items[i], base_delay );
			}
			this.ready = true;
		};

		let y0 = getScrollY();
		requestAnimationFrame( update );
		window.addEventListener( 'resize', processItems );

		function update() {
			const dy = getScrollY();
			if ( dy === y0 ) {
				requestAnimationFrame( update );
				return;
			}

			y0 = dy;
			processItems();
			requestAnimationFrame( update );
		}
		function getScrollY() {
			return ( window.scrollY || document.documentElement.scrollTop );
		}
	}

	findNewItems( raw_elements = document.querySelectorAll( '[data-uncloak-new]' ) ) {
		if ( !raw_elements.length ) return;

		const offset = this.items.length;
		let base_delay = 0;
		for ( let i = 0; i < raw_elements.length; i++ ) {
			this.createItem( raw_elements[i] );
			base_delay = this.processItem( this.items[i + offset], base_delay );
		}
	}

	createItem( raw_element ) {
		raw_element.removeAttribute( 'data-uncloak-new' );
		const item = {
			delayType: raw_element.getAttribute( 'data-uncloak-delay' ) || null,
			el: raw_element,
			hasLazyContent: raw_element.hasAttribute( 'data-uncloak-lazy' ),
			hasVideo: raw_element.hasAttribute( 'data-uncloak-video' ),
			lazyContent: null,
			lazyContentLoaded: false,
			offsetFraction: raw_element.getAttribute( 'data-uncloak-offset' ) || 1,
			promise: null,
			videoPlayer: null
		};

		if ( item.hasLazyContent ) item.lazyContent = raw_element.querySelectorAll( '[data-lazy-src]' );

		if ( item.hasVideo ) {
			const container = raw_element.querySelector( '.' + raw_element.getAttribute( 'data-uncloak-video' ) );
			item.videoPlayer = new VideoPlayer( { container: container, autoplay: 0 }, false );
			item.videoPlayer.addCallback( 'firstPlay', () => { this.uncloak( item, 0 ) } );
			item.videoPlayer.addCallback( 'error', () => { this.uncloak( item, 0  ) } );
		}

		this.items.push( item );
	}

	processItem( item, base_delay = 0 ) {
		const element = item.el;
		let dy_top, dy_bot;
		let delay = 0;
		try {
			dy_top = element.getBoundingClientRect().top;
			dy_bot = element.getBoundingClientRect().bottom;
		} catch ( e ) {
			dy_top = 0;
			dy_bot = 0;
		}
		const in_bounds = this.inBounds( dy_top, item.offsetFraction );
		const cloaked = element.classList.contains( 'uncloak--cloaked' )
		if ( in_bounds && cloaked ) {
			// item in bounds, calculate delay
			if ( item.delayType !== null && this.inTopBounds( dy_bot, 0 ) ) {
				delay = this.createDelayTimeout( base_delay, item.delayType );
				base_delay++;
			}
		}
		if ( item.hasLazyContent && this.inBounds( dy_top, 2, dy_bot ) && !item.lazyContentLoaded ) this.handleLazyContent( item, delay );
		if ( item.hasVideo && this.getWW() > 699 && !item.videoPlayer.isDisabled() ) {
			this.handleVideo( item );
			return;
		}
		if ( !in_bounds || !cloaked ) return;
		if ( this.imagesLoaded( item ) ) this.uncloak( item, delay );

		return base_delay;
	}

	uncloak( item, delay = 0 ) {
		setTimeout( () => {
			item.el.classList.remove( 'uncloak--cloaked' );
		}, delay );
	}

	// helpers
	createDelayTimeout( delay_factor, delay_type ) {
		switch ( delay_type ) {
			case 'sequential':
				return ( delay_factor * this.progVars.m + this.progVars.c );
				break;

			case 'random':
				return ( 750 * Math.random() );
				break;

			default:
				return delay_factor * 250;
		}
	}
	handleLazyContent( item, delay ) {
		const els = item.lazyContent;
		let left_to_load = els.length;

		for ( let i = 0; i < els.length; i++ ) {
			let el = els[i];
			el.src = el.getAttribute( 'data-lazy-src' );
			const loaded = () => {
				el.removeEventListener( 'load', loaded, false );
				el.removeAttribute( 'data-lazy-src' );
				left_to_load -= 1;
				if ( left_to_load === 0 ) {
					item.lazyContentLoaded = true;
					if ( this.inBounds( item.el.getBoundingClientRect().top, item.offsetFraction ) ) this.uncloak( item, delay );
				}
			};
			el.addEventListener( 'load', loaded, false );
		}
	}
	imagesLoaded( el ) {
		return ( el.lazyContent === null || ( el.lazyContent.length > 0 && el.lazyContentLoaded ) );
	}
	handleVideo( item ) {
		if ( this.inBounds( item.el, 1.25, true ) ) {
			item.videoPlayer.play();
			return;
		}
		item.videoPlayer.pause();
	}
	inBounds( ytop, fraction, ybot = 0 ) {
		return ( ytop < this.getWH() || ( ybot > 0 ? this.inTopBounds( ybot, 1 - fraction ) : false ) );
	}
	inTopBounds( ybot, fraction ) {
		return ( ybot > this.getWH() );
	}
	getWH( frac = 1 ) {
		return ( window.innerHeight || document.documentElement.clientHeight ) * frac;
	}
	getWW( frac = 1 ) {
		return ( window.innerWidth || document.documentElement.clientWidth ) * frac;
	}
}
