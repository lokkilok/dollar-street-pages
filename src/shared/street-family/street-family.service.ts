import { Injectable } from '@angular/core';
import { DrawDividersInterface, BrowserDetectionService } from '../../common';
import { area, curveBasis } from 'd3-shape';
import { scaleLinear, scaleLog } from 'd3-scale';
import { select } from 'd3-selection';
import { SVG_DEFAULTS } from '../street/svg-parameters';
import { Place } from '../../interfaces';
import { get } from 'lodash';
import { DefaultUrlParameters } from '../../defaultState';
import { IncomeMountain } from '../../common';
import { CountryCodes } from '../../country_codes';
import { WsReader } from 'vizabi-ws-reader';

interface Point {x: number, y:number};

enum IncomeMountainScaling { // scaling of the income probability distribution function, this controls the value of the top ("mode") of the curve/mountain
  Unit = "UNIT",            // standard statistics, i.e. the area is 1 unit. 
  Mode = "MAX",             // according to the mode, i.e. the maximum value or the top of the mountain
  Population = "POPULATION" // according to the size of the population of the country (region) for the income mountain 
};
const MaxPopulation = Math.log(1500); // (log of) the highest known population for a country in DS, in millions. (China in 2015 has 1397)  

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
  private incomeMountainScaling: IncomeMountainScaling;
  public axisLabel: number[] = [];
  public svg: any;
  private area: any;
  public hoverPlace: Place;
  public windowInnerWidth: number = window.innerWidth;
  public device: BrowserDetectionService;
  public isDesktop: boolean;
  public isMobile: boolean;
  public incomeMountain: IncomeMountain;
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
    
    this.incomeMountainScaling = IncomeMountainScaling.Population; //TODO: this could be taken from settings, e.g. "DefaultUrlParameters")
    this.yScale = scaleLinear().domain([0, 1]).range([this.roadGroundLevel - 4, 0]);
    this.area = area <any> ()
      .curve(curveBasis)
      .x(pdfPoint => _this.xScale(pdfPoint.x))
      .y0(pdfPoint => _this.yScale(0))
      .y1(pdfPoint => _this.yScale(pdfPoint.y));

    //Prepare the waffle service reader, we need this to get gdp and gini for a selected country
    //TODO: enhance the DS service to provide that info to this application 
    //      together with the other country data. 
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
    if (countryIncomeData && countryIncomeData.gini && countryIncomeData.income_per_person_gdppercapita_ppp_inflation_adjusted) {
      return this._drawIncomePDF(
          countryIncomeData.income_per_person_gdppercapita_ppp_inflation_adjusted,
          countryIncomeData.gapminder_gini,
          countryIncomeData.population_total,
          place.country.region);
    }
             
    //get GDP and gini, save, and then draw
    this._getCountryIncomeData(place.country.originName)
    .then(result => {
      if (result && result.length > 0) {
        countryIncomeData = result[0];
        countryIncomeData.population_total = Math.round(countryIncomeData.population_total / 1000000);
        sessionStorage.setItem(place.country.originName, JSON.stringify(countryIncomeData));
        return this._drawIncomePDF(
            countryIncomeData.income_per_person_gdppercapita_ppp_inflation_adjusted,
            countryIncomeData.gapminder_gini,
            countryIncomeData.population_total,
            place.country.region);
      }
        
      return this;
    });

    return this;
  };
 
  private _drawIncomePDF(gdp: number, gini: number, population = 1400, region: string): this {
    let incomeMountain:IncomeMountain = new IncomeMountain(gdp, gini);
    let incomePoints = incomeMountain.pdf([26, ...this.scale.ticks(30)]); // when adding the low end we see that the scaling and adjustments may be incorrect.
    let yDomainTop = 1;
    if (this.incomeMountainScaling === IncomeMountainScaling.Mode) {
      yDomainTop = incomeMountain.maximum;
    } else if (this.incomeMountainScaling === IncomeMountainScaling.Population) {
      yDomainTop = incomeMountain.maximum * (MaxPopulation / Math.log(population));
    }
    this.yScale.domain([0, yDomainTop]);
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
