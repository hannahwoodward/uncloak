# Uncloak

- Uses IntersectionObserver API to reveal elements, lazy load content, and autoplay/pause videos as they scroll into view
- Supports dynamically added elements
- 4KB minified

### How it works

- Add `data-uncloak-new` to any elements you would like to be picked up by Uncloak
- Create new instance of Uncloak - this will automatically query all elements with this attribute
- Each element will be created as an UncloakItem (or UncloakVideoItem), and:
  - Its `data-uncloak-new` attribute will be removed (so it won't be picked up again)
  - Be added to a a global IntersectionObserver instance (attached to Uncloak), to be revealed when its node is visible in the viewport
  - Will query for any child elements to be lazy loaded (with `data-uncloak-src` or `data-uncloak-srcset` attributes) - in which case, will setup its own IntersectionObserver instance with a margin of 50% around the viewport
  - If it is an UncloakVideoItem, the video will autoplay once within 25% of the viewport (and paused if outside)
- If you dynamically add anymore elements and want them to be picked up by Uncloak:
  - Make sure they have the `data-uncloak-new` attribute
  - Run `uncloak.findNewItems()` after they've been added to the DOM

_TODO: UncloakVideoItem docs_

### Settings

All settings are optional, defaults are listed below:

```
new Uncloak({
  items = []; // an array of UncloakItem / UncloakVideoItem that are to be revealed
  
  // Sent to UncloakItem
  itemOptions = {
    delayTypes: {},
    callbacks: {}
  };
});
```

_TODO: callbacks & delay types_

### Example

HTML:
```
<div class="uncloak uncloak--cloaked" data-uncloak-new>
  <img data-uncloak-src="image.jpg">
</div>

<div class="uncloak uncloak--cloaked" data-uncloak-new>
  <iframe data-uncloak-src="https://www.youtube.com/embed/G9KQfnqukno" frameborder="0"></iframe>
</div>
```

JS:
```
import Uncloak from 'path/to/uncloak.js';

new Uncloak();
```

CSS:
```
.uncloak {
  transition: opacity 0.2s;
}
.uncloak--cloaked {
  opacity: 0;
}
```

### Example: Iframe with poster image
HTML:
```
<!-- both elements have the data-uncloak-src so will be lazy loaded with Uncloak -->
<div class="uncloak uncloak--cloaked embed" data-uncloak-new>
  <!-- could add an event listener to play iframe video & hide poster on click --> 
  <button class="embed__poster">
    <img data-uncloak-src="https://placekitten.com/1440/810">
  </button>
  <iframe class="embed__content" data-uncloak-src="https://www.youtube.com/embed/G9KQfnqukno" frameborder="0"></iframe>
</div>
```

JS:
```
import Uncloak from 'path/to/uncloak.js';

new Uncloak();
```

CSS:
```
.uncloak {
  transition: opacity 0.2s;
}
.uncloak--cloaked {
  opacity: 0;
}

.embed {
  position: relative;
}
.embed__iframe {
  height: 100%;
  left: 0;
  position: absolute;
  top: 0;
  width: 100%;
}
.embed__poster {
  position: relative;
  z-index: 2;
}
```

### Browser Support

Latest Edge/FF/Chrome/Safari/iOS - see [IntersectionObserver support](https://caniuse.com/#feat=intersectionobserver). If you need IE support, see this [polyfill](https://github.com/w3c/IntersectionObserver).
