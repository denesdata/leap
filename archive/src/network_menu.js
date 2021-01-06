d3.json('data/network0.json', function(menu_data) {
    console.log(menu_data)

    var menu_width = 960,
        menu_height = 400;

    var color = d3.scaleOrdinal(d3.schemeCategory10);

    var menu_nodes = menu_data.nodes.map(function(d) {
        return {
            id: d.id,
            size: +d.Size,
            // priority: d.Priority,
            x: Math.random() * 900,
            y: Math.random() * 800
        };
    });
    var menu_links = menu_data.edges.map(function(d) {
        return {
            source: d.source,
            target: d.target,
            // weight: d.Weight
        };
    });

    var menu_simulation = d3.forceSimulation()
        .force("link", d3.forceLink().distance(200).strength(.6))
        .force("charge", d3.forceManyBody())
        // use forceX and forceY instead to change the relative positioning
        // .force("centering", d3.forceCenter(width/2, height/2))
        .force("x", d3.forceX(menu_width / 2))
        .force("y", d3.forceY(menu_height / 2))
        .on("tick", menu_tick);

    var menu_svg = d3.select("#keywords").append("svg")
        .attr("width", menu_width)
        .attr("height", menu_height);

    menu_start();

    function menu_start() {
        var nodeElements = menu_svg.selectAll(".node").data(menu_nodes, function(d) { return d.id });
        var linkElements = menu_svg.selectAll(".link").data(menu_links);

        nodeElements.enter().append("circle").attr("class", function(d) { return "node " + d.id; })
            .attr("r", function(d) { return d.size });
        linkElements.enter().insert("line", ".node").attr("class", "link");

        nodeElements.exit().remove();
        linkElements.exit().remove();

        menu_simulation.nodes(menu_nodes)
        menu_simulation.force("link").links(menu_links)
        menu_simulation.restart();
    }

    function menu_tick() {
        var nodeElements = menu_svg.selectAll(".node");
        var linkElements = menu_svg.selectAll(".link");

        nodeElements.attr("cx", function(d, i) { return d.x; })
            .attr("cy", function(d) { return d.y; })

        linkElements.attr("x1", function(d) { return d.source.x; })
            .attr("y1", function(d) { return d.source.y; })
            .attr("x2", function(d) { return d.target.x; })
            .attr("y2", function(d) { return d.target.y; });

    }
})