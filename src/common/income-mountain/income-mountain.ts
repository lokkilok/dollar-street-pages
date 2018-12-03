/*
* The income mountain code packed up as an injectable class.
* 
*/
import { Injectable } from '@angular/core';

@Injectable()
export class IncomeMountain {
  private mu: number;
  private sigma: number;
  
  constructor(gdpPerCapita: number, gini: number) {
    this.sigma = this.giniToSigma(gini);
    this.mu = this.gdpPerCapitaToMu(gdpPerCapita, this.sigma);
  }

  public pdf(X: Array<number>): Array<any> {
    // Compute the probability density function for this income mountain
    // and return an array with object that have an x and y property.
    // The input should be an array of ordered numbers on the X-axis.

    // The low income end is adjusted as it cannot go to 0 and below.
    // essentially the area below a cut off point is added onto the income
    // range between the absolute low cut off and an income above which no 
    // adjustment is made.
    const tailCutX = 0.2 * 30; // income per month (30 days) below which income mountain is adjusted down 
    const tailFatX = 1.85 * 30; // income per month above which no adjustment is applied
    const tailFade = 0.7;  // factor to smooth low income adjustment
    const k = 2 * Math.PI / (Math.log(tailFatX) - Math.log(tailCutX));
    const m = Math.PI - Math.log(tailFatX) * k;

    let lowIncomeMask:Array<number> = [];
    let lowIncomeAdjustments: Array<number> = [];
    let lowIncomeArea:number = 0;
    let unadjustedArea:number = 0;
    let lognormalPDF:Array<any> = [];
    X.forEach((x, i) => {
      lognormalPDF[i] = this.lognormal(x);
      lowIncomeMask[i] = x < tailCutX ? 1 : (x > tailFade * 7 * 30 ? 0 : Math.exp((tailCutX - x) / tailFade));
      lowIncomeAdjustments[i] = x > tailCutX && x < tailFatX ? 1 + Math.cos(Math.log(x) * k + m) : 0;
      lowIncomeArea += lowIncomeAdjustments[i];
      unadjustedArea += lowIncomeMask[i] * lognormalPDF[i];
    });
    return X.map((x, i) => {
      return {x: x, y: lognormalPDF[i] * (1 - lowIncomeMask[i]) + lowIncomeAdjustments[i] / lowIncomeArea * unadjustedArea};
    });
  }
    
  protected gdpPerCapitaToMu(gdp: number, sigma: number): number {
    // converting gdp per capita and year into MU per month for lognormal distribution
    // see https://en.wikipedia.org/wiki/Log-normal_distribution
    return Math.log(gdp / 12) - sigma * sigma / 2;
  }

  protected normsinv(p: number): number {
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
  
  protected giniToSigma(gini: number): number {
    // The ginis are turned into std deviation.
    // Mattias uses this formula in Excel: stddev = NORMSINV( ((gini/100)+1)/2 )*2^0.5
    return this.normsinv(((gini / 100) + 1) / 2) * Math.pow(2, 0.5);
  }

  protected lognormal(x: number): number {
    // this function returns a single point of the probability distribution 
    // function for a lognormal distribution
    return Math.exp(
      -0.5 * Math.log(2 * Math.PI) //should not be different for the two scales- (scaleType=="linear"?Math.log(x):0)
      - Math.log(this.sigma)
      - Math.pow(Math.log(x) - this.mu, 2) / (2 * this.sigma * this.sigma)
    );
  }

};
