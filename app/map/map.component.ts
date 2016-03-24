import {Component, OnInit, OnDestroy, Inject, ElementRef} from 'angular2/core';
import {RouterLink, RouteParams, Router} from 'angular2/router';
import {Observable} from 'rxjs/Rx';

import {UrlChangeService} from '../common/url-change/url-change.service';
import {MapService} from './map.service.ts';
import {HeaderComponent} from '../common/header/header.component';
import {LoaderComponent} from '../common/loader/loader.component';

let tpl = require('./map.template.html');
let style = require('./map.css');

let device = require('device.js')();
const isDesktop = device.desktop();

@Component({
  selector: 'map-component',
  template: tpl,
  styles: [style],
  directives: [RouterLink, HeaderComponent, LoaderComponent]
})

export class MapComponent implements OnInit,OnDestroy {
  private mapService:MapService;
  private places:any[] = [];
  private countries:any[] = [];
  private element:any;
  private map:HTMLImageElement;
  private hoverPlace:any = null;
  private markers:any;
  private hoverPortraitTop:any;
  private hoverPortraitLeft:any;
  private thing:any;
  private urlChangeService:UrlChangeService;
  private query:string;
  private routeParams:any;
  private currentCountry:string;
  private lefSideCountries:any;
  private lefSideLeft:string = '-324px';
  private lefSideOpacity:string = '0';
  private seeAllHomes:boolean = false;
  private leftArrowTop:any;
  private onThumb:boolean = false;
  private onMarker:boolean = false;
  private isOpenLeftSide:boolean = false;
  private init:boolean;
  private router:Router;
  public loader:boolean = false;

  public resizeSubscribe:any;
  public mapServiceSubscribe:any;

  private shadowClass:{'shadow_to_left':boolean, 'shadow_to_right':boolean};

  constructor(@Inject(MapService) placeService,
              @Inject(ElementRef) element,
              @Inject(RouteParams) routeParams,
              @Inject(Router) router,
              @Inject(UrlChangeService) urlChangeService) {
    this.mapService = placeService;
    this.element = element;
    this.routeParams = routeParams;
    this.router = router;
    this.urlChangeService = urlChangeService;
  }

  ngOnInit():void {
    this.init = true;
    this.thing = this.routeParams.get('thing');

    this.urlChanged(this.thing)
  }

  urlChanged(thing:any) {
    this.thing = thing;
    let query = `thing=${this.thing}`;

    if (!thing) {
      query = '';
    }

    if (thing && thing._id) {
      if (this.init) {
        this.init = false;

        return;
      }

      query = `thing=${this.thing._id}`;
    }
    this.mapServiceSubscribe = this.mapService.getMainPlaces(query)
      .subscribe((res)=> {
        if (res.err) {
          return res.err;
        }

        this.map = this.element.nativeElement.querySelector('.mapBox');
        this.places = res.data.places;
        this.query = `thing=${res.data.thing}`;

        this.urlChangeService.replaceState('/map', this.query);
        this.countries = res.data.countries;
        this.setMarkersCoord(this.places);
        this.loader = true;
        this.resizeSubscribe = Observable
          .fromEvent(window, 'resize')
          .debounceTime(150)
          .subscribe(() => {
            this.setMarkersCoord(this.places);
          });
      });
  }

  ngOnDestroy() {
    this.mapServiceSubscribe.unsubscribe()
    this.resizeSubscribe.unsubscribe()
  }

  setMarkersCoord(places) {
    let img = new Image();
    let mapImage = this.element.nativeElement.querySelector('.map-color');

    img.onload = () => {
      let width = mapImage.offsetWidth;
      let height = mapImage.offsetHeight;
      let greenwich = 0.439 * width;
      let equator = 0.545 * height;

      places.forEach((place:any) => {
        let stepTop, stepRight;

        if (place.lat > 0) {
          stepTop = equator / 75;
        } else {
          stepTop = (height - equator) / 75;
        }

        if (place.lng < 0) {
          stepRight = greenwich / 130;
        } else {
          stepRight = (width - greenwich) / 158;
        }

        place.left = place.lng * stepRight + greenwich;
        place.top = equator - place.lat * stepTop - 23;
      });
    };

    img.src = mapImage.src;
  }

  private hoverOnMarker(index, country):void {
    if (!isDesktop) {
      return;
    }

    if (this.isOpenLeftSide) {
      return;
    }

    this.onMarker = true;
    this.currentCountry = country;

    this.lefSideCountries = this.places.filter((place)=> {
      return place.country === this.currentCountry;
    });

    if (this.lefSideCountries.length > 1) {
      this.seeAllHomes = true;
    }

    this.markers = this.map.querySelectorAll('.marker');

    this.places.forEach((place, i) => {
      if (i !== index) {
        return;
      }

      this.hoverPlace = place;
    });

    if (!this.hoverPlace) {
      return;
    }

    Array.prototype.forEach.call(this.markers, (marker, i)=> {
      if (i === index) {
        return;
      }

      marker.style.opacity = 0.3;
    });

    let img = new Image();

    let portraitBox = this.map.querySelector('.hover_portrait') as HTMLElement;

    portraitBox.style.opacity = '0';

    img.onload = ()=> {
      if (!this.hoverPlace) {
        return;
      }

      this.hoverPortraitTop = this.hoverPlace.top - portraitBox.offsetHeight;
      this.hoverPortraitLeft = this.hoverPlace.left - (portraitBox.offsetWidth - 15) / 2;
      this.leftArrowTop = null;
      this.shadowClass = {'shadow_to_left': true, 'shadow_to_right': false};
      if (this.hoverPortraitTop < 10) {
        this.hoverPortraitTop = 10;
        this.hoverPortraitLeft += (portraitBox.offsetWidth + 32) / 2;
        this.leftArrowTop = this.hoverPlace.top - 9;

        if (portraitBox.offsetHeight - 12 <= this.leftArrowTop) {
          this.leftArrowTop -= 20;
          this.hoverPortraitTop += 20;
        }
        this.shadowClass = {'shadow_to_left': false, 'shadow_to_right': true};
      }
      if(!this.seeAllHomes){
        this.shadowClass = {'shadow_to_left': false, 'shadow_to_right': false};
      }
      portraitBox.style.opacity = '1';
    };

    img.src = this.hoverPlace.familyImg.background;
  }

  private unHoverOnMarker(e):void {
    if (!isDesktop) {
      return;
    }

    if (this.isOpenLeftSide) {
      return;
    }

    this.onMarker = false;

    setTimeout(()=> {
      if (this.onThumb) {
        this.onThumb = !this.onThumb;

        return;
      }

      if (this.onMarker) {
        this.onMarker = !this.onMarker;

        return;
      }

      if (!this.markers) {
        return;
      }

      Array.prototype.forEach.call(this.markers, (marker) => {
        marker.style.opacity = '1';
      });

      this.seeAllHomes = false;
      this.hoverPlace = null;
      this.hoverPortraitTop = null;
      this.hoverPortraitLeft = null;
      this.markers = null;
    }, 300);
  }


  private hoverOnFamily(index):void {
    if (!isDesktop) {
      return;
    }
    if (this.isOpenLeftSide) {
      return
    }

    this.markers = this.map.querySelectorAll('.marker');

    Array.prototype.forEach.call(this.markers, (marker, i) => {
      if (i === index) {
        return;
      }

      marker.style.opacity = '0.3';
    });
  };

  private unHoverOnFamily():void {
    if (!isDesktop) {
      return;
    }

    Array.prototype.forEach.call(this.markers, (marker) => {
      marker.style.opacity = '1';
    });

    this.markers = null;
  };

  private openLeftSideBar(country):void {
    this.isOpenLeftSide = true;
    this.lefSideLeft = `0`;
    this.lefSideOpacity = `1`;
  }

  private closeLeftSideBar(e) {
    if (e.target.classList.contains('see-all') ||
      e.target.classList.contains('see-all-span')) {
      this.onMarker = false;
      this.onThumb = false;
      this.seeAllHomes = false;
      this.hoverPlace = null;
      this.hoverPortraitTop = null;
      this.hoverPortraitLeft = null;
      this.unHoverOnMarker(e)
      return;
    }
    this.isOpenLeftSide = false;
    this.onMarker = false;
    this.onThumb = false;
    if (!e.target.classList.contains('marker')) {
      this.unHoverOnMarker(e)
    }
    this.lefSideLeft = `-324px`;
    this.lefSideOpacity = `0`;
  }

  private clickOnMarker(e, index, country) {
    if (this.isOpenLeftSide) {
      this.isOpenLeftSide = !this.isOpenLeftSide;
      this.closeLeftSideBar(e)
      this.hoverOnMarker(index, country)
      return;
    }
    if (this.lefSideCountries.length === 1) {
      this.router.navigate(['Place', {
        thing: this.hoverPlace.familyImg.thing,
        place: this.hoverPlace._id,
        image: this.hoverPlace.familyImg.imageId
      }])
    }
  }

  private thumbHover() {
    this.onThumb = true
  }

  private toUrl(image) {
    return `url("${image.replace('150x150', 'devices')}")`;
  }
}