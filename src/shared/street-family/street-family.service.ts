import { Injectable } from '@angular/core';
import { DrawDividersInterface, BrowserDetectionService } from '../../common';
import { area, curveBasis } from 'd3-shape';
import { scaleLinear, scaleLog } from 'd3-scale';
import { select } from 'd3-selection';
import { SVG_DEFAULTS } from '../street/svg-parameters';
import { Place } from '../../interfaces';
import { get } from 'lodash';
import { DefaultUrlParameters } from '../../defaultState';

@Injectable()
export class StreetFamilyDrawService {
  public width: number;
  public height: number;
  public roadGroundLevel: number;
  public streetOffset = 60;
  public chosenPlaces: Place[];
  public scale: any;
  private yScale: any;
  public axisLabel: number[] = [];
  public svg: any;
  private area: any;
  public hoverPlace: Place;
  public windowInnerWidth: number = window.innerWidth;
  public device: BrowserDetectionService;
  public isDesktop: boolean;
  public isMobile: boolean;
  private wsReader; //TODO: the waffle service reader could be wrapped in a dedicated ng service
  private mu: number; //TODO: pass this somehow as part of the D3 data 
  private sigma: number; //TODO: pass this somehow as part of the D3 data

  public constructor(browserDetectionService: BrowserDetectionService) {
    this.device = browserDetectionService;
    this.isDesktop = this.device.isDesktop();
    this.isMobile = this.device.isMobile();
  }

  public init(drawDividers: DrawDividersInterface): this {
    this.axisLabel = [drawDividers.low, drawDividers.medium, drawDividers.high];
    this.width = parseInt(this.svg.style('width'), 10) - this.streetOffset;
    this.height = parseInt(this.svg.style('height'), 10);
    this.roadGroundLevel = this.height - 0.5 * 65; // the road element used to be 65px high;
    this.windowInnerWidth = window.innerWidth;

    this.scale = scaleLog()
      .domain([
        get(drawDividers, 'poor', Number(DefaultUrlParameters.lowIncome)),
        get(drawDividers, 'rich', Number(DefaultUrlParameters.highIncome))
      ])
      .range([0, this.width]);

    // define mountain (area) D3 generator
    const _this = this;
    this.yScale = scaleLinear().domain([0, 1]).range([this.roadGroundLevel - 4, 0]);
    this.area = area()
      .curve(curveBasis)
      .x(income => _this.scale(income))
      .y0(income => _this.yScale(0))
      .y1(income => _this.yScale(_this.lognormal(income, _this.sigma, _this.mu)));

    //Prepare the waffle service reader
    this.wsReader = WsReader.WsReader.getReader();
    this.wsReader.init({
        "reader": "waffle",
        "path": "https://waffle-server.gapminder.org/api/ddf/ql"
    });

    return this;
  }

  private gdpToMu(gdp: number, sigma: number): number {
    // converting gdp per family per month into MU for lognormal distribution
    // see https://en.wikipedia.org/wiki/Log-normal_distribution
    return Math.log(gdp / 12) - sigma * sigma / 2;
  }

  private normsinv(p: number): number {
    //
    // Lower tail quantile for standard normal distribution function.
    //
    // This function returns an approximation of the inverse cumulative
    // standard normal distribution function.  I.e., given P, it returns
    // an approximation to the X satisfying P = Pr{Z <= X} where Z is a
    // random variable from the standard normal distribution.
    //
    // The algorithm uses a minimax approximation by rational functions
    // and the result has a relative error whose absolute value is less
    // than 1.15e-9.
    //
    // Author:      Peter John Acklam
    // (Javascript version by Alankar Misra @ Digital Sutras (alankar@digitalsutras.com))
    // Time-stamp:  2003-05-05 05:15:14
    // E-mail:      pjacklam@online.no
    // WWW URL:     http://home.online.no/~pjacklam

    // Taken from http://home.online.no/~pjacklam/notes/invnorm/index.html
    // adapted from Java code

    // An algorithm with a relative error less than 1.15*10-9 in the entire region.

    // Coefficients in rational approximations
    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];

    // Define break-points.
    const plow = 0.02425;
    const phigh = 1 - plow;

    // Rational approximation for lower region:
    if (p < plow) {
      const q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }

    // Rational approximation for upper region:
    if (phigh < p) {
      const q = Math.sqrt(-2 * Math.log(1 - p));
      return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }

    // Rational approximation for central region:
    const q = p - 0.5;
    const r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);

  }
  
  private giniToSigma(gini: number): number {
    // The ginis are turned into std deviation.
    // Mattias uses this formula in Excel: stddev = NORMSINV( ((gini/100)+1)/2 )*2^0.5
    return this.normsinv(((gini / 100) + 1) / 2) * Math.pow(2, 0.5);
  }

  // this function returns PDF values for a lognormal distribution
  private lognormal(x: number, sigma:number, mu:number): number {
    return Math.exp(
      -0.5 * Math.log(2 * Math.PI) //should not be different for the two scales- (scaleType=="linear"?Math.log(x):0)
      - Math.log(sigma)
      - Math.pow(Math.log(x) - mu, 2) / (2 * sigma * sigma)
    );
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
        const point2 = `30,${ this.roadGroundLevel - 4}`;
        const point3 = `${ this.width + this.streetOffset - this.streetOffset / 2},${ this.roadGroundLevel - 4}`;
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
    //TODO: fix query to work with actual country name (and not the country ISO code which Dollar Street doesn't know).
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
            "country": { "$in": ["bdi"] }
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
        countryIncomeData.sigma = this.giniToSigma(countryIncomeData.gapminder_gini);
        countryIncomeData.mu = this.gdpToMu(countryIncomeData.income_per_person_gdppercapita_ppp_inflation_adjusted * incomeFamilySize, countryIncomeData.sigma);
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
