fetch('/data')
  .then(res => res.json())
  .then(data => {
    // build sets
    const techNames = new Set(data.map(d=>d.name));
    const idSet = new Set();
    data.forEach(d => {
      idSet.add(d.name);
      d.entities.forEach(ent => idSet.add(ent[0]));
    });
    const nodes = Array.from(idSet).map(id=>({ id }));
    const links = [];
    data.forEach(d => {
      d.entities.forEach(ent => {
        links.push({ source: d.name, target: ent[0] });
      });
    });

    // SVG + zoom/pan
    const W = document.getElementById('graph').clientWidth;
    const H = document.getElementById('graph').clientHeight;
    const svg = d3.select("#graph")
      .append("svg")
        .attr("width", W).attr("height", H)
        .call(d3.zoom().scaleExtent([0.5,4])
          .on("zoom", e => g.attr("transform", e.transform))
        );
    const g = svg.append("g");

    // force simulation
    const sim = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d=>d.id).distance(80))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(W/2, H/2));

    // draw links
    g.append("g").selectAll("line")
      .data(links).enter().append("line")
      .attr("stroke", "#555");

    // draw nodes
    g.append("g").selectAll("circle")
      .data(nodes).enter().append("circle")
        .attr("r", d => techNames.has(d.id)?8:5)
        .attr("fill", d=> techNames.has(d.id) ? "#4da6ff" : "#ffa64d")
        .style("cursor","pointer")
        .on("click",(e,d)=> showDetails(d.id))
        .call(d3.drag()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended)
        );

    // draw labels
    g.append("g").selectAll("text")
      .data(nodes).enter().append("text")
        .text(d=>d.id)
        .attr("font-size",8)
        .attr("dx",10).attr("dy",3)
        .attr("fill","#ddd");

    // tick
    sim.on("tick", () => {
      g.selectAll("line")
        .attr("x1",d=>d.source.x).attr("y1",d=>d.source.y)
        .attr("x2",d=>d.target.x).attr("y2",d=>d.target.y);
      g.selectAll("circle")
        .attr("cx",d=>d.x).attr("cy",d=>d.y);
      g.selectAll("text")
        .attr("x",d=>d.x).attr("y",d=>d.y);
    });

    // drag handlers
    function dragstarted(e,d){
      if(!e.active) sim.alphaTarget(0.3).restart();
      d.fx=d.x; d.fy=d.y;
    }
    function dragged(e,d){ d.fx=e.x; d.fy=e.y; }
    function dragended(e,d){
      if(!e.active) sim.alphaTarget(0);
      d.fx=null; d.fy=null;
    }

    // DETAILS + BAR + PIE
    function showDetails(name){
      const entry = data.find(d=>d.name===name);
      if(!entry) return;
      // INFO panel
      d3.select("#info").html(`
        <h2>${entry.name}</h2>
        <div><strong>ID:</strong> ${entry.id}</div>
        <div><strong>Sub-techniques:</strong> ${entry.subtechniques.join(", ")||"None"}</div>
        <div><strong>Tactics:</strong> ${entry.tactics.join(", ")||"None"}</div>
        <div><strong>Platforms:</strong> ${entry.platforms.join(", ")||"None"}</div>
        <div><strong>Version:</strong> ${entry.version}</div>
        <div><strong>Created:</strong> ${entry.created}</div>
        <div><strong>Modified:</strong> ${entry.modified}</div>
        <h3>Description</h3>
        <p>${entry.description}</p>
      `);

      // prepare bar + pie data
      const counts = {};
      entry.entities.forEach(([t,lab])=>{
        counts[lab] = (counts[lab]||0)+1;
      });
      const chartData = Object.entries(counts)
        .map(([label,c])=>({label,count:c}));

      drawBarChart(chartData);
      drawPieChart(chartData);
    }

    function drawBarChart(data){
      const svg = d3.select("#barChart");
      const w = svg.node().clientWidth, h = svg.node().clientHeight;
      const m = {top:20,right:10,bottom:50,left:40};
      const iw = w-m.left-m.right, ih = h-m.top-m.bottom;
      svg.selectAll("*").remove();
      const x = d3.scaleBand()
          .domain(data.map(d=>d.label))
          .range([0,iw])
          .padding(0.1);
      const y = d3.scaleLinear()
          .domain([0,d3.max(data,d=>d.count)]).nice()
          .range([ih,0]);

      const g2 = svg.append("g")
        .attr("transform",`translate(${m.left},${m.top})`);

      g2.selectAll("rect")
        .data(data).enter().append("rect")
        .attr("x",d=>x(d.label))
        .attr("y",d=>y(d.count))
        .attr("width",x.bandwidth())
        .attr("height",d=>ih-y(d.count))
        .attr("fill","#4da6ff");

      g2.append("g")
        .attr("transform",`translate(0,${ih})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
          .attr("transform","rotate(-45)")
          .style("text-anchor","end")
          .attr("fill","#ccc");

      g2.append("g")
        .call(d3.axisLeft(y).ticks(4).tickSize(-iw))
        .selectAll("text").attr("fill","#ccc");
    }

    function drawPieChart(data){
      const svg = d3.select("#pieChart");
      const w = svg.node().clientWidth, h = svg.node().clientHeight;
      const radius = Math.min(w,h)/2 - 10;
      svg.selectAll("*").remove();
      const g3 = svg.append("g")
        .attr("transform",`translate(${w/2},${h/2})`);
      const pie = d3.pie().value(d=>d.count);
      const arc = d3.arc().innerRadius(0).outerRadius(radius);
      const color = d3.scaleOrdinal(d3.schemeCategory10)
        .domain(data.map(d=>d.label));

      const arcs = g3.selectAll("arc")
        .data(pie(data)).enter().append("g");

      arcs.append("path")
        .attr("d",arc)
        .attr("fill",d=>color(d.data.label));

      arcs.append("text")
        .attr("transform",d=>`translate(${arc.centroid(d)})`)
        .attr("text-anchor","middle")
        .attr("fill","#fff")
        .style("font-size","10px")
        .text(d=>`${d.data.label}: ${d.data.count}`);
    }
});
