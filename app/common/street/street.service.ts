const d3 = require('d3');
const device = require('device.js')();
const isDesktop = device.desktop();

import {fromEvent} from 'rxjs/observable/fromEvent';
import {Subject} from 'rxjs/Subject';

export class StreetDrawService {
  public width:number;
  public height:number;
  public halfOfHeight:number;
  public lowIncome:number;
  public highIncome:number;
  private poorest:string = 'Poorest';
  private richest:string = 'Richest';
  private scale:any;
  private axisLabel:number[] = [30, 300, 3000];
  private svg:any;
  private incomeArr:any[] = [];

  private mouseMoveSubscriber:any;
  private mouseUpSubscriber:any;
  private touchMoveSubscriber:any;
  private touchUpSubscriber:any;
  private sliderRightBorder:number;
  private sliderLeftBorder:number;
  private sliderRightMove:boolean = false;
  private sliderLeftMove:boolean = false;
  private leftScroll:any;
  private rightScroll:any;
  private leftScrollOpacity:any;
  private rightScrollOpacity:any;
  private leftScrollText:any;
  private rightScrollText:any;
  private colors:{fills:any, fillsOfBorders:any} = {
    fills: {
      Europe: '#FFE800',
      Africa: '#15B0D1',
      America: '#B1E826',
      Asia: '#F23373'
    },
    fillsOfBorders: {
      Europe: '#dbc700',
      Africa: '#119ab7',
      America: '#96c61d',
      Asia: '#bc1950'
    }
  };

  private filter:Subject<any> = new Subject();

  public init(lowIncome:any, highIncome:any):this {
    this.lowIncome = lowIncome || 0;
    this.highIncome = highIncome || 15000;

    this.width = parseInt(this.svg.style('width'), 10);
    this.height = parseInt(this.svg.style('height'), 10);
    this.halfOfHeight = 0.5 * this.height;

    this.scale = d3
      .scale.log()
      .domain([1, 30, 300, 3000, 15000])
      .range([0, 0.07 * this.width, 0.5 * this.width, 0.92 * this.width, 0.99 * this.width]);

    return this;
  }

  public set setSvg(element:HTMLElement) {
    this.svg = d3.select(element);
  }

  public set(key:any, val:any):this {
    this[key] = val;

    return this;
  };

  public drawScale(places:any, isShowSlider:boolean):this {
    let halfHouseWidth = 7;
    let roofX = 2 - halfHouseWidth;
    let roofY = this.halfOfHeight - 10;

    if (!places || !places.length) {
      return this;
    }

    d3.svg
      .axis()
      .scale(this.scale)
      .orient('bottom')
      .tickFormat(() => {
        return void 0;
      })
      .tickSize(6, 0);

    this.svg
      .selectAll('text.poorest')
      .data([this.poorest])
      .enter()
      .append('text')
      .attr('class', 'poorest')
      .text(this.poorest)
      .attr('x', 0)
      .attr('y', this.height - 5)
      .attr('fill', '#767d86');

    this.svg
      .selectAll('text.richest')
      .data([this.richest])
      .enter()
      .append('text')
      .attr('class', 'richest')
      .text(this.richest)
      .attr('x', this.width - 52)
      .attr('y', this.height - 5)
      .attr('fill', '#767d86');

    if (isDesktop) {
      this.svg
        .selectAll('polygon')
        .data(places)
        .enter()
        .append('polygon')
        .attr('class', 'point')
        .attr('points', (datum:any):any => {
          let point1;
          let point2;
          let point3;
          let point4;
          let point5;
          let point6;
          let point7;

          if (datum) {
            let scaleDatumIncome = this.scale(datum.income);
            point1 = `${scaleDatumIncome + roofX },${this.halfOfHeight - 1}`;
            point2 = `${scaleDatumIncome + roofX},${roofY}`;
            point3 = `${scaleDatumIncome - halfHouseWidth},${roofY}`;
            point4 = `${scaleDatumIncome},${this.halfOfHeight - 17}`;
            point5 = `${scaleDatumIncome + halfHouseWidth },${roofY}`;
            point6 = `${scaleDatumIncome - roofX },${roofY}`;
            point7 = `${scaleDatumIncome - roofX },${this.halfOfHeight - 1}`;
          }

          return !datum ? void 0 : point1 + ' ' + point2 + ' ' +
          point3 + ' ' + point4 + ' ' + point5 + ' ' + point6 + ' ' + point7;
        })
        .attr('stroke-width', 1)
        .style('fill', '#cfd2d6')
        .style('opacity', '0.7');
    }

    this.svg
      .append('polygon')
      .attr('class', 'road')
      .attr('points', () => {
        let point1 = `0,${ this.halfOfHeight + 9}`;
        let point2 = `15,${ this.halfOfHeight - 4}`;
        let point3 = `${ this.width - 15},${ this.halfOfHeight - 4}`;
        let point4 = `${ this.width},${ this.halfOfHeight + 9}`;

        return `${point1} ${point2} ${point3} ${point4}`;
      })
      .style('fill', '#737b83');

    this.svg
      .append('line')
      .attr('class', 'axis')
      .attr('x1', 0)
      .attr('y1', this.halfOfHeight + 10)
      .attr('x2', this.width)
      .attr('y2', this.halfOfHeight + 10)
      .attr('stroke-width', 2)
      .attr('stroke', '#505b65');

    this.svg
      .append('line')
      .attr('class', 'dash')
      .attr('x1', 18)
      .attr('y1', this.halfOfHeight + 3)
      .attr('x2', this.width - 9)
      .attr('y2', this.halfOfHeight + 3)
      .attr('stroke-dasharray', '8,8')
      .attr('stroke-width', 1.5)
      .attr('stroke', 'white');

    this.incomeArr.length = 0;

    this.svg
      .selectAll('text.scale-label')
      .data(this.axisLabel)
      .enter()
      .append('text')
      .attr('class', 'scale-label')
      .text((d:any) => {
        return d + '$';
      })
      .attr('x', (d:any) => {
        let indent = 0;

        if ((d + '').length === 2) {
          indent = 11;
        }

        if ((d + '').length === 3) {
          indent = 15;
        }

        return this.scale(d) - indent;
      })
      .attr('y', this.height - 5)
      .attr('fill', '#767d86');

    this.svg
      .selectAll('image.scale-label22222')
      .data(this.axisLabel)
      .enter()
      .append('svg:image')
      .attr('class', 'scale-label22222')
      .attr('xlink:href', '/assets/img/divider.svg')
      .attr('y', 19)
      .attr('width', 19)
      .attr('height', 30)
      .attr('x', (d:any) => {
        let indent = 0;
        let center = 11;

        if ((d + '').length === 2) {
          indent = 11;
          center = 2;
        }

        if ((d + '').length === 3) {
          indent = 15;
          center = 7;
        }

        return this.scale(d) - indent + center;
      });

    if (isShowSlider) {
      this.drawLeftSlider(this.scale(Number(this.lowIncome) || 1), true);
      this.drawRightSlider(this.scale(this.highIncome), true);
    }

    if (this.mouseMoveSubscriber) {
      this.mouseMoveSubscriber.unsubscribe();
    }

    this.mouseMoveSubscriber = fromEvent(window, 'mousemove').filter((e:MouseEvent)=> {
      e.preventDefault();

      return this.sliderLeftMove || this.sliderRightMove;
    }).subscribe((e:MouseEvent)=> {
      e.preventDefault();

      if (this.sliderLeftMove && e.pageX <= this.sliderRightBorder && e.pageX >= 20) {
        return this.drawLeftSlider(e.pageX - 20);
      }

      if (this.sliderRightMove && e.pageX >= this.sliderLeftBorder && e.pageX <= this.width) {
        return this.drawRightSlider(e.pageX - 20);
      }
    });

    if (this.touchMoveSubscriber) {
      this.touchMoveSubscriber.unsubscribe();
    }

    this.touchMoveSubscriber = fromEvent(window, 'touchmove')
      .filter(()=> {
        return this.sliderLeftMove || this.sliderRightMove;
      }).subscribe((e:TouchEvent)=> {
        let positionX = e.touches[0].pageX;

        if (this.sliderLeftMove && positionX <= this.sliderRightBorder && positionX >= 20) {
          return this.drawLeftSlider(positionX - 20);
        }

        if (this.sliderRightMove && positionX >= this.sliderLeftBorder && positionX <= this.width) {
          return this.drawRightSlider(positionX - 20);
        }
      });

    this.mouseUpSubscriber = fromEvent(window, 'mouseup')
      .filter(()=> {
        return this.sliderLeftMove || this.sliderRightMove;
      }).subscribe((e?:MouseEvent)=> {
        e.preventDefault();

        this.sliderLeftMove = this.sliderRightMove = false;

        this.filter.next({
          lowIncome: Math.round(this.lowIncome) === 1 ? 0 : Math.round(this.lowIncome),
          highIncome: Math.round(this.highIncome)
        });
      });

    this.touchUpSubscriber = fromEvent(window, 'touchend')
      .filter(()=> {
        return this.sliderLeftMove || this.sliderRightMove;
      }).subscribe(()=> {
        this.sliderLeftMove = this.sliderRightMove = false;

        this.filter.next({
          lowIncome: Math.round(this.lowIncome) === 1 ? 0 : Math.round(this.lowIncome),
          highIncome: Math.round(this.highIncome)
        });
      });

    return this;
  };

  public drawHoverHouse(place:any, gray:boolean = false):this {
    if (!place) {
      return this;
    }

    let fills = this.colors.fills;
    let fillsOfBorders = this.colors.fillsOfBorders;
    let halfHouseWidth = 12.5;
    let roofX = 2 - halfHouseWidth;
    let roofY = this.halfOfHeight - 15;

    this.svg
      .selectAll('polygon.hover')
      .data([place])
      .enter()
      .append('polygon')
      .attr('class', 'hover')
      .attr('points', (datum:any):any => {
        let point1;
        let point2;
        let point3;
        let point4;
        let point5;
        let point6;
        let point7;

        if (datum) {
          let scaleDatumIncome = this.scale(datum.income);
          point1 = `${scaleDatumIncome + roofX },${this.halfOfHeight - 1}`;
          point2 = `${scaleDatumIncome + roofX},${roofY}`;
          point3 = `${scaleDatumIncome - halfHouseWidth},${roofY}`;
          point4 = `${scaleDatumIncome},${this.halfOfHeight - 26}`;
          point5 = `${scaleDatumIncome + halfHouseWidth },${roofY}`;
          point6 = `${scaleDatumIncome - roofX },${roofY}`;
          point7 = `${scaleDatumIncome - roofX },${this.halfOfHeight - 1}`;
        }

        return !datum ? void 0 : point1 + ' ' + point2 + ' ' +
        point3 + ' ' + point4 + ' ' + point5 + ' ' + point6 + ' ' + point7;
      })
      .attr('stroke-width', 1)
      .attr('stroke', (datum:any):any => {
        if (gray) {
          return '#303e4a';
        }

        return !datum ? void 0 : fillsOfBorders[datum.region];
      })
      .style('fill', (datum:any):any => {
        if (gray) {
          return '#374551';
        }

        return !datum ? void 0 : fills[datum.region];
      });

    return this;
  };

  protected drawLeftSlider(x:number, init:boolean = false):this {
    this.sliderLeftBorder = x + 20;

    if (!this.leftScroll) {
      this.leftScroll = this.svg
        .append('polygon')
        .attr('class', 'left-scroll')
        .style('fill', '#515c65')
        .style('cursor', 'pointer')
        .attr('stroke-width', 1)
        .attr('stroke', '#48545f')
        .on('mousedown', ():void => {
          d3.event.preventDefault();

          this.sliderLeftMove = true;
        })
        .on('touchstart', ():any => this.sliderLeftMove = true);
    }

    this.leftScroll
      .attr('points', () => {
        let point1 = `${x + 9},${ this.halfOfHeight + 10}`;
        let point2 = `${x + 9},${ this.halfOfHeight - 5}`;
        let point3 = `${x},${ this.halfOfHeight - 5}`;
        let point4 = `${x},${ this.halfOfHeight + 10}`;
        let point5 = `${x + 4.5},${ this.halfOfHeight + 10 + 5}`;

        return `${point1} ${point2} ${point3} ${point4} ${point5}`;
      });

    if (!this.leftScrollOpacity) {
      this.leftScrollOpacity = this.svg
        .append('rect')
        .attr('class', 'left-scroll-opacity-part')
        .attr('x', 0)
        .attr('y', 0)
        .attr('height', 60)
        .style('fill', 'white')
        .style('opacity', '0.8');
    }

    this.leftScrollOpacity
      .attr('width', x);

    this.lowIncome = this.scale.invert(x);

    if (init) {
      return this;
    }

    this.drawScrollLabel();

    return this;
  };

  protected drawRightSlider(x:number, init:boolean = false):this {
    this.sliderRightBorder = x;

    if (!this.rightScroll) {
      this.rightScroll = this.svg
        .append('polygon')
        .attr('class', 'right-scroll')
        .style('fill', '#515c65')
        .style('cursor', 'pointer')
        .attr('stroke-width', 1)
        .attr('stroke', '#48545f')
        .on('mousedown', ():void=> {
          d3.event.preventDefault();
          this.sliderRightMove = true;
        })
        .on('touchstart', ():any => this.sliderRightMove = true);
    }

    this.rightScroll.attr('points', () => {
      let point1 = `${x},${ this.halfOfHeight + 10}`;
      let point2 = `${x},${ this.halfOfHeight - 5}`;
      let point3 = `${x + 9},${ this.halfOfHeight - 5}`;
      let point4 = `${x + 9},${ this.halfOfHeight + 10}`;
      let point5 = `${x + 4.5},${ this.halfOfHeight + 10 + 5}`;
      return `${point1} ${point2} ${point3} ${point4} ${point5}`;
    });

    if (!this.rightScrollOpacity) {
      this.rightScrollOpacity = this.svg
        .append('rect')
        .attr('class', 'right-scroll-opacity-part')
        .attr('y', 0)
        .attr('height', 60)
        .style('fill', 'white')
        .style('opacity', '0.8');
    }

    this.rightScrollOpacity
      .attr('x', x + 9)
      .attr('width', this.width - x - 1);

    this.highIncome = this.scale.invert(x);

    if (init) {
      return this;
    }

    this.drawScrollLabel();

    return this;
  };

  public clearAndRedraw(places:any, slider:boolean = false):this {
    if (!places || !places.length && !slider) {
      this.removeHouses('hover');
      this.removeHouses('chosen');

      return this;
    }

    this.removeHouses('hover');
    this.removeHouses('chosen');

    if (slider) {
      this.drawHoverHouse(places);

      return;
    }

    this.drawHouses(places);

    return this;
  };

  public removeHouses(selector:any):this {
    this.svg.selectAll('rect.' + selector).remove('rect.' + selector);
    this.svg.selectAll('polygon.' + selector).remove('polygon.' + selector);

    if (selector === 'chosen') {
      this.svg.selectAll('polygon.chosenLine').remove('polygon.chosenLine');
    }

    return this;
  };

  public clearSvg():this {
    this.leftScroll = void 0;
    this.rightScroll = void 0;
    this.leftScrollOpacity = void 0;
    this.rightScrollOpacity = void 0;
    this.leftScrollText = void 0;
    this.rightScrollText = void 0;
    // this.highIncome = 15000;
    // this.lowIncome = 0;

    this.svg.selectAll('*').remove('*');

    return this;
  };

  private drawScrollLabel():this {
    this.svg.selectAll('text.poorest').attr('fill', '#767d86');
    this.svg.selectAll('text.richest').attr('fill', '#767d86');
    this.svg.selectAll('text.scale-label').attr('fill', '#767d86');

    let incomeL = Math.ceil(this.lowIncome ? this.lowIncome : 0);
    let incomeR = Math.ceil(this.highIncome ? this.highIncome : 15000);

    let xL = this.scale(incomeL);
    let xR = this.scale(incomeR);

    if (!this.leftScrollText) {
      this.leftScrollText = this.svg
        .append('text')
        .attr('class', 'left-scroll-label')
        .text(`${incomeL}$`)
        .attr('y', this.height - 5)
        .attr('fill', '#767d86');
    }

    if (!this.rightScrollText) {
      this.rightScrollText = this.svg
        .append('text')
        .attr('class', 'right-scroll-label')
        .text(`${incomeR}$`)
        .attr('y', this.height - 5)
        .attr('fill', '#767d86');
    }

    this.rightScrollText
      .text(`${incomeR}$`)
      .attr('x', ()=> xR - this.rightScrollText[0][0].getBBox().width / 2);

    this.leftScrollText
      .text(`${incomeL}$`)
      .attr('x', ()=> xL - this.leftScrollText[0][0].getBBox().width / 2);

    return this;
  };

  private drawHouses(places:any):this {
    if (!places || !places.length) {
      return this;
    }

    let halfHouseWidth = 10;
    let roofX = 2 - halfHouseWidth;
    let roofY = this.halfOfHeight - 12;

    this.svg.selectAll('polygon.chosen')
      .data(places)
      .enter()
      .append('polygon')
      .attr('class', 'chosen')
      .attr('points', (datum:any):any => {
        let point1;
        let point2;
        let point3;
        let point4;
        let point5;
        let point6;
        let point7;

        if (datum) {
          let scaleDatumIncome = this.scale(datum.income);
          point1 = `${ scaleDatumIncome + roofX},${this.halfOfHeight - 1}`;
          point2 = `${scaleDatumIncome + roofX},${roofY}`;
          point3 = `${scaleDatumIncome - halfHouseWidth },${roofY}`;
          point4 = `${scaleDatumIncome },${ this.halfOfHeight - 21}`;
          point5 = `${scaleDatumIncome + halfHouseWidth },${roofY}`;
          point6 = `${scaleDatumIncome - roofX },${ roofY}`;
          point7 = `${scaleDatumIncome - roofX },${ this.halfOfHeight - 1}`;
        }

        return !datum ? void 0 : point1 + ' ' + point2 + ' ' +
        point3 + ' ' + point4 + ' ' + point5 + ' ' + point6 + ' ' + point7;
      })
      .attr('stroke', '#303e4a')
      .style('fill', '#374551');

    return this;
  };
}
