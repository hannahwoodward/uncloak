import { UncloakItem } from './uncloak-item.js';
import { UncloakVideoItem } from './uncloak-video-item.js';

export default class Uncloak {
  constructor( options ) {
    this.items = [];
    this.nodeObserver = null;

    // Sent to UncloakItem
    this.itemOptions = {
      delayTypes: {},
      callbacks: {}
    };

    if ( options && options.itemOptions ) {
      for ( const key in this.itemOptions ) {
        if ( options.itemOptions[key] ) {
          this.itemOptions[key] = options.itemOptions[key] || {};
        }
      }
    }

    this.init();
  }

  init() {
    if ( !( 'IntersectionObserver' in window ) ) {
      console.error('uncloak: IntersectionObserver not supported in this browser.');
    }

    this.nodeObserver = new IntersectionObserver( entries => {
      let base_delay = 0;
      for ( let i = 0; i < entries.length; i++ ) {
        if ( entries[i].isIntersecting ) {
          const uncloak_item = this.getItemByNode( entries[i].target );
          const item_height = entries[i].boundingClientRect.height;
          const viewport_visibility_threshold = ( uncloak_item.threshold * entries[i].rootBounds.height );
          const item_can_reach_threshold = ( item_height >= viewport_visibility_threshold );
          const should_reveal_item = item_can_reach_threshold ? entries[i].intersectionRect.height >= viewport_visibility_threshold : entries[i].isIntersecting;

          if ( should_reveal_item ) {
            base_delay = uncloak_item.process( base_delay );
            this.nodeObserver.unobserve( entries[i].target );
          }
        }
      }
    }, {
      rootMargin: '10% 0%',
      threshold: [ 0.1, 0.2, 0.3, 0.5, 0.6, 0.7, 0.8, 0.9 ]
    } );

    // initial load
    this.findNewItems();
  }

  findNewItems( raw_elements = document.querySelectorAll( '[data-uncloak-new]' ) ) {
    if ( !raw_elements[0] ) {
      return;
    }

    const offset = this.items.length;
    for ( let i = 0; i < raw_elements.length; i++ ) {
      const raw_el = raw_elements[i];
      const true_index = offset + i;
      let uncloak_item;

      if ( raw_el.hasAttribute( 'data-uncloak-video' ) ) {
        uncloak_item = new UncloakVideoItem( raw_el, this.itemOptions )
      } else {
        uncloak_item = new UncloakItem( raw_el, this.itemOptions )
      }

      raw_el.id = 'uncloak-' + true_index;
      uncloak_item.init();
      this.nodeObserver.observe( raw_el );
      this.items.push( uncloak_item );
    }
  }

  getItemByNode( node ) {
    const index = node.id.split( '-' )[1];
    return this.items[index];
  }
}
