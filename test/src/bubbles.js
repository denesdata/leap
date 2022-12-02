/* bubbleChart creation function. Returns a function that will
 * instantiate a new bubble chart given a DOM element to display
 * it in and a dataset to visualize.
 *
 * Keyword and style inspired by:
 * https://bost.ocks.org/mike/chart/
 *
 */
//Parameters
var colorBy = 'priority';
var groupBy = 'priority';
var neighbors = 'off';
var textRadius = 0.6;
var textOuterRadius = 0.75;
var minTextRadius = 15; //diameter of smallest bubble to receive a label
var minFontSize = 7; //font size of smallest bubble to receive a label
var hiddenFontSize = 7; //font size below which the label get opacity 0
var d3bubbleLabels = new Array();
var htmlLabelsOn = false;
var d3LabelsOn = true;

// Constants for sizing
var width = 1000;
var height = 400;

function bubbleChart() {


    // tooltip for mouseover functionality
    var tooltip = floatingTooltip('bubbles_tooltip', 140);
    var tooltip2 = floatingTooltip('graph_tooltip', 140);

    // Locations to move bubbles towards, depending
    // on which view mode is selected.
    var center = {
        x: width / 2,
        y: height / 2
    };

    var groupCenters = {
        'priority': {
            'IED': {
                x: 2 * width / 7,
                y: height / 2
            },
            'Transport': {
                x: 3 * width / 7,
                y: height / 2
            },
            'Agency': {
                x: 4 * width / 7,
                y: height / 2
            },
            'Specialist lending': {
                x: 5 * width / 7,
                y: height / 2
            }
        }
    };

    var titleCenters = {
        'priority': {
            'IED': {
                x: 1.4 * width / 8,
                y: height / 2
            },
            'Transport': {
                x: 2.9 * width / 8,
                y: height / 2
            },
            'Agency': {
                x: 4.6 * width / 8,
                y: height / 2
            },
            'Specialist lending': {
                x: 6.6 * width / 8,
                y: height / 2
            }
        }
    };

    // X locations of the titles.
    function groupTitle(groupBy, d) {
        return {
            'x': titleCenters[groupBy][d].x,
            'y': groupCenters[groupBy][d].y - height / 2 + 30
        }
    };

    // @v4 strength to apply to the position forces
    var xForceStrength = 0.025;
    var yForceStrength = 0.04;

    // These will be set in create_nodes and create_vis
    var svg = null;
    var bubbles = null;
    var nodes = [];
    var nodeDict = {};

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
        return -Math.pow(d.radius, 2.2) * xForceStrength; //2.15
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
        .domain(['IED',
            'Transport',
            'Agency',
            'Specialist lending'
        ])
        .range(['#EAD854', '#77ABDC', '#EF486F', '#39B491']);

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
        var maxAmount = d3.max(rawData, function(d) {
            return +d[radiusKey];
        });

        // Sizes bubbles based on area.
        // @v4: new flattened scale names.
        var radiusScale = d3.scalePow()
            .exponent(0.5)
            .range([12, 45])
            .domain([0, maxAmount]);

        // Use map() to convert raw data into node data.
        // Checkout http://learnjsdata.com/ for more on
        // working with data.
        var myNodes = rawData.map(function(d) {
            nodeDict[d.Keyword] = d.Priority;
            return {
                id: d.Keyword,
                type: 'node',
                radius: radiusScale(+d[radiusKey]),
                originalRadius: radiusScale(+d[radiusKey]),
                hiddenRadius: 0,
                growRadius: 50,
                soloRadius: 60,
                value: +d.Total,
                priority: d.Priority,
                hidden: {},
                x: Math.random() * 900,
                y: Math.random() * 800
            };
        });

        // sort them to prevent occlusion of smaller nodes.
        myNodes.sort(function(a, b) {
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
        // convert raw data into nodes data //radiusKey
        nodes = createNodes(rawData.nodes, 'Total');
        edges = rawData.edges;
        table = rawData.table;
        lessons = rawData.lessons;
        graphs = rawData.graphs;

        // console.log(rawData)
        // Create a SVG element inside the provided selector
        // with desired size.
        svg = d3.select(selector)
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        // Bind nodes data to what will become DOM elements to represent them.
        bubbles = svg.selectAll('.bubble')
            .data(nodes, function(d) {
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
            .on('contextmenu', function(d, i) {
                d3.event.preventDefault();
                soloDetail(d);
            })
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
                .attr('height', function(d) {
                    return textOuterRadius * 2 * d.radius;
                })
                .attr('width', function(d) {
                    return textOuterRadius * 2 * d.radius;
                })
                .attr('x', function(d) {
                    return -textOuterRadius * d.radius;
                })
                .attr('y', function(d) {
                    return -textOuterRadius * d.radius;
                })
                .classed('bubbleLabel', true)
                .html(function(d) {
                    return '<div class="bubbleLabelText" xmlns="http://www.w3.org/1999/xhtml">' + d.id + '</div>'
                })

        if (d3LabelsOn)
            svg.selectAll('.bubble').each(function(d) {
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
            .attr('r', function(d) {
                return d.radius;
            });
        if (htmlLabelsOn) bubbleLabels.transition().duration(2000)
            .attr('font-size', function(d) {
                return d.radius < minTextRadius ? 0 : textRadius * d.radius;
            });
        if (d3LabelsOn) d3bubbleLabels.forEach(function(e) {
            d = e._data[0].parent;
            e.height(function(f) {
                    return textOuterRadius * 2.1 * d.radius;
                })
                .width(function(f) {
                    return textOuterRadius * 2 * d.radius;
                })
                .x(function(f) {
                    return -textOuterRadius * d.radius;
                })
                .y(function(f) {
                    return -textOuterRadius * d.radius;
                })
                .fontSize(function(f) {
                    return d.radius < minTextRadius ? 0 : textRadius * d.radius;
                })
                .duration(500)
                .delay(1000)
                .render();
        })


        // Set the simulation's nodes to our newly created nodes array.
        // @v4 Once we set the nodes, the simulation will start running automatically!
        simulation.nodes(nodes);

        // Set initial layout to single group.
        // groupBubbles();

        // Set initial layout to grouped.
        groupBubbles(groupBy);

        //Set initial titles
        showGroupTitles(groupBy);

        //Create stakeholder table
        createTable();
        createLessons();
    };

    function createTable() {
        var stakeholderTable = d3.select('#stakeholder-table tbody')
            .selectAll('.tableEntry')
            .data(table)
            .enter()
            .append('tr')
            .classed('tableEntry', true)
            .classed('tableEntry-hidden', true)

        stakeholderTable.append('td')
            .classed('matches', true)
        stakeholderTable.append('td')
            .classed('stakeholder', true)
            .classed('stakeholder-hidden', true)
            .html(function(d) {
                var keywords = '';
                for (k of d.keywords) {
                    keywords = keywords + '<span class="keyword" style="background-color:' +
                        d3.rgb(fillColor(nodeDict[k])) + ';">' + k.replace(' ', '&nbsp;') + '</span> ';
                }
                return '<div class="stakeholder-title"><span class="stakeholder-icon">►</span>&nbsp;&nbsp;<span>' + d.name + '</span></div>' +
                    '<div class="stakeholder-description"><div class="stakeholder-card">' +
                    (d.web ? ('<b>Webpage</b>: <a href="' + d.web + '" target="_blank">' + d.web + ' </a><br>') : '') +
                    (d.fb ? ('<b>Social media</b>: <a href="https://' + d.fb + '" target="_blank">' + d.fb + ' </a><br>') : '') +
                    '<b>Year of establishment</b>: ' + d.year + '<br>' +
                    '<b>Legal form</b>: ' + d.legal + '<br>' +
                    '<b>Object of activity</b>: ' + d.activity + '<br>' +
                    '<b>Operating level</b>: ' + d.level +
                    '</div>' +
                    '<div class="stakeholder-keywords">' + keywords + '</div></div>'
            })
        d3.selectAll('.stakeholder-title')
            .on('click', function(d) {
                d3.select(this.parentNode).classed('stakeholder-hidden', (d3.select(this.parentNode).classed('stakeholder-hidden') ? false : true));
                d3.select(this.parentNode).select('.stakeholder-icon').text(d3.select(this.parentNode).classed('stakeholder-hidden') ? '►' : '▼');
            })
        d3.select('#stakeholder-head')
            .on('click', function(d) {
                d3.select('#stakeholder-table').classed('stakeholder-head-hidden', (d3.select('#stakeholder-table').classed('stakeholder-head-hidden') ? false : true));
                d3.select('.stakeholder-head-icon').text(d3.select('#stakeholder-table').classed('stakeholder-head-hidden') ? '►' : '▼');
            })
        d3.select('#tabs-head').selectAll('.button')
            .on('click', function(d) {
                d3.select('#tabs-head').selectAll('.button').classed('active', false)
                d3.select(this).classed('active', true)
                d3.select('#stakeholder-all')
                    .style('max-height', d3.select('#stakeholder-tab').classed('active') ? '99999px' : '0px')
                    .style('opacity', d3.select('#stakeholder-tab').classed('active') ? 1 : 0)
                d3.select('#lessons-all')
                    .style('max-height', d3.select('#lessons-tab').classed('active') ? '99999px' : '0px')
                    .style('opacity', d3.select('#lessons-tab').classed('active') ? 1 : 0)
            })
        setTimeout(function() {
            // d3.selectAll('.tableEntry')
            //     .classed('tableEntry-hidden', false)
            filterTable();
        }, 4000)
    }

    function createGraph(i, s) {
        i = String(i);

        function colorizer(d) {
            if (d == 'children') return d3.rgb(255, 255, 255, 0.6)
            else if (d == 'youth') return d3.rgb(255, 255, 255, 0.8)
            else if (d == 'parents') return d3.rgb(255, 255, 255, 1)
            else if (d == 'teachers') return d3.rgb(255, 255, 255, 0.4)
            else if (d == 'sometimes') return d3.rgb(255, 255, 255, 0.6)
            else if (d == 'often') return d3.rgb(255, 255, 255, 1)
            else if (d == 'always') return d3.rgb(255, 255, 255, 1)
            else if (d == 'never') return d3.rgb(255, 255, 255, 0.2)
            else if (d == 'once') return d3.rgb(255, 255, 255, 0.4)
            else if (d == '2-3 times') return d3.rgb(255, 255, 255, 0.6)
            else if (d == 'more than 3 times') return d3.rgb(255, 255, 255, 0.8)
            else if (d == 'almost everyday') return d3.rgb(255, 255, 255, 1)
            else if (d == '7-14 days') return d3.rgb(255, 255, 255, 0.8)
            else if (d == '4-6 days') return d3.rgb(255, 255, 255, 0.6)
            else if (d == '1-3 days') return d3.rgb(255, 255, 255, 0.4)
            else if (d == 'not one day') return d3.rgb(255, 255, 255, 0.2)
            else if (d == 'almost everyday') return d3.rgb(255, 255, 255, 1)
            else if (d == 'at least once a week') return d3.rgb(255, 255, 255, 0.8)
            else if (d == 'several times a month') return d3.rgb(255, 255, 255, 0.6)
            else if (d == 'once a month or less') return d3.rgb(255, 255, 255, 0.4)
            else if (d == 'mostly school') return d3.rgb(255, 255, 255, 0.2)
            else if (d == 'mostly parents') return d3.rgb(255, 255, 255, 1)
            else if (d == 'more parents than school') return d3.rgb(255, 255, 255, 0.8)
            else if (d == 'both school and parents ') return d3.rgb(255, 255, 255, 0.6)
            else if (d == 'more school than parents') return d3.rgb(255, 255, 255, 0.4)
            else if (d == 'sex') return d3.rgb(255, 255, 255, 1)
            else if (d == 'talked about') return d3.rgb(255, 255, 255, 1)
            else return d3.rgb(255, 255, 255, 0.5)
        }

        if (Object.keys(graphs).indexOf(i) > -1) {
            var options = (new Set(graphs[i].data.map(value => value.option)));
            var ids = (new Set(graphs[i].data.map(value => value.id)));
            // size = Math.min(7, options.size) *
            //     // (new Set(graphs[i].data.map(value => value.id))).size + 4;
            //     // (ids.size > 3 ? 1.5 : 1) + 4;
            //     Math.min(3, ids.size) + 4;
            var barHeight = 27;
            size = options.size * Math.min(3, ids.size) * barHeight;
            size = size * (ids.size > 1 ? (ids.size * options.size < 11 ? 1.2 : 1) : 1.3)
            size = Math.max(150, Math.min(size, 600)) + 30;
            s.style('min-height', size + 'px')

            new d3plus.BarChart()
                .select(s.node())
                .config({
                    data: graphs[i].data,
                    title: ((graphs[i].title == 'None') ? false : graphs[i].title),
                    titlePadding: false,
                    label: function(d) { return (ids.size > 1) ? d['id'] : d['value'] },
                    titleConfig: {
                        fontSize: 14,
                        padding: '00 0 20 0'
                    },
                    // barPadding: 1,
                    // groupPadding: 5,
                    x: "value",
                    y: "option",
                    discrete: 'y',
                    loadingMessage: false,
                    // height: size,
                    color: function(d) {
                        return colorizer(d.id)
                    },
                    yConfig: {
                        minSize: 60,
                        maxSize: 110,
                        labelOffset: false,
                        barConfig: {
                            stroke: 'white',
                        },
                        gridConfig: {
                            stroke: "transparent"
                        },
                        shapeConfig: {
                            stroke: "white",
                        }
                    },
                    xConfig: {
                        barConfig: {
                            stroke: 'white',
                        },
                        gridConfig: {
                            stroke: "transparent"
                        },
                        shapeConfig: {
                            stroke: "white"
                        }
                    },
                    tooltipConfig: {
                        title: function(d) {
                            return d["id"];
                        },
                        tbody: [
                            [function(d) {
                                return d["option"] + ': '
                            }, function(d) {
                                return d["value"] + " %"
                            }]
                        ]
                    },
                    legend: false,
                    duation: 500,
                    detectVisibleInterval: 200,
                    // detectVisible: false,
                    // detectResize: false
                })
                .render();
        }
    }

    function createGraph2(i, s) {
        setTimeout(function() {
            setTimeout(function() {
                n = s.append('object')
                    .attr('type', 'image/svg+xml')
                    .attr('data', function(d) { return "svg/" + d.Graph + ".svg" })

                n.append('img')
                    .attr('src', function(d) { return "svg/" + d.Graph + ".svg" })

            }, 2000 * Math.random())

            // wait until all the resources are loaded
            // window.addEventListener("load", createGraphTooltips, false);

            function createGraphTooltips() {
                d3.selectAll('.graph').select('object').nodes().forEach(function(n) {
                    d3.select(n.getSVGDocument())
                        .selectAll('.d3plus-Bar')
                        // .attr('fill', 'lime')
                        .style('cursor', 'pointer')
                        .on('mouseover', function(d) {
                            a = d3.select(this).attr('aria-label')
                            id = d3.select(this).attr('class')
                            id = id.slice(id.search('d3plus-id-') + 10)
                            offset = [n.getBoundingClientRect().x, n.getBoundingClientRect().y]
                            x = a.slice(a.search('x:') + 3, a.search('y:') - 2)
                            y = a.slice(a.search('y:') + 3, -1)
                            console.log(d3.select(this))
                            content = ('<b class="thin">' + y + '</b><br>' + id + ': ' + x + ' %').replace('�', "'")
                            tooltip2.showTooltip(content, d3.event, offset);
                        })
                        .on('mouseout', tooltip2.hideTooltip)
                })
            }

            setTimeout(function() {
                createGraphTooltips()
            }, 15000)
        }, 2000)
    }

    function createLessons() {

        var typ = {
            'Qualitative research': 'qual',
            'Quantitative research': 'quan',
            'Policy recommendations': 'pol'
        }
        var lessonsTable = d3.select('#lessons-table')
            .selectAll('.lessonEntry')
            .data(lessons)
            .enter()
            .append('div')
            .classed('lessonEntry', true)
            .classed('lessonEntry-hidden', true)
            .style('border-color', function(d) {
                return d3.rgb(fillColor(d.Priority)).darker()
            })
            .style('background', function(d) {
                return d3.rgb(fillColor(d.Priority)).darker() //'linear-gradient(to bottom right, ' +
                    //d3.rgb(fillColor(d.Priority)).darker() + ', ' +
                    //d3.rgb(fillColor(d.Priority)) + ')';
            })

        lessonsTable.append('div')
            .append('img')
            .classed('lesson-img', true)
            .attr('src', function(d) {
                return 'img/type/' +
                    // replaceSpaces(d.Priority) + '_' +
                    typ[d.Type] + '.png'
            })
        lessonsTable.append('div')
            .classed('matches', true)
        lessonsTable.append('div')
            .classed('lesson-keywords', true)
            .html(function(d) {
                var keywords = '';
                for (k of Object.keys(d.keywords)) {
                    keywords = keywords + '<span class="keyword" style="background-color:' +
                        d3.rgb(fillColor(nodeDict[k])) + ';">' + k.replace(' ', '&nbsp;') + '</span> ';
                }
                return '' + keywords + ''
            })
        lessonsTable.append('div')
            .classed('lesson', true)
            .html(function(d) {
                return '<div class="lesson-body">' +
                    // '<tr><td><b>Priority</b></td><td>' + d.Priority + '</td></tr>' +
                    // '<tr><td><b>Type</b></td><td>' + d.Type + '</td></tr>' +
                    ((d.Type == 'Policy recommendations') ? '<div class="pol" style="margin-top:30px;">★ Proposed action</div><div class="lesson">' + d.Quote + '</div>' : '') +
                    ((d.Type == 'Policy recommendations') ? '<div class="pol">☘ Policy recommendation ' + d['Policy recommendation ID'] + '</div><div class="simpleText">' + d['Policy recommendation'] + '</div>' : '') +
                    ((d.Type == 'Policy recommendations') ? '<div class="pol">◉ Systemic Gap ' + d['Systemic gap ID'] + '</div><div class="simpleText">' + d['Systemic gap'] + '</div>' : '') +
                    ((d.Type == 'Qualitative research') ? '<div class="lesson" style="margin-top:30px;">' + d.Sentence + '</div>' : '') +
                    // ((d.Type == 'Qualitative research') ? '<div class="simpleText">' + d.Description + '</div>' : '') +
                    ((d.Type == 'Qualitative research') ? '<div class="quote"><table><tr><td>&ldquo;</td><td>' + d.Quote +
                        '</td></tr></table></div>' : '') +
                    ((d.Type == 'Quantitative research') ? '<div class="lesson" style="margin-top:30px;">' + d.Quote + '</div>' : '') +
                    ((d.Type == 'Quantitative research') ?
                        // ((d.Graph != 'None') ? '<div><img src="quant/' + d.Graph + '.png" style="width:245px;margin-top:10px;"></div>' : '') : '') +
                        ((d.Graph != 'None') ? '' : '') : '') +
                    '</div>' +
                    ((d.Graph != 'None') ? '<div class="graph" id="graph' + d.Graph + '"></div>' : '')
                    // ((d.Graph != 'None') ? '<div class="graph" id="graph' + d.Graph + '"></div><img src="svg/' + d.Graph + '.svg">' : '')
            })
            .classed('processed', function(d) {
                if (d.Graph != 'None') {
                    // createGraph(d.Graph, d3.select(this).select('.graph'))
                    createGraph2(d.Graph, d3.select(this).select('.graph'))
                } else return true;
            })
        d3.select('#lessons-head th')
            .on('click', function(d) {
                d3.select('#lessons-table').classed('lessons-head-hidden', (d3.select('#lessons-table').classed('lessons-head-hidden') ? false : true));
                d3.select('.lessons-head-icon').text(d3.select('#lessons-table').classed('lessons-head-hidden') ? '►' : '▼');
            })
        d3.selectAll('#lessons-legend .button')
            .on('click', function(d) {
                d3.select(this).classed('active', (d3.select(this).classed('active') ? false : true));
                filterLessons();
            })
        setTimeout(function() {
            // d3.selectAll('.lessonEntry')
            //     .classed('lessonEntry-hidden', false)
            filterLessons();
        }, 6000)
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
            .attr('transform', function(d) {
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
    function groupBubbles(groupBy) {
        if (groupBy == 'all') {
            centerBubbles();
        } else {
            hideGroupTitles();
            showGroupTitles(groupBy);

            // @v4 Reset the 'x' force to draw the bubbles to their year centers
            simulation.force('x', d3.forceX().strength(xForceStrength)
                .x(function(d) {
                    return d.type == 'node' ?
                        nodePos(d, groupBy).x :
                        d.xPos
                }));
            // @v4 Reset the 'y' force to draw the bubbles to their year centers
            simulation.force('y', d3.forceY().strength(yForceStrength)
                .y(function(d) {
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

        // Another way to do this would be to create
        // the year texts once and then just hide them.
        var groupData = d3.keys(groupCenters[groupBy]);
        var groups = svg.selectAll('.year')
            .data(groupData);

        groups.enter().append('text')
            .attr('class', 'title')
            .attr('id', function(d) {
                return 'title_' + replaceSpaces(d)
            })
            .attr('x', width / 2)
            .attr('y', height / 2)
            .style('opacity', 0)
            .transition()
            .attr('x', function(d) {
                return groupTitle(groupBy, d).x;
            })
            .attr('y', function(d) {
                return groupTitle(groupBy, d).y;
            })
            .style('opacity', function(d) {
                return d3.select('#toggle_' + replaceSpaces(d)).classed('active') ? 1 : 0;
            })
            .attr('text-anchor', 'middle')
            .style('fill', function(d) {
                return d3.rgb(fillColor(d)).brighter()
            })
            .style('stroke', function(d) {
                return d3.rgb(fillColor(d))
            })
            .style('stroke-wdith', 1)
            .text(function(d) {
                return d;
            })

    }

    function updateGroupTitles(groupBy) {

        d3.selectAll('.title').transition()
            .style('opacity', function(d) {
                return d3.select('#toggle_' + replaceSpaces(d)).classed('active') ? 1 : 0;
            })

    }

    function createFilter(groupBy, selector) {
        var filterData = d3.keys(groupCenters[groupBy])
        d3.select(selector)
            .selectAll('.toggle')
            .data(filterData).enter().append('a')
            .attr('id', function(d) {
                return 'toggle_' + replaceSpaces(d)
            })
            .attr('class', 'button toggle active').text(function(d) {
                return d;
            })
            .style('background-color', function(d) {
                return fillColor(d);
            })
            .on('click', function(d) {
                d3.select(this).classed('active', d3.select(this).classed('active') ? false : true)
                    .style('background-color', function(d) {
                        return d3.select(this).classed('active') ? fillColor(d) : 'white';
                    })
                filterBubbles(d3.selectAll('.toggle.active').data(), groupBy);
                redrawBubbles();
            })

    }

    //Initialize filters
    createFilter('priority', '#filter')

    function filterBubbles(array, filterBy) {
        d3.selectAll('.bubble').attr('id', function(d) {
                d.hidden[filterBy] = (array.indexOf(d[filterBy]) < 0) ? true : false
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
            updateGroupTitles(array, filterBy);
        }
    }

    function colorBubbles(colorBy, force) {
        if (typeof(force) === 'undefined') force = false;

        d3.selectAll('.bubble').attr('id', function(d) {
            d.fill = d.solo ?
                d3.rgb(fillColor(d[colorBy])) :
                d.grow ?
                d3.rgb(fillColor(d[colorBy])) :
                d3.rgb(fillColor(d[colorBy])).brighter();
            d.stroke = d.solo ?
                // d3.rgb(fillColor(d[colorBy])).darker().darker() :
                // d.grow ?
                // d3.rgb(fillColor(d[colorBy])).darker() :
                // d3.rgb(fillColor(d[colorBy]));
                'white' :
                d.grow ?
                'white' :
                d3.rgb(fillColor(d[colorBy]));
            d.textColor = d.solo ?
                // d3.rgb(fillColor(d[colorBy])).brighter().brighter().brighter() :
                // d.grow ?
                // d3.rgb(fillColor(d[colorBy])).brighter().brighter().brighter() :
                // d3.rgb(fillColor(d[colorBy])).darker().darker();
                'white' :
                d.grow ?
                'white' :
                '#243666';
            d.strokeDash = d.solo ?
                "10, 10" :
                "none"
            if (force) {
                d3.selectAll('.bubble').select('.bubbleCircle')
                    .attr('fill', function(d) {
                        return d.fill
                    })
                    .attr('stroke', function(d) {
                        return d.stroke
                    })
                    .attr('stroke-dasharray', function(d) {
                        return d.strokeDash
                    })
                if (htmlLabelsOn) d3.selectAll('.bubbleLabel')
                    .style('color', function(d) {
                        return d.textColor
                    })
                if (d3LabelsOn) d3bubbleLabels.forEach(function(e) {
                    d = e._data[0].parent;
                    e.fontColor(d.textColor)
                })
            }
        })
    }

    function redrawBubbles(v) {
        if (typeof(v) === 'undefined') v = 0.5;

        colorBubbles(colorBy)

        d3.selectAll('.bubble').select('.bubbleCircle').transition().attr('r', function(d) {
                return d.radius + 'px';
            })
            .attr('fill', function(d) {
                return d.fill
            })
            .attr('stroke', function(d) {
                return d.stroke
            })
            .attr('stroke-dasharray', function(d) {
                return d.strokeDash
            })

        if (htmlLabelsOn) d3.selectAll('.bubbleLabel').transition()
            .attr('height', function(d) {
                return textOuterRadius * 2 * d.radius;
            })
            .attr('width', function(d) {
                return textOuterRadius * 2 * d.radius;
            })
            .attr('x', function(d) {
                return -textOuterRadius * d.radius;
            })
            .attr('y', function(d) {
                return -textOuterRadius * d.radius;
            })
            .attr('font-size', function(d) {
                return d.radius < minTextRadius ? 0 : textRadius * d.radius;
            })
            .style('color', function(d) {
                return d.textColor
            })

        if (d3LabelsOn) d3bubbleLabels.forEach(function(e) {
            d = e._data[0].parent;
            e.height(function(f) {
                    return textOuterRadius * 2.1 * d.radius;
                })
                .width(function(f) {
                    return textOuterRadius * 2 * d.radius;
                })
                .fontColor(d.textColor)
                .fontSize(function(f) {
                    return d.radius < minTextRadius ? 0 : textRadius * d.radius;
                })
                .duration(400).delay(0).render();
        })

        simulation.nodes(nodes);
        simulation.alpha(v).restart();
        setTimeout(function() {
            filterTable();
            setTimeout(function() {
                filterLessons();
            }, 300)
        }, 500)
    }

    function filterTable() {

        d3.selectAll('.tableEntry')
            .classed('tableEntry-hidden', true)

        var onNodes = d3.selectAll('.bubble').filter(function(d) {
            return (((d.grow) || (d.solo)) && (Object.values(d.hidden).every(v => v === false)));
        }).data();
        var globalMatch = '';
        onNodes.forEach(function(node) {
            globalMatch = globalMatch + '<span class="keyword" style="background-color:' +
                d3.rgb(fillColor(node.priority)) + ';">' + node.id.replace(' ', '&nbsp;') + '</span> '
        })
        if (onNodes.length > 0) globalMatch = 'selected&nbsp;keywords&nbsp ' + globalMatch;
        d3.select('#selected-head-parent')
            .style('max-height', (onNodes.length > 0) ? '200px' : '0px')
            .style('opacity', (onNodes.length > 0) ? 1 : 0)
        d3.select('#selected-head').html(globalMatch)
            // setTimeout(function() {
        d3.selectAll('.tableEntry')
            .classed('tableEntry-hidden', function(stakeholder) {
                var hide = true
                var matchText = '';
                if (onNodes.length == 0) {
                    onNodes = d3.selectAll('.bubble').filter(function(d) {
                        return (Object.values(d.hidden).every(v => v === false));
                    }).data();
                }
                onNodes.forEach(function(node) {
                    if (stakeholder.keywords.indexOf(node.id) > -1) {
                        hide = false
                        matchText = matchText + '<span class="keyword" style="background-color:' +
                            d3.rgb(fillColor(node.priority)) + ';">' + node.id.replace(' ', '&nbsp;') + '</span> '
                    }
                })

                d3.select(this).select('.matches').html(matchText)
                return hide;
            })
            // }, 200)
        d3.select('#stakeholder-table').selectAll('.keyword')
            .on('click', function(d) {
                var keyword = this.innerHTML.replace('&nbsp;', ' ');
                // console.log(keyword)
                d3.selectAll('.bubble').filter(function(d) {
                    return (d.id == keyword)
                }).data().forEach(growDetail)
            })
        setTimeout(function() {
            d3.select('#selected-head').selectAll('.keyword')
                .on('click', function(d) {
                    var keyword = this.innerHTML.replace('&nbsp;', ' ');
                    // console.log(keyword)
                    d3.selectAll('.bubble').filter(function(d) {
                        return (d.id == keyword)
                    }).data().forEach(growDetail)
                })
        }, 1000)
    }

    function filterLessons() {

        d3.selectAll('.lessonEntry')
            .classed('lessonEntry-hidden', true)

        var onNodes = d3.selectAll('.bubble').filter(function(d) {
            return (((d.grow) || (d.solo)) && (Object.values(d.hidden).every(v => v === false)));
        }).data();
        d3.selectAll('.lessonEntry')
            .classed('lessonEntry-hidden', function(lesson) {
                var hide = true
                var matchText = ''
                if (onNodes.length == 0) {
                    onNodes = d3.selectAll('.bubble').filter(function(d) {
                        return (Object.values(d.hidden).every(v => v === false));
                    }).data();
                }
                onNodes.forEach(function(node) {
                    if (Object.keys(lesson.keywords).indexOf(node.id) > -1) {
                        if (d3.select('#toggle_' + replaceSpaces(lesson.Priority)).classed('active')) {
                            if (d3.select('#toggle-lessons_' + replaceSpaces(lesson.Type)).classed('active')) {
                                hide = false
                                matchText = matchText + '<span class="keyword" style="background-color:' +
                                    d3.rgb(fillColor(node.priority)) + ';">' + node.id.replace(' ', '&nbsp;') + '</span> '
                            }
                        }
                    }
                })
                d3.select(this).select('.matches').html(matchText)
                return hide;
            })
        d3.select('#lessons-table').selectAll('.keyword')
            .on('click', function(d) {
                var keyword = this.innerHTML.replace('&nbsp;', ' ');
                // console.log(keyword)
                d3.selectAll('.bubble').filter(function(d) {
                    return (d.id == keyword)
                }).data().forEach(growDetail)
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
        if (!(Object.values(d.hidden).every(v => v === false))) d.radius = d.hiddenRadius;
        redrawBubbles();
    }

    function removeSoloFromAll() {
        d3.selectAll('.bubble').attr('id', function(d) {
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
        d3.select(this).select('.bubbleCircle').attr('stroke-width', function(d) {
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
        d3.select(this).select('.bubbleCircle').attr('stroke-width', function(d) {
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
    chart.toggleDisplay = function(displayType, displayName) {
        if (displayType === 'group') {
            groupBubbles(displayName);
        } else if (displayType === 'color') {
            colorBubbles(displayName);
        }
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
        .on('click', function() {
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

    d3.select('#toolbar')
        .selectAll('#color .button')
        .on('click', function() {
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

    d3.select('#toolbar')
        .selectAll('#neighbors .button')
        .on('click', function() {
            // Remove active class from all buttons
            d3.selectAll('#neighbors .button').classed('active', false);
            // Find the button just clicked
            var button = d3.select(this);
            // Set it as the active button
            button.classed('active', true);
            // Get the id of the button
            neighbors = button.attr('id');
            // console.log(neighbors)
        });

    d3.select('#toolbar').transition().duration(1500).delay(500).style('opacity', 1);
    d3.select('#legend').transition().duration(1500).delay(2500).style('opacity', 1);
    d3.select('#details').transition().duration(1500).delay(4000).style('opacity', 1);

}

// Load the data.
d3.json('data/nodes_edges_table_lessons3.json', display);

// setup the buttons.
setupButtons();

//utils
function replaceSpaces(s) {
    return s.replace(/ /g, "-");
}

function wrap(text, width) {
    text.each(function() {
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