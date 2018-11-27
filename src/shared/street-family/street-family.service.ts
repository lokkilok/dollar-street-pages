import { Injectable } from '@angular/core';
import { DrawDividersInterface, BrowserDetectionService } from '../../common';
import { area, curveBasis } from 'd3-shape';
import { scaleLinear, scaleLog } from 'd3-scale';
import { select } from 'd3-selection';
import { SVG_DEFAULTS } from '../street/svg-parameters';
import { Place } from '../../interfaces';
import { get } from 'lodash';
import { DefaultUrlParameters } from '../../defaultState';
import { MathService } from '../../common';
import { CountryCodes } from '../../country_codes';
import { WsReader } from 'vizabi-ws-reader';

interface Point {x: number, y:number};

@Injectable()
export class StreetFamilyDrawService {
  public width: number;
  public height: number;
  public roadGroundLevel: number;
  public streetOffset = 60;
  private sidewalkLeft: Point; //the low-income end of the sidewalk 
  private sidewalkRight: Point; //the high-income end of the sidewalk
  public chosenPlaces: Place[];
  public scale: any; // for placing the dividers and house in the front
  private xScale: any; // for the income mountain on the sidewalk
  private yScale: any; // for the income mountain
  public axisLabel: number[] = [];
  public svg: any;
  private area: any;
  public hoverPlace: Place;
  public windowInnerWidth: number = window.innerWidth;
  public device: BrowserDetectionService;
  public isDesktop: boolean;
  public isMobile: boolean;
  public math: MathService;
  private wsReader; //TODO: the waffle service reader could be wrapped in a dedicated ng service
  private mu: number; //TODO: pass this somehow as part of the D3 data 
  private sigma: number; //TODO: pass this somehow as part of the D3 data

  public constructor(browserDetectionService: BrowserDetectionService, math: MathService) {
    this.device = browserDetectionService;
    this.math = math;
    this.isDesktop = this.device.isDesktop();
    this.isMobile = this.device.isMobile();
  }

  public init(drawDividers: DrawDividersInterface): this {
    this.axisLabel = [drawDividers.low, drawDividers.medium, drawDividers.high];
    this.width = parseInt(this.svg.style('width'), 10) - this.streetOffset;
    this.height = parseInt(this.svg.style('height'), 10);
    this.roadGroundLevel = this.height - 0.5 * 65; // the road element used to be 65px high;
    this.windowInnerWidth = window.innerWidth;
    this.sidewalkLeft = {x: 30, y: this.roadGroundLevel - 4};
    this.sidewalkRight = {x: this.width + this.streetOffset - this.streetOffset / 2, y: this.roadGroundLevel - 4};

    this.scale = scaleLog()
      .domain([
        get(drawDividers, 'poor', Number(DefaultUrlParameters.lowIncome)),
        get(drawDividers, 'rich', Number(DefaultUrlParameters.highIncome))
      ])
      .range([0, this.width]);

    // define mountain (area) D3 generator
    const _this = this;
    this.xScale = scaleLog()
      .domain([
        get(drawDividers, 'poor', Number(DefaultUrlParameters.lowIncome)),
        get(drawDividers, 'rich', Number(DefaultUrlParameters.highIncome))
      ])
      .range([this.sidewalkLeft.x, this.sidewalkRight.x - this.sidewalkLeft.x]);
    this.yScale = scaleLinear().domain([0, 1]).range([this.roadGroundLevel - 4, 0]);
    this.area = area <number> ()
      .curve(curveBasis)
      .x(income => _this.xScale(income))
      .y0(income => _this.yScale(0))
      .y1(income => _this.yScale(_this.math.lognormal(income, _this.sigma, _this.mu)));

    //Prepare the waffle service reader
    this.wsReader = WsReader.getReader();
    this.wsReader.init({
        "reader": "waffle",
        "path": "https://waffle-server.gapminder.org/api/ddf/ql"
    });

    return this;
  }

    public set setSvg(element: HTMLElement) {
    this.svg = select(element);
  }

  public drawRoad(drawDividers: DrawDividersInterface): this {
    this.svg
      .append('polygon')
      .attr('class', 'road')
      .attr('height', SVG_DEFAULTS.road.height)
      .attr('points', () => {
        const point1 = `0,${ this.roadGroundLevel + 11}`;
        const point2 = `${ this.sidewalkLeft.x },${ this.sidewalkLeft.y }`;
        const point3 = `${ this.sidewalkRight.x },${ this.sidewalkRight.y }`;
        const point4 = `${ this.width + this.streetOffset},${ this.roadGroundLevel + 11}`;

        return `${point1} ${point2} ${point3} ${point4}`;
      })
      .style('fill', SVG_DEFAULTS.road.background);

    this.svg
      .append('line')
      .attr('class', 'axis')
      .attr('height', SVG_DEFAULTS.road.line.height)
      .attr('x1', 1)
      .attr('y1', this.roadGroundLevel + 11.5)
      .attr('x2', this.width + this.streetOffset - 1)
      .attr('y2', this.roadGroundLevel + 11.5)
      .attr('stroke-width', SVG_DEFAULTS.road.line.height)
      .attr('stroke', SVG_DEFAULTS.road.line.color);

    this.svg
      .append('line')
      .attr('class', 'dash')
      .attr('x1', 24)
      .attr('y1', this.roadGroundLevel + 4)
      .attr('x2', this.width + this.streetOffset - 9)
      .attr('y2', this.roadGroundLevel + 3)
      .attr('stroke-dasharray', '17')
      .attr('stroke-width', 2)
      .attr('stroke', 'white');

// RJA: this second dashed line seems to be unnecessary
//    this.svg
//      .append('line')
//      .attr('class', 'dash')
//      .attr('x1', 24)
//      .attr('y1', this.roadGroundLevel - 12 )
//      .attr('x2', this.width + this.streetOffset - 24)
//      .attr('y2', this.roadGroundLevel - 11)
//      .attr('stroke-dasharray', '17')
//      .attr('stroke-width', 1)
//      .attr('stroke', 'white');

    this.isDrawDividers(drawDividers);

    return this;
  }

  public drawHouse(place: Place): this {
    if (!place) {
      return this;
    }

    this.svg
      .selectAll('use.icon-hover-home')
      .data([place])
      .enter()
      .append('use')
      .attr('class', 'icon-hover-home')
      .attr('class', 'hover')
      .attr('y', this.roadGroundLevel - 4 - SVG_DEFAULTS.hoverHomes.height)
      .attr('width', SVG_DEFAULTS.hoverHomes.width)
      .attr('height', SVG_DEFAULTS.hoverHomes.height)
      .attr('fill', SVG_DEFAULTS.hoverHomes.fill)
      .attr('xlink:href', SVG_DEFAULTS.hoverHomes.name)
      .attr('income', (datum: Place) => { return datum.income; })
      .attr('home-id', (datum: Place) => { return datum._id; })
      .attr('x', (datum: Place) => {
        const scaleDatumIncome = this.scale(datum.income);
        const positionX = (this.streetOffset / 2) + scaleDatumIncome - SVG_DEFAULTS.hoverHomes.differenceSizeHover;

        return positionX;
      });

    return this;
  };

  private _getCountryIncomeData(countryName: string): Promise<any> {
    const countryCode = CountryCodes[countryName];
    return this.wsReader.read({
      "from": "datapoints",
      "select": {
        "key": [
          "country",
          "time"
        ],
        "value": [
          "gapminder_gini",
          "income_per_person_gdppercapita_ppp_inflation_adjusted",
          "population_total"
        ]
      },
      "where": {
        "$and": [
          {
            "country": { "$in": [`${countryCode}`] }
          },
          {
            "time": "2015"
          }
        ]
      }
    });
  };

  public drawIncomeMountain(place: Place): this {
    if (!place) {
      return this;
    }

    //TODO: use Angular storage
    let countryIncomeData:any = sessionStorage.getItem(place.country.originName);
    if (countryIncomeData) countryIncomeData = JSON.parse(countryIncomeData);
    if (countryIncomeData && countryIncomeData.sigma && countryIncomeData.mu) {
     this.sigma = countryIncomeData.sigma;
     this.mu = countryIncomeData.mu;
     return this._drawIncomePDF(place.country.region);
    }
             
    //get GDP and gini, convert to mu and sigma, save and then draw
    this._getCountryIncomeData(place.country.originName)
    .then(result => {
      if (result && result.length > 0) {
        countryIncomeData = result[0];
        const incomeFamilySize:number = 3.1; //TODO: get this from the Waffle server if possible?
        countryIncomeData.sigma = this.math.giniToSigma(countryIncomeData.gapminder_gini);
        countryIncomeData.mu = this.math.gdpToMu(countryIncomeData.income_per_person_gdppercapita_ppp_inflation_adjusted * incomeFamilySize, countryIncomeData.sigma);
        sessionStorage.setItem(place.country.originName, JSON.stringify(countryIncomeData));
        this.sigma = countryIncomeData.sigma;
        this.mu = countryIncomeData.mu;
        return this._drawIncomePDF(place.country.region);
      }
        
      return this;
    });

    return this;
  };
 
  private _drawIncomePDF(region: string): this {
    let incomePoints = this.scale.ticks(10);
    this.svg
      .selectAll('path.mountain')
      .data([incomePoints])
      .enter()
      .insert('path', ':first-child')
      .attr('class', 'mountain')
      .attr('class', 'area')
      .attr('class', region.toLowerCase())
      .attr('d', this.area);
    return this;
  };
    
  public clearSvg(): this {
    this.svg.selectAll('*').remove();

    return this;
  };

  public isDrawDividers(drawDividers: DrawDividersInterface): this {
    if (!get(drawDividers, 'showDividers', false)) {
      return;
    }

    this.svg.selectAll('use.square-point')
      .data(this.axisLabel)
      .enter()
      .append('use')
      .attr('xlink:href', SVG_DEFAULTS.squarePoints.name)
      .attr('fill', SVG_DEFAULTS.squarePoints.color)
      .attr('class', 'square-point')
      .attr('width', SVG_DEFAULTS.squarePoints.width)
      .attr('height', SVG_DEFAULTS.squarePoints.height)
      .attr('y', SVG_DEFAULTS.squarePoints.positionY)
      .attr('x', (d: number) => {
        const x = this.scale(d);

        return x;
      });

    return this;
  }
}
