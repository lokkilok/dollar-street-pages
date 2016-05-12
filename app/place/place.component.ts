import {Component, Inject, OnInit, OnDestroy, NgZone} from 'angular2/core';
import {RouteParams, RouterLink} from 'angular2/router';
import {Subject} from 'rxjs/Subject';

import {FooterComponent} from '../common/footer/footer.component';
import {StreetComponent} from '../common/street/street.component';
import {HeaderComponent} from '../common/header/header.component';
import {SliderPlaceComponent} from './slider/slider-place.component.ts';
import {SliderMobilePlaceComponent} from './slider-mobile/slider-mobile-place.component.ts';
import {FamilyPlaceComponent} from './family/family-place.component.ts';
import {LoaderComponent} from '../common/loader/loader.component';
import {Observable} from 'rxjs/Observable';

let tpl = require('./place.template.html');
let style = require('./place.css');

let device = require('device.js')();
let isDesktop = device.desktop();

@Component({
  selector: 'place',
  template: tpl,
  styles: [style],
  directives: [RouterLink, HeaderComponent, StreetComponent, isDesktop ? SliderPlaceComponent : SliderMobilePlaceComponent, FamilyPlaceComponent, FooterComponent, LoaderComponent]
})

export class PlaceComponent implements OnInit, OnDestroy {
  private streetPlaces:Subject<any> = new Subject();
  private sliderPlaces:Subject<any> = new Subject();
  private chosenPlaces:Subject<any> = new Subject();
  private controllSlider:Subject<any> = new Subject();
  public hoverPlace:Subject<any> = new Subject();
  public hoverHeader:Subject<any> = new Subject();
  private controllSliderSubscribe:any;
  private thing:string;
  private query:string;
  private image:string;
  private commonAboutData:any;
  private place:any;
  private init:boolean = true;
  private showAboutData:boolean;
  private activeThing:any = {};
  private currentPlace:any = {};
  private isDesktop:boolean = isDesktop;
  private isShowImagesFamily:boolean = isDesktop;
  public loader:boolean = false;
  public placeStreetServiceSubscribe:any;
  public getCommonAboutDataServiceSubscribe:any;
  public isScroll:boolean;
  public places:any[];
  public windowHeight:number = window.innerHeight;
  public maxHeightPopUp:number = this.windowHeight * .95 - 91;
  public resizeSubscribe:any;

  constructor(@Inject('PlaceStreetService')
              private placeStreetService,
              @Inject('UrlChangeService')
              private urlChangeService,
              @Inject(RouteParams)
              private routeParams,
              @Inject(NgZone)
              private zone) {
  }

  ngOnInit() {
    this.thing = this.routeParams.get('thing');
    this.place = this.routeParams.get('place');
    this.image = this.routeParams.get('image');
    this.query = `thing=${this.thing}&place=${this.place}&image=${this.image}`;
    this.getStreetPlaces(this.query);

    this.getCommonAboutDataServiceSubscribe = this.placeStreetService
      .getCommonAboutData()
      .subscribe((res) => {
        this.commonAboutData = res.data;
      });

    this.controllSliderSubscribe = this.controllSlider
      .subscribe(() => {
        this.zone.run(() => {
          this.loader = false;
        });
      });

    this.resizeSubscribe = Observable
      .fromEvent(window, 'resize')
      .debounceTime(300).subscribe(() => {
        this.zone.run(() => {
          this.windowHeight = window.innerHeight;
          this.maxHeightPopUp = this.windowHeight * .95 - 91;
        });
      });
  }

  ngOnDestroy() {
    this.placeStreetServiceSubscribe.unsubscribe();
    this.controllSliderSubscribe.unsubscribe();
    this.getCommonAboutDataServiceSubscribe.unsubscribe();
    this.resizeSubscribe.unsubscribe();
  }

  ngAfterViewChecked() {
    if (!this.places || !this.places.length) {
      return;
    }

    if (document.body.scrollHeight < document.body.clientHeight) {
      return;
    }

    if (!this.isScroll) {
      this.streetPlaces.next(this.places);
    }

    this.isScroll = true;
  }

  urlChanged(thing):void {
    this.activeThing = thing;
    if (this.init) {
      return;
    }
    this.thing = thing._id;
    this.getStreetPlaces(`thing=${thing._id}&place=${this.place}&isSearch=true`);
    this.zone.run(() => {
      this.loader = false;
    });
  }

  isHover() {
    this.hoverHeader.next(null);
  }

  getStreetPlaces(thing) {
    this.placeStreetServiceSubscribe = this.placeStreetService.getThingsByRegion(thing).subscribe((res) => {
      this.places = res.data.places;
      this.sliderPlaces.next(this.places);
    });
  }

  choseCurrentPlace(place) {
    this.currentPlace = place[0];
    this.chosenPlaces.next(this.currentPlace);
    this.hoverPlace.next(this.currentPlace);

    if (!this.isDesktop) {
      this.isShowImagesFamily = false;
    }

    this.changeLocation(place[0], this.thing);

    this.zone.run(() => {
      this.loader = true;
    });
  }

  isShowAboutData(showAboutData) {
    this.showAboutData = showAboutData;
  }

  closeAboutDataPopUp(event) {
    if (event && event.target.className.indexOf('closeMenu') !== -1) {
      this.showAboutData = false;
    }
  }

  changeLocation(place, thing) {
    let query = `thing=${thing}&place=${place._id}&image=${place.image}`;
    this.place = place._id;
    this.image = place.image;

    if (this.init) {
      this.init = !this.init;
      return;
    }

    this.urlChangeService.replaceState('/place', query);
    this.routeParams.params = {'thing': thing, 'place': place._id, 'image': place.image};

    this.init = false;
  }
}
