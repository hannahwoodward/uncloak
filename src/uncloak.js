import { UncloakItem } from './uncloak-item.js';

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
      this.items.push( new UncloakItem( raw_elements[i], this.itemOptions ) );
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
