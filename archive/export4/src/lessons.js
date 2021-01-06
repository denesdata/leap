/* bubbleChart creation function. Returns a function that will
 * instantiate a new bubble chart given a DOM element to display
 * it in and a dataset to visualize.
 *
 * Keyword and style inspired by:
 * https://bost.ocks.org/mike/chart/
 *
 */
//Parameters
var colorBy;
var groupBy;
var textRadius = 0.6;
var textOuterRadius = 0.9;
var minTextRadius = 15; //diameter of smallest bubble to receive a label
var minFontSize = 7; //font size of smallest bubble to receive a label
var hiddenFontSize = 7; //font size below which the label get opacity 0
var d3bubbleLabels = new Array();
var htmlLabelsOn = false;
var d3LabelsOn = false;

// Constants for sizing
var width = 940;
var height = 600;

function bubbleChart() {


    // tooltip for mouseover functionality
    var tooltip = floatingTooltip('leap_tooltip', 140);

    // Locations to move bubbles towards, depending
    // on which view mode is selected.
    var center = {
        x: width / 2,
        y: height / 2
    };

    // X locations of the titles.
    function groupTitle(groupBy, d) {
        return {
            'x': titleCenters[groupBy][d].x,
            'y': titleCenters[groupBy][d].y,
            // 'y': groupCenters[groupBy][d].y - height / 2 + 30
        }
    };

    // @v4 strength to apply to the position forces
    var xForceStrength = 0.025;
    // var yForceStrength = 0.04;
    var yForceStrength = xForceStrength * width / height;

    // These will be set in create_nodes and create_vis
    var svg = null;
    var bubbles = null;
    var nodes = [];

    // Charge function that is called for each node.
    // As part of the ManyBody force.
    // This is what creates the repulsion between nodes.
    //
    // Charge is proportional to the diameter of the
    // circle (which is stored in the radius attribute
    // of the circle's associated data.
    //
    // This is done to allow for accurate collision
    // detection with nodes of different sizes.
    //
    // Charge is negative because we want nodes to repel.
    // @v4 Before the charge was a stand-alone attribute
    //  of the force layout. Now we can use it as a separate force!
    function charge(d) {
        return -Math.pow(d.radius, 2.15) * xForceStrength;
    }

    // Here we create a force layout and
    // @v4 We create a force simulation now and
    //  add forces to it.
    var simulation = d3.forceSimulation()
        .velocityDecay(0.12)
        .force('x', d3.forceX().strength(xForceStrength).x(center.x))
        .force('y', d3.forceY().strength(yForceStrength).y(center.y))
        .force('charge', d3.forceManyBody().strength(charge))
        .on('tick', ticked);

    // @v4 Force starts up automatically,
    //  which we don't want as there aren't any nodes yet.
    simulation.stop();

    // Nice looking colors - no reason to buck the trend
    // @v4 scales now have a flattened naming scheme
    var fillColor = d3.scaleOrdinal(d3.schemeCategory10)
        .domain(['Health',
            'Learning',
            'Agency',
            'Enabling environment',
            'Qualitative research',
            'Quantitative research',
            'Policy recommendations',
            'Primary',
            'Secondary',
            'All'
        ])
        .range(['#EAD854', '#77ABDC', '#EF486F', '#39B491',
            '#66c2a5',
            '#fc8d62',
            '#8da0cb',
            '#e78ac3',
            '#a6d854',
            '#ffd92f',
            '#e5c494'
        ]);

    /*
     * This data manipulation function takes the raw data from
     * the CSV file and converts it into an array of node objects.
     * Each node will store data and visualization values to visualize
     * a bubble.
     *
     * rawData is expected to be an array of data objects, read in from
     * one of d3's loading functions like d3.csv.
     *
     * This function returns the new node array, with a node in that
     * array for each element in the rawData input.
     */
    function createNodes(rawData, radiusKey) {

        // console.log(rawData);

        // Use the max Importance in the data as the max in the scale's domain
        // note we have to ensure the Importance is a number.
        var maxAmount = d3.max(rawData, function (d) {
            return +d[radiusKey];
        });

        // Sizes bubbles based on area.
        // @v4: new flattened scale names.
        var radiusScale = d3.scalePow()
            .exponent(0.5)
            .range([2, 11])
            .domain([0, maxAmount]);

        // Use map() to convert raw data into node data.
        // Checkout http://learnjsdata.com/ for more on
        // working with data.
        var myNodes = rawData.map(function (d) {
            return {
                id: d.Quote,
                type: 'node',
                research: d.Type,
                primary: d.Primary,
                description: d.Descritpion,
                sentence: d.Sentence,
                policy_recommendation: d['Policy recommendation'],
                systemic_gap: d['Systemic gap'],
                gap: d['Systemic gap ID'],
                radius: radiusScale(+d[radiusKey]),
                originalRadius: radiusScale(+d[radiusKey]),
                hiddenRadius: 0,
                growRadius: 30,
                soloRadius: 60,
                value: +d[radiusKey],
                priority: d.Priority,
                hidden: {},
                x: Math.random() * 900,
                y: Math.random() * 800
            };
        });

        // sort them to prevent occlusion of smaller nodes.
        myNodes.sort(function (a, b) {
            return b.value - a.value;
        });

        return myNodes;
    }

    /*
     * Main entry point to the bubble chart. This function is returned
     * by the parent closure. It prepares the rawData for visualization
     * and adds an svg element to the provided selector and starts the
     * visualization creation process.
     *
     * selector is expected to be a DOM element or CSS selector that
     * points to the parent element of the bubble chart. Inside this
     * element, the code will add the SVG continer for the visualization.
     *
     * rawData is expected to be an array of data objects as provided by
     * a d3 loading function like d3.csv.
     */
    var chart = function chart(selector, rawData) {

        // console.log(rawData)
        // convert raw data into nodes data //radiusKey
        nodes = createNodes(rawData, 'Importance');

        groupCenters = {};
        titleCenters = {};
        //Initialize filters
        d3.selectAll('#group .button').each(function (d) {
            var nodes_filtered = Array.from(new Set(Object.values(nodes).map(value => value[this.id]))).sort()
            if (this.id != 'all') {
                groupCenters[this.id] = {};
                titleCenters[this.id] = {};
                var n = nodes_filtered.length;
                var m = 1;
                if (n > 4) {
                    m = Math.ceil(n / 4)
                    n = 4
                }
                for (var i = 0; i < nodes_filtered.length; i++) {
                    groupCenters[this.id][nodes_filtered[i]] = {
                        'x': ((i % 4) + 2.5) * width / (n + 4),
                        'y': (Math.floor(i / 4) + 1.5) * height / (m + 2)
                    }
                    titleCenters[this.id][nodes_filtered[i]] = {
                        'x': ((i % 4) + 0.5) * width / (n),
                        'y': (Math.floor(i / 4) + 0.1) * height / (m)
                    }
                }
            }
            createFilter(this.id, '#filter')
        })


        // Create a SVG element inside the provided selector
        // with desired size.
        svg = d3.select(selector)
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        // Bind nodes data to what will become DOM elements to represent them.
        bubbles = svg.selectAll('.bubble')
            .data(nodes, function (d) {
                return d.id;
            });

        // Create new circle elements each with class `bubble`.
        // There will be one circle.bubble for each object in the nodes array.
        // Initially, their radius (r attribute) will be 0.
        // @v4 Selections are immutable, so lets capture the
        //  enter selection to apply our transtition to below.
        var bubblesInit = bubbles.enter().append('g')
            .classed('bubble', true)
            .style('cursor', 'pointer')
            // .on('contextmenu', function(d, i) {
            //     d3.event.preventDefault();
            //     soloDetail(d);
            // })
            .on('click', growDetail)
            .on('mouseover', showDetail)
            .on('mouseout', hideDetail)

        var bubbleCircles = svg.selectAll('.bubble')
            .append('circle')
            .classed('bubbleCircle', true)
            .attr('r', 0)
            .attr('stroke-width', 2)

        if (htmlLabelsOn)
            var bubbleLabels = svg.selectAll('.bubble')
                .append('foreignObject')
                .attr('height', function (d) {
                    return textOuterRadius * 2 * d.radius;
                })
                .attr('width', function (d) {
                    return textOuterRadius * 2 * d.radius;
                })
                .attr('x', function (d) {
                    return -textOuterRadius * d.radius;
                })
                .attr('y', function (d) {
                    return -textOuterRadius * d.radius;
                })
                .classed('bubbleLabel', true)
                .html(function (d) {
                    return '<div class="bubbleLabelText" xmlns="http://www.w3.org/1999/xhtml">' + d.id + '</div>'
                })

        if (d3LabelsOn)
            svg.selectAll('.bubble').each(function (d) {
                var d3text = new d3plus.TextBox()
                    .data([{
                        'text': d.id,
                        'parent': d
                    }])
                    .select(this)
                    .fontResize(true)
                    .height(0)
                    .width(0)
                    .x(0)
                    .y(0)
                    .verticalAlign('middle')
                    .textAnchor('middle')
                    .fontMin(minFontSize)
                // .render()
                d3bubbleLabels.push(d3text);
            })

        // @v4 Merge the original empty selection and the enter selection
        bubbles = bubbles.merge(bubblesInit);

        //Color bubbles
        colorBubbles(colorBy, true) //force coloring

        // Fancy transition to make bubbles appear, ending with the
        // correct radius
        bubbleCircles.transition().duration(2000)
            .attr('r', function (d) {
                return d.radius;
            });
        if (htmlLabelsOn) bubbleLabels.transition().duration(2000)
            .attr('font-size', function (d) {
                return d.radius < minTextRadius ? 0 : textRadius * d.radius;
            });
        if (d3LabelsOn) d3bubbleLabels.forEach(function (e) {
            d = e._data[0].parent;
            e.height(function (f) {
                    return textOuterRadius * 2.1 * d.radius;
                })
                .width(function (f) {
                    return textOuterRadius * 2 * d.radius;
                })
                .x(function (f) {
                    return -textOuterRadius * d.radius;
                })
                .y(function (f) {
                    return -textOuterRadius * d.radius;
                })
                .fontSize(function (f) {
                    return d.radius < minTextRadius ? 0 : textRadius * d.radius;
                })
                .duration(500)
                .delay(1000)
                .render();
        })


        // Set the simulation's nodes to our newly created nodes array.
        // @v4 Once we set the nodes, the simulation will start running automatically!
        simulation.nodes(nodes);

        // Set initial layout
        groupBubbles(groupBy);

        //Set initial titles
        showGroupTitles(groupBy);

        //Create stakeholder table
        createTable();
    };

    var stakeholderTable = d3.select('#stakeholder-table')
        .selectAll('.tableEntry')

    function createTable() {
        stakeholderTable = d3.select('#stakeholder-table')
            .selectAll('.tableEntry')
            .data(nodes)
            .enter()
            .append('div')
            .classed('tableEntry', true)
            .style('display', 'none')
            .html(function (d) {
                return '<table>' +
                    '<tr><td><b>Priority</b></td><td>' + d.priority + '</td></tr>' +
                    '<tr><td><b>Type</b></td><td>' + d.research + '</td></tr>' +
                    ((d.research == 'Policy recommendations') ? '<tr><td><b>Lesson</b></td><td><u>' + d.policy_recommendation + '</u></td></tr>' : '') +
                    ((d.research == 'Policy recommendations') ? '<tr><td><b>Primary</b></td><td>' + d.primary + '</td></tr>' : '') +
                    ((d.research == 'Policy recommendations') ? '<tr><td><b>Systemic Gap</b></td><td>' + d.systemic_gap + '</td></tr>' : '') +
                    ((d.research == 'Policy recommendations') ? '<tr><td><b>Proposed action</b></td><td><i>' + d.id + '</i></td></tr>' : '') +
                    ((d.research == 'Qualitative research') ? '<tr><td><b>Lesson</b></td><td><u>' + d.sentence + '</u></td></tr>' : '') +
                    ((d.research == 'Qualitative research') ? '<tr><td><b>Quote</b></td><td><i><b>' + d.id + '</b></i></td></tr>' : '') +
                    ((d.research == 'Quantitative research') ? '<tr><td><b>Lesson</b></td><td><u>' + d.id + '</u></td></tr>' : '') +
                    ((d.research == 'Quantitative research') ? '<tr><td><b>Data</b></td><td><img src="src/8.png" style="width:180px;"></td></tr>' : '') +
                    '</table>'
            })
    }

    /*
     * Callback function that is called after every tick of the
     * force simulation.
     * Here we do the acutal repositioning of the SVG circles
     * based on the current x and y values of their bound node data.
     * These x and y values are modified by the force simulation.
     */
    function ticked() {
        bubbles
            .attr('transform', function (d) {
                return 'translate(' + d.x + ',' + d.y + ')';
            })
        // .attr('cx', function(d) { return d.x; })
        // .attr('cy', function(d) { return d.y; });
    }

    /*
     * Provides an x, y value for each node to be used with the split by group
     */
    function nodePos(d, groupBy) {
        return {
            'x': groupCenters[groupBy][d[groupBy]].x,
            'y': groupCenters[groupBy][d[groupBy]].y
        }
    }

    /*
     * Sets visualization in "single group mode".
     * The year labels are hidden and the force layout
     * tick function is set to move all nodes to the
     * center of the visualization.
     */
    function centerBubbles() {
        hideGroupTitles();

        // @v4 Reset the 'x' force to draw the bubbles to the center.
        simulation.force('x', d3.forceX().strength(xForceStrength).x(center.x));
        simulation.force('y', d3.forceY().strength(yForceStrength).y(center.y));

        // @v4 We can reset the alpha value and restart the simulation
        simulation.alpha(1).restart();
    }

    /*
     * Sets visualization in "split by year mode".
     * The year labels are shown and the force layout
     * tick function is set to move nodes to the
     * yearCenter of their data's year.
     */
    function groupBubbles(groupBy, groupChanged) {
        if (typeof (groupChanged) === 'undefined') groupChanged = false;
        if (groupBy == 'all') {
            centerBubbles();
        } else {
            if (groupChanged) {
                hideGroupTitles();
                showGroupTitles(groupBy);
            }
            // @v4 Reset the 'x' force to draw the bubbles to their year centers
            simulation.force('x', d3.forceX().strength(xForceStrength)
                .x(function (d) {
                    return d.type == 'node' ?
                        nodePos(d, groupBy).x :
                        d.xPos
                }));
            // @v4 Reset the 'y' force to draw the bubbles to their year centers
            simulation.force('y', d3.forceY().strength(yForceStrength)
                .y(function (d) {
                    return d.type == 'node' ?
                        nodePos(d, groupBy).y :
                        d.yPos
                }));

            // @v4 We can reset the alpha value and restart the simulation
            simulation.alpha(1).restart();
        }
    }

    /*
     * Hides Year title displays.
     */
    function hideGroupTitles() {
        d3.selectAll('#filter span')
            .classed('hidden', true)
        svg.selectAll('.title')
            .transition()
            .attr('x', width / 2)
            .attr('y', height / 2)
            .style('opacity', 0)
            .remove();
    }

    /*
     * Shows Year title displays.
     */
    function showGroupTitles(groupBy) {

        d3.selectAll('#filter #' + groupBy)
            .classed('hidden', false)

        // Another way to do this would be to create
        // the year texts once and then just hide them.
        var groupData = d3.keys(groupCenters[groupBy]);
        var groups = svg.selectAll('.year')
            .data(groupData);

        groups.enter().append('text')
            .attr('class', 'title')
            .attr('id', function (d) {
                return 'title_' + replaceSpaces(d)
            })
            .attr('x', width / 2)
            .attr('y', height / 2)
            .style('opacity', 0)
            .transition()
            .attr('x', function (d) {
                return groupTitle(groupBy, d).x;
            })
            .attr('y', function (d) {
                return groupTitle(groupBy, d).y;
            })
            .style('opacity', function (d) {
                return d3.select('#toggle_' + groupBy + '_' + replaceSpaces(d)).classed('active') ? 1 : 0;
            })
            .attr('text-anchor', 'middle')
            .style('fill', function (d) {
                return d3.rgb(fillColor(d)).brighter()
            })
            .style('stroke', function (d) {
                return d3.rgb(fillColor(d))
            })
            .style('stroke-wdith', 1)
            .text(function (d) {
                return d;
            })

    }

    function updateGroupTitles(groupBy) {

        d3.selectAll('.title').transition()
            .style('opacity', function (d) {
                return d3.select('#toggle_' + groupBy + '_' + replaceSpaces(d)).classed('active') ? 1 : 0;
            })

    }

    function createFilter(groupBy, selector) {

        var filterData = []
        d3.keys(groupCenters[groupBy]).forEach(function (d) {
            filterData.push(groupBy + '_' + d)
        })
        var filter = d3.select(selector)
            .append('span')
            .classed('hidden', true)
            .attr('id', groupBy)
        filter
            .selectAll('.toggle')
            .data(filterData).enter().append('a')
            .attr('id', function (d) {
                return 'toggle_' + replaceSpaces(d)
            })
            .attr('class', 'button toggle active').text(function (d) {
                return d.replace(groupBy + '_', '');
            })
            .style('background-color', function (d) {
                return fillColor(d.replace(groupBy + '_', ''));
            })
            .on('click', function (d) {
                d3.select(this).classed('active', d3.select(this).classed('active') ? false : true)
                    .style('background-color', function (d) {
                        return d3.select(this).classed('active') ? fillColor(d.replace(groupBy + '_', '')) : 'white';
                    })
                filterBubbles(d3.selectAll('.toggle.active').data(), groupBy);
                redrawBubbles();
            })

    }

    function filterBubbles(array, filterBy) {
        d3.selectAll('.bubble').attr('id', function (d) {
            d.hidden[filterBy] = (array.indexOf(groupBy + '_' + d[filterBy]) < 0) ? true : false
            d.radius = Object.values(d.hidden).every(v => v === false) ?
                d.solo ?
                d.soloRadius :
                d.grow ?
                d.growRadius :
                d.originalRadius :
                d.hiddenRadius
        })
        //need to update group titles
        if (groupBy === filterBy) {
            updateGroupTitles(groupBy);
        }
    }

    function colorBubbles(colorBy, force) {
        if (typeof (force) === 'undefined') force = false;

        d3.selectAll('.bubble').attr('id', function (d) {
            d.fill = d.solo ?
                d3.rgb(fillColor(d[colorBy])) :
                d.grow ?
                d3.rgb(fillColor(d[colorBy])) :
                d3.rgb(fillColor(d[colorBy])).brighter();
            d.stroke = d.solo ?
                d3.rgb(fillColor(d[colorBy])).darker().darker() :
                d.grow ?
                d3.rgb(fillColor(d[colorBy])).darker() :
                d3.rgb(fillColor(d[colorBy]));
            d.textColor = d.solo ?
                d3.rgb(fillColor(d[colorBy])).brighter().brighter().brighter() :
                d.grow ?
                d3.rgb(fillColor(d[colorBy])).brighter().brighter().brighter() :
                d3.rgb(fillColor(d[colorBy])).darker().darker();
            d.strokeDash = d.solo ?
                "10, 10" :
                "none"
            if (force) {
                d3.selectAll('.bubble').select('.bubbleCircle')
                    .attr('fill', function (d) {
                        return d.fill
                    })
                    .attr('stroke', function (d) {
                        return d.stroke
                    })
                    .attr('stroke-dasharray', function (d) {
                        return d.strokeDash
                    })
                if (htmlLabelsOn) d3.selectAll('.bubbleLabel')
                    .style('color', function (d) {
                        return d.textColor
                    })
                if (d3LabelsOn) d3bubbleLabels.forEach(function (e) {
                    d = e._data[0].parent;
                    e.fontColor(d.textColor)
                })
            }
        })
    }

    function redrawBubbles(v, groupChanged) {
        if (typeof (v) === 'undefined') v = 0.5;
        if (typeof (groupChanged) === 'undefined') groupChanged = false;

        // colorBy = groupBy; //if it is toggled
        colorBubbles(colorBy)
        groupBubbles(groupBy, groupChanged)

        d3.selectAll('.bubble').select('.bubbleCircle').transition().attr('r', function (d) {
                return d.radius + 'px';
            })
            .attr('fill', function (d) {
                return d.fill
            })
            .attr('stroke', function (d) {
                return d.stroke
            })
            .attr('stroke-dasharray', function (d) {
                return d.strokeDash
            })

        if (htmlLabelsOn) d3.selectAll('.bubbleLabel').transition()
            .attr('height', function (d) {
                return textOuterRadius * 2 * d.radius;
            })
            .attr('width', function (d) {
                return textOuterRadius * 2 * d.radius;
            })
            .attr('x', function (d) {
                return -textOuterRadius * d.radius;
            })
            .attr('y', function (d) {
                return -textOuterRadius * d.radius;
            })
            .attr('font-size', function (d) {
                return d.radius < minTextRadius ? 0 : textRadius * d.radius;
            })
            .style('color', function (d) {
                return d.textColor
            })

        if (d3LabelsOn) d3bubbleLabels.forEach(function (e) {
            d = e._data[0].parent;
            e.height(function (f) {
                    return textOuterRadius * 2.1 * d.radius;
                })
                .width(function (f) {
                    return textOuterRadius * 2 * d.radius;
                })
                .fontColor(d.textColor)
                .fontSize(function (f) {
                    return d.radius < minTextRadius ? 0 : textRadius * d.radius;
                })
                .duration(400).delay(0).render();
        })

        simulation.nodes(nodes);
        simulation.alpha(v).restart();
        setTimeout(function () {
            filterTable();
        }, 500)
    }

    function filterTable() {
        stakeholderTable
            .data(nodes)
            .style('display', function (d) {
                return ((Object.values(d.hidden).every(v => v === false)) && ((d.grow))) ? 'inline' : 'none'
            })
    }

    /*
     * Function called on click to display the
     * details of a growing bubble.
     */

    function growDetail(d) {
        if (d.solo) {
            removeSoloFromAll();
        }
        if (d.grow) {
            d.radius = d.originalRadius;
            d.grow = false;
        } else {
            d.radius = d.growRadius;
            d.grow = true;
        }
        redrawBubbles();
    }

    function removeSoloFromAll() {
        d3.selectAll('.bubble').attr('id', function (d) {
            d.hidden['id'] = false;
            d.solo = false;
        })
        filterBubbles(d3.selectAll('.toggle.active').data(), groupBy);
    }

    function soloDetail(d) {
        if (d.solo) {
            removeSoloFromAll();
        } else {
            removeSoloFromAll();
            d.solo = true;
            var filtered = Object.fromEntries(Object.entries(edges[d.id]).filter(([k, v]) => v > 2));
            filterBubbles(Object.keys(filtered).concat(d.id), 'id')
        }
        redrawBubbles();
    }
    /*
     * Function called on mouseover to display the
     * details of a bubble in the tooltip.
     */
    function showDetail(d) {
        // change outline to indicate hover state.
        d3.select(this).select('.bubbleCircle').attr('stroke-width', function (d) {
            return d.solo ? 4 : 4
        });

        var content = '<span class="name"></span><span class="value">' +
            d.id +
            '</span>';

        tooltip.showTooltip(content, d3.event);
    }

    /*
     * Hides tooltip
     */
    function hideDetail(d) {
        // reset outline
        d3.select(this).select('.bubbleCircle').attr('stroke-width', function (d) {
            return d.solo ? 2 : 2
        });

        tooltip.hideTooltip();
    }

    /*
     * Externally accessible function (this is attached to the
     * returned chart function). Allows the visualization to toggle
     * between "single group" and "split by year" modes.
     *
     * displayName is expected to be a string and either 'year' or 'all'.
     */
    chart.toggleDisplay = function (displayType, displayName) {
        if (displayType === 'group') {
            // groupBubbles(displayName);
            var groupChanged = false;
            if (groupBy != displayName) groupChanged = true;
            groupBy = displayName;
        } else if (displayType === 'color') {
            // colorBubbles(displayName);
            colorBy = displayName;
        }
        redrawBubbles(1, groupChanged);
    };

    // return the chart function from closure.
    return chart;
}

/*
 * Below is the initialization code as well as some helper functions
 * to create a new bubble chart instance, load the data, and display it.
 */

var myBubbleChart = bubbleChart();

/*
 * Function called once data is loaded from CSV.
 * Calls bubble chart function to display inside #vis div.
 */
function display(error, data) {
    if (error) {
        console.log(error);
    }

    myBubbleChart('#vis', data);
}

/*
 * Sets up the layout buttons to allow for toggling between view modes.
 */
function setupButtons() {
    d3.select('#toolbar')
        .selectAll('#group .button')
        .on('click', function () {
            // Remove active class from all buttons
            d3.selectAll('#group .button').classed('active', false);
            // Find the button just clicked
            var button = d3.select(this);
            // Set it as the active button
            button.classed('active', true);
            // Get the id of the button
            var buttonId = button.attr('id');
            // Toggle the bubble chart based on
            // the currently clicked button.
            myBubbleChart.toggleDisplay('group', buttonId);
        });
    groupBy = d3.select('#group .active').attr('id')

    d3.select('#toolbar')
        .select('#color')
        .html(d3.select('#group').html())
    d3.select('#toolbar')
        .select('#color')
        .select('.button-title')
        .text('Color by')

    d3.select('#toolbar')
        .selectAll('#color .button')
        .on('click', function () {
            // Remove active class from all buttons
            d3.selectAll('#color .button').classed('active', false);
            // Find the button just clicked
            var button = d3.select(this);
            // Set it as the active button
            button.classed('active', true);
            // Get the id of the button
            var buttonId = button.attr('id');
            // Toggle the bubble chart based on
            // the currently clicked button.
            myBubbleChart.toggleDisplay('color', buttonId);
        });

    d3.select('#toolbar').transition().duration(1500).delay(500).style('opacity', 1);
    colorBy = d3.select('#color .active').attr('id')

}

// Load the data.
d3.json('data/lessons.json', display);

// setup the buttons.
setupButtons();

//utils
function replaceSpaces(s) {
    return s.replace(/ /g, "-").replace('.', '-').replace('/', '-');
}

function wrap(text, width) {
    text.each(function () {
        var text = d3.select(this),
            words = text.text().split(/\s+/).reverse(),
            word,
            line = [],
            lineNumber = 0,
            lineHeight = 1.1, // ems
            y = text.attr("y"),
            dy = parseFloat(text.attr("dy")),
            tspan = text.text(null).append("tspan").attr("x", 0).attr("y", y).attr("dy", dy + "em");
        while (word = words.pop()) {
            line.push(word);
            tspan.text(line.join(" "));
            if (tspan.node().getComputedTextLength() > width) {
                line.pop();
                tspan.text(line.join(" "));
                line = [word];
                tspan = text.append("tspan").attr("x", 0).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
            }
        }
    });
}

/*
TODO
forces X/Y ratio extend over screen size
*/