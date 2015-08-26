import React from 'react';
const {PropTypes} = React;
import _ from 'lodash';
import d3 from 'd3';

import {accessor, AccessorPropType} from './util.js';

// on the taxonomy of bar charts:

// there are 3 types of bar charts,
// distinguished by whether the 2D data points they plot represent values or ranges

// 1. Value-Value
// typical bar chart, plotting values that look like [[0,5], [1,3], ...]
// with bars that are centered horizontally on x-value and extend from 0 to y-value,
// (or centered vertically on their y-value and extend from 0 to the x-value, in the case of horizontal chart variant)
// eg. http://www.snapsurveys.com/wp-content/uploads/2012/10/bar_2d8.png

// 2. Range-Value
// instead of a single value, one of the two data points represents a range of values
// usually the range is the independent variable and the value is the observation
// most commonly used in histogram, where each bar represents a bin (which is a range)
// data may look something like [[0, 5], 100], [[5, 15], 300], ...] or [{x: 0, xEnd: 5, y:100}...]
// often all bars are the same width, (same range sizes) but not necessarily
// bars still from extend from 0 to y-value,
// but the x-values of their sides, and therefore their width, is determined by the range
// (or vice versa in the case of horizontal variant)
// eg. http://labs.physics.dur.ac.uk/skills/skills/images/histogram4.jpg

// 3. Value-Range
// like Range-Value, one of the two data points represents a range of values
// but generally the range is the dependent variable (ie. observation) instead of vice versa in #2
// bars are centered over their x-value as in #1,
// but their top & bottom y-values, and therefore their length, is determined by the range. they don't extend to 0.
// (or vice versa in the case of horizontal variant)
// eg. (horizontal) http://6.anychart.com/products/anychart/docs/users-guide/img/Samples/sample-range-bar-chart-y-datetime-axis.png

// 4. Range-Range
// both of the data points represent ranges
// ie. data looks like [{x: 10, xEnd: 20, y: 12, yEnd: 40} ...]
// these are simply plotted as floating rectangles whose coordinates, length and width are all determined by the ranges
// there is no horizontal or vertical variant
// eg... can't find a good example

// creating a BarChart component...
// x and y values are represented by getX and getY accessors passed in as props
// to represent a range instead of a single value, call with both getX and getXEnd (or getY and getYEnd),
// which will be the accessors for the start and end values of the range
// to represent horizontal vs. vertical variant, pass in orientation="horizontal" or orientation="vertical"

// so to create the types described above:
// 1. Value-Value - only pass in getX and getY, + orientation
// 2. Range-Value
//   a. pass in getX, getXEnd and getY with orientation="vertical"
//   b. or getX, getY and getYEnd with orientation="horizontal"
// 3. Value-Range
//   a. pass in getX, getY and getYEnd with orientation="vertical"
//   b. or getX, getXEnd and getY with orientation="horizontal"
// 4. Range-Range - pass in all of getX, getXEnd, getY and getYEnd. no need for orientation.

//const BAR_CHART_TYPES = {
//    VALUE_VALUE: 'VALUE_VALUE',
//    RANGE_VALUE: 'RANGE_VALUE',
//    VALUE_RANGE: 'VALUE_RANGE',
//    RANGE_RANGE: 'RANGE_RANGE',
//};

function getBarChartType(props) {
    const {getXEnd, getYEnd, orientation} = props;
    const isVertical = (orientation === 'vertical');
    return _.isUndefined(getXEnd) && _.isUndefined(getYEnd) ?
        'ValueValue' :
    (_.isUndefined(getYEnd) && isVertical) || (_.isUndefined(getXEnd) && !isVertical) ?
        'RangeValue' :
    (_.isUndefined(getXEnd) && isVertical) || (_.isUndefined(getYEnd) && !isVertical) ?
        'ValueRange' :
        'RangeRange';
}

function barZeroValue(data, dAccessor, axisType) {
    switch (axisType) {
        // number bars go from zero to value
        case 'number': return 0;
        // time values need a "zero" value to stretch from - the first date minus one day
        // todo make this less arbitrary? should be a rare case anyway.
        case 'time': return d3.extent(data, dAccessor)[0] - (24 * 60 * 60 * 1000);
        // ordinal values need a "zero" value to stretch from -
        // empty string since it's unlikely to be used in real data and won't show a label
        case 'ordinal': return '';
    }
}

function valueAxisDomain(data, dAccessor, axisType) {
    switch (axisType) {
        case 'number':
        case 'time':
            return d3.extent(d3.extent(data, dAccessor).concat(barZeroValue(data, dAccessor, axisType)));
        case 'ordinal':
            return _.uniq([barZeroValue(data, dAccessor, axisType)].concat(data.map(accessor(dAccessor))));
    }
    return null;
}

const BarChart = React.createClass({
    propTypes: {
        // the array of data objects
        data: PropTypes.array.isRequired,
        // accessor for X & Y coordinates
        getX: AccessorPropType,
        getY: AccessorPropType,

        // x & y scale types
        xType: PropTypes.oneOf(['number', 'time', 'ordinal']),
        yType: PropTypes.oneOf(['number', 'time', 'ordinal']),

        orientation: PropTypes.string,

        xScale: PropTypes.func,
        yScale: PropTypes.func
    },
    getDefaultProps() {
        return {
            orientation: 'vertical'
        }
    },

    statics: {
        getOptions(props, xType, yType) {

        },
        getDomain(props, xType, yType) {
            const {data, getX, getY, orientation} = props;
            const [xAccessor, yAccessor] = [accessor(getX), accessor(getY)];
            const barType = getBarChartType(props);
            const isVertical = (orientation === 'vertical');

            const accessors = {x: xAccessor, y: yAccessor};
            const axisTypes = {x: xType, y: yType};
            let domains = {x: null, y: null};

            if(barType === 'ValueValue') {
                let valueAxis = isVertical ? 'y' : 'x'; // the axis along which the bar's length shows value
                domains[valueAxis] = valueAxisDomain(data, accessors[valueAxis], axisTypes[valueAxis]);
                return domains;
            }
        }
    },
    getHovered() {},

    render() {
        const renderer = this[`render${getBarChartType(this.props)}Bars`];
        return <g className="bar-chart">
            {renderer()}
        </g>
    },
    renderValueValueBars() {
        const {data, xScale, yScale, getX, getY, xType, yType} = this.props;
        //const isHorizontal = this.props.orientation === 'bar';
        //const barThickness = this.state.barScale.rangeBand();
        // todo handle barthickness in props/auto width
        const barThickness = 10;

        const xAccessor = accessor(getX);
        const yAccessor = accessor(getY);

        return this.props.orientation === 'vertical' ?
            <g>
                {this.props.data.map((d, i) => {
                    const barZero = barZeroValue(data, yAccessor, yType);
                    const yVal = yAccessor(d);
                    const barLength = Math.abs(yScale(barZero) - yScale(yVal));
                    const barY = (yVal >= 0 || yType === 'ordinal') ? yScale(barZero) - barLength : yScale(barZero);

                    return <rect
                            className="chart-bar chart-bar-vertical"
                            x={this.props.xScale(xAccessor(d)) - (barThickness / 2)}
                            y={barY}
                            width={barThickness}
                            height={barLength}
                            />
                })}
            </g> :
            <g>
                {this.props.data.map((d, i) => {
                    const barZero = barZeroValue(data, xAccessor, xType);
                    const xVal = xAccessor(d);
                    const barLength = Math.abs(xScale(barZero) - xScale(xVal));
                    const barX = (xVal >= 0 || xType === 'ordinal') ? xScale(barZero) : xScale(barZero) - barLength;

                    return <rect
                        className="chart-bar chart-bar-vertical"
                        x={barX}
                        y={this.props.yScale(yAccessor(d)) - (barThickness / 2)}
                        width={barLength}
                        height={barThickness}
                        />
                })}
            </g>

    },
    renderRangeValueBars() {
        return renderNotImplemented();

        const {xScale, yScale, getX, getY} = this.props;
        const isHorizontal = this.props.orientation === 'bar';
        //const barThickness = this.state.barScale.rangeBand();
        const barThickness = 5;

        const xAccessor = accessor(getX);
        const yAccessor = accessor(getY);

        return <g>
            {this.props.data.map((d, i) => {
                const yVal = yAccessor(d);
                const barLength = Math.abs(yScale(0) - yScale(yVal));
                const barY = yVal >= 0 ? yScale(0) - barLength : yScale(0);

                return <rect
                    className="chart-bar chart-bar-vertical"
                    x={this.props.xScale(xAccessor(d)) - (barThickness / 2)}
                    y={barY}
                    width={barThickness}
                    height={barLength}
                    />
            })}
        </g>
    },
    renderValueRangeBars() {
        return renderNotImplemented('value range');
    },
    renderRangeRangeBars() {

    }
});

function renderNotImplemented(text="not implemented") {
    return <svg x={100} y={100} style={{overflow:'visible'}}><text>{text}</text></svg>
}

export default BarChart;