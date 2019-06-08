import { UncloakItem } from './uncloak-item.js';
import { UncloakVideoItem } from './uncloak-video-item.js';

export default class Uncloak {
  constructor( options ) {
    this.items = [];

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

    // initial load
    this.findNewItems();
  }

  findNewItems( raw_elements = document.querySelectorAll( '[data-uncloak-new]' ) ) {
    if ( !raw_elements[0] ) {
      return;
    }

    const offset = this.items.length;
    let base_delay = 0;
    for ( let i = 0; i < raw_elements.length; i++ ) {
      const raw_el = raw_elements[i];
      let uncloak_item;
      if ( raw_el.hasAttribute( 'data-uncloak-video' ) ) {
        uncloak_item = new UncloakVideoItem( raw_el, this.itemOptions )
      } else {
        uncloak_item = new UncloakItem( raw_el, this.itemOptions )
      }
      uncloak_item.create();
      this.items.push( uncloak_item );
      base_delay = this.items[i + offset].process( base_delay );
    }
  }

  processItems() {
    let base_delay = 0;
    for ( let i = 0; i < this.items.length; i++ ) {
      base_delay = this.items[i].process( base_delay );
    }
  }
}
